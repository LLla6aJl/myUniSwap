/* eslint-disable no-process-exit */
// yarn hardhat node
// yarn hardhat run scripts/deploy.ts --network localhost
// You need to create file .env-#{network-name} to store info about deploy.

import { HelloWorldContract } from "../typechain"
import { parse } from "dotenv"
import { appendFileSync, readFileSync } from "fs"
import hre from "hardhat"
import { HelloWorldContract__factory } from "../typechain/factories"

async function deploy(): Promise<void> {
    const net = hre.network.name
    const config = parse(readFileSync(`.env-${net}`))
    for (const parameter in config) {
        process.env[parameter] = config[parameter]
    }

    const helloWorld_factory: HelloWorldContract__factory = <HelloWorldContract__factory>(
        await hre.ethers.getContractFactory("HelloWorldContract")
    )
    const helloWolrd_contract: HelloWorldContract = <HelloWorldContract>(
        await helloWorld_factory.deploy()
    )
    await helloWolrd_contract.deployed()

    //Sync env file
    appendFileSync(
        `.env-${net}`,
        `\r\# Deployed at \rHELLO_WORLD_CONTRACT_ADDRESS=${helloWolrd_contract.address}\r`
    )

    console.log(`Deployed at: ${helloWolrd_contract.address}`)
}

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
