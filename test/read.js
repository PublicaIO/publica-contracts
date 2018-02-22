const assert = require('assert');
const Web3 = require('web3');

var web3 = new Web3();
web3.setProvider(new Web3.providers.HttpProvider('http://localhost:8545'));
const gas = 3000000;
const gasPrice = 5000000000;

const ReadTokenContract = require('../build/contracts/ReadToken.json');
const PebblesContract = require('../build/contracts/Pebbles.json');
const DataContract = require('../build/contracts/Data.json');

describe('ReadContract', () => {
    beforeEach(async () => {
        // Setup accounts
        accounts = await web3.eth.getAccounts();
        pebblesOwner = accounts[0];
        readOwner = accounts[1];
        dataOwner = accounts[2];
        buyer = accounts[3];

        // Deploy new data contract before every test
        const dataContract = new web3.eth.Contract(DataContract.abi);
        await web3.eth.personal.unlockAccount(dataOwner, '');
        dataInstance = await dataContract.deploy({
            data: DataContract.bytecode
        })
        .send({
            from: dataOwner,
            gas,
            gasPrice
        });

        // Deploy new Pebbles contract and unlock pebblesOwner account before every test
        const pebblesContract = new web3.eth.Contract(PebblesContract.abi);
        await web3.eth.personal.unlockAccount(pebblesOwner, '');
        pebblesInstance = await pebblesContract.deploy({
            data: PebblesContract.bytecode
        })
        .send({
            from: pebblesOwner,
            gas,
            gasPrice
        });

        // Prepare data for READ contract
        readContractDataStub = {
            pebbles: pebblesInstance._address,
            data: dataInstance._address,
            owner: readOwner,
            price: web3.utils.toWei('4'),
            url: 'http://publica.com/book-url',
            title: 'My Stories',
            symbol: 'MSTTKN',
            name: 'My Read Token',
            currency: web3.utils.stringToHex('usd'),
        };

        // Deploy new READ contract and unlock readOwner account before every test
        const readContract = new web3.eth.Contract(ReadTokenContract.abi);
        await web3.eth.personal.unlockAccount(readOwner, '');
        readInstance = await readContract.deploy({
            arguments: Object.values(readContractDataStub),
            data: ReadTokenContract.bytecode
        })
        .send({
            from: readOwner,
            gas,
            gasPrice
        });

        readInstance.setProvider(web3.currentProvider);
        pebblesInstance.setProvider(web3.currentProvider);
        dataInstance.setProvider(web3.currentProvider);
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
        // Update currency rate in data contract
        await web3.eth.personal.unlockAccount(dataOwner, '');
        const rate = web3.utils.toWei('1');
        await dataInstance.methods.updateRate(
            readContractDataStub.currency,
            rate
        ).send({
            from: dataOwner,
            gas,
            gasPrice
        });

        const updatedRate = await dataInstance.methods.rates(readContractDataStub.currency).call();
        assert.equal(updatedRate, rate, 'Currency rate in Data contract was not updated');

        // Prefund buyer with PBL tokens
        await web3.eth.personal.unlockAccount(pebblesOwner, '');
        const prefundAmount = web3.utils.toWei('100');
        await pebblesInstance.methods.transfer(
            buyer,
            prefundAmount
        ).send({
            from: pebblesOwner,
            gas,
            gasPrice
        });

        const prefundedAmount = await pebblesInstance.methods.balanceOf(buyer).call();
        assert.equal(prefundedAmount, prefundAmount, 'Account was not prefunded with 100 PBL');

        // Approve read contract to spend buyers PBL tokens
        await web3.eth.personal.unlockAccount(buyer, '');
        const approveAmount = web3.utils.toWei('8');
        await pebblesInstance.methods.approve(
            readInstance._address,
            approveAmount
        ).send({
            from: buyer,
            gas,
            gasPrice
        });

        const approvedAmount = await pebblesInstance.methods.allowance(buyer, readInstance._address).call();
        assert.equal(approvedAmount, approveAmount, 'Allowance was not set');

        // Perform buy from buyer account
        await web3.eth.personal.unlockAccount(buyer, '');
        await readInstance.methods.buy()
            .send({
                from: buyer,
                gas,
                gasPrice,
            });

        const readBalance = await readInstance.methods.balanceOf(buyer).call();
        const pblBalance = await pebblesInstance.methods.balanceOf(buyer).call();

        assert.equal(readBalance, 2, 'READ balance was not update');
        assert.equal(pblBalance, web3.utils.toWei('92'), 'PBL balance was not updated');
    })
})
