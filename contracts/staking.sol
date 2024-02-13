pragma solidity ^0.8.0;

import "./interfaces/IERC20.sol"; // Import the ERC20 interface

/// @title Staking Contract
/// @notice A smart contract for staking ERC20 tokens and earning rewards
contract StakingContract {
    IERC20 public depositToken; // ERC20 token for deposits
    IERC20 public rewardToken; // ERC20 token for rewards
    uint256 public lockPeriod; // Lock period in seconds
    uint256 public rewardPersent; // Fixed reward percentage

    /// @dev Custom error for zero address
    error ZeroAddress(address recipient);
    /// @dev Custom error for insufficient balance
    error InsufficientBalance(uint256 amount);
    /// @dev Custom error for insufficient allowance
    error InsufficientAllowance(uint256 amount);
    /// @dev Custom error for unauthorized access
    error OnlyOwner(address msgSender);
    /// @dev Custom error for AlreadyClaimed
    error AlreadyClaimed(address msgSender);
    /// @dev Custom error for BeforeMustClaimed
    error BeforeMustClaimed(address msgSender);
    /// @dev Custom error for LockPeriod
    error LockPeriod(uint256 data);

    event Staked(address user, uint256 amount);
    event Claimed(uint256 rewardAmount);
    struct Stake {
        uint amount;
        uint lastStakeTime;
        bool claimed;
    }

    mapping(address => Stake) public stakes;
    address public owner;

    /// @notice Constructor to initialize the contract with ERC20 tokens
    /// @param _depositToken Address of the ERC20 token for deposits
    /// @param _rewardToken Address of the ERC20 token for rewards
    constructor(
        address _depositToken,
        address _rewardToken,
        uint256 _rewardPersent,
        uint256 _lockPeriod
    ) {
        depositToken = IERC20(_depositToken);
        rewardToken = IERC20(_rewardToken);
        rewardPersent = _rewardPersent;
        lockPeriod = _lockPeriod;
        owner = msg.sender;
    }

    function depositRewardsTokens(uint256 amount) external {
        rewardToken.transferFrom(msg.sender, address(this), amount);
    }

    /// @notice Function to stake ERC20 tokens
    /// @param amount Amount of tokens to stake
    function deposit(uint256 amount) external {
        depositToken.transferFrom(msg.sender, address(this), amount);

        stakes[msg.sender].amount += amount;
        stakes[msg.sender].lastStakeTime = block.timestamp;
        stakes[msg.sender].claimed = false;

        emit Staked(msg.sender, amount);
    }

    /// @notice Function to claim rewards
    function claimRewards() external {
        Stake storage userStake = stakes[msg.sender];
        if (userStake.amount == 0) {
            revert InsufficientBalance(userStake.amount);
        }

        if (userStake.claimed) {
            revert AlreadyClaimed(msg.sender);
        }

        if (userStake.lastStakeTime + lockPeriod > block.timestamp) {
            revert LockPeriod(userStake.lastStakeTime + lockPeriod);
        }

        _claimRewards();
    }

    function getStakedBalance() public view returns (uint256) {
        return stakes[msg.sender].amount;
    }

    /// @notice Internal function to claim rewards
    function _claimRewards() internal {
        uint256 rewardAmount = (stakes[msg.sender].amount * rewardPersent) / 100;
        rewardToken.transfer(msg.sender, rewardAmount);
        stakes[msg.sender].claimed = true;
        emit Claimed(rewardAmount);
    }

    /// @notice Function to withdraw staked tokens
    function withdraw() external {
        Stake storage userStake = stakes[msg.sender];
        if (userStake.amount == 0) {
            revert InsufficientBalance(userStake.amount);
        }

        if (!userStake.claimed) {
            revert BeforeMustClaimed(msg.sender);
        }

        uint amountToWithdraw = userStake.amount;
        userStake.amount = 0;
        userStake.lastStakeTime = 0;
        userStake.claimed = false;

        depositToken.transfer(msg.sender, amountToWithdraw);
    }
}
