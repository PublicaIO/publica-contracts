const assert = require('assert');
const moment = require('moment');
const sleep = require('sleep');

const readContractManager = require('./managers/ico_read');
const pebblesContractManager = require('./managers/pebbles');
const dataContractManager = require('./managers/data');
const web3 = require('./managers/web3');

// Global variables
var readInstance, dataInstance, pebblesInstance;

// Prepare data for ICO READ contract
// Some properties will be updated once data is known
var readContractDataStub = {
    pebbles: 0,
    data: 0,
    owner: 0,
    price: web3.utils.toWei('4'),
    ICOPrice: web3.utils.toWei('2'),
    minICOCopies: 10,
    ICOCopies: 20,
    totalCopies: 30,
    ICOStartDate: moment().unix(),
    ICOEndDate: moment().unix(),

    url: 'http://publica.com/book-url',
    title: 'My ICO Stories',

    symbol: 'MSTTKN',
    name: 'My ICO Read Token',
    currency: web3.utils.stringToHex('usd'),
};

var states = { Init: 0, ICOInProgress: 1, ICOEnded: 2 };
var icoStates = { Init: 0, SoftCap: 1, Fail: 2, Success: 3 };

const purchaseTokens = async function (allowance, willThrow = false) {
    // Approve read contract to spend buyers PBL tokens
    const approveAmount = web3.utils.toWei(allowance);
    await pebblesContractManager.approve(pebblesInstance._address, buyer, '', readInstance._address, approveAmount);

    const approvedAmount = await pebblesInstance.methods.allowance(buyer, readInstance._address).call();
    assert.equal(approvedAmount, approveAmount, 'Allowance was not set');

    if (willThrow) {
        await wrapThrowable(async () => await readContractManager.buy(readInstance._address, buyer, ''));
    } else {
        // Perform buy from buyer account
        await readContractManager.buy(readInstance._address, buyer, '');
    }

    return {
        readBalance: await readInstance.methods.balanceOf(buyer).call(),
        pblBalance: await pebblesInstance.methods.balanceOf(buyer).call(),
        refund: await readInstance.methods.refunds(buyer).call()
    }
}

const wrapThrowable = async function (method) {
    try {
        await method();
        assert(false, 'Method should have thrown an exception');
    } catch (error) {
        assert(
            error.message.indexOf('always failing transaction') !== -1,
            `Not expected error message: ${error.message}`
        );
    }
}

const deployPBLContract = async function () {
    // Deploy new Pebbles contract
    pebblesInstance = await pebblesContractManager.deploy(pebblesOwner, '');
    readContractDataStub.pebbles = pebblesInstance._address;

    // Pre-fund buyer with PBL tokens
    const preFundAmount =  web3.utils.toWei('100');
    await pebblesContractManager.preFundAccount(pebblesInstance._address, pebblesOwner, '', preFundAmount, buyer);
    const preFundedAmount = await pebblesInstance.methods.balanceOf(buyer).call();
    assert.equal(preFundedAmount, preFundAmount, 'Account was not pre-funded with 100 PBL');
}

