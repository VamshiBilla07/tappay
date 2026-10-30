// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PaymentSettlement, IV3SwapRouter, IWETH} from "../src/PaymentSettlement.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1_000_000 * 1e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockWETH is ERC20, IWETH {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function deposit() external payable override {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external override {
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "ETH transfer failed");
    }

    receive() external payable {
        _mint(msg.sender, msg.value);
    }
}

contract MockSwapRouter is IV3SwapRouter {
    address public weth;
    address public usdc;
    uint256 public rate = 3000; // 1 ETH = 3000 USDC

    constructor(address _weth, address _usdc) {
        weth = _weth;
        usdc = _usdc;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata p) external payable override returns (uint256 amountIn) {
        // e.g. amountOut is in 6 decimals USDC
        // 1 USDC = 1e18 / 3000 = ~3.33e14 wei ETH
        amountIn = (p.amountOut * 1e18) / (rate * 1e6);
        require(amountIn <= p.amountInMaximum, "Too much ETH needed");

        IERC20(weth).transferFrom(msg.sender, address(this), amountIn);
        MockUSDC(usdc).mint(p.recipient, p.amountOut);
        return amountIn;
    }
}

contract PaymentSettlementTest is Test {
    PaymentSettlement public settlement;
    MockUSDC public usdc;
    MockWETH public weth;
    MockSwapRouter public router;

    uint256 internal merchantPk = 0xA11CE;
    address internal merchant;

    uint256 internal customerPk = 0xB0B;
    address internal customer;

    bytes32 internal DOMAIN_SEPARATOR;

    function setUp() public {
        merchant = vm.addr(merchantPk);
        customer = vm.addr(customerPk);

        usdc = new MockUSDC();
        weth = new MockWETH();
        router = new MockSwapRouter(address(weth), address(usdc));

        settlement = new PaymentSettlement(address(usdc), address(weth), address(router), 3000);

        usdc.mint(customer, 10_000 * 1e6);
        vm.deal(customer, 10 ether);

        // Pre-calculate domain separator
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("BasePOS")),
                keccak256(bytes("1")),
                block.chainid,
                address(settlement)
            )
        );
    }

    function _signRequest(PaymentSettlement.PaymentRequest memory req, uint256 privateKey) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            settlement.REQUEST_TYPEHASH(),
            req.merchant,
            req.token,
            req.amount,
            req.nonce,
            req.expiry,
            keccak256(bytes(req.ensName))
        ));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_PayUSDC_Success() public {
        PaymentSettlement.PaymentRequest memory req = PaymentSettlement.PaymentRequest({
            merchant: merchant,
            token: address(usdc),
            amount: 50 * 1e6, // 50 USDC
            nonce: keccak256("nonce-1"),
            expiry: uint64(block.timestamp + 300),
            ensName: "merchant.eth"
        });

        bytes memory sig = _signRequest(req, merchantPk);

        vm.startPrank(customer);
        usdc.approve(address(settlement), req.amount);
        settlement.pay(req, sig);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), 50 * 1e6);
        assertTrue(settlement.nonceUsed(merchant, req.nonce));
    }

    function test_RevertIf_NonceReplayed() public {
        PaymentSettlement.PaymentRequest memory req = PaymentSettlement.PaymentRequest({
            merchant: merchant,
            token: address(usdc),
            amount: 50 * 1e6,
            nonce: keccak256("nonce-replay"),
            expiry: uint64(block.timestamp + 300),
            ensName: "merchant.eth"
        });

        bytes memory sig = _signRequest(req, merchantPk);

        vm.startPrank(customer);
        usdc.approve(address(settlement), req.amount * 2);
        settlement.pay(req, sig);

        // Try paying again with same nonce
        vm.expectRevert(PaymentSettlement.NonceUsed.selector);
        settlement.pay(req, sig);
        vm.stopPrank();
    }

    function test_RevertIf_Expired() public {
        PaymentSettlement.PaymentRequest memory req = PaymentSettlement.PaymentRequest({
            merchant: merchant,
            token: address(usdc),
            amount: 50 * 1e6,
            nonce: keccak256("nonce-expired"),
            expiry: uint64(block.timestamp - 1),
            ensName: "merchant.eth"
        });

        bytes memory sig = _signRequest(req, merchantPk);

        vm.startPrank(customer);
        usdc.approve(address(settlement), req.amount);
        vm.expectRevert(PaymentSettlement.Expired.selector);
        settlement.pay(req, sig);
        vm.stopPrank();
    }

    function test_RevertIf_BadSignature() public {
        PaymentSettlement.PaymentRequest memory req = PaymentSettlement.PaymentRequest({
            merchant: merchant,
            token: address(usdc),
            amount: 50 * 1e6,
            nonce: keccak256("nonce-bad-sig"),
            expiry: uint64(block.timestamp + 300),
            ensName: "merchant.eth"
        });

        // Sign with customer key instead of merchant key
        bytes memory sig = _signRequest(req, customerPk);

        vm.startPrank(customer);
        usdc.approve(address(settlement), req.amount);
        vm.expectRevert(PaymentSettlement.BadSignature.selector);
        settlement.pay(req, sig);
        vm.stopPrank();
    }

    function test_PayWithEth_SuccessAndRefund() public {
        PaymentSettlement.PaymentRequest memory req = PaymentSettlement.PaymentRequest({
            merchant: merchant,
            token: address(usdc),
            amount: 300 * 1e6, // 300 USDC -> requires 0.1 ETH at 3000 rate
            nonce: keccak256("nonce-eth-1"),
            expiry: uint64(block.timestamp + 300),
            ensName: "merchant.eth"
        });

        bytes memory sig = _signRequest(req, merchantPk);

        uint256 customerEthBefore = customer.balance;
        uint256 sentEth = 0.5 ether; // Customer sends 0.5 ETH, needs 0.1 ETH, gets 0.4 ETH back

        vm.startPrank(customer);
        settlement.payWithEth{value: sentEth}(req, sig);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), 300 * 1e6);
        assertEq(customerEthBefore - customer.balance, 0.1 ether);
    }
}
