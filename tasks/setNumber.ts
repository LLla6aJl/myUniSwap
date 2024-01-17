import { task } from "hardhat/config"
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types"
import { HelloWorldContract } from "../typechain"
import { parse } from "dotenv"
import { readFileSync } from "fs"

task("setNumber", "set number at the contract")
    .addParam("number", "number to set")
    .setAction(async (taskArgs: TaskArguments, hre: HardhatRuntimeEnvironment): Promise<void> => {
        const net = hre.network.name
        const config = parse(readFileSync(`.env-${net}`))
        for (const parameter in config) {
            process.env[parameter] = config[parameter]
        }

        const instance: HelloWorldContract = <HelloWorldContract>(
            await hre.ethers.getContractAt(
                "HelloWorldContract",
                process.env.HELLO_WORLD_CONTRACT_ADDRESS as string
            )
        )
        await instance.setNumber(taskArgs.number)
    })
