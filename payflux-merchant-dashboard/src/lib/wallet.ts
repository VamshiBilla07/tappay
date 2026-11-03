import { createPublicClient, createWalletClient, custom, http, type Address } from "viem";
import { BASE_RPC, CHAIN } from "@pos/shared";

/** Minimal slice of EIP-1193 so the app needs no wallet SDK. */
interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
  on?(event: string, cb: (...a: any[]) => void): void;
  removeListener?(event: string, cb: (...a: any[]) => void): void;
}
declare global {
  interface Window { ethereum?: Eip1193 }
}

let eth: Eip1193 | undefined;

export function hasInjected(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectInjected(): Promise<Address> {
  eth = window.ethereum!;
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.length) throw new Error("No account was shared.");
  await ensureChain();
  return accounts[0] as Address;
}

/** Silent check — never opens a wallet popup. */
export async function authorizedAccount(): Promise<Address | null> {
  if (!hasInjected()) return null;
  try {
    const accounts = (await window.ethereum!.request({ method: "eth_accounts" })) as string[];
    return (accounts?.[0] as Address) ?? null;
  } catch {
    return null;
  }
}

/** Puts the wallet on Base Sepolia (switch, or add it first). */
export async function ensureChain(): Promise<void> {
  const CHAIN_ID = "0x20fb9"; // 84532
  try {
    await eth!.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID }] });
  } catch (e: any) {
    if (e?.code === 4902 || String(e?.message ?? "").includes("Unrecognized chain")) {
      await eth!.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID,
          chainName: "Base Sepolia",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [BASE_RPC],
          blockExplorerUrls: ["https://sepolia.basescan.org"],
        }],
      });
    } else throw e;
  }
}

/** Pay/sign through the wallet itself — the app never sees a private key.
 *  Loose typing is deliberate: page values cross into @pos/shared, whose viem
 *  copy is a second type universe. Shared's internals stay strictly typed. */
export const publicClient = (): any =>
  createPublicClient({ chain: CHAIN as any, transport: http(BASE_RPC) });

export const walletClientFor = (account: Address): any =>
  createWalletClient({ account, chain: CHAIN as any, transport: custom(window.ethereum!) });

export function watchAccounts(cb: (a: Address | null) => void): () => void {
  const injected = window.ethereum;
  if (!injected?.on) return () => {};
  const listener = (accs: string[]) => cb((accs[0] as Address) ?? null);
  injected.on("accountsChanged", listener);
  return () => injected.removeListener?.("accountsChanged", listener);
}

export const isUserRejection = (e: any): boolean =>
  e?.code === 4001 || /user rejected|denied/i.test(e?.message ?? "");
