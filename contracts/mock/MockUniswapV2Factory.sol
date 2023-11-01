// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../interfaces/IUniswapV2Factory.sol";

contract MockUniswapV2Factory is IUniswapV2Factory {
    // tokenA->tokenB->pair
    mapping(address => mapping(address => address)) private _pairs;

    function getPair(address tokenA, address tokenB) external view returns (address) {
        return _pairs[tokenA][tokenB];
    }


    function addPair(address tokenA, address tokenB, address pair) public {
        _pairs[tokenA][tokenB] = pair;
    }
}