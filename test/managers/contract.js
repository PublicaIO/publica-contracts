const web3 = require('./web3');

class Contract {
    constructor() {
        // Should be set by child classes
        this.abi = false;
        this.bytecode = false;

        this.web3 = web3;
    }

    /**
     * Estimate transaction gas limit
     *
     * @param {Object} transaction
     * @param {number} multiplier Safety
     */
    estimateGas(transaction, options = {}, multiplier = 1) {
        return new Promise((resolve, reject) => {
            transaction.estimateGas(options, async (error, gas) => {
                if (error) {
                    return reject(error);
                }

                resolve(Math.ceil(gas * multiplier));
            })
        });
    }

    /**
     * Deploy contract
     *
     * @param {string} deployer Who is deploying address
     * @param {string} password Password
     * @param {Object} params Object with params to pass to contract constructor
     */
    async deploy(deployer, password, params = {}) {
        await this.web3.eth.personal.unlockAccount(deployer, password);

        const contract = new this.web3.eth.Contract(this.abi);
        const data = { arguments: Object.values(params), data: this.bytecode };
        const transaction = contract.deploy(data);

        // Deploy the contract
        const deployed = await transaction.send({
            from: deployer,
            gas: await this.estimateGas(transaction, { from: deployer }),
            gasPrice: web3.gasPrice
        });

        deployed.setProvider(this.web3.currentProvider);

        return deployed;
    }

    /**
     * Get deployed contract instance at address
     *
     * @param {string} address Contract address
     */
    instance(address) {
        return new this.web3.eth.Contract(this.abi, address);
    }
}

module.exports = Contract;