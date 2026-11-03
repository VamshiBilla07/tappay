/**
 * Vercel serverless handler for the PayFlux merchant API.
 * Self-contained (no @pos/shared dependency) for serverless compatibility.
 */

import express from "express";
import crypto from "node:crypto";
import {
  getAddress, isAddress, isAddressEqual, parseUnits, verifyMessage,
  type Address, type Hex,
} from "viem";

// ── Shared constants (inlined from @pos/shared) ──────────────────────

export const CHAIN_ID = 84532; // Base Sepolia
export const CHAIN_NAME = "baseSepolia";
export const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const WETH = "0x4200000000000000000000000000000000000006";
export const SWAP_ROUTER = "0xC5290058841028F1614F3A6F0F5816cAd0df5E27";
export const POOL_FEE = 3000;

export const EXPIRY_SAFETY_SECONDS = 15;
export const MAX_LINK_SECONDS = 7 * 24 * 60 * 60;
export const DEMO_MERCHANT = "0x000000000000000000000000000000000000dEaD" as Address;

export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
export const INR_PER_USDC = Math.max(1, Number(process.env.INR_PER_USDC || 85));
export const PORT = Number(process.env.PORT || 3000);

// ── Types ─────────────────────────────────────────────────────────────

interface WireRequest {
  merchant: Address;
  token: Address;
  amount: string;
  nonce: Hex;
  expiry: string;
  ensName: string;
}

interface WirePayload {
  v: 1;
  c: number;
  s: Address;
  r: WireRequest;
  g: Hex;
}

interface LinkCustomer {
  name?: string;
  email?: string;
  phone?: string;
}

type LinkStatus = "open" | "paid" | "expired" | "cancelled";

interface LinkRecord {
  id: string;
  merchant: Address;
  request: WirePayload;
  inr: number;
  usdc: string;
  description: string;
  methods: string[];
  customer: LinkCustomer;
  requireBillingAddress: boolean;
  createdAt: number;
  expiresAt: number;
  status: LinkStatus;
  demo?: boolean;
  txHash?: Hex;
  payer?: Address;
  paidWithEth?: boolean;
  method?: string;
}

interface LinkView extends LinkRecord {
  url: string;
}

// ── In-memory store (replaces Supabase for serverless; use Supabase in prod) ─────

const links = new Map<string, LinkRecord>();

function findLink(id: string): LinkRecord | undefined {
  return links.get(id);
}

