// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract MockUSDC is ERC20 { constructor() ERC20("USDC","USDC"){} function decimals() public pure override returns(uint8){return 6;} function mint(address to,uint v) external {_mint(to,v);} }
contract MockWETH is ERC20 { constructor() ERC20("WETH","WETH"){}
  function deposit() external payable {_mint(msg.sender,msg.value);}
  function withdraw(uint v) external {_burn(msg.sender,v); (bool ok,)=msg.sender.call{value:v}(""); require(ok);} }
contract MockRouter { // 1 ETH = 3000 USDC
  struct P { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountOut; uint256 amountInMaximum; uint160 sq; }
  function exactOutputSingle(P calldata p) external payable returns (uint256 amountIn) {
    amountIn = p.amountOut * 1e12 / 3000; require(amountIn <= p.amountInMaximum, "too much");
    MockWETH(p.tokenIn).transferFrom(msg.sender, address(this), amountIn); MockUSDC(p.tokenOut).mint(p.recipient, p.amountOut); } }
