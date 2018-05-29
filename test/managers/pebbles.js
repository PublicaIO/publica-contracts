const Contract = require('./contract');
const ContractJSON = require('../../build/contracts/Pebbles.json');

class PebblesContract extends Contract {
    constructor() {
        super();

        this.abi = ContractJSON.abi;
        this.bytecode = ContractJSON.bytecode;
    }

    /**
     * Send PBL tokens to buyer account
     *
     * @param {string} address Contract address
     * @param {string} owner Tokens owner
     * @param {string} password Owner password
     * @param {string} amount How many tokens to transfer from owner to receiver
     * @param {string} receiver Tokens receiver
     */
    async preFundAccount(address, owner, password, amount, receiver) {
        await this.web3.eth.personal.unlockAccount(owner, password);
        const transaction = this.instance(address).methods.transfer(
            receiver,
            amount
        );

        await transaction.send({
            from: owner,
            gas: await this.estimateGas(transaction, { from: owner }),
            gasPrice: this.web3.gasPrice
        });
    }

    /**
     * Approve tokens spending
     *
     * @param {string} address Contract address
     * @param {string} owner Tokens owner
     * @param {string} password Owner's password
     * @param {string} spender Spender's address
     * @param {string} amount Amount to approve
     */
    async approve(address, owner, password, spender, amount) {
        await this.web3.eth.personal.unlockAccount(owner, password);
        const transaction = this.instance(address).methods.approve(
            spender,
            amount
        );

        await transaction.send({
            from: buyer,
            gas: await this.estimateGas(transaction, { from: buyer }),
            gasPrice: this.web3.gasPrice
        });
    }
}

module.exports = new PebblesContract();