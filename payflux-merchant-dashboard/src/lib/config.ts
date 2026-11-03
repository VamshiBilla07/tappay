import { formatUnits, parseUnits, type Address } from "viem";

/** Runtime config owned by the payment server (server/config.ts). */
export interface AppConfig {
  chainId: number;
  chainName: string;
  settlement: Address;
  settlementDeployer: Address | null;
  deployed: boolean;
  usdc: Address;
  weth: Address;
  swapRouter: Address;
  poolFee: number;
  inrPerUsdc: number;
  maxLinkSeconds: number;
  expirySafetySeconds: number;
}

let cached: AppConfig | null = null;

export async function getConfig(force = false): Promise<AppConfig> {
  if (cached && !force) return cached;
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) throw new Error(`Config request failed (${res.status})`);
  cached = (await res.json()) as AppConfig;
  return cached;
}

export function clearConfigCache(): void {
  cached = null;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const shortAddr = (address?: string | null): string =>
  address && address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address ?? "";

export const fmtUsdc = (value: bigint | string | number): string =>
  Number(formatUnits(toBigInt(value), 6)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

export function toBigInt(value: bigint | string | number): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.round(value));
  const trimmed = value.trim();
  // Server-provided USDC amounts are whole-token decimals ("50.000000");
  // raw contract reads are base-unit integers.
  return trimmed.includes(".") ? parseUnits(trimmed, 6) : BigInt(trimmed);
}

/** ₹ → USDC base units, using the server's display rate. */
export const inrToUsdc = (inr: number, rate: number): bigint =>
  parseUnits((inr / rate).toFixed(6), 6);

/** USDC base units → ₹ (for the INR-denominated dashboard). */
export const usdcToInr = (usdc: bigint, rate: number): number =>
  Number(formatUnits(usdc, 6)) * rate;

export const basescanTx = (tx: string): string => `https://sepolia.basescan.org/tx/${tx}`;
export const basescanAddress = (address: string): string => `https://sepolia.basescan.org/address/${address}`;
