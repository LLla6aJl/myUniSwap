// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IERC20.sol";

/// @title ERC-20 Token
/// @dev Implementation of the ERC-20 token standard.
contract ERC20Token is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    address public owner;

    error ZeroAddress(address recipient);
    error InsufficientBalance(uint256 amount);
    error InsufficientAllowance(uint256 amount);
    error OnlyOwner(address msgSender);
    error UpdateDescriptionOnlyOwner(address owner);
    error AllowanceBelowZero(uint256 amount);

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    /// @dev Constructor for creating a new ERC-20 token.
    /// @param _name The name of the token.
    /// @param _symbol The symbol of the token.
    /// @param _decimals The number of decimals for the token.
    /// @param initialSupply The initial supply of tokens.
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 initialSupply
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = msg.sender;
        _totalSupply = initialSupply;
        _balances[msg.sender] = _totalSupply;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    /// @dev Returns the total supply of tokens.
    /// @return The total supply of tokens.
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /// @dev Returns the balance of the specified address.
    /// @param account The address to query the balance of.
    /// @return The balance of the specified address.
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    /// @dev Transfers tokens from the sender to a specified recipient.
    /// @param recipient The address to which tokens will be transferred.
    /// @param amount The amount of tokens to transfer.
    /// @return A boolean indicating the success of the transfer.
    function transfer(address recipient, uint256 amount) public returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    /// @dev Returns the remaining number of tokens that spender is allowed to spend on behalf of owner.
    /// @param _owner The address that owns the funds.
    /// @param spender The address that will spend the funds.
    /// @return The remaining number of tokens that spender is allowed to spend.
    function allowance(address _owner, address spender) public view returns (uint256) {
        return _allowances[_owner][spender];
    }

    /// @dev Approves the specified address to spend the specified amount of tokens on behalf of the sender.
    /// @param spender The address that will spend the funds.
    /// @param amount The amount of tokens to be spent.
    /// @return A boolean indicating the success of the approval.
    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /// @dev Transfers tokens from one address to another.
    /// @param sender The address from which tokens will be transferred.
    /// @param recipient The address to which tokens will be transferred.
    /// @param amount The amount of tokens to transfer.

    function _transfer(address sender, address recipient, uint256 amount) internal {
        if (recipient == address(0)) {
            revert ZeroAddress(recipient);
        }
        if (_balances[sender] < amount) {
            revert InsufficientBalance(amount);
        }
        _balances[sender] -= amount;
        _balances[recipient] += amount;

        emit Transfer(sender, recipient, amount);
    }

    /// @dev Internal function that approves the specified address to spend the specified amount of tokens on behalf of the owner.
    /// @param _owner The address that owns the funds.
    /// @param spender The address that will spend the funds.
    /// @param amount The amount of tokens to be spent.
    function _approve(address _owner, address spender, uint256 amount) internal {
        _allowances[_owner][spender] = amount;
        emit Approval(_owner, spender, amount);
    }

    /// @dev Increases the allowance of a spender for the owner.
    /// @param spender The address to which tokens are allowed to be spent.
    /// @param addedValue The additional allowance to be granted.
    /// @return A boolean indicating the success of the operation.
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
        return true;
    }

    /// @dev Decreases the allowance of a spender for the owner.
    /// @param spender The address to which tokens are allowed to be spent.
    /// @param subtractedValue The allowance to be subtracted.
    /// @return A boolean indicating the success of the operation.
    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        uint256 currentAllowance = _allowances[msg.sender][spender];
        if (subtractedValue > currentAllowance) {
            revert AllowanceBelowZero(subtractedValue);
        }
        _approve(msg.sender, spender, currentAllowance - subtractedValue);
        return true;
    }

    modifier Ownable() {
        if (msg.sender != owner) {
            revert OnlyOwner(msg.sender);
        }
        _;
    }

    /// @dev Mints new tokens and increases the total supply.
    /// @param account The address to which new tokens will be minted.
    /// @param amount The amount of new tokens to mint.
    function mint(address account, uint256 amount) public Ownable {
        if (account == address(0)) {
            revert ZeroAddress(account);
        }
        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    /// @dev Burns tokens and decreases the total supply.
    /// @param account The address from which tokens will be burned.
    /// @param amount The amount of tokens to burn.
    function burn(address account, uint256 amount) public Ownable {
        uint256 accountBalance = _balances[account];
        if (accountBalance < amount) {
            revert InsufficientBalance(amount);
        }
        _totalSupply -= amount;
        _balances[account] -= amount;
        emit Transfer(account, address(0), amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (to == address(0)) {
            revert ZeroAddress(to);
        }

        if (_balances[from] < amount) {
            revert InsufficientBalance(amount);
        }
        if (_allowances[from][msg.sender] < amount) {
            revert InsufficientAllowance(_allowances[from][msg.sender]);
        }

        _balances[from] -= amount;
        _balances[to] += amount;

        _allowances[from][msg.sender] -= amount;

        emit Transfer(from, to, amount);

        return true;
    }
}
