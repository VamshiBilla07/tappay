import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import {
  getAddress, isAddress, isAddressEqual, parseUnits, verifyMessage,
  type Address, type Hex,
} from "viem";
import {
  CHAIN, EXPIRY_SAFETY_SECONDS, POOL_FEE, SWAP_ROUTER, USDC, WETH,
  decode, recoverSigner,
} from "@pos/shared";
import {
  ADMIN_TOKEN, CHAIN_ID, DEMO_MERCHANT, DEMO_MODE, INR_PER_USDC, MAX_LINK_SECONDS, PORT, cancelMessage,
  isDeployed, publicBaseUrl, saveSettlement, settlementMessage, settlementRecord,
} from "./config";
import { findLink, insertLink, listLinks, nonceExists, updateLink } from "./store";
import {
  isContract, nonceUsed, usdcBalance, verifySettlementContract, verifySettlementTx,
} from "./chain";
import type { LinkCustomer, LinkRecord, LinkView, WirePayload } from "./types";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const app = express();
app.use(express.json({ limit: "128kb" }));

const ah = (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    fn(req, res).catch(next);
  };

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
  }
  return link;
}

async function reconcile(link: LinkRecord): Promise<LinkRecord> {
  expireIfLate(link);
  if (link.status !== "open" || !isDeployed(link.request.s)) return link;
  try {
    if (await nonceUsed(link.request.s, link.merchant, link.request.r.nonce)) {
      updateLink(link.id, { status: "paid" });
    }
  } catch {
    /* RPC hiccup — the link is still payable; don't fail the read */
  }
  return link;
}

/* ── config ─────────────────────────────────────────────────────────── */

function configPayload() {
  const s = settlementRecord();
  return {
    chainId: CHAIN_ID,
    chainName: CHAIN.name,
    settlement: s.address,
    settlementDeployer: s.deployer ?? null,
    deployed: isDeployed(s.address),
    usdc: USDC,
    weth: WETH,
    swapRouter: SWAP_ROUTER,
    poolFee: POOL_FEE,
    inrPerUsdc: INR_PER_USDC,
    maxLinkSeconds: MAX_LINK_SECONDS,
    expirySafetySeconds: EXPIRY_SAFETY_SECONDS,
  };
}

app.get("/api/config", (_req, res) => {
  res.json(configPayload());
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...configPayload() });
});

/* ── create / read / settle links ───────────────────────────────────── */

