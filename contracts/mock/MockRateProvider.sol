// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRateProvider.sol";

contract MockRateProvider is Ownable, IRateProvider {
    mapping(address => uint256) _rates;
    address[] _tokens;

    function getAmountForUSD(address token, uint256 usd) external view returns (uint256) {
        require(_rates[token] > 0, "Rate not found");
        require(usd > 0, "usd should be > 0");
        uint256 amount = (_rates[token] * usd) / 1 ether;
        uint256 check = (_rates[token] * usd) / amount;
        require(check == 1 ether, "Rate division error");
        return amount;
    }

    function setRate(address token, uint256 rate) external onlyOwner {
        _rates[token] = rate;
        uint256 tokensLength = _tokens.length;

        for (uint i = 0; i < tokensLength; ++i) {
            if (_tokens[i] == token) {
                if (rate == 0) {
                    delete _tokens[i];
                }

                return;
            }
        }

        _tokens.push(token);
    }

    function tokens() external view returns (address[] memory) {
        return _tokens;
    }
}
