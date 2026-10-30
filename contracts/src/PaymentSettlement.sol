// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWETH is IERC20 { function deposit() external payable; function withdraw(uint256) external; }

/// Uniswap SwapRouter02 (its structs have no deadline field).
interface IV3SwapRouter {
    struct ExactOutputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 amountOut; uint256 amountInMaximum; uint160 sqrtPriceLimitX96;
    }
    function exactOutputSingle(ExactOutputSingleParams calldata p) external payable returns (uint256 amountIn);
}

/// Settles merchant-signed (EIP-712) USDC payment requests. One-time nonce per merchant, expiry enforced.
contract PaymentSettlement is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PaymentRequest {
        address merchant; address token; uint256 amount;
        bytes32 nonce; uint64 expiry; string ensName;
    }

    bytes32 public constant REQUEST_TYPEHASH = keccak256(
        "PaymentRequest(address merchant,address token,uint256 amount,bytes32 nonce,uint64 expiry,string ensName)"
    );

    IERC20 public immutable usdc;
    IWETH public immutable weth;
    IV3SwapRouter public immutable router;
    uint24 public immutable poolFee;

    mapping(address => mapping(bytes32 => bool)) public nonceUsed;

    event PaymentSettled(address indexed merchant, bytes32 indexed nonce, address indexed payer,
        uint256 usdcAmount, bool paidWithEth, uint256 ethSpent);

    error Expired(); error NonceUsed(); error BadSignature(); error BadToken(); error ZeroAmount(); error SwapShort(); error RefundFailed();

    constructor(address _usdc, address _weth, address _router, uint24 _poolFee) EIP712("BasePOS", "1") {
        usdc = IERC20(_usdc); weth = IWETH(_weth); router = IV3SwapRouter(_router); poolFee = _poolFee;
    }

    function hashRequest(PaymentRequest calldata r) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            REQUEST_TYPEHASH, r.merchant, r.token, r.amount, r.nonce, r.expiry, keccak256(bytes(r.ensName))
        )));
    }

    function _consume(PaymentRequest calldata r, bytes calldata sig) internal {
        if (r.token != address(usdc)) revert BadToken();
        if (r.amount == 0) revert ZeroAmount();
        if (block.timestamp > r.expiry) revert Expired();
        if (nonceUsed[r.merchant][r.nonce]) revert NonceUsed();
        if (ECDSA.recover(hashRequest(r), sig) != r.merchant) revert BadSignature();
        nonceUsed[r.merchant][r.nonce] = true; // effects before interactions
    }

    /// Customer approved this contract for r.amount USDC beforehand.
    function pay(PaymentRequest calldata r, bytes calldata sig) external nonReentrant {
        _consume(r, sig);
        usdc.safeTransferFrom(msg.sender, r.merchant, r.amount);
        emit PaymentSettled(r.merchant, r.nonce, msg.sender, r.amount, false, 0);
    }

    /// msg.value = max ETH the customer will spend. Merchant receives EXACTLY r.amount USDC; leftover ETH is refunded.
    function payWithEth(PaymentRequest calldata r, bytes calldata sig) external payable nonReentrant {
        _consume(r, sig);
        uint256 before = usdc.balanceOf(r.merchant);
        weth.deposit{value: msg.value}();
        IERC20(address(weth)).forceApprove(address(router), msg.value);
        uint256 spent = router.exactOutputSingle(IV3SwapRouter.ExactOutputSingleParams({
            tokenIn: address(weth), tokenOut: address(usdc), fee: poolFee, recipient: r.merchant,
            amountOut: r.amount, amountInMaximum: msg.value, sqrtPriceLimitX96: 0
        }));
        IERC20(address(weth)).forceApprove(address(router), 0);
        if (usdc.balanceOf(r.merchant) - before < r.amount) revert SwapShort();
        uint256 refund = msg.value - spent;
        if (refund > 0) {
            weth.withdraw(refund);
            (bool ok,) = msg.sender.call{value: refund}("");
            if (!ok) revert RefundFailed();
        }
        emit PaymentSettled(r.merchant, r.nonce, msg.sender, r.amount, true, spent);
    }

    receive() external payable { require(msg.sender == address(weth), "WETH only"); }
}
