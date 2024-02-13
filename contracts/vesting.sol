// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VestingContract {
    address owner;
    IERC20 public token;
    uint256 lockPeriod;
    uint256 startTime;
    mapping(address => VestingSchedule) public vestingSchedules;
    VestingRelease[] releases;

    struct VestingSchedule {
        uint256 amount;
        uint256 withdrawnAmount;
    }
    struct VestingRelease {
        uint256 monthCount;
        uint256 releasePercentage;
    }
    event VestingScheduled(address indexed beneficiary, uint256 amount);
    event TokensReleased(address indexed beneficiary, uint256 availableAmount);
    error TimeEllapsed(uint256 time);

    constructor(
        address _token,
        uint256 _startTime,
        uint256 _lockPeriod,
        VestingRelease[] memory _releases
    ) {
        if (_releases.length == 0) {
            revert("VestingContract: Release percentages array is empty");
        }

        uint256 totalPercentage;
        for (uint256 i = 0; i < _releases.length; i++) {
            if (_releases[i].releasePercentage >= 100) {
                revert("VestingContract: Release percentage must be < 100");
            }
            totalPercentage += _releases[i].releasePercentage;
            releases.push(_releases[i]);
        }
        if (totalPercentage != 100) {
            revert("VestingContract: Total release percentage must equal 100");
        }
        lockPeriod = _lockPeriod;
        owner = msg.sender;
        startTime = _startTime;
        token = IERC20(_token);
    }

    function distributeRights(address account, uint256 amount) external {
        if (block.timestamp > startTime + releases[0].monthCount * lockPeriod) {
            revert TimeEllapsed(block.timestamp);
        }
        if (vestingSchedules[account].amount != 0) {
            revert("VestingContract: Account already has a vesting schedule");
        }

        VestingSchedule storage schedule = vestingSchedules[account];
        schedule.amount = amount;
        schedule.withdrawnAmount = 0;

        emit VestingScheduled(account, amount);
    }

    function getAvailableAmount(address account) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[account];

        uint256 availableAmount = 0;
        for (uint256 i = 0; i < releases.length; i++) {
            uint256 releaseTime = startTime + releases[i].monthCount * lockPeriod;
            if (block.timestamp >= releaseTime) {
                availableAmount += (schedule.amount * releases[i].releasePercentage) / 100;
            }
        }
        return availableAmount - schedule.withdrawnAmount;
    }

    function withdrawTokens() external {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];

        uint256 availableAmount = getAvailableAmount(msg.sender);
        if (availableAmount <= 0) {
            revert("VestingContract: No tokens available for withdrawal");
        }

        token.transfer(msg.sender, availableAmount);
        schedule.withdrawnAmount += availableAmount;

        emit TokensReleased(msg.sender, availableAmount);
    }
}
