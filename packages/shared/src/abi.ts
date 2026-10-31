const reqTuple = { name: "r", type: "tuple", components: [
  { name: "merchant", type: "address" }, { name: "token", type: "address" }, { name: "amount", type: "uint256" },
  { name: "nonce", type: "bytes32" }, { name: "expiry", type: "uint64" }, { name: "ensName", type: "string" } ] } as const;
export const settlementAbi = [
  { type: "function", name: "pay", stateMutability: "nonpayable", inputs: [reqTuple, { name: "sig", type: "bytes" }], outputs: [] },
  { type: "function", name: "payWithEth", stateMutability: "payable", inputs: [reqTuple, { name: "sig", type: "bytes" }], outputs: [] },
  { type: "function", name: "nonceUsed", stateMutability: "view", inputs: [{ type: "address" }, { type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "usdc", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "weth", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "poolFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint24" }] },
  { type: "event", name: "PaymentSettled", inputs: [
    { name: "merchant", type: "address", indexed: true }, { name: "nonce", type: "bytes32", indexed: true },
    { name: "payer", type: "address", indexed: true }, { name: "usdcAmount", type: "uint256", indexed: false },
    { name: "paidWithEth", type: "bool", indexed: false }, { name: "ethSpent", type: "uint256", indexed: false } ] },
] as const;
export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
export const quoterAbi = [{ type: "function", name: "quoteExactOutputSingle", stateMutability: "nonpayable",
  inputs: [{ name: "params", type: "tuple", components: [
    { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "amount", type: "uint256" },
    { name: "fee", type: "uint24" }, { name: "sqrtPriceLimitX96", type: "uint160" } ] }],
  outputs: [{ type: "uint256", name: "amountIn" }, { type: "uint160" }, { type: "uint32" }, { type: "uint256" }] }] as const;
