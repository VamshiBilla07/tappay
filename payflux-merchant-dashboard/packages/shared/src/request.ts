import { Address, Hex, bytesToHex, recoverTypedDataAddress } from "viem";
import type { LocalAccount } from "viem";
import { CHAIN, EXPIRY_SECONDS, SETTLEMENT, USDC } from "./config";

export const domain = (verifyingContract: Address = SETTLEMENT) =>
  ({ name: "BasePOS", version: "1", chainId: CHAIN.id, verifyingContract }) as const;

export const types = { PaymentRequest: [
  { name: "merchant", type: "address" }, { name: "token", type: "address" }, { name: "amount", type: "uint256" },
  { name: "nonce", type: "bytes32" }, { name: "expiry", type: "uint64" }, { name: "ensName", type: "string" } ] } as const;

export interface PaymentRequest { merchant: Address; token: Address; amount: bigint; nonce: Hex; expiry: bigint; ensName: string }
export interface SignedRequest { req: PaymentRequest; sig: Hex }

export const randomNonce = (): Hex => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));

export async function createSignedRequest(account: LocalAccount, ensName: string, usdcAmount: bigint,
  now = Math.floor(Date.now() / 1000), expirySeconds = EXPIRY_SECONDS): Promise<SignedRequest> {
  const req: PaymentRequest = { merchant: account.address, token: USDC, amount: usdcAmount,
    nonce: randomNonce(), expiry: BigInt(now + expirySeconds), ensName };
  const sig = await account.signTypedData({ domain: domain(), types, primaryType: "PaymentRequest", message: req });
  return { req, sig };
}

export const recoverSigner = ({ req, sig }: SignedRequest, verifyingContract: Address = SETTLEMENT): Promise<Address> =>
  recoverTypedDataAddress({ domain: domain(verifyingContract), types, primaryType: "PaymentRequest", message: req, signature: sig });

/** Wire format shared by QR and NFC (NDEF text record).
 *  `verifyingContract` must match the domain the merchant signed over. */
export const encode = ({ req, sig }: SignedRequest, verifyingContract: Address = SETTLEMENT) => JSON.stringify({ v: 1, c: CHAIN.id, s: verifyingContract,
  r: { ...req, amount: req.amount.toString(), expiry: req.expiry.toString() }, g: sig });
export function decode(text: string): SignedRequest & { chainId: number; settlement: Address } {
  const j = JSON.parse(text);
  if (j.v !== 1) throw new Error("Unsupported payload version");
  return { req: { ...j.r, amount: BigInt(j.r.amount), expiry: BigInt(j.r.expiry) }, sig: j.g, chainId: j.c, settlement: j.s };
}
