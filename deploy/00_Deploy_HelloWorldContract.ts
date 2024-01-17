import { DeployFunction } from "hardhat-deploy/types"
import { getNamedAccounts, deployments } from "hardhat"

const deployFunction: DeployFunction = async () => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    log(`HelloWorldContract is deploying...`)
    const helloWorld = await deploy(`HelloWorldContract`, { from: deployer, log: true })

    log(`HelloWorldContract Deployed! at ${helloWorld.address}`)
}

export default deployFunction
deployFunction.tags = [`all`, `helloWorld`, `main`]
