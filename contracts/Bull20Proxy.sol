// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IBull20.sol";
import "./interfaces/IToken.sol";
import "./interfaces/IRateProvider.sol";
import "./helpers/Holder.sol";
import "./interfaces/Stage.sol";

contract Bull20Proxy is Holder {
    address private _instance;

    function setInstanceAddress(address instance) onlyHolder external {
        require(instance.code.length != 0, "Invalid contract");
        _instance = instance;
    }

    function getInstanceAddress() external view returns (address) {
        return _instance;
    }

    function _getInstance() private view returns (IBull20) {
        require(_instance != address(0x0), "Instance is not configured");
        return IBull20(_instance);
    }

    // public overrides

    function holders() external view returns (address[] memory) {
        return _getInstance().holders();
    }

    function enabled() external view returns (bool) {
        return _getInstance().enabled();
    }

    function rateProvider() external view returns (IRateProvider) {
        return _getInstance().rateProvider();
    }

    function mainToken() public view returns (IToken) {
        return _getInstance().mainToken();
    }

    function stages() public view returns (Stage[] memory) {
        return _getInstance().stages();
    }

    function activeStage() public view returns (Stage memory) {
        return _getInstance().activeStage();
    }

    function totalRaised() external view returns (uint256) {
        return _getInstance().totalRaised();
    }

    function presaleAmount(address _wallet) external view returns (uint256) {
        return _getInstance().presaleAmount(_wallet);
    }

    // user overrides

    function buy(uint256 amount, address token) external payable {
        _getInstance().buy(amount, token, msg.value, msg.sender);

        if (address(this).balance != 0) {
            payable(_instance).transfer(address(this).balance);
        }
    }

    function swap(uint256 _amount) external {
        return _getInstance().swap(_amount, msg.sender);
    }

    // owner overrides

    function disable() external onlyHolder {
        return _getInstance().disable();
    }

    function enable() external onlyHolder {
        return _getInstance().enable();
    }

    function setMainToken(address mainToken_) external onlyHolder {
        return _getInstance().setMainToken(mainToken_);
    }

    function setRateProvider(address rateProvider_) public onlyHolder {
        return _getInstance().setRateProvider(rateProvider_);
    }

    function addStage(uint256 priceUSD, uint256 expectedValue) external onlyHolder returns (Stage memory) {
        return _getInstance().addStage(priceUSD, expectedValue);
    }

    function editStage(uint index, uint256 price, uint256 expectedValue) external onlyHolder returns (Stage memory) {
        return _getInstance().editStage(index, price, expectedValue);
    }

    function deleteLastStage() external onlyHolder {
        return _getInstance().deleteLastStage();
    }

    function airdrop(address wallet, uint256 amount) external onlyHolder {
        return _getInstance().airdrop(wallet, amount);
    }

    function airdropMany(address[] memory wallets, uint256[] memory amounts) external onlyHolder {
        return _getInstance().airdropMany(wallets, amounts);
    }

    function withdraw() external onlyHolder payable {
        return _getInstance().withdraw(holder());
    }
}