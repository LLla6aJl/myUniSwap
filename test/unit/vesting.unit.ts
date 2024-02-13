import { expect } from "chai"
import { ethers } from "hardhat"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Contract } from "ethers"
import { VestingContract, ERC20Token } from "../../typechain"

const DECIMALS = 18
// 30 Days (30 * 24 * 60 * 60)
const LOCK_PERIOD = 2592000
const INVEST_AMOUNT = 100
const BIG_AMOUNT = ethers.utils.parseEther("100000")
const INITIAL_AMOUNT = ethers.utils.parseEther("10000")
const RELEASES_PERSENTAGE = [
    { monthCount: 1, releasePercentage: 10 },
    { monthCount: 2, releasePercentage: 20 },
    { monthCount: 3, releasePercentage: 20 },
    { monthCount: 4, releasePercentage: 50 },
] // Release percentages

describe("VestingContract", function () {
    let Vesting: Contract
    let owner: SignerWithAddress
    let Token: ERC20Token
    let user: SignerWithAddress
    let user2: SignerWithAddress

    beforeEach(async () => {
        ;[owner, user, user2] = await ethers.getSigners()
        const erc20Factory = await ethers.getContractFactory("ERC20Token")
        Token = await erc20Factory
            .connect(owner)
            .deploy("VestinGToken", "VTK", DECIMALS, BIG_AMOUNT)

        const VestingFactory = await ethers.getContractFactory("VestingContract")
        const beginTime = await time.latest()
        Vesting = await VestingFactory.connect(owner).deploy(
            Token.address, // Token address
            beginTime, // Current timestamp as start time
            LOCK_PERIOD,
            RELEASES_PERSENTAGE
        )
        await Vesting.deployed()
        await Token.connect(owner).mint(Vesting.address, INITIAL_AMOUNT)
        await Vesting.connect(owner).distributeRights(user.address, INVEST_AMOUNT)
    })

    it("deploy with wrong release percentages", async function () {
        const VestingFactory = await ethers.getContractFactory("VestingContract")
        const beginTime = await time.latest()
        await expect(
            VestingFactory.connect(owner).deploy(
                Token.address, // Token address
                beginTime, // Current timestamp as start time
                LOCK_PERIOD,
                [
                    { monthCount: 1, releasePercentage: 100 },
                    { monthCount: 2, releasePercentage: 20 },
                    { monthCount: 3, releasePercentage: 20 },
                    { monthCount: 4, releasePercentage: 50 },
                ]
            )
        ).to.be.revertedWith("VestingContract: Release percentage must be < 100")
    })

    it("deploy with wrong total release percentages", async function () {
        const VestingFactory = await ethers.getContractFactory("VestingContract")
        const beginTime = await time.latest()
        await expect(
            VestingFactory.connect(owner).deploy(
                Token.address, // Token address
                beginTime, // Current timestamp as start time
                LOCK_PERIOD,
                [
                    { monthCount: 1, releasePercentage: 10 },
                    { monthCount: 2, releasePercentage: 20 },
                    { monthCount: 3, releasePercentage: 20 },
                    { monthCount: 4, releasePercentage: 40 },
                ]
            )
        ).to.be.revertedWith("VestingContract: Total release percentage must equal 100")
    })

    it("deploy with empty release percentages", async function () {
        const VestingFactory = await ethers.getContractFactory("VestingContract")
        const beginTime = await time.latest()
        await expect(
            VestingFactory.connect(owner).deploy(
                Token.address, // Token address
                beginTime, // Current timestamp as start time
                LOCK_PERIOD,
                []
            )
        ).to.be.revertedWith("VestingContract: Release percentages array is empty")
    })

    it("should allow distributing rights after allowed period", async function () {
        await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD])
        await ethers.provider.send("evm_mine", [])

        await expect(
            Vesting.connect(owner).distributeRights(user2.address, INVEST_AMOUNT)
        ).to.be.revertedWithCustomError(Vesting, "TimeEllapsed")
    })

    it("should Account already has a vesting schedule", async function () {
        await expect(
            Vesting.connect(owner).distributeRights(user.address, INVEST_AMOUNT)
        ).to.be.revertedWith("VestingContract: Account already has a vesting schedule")
    })

    it("should allow distributing rights", async function () {
        const events = await Vesting.queryFilter(Vesting.filters.VestingScheduled())
        expect(events.length).to.equal(1)
        const amount = events[0].args?.amount
        expect(amount).to.equal(INVEST_AMOUNT)
    })

    it("available Amount", async function () {
        await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD])
        await ethers.provider.send("evm_mine", [])
        const availableAmount = await Vesting.getAvailableAmount(user.address)
        expect(availableAmount).to.equal(
            (INVEST_AMOUNT * RELEASES_PERSENTAGE[0].releasePercentage) / 100
        )
    })

    it("withdrawTokens if not available", async function () {
        await expect(Vesting.connect(user).withdrawTokens()).to.be.revertedWith(
            "VestingContract: No tokens available for withdrawal"
        )
    })

    it("withdrawTokens", async function () {
        await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD])
        await ethers.provider.send("evm_mine", [])
        await Vesting.connect(user).withdrawTokens()
        const events = await Vesting.queryFilter(Vesting.filters.TokensReleased())
        expect(events.length).to.equal(1)
        const amount = events[0].args?.availableAmount
        expect(amount).to.equal((INVEST_AMOUNT * RELEASES_PERSENTAGE[0].releasePercentage) / 100)
    })
})
