import { expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { Contract } from "ethers"
import { ERC20Token } from "../../typechain"
import { encodePriceSqrt } from "./utils"

const DECIMALS = 18
const INITIAL_AMOUNT = ethers.utils.parseEther("10000")
const AMOUNT_TO_MINT = ethers.utils.parseEther("1000")
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

            const result = await simpleSwap
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

            expect(result.tokenId).to.exist
            expect(result.liquidity).to.exist
            expect(result.amount0).to.exist
            expect(result.amount1).to.exist
        })
    })
})
