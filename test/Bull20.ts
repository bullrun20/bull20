import {ethers} from 'hardhat';
import {expect} from 'chai';
import {loadFixture} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import {
  Bull20,
  MockERC20,
  UniswapRateProvider,
  MockUniswapV2Pair,
  IRateProvider,
  Bull20Proxy
} from '../typechain-types';

describe('Bull20', () => {
  const emptyAddress: any = '0x0000000000000000000000000000000000000000';
  const onlyOwnerError = 'Caller is not the holder';
  const noZeroAmount = 'Amount should be > 0';

  const deployRateProvider = async () => {
    const ERC20 = await ethers.getContractFactory('MockERC20');
    const MockUniswapV2Pair = await ethers.getContractFactory('MockUniswapV2Pair');
    const MockUniswapV2Factory = await ethers.getContractFactory('MockUniswapV2Factory');
    const UniswapRateProvider = await ethers.getContractFactory('UniswapRateProvider');

    const usdt = await ERC20.deploy('USD Coin', 'USDT', 6n);
    const weth = await ERC20.deploy('Wrapped Ether', 'WETH', 18n);
    const uniswapFactory = await MockUniswapV2Factory.deploy();
    const pairUSDT_WETH = await MockUniswapV2Pair.deploy(
      await usdt.getAddress(),
      await weth.getAddress(),
      28023032449161n,
      17058546289897112010873n,
    );
    await uniswapFactory.addPair(await usdt.getAddress(), await weth.getAddress(), await pairUSDT_WETH.getAddress());
    const rateProvider = await UniswapRateProvider.deploy(
      await uniswapFactory.getAddress(),
      await weth.getAddress(),
    );
    await rateProvider.addRatePair(await usdt.getAddress(), await weth.getAddress());
    return {rateProvider, usdt, weth};
  }

  const deployLockFixture = async () => {
    const Bull20 = await ethers.getContractFactory('Bull20');
    const Bull20Proxy = await ethers.getContractFactory('Bull20Proxy');

    const [owner, account1] = await ethers.getSigners();

    const {rateProvider, usdt} = await deployRateProvider();

    await usdt.mint(owner.address, ethers.parseEther('1000000000'));
    await usdt.mint(account1.address, ethers.parseEther('1000000000'));
    const bull20Proxy = await Bull20Proxy.deploy();
    const bull20Instance = await Bull20.deploy(await bull20Proxy.getAddress());
    await bull20Proxy.setInstanceAddress(await bull20Instance.getAddress());
    await bull20Proxy.setRateProvider(await rateProvider.getAddress());
    await bull20Proxy.enable();
    return {bull20: bull20Proxy, instance: bull20Instance, owner, account1, testToken: usdt, rateProvider};
  }

  const withdrawNative = async (
    bull20: Bull20Proxy,
    rateProvider: UniswapRateProvider
  ) => {
    const stagePrice: bigint = ethers.parseEther('10');
    const amount = 20n;
    const value = await rateProvider.getAmountForUSD(emptyAddress, amount * stagePrice);
    await bull20.addStage(stagePrice, ethers.parseEther('50'));
    await bull20.buy(amount, emptyAddress, {
      value,
    });

    const balanceBeforeWithdraw = await ethers.provider.getBalance(await bull20.getInstanceAddress());
    await bull20.withdraw();
    const balanceAfterWithdraw = await ethers.provider.getBalance(await bull20.getInstanceAddress());
    expect(balanceBeforeWithdraw).to.equal(value);
    expect(balanceAfterWithdraw).to.equal(0n);
  }

  const withdrawTokens = async (
    bull20: Bull20Proxy,
    testToken: MockERC20,
    rateProvider: UniswapRateProvider
  ) => {
    const stagePrice: bigint = ethers.parseEther('10');
    const amount = 35n;
    const value = await rateProvider.getAmountForUSD(testToken, amount * stagePrice);
    await testToken.approve(await bull20.getInstanceAddress(), value);
    await bull20.addStage(stagePrice, ethers.parseEther('50'));
    await bull20.buy(amount, await testToken.getAddress());

    const balanceBeforeWithdraw = await testToken.balanceOf(await bull20.getInstanceAddress());
    await bull20.withdraw();
    const balanceAfterWithdraw = await testToken.balanceOf(await bull20.getInstanceAddress());
    expect(balanceBeforeWithdraw).to.equal(value);
    expect(balanceAfterWithdraw).to.equal(0n);
  }

  describe('Stages', () => {
    it('Initial stages should be empty', async () => {
      const {bull20} = await loadFixture(deployLockFixture);
      await expect(await bull20.stages()).to.be.an('array').that.is.empty
    });

    it('Create first stage', async () => {
      const {bull20} = await loadFixture(deployLockFixture);
      await bull20.addStage(ethers.parseEther('20'), ethers.parseEther('1000000'));
      await expect(await bull20.stages()).to.have.length(1);
    });

    it('Edit stage', async () => {
      const {bull20} = await loadFixture(deployLockFixture);
      await bull20.addStage(ethers.parseEther('20'), ethers.parseEther('5000000'));
      await bull20.addStage(ethers.parseEther('25'), ethers.parseEther('7000000'));
      await expect(await bull20.stages()).to.have.length(2);
      await bull20.editStage(1, ethers.parseEther('35'), ethers.parseEther('8000000'));
      const [stage0, stage1] = await bull20.stages();
      await expect(stage0.expectedValue).to.equal(ethers.parseEther('5000000'));
      await expect(stage1.expectedValue).to.equal(ethers.parseEther('8000000'));
      await expect(stage1.price).to.equal(ethers.parseEther('35'));
    });

    it('Delete stage', async () => {
      const {bull20} = await loadFixture(deployLockFixture);
      await bull20.addStage(ethers.parseEther('10'), ethers.parseEther('5000000'));
      await bull20.addStage(ethers.parseEther('20'), ethers.parseEther('7000000'));
      await bull20.addStage(ethers.parseEther('30'), ethers.parseEther('5000000'));
      await expect(await bull20.stages()).to.have.length(3);
      await bull20.deleteLastStage();
      await expect(await bull20.stages()).to.have.length(2);
    });
  });

  describe('Rates', () => {
    it('Compare rates', async () => {
      const {bull20, testToken, owner, rateProvider} = await loadFixture(deployLockFixture);

      const wethForOneUSD = await rateProvider.getAmountForUSD(emptyAddress, ethers.parseEther('1'));
      expect(wethForOneUSD).to.equal(608733059880100n);

      const strPriceUSD = '0.001';
      const priceUSD = ethers.parseEther(strPriceUSD);

      const testTokenAmount = await rateProvider.getAmountForUSD(await testToken.getAddress(), priceUSD);
      const converted = ethers.formatUnits(testTokenAmount, await testToken.decimals());

      expect(converted).to.equal(strPriceUSD);
    });
  });

  describe('Presale', () => {
    it('Owner airdrop', async () => {
      const {bull20, account1} = await loadFixture(deployLockFixture);
      await bull20.addStage(ethers.parseEther('15'), ethers.parseEther('5000'));
      await bull20.airdrop(account1.address, 50n);
      expect(await bull20.presaleAmount(account1.address)).to.equal(50n);
    });

    it('Owner airdrop many', async () => {
      const {bull20, account1, owner} = await loadFixture(deployLockFixture);
      await bull20.addStage(ethers.parseEther('15'), ethers.parseEther('5000'));
      await bull20.airdropMany([account1.address, owner.address], [50n, 60n]);
      expect(await bull20.presaleAmount(account1.address)).to.equal(50n);
      expect(await bull20.presaleAmount(owner.address)).to.equal(60n);
    });

    it('Buy little amount', async () => {
      const {bull20, instance, testToken, rateProvider, owner} = await loadFixture(deployLockFixture);
      await bull20.addStage(ethers.parseEther('10'), ethers.parseEther('50'));
      await bull20.buy(2n, emptyAddress, {
        value: await rateProvider.getAmountForUSD(emptyAddress, ethers.parseEther('20')),
      });
      await testToken.approve(await bull20.getInstanceAddress(),
        ethers.parseEther('30'));
      const value = 3n;
      await expect(bull20.buy(value, await testToken.getAddress()))
        .to.emit(instance, 'Purchase')
        .withArgs(
          await owner.getAddress(),
          30000000n,
          await testToken.getAddress(),
          value,
        );
    });

    describe('Buy', () => {
      const priceStage0 = ethers.parseEther('15');
      const priceStage1 = ethers.parseEther('45');
      let bull20Account1: Bull20Proxy;
      let testTokenAccount1: MockERC20;
      let rateProvider: IRateProvider;

      before('Prepare stages', async () => {
        const {bull20, account1, testToken, rateProvider: _rateProvider} = await loadFixture(deployLockFixture);
        bull20Account1 = bull20.connect(account1);
        testTokenAccount1 = testToken.connect(account1);
        rateProvider = _rateProvider;

        await bull20.addStage(priceStage0, ethers.parseEther('50'));
        await bull20.addStage(priceStage1, ethers.parseEther('100'));
      });

      it('Stage 0A', async () => {
        const amount = 2n;
        const value = await rateProvider.getAmountForUSD(emptyAddress, amount * priceStage0);
        expect(await ethers.provider.getBalance(await bull20Account1.getInstanceAddress())).to.equal('0');
        await bull20Account1.buy(amount, emptyAddress, {value});
        expect(await ethers.provider.getBalance(await bull20Account1.getInstanceAddress())).to.equal(value);
        expect((await bull20Account1.activeStage()).index).to.equal('0');
      });

      it('Stage 0B', async () => {
        const amount = 35n;
        const value = await rateProvider.getAmountForUSD(await testTokenAccount1.getAddress(), amount * priceStage0);
        await testTokenAccount1.approve(await bull20Account1.getInstanceAddress(), value);
        await bull20Account1.buy(amount, await testTokenAccount1.getAddress());
        expect((await bull20Account1.activeStage()).index).to.equal(1);
        expect(await testTokenAccount1.balanceOf(await bull20Account1.getInstanceAddress())).to.equal(value);
      });

      it('Stage 1A', async () => {
        const amount = 90n;
        const value = await rateProvider.getAmountForUSD(emptyAddress, amount * priceStage1);
        await bull20Account1.buy(amount, emptyAddress, {value});
        expect((await bull20Account1.activeStage()).index).to.equal(1);
      });

      it('Stage 1B', async () => {
        const amount = 20n;
        const value = await rateProvider.getAmountForUSD(emptyAddress, amount * priceStage1);
        await bull20Account1.buy(amount, emptyAddress, {value});
        expect((await bull20Account1.activeStage()).index).to.equal(1);
      });
    });
  });

  describe('Withdrawing', () => {
    it('Withdraw native', async () => {
      const {bull20, rateProvider} = await loadFixture(deployLockFixture);
      await withdrawNative(bull20, rateProvider);
    });

    it('Withdraw tokens', async () => {
      const {bull20, testToken, rateProvider} = await loadFixture(deployLockFixture);
      await withdrawTokens(bull20, testToken, rateProvider);
    });
  });

  describe('Replace instance', () => {
    it('New stages', async () => {
      const {bull20} = await loadFixture(deployLockFixture);
      await bull20.addStage(ethers.parseEther('15'), ethers.parseEther('500'));
      await bull20.addStage(ethers.parseEther('15'), ethers.parseEther('700'));
      const Bull20 = await ethers.getContractFactory('Bull20');
      const bull20NewInstance = await Bull20.deploy(await bull20.getAddress());
      await bull20.setInstanceAddress(await bull20NewInstance.getAddress());
      await bull20.addStage(ethers.parseEther('15'), ethers.parseEther('800'));
      await expect(await bull20.stages()).to.have.length(1);
    });

    it('Buy for ETH', async () => {
      const {bull20, rateProvider} = await loadFixture(deployLockFixture);
      const Bull20 = await ethers.getContractFactory('Bull20');
      const bull20NewInstance = await Bull20.deploy(await bull20.getAddress());
      await bull20.setInstanceAddress(await bull20NewInstance.getAddress());
      await bull20.addStage(ethers.parseEther('10'), ethers.parseEther('50'));
      await bull20.setRateProvider(await rateProvider.getAddress());
      await bull20.enable();
      const value = await rateProvider.getAmountForUSD(emptyAddress, ethers.parseEther('20'));
      await bull20.buy(2n, emptyAddress, {value});
      const balance = await ethers.provider.getBalance(await bull20.getInstanceAddress());
      expect(balance).to.equal(value);
    });

    it('Buy for token', async () => {
      const {bull20, rateProvider, testToken} = await loadFixture(deployLockFixture);
      const Bull20 = await ethers.getContractFactory('Bull20');
      const bull20NewInstance = await Bull20.deploy(await bull20.getAddress());
      await bull20.setInstanceAddress(await bull20NewInstance.getAddress());
      await bull20.addStage(ethers.parseEther('10'), ethers.parseEther('50'));
      await bull20.setRateProvider(await rateProvider.getAddress());
      await bull20.enable();
      const value = await rateProvider.getAmountForUSD(await testToken.getAddress(), ethers.parseEther('20'));
      await testToken.approve(await bull20.getInstanceAddress(), value);
      await bull20.buy(2n, await testToken.getAddress());
      const balance = await testToken.balanceOf(await bull20.getInstanceAddress());
      expect(balance).to.equal(value);
    });

    it('Withdrawing', async () => {
      const {bull20, rateProvider, testToken} = await loadFixture(deployLockFixture);
      const Bull20 = await ethers.getContractFactory('Bull20');
      const bull20NewInstance = await Bull20.deploy(await bull20.getAddress());
      await bull20.setInstanceAddress(await bull20NewInstance.getAddress());
      await bull20.setRateProvider(await rateProvider.getAddress());
      await bull20.enable();
      await withdrawNative(bull20, rateProvider);
      await withdrawTokens(bull20, testToken, rateProvider);
    });
  });

  describe('Negative cases', () => {
    it('Buy with empty amount', async () => {
      const {bull20} = await loadFixture(deployLockFixture);
      await bull20.addStage(ethers.parseEther('15'), ethers.parseEther('500'));
      await expect(bull20.buy(0n, emptyAddress, {
        value: 0n
      })).to.be.revertedWith(noZeroAmount);
    });

    it('Airdrop from not owner', async () => {
      const {bull20, account1} = await loadFixture(deployLockFixture);
      await bull20.addStage(ethers.parseEther('15'), ethers.parseEther('500'));
      await expect(bull20.connect(account1).airdrop(account1.address, 150))
        .to.be.revertedWith(onlyOwnerError);
    });

    it('Replace instance from not owner', async () => {
      const {bull20, account1} = await loadFixture(deployLockFixture);
      await expect(bull20.connect(account1).setInstanceAddress(await bull20.getAddress()))
        .to.be.revertedWith(onlyOwnerError);
    });
  });
})