describe('ICOReadContract', () => {
    before(async () => {
        // Setup accounts
        accounts = await web3.eth.getAccounts();
        pebblesOwner = accounts[0];
        readOwner = accounts[1];
        dataOwner = accounts[2];
        buyer = accounts[3];

        // Update read contract constructor data
        readContractDataStub.owner = readOwner;

        // Deploy new data contract
        dataInstance = await dataContractManager.deploy(dataOwner, '');
        readContractDataStub.data = dataInstance._address;

        // Update currency rate in data contract
        const rate = web3.utils.toWei('1');
        await dataContractManager.setRate(dataInstance._address, dataOwner, '', rate, readContractDataStub.currency);
        const updatedRate = await dataInstance.methods.rates(readContractDataStub.currency).call();
        assert.equal(updatedRate, rate, 'Currency rate in Data contract was not updated');
    });

    describe('=== ICO NOT Started ===', () => {
        before(async () => {
            await deployPBLContract();

            // Set ICO dates to future and deploy ICO read contract
            readContractDataStub.ICOStartDate = moment().add(1, 'M').unix();
            readContractDataStub.ICOEndDate = moment().add(2, 'M').unix();

            readInstance = await readContractManager.deploy(readOwner, '', readContractDataStub);
        });

        it('Unable to purchase tokens', async () => {
            const result = await purchaseTokens('8', true);

            assert.equal(result.readBalance, 0, 'READ balance was changed');
            assert.equal(result.refund, 0, 'Refund amount balance was changed');
            assert.equal(result.pblBalance, web3.utils.toWei('100'), 'PBL balance was changed');
        });

        it('Unable to refund', async () => {
            wrapThrowable(async() => await readContractManager.refund(readInstance._address, buyer, ''));
        });
    });

    describe('=== ICO Started ===', () => {
        before(async () => {
            await deployPBLContract();

            // Set ICO dates so that ICO is started
            readContractDataStub.ICOStartDate = moment().unix() - 10;
            readContractDataStub.ICOEndDate = moment().add(2, 'M').unix();

            readInstance = await readContractManager.deploy(readOwner, '', readContractDataStub);
        });

        it('ICO book price is used', async () => {
            const price = await readInstance.methods.getPrice().call();

            assert.equal(price, readContractDataStub.ICOPrice, 'Wrong price during ICO is used');
        });

        it('Tokens are sellable', async () => {
            const result = await purchaseTokens('8');

            assert.equal(result.readBalance, 4, 'READ balance was not changed');
            assert.equal(result.refund, web3.utils.toWei('7.2'), 'Refund amount was not changed');
            assert.equal(result.pblBalance, web3.utils.toWei('92'), 'PBL balance was not changed');
        });

        it('Unable to refund', async () => {
            wrapThrowable(async() => await readContractManager.refund(readInstance._address, buyer, ''));
        });
    });

    describe('=== ICO time ended without reaching soft cap ===', () => {
        before(async () => {
            await deployPBLContract();

            // Set ICO dates so that ICO is in progress
            readContractDataStub.ICOStartDate = moment().unix() - 20;
            readContractDataStub.ICOEndDate = moment().unix() + 20;
            readInstance = await readContractManager.deploy(readOwner, '', readContractDataStub);

            const result = await purchaseTokens('8');
            assert.equal(result.readBalance, 4, 'READ balance was not changed');
            assert.equal(result.refund, web3.utils.toWei('7.2'), 'Refund amount was not changed');
            assert.equal(result.pblBalance, web3.utils.toWei('92'), 'PBL balance was not changed');

            // Wait for ICO to finish without reaching soft cap
            sleep.sleep(30);

            // Check if states were updated
            await readContractManager.updateStates(readInstance._address, readOwner, '');
            assert.equal(await readInstance.methods.state().call(), states.ICOEnded, 'Wrong contract state');
            assert.equal((await readInstance.methods.ico().call()).state, icoStates.Fail, 'Wrong ICO state');

        });

        it('Tokens are not sellable', async () => {
            const result = await purchaseTokens('8', true);

            assert.equal(result.readBalance, 4, 'READ balance was changed');
            assert.equal(result.refund, web3.utils.toWei('7.2'), 'Refund amount was changed');
            assert.equal(result.pblBalance, web3.utils.toWei('92'), 'PBL balance was changed');
        });

        it('Can refund tokens', async () => {
            await readContractManager.refund(readInstance._address, buyer, '');

            assert.equal(await readInstance.methods.balanceOf(buyer).call(), 0, 'READ tokens were not returned');
            assert.equal(await readInstance.methods.refunds(buyer).call(), 0, 'Refunds were not emptied');
            assert.equal(await pebblesInstance.methods.balanceOf(buyer).call(), web3.utils.toWei('99.2'), 'PBL tokens were not returned');
        });
    });

    describe('=== ICO time ended and soft cap reached ===', () => {
        before(async () => {
            await deployPBLContract();

            // Set ICO dates so that ICO is in progress
            readContractDataStub.ICOStartDate = moment().unix() - 20;
            readContractDataStub.ICOEndDate = moment().unix() + 20;
            readInstance = await readContractManager.deploy(readOwner, '', readContractDataStub);

            const result = await purchaseTokens('20');
            assert.equal(result.readBalance, 10, 'READ balance was not changed');
            assert.equal(result.refund, web3.utils.toWei('18'), 'Refund amount was not changed');
            assert.equal(result.pblBalance, web3.utils.toWei('80'), 'PBL balance was not changed');

            // Wait until the ICO ends
            sleep.sleep(30);
        });

        it('Tokens are sellable', async () => {
            const result = await purchaseTokens('8');

            assert.equal(result.readBalance, 12, 'READ balance was not changed');
            assert.equal(result.refund, web3.utils.toWei('18'), 'Refund amount was not changed');
            assert.equal(result.pblBalance, web3.utils.toWei('72'), 'PBL balance was not changed');
        });

        it('Regular book price is used', async () => {
            const price = await readInstance.methods.getPrice().call();

            assert.equal(price, readContractDataStub.price, 'Wrong price after ICO is ended is used');
        });

        it('Unable to refund', async () => {
            wrapThrowable(async() => await readContractManager.refund(readInstance._address, buyer, ''));
        });
    });

    describe('=== ICO ended reaching hard cap ===', () => {
        before(async () => {
            await deployPBLContract();

            // Set ICO dates so that ICO is in progress
            readContractDataStub.ICOStartDate = moment().unix() - 20;
            readContractDataStub.ICOEndDate = moment().unix() + 20;
            readInstance = await readContractManager.deploy(readOwner, '', readContractDataStub);
        });

        it('Unable to purchase more tokens than hard cap limit', async () => {
            // Purchase tokens so that hard cap is reached
            const result = await purchaseTokens('42');
            assert.equal(result.readBalance, 20, 'READ balance was not changed');
            assert.equal(result.refund, web3.utils.toWei('36'), 'Refund amount was not changed');
            assert.equal(result.pblBalance, web3.utils.toWei('60'), 'PBL balance was not changed');

            // Check if states were updated
            assert.equal(await readInstance.methods.state().call(), states.ICOEnded, 'Wrong contract state');
            assert.equal((await readInstance.methods.ico().call()).state, icoStates.Success, 'Wrong ICO state');
        });

        it('Tokens are sellable', async () => {
            const result = await purchaseTokens('8');

            assert.equal(result.readBalance, 22, 'READ balance was not changed');
            // After ICO is finished - refunds are disabled and amount should not change
            assert.equal(result.refund, web3.utils.toWei('36'), 'Refund amount was changed');
            assert.equal(result.pblBalance, web3.utils.toWei('52'), 'PBL balance was not changed');
        });

        it('Regular book price is used', async () => {
            const price = await readInstance.methods.getPrice().call();

            assert.equal(price, readContractDataStub.price, 'Wrong price after ICO is ended is used');
        });

        it('Unable to purchase more tokens than there are', async () => {
            const result = await purchaseTokens('36');

            assert.equal(result.readBalance, 30, 'Too much tokens were purchased');
            assert.equal(result.refund, web3.utils.toWei('36'), 'Refund amount was changed');
            assert.equal(result.pblBalance, web3.utils.toWei('20'), 'PBL balance was not changed');
        });

        it('After tokens are over - none can be bought', async () => {
            const result = await purchaseTokens('4', true);

            assert.equal(result.readBalance, 30, 'Too much tokens were purchased');
            assert.equal(result.refund, web3.utils.toWei('36'), 'Refund amount was changed');
            assert.equal(result.pblBalance, web3.utils.toWei('20'), 'PBL balance was not changed');
        });

        it('Unable to refund', async () => {
            wrapThrowable(async() => await readContractManager.refund(readInstance._address, buyer, ''));
        });
    });
});
