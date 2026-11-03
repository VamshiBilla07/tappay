/**
 * Vercel serverless handler for the PayFlux merchant API.
 * Uses Supabase for persistent link storage (shared across deployments).
 */

import express from "express";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  getAddress, isAddress, isAddressEqual, parseUnits, verifyMessage,
  type Address, type Hex,
} from "viem";

// ── Shared constants (inlined for serverless compatibility) ──────────

export const CHAIN_ID = 84532;
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

// ── Supabase client ──────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

// ── Supabase store ───────────────────────────────────────────────────

async function findLink(id: string): Promise<LinkRecord | undefined> {
  const { data, error } = await sb
    .from("links")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return fromRow(data);
}

async function listLinks(merchant: string): Promise<LinkRecord[]> {
  const { data, error } = await sb
    .from("links")
    .select("*")
    .eq("merchant", merchant.toLowerCase())
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

async function nonceExists(nonce: string): Promise<boolean> {
  const { data } = await sb
    .from("links")
    .select("id")
    .filter("request->r->>nonce", "eq", nonce.toLowerCase())
    .limit(1);
  return !!(data && data.length > 0);
}

async function insertLink(link: LinkRecord): Promise<void> {
  const { error } = await sb.from("links").insert(toRow(link));
  if (error) throw error;
}

async function updateLink(id: string, patch: Partial<LinkRecord>): Promise<LinkRecord | undefined> {
  const row: any = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.txHash !== undefined) row.tx_hash = patch.txHash ?? null;
  if (patch.payer !== undefined) row.payer = patch.payer ?? null;
  if (patch.paidWithEth !== undefined) row.paid_with_eth = patch.paidWithEth ?? null;
  if (patch.method !== undefined) row.method = patch.method ?? null;

  const { data, error } = await sb
    .from("links")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return undefined;
  return fromRow(data);
}

function toRow(link: LinkRecord) {
  return {
    id: link.id,
    merchant: link.merchant,
    request: link.request,
    inr: link.inr,
    usdc: link.usdc,
    description: link.description,
    methods: link.methods,
    customer: link.customer,
    require_billing_address: link.requireBillingAddress,
    created_at: link.createdAt,
    expires_at: link.expiresAt,
    status: link.status,
    demo: link.demo ?? false,
    tx_hash: link.txHash ?? null,
    payer: link.payer ?? null,
    paid_with_eth: link.paidWithEth ?? null,
    method: link.method ?? null,
  };
}

function fromRow(row: any): LinkRecord {
  return {
    id: row.id,
    merchant: row.merchant,
    request: row.request,
    inr: row.inr,
    usdc: row.usdc,
    description: row.description ?? "",
    methods: row.methods ?? [],
    customer: row.customer ?? {},
    requireBillingAddress: row.require_billing_address ?? false,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status,
    demo: row.demo ?? undefined,
    txHash: row.tx_hash ?? undefined,
    payer: row.payer ?? undefined,
    paidWithEth: row.paid_with_eth ?? undefined,
    method: row.method ?? undefined,
  };
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

// ── CORS for customer dashboard cross-origin calls ────────────────────
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

/* ── config / health ─────────────────────────────────────────────── */

app.get("/api/config", (_req, res) => {
  res.json(configPayload());
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...configPayload() });
});

/* ── create / read / settle links ────────────────────────────────── */

app.post("/api/links", async (req, res, next) => {
  try {
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
    await insertLink(link);
    res.status(201).json({ link: view(link, publicBaseUrl(req)) });
  } catch (err) { next(err); }
}));

app.get("/api/links", async (req, res, next) => {
  try {
    const merchant = String(req.query.merchant ?? "");
    if (!isAddress(merchant)) throw new HttpError(400, "merchant query parameter is invalid.");
    const base = publicBaseUrl(req);
    const links = (await listLinks(merchant)).map((l) => view(expireIfLate(l), base));
    res.json({ links });
  } catch (err) { next(err); }
}));

app.get("/api/links/:id", async (req, res, next) => {
  try {
    const link = await findLink(req.params.id);
    if (!link) throw new HttpError(404, "Payment link not found.");
    res.json({ link: view(expireIfLate(link), publicBaseUrl(req)) });
  } catch (err) { next(err); }
}));

app.post("/api/links/:id/settle", async (req, res, next) => {
  try {
    const link = await findLink(req.params.id);
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
  } catch (err) { next(err); }
}));

app.post("/api/links/:id/simulate", async (req, res, next) => {
  try {
    const link = await findLink(req.params.id);
    if (!link) throw new HttpError(404, "Payment link not found.");
    if (link.status !== "open") {
      throw new HttpError(409, `This link is ${link.status}.`);
    }
    const method = typeof req.body?.method === "string" ? String(req.body.method).slice(0, 40) : "UPI";
    await updateLink(link.id, {
      status: "paid",
      paidWithEth: false,
      payer: link.request.r.merchant,
      method,
    });
    res.json({ link: view(link, publicBaseUrl(req)) });
  } catch (err) { next(err); }
}));

app.patch("/api/links/:id", async (req, res, next) => {
  try {
    const link = await findLink(req.params.id);
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
  } catch (err) { next(err); }
}));

/* ── merchant helpers ───────────────────────────────────────────── */

app.get("/api/merchant/:address/balance", async (_req, res, next) => {
  try {
    const address = _req.params.address;
    if (!isAddress(address)) throw new HttpError(400, "Address is invalid.");
    res.json({ balance: "0", decimals: 6 });
  } catch (err) { next(err); }
}));

/* ── deploy / adopt a settlement contract ───────────────────────── */

app.post("/api/admin/settlement", async (req, res, next) => {
  try {
    if (ADMIN_TOKEN && req.get("x-admin-token") !== ADMIN_TOKEN) {
      throw new HttpError(401, "Admin token required.");
    }
    const address = String(req.body?.address ?? "");
    const deployer = String(req.body?.deployer ?? "");
    const signature = String(req.body?.signature ?? "");
    if (!isAddress(address) || !isAddress(deployer) || !signature) {
      throw new HttpError(400, "address, deployer and signature are required.");
    }

    const signed = settlementMessage(getAddress(address), getAddress(deployer));
    let ok = false;
    try {
      ok = await verifyMessage({ address: getAddress(deployer), message: signed, signature: signature as Hex });
    } catch {
      ok = false;
    }
    if (!ok) throw new HttpError(401, "The deployer signature is invalid.");

    res.json(configPayload());
  } catch (err) { next(err); }
}));

/* ── error handler ──────────────────────────────────────────────── */

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err?.message ?? "Server error" });
});

export default app;
