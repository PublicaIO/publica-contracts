const assert = require('assert');

const dataContractManager = require('./managers/data');
const web3 = require('./managers/web3');

const prepareTestData = (test) => {
    return {
        code: web3.utils.stringToHex(test.code),
        rate: web3.utils.toWei(test.rate),
        amount: web3.utils.toWei(test.amount)
    }
}

const updateRate = async function (updater, code, rate, willThrow = false) {
    if (willThrow) {
        try {
            await dataContractManager.setRate(dataInstance._address, updater, '', rate, code);
            assert(false, 'Method should have thrown an exception');
        } catch (error) {
            assert(
                error.message.indexOf('always failing transaction') !== -1,
                `Not expected error message: ${error.message}`
            );
        }
    } else {
        await dataContractManager.setRate(dataInstance._address, updater, '', rate, code);
    }
}

describe('DataContract', () => {
    beforeEach(async () => {
        // Setup accounts
        accounts = await web3.eth.getAccounts();
        oracle = accounts[0];
        account = accounts[1];

        // Deploy new contract before every test
        dataInstance = await dataContractManager.deploy(oracle, '');
    });

    it('instance can be deployed', async () => {
        assert.equal(true, typeof dataInstance._address === 'string')
    })

    it('expected owner is set', async () => {
        assert.equal(
            web3.utils.toChecksumAddress(oracle),
            web3.utils.toChecksumAddress(await dataInstance.methods.owner().call())
        );
    })

    // Tests data
    const tests = [
        { rate: '999999999999999999', code: 'USD', amount: '4' },
        { rate: '0.8345', code: 'EUR', amount: '4.5' }
    ];

    tests.forEach(test => {
        const data = prepareTestData(test);

        it(`can update "${test.code}" currency rate to "${test.rate}" form oracle account`, async () => {
            await updateRate(oracle, data.code, data.rate);

            // Make sure that contract has correct rate set
            assert.equal(data.rate, await dataInstance.methods.rates(data.code).call());
        })

        it(`unable to update "${test.code}" currency rate from non oracle account`, async () => {
            // When contract is just deployed - rate should be 0
            const currentRate = await dataInstance.methods.rates(data.code).call();
            assert.equal(currentRate, 0);

            await updateRate(account, data.code, data.rate, true);

            // Make sure that rate was not updated
            assert.notEqual(data.rate, await dataInstance.methods.rates(data.code).call());
        })

        it(`can correctly convert amount of ${test.amount} "${test.code}" => "PBL" using rate "${test.rate}"`, async () => {
            await updateRate(oracle, data.code, data.rate);

            const convertedInContract = await dataInstance.methods.convert(data.code, data.amount).call();
            const convertedInTest = web3.utils.fromWei(
                web3.utils.toBN(data.amount).mul(web3.utils.toBN(data.rate)).toString()
            );

            assert.equal(convertedInContract, convertedInTest);
        })

        it(`unable to set "${test.code}" => "PBL" rate to 0`, async () => {
            // Set correct rate initially
            await updateRate(oracle, data.code, data.rate);

            // Try setting 0 as a rate
            await updateRate(oracle, data.code, 0, true);

            // Current rate should be the previously set one
            assert.equal(data.rate, await dataInstance.methods.rates(data.code).call());
        });
    });
});
