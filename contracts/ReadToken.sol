pragma solidity ^0.4.18;

import './Pebbles.sol';
import './Data.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract ReadToken is Token {
    // Token Data
    string public symbol;
    string public name;
    uint8 public constant decimals = 0;

    // Hold READ token balances of the users
    mapping (address => uint256) public balances;

    // Allowance for future token management by user
    mapping (address => mapping (address => uint256)) public allowed;

    Pebbles public pebbles = Pebbles(0x0);
    Data public data = Data(0x0);
    address public author;
    uint256 public totalTokens = 0;
    bytes3 public currency;
    uint8 public constant FEE_PERCENT = 10;
    address public constant FEE_RECEIVER = 0xa6b02eE1e4eB59AFb7a8aB930357c02c9dC29dAD;

    // Book related data
    struct Book {
        uint256 price;
        uint256 pblPrice;
        string url;
        string title;
    }

    Book public book;

    function ReadToken(
        Pebbles _pebbles,                 // PBL contract address
        Data _data,                       // Data contract address
        address _owner,                   // Book author address (author is contract owner)
        uint256 _price,                   // Book price in USD with 18 zeros simulating decimals
        string _url,                      // Book url
        string _title,                    // Book title
        string _tokenSymbol,              // Token symbol
        string _tokenName,                // Token name
        bytes3 _currency                  // Currency symbol
    ) public {
        pebbles = _pebbles;
        data = _data;

        author = _owner;
        book = Book(_price, data.convert(_currency, _price), _url, _title);
        currency = _currency;

        symbol = _tokenSymbol;
        name = _tokenName;
    }

    // ERC20 Token Interface implementation
    function totalSupply() public view returns (uint256) {
        return totalTokens;
    }

    function transfer(address _to, uint256 _value) public returns (bool success) {
        if (balances[msg.sender] < _value) {
            return false;
        }

        balances[msg.sender] = SafeMath.sub(balances[msg.sender], _value);
        balances[_to] = SafeMath.add(balances[_to], _value);
        Transfer(msg.sender, _to, _value);

        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        if (balances[_from] < _value || allowed[_from][msg.sender] < _value) {
            return false;
        }

        allowed[_from][msg.sender] = SafeMath.sub(allowed[_from][msg.sender], _value);
        balances[_from] = SafeMath.sub(balances[_from], _value);
        balances[_to] = SafeMath.add(balances[_to], _value);
        Transfer(_from, _to, _value);

        return true;
    }

    function approve(address _spender, uint256 _value) public returns (bool success) {
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);

        return true;
    }

    function allowance(address _owner, address _spender) public constant returns (uint256 remaining) {
        return allowed[_owner][_spender];
    }

    function balanceOf(address _owner) public view returns (uint256 balance) {
        return balances[_owner];
    }

    function buyFor(address _recipient) public returns (uint256 purchasedToken) {
        uint256 allowedPbls = pebbles.allowance(msg.sender, this);
        if (allowedPbls > pebbles.balanceOf(msg.sender)) {
            allowedPbls = pebbles.balanceOf(msg.sender);
        }

        // Set new PBL price for book
        book.pblPrice = data.convert(currency, book.price);

        uint256 tokens = SafeMath.div(allowedPbls, book.pblPrice);
        uint256 price = SafeMath.mul(tokens, book.pblPrice);
        uint256 fee = SafeMath.mul(SafeMath.div(price, 100), FEE_PERCENT);
        price = SafeMath.sub(price, fee);

        // Check if PBL from Reader was sent to author
        if (!pebbles.transferFrom(msg.sender, author, price)) {
            return 0;
        }

        // Send fee to PBL holder
        if (!pebbles.transferFrom(msg.sender, FEE_RECEIVER, fee)) {
            revert();
        }

        // Give tokens to reader and increment totalTokens
        balances[_recipient] = SafeMath.add(balances[_recipient], tokens);
        totalTokens = SafeMath.add(totalTokens, tokens);
        Purchase(msg.sender, SafeMath.add(price, fee), _recipient, tokens);

        return tokens;
    }

    function buy() public returns (uint256 purchasedToken) {
        return buyFor(msg.sender);
    }

    function() public { // no direct deposits!
        revert();
    }

    event Purchase(address indexed sender, uint256 price, address indexed recipient, uint256 tokens);
}
