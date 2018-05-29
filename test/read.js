const assert = require('assert');

// Managers
const readContractManager = require('./managers/read');
const pebblesContractManager = require('./managers/pebbles');
const dataContractManager = require('./managers/data');
const web3 = require('./managers/web3');

// Instances
var readInstance, dataInstance, pebblesInstance;

// Prepare data for READ contract
// Some properties will be updated once data is known
var readContractDataStub = {
    pebbles: 0,
    data: 0,
    owner: 0,
    price: web3.utils.toWei('4'),
    url: 'http://publica.com/book-url',
    title: 'My Stories',
    symbol: 'MSTTKN',
    name: 'My Read Token',
    currency: web3.utils.stringToHex('usd'),
};

const purchaseTokens = async function (allowance) {
    // Approve read contract to spend buyers PBL tokens
    const approveAmount = web3.utils.toWei(allowance);
    await pebblesContractManager.approve(pebblesInstance._address, buyer, '', readInstance._address, approveAmount);

    const approvedAmount = await pebblesInstance.methods.allowance(buyer, readInstance._address).call();
    assert.equal(approvedAmount, approveAmount, 'Allowance was not set');

    await readContractManager.buy(readInstance._address, buyer, '');

    return {
        readBalance: await readInstance.methods.balanceOf(buyer).call(),
        pblBalance: await pebblesInstance.methods.balanceOf(buyer).call()
    }
}

describe('ReadContract', () => {
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

        // Deploy new Pebbles contract
        pebblesInstance = await pebblesContractManager.deploy(pebblesOwner, '');
        readContractDataStub.pebbles = pebblesInstance._address;

        // Deploy read contract
        readInstance = await readContractManager.deploy(readOwner, '', readContractDataStub);
    });

    it('instances (Data, READ, Pebbles) can be deployed', async () => {
        assert.equal(typeof readInstance._address === 'string', true, 'READ contract was not deployed');
        assert.equal(typeof pebblesInstance._address === 'string', true, 'PBL contract was not deployed');
        assert.equal(typeof dataInstance._address === 'string', true, 'Data contract was not deployed');
    })

    it('READ contract has correct Book data', async () => {
        const book = await readInstance.methods.book().call();

        ['price', 'url', 'title'].forEach(prop => {
            assert.equal(book[prop], readContractDataStub[prop], `"${prop}" property data mismatch`);
        })
    });

    it('Purchase happens', async() => {
        // Pre-fund buyer with PBL tokens
        const preFundAmount =  web3.utils.toWei('100');
        await pebblesContractManager.preFundAccount(pebblesInstance._address, pebblesOwner, '', preFundAmount, buyer);
        const preFundedAmount = await pebblesInstance.methods.balanceOf(buyer).call();
        assert.equal(preFundedAmount, preFundAmount, 'Account was not pre-funded with 100 PBL');

        const result = await purchaseTokens('8');

        assert.equal(result.readBalance, 2, 'READ balance was not update');
        assert.equal(result.pblBalance, web3.utils.toWei('92'), 'PBL balance was not updated');
    })
})
