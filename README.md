# Publica Contracts

This package holds all Smart Contracts that will be used in Publica platform.

#### To run tests

In order to run tests you will need to connect to RPC server and create 3 accounts and pre-fund them. You can go with your own or use [this repository](https://github.com/PublicaIO/TestingEnvironment), which uses docker and has instructions on how to setup your local private node.

After you have your RPC server up and running for the first time you should run

```
npm run test:build
```

subsequent runs can have `:build` omitted in case contracts code was not changed.

```
npm run test
```