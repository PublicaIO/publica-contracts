const Contract = require('./contract');
const ContractJSON = require('../../build/contracts/ReadToken.json');

class ReadContract extends Contract {
    constructor() {
        super();

        this.abi = ContractJSON.abi;
        this.bytecode = ContractJSON.bytecode;
    }

    /**
     * Do the purchase
     *
     * @param {string} address Contract address
     * @param {string} buyer Buyer address
     * @param {string} password Buyer password
     */
    async buy(address, buyer, password) {
        await this.web3.eth.personal.unlockAccount(buyer, password);
        const transaction = this.instance(address).methods.buy();

        await transaction.send({
            from: buyer,
            gas: await this.estimateGas(transaction, { from: buyer }),
            gasPrice: this.web3.gasPrice
        });
    }
}

module.exports = new ReadContract();