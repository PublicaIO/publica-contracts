# Publica Contracts

This package holds all Smart Contracts that will be used in Publica platform.

#### To run tests

In order to run tests you will need to connect to RPC server and create 4 accounts and pre-fund them. You can go with your own or use [this repository](https://github.com/PublicaIO/TestingEnvironment), which uses docker and has instructions on how to setup your local private node.

After you have added 4 accounts you need to update Pebbles contract to have "owner" as your `eth.accounts[0]`.

After you have your RPC server up and running for the first time you should run

```sh
npm run compile
```

subsequent runs can omit running compile in case contracts code was not changed.

```sh
npm run test
```