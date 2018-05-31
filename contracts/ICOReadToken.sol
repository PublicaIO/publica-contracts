pragma solidity ^0.4.18;

import './Pebbles.sol';
import './Data.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract ICOReadToken is Token {
    using SafeMath for uint;

    // Enums
    enum ICOState {
        Init,       // Default state
        SoftCap,    // State is set when soft cap of ICO is reached
        Fail,       // State is set when ICO is failed - ICO end date is reached and soft cap is not reached
        Success     // State is set when ICO is a success - ICO end date is reached and soft cap is reached, or hard cap is reached before date
    }

    enum State {
        Init,             // Default state, when this is set - purchase is not possible
        ICOInProgress,    // State is set when ICO is started - purchase is possible, ICO price is used
        ICOEnded          // State is set when ICO is ened - purchase is possible, default price is used
    }

    // Token Data
    string public symbol;
    string public name;
    uint public constant decimals = 0;

    // Hold READ token balances of the users
    mapping (address => uint) public balances;

    // Allowance for future token management by user
    mapping (address => mapping (address => uint)) public allowed;

    // Refunds
    mapping (address => uint) public refunds;

    Pebbles public pebbles = Pebbles(0x0);
    Data public data = Data(0x0);
    address public author;
    uint public purchasedTokens = 0;
    uint public totalTokens;
    bytes3 public currency;
    State public state = State.Init;
    string public title = "";

    uint public constant FEE_PERCENT = 10;
    address public constant FEE_RECEIVER = 0xa6b02eE1e4eB59AFb7a8aB930357c02c9dC29dAD;

    // Book related data
    struct Book {
        uint price;
        uint priceForICO;
        string url;
        string title;
    }

    // ICO related data
    struct ICO {
        uint startDate;
        uint endDate;

        uint softCap;     // Since the fiat price for token is immutable - we are using amount of tokens here
        uint hardCap;     // Since the fiat price for token is immutable - we are using amount of tokens here
        uint copiesLeft;  // Copies left to sell until hard cap is reached (initially equals hard cap)

        ICOState state;
    }

    // Structs init
    Book public book;
    ICO public ico;

    // Modifiers
    modifier canPurchaseTokens() {
        require(purchasedTokens < totalTokens);

        updateStates();

        require(state != State.Init);
        require(ico.state != ICOState.Fail);

        _;
    }

    modifier ICOSuccess() {
        updateStates();

        require(state == State.ICOEnded);
        require(ico.state == ICOState.Success);

        _;
    }

    modifier onlyOwner() {
        require(msg.sender == author);
        _;
    }

    function ICOReadToken (
        Pebbles _pebbles,              // PBL contract address
        Data _data,                    // Data contract address
        address _owner,                // Book author address (author is contract owner)
        uint _price,                   // Book price in fiat with 18 zeros simulating decimals (aka in wei)
        uint _ICOPrice,                // Book price in fiat with 18 zeros simulating decimals (aka in wei)
        uint _minICOCopies,            // Amount of copies to sell for ICO to be a success
        uint _ICOCopies,               // Max amount of copies to sell during the ICO, if all sold - ICO is a success
        uint _totalCopies,             // Total of how much copies of the book are offered (including _ICOCopies)
        uint _CSStartDate,             // ICO start date
        uint _CSEndDate,               // ICO end date

        string _url,                   // Book url
        string _title,                 // Book title

        string _tokenSymbol,           // Token symbol
        string _tokenName,             // Token name
        bytes3 _currency               // Fiat currency symbol
    ) public {
        require(_pebbles != address(0));
        require(_data != address(0));
        require(_minICOCopies != _ICOCopies);

        pebbles = _pebbles;
        data = _data;

        author = _owner;
        book = Book(_price, _ICOPrice, _url, _title);
        currency = _currency;

        ico = ICO(_CSStartDate, _CSEndDate, _minICOCopies, _ICOCopies, _ICOCopies, ICOState.Init);

        symbol = _tokenSymbol;
        name = _tokenName;
        totalTokens = _totalCopies;
    }

    // ERC20 Token Interface implementation
    function totalSupply() public view returns (uint) {
        return purchasedTokens;
    }

    function transfer(address _to, uint _value) public ICOSuccess() returns (bool success) {
        if (balances[msg.sender] < _value) {
            return false;
        }

        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);

        return true;
    }

    function transferFrom(address _from, address _to, uint _value) public ICOSuccess() returns (bool success) {
        if (balances[_from] < _value || allowed[_from][msg.sender] < _value) {
            return false;
        }

        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        balances[_from] = balances[_from].sub(_value);
        balances[_to] = balances[_to].add(_value);
        emit Transfer(_from, _to, _value);

        return true;
    }

    function approve(address _spender, uint _value) public ICOSuccess() returns (bool success) {
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);

        return true;
    }

    function allowance(address _owner, address _spender) public view returns (uint remaining) {
        return allowed[_owner][_spender];
    }

    function balanceOf(address _owner) public view returns (uint balance) {
        return balances[_owner];
    }

    // Token purchase
    function buyFor(address _recipient) public canPurchaseTokens() returns (uint) {
        uint allowedPbls = pebbles.allowance(msg.sender, this);
        if (allowedPbls > pebbles.balanceOf(msg.sender)) {
            allowedPbls = pebbles.balanceOf(msg.sender);
        }

        // Convert Fiat price to PBL using current exchange rate
        uint tokenPrice = data.convert(currency, getPrice());

        // Calculate how many PBL tokens can be purchased with the allowance
        uint tokens = allowedPbls.div(tokenPrice);

        // If ico is in progress - need to check how many tokens we can sell
        if (state == State.ICOInProgress && ico.copiesLeft < tokens) {
            tokens = ico.copiesLeft;
        }
        // Because you don't sell all the tokens during an ICO
        else {
            uint availableTokens = totalTokens.sub(purchasedTokens);
            if (availableTokens < tokens) {
                tokens = availableTokens;
            }
        }

        uint price = tokens.mul(tokenPrice);
        uint fee = price.div(100).mul(FEE_PERCENT);
        price = price.sub(fee);

        // In order to prevent author from using PBL tokens before ICO end - we will transfer those to this contract address
        address pblReceiver = state == State.ICOEnded ? author : this;
        if (!pebbles.transferFrom(msg.sender, pblReceiver, price)) {
            return 0;
        }

        // Send Platform Maintenance Fee to PBL holder
        if (!pebbles.transferFrom(msg.sender, FEE_RECEIVER, fee)) {
            revert();
        }

        // Update ICO data and statuses after a successful transfers and register refund
        if (state == State.ICOInProgress) {
            refunds[_recipient] = refunds[_recipient].add(price);
            updateICOStats(tokens);
        }

        // Give tokens to reader and upadate total tokens
        balances[_recipient] = balances[_recipient].add(tokens);
        purchasedTokens = purchasedTokens.add(tokens);
        emit Purchase(msg.sender, price.add(fee), tokens);

        return tokens;
    }

    function buy() public returns (uint purchasedToken) {
        return buyFor(msg.sender);
    }

    // Depending on the ICO state, decide which price to use.
    function getPrice() public view returns (uint tokenPrice) {
        updateStates();

        if (state == State.ICOInProgress) {
            return book.priceForICO;
        }

        return book.price;
    }

    // Updates contract and ICO states, to start or finish ICO
    // Should be called before actions with states
    function updateStates() public {
        // Start ICO
        if (state == State.Init && now >= ico.startDate) {
            state = State.ICOInProgress;
        }

        // End ICO
        if (state == State.ICOInProgress && now >= ico.endDate) {
            endICO();
        }
    }

    // Update ICO stats
    // @param tokens How many tokens were just purchased
    function updateICOStats(uint tokens) private {
        ico.copiesLeft = ico.copiesLeft.sub(tokens);

        if (ico.hardCap.sub(ico.copiesLeft) >= ico.softCap) {
            ico.state = ICOState.SoftCap;
        }

        // Hard cap reached
        if (ico.copiesLeft == 0) {
            endICO();
        }
    }

    function endICO() private  returns (bool) {
        if (state == State.ICOEnded) {
            return true;
        }

        state = State.ICOEnded;

        if (ico.state == ICOState.SoftCap) {
            ico.state = ICOState.Success;

            // If ICO ended with success - transfer funds from this contract to author
            pebbles.transfer(author, pebbles.balanceOf(this));
        } else {
            ico.state = ICOState.Fail;
        }

        return true;
    }

    // Allow author to stop the ICO
    function stopICO() public onlyOwner() {
        endICO();
    }

    // Refund ICO deposits
    function refund() public returns (uint refunded) {
        updateStates();

        require(ico.state == ICOState.Fail);
        require(balances[msg.sender] > 0);
        require(refunds[msg.sender] > 0);

        uint toRefund = refunds[msg.sender];
        uint tokens = balances[msg.sender];

        // Transfer PBLw tokens from contract back to the buyer
        if (!pebbles.transfer(msg.sender, toRefund)) {
            revert();
        }

        balances[msg.sender] = 0;
        refunds[msg.sender] = 0;
        purchasedTokens = purchasedTokens.sub(tokens);

        emit Refund(msg.sender, toRefund, tokens);

        return toRefund;
    }

    // no ETH deposits!
    function() public {
        revert();
    }

    event Purchase(address indexed buyer, uint price, uint tokens);
    event Refund(address indexed owner, uint price, uint tokens);
}
