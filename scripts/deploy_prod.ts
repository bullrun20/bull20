import {ethers} from 'hardhat';
import {config} from 'dotenv';

config();

async function main() {
  const USDTContractAddress = process.env.USDT_CONTRACT_ADDRESS;
  const WETHContractAddress = process.env.WETH_CONTRACT_ADDRESS;
  const UniswapV2FactoryContractAddress = process.env.UNISWAP_FACTORY_CONTRACT_ADDRESS;

  const UniswapRateProvider = await ethers.deployContract('UniswapRateProvider', [
    UniswapV2FactoryContractAddress,
    WETHContractAddress,
  ]);
  const deployUniswapRateProvider = await UniswapRateProvider.waitForDeployment();
  await deployUniswapRateProvider.addRatePair(USDTContractAddress, WETHContractAddress);

  const rpAddress = await deployUniswapRateProvider.getAddress();

  const Bull20Proxy = await ethers.deployContract('Bull20Proxy');
  const deployProxy = await Bull20Proxy.waitForDeployment();

  // const rpAddress = '0x1507454Cc22BDF4F1EE6ef3F41cfa7444C8bf45D';
  const args = [rpAddress];
  console.log('ARGS:', args);
  const bull20 = await ethers.deployContract('Bull20', [await deployProxy.getAddress()]);
  const deployBull20 = await bull20.waitForDeployment();
  await deployProxy.setInstanceAddress(await deployBull20.getAddress());
  await deployProxy.setRateProvider(rpAddress);

  // Fill stages
  await deployProxy.addStage(ethers.parseEther('0.0500'), ethers.parseEther('250000'));
  await deployProxy.addStage(ethers.parseEther('0.0580'), ethers.parseEther('290000'));
  await deployProxy.addStage(ethers.parseEther('0.0640'), ethers.parseEther('320000'));
  await deployProxy.addStage(ethers.parseEther('0.0700'), ethers.parseEther('350000'));
  await deployProxy.addStage(ethers.parseEther('0.0760'), ethers.parseEther('380000'));
  await deployProxy.addStage(ethers.parseEther('0.0800'), ethers.parseEther('400000'));
  await deployProxy.addStage(ethers.parseEther('0.0840'), ethers.parseEther('420000'));
  await deployProxy.addStage(ethers.parseEther('0.0880'), ethers.parseEther('440000'));
  await deployProxy.addStage(ethers.parseEther('0.0920'), ethers.parseEther('460000'));
  await deployProxy.addStage(ethers.parseEther('0.0940'), ethers.parseEther('470000'));
  await deployProxy.addStage(ethers.parseEther('0.0960'), ethers.parseEther('480000'));
  await deployProxy.addStage(ethers.parseEther('0.0980'), ethers.parseEther('490000'));
  await deployProxy.enable();

  console.log(await deployProxy.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
