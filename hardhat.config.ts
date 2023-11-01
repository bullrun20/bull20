import { HardhatUserConfig } from "hardhat/config";
import {removeConsoleLog} from 'hardhat-preprocessor';
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter"
import {config as dotenvConfig} from "dotenv";

dotenvConfig();

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    sepolia: {
      url: process.env.NETWORK_URL,
      accounts: [process.env.OWNER_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    coinmarketcap: process.env.CMC_KEY
  },
  preprocess: {
    eachLine: removeConsoleLog((hre) => hre.network.name !== "hardhat" && hre.network.name !== "localhost"),
  },
};

export default config;