app.post("/api/links", ah(async (req, res) => {
  const record = settlementRecord();
  if (!isDeployed(record.address)) {
    throw new HttpError(409, "The settlement contract is not deployed yet. Deploy it from Settings first.");
  }

  const wire = normalizeWire(req.body?.payload);
  const decoded = decode(JSON.stringify(wire));
  if (decoded.chainId !== CHAIN_ID) throw new HttpError(400, "Request is for a different chain.");
  if (!isAddressEqual(decoded.settlement, record.address)) {
    throw new HttpError(409, "Request was signed for a different settlement contract.");
  }
  if (!isAddressEqual(decoded.req.token, USDC)) throw new HttpError(400, "Request token must be testnet USDC.");
  if (decoded.req.amount <= 0n) throw new HttpError(400, "Request amount must be greater than zero.");

  const expiry = Number(decoded.req.expiry);
  const t = now();
  if (expiry <= t + EXPIRY_SAFETY_SECONDS) throw new HttpError(400, "Request expires too soon.");
  if (expiry - t > MAX_LINK_SECONDS + 60) throw new HttpError(400, "Request expiry is longer than 7 days.");

  const signer = await recoverSigner(decoded, decoded.settlement).catch(() => null);
  if (!signer || !isAddressEqual(signer, decoded.req.merchant)) {
    throw new HttpError(401, "The request signature does not recover to the merchant.");
  }

  const inr = Number(req.body?.inr);
  if (!Number.isFinite(inr) || inr <= 0 || inr > 100_000_000) throw new HttpError(400, "INR amount is invalid.");
  const usdc = Number(decoded.req.amount) / 1e6;
  if (Math.abs(usdc - inr / INR_PER_USDC) > 0.01) {
    throw new HttpError(400, `USDC amount does not match ₹${inr} at the configured rate.`);
  }
  if (nonceExists(decoded.req.nonce)) throw new HttpError(409, "This request nonce was already used.");

  const methods = Array.isArray(req.body?.methods)
    ? req.body.methods.filter((m: unknown) => typeof m === "string" && m.length <= 40).slice(0, 12)
    : [];

  const link: LinkRecord = {
    id: `plink_${crypto.randomBytes(9).toString("base64url")}`,
    merchant: getAddress(decoded.req.merchant),
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

/**
 * Demo-only link creation. Unlike POST /api/links this needs no signature or
 * deployed contract, but it is gated by DEMO_MODE and marked demo:true so it
 * can never be confused with a real settlement request.
 */
app.post("/api/demo/links", ah(async (req, res) => {
  if (!DEMO_MODE) throw new HttpError(404, "Demo links are disabled on this server.");

  const inr = Number(req.body?.inr);
  if (!Number.isFinite(inr) || inr <= 0 || inr > 100_000_000) throw new HttpError(400, "INR amount is invalid.");
  const seconds = Math.min(Math.max(Number(req.body?.expirySeconds) || 15 * 60, 60), MAX_LINK_SECONDS);
  const methods = Array.isArray(req.body?.methods)
    ? req.body.methods.filter((m: unknown) => typeof m === "string" && m.length <= 40).slice(0, 12)
    : [];
  const t = now();
  const usdc = (inr / INR_PER_USDC).toFixed(6);

  const request: WirePayload = {
    v: 1,
    c: CHAIN_ID,
    s: settlementRecord().address,
    r: {
      merchant: DEMO_MERCHANT,
      token: USDC,
      amount: parseUnits(usdc, 6).toString(),
      nonce: `0x${crypto.randomBytes(32).toString("hex")}`,
      expiry: String(t + seconds),
      ensName: "",
    },
    g: "0x",
  };

  const link: LinkRecord = {
    id: `plink_demo_${crypto.randomBytes(6).toString("hex")}`,
    merchant: DEMO_MERCHANT,
    request,
    inr,
    usdc,
    description: String(req.body?.description ?? "").slice(0, 200),
    methods: methods.length ? methods : ["UPI", "Credit Card", "Debit Card", "Net Banking", "Digital Wallets", "NFC / Contactless", "Cryptocurrency"],
    customer: sanitizeCustomer(req.body?.customer),
    requireBillingAddress: false,
    createdAt: t,
    expiresAt: t + seconds,
    status: "open",
    demo: true,
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
  await reconcile(link);
  res.json({ link: view(link, publicBaseUrl(req)) });
}));

app.get("/api/links/:id/nfc", ah(async (req, res) => {
  const link = findLink(req.params.id);
  if (!link) throw new HttpError(404, "Payment link not found.");
  if (link.status !== "open" && link.status !== "paid") throw new HttpError(410, "Payment link is no longer active.");
  res.json({ payload: JSON.stringify(link.request), link: view(link, publicBaseUrl(req)) });
}));

/** Demo-only settlement: flips a server demo link to paid without touching a chain. Idempotent. */
app.post("/api/links/:id/simulate", ah(async (req, res) => {
  if (!DEMO_MODE) throw new HttpError(404, "Demo settlement is disabled on this server.");
  const link = findLink(req.params.id);
  if (!link || !link.demo) throw new HttpError(404, "Demo link not found.");
  expireIfLate(link);
  if (link.status !== "open" && link.status !== "paid") {
    throw new HttpError(409, `This demo link is ${link.status}.`);
  }
  if (link.status !== "paid") {
    updateLink(link.id, {
      status: "paid",
      paidWithEth: false,
      payer: DEMO_MERCHANT,
      method: typeof req.body?.method === "string" ? String(req.body.method).slice(0, 40) : link.method ?? "UPI",
    });
  }
  res.json({ link: view(link, publicBaseUrl(req)) });
}));

app.post("/api/links/:id/settle", ah(async (req, res) => {
  const link = findLink(req.params.id);
  if (!link) throw new HttpError(404, "Payment link not found.");
  const txHash = String(req.body?.txHash ?? "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new HttpError(400, "txHash is invalid.");

  if (link.status !== "paid") {
    let verified: { payer: Address; paidWithEth: boolean };
    try {
      verified = await verifySettlementTx(txHash as Hex, link);
    } catch (e: any) {
      // A missing/pending receipt is a client-visible problem, not a server crash.
      throw new HttpError(400, e?.shortMessage ?? e?.message ?? "That transaction could not be verified.");
    }
    updateLink(link.id, {
      status: "paid",
      txHash: txHash as Hex,
      payer: verified.payer,
      paidWithEth: verified.paidWithEth,
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
  updateLink(link.id, { status: "cancelled" });
  res.json({ link: view(link, publicBaseUrl(req)) });
}));

/* ── merchant helpers ───────────────────────────────────────────────── */

app.get("/api/merchant/:address/balance", ah(async (req, res) => {
  const address = req.params.address;
  if (!isAddress(address)) throw new HttpError(400, "Address is invalid.");
  const balance = await usdcBalance(address as Address);
  res.json({ balance: balance.toString(), decimals: 6 });
}));

/* ── deploy / adopt a settlement contract ───────────────────────────── */

app.post("/api/admin/settlement", ah(async (req, res) => {
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

  if (!(await isContract(getAddress(address)))) {
    throw new HttpError(400, "That address has no contract code on Base Sepolia.");
  }
  try {
    await verifySettlementContract(getAddress(address), { usdc: USDC, weth: WETH, poolFee: POOL_FEE });
  } catch (e: any) {
    throw new HttpError(400, e?.message ?? "That contract does not look like PaymentSettlement.");
  }

  const current = settlementRecord();
  if (current.deployer && !isAddressEqual(current.deployer, getAddress(deployer))) {
    throw new HttpError(403, "This deployment is owned by a different merchant wallet.");
  }

  saveSettlement({ address: getAddress(address), deployer: getAddress(deployer), setAt: now() });
  res.json(configPayload());
}));

/* ── static app (Vite middleware in dev, dist in prod) ──────────────── */

async function main() {
  if (process.env.NODE_ENV === "production") {
    const dist = path.resolve(process.cwd(), "dist");
    app.use(express.static(dist, { index: false }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(dist, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err?.shortMessage ?? err?.message ?? "Server error" });
  });

  app.listen(PORT, () => {
    const s = settlementRecord();
    console.log(`PayFlux on http://localhost:${PORT}`);
    console.log(`settlement: ${s.address}${isDeployed(s.address) ? "" : " (not deployed)"}`);
  });
}

void main();
