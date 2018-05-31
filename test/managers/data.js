const Contract = require('./contract');
const ContractJSON = require('../../build/contracts/Data.json');

class DataContract extends Contract {
    constructor() {
        super();

        this.abi = ContractJSON.abi;
        this.bytecode = ContractJSON.bytecode;
    }

    async setRate(address, owner, password, rate, currency) {
        await this.web3.eth.personal.unlockAccount(owner, password);
        const transaction = this.instance(address).methods.updateRate(
            currency,
            rate
        );

        await transaction.send({
            from: owner,
            gas: await this.estimateGas(transaction, { from: owner }),
            gasPrice: this.web3.gasPrice
        });
    }
}

module.exports = new DataContract();