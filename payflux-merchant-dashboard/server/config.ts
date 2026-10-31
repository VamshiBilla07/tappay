import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getAddress, isAddress, type Address } from "viem";
import { CHAIN, POOL_FEE, SETTLEMENT, SWAP_ROUTER, USDC, WETH } from "@pos/shared";

/** Server-side configuration. All values are testnet-only. */

export const PORT = Number(process.env.PORT || 3000);
export const INR_PER_USDC = Math.max(1, Number(process.env.INR_PER_USDC || 85));
export const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
export const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
export const CHAIN_ID = CHAIN.id;
export const MAX_LINK_SECONDS = 7 * 24 * 60 * 60;
/** Demo links are on by default in development, off in production unless DEMO_MODE=1. */
export const DEMO_MODE = process.env.DEMO_MODE
  ? process.env.DEMO_MODE === "1"
  : process.env.NODE_ENV !== "production";
export const DEMO_MERCHANT = "0x000000000000000000000000000000000000dEaD" as const;

export { USDC, WETH, SWAP_ROUTER, POOL_FEE };

const SETTLEMENT_FILE = path.join(DATA_DIR, "settlement.json");

export interface SettlementRecord {
  address: Address;
  deployer?: Address;
  setAt: number;
}

export const isDeployed = (address: string): boolean => !/^0x0{40}$/i.test(address);

function readStored(): SettlementRecord | null {
  try {
    const j = JSON.parse(fs.readFileSync(SETTLEMENT_FILE, "utf8"));
    if (!isAddress(j.address)) return null;
    return {
      address: getAddress(j.address),
      deployer: isAddress(j.deployer) ? getAddress(j.deployer) : undefined,
      setAt: Number(j.setAt) || 0,
    };
  } catch {
    return null;
  }
}

export function settlementRecord(): SettlementRecord {
  const fromEnv = process.env.SETTLEMENT_ADDRESS;
  if (fromEnv && isAddress(fromEnv)) {
    return {
      address: getAddress(fromEnv),
      deployer: isAddress(process.env.SETTLEMENT_DEPLOYER || "")
        ? getAddress(process.env.SETTLEMENT_DEPLOYER as string)
        : undefined,
      setAt: 0,
    };
  }
  return readStored() ?? { address: SETTLEMENT, setAt: 0 };
}

export function saveSettlement(record: SettlementRecord): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${SETTLEMENT_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2));
  fs.renameSync(tmp, SETTLEMENT_FILE);
}

/** Message the merchant wallet signs before the server adopts a new contract address. */
export function settlementMessage(address: Address, deployer: Address): string {
  return [
    "BasePOS settlement contract",
    `chain: ${CHAIN_ID}`,
    `contract: ${address.toLowerCase()}`,
    `owner: ${deployer.toLowerCase()}`,
  ].join("\n");
}

export function cancelMessage(id: string): string {
  return `Cancel PayFlux payment link ${id}`;
}

export function publicBaseUrl(req: { protocol: string; get: (h: string) => string | undefined }): string {
  if (APP_URL) return APP_URL;
  const host = req.get("x-forwarded-host") || req.get("host") || `localhost:${PORT}`;
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`;
}