function listLinks(merchant: string): LinkRecord[] {
  const m = merchant.toLowerCase();
  return Array.from(links.values())
    .filter((l) => l.merchant.toLowerCase() === m)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function nonceExists(nonce: string): boolean {
  const n = nonce.toLowerCase();
  return Array.from(links.values()).some((l) => l.request.r.nonce.toLowerCase() === n);
}

function insertLink(link: LinkRecord): void {
  links.set(link.id, link);
}

function updateLink(id: string, patch: Partial<LinkRecord>): LinkRecord | undefined {
  const link = findLink(id);
  if (!link) return undefined;
  const updated = { ...link, ...patch };
  links.set(id, updated);
  return updated;
}

// ── Helpers ───────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const now = () => Math.floor(Date.now() / 1000);

function normalizeWire(input: any): WirePayload {
  const r = input?.r ?? {};
  const wire: WirePayload = {
    v: 1,
    c: Number(input?.c),
    s: String(input?.s ?? "") as Address,
    r: {
      merchant: String(r.merchant ?? "") as Address,
      token: String(r.token ?? "") as Address,
      amount: String(r.amount ?? "0"),
      nonce: String(r.nonce ?? "") as Hex,
      expiry: String(r.expiry ?? "0"),
      ensName: String(r.ensName ?? ""),
    },
    g: String(input?.g ?? "") as Hex,
  };
  if (wire.v !== 1) throw new HttpError(400, "Unsupported payload version.");
  if (!isAddress(wire.s)) throw new HttpError(400, "Payload settlement address is invalid.");
  if (!isAddress(wire.r.merchant)) throw new HttpError(400, "Payload merchant address is invalid.");
  if (!isAddress(wire.r.token)) throw new HttpError(400, "Payload token address is invalid.");
  if (!/^0x[0-9a-fA-F]{64}$/.test(wire.r.nonce)) throw new HttpError(400, "Payload nonce is invalid.");
  if (!/^0x[0-9a-fA-F]{2,}$/.test(wire.g)) throw new HttpError(400, "Payload signature is invalid.");
  return wire;
}

function sanitizeCustomer(input: any): LinkCustomer {
  const out: LinkCustomer = {};
  for (const key of ["name", "email", "phone"] as const) {
    const v = input?.[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 120);
  }
  return out;
}

function view(link: LinkRecord, base: string): LinkView {
  const url = `${base}/pay/${link.id}`;
  return { ...link, url: link.demo ? `${url}?demo=1` : url };
}

function expireIfLate(link: LinkRecord): LinkRecord {
  if (link.status === "open" && now() >= link.expiresAt) {
    updateLink(link.id, { status: "expired" });
    link.status = "expired";
  }
  return link;
}

function cancelMessage(id: string): string {
  return `Cancel PayFlux payment link ${id}`;
}

function settlementMessage(address: Address, deployer: Address): string {
  return [
    "BasePOS settlement contract",
    `chain: ${CHAIN_ID}`,
    `contract: ${address.toLowerCase()}`,
    `owner: ${deployer.toLowerCase()}`,
  ].join("\n");
}

function publicBaseUrl(req: { protocol: string; get: (h: string) => string | undefined }): string {
  const host = req.get("x-forwarded-host") || req.get("host") || `localhost:${PORT}`;
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`;
}

function configPayload() {
  return {
    chainId: CHAIN_ID,
    chainName: CHAIN_NAME,
    settlement: null,
    settlementDeployer: null,
    deployed: false,
    usdc: USDC,
    weth: WETH,
    swapRouter: SWAP_ROUTER,
    poolFee: POOL_FEE,
    inrPerUsdc: INR_PER_USDC,
    maxLinkSeconds: MAX_LINK_SECONDS,
    expirySafetySeconds: EXPIRY_SAFETY_SECONDS,
  };
}

// ── Express app ───────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "128kb" }));

const ah = (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    fn(req, res).catch(next);
  };

/* ── config / health ─────────────────────────────────────────────── */

app.get("/api/config", (_req, res) => {
  res.json(configPayload());
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...configPayload() });
});

/* ── create / read / settle links ────────────────────────────────── */

app.post("/api/links", ah(async (req, res) => {
  const wire = normalizeWire(req.body?.payload);

  const t = now();
  const expiry = Number(wire.r.expiry);
  if (expiry <= t + EXPIRY_SAFETY_SECONDS) throw new HttpError(400, "Request expires too soon.");
  if (expiry - t > MAX_LINK_SECONDS + 60) throw new HttpError(400, "Request expiry is longer than 7 days.");
  if (wire.r.amount <= 0n) throw new HttpError(400, "Request amount must be greater than zero.");

  if (await nonceExists(wire.r.nonce)) throw new HttpError(409, "This request nonce was already used.");

  const inr = Number(req.body?.inr);
  if (!Number.isFinite(inr) || inr <= 0 || inr > 100_000_000) throw new HttpError(400, "INR amount is invalid.");
  const usdc = Number(wire.r.amount) / 1e6;
  if (Math.abs(usdc - inr / INR_PER_USDC) > 0.01) {
    throw new HttpError(400, `USDC amount does not match ₹${inr} at the configured rate.`);
  }

  const methods = Array.isArray(req.body?.methods)
    ? req.body.methods.filter((m: unknown) => typeof m === "string" && m.length <= 40).slice(0, 12)
    : [];

  const link: LinkRecord = {
    id: `plink_${crypto.randomBytes(9).toString("base64url")}`,
    merchant: getAddress(wire.r.merchant),
    request: wire,
    inr,
    usdc: usdc.toFixed(6),
    description: String(req.body?.description ?? "").slice(0, 200),
    methods: methods.length ? methods : ["UPI", "Credit Card", "Debit Card", "Net Banking", "Digital Wallets", "NFC / Contactless", "Cryptocurrency"],
    customer: sanitizeCustomer(req.body?.customer),
    requireBillingAddress: Boolean(req.body?.requireBillingAddress),
    createdAt: t,
    expiresAt: expiry,
    status: "open",
  };
  insertLink(link);
  res.status(201).json({ link: view(link, publicBaseUrl(req)) });
}));

app.get("/api/links", ah(async (req, res) => {
  const merchant = String(req.query.merchant ?? "");
  if (!isAddress(merchant)) throw new HttpError(400, "merchant query parameter is invalid.");
  const base = publicBaseUrl(req);
  const links = listLinks(merchant).map((l) => view(expireIfLate(l), base));
  res.json({ links });
}));

app.get("/api/links/:id", ah(async (req, res) => {
  const link = findLink(req.params.id);
  if (!link) throw new HttpError(404, "Payment link not found.");
  res.json({ link: view(expireIfLate(link), publicBaseUrl(req)) });
}));

app.post("/api/links/:id/settle", ah(async (req, res) => {
  const link = findLink(req.params.id);
  if (!link) throw new HttpError(404, "Payment link not found.");
  const txHash = String(req.body?.txHash ?? "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new HttpError(400, "txHash is invalid.");

  if (link.status !== "paid") {
    await updateLink(link.id, {
      status: "paid",
      txHash: txHash as Hex,
      payer: link.request.r.merchant,
      paidWithEth: false,
      method: typeof req.body?.method === "string" ? String(req.body.method).slice(0, 40) : link.method,
    });
  }
  res.json({ link: view(link, publicBaseUrl(req)) });
}));

app.patch("/api/links/:id", ah(async (req, res) => {
  const link = findLink(req.params.id);
  if (!link) throw new HttpError(404, "Payment link not found.");
  if (req.body?.status !== "cancelled") throw new HttpError(400, "Only cancellation is supported.");
  if (link.status === "paid") throw new HttpError(409, "A settled link cannot be cancelled.");

  const merchant = String(req.body?.merchant ?? "");
  const signature = String(req.body?.signature ?? "");
  if (!isAddress(merchant) || !signature) throw new HttpError(400, "merchant and signature are required.");

  let ok = false;
  try {
    ok = await verifyMessage({
      address: getAddress(merchant),
      message: cancelMessage(link.id),
      signature: signature as Hex,
    });
  } catch {
    ok = false;
  }
  if (!ok || !isAddressEqual(getAddress(merchant), link.merchant)) {
    throw new HttpError(401, "Cancellation must be signed by the merchant wallet.");
  }
  await updateLink(link.id, { status: "cancelled" });
  res.json({ link: view(link, publicBaseUrl(req)) });
}));

/* ── error handler ──────────────────────────────────────────────── */

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err?.message ?? "Server error" });
});

export default app;
