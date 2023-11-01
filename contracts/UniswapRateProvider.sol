// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IRateProvider.sol";
import "./interfaces/IToken.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./helpers/Holder.sol";

    struct Pair {
        address usdToken;
        address pair;
    }

contract UniswapRateProvider is Holder, IRateProvider {
    // token->pair
    mapping(address => Pair) private _pairs;
    address[] private _usdTokens;
    mapping(address => uint8) private _usdTokenDecimal;
    address[] private _tokens;
    address private immutable _uniswapFactory;
    address private immutable _wrappedNativeToken;
    uint8 private constant _usdDecimals = 18;

    constructor(
        address uniswapFactory,
    // WETH
        address wrappedNativeToken
    ) {
        require(uniswapFactory != address(0x0), "Empty uniswapFactory");
        require(wrappedNativeToken != address(0x0), "Empty wrappedNativeToken");
        _uniswapFactory = uniswapFactory;
        _wrappedNativeToken = wrappedNativeToken;
    }

    function addRatePair(address usdToken, address secondaryToken) public onlyHolder {
        IUniswapV2Factory factory = IUniswapV2Factory(_uniswapFactory);
        address pair = factory.getPair(usdToken, secondaryToken);

        require(pair != address(0x0), "Pair not found");

        _tokens.push(secondaryToken);
        _pairs[secondaryToken] = Pair(usdToken, address(pair));
        _usdTokens.push(usdToken);
        _usdTokenDecimal[usdToken] = IToken(usdToken).decimals();
    }

    function deleteRatePair(address secondaryToken) public onlyHolder {
        require(_pairs[secondaryToken].usdToken != address(0x0), "Pair not found");
        _pairs[secondaryToken] = Pair(address(0x0), address(0x0));
        uint256 tokensLength = _tokens.length;

        for (uint32 i = 0; i < tokensLength; ++i) {
            if (_tokens[i] == secondaryToken) {
                delete _tokens[i];
                break;
            }
        }
    }

    function getAmountForUSD(address token, uint256 amount) external view returns (uint256) {
        if (token == address(0x0)) {
            token = _wrappedNativeToken;
        }

        if (_pairs[token].usdToken == address(0x0)) {
            uint256 usdTokensLength = _usdTokens.length;

            for (uint32 i = 0; i < usdTokensLength; ++i) {
                if (_usdTokens[i] == token) {
                    uint8 usdTokenDecimals = _usdTokenDecimal[token];

                    if (_usdDecimals > usdTokenDecimals) {
                        return amount / (10**(_usdDecimals-usdTokenDecimals));
                    }

                    return amount;
                }
            }
            require(false, "Rate not found");
        }

        require(amount > 0, "usd should be > 0");

        IUniswapV2Pair pair = IUniswapV2Pair(_pairs[token].pair);
        (uint112 res0, uint112 res1, uint blockTimestampLast) = pair.getReserves();

        IToken token0 = IToken(pair.token0());
        IToken token1 = IToken(pair.token1());

        uint256 usdAmount;
        uint256 tokenAmount;
        uint256 usdDecimals;
        uint256 tokenDecimals;

        if (_pairs[token].usdToken == address(token0)) {
            usdAmount = res0;
            tokenAmount = res1;
            usdDecimals = token0.decimals();
            tokenDecimals = token1.decimals();
        } else {
            usdAmount = res1;
            tokenAmount = res0;
            usdDecimals = token1.decimals();
            tokenDecimals = token0.decimals();
        }

        require(usdDecimals <= _usdDecimals, "Unexpected decimals");
        require(tokenDecimals <= _usdDecimals, "Unexpected decimals");

        tokenAmount = tokenAmount * (10 ** (_usdDecimals - tokenDecimals));
        usdAmount = usdAmount * (10 ** (_usdDecimals - usdDecimals));

        uint256 result = (amount * tokenAmount) / (usdAmount);
        require(result != 0, "Undefined result");
        return result;
    }

    function tokens() external view returns (address[] memory) {
        uint256 tokensLength;

        address[] memory computedTokens = new address[](
            _tokens.length + _usdTokens.length
        );
        tokensLength = _tokens.length;
        for (uint256 i = 0; i < tokensLength; ++i) {
            computedTokens[i] = _tokens[i];
        }
        tokensLength = _usdTokens.length;
        for (uint256 i = 0; i < tokensLength; ++i) {
            computedTokens[i + _tokens.length] = _usdTokens[i];
        }
        return computedTokens;
    }
}
