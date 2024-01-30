import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { Contract } from "ethers"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { ERC20Token } from "../../typechain"
import { encodePriceSqrt } from "./utils"

const DECIMALS = 18
const INITIAL_AMOUNT = ethers.utils.parseEther("10000")
const AMOUNT_TO_MINT = ethers.utils.parseEther("1000")
const AMOUNT_TO_SWAP = ethers.utils.parseEther("10")
const INonfungiblePositionManager_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
const SWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

describe("SimpleSwap", function () {
    let SimpleSwap
    let simpleSwap: Contract
    let Token0: ERC20Token
    let Token1: ERC20Token
    let owner: SignerWithAddress,
        user1: SignerWithAddress,
        user2: SignerWithAddress,
        users: SignerWithAddress[]

    beforeEach(async () => {
        ;[owner, user1, user2, ...users] = await ethers.getSigners()
        SimpleSwap = await ethers.getContractFactory("SimpleSwap")
        const erc20Factory = await ethers.getContractFactory("ERC20Token")
        Token0 = await erc20Factory.deploy("MyFirstToken", "MFT", DECIMALS, INITIAL_AMOUNT)
        Token1 = await erc20Factory.deploy("MySecondToken", "MST", DECIMALS, INITIAL_AMOUNT)
        simpleSwap = await SimpleSwap.deploy(
            INonfungiblePositionManager_ADDRESS,
            SWAP_ROUTER_ADDRESS
        )
        await simpleSwap.deployed()
    })

    describe("Initial params of contract", async () => {
        it("Should properly initialize INonfungiblePositionManager", async () => {
            expect(await simpleSwap.nonfungiblePositionManager()).to.equal(
                INonfungiblePositionManager_ADDRESS
            )
        })

        it("Should properly initialize ISwapRouter", async () => {
            expect(await simpleSwap.swapRouter()).to.equal(SWAP_ROUTER_ADDRESS)
        })
    })

    describe("createPool", function () {
        it("should create a new pool", async function () {
            const pair = await simpleSwap
                .connect(owner)
                .createPool(Token0.address, Token1.address, 500, encodePriceSqrt(1, 1))
            expect(pair).to.exist
        })
    })

    describe("mintNewPosition", function () {
        it("should mint a new position", async function () {
            const minTick = -885000
            const maxTick = -minTick

            await simpleSwap
                .connect(owner)
                .createPool(Token0.address, Token1.address, 500, encodePriceSqrt(1, 1))

            await Token0.connect(owner).approve(simpleSwap.address, AMOUNT_TO_MINT)
            await Token1.connect(owner).approve(simpleSwap.address, AMOUNT_TO_MINT)

            expect(
                await simpleSwap
                    .connect(owner)
                    .mintNewPosition(
                        Token0.address,
                        Token1.address,
                        500,
                        AMOUNT_TO_MINT,
                        AMOUNT_TO_MINT,
                        minTick,
                        maxTick
                    )
            ).to.be.ok

            const events = await simpleSwap.queryFilter(simpleSwap.filters.Minted())
            expect(events.length).to.equal(1)
            const tokenId = events[0].args?.tokenId
            expect(await simpleSwap.connect(owner).getPositionOwner(tokenId)).to.be.equal(
                owner.address
            )
        })
    })

    describe("collectAllFees", function () {
        it("should collectAllFees", async function () {
            const minTick = -885000
            const maxTick = -minTick
            await simpleSwap
                .connect(owner)
                .createPool(Token0.address, Token1.address, 500, encodePriceSqrt(1, 1))

            await Token0.connect(owner).approve(simpleSwap.address, AMOUNT_TO_MINT)
            await Token1.connect(owner).approve(simpleSwap.address, AMOUNT_TO_MINT)
            await simpleSwap
                .connect(owner)
                .mintNewPosition(
                    Token0.address,
                    Token1.address,
                    500,
                    AMOUNT_TO_MINT,
                    AMOUNT_TO_MINT,
                    minTick,
                    maxTick
                )
            const mintEvent = await simpleSwap.queryFilter(simpleSwap.filters.Minted())
            const tokenId = mintEvent[0].args?.tokenId

            let path = ethers.utils.solidityPack(
                ["address", "uint24", "address"],
                [Token0.address, 500, Token1.address]
            )

            let path2 = ethers.utils.solidityPack(
                ["address", "uint24", "address"],
                [Token1.address, 500, Token0.address]
            )
            await Token0.connect(owner).approve(simpleSwap.address, AMOUNT_TO_SWAP)
            await simpleSwap.connect(owner).swapExactInput(Token0.address, AMOUNT_TO_SWAP, 0, path)

            await Token1.connect(owner).approve(simpleSwap.address, AMOUNT_TO_SWAP)
            await simpleSwap
                .connect(owner)
                .swapExactOutput(Token1.address, AMOUNT_TO_SWAP, 0, path2)

            await time.increase(3600)

            expect(
                await simpleSwap.connect(user1).collectAllFees(tokenId)
            ).to.be.revertedWithCustomError(simpleSwap, "OnlyOwner")

            await simpleSwap.connect(owner).collectAllFees(tokenId)
            const collectEvent = await simpleSwap.queryFilter(simpleSwap.filters.Collect())
            expect(collectEvent.length).to.equal(1)
        })
    })
})
