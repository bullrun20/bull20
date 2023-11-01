// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../interfaces/IUniswapV2Pair.sol";

contract MockUniswapV2Pair is IUniswapV2Pair {
    address private _token0;
    address private _token1;
    uint112 private _reserve0;
    uint112 private _reserve1;

    constructor(
        address token0_,
        address token1_,
        uint112 reserve0_,
        uint112 reserve1_) {
        require(token0_ != address(0x0));
        require(token1_ != address(0x0));
        _token0 = token0_;
        _token1 = token1_;
        _reserve0 = reserve0_;
        _reserve1 = reserve1_;
    }

    function decimals() external pure returns (uint8) {
        return 0;
    }

    function token0() external view returns (address) {
        return _token0;
    }

    function token1() external view returns (address) {
        return _token1;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (_reserve0, _reserve1, 0);
    }
}