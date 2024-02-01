// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.9;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

struct Deposit {
    address owner;
    uint128 liquidity;
    address token0;
    address token1;
}

contract SimpleSwap {
    mapping(address => mapping(address => address)) public getPair;
    INonfungiblePositionManager public immutable nonfungiblePositionManager;
    ISwapRouter public immutable swapRouter;
    mapping(uint256 => Deposit) public deposits;
    error OnlyOwner(address msgSender);
    error InsufficientLiquidity(uint128 liquidity);
    event Minted(uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    event SwapInput(uint256 amountOut);
    event Collect(uint256 amount0, uint256 amount1);
    event DecreaseLiquidity(uint256 amount0, uint256 amount1);
    event IncreaseLiquidity(uint256 amount0, uint256 amount1);

    constructor(INonfungiblePositionManager _iNonfungiblePositionManager, ISwapRouter _swapRouter) {
        nonfungiblePositionManager = _iNonfungiblePositionManager;
        swapRouter = _swapRouter;
    }

    function createPool(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external returns (address pair) {
        (address tokenA, address tokenB) = token0 < token1 ? (token0, token1) : (token1, token0);

        return
            nonfungiblePositionManager.createAndInitializePoolIfNecessary(
                tokenA,
                tokenB,
                fee,
                sqrtPriceX96
            );
    }

    /// @notice Calls the mint function defined in periphery, mints the same amount of each token.
    /// @return tokenId The id of the newly minted ERC721
    /// @return liquidity The amount of liquidity for the position
    /// @return amount0 The amount of token0
    /// @return amount1 The amount of token1
    function mintNewPosition(
        address token0,
        address token1,
        uint24 poolFee,
        uint256 amount0ToMint,
        uint256 amount1ToMint,
        int24 minTick,
        int24 maxTick
    ) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {
        (address tokenA, address tokenB) = token0 < token1 ? (token0, token1) : (token1, token0);
        (uint256 amountA, uint256 amountB) = token0 < token1
            ? (amount0ToMint, amount1ToMint)
            : (amount1ToMint, amount0ToMint);
        // Approve the position manager
        TransferHelper.safeApprove(tokenA, address(nonfungiblePositionManager), amountA);
        TransferHelper.safeApprove(tokenB, address(nonfungiblePositionManager), amountB);

        //TransferPosition
        TransferHelper.safeTransferFrom(tokenA, msg.sender, address(this), amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, address(this), amountB);

        {
            INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager
                .MintParams({
                    token0: tokenA,
                    token1: tokenB,
                    fee: poolFee,
                    tickLower: minTick,
                    tickUpper: maxTick,
                    amount0Desired: amountA,
                    amount1Desired: amountB,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp
                });

            (tokenId, liquidity, amount0, amount1) = nonfungiblePositionManager.mint(params);
        }
        deposits[tokenId] = Deposit({
            owner: msg.sender,
            liquidity: liquidity,
            token0: tokenA,
            token1: tokenB
        });

        emit Minted(tokenId, liquidity, amount0, amount1);

        {
            // Remove allowance and refund in both assets.
            if (amount0 < amountA) {
                TransferHelper.safeApprove(tokenA, address(nonfungiblePositionManager), 0);
                uint256 refund0 = amountA - amount0;
                TransferHelper.safeTransfer(tokenA, msg.sender, refund0);
            }

            if (amount1 < amountB) {
                TransferHelper.safeApprove(tokenB, address(nonfungiblePositionManager), 0);
                uint256 refund1 = amountB - amount1;
                TransferHelper.safeTransfer(tokenB, msg.sender, refund1);
            }
        }
    }

    function getPositionOwner(uint256 tokenId) public view returns (address owner) {
        return deposits[tokenId].owner;
    }

    /// @notice Collects the fees associated with provided liquidity
    /// @dev The contract must hold the erc721 token before it can collect fees
    /// @param tokenId The id of the erc721 token
    /// @return amount0 The amount of fees collected in token0
    /// @return amount1 The amount of fees collected in token1
    function collectAllFees(uint256 tokenId) external returns (uint256 amount0, uint256 amount1) {
        // Caller must own the ERC721 position
        // Call to safeTransfer will trigger `onERC721Received` which must return the selector else transfer will fail
        if (msg.sender != deposits[tokenId].owner) {
            revert OnlyOwner(msg.sender);
        }

        // set amount0Max and amount1Max to uint256.max to collect all fees
        // alternatively can set recipient to msg.sender and avoid another transaction in `sendToOwner`
        INonfungiblePositionManager.CollectParams memory params = INonfungiblePositionManager
            .CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (amount0, amount1) = nonfungiblePositionManager.collect(params);
        emit Collect(amount0, amount1);
        // send collected feed back to owner
        _sendToOwner(tokenId, amount0, amount1);
    }

    function _sendToOwner(uint256 tokenId, uint256 amount0, uint256 amount1) internal {
        // get owner of contract
        address owner = deposits[tokenId].owner;

        address token0 = deposits[tokenId].token0;
        address token1 = deposits[tokenId].token1;
        // send collected fees to owner
        TransferHelper.safeTransfer(token0, owner, amount0);
        TransferHelper.safeTransfer(token1, owner, amount1);
    }

    function decreaseLiquidity(
        uint256 tokenId,
        uint128 liquidity
    ) external returns (uint256 amount0, uint256 amount1) {
        if (msg.sender != deposits[tokenId].owner) {
            revert OnlyOwner(msg.sender);
        }
        if (deposits[tokenId].liquidity < liquidity) {
            revert InsufficientLiquidity(liquidity);
        }

        INonfungiblePositionManager.DecreaseLiquidityParams
            memory params = INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        (amount0, amount1) = nonfungiblePositionManager.decreaseLiquidity(params);

        emit DecreaseLiquidity(amount0, amount1);
    }

    /// @notice Increases liquidity in the current range
    /// @dev Pool must be initialized already to add liquidity
    /// @param tokenId The id of the erc721 token
    /// @param amount0 The amount to add of token0
    /// @param amount1 The amount to add of token1
    function increaseLiquidity(
        uint256 tokenId,
        uint256 amountAdd0,
        uint256 amountAdd1
    ) external returns (uint256 amount0, uint256 amount1) {
        TransferHelper.safeApprove(
            deposits[tokenId].token0,
            address(nonfungiblePositionManager),
            amountAdd0
        );
        TransferHelper.safeApprove(
            deposits[tokenId].token1,
            address(nonfungiblePositionManager),
            amountAdd1
        );

        //TransferPosition
        TransferHelper.safeTransferFrom(
            deposits[tokenId].token0,
            msg.sender,
            address(this),
            amountAdd0
        );
        TransferHelper.safeTransferFrom(
            deposits[tokenId].token1,
            msg.sender,
            address(this),
            amountAdd1
        );

        INonfungiblePositionManager.IncreaseLiquidityParams
            memory params = INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amountAdd0,
                amount1Desired: amountAdd1,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        (, amount0, amount1) = nonfungiblePositionManager.increaseLiquidity(params);

        emit IncreaseLiquidity(amount0, amount1);
    }

    function swapExactInput(
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMinimum,
        bytes memory path
    ) external returns (uint256 amountOut) {
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);

        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountIn);

        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: path,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum
        });

        // Executes the swap.
        amountOut = swapRouter.exactInput(params);
        emit SwapInput(amountOut);
    }

    function swapExactOutput(
        address tokenIn,
        uint256 amountOut,
        uint256 amountInMaximum,
        bytes memory path
    ) external returns (uint256 amountIn) {
        // Transfer the specified `amountInMaximum` to this contract.
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountInMaximum);
        TransferHelper.safeApprove(tokenIn, address(swapRouter), amountInMaximum);

        // The parameter path is encoded as (tokenOut, fee, tokenIn/tokenOut, fee, tokenIn)
        // The tokenIn/tokenOut field is the shared token between the two pools used in the multiple pool swap. In this case USDC is the "shared" token.
        // For an exactOutput swap, the first swap that occurs is the swap which returns the eventual desired token.
        // In this case, our desired output token is WETH9 so that swap happpens first, and is encoded in the path accordingly.
        ISwapRouter.ExactOutputParams memory params = ISwapRouter.ExactOutputParams({
            path: path,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountOut: amountOut,
            amountInMaximum: amountInMaximum
        });

        // Executes the swap, returning the amountIn actually spent.
        amountIn = swapRouter.exactOutput(params);

        // If the swap did not require the full amountInMaximum to achieve the exact amountOut then we refund msg.sender and approve the router to spend 0.
        if (amountIn < amountInMaximum) {
            TransferHelper.safeApprove(tokenIn, address(swapRouter), 0);
            TransferHelper.safeTransfer(tokenIn, msg.sender, amountInMaximum - amountIn);
        }
    }
}
