import { Address, PublicClient, WalletClient } from "viem";
import { POOL_FEE, QUOTER_V2, SETTLEMENT, SLIPPAGE_BPS, USDC, WETH } from "./config";
import { erc20Abi, quoterAbi, settlementAbi } from "./abi";
import type { SignedRequest } from "./request";

export async function quoteEthIn(pc: PublicClient, usdcOut: bigint) {
  const { result } = await pc.simulateContract({ address: QUOTER_V2, abi: quoterAbi, functionName: "quoteExactOutputSingle",
    args: [{ tokenIn: WETH, tokenOut: USDC, amount: usdcOut, fee: POOL_FEE, sqrtPriceLimitX96: 0n }] });
  const quote = result[0];
  return { quote, maxIn: quote + (quote * SLIPPAGE_BPS) / 10_000n };
}

export async function payUsdc(pc: PublicClient, wc: WalletClient, s: SignedRequest, onStep?: (m: string) => void,
  settlement: Address = SETTLEMENT) {
  const account = wc.account!;
  const allowance = await pc.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [account.address, settlement] });
  if (allowance < s.req.amount) {
    onStep?.("Approving USDC");
    const a = await wc.writeContract({ address: USDC, abi: erc20Abi, functionName: "approve", args: [settlement, s.req.amount], account, chain: wc.chain });
    await pc.waitForTransactionReceipt({ hash: a });
  }
  onStep?.("Submitting payment");
  const hash = await wc.writeContract({ address: settlement, abi: settlementAbi, functionName: "pay", args: [s.req, s.sig], account, chain: wc.chain });
  return pc.waitForTransactionReceipt({ hash });
}

/** Contract swaps for EXACT USDC out; unspent ETH is refunded to the payer. */
export async function payEth(pc: PublicClient, wc: WalletClient, s: SignedRequest, onStep?: (m: string) => void,
  settlement: Address = SETTLEMENT) {
  onStep?.("Quoting swap");
  const { maxIn } = await quoteEthIn(pc, s.req.amount);
  onStep?.("Swapping & paying");
  const account = wc.account!;
  const hash = await wc.writeContract({ address: settlement, abi: settlementAbi, functionName: "payWithEth", args: [s.req, s.sig], value: maxIn, account, chain: wc.chain });
  return pc.waitForTransactionReceipt({ hash });
}

export function watchSettlement(pc: PublicClient, merchant: Address, nonce: `0x${string}`, cb: (tx: `0x${string}`) => void,
  settlement: Address = SETTLEMENT) {
  return pc.watchContractEvent({ address: settlement, abi: settlementAbi, eventName: "PaymentSettled",
    args: { merchant, nonce }, onLogs: (logs) => cb(logs[0].transactionHash), pollingInterval: 2_000 });
}
