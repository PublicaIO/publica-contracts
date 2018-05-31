const Contract = require('./contract');
const ContractJSON = require('../../build/contracts/ICOReadToken.json');

class ICOReadContract extends Contract {
    constructor() {
        super();

        this.abi = ContractJSON.abi;
        this.bytecode = ContractJSON.bytecode;
    }

    /**
     * @inheritDoc
     */
    async deploy(deployer, password, params = {}) {
        const deployed = await super.deploy(deployer, password, params);

        // deployed.events.Logs((error, result) => {
        //     if (error) {
        //         return console.error(error);
        //     }

        //     console.log(' ');
        //     console.log('Logs Event:', result.returnValues);
        //     console.log(' ');
        // });

        return deployed;
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

    /**
     *
     * @param {string} address Contract address
     * @param {string} buyer Buyer address
     * @param {string} password Buyer password
     */
    async refund(address, buyer, password) {
        await this.web3.eth.personal.unlockAccount(buyer, password);
        const transaction = this.instance(address).methods.refund();

        await transaction.send({
            from: buyer,
            gas: await this.estimateGas(transaction, { from: buyer }, 10),
            gasPrice: this.web3.gasPrice
        })
    }

    /**
     * Send transaction to contract to update it's states
     *
     * @param {string} address
     * @param {string} owner
     * @param {string} password
     */
    async updateStates(address, owner, password) {
        await this.web3.eth.personal.unlockAccount(owner, password);
        const transaction = this.instance(address).methods.updateStates();

        await transaction.send({
            from: owner,
            gas: await this.estimateGas(transaction, { from: owner }, 5),
            gasPrice: this.web3.gasPrice
        });
    }
}

module.exports = new ICOReadContract();