import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { Contract } from "ethers"
import { ERC20Token } from "../../typechain"

const DECIMALS = 18
// 30 Days (30 * 24 * 60 * 60)
const LOCK_PERIOD = 2592000
const REWARD_PERSENT = 5
const INITIAL_AMOUNT = ethers.utils.parseEther("10000")
const ONE = ethers.utils.parseEther("1")
const TWO = ethers.utils.parseEther("2")

describe("StakingContract", function () {
    let stakingContract: Contract
    let owner: SignerWithAddress
    let user: SignerWithAddress
    let user1: SignerWithAddress
    let DepositTokenAddress: ERC20Token
    let RewardTokenAddress: ERC20Token

    beforeEach(async () => {
        ;[owner, user, user1] = await ethers.getSigners()
        const erc20Factory = await ethers.getContractFactory("ERC20Token")
        DepositTokenAddress = await erc20Factory.deploy(
            "DepositTokenAddress",
            "MFT",
            DECIMALS,
            INITIAL_AMOUNT
        )
        RewardTokenAddress = await erc20Factory.deploy(
            "RewardTokenAddress",
            "MST",
            DECIMALS,
            INITIAL_AMOUNT
        )

        const StakingContractFactory = await ethers.getContractFactory("StakingContract")
        stakingContract = await StakingContractFactory.deploy(
            DepositTokenAddress.address,
            RewardTokenAddress.address,
            REWARD_PERSENT,
            LOCK_PERIOD
        )
        await stakingContract.deployed()
        await RewardTokenAddress.approve(stakingContract.address, INITIAL_AMOUNT)
        await stakingContract.depositRewardsTokens(INITIAL_AMOUNT)
    })

    describe("Initial parameters", function () {
        it("Should set deposit token address", async function () {
            const depositToken = await stakingContract.depositToken()
            expect(depositToken).to.equal(DepositTokenAddress.address)
        })

        it("Should set reward token address", async function () {
            const rewardToken = await stakingContract.rewardToken()
            expect(rewardToken).to.equal(RewardTokenAddress.address)
        })

        it("Should set lock period", async function () {
            const lockPeriod = await stakingContract.lockPeriod()
            expect(lockPeriod).to.equal(LOCK_PERIOD)
        })

        it("Should set reward percentage", async function () {
            const rewardPersent = await stakingContract.rewardPersent()
            expect(rewardPersent).to.equal(REWARD_PERSENT)
        })

        it("Should set owner", async function () {
            const contractOwner = await stakingContract.owner()
            expect(contractOwner).to.equal(owner.address)
        })
    })

    describe("Deposit", function () {
        it("Should deposit tokens", async function () {
            const initialBalance = await stakingContract.connect(user).getStakedBalance()
            await DepositTokenAddress.connect(owner).transfer(user.address, TWO)
            await DepositTokenAddress.connect(user).approve(stakingContract.address, TWO)
            await stakingContract.connect(user).deposit(ONE)
            const finalBalance = await stakingContract.connect(user).getStakedBalance()
            expect(finalBalance).to.equal(initialBalance.add(ONE))
        })
    })

    describe("Claim rewards", function () {
        it("Should claim rewards", async function () {
            await DepositTokenAddress.connect(owner).transfer(user1.address, TWO)
            await DepositTokenAddress.connect(user1).approve(stakingContract.address, TWO)
            await stakingContract.connect(user1).deposit(ONE)
            await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD])
            await ethers.provider.send("evm_mine", []) // Mine a new block to make the time change effective
            await stakingContract.connect(user1).claimRewards()
            const claimedEvent = await stakingContract
                .connect(user1)
                .queryFilter(stakingContract.filters.Claimed())
            const rewardAmount = claimedEvent[0].args?.rewardAmount
            const userBalance = await RewardTokenAddress.balanceOf(user1.address)
            expect(userBalance).to.equal(rewardAmount) // Assuming reward calculation is correct
        })

        it("Should claim with 0 amount", async function () {
            await expect(
                stakingContract.connect(user1).claimRewards()
            ).to.be.revertedWithCustomError(stakingContract, "InsufficientBalance")
        })

        it("Already Claimed", async function () {
            await DepositTokenAddress.connect(owner).transfer(user1.address, TWO)
            await DepositTokenAddress.connect(user1).approve(stakingContract.address, TWO)
            await stakingContract.connect(user1).deposit(ONE)
            await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD])
            await ethers.provider.send("evm_mine", []) // Mine a new block to make the time change effective
            await stakingContract.connect(user1).claimRewards()
            await expect(
                stakingContract.connect(user1).claimRewards()
            ).to.be.revertedWithCustomError(stakingContract, "AlreadyClaimed")
        })

        it("Claim in Lock Period", async function () {
            await DepositTokenAddress.connect(owner).transfer(user1.address, TWO)
            await DepositTokenAddress.connect(user1).approve(stakingContract.address, TWO)
            await stakingContract.connect(user1).deposit(ONE)
            await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD - 10000])
            await ethers.provider.send("evm_mine", []) // Mine a new block to make the time change effective
            await expect(
                stakingContract.connect(user1).claimRewards()
            ).to.be.revertedWithCustomError(stakingContract, "LockPeriod")
        })
    })

    describe("Withdraw", function () {
        it("Should withdraw staked tokens", async function () {
            await DepositTokenAddress.connect(owner).transfer(user1.address, TWO)
            await DepositTokenAddress.connect(user1).approve(stakingContract.address, TWO)
            await stakingContract.connect(user1).deposit(ONE)
            await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD])
            await ethers.provider.send("evm_mine", []) // Mine a new block to make the time change effective
            await stakingContract.connect(user1).claimRewards()
            await stakingContract.connect(user1).withdraw()
            const finalBalance = await stakingContract.getStakedBalance()
            expect(finalBalance).to.equal(0)
        })

        it("Should withdraw with 0 amount", async function () {
            await expect(stakingContract.connect(user1).withdraw()).to.be.revertedWithCustomError(
                stakingContract,
                "InsufficientBalance"
            )
        })

        it("Should withdraw staked tokens without claim rewards", async function () {
            await DepositTokenAddress.connect(owner).transfer(user1.address, TWO)
            await DepositTokenAddress.connect(user1).approve(stakingContract.address, TWO)
            await stakingContract.connect(user1).deposit(ONE)
            await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD])
            await ethers.provider.send("evm_mine", []) // Mine a new block to make the time change effective
            await expect(stakingContract.connect(user1).withdraw()).to.be.revertedWithCustomError(
                stakingContract,
                "BeforeMustClaimed"
            )
        })
    })
})
