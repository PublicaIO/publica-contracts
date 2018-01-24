const assert = require('assert');
const Web3 = require('web3');

var web3 = new Web3();
web3.setProvider(new Web3.providers.HttpProvider('http://localhost:8545'));
const gasLimit = 6000000;

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

        // Deploy new data contract before every test
        const dataContract = new web3.eth.Contract(DataContract.abi);
        await web3.eth.personal.unlockAccount(dataOwner, '');
        dataInstance = await dataContract.deploy({
            data: DataContract.bytecode
        })
        .send({
            from: dataOwner,
            gas: gasLimit
        });

        // Deploy new Pebbles contract and unlock pebblesOwner account before every test
        const pebblesContract = new web3.eth.Contract(PebblesContract.abi);
        await web3.eth.personal.unlockAccount(pebblesOwner, '');
        pebblesInstance = await pebblesContract.deploy({
            arguments: [pebblesOwner],
            data: PebblesContract.bytecode
        })
        .send({
            from: pebblesOwner,
            gas: gasLimit
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
            currency: web3.utils.stringToHex('USD'),
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
            gas: gasLimit
        });

        readInstance.setProvider(web3.currentProvider);
        pebblesInstance.setProvider(web3.currentProvider);
        dataInstance.setProvider(web3.currentProvider);
    });

    it('instances (Data, READ, Pebbles) can be deployed', async () => {
        const deployed = typeof readInstance._address === 'string'
            && typeof pebblesInstance._address === 'string'
            && typeof dataInstance._address === 'string';

        assert.equal(true, deployed);
    })

    it('READ contract has correct Book data', async () => {
        const book = await readInstance.methods.book().call();

        ['price', 'url', 'title'].forEach(prop => {
            assert.equal(book[prop], readContractDataStub[prop], `"${prop}" property data mismatch`);
        })
    });
})
