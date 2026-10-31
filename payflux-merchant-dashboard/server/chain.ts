import { createPublicClient, decodeEventLog, http, isAddressEqual, type Address, type Hex } from "viem";
import { BASE_RPC, CHAIN, USDC, erc20Abi, settlementAbi } from "@pos/shared";
import type { LinkRecord } from "./types";

export const pc = createPublicClient({ chain: CHAIN as any, transport: http(BASE_RPC) });

/** Confirms a tx really contains PaymentSettled for this link's merchant/nonce/amount. */
export async function verifySettlementTx(
  txHash: Hex,
  link: LinkRecord,
): Promise<{ payer: Address; paidWithEth: boolean }> {
  const receipt = await pc.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error("That transaction reverted.");

  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, link.request.s)) continue;
    try {
      const decoded = decodeEventLog({
        abi: settlementAbi as any,
        data: log.data,
        topics: log.topics as any,
      }) as any;
      if (decoded.eventName !== "PaymentSettled") continue;
      const a = decoded.args as any;
      if (!isAddressEqual(a.merchant, link.merchant)) continue;
      if (String(a.nonce).toLowerCase() !== link.request.r.nonce.toLowerCase()) continue;
      if (BigInt(a.usdcAmount) !== BigInt(link.request.r.amount)) continue;
      return { payer: a.payer as Address, paidWithEth: Boolean(a.paidWithEth) };
    } catch {
      /* not a PaymentSettled log — keep looking */
    }
  }
  throw new Error("No matching PaymentSettled event was found in that transaction.");
}

export async function nonceUsed(
  settlement: Address,
  merchant: Address,
  nonce: Hex,
): Promise<boolean> {
  return (await pc.readContract({
    address: settlement,
    abi: settlementAbi as any,
    functionName: "nonceUsed",
    args: [merchant, nonce],
  })) as boolean;
}

export async function usdcBalance(who: Address): Promise<bigint> {
  return (await pc.readContract({
    address: USDC,
    abi: erc20Abi as any,
    functionName: "balanceOf",
    args: [who],
  })) as bigint;
}

export async function isContract(address: Address): Promise<boolean> {
  const code = await pc.getCode({ address });
  return !!code && code !== "0x";
}

/** Rejects lookalike contracts: the deployed contract must point at our USDC/WETH/pool. */
export async function verifySettlementContract(
  address: Address,
  expected: { usdc: Address; weth: Address; poolFee: number },
): Promise<void> {
  const [usdc, weth, poolFee] = await Promise.all([
    pc.readContract({ address, abi: settlementAbi as any, functionName: "usdc" }) as Promise<Address>,
    pc.readContract({ address, abi: settlementAbi as any, functionName: "weth" }) as Promise<Address>,
    pc.readContract({ address, abi: settlementAbi as any, functionName: "poolFee" }) as Promise<number>,
  ]);
  if (!isAddressEqual(usdc, expected.usdc)) throw new Error("Contract does not use the expected USDC token.");
  if (!isAddressEqual(weth, expected.weth)) throw new Error("Contract does not use the expected WETH token.");
  if (Number(poolFee) !== Number(expected.poolFee)) throw new Error("Contract does not use the expected pool fee.");
}
