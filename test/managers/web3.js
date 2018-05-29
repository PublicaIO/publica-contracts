const Web3 = require('web3');
const web3 = new Web3();

// web3.setProvider(new Web3.providers.WebsocketProvider('ws://localhost:8546'));
web3.setProvider(new Web3.providers.HttpProvider('http://localhost:8545'));

web3.gasPrice = 5000000000;

module.exports = web3;