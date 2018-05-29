# Notes

Debug function:

```
const debug = async function (message='none') {
    const state = await readInstance.methods.state().call();
    const ico = await readInstance.methods.ico().call();

    console.log(' ');
    console.log(`      %%%%%% DEBUG @ ${message} %%%%%%`);
    console.log('      - State                     :', Object.keys(states)[state]);
    console.log('      - ICO State                 :', Object.keys(icoStates)[ico.state]);
    console.log('      - Purchased tokens          :', await readInstance.methods.purchasedTokens().call());
    console.log(' ');
    console.log('      - Buyer PBL Balance         :', await pebblesInstance.methods.balanceOf(buyer).call());
    console.log('      - Buyer PBL Allowance       :', await pebblesInstance.methods.allowance(buyer, readInstance._address).call());
    console.log(' ');
    console.log('      - Buyer READ Balance        :', await readInstance.methods.balanceOf(buyer).call());
    console.log('      - Buyer refund amount       :', await readInstance.methods.refunds(buyer).call());
    console.log('      - READ Contract funds in PBL:', await pebblesInstance.methods.balanceOf(readInstance._address).call());
    console.log('      - FEE Receiver PBL balance  :', await pebblesInstance.methods.balanceOf("0xa6b02eE1e4eB59AFb7a8aB930357c02c9dC29dAD").call());
    console.log('      - Author PBL balance        :', await pebblesInstance.methods.balanceOf(readOwner).call());
    console.log('      %%%%%% DEBUG END %%%%%%');
    console.log(' ');
}
```

List of arguments to deploy ICORead and Data in Remix:
```
"0x5e72914535f202659083db3a02c984188fa26e9f", "0x692a70d2e424a56d2c6c27aa97d1a86395877b3a", "0x14723a09acff6d2a60dcdf7aa4aff308fddc160c", "4000000000000000000", "2000000000000000000", 10, 20, 100, 1527508920, 1527508921, "sdf", "sdf", "sdf", "sffsd", "0x757364"
"0x757364", "1000000000000000000"
```

Numbers:
```
100*10**18
100000000000000000000
8*10**18
8000000000000000000
1*10**18
1000000000000000000
```