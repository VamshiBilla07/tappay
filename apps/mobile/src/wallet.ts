import * as SecureStore from "expo-secure-store";
import { createPublicClient, createWalletClient, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { BASE_RPC, CHAIN } from "@pos/shared";

/** TESTNET ONLY: key lives in Android Keystore-backed SecureStore. Fund this address with Base Sepolia ETH / USDC. */
export async function loadAccount(slot: "merchant" | "customer") {
  let pk = (await SecureStore.getItemAsync(`pk_${slot}`)) as `0x${string}` | null;
  if (!pk) { pk = generatePrivateKey(); await SecureStore.setItemAsync(`pk_${slot}`, pk); }
  return privateKeyToAccount(pk);
}
/** Replace the stored key with one you provide (e.g. the wallet that owns your ENS name). TESTNET ONLY. */
export async function importAccount(slot: "merchant" | "customer", pk: string) {
  const key = (pk.trim().startsWith("0x") ? pk.trim() : "0x" + pk.trim()) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Private key must be 64 hex characters");
  const account = privateKeyToAccount(key); // throws if out of range
  await SecureStore.setItemAsync(`pk_${slot}`, key);
  return account;
}
export const publicClient = createPublicClient({ chain: CHAIN, transport: http(BASE_RPC) });
export const walletFor = (account: ReturnType<typeof privateKeyToAccount>) =>
  createWalletClient({ account, chain: CHAIN, transport: http(BASE_RPC) });
