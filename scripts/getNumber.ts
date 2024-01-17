/* eslint-disable no-process-exit */
// yarn hardhat node
// yarn hardhat run scripts/getNumber.ts --network localhost
import { ethers } from "hardhat"
import { BigNumber } from "ethers"
import { HelloWorldContract } from "../typechain"
import { parse } from "dotenv"
import { readFileSync } from "fs"
import hre from "hardhat"

async function getNumber(): Promise<void> {
    const net = hre.network.name
    const config = parse(readFileSync(`.env-${net}`))
    for (const parameter in config) {
        process.env[parameter] = config[parameter]
    }

    const helloWorld: HelloWorldContract = await ethers.getContractAt(
        "HelloWorldContract",
        process.env.HELLO_WORLD_CONTRACT_ADDRESS as string
    )
    const number: BigNumber = await helloWorld.getNumber()
    console.log(number.toString())
}

getNumber()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
