/**
 * API lifecycle smoke test (no chain writes). Starts the real server with a
 * stubbed settlement address, then exercises create → read → NFC → settle →
 * cancel entirely over HTTP, signing with viem exactly like the browser does.
 *
 *   npx tsx scripts/api-smoke.ts
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { domain, encode, randomNonce, types, USDC } from "@pos/shared";
import { decode, verifyRequest } from "@pos/shared";

const PORT = 3187;
const SETTLEMENT = "0x000000000000000000000000000000000000dEaD" as const;
const BASE = `http://127.0.0.1:${PORT}`;
const merchant = privateKeyToAccount(generatePrivateKey());
const impostor = privateKeyToAccount(generatePrivateKey());

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${ok ? "" : ` :: ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: body as any };
}

async function signedLink(inr = 850, methods = ["UPI", "Credit Card"]) {
  const now = Math.floor(Date.now() / 1000);
  const req = {
    merchant: merchant.address,
    token: USDC,
    amount: BigInt(Math.round((inr / 85) * 1e6)),
    nonce: randomNonce(),
    expiry: BigInt(now + 3600),
    ensName: "",
  };
  const sig = await merchant.signTypedData({
    domain: domain(SETTLEMENT),
    types,
    primaryType: "PaymentRequest",
    message: req,
  });
  return { payload: JSON.parse(encode({ req, sig }, SETTLEMENT)), req, sig };
}

async function main() {
  const server = spawn("npx", ["tsx", "server/index.ts"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      SETTLEMENT_ADDRESS: SETTLEMENT,
      DATA_DIR: "/tmp/opencode/payflux-smoke",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

  try {
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      await sleep(300);
      try {
        up = (await api("/api/health")).status === 200;
      } catch {
        /* keep waiting */
      }
    }
    if (!up) throw new Error("server did not start");

    const cfg = await api("/api/config");
    check("config adopts SETTLEMENT_ADDRESS", cfg.body.settlement?.toLowerCase() === SETTLEMENT.toLowerCase());
    check("config reports deployed", cfg.body.deployed === true);

    const badMethod = await api("/api/links", {
      method: "POST",
      body: JSON.stringify({ payload: {}, inr: 100 }),
    });
    check("rejects an empty payload", badMethod.status === 400, badMethod);

    const mismatched = await signedLink(850);
    const mismatch = await api("/api/links", {
      method: "POST",
      body: JSON.stringify({ payload: mismatched.payload, inr: 5000 }),
    });
    check("rejects INR/USDC mismatch", mismatch.status === 400, mismatch);

    const { payload } = await signedLink(850, ["UPI", "Credit Card", "NFC / Contactless"]);
    const created = await api("/api/links", {
      method: "POST",
      body: JSON.stringify({
        payload,
        inr: 850,
        description: "Smoke test order",
        methods: ["UPI", "Credit Card", "NFC / Contactless"],
        customer: { name: "Smoke Tester", email: "smoke@example.com" },
      }),
    });
    check("creates a signed link", created.status === 201, created);
    const link = created.body.link;
    check("link has a hosted URL", typeof link?.url === "string" && link.url.endsWith(`/pay/${link.id}`), link?.url);
    check("link stores 3 methods", link?.methods?.length === 3, link?.methods);

    const dup = await api("/api/links", {
      method: "POST",
      body: JSON.stringify({ payload, inr: 850 }),
    });
    check("rejects a reused nonce", dup.status === 409, dup);

    const read = await api(`/api/links/${link.id}`);
    check("reads the link back", read.body.link?.id === link.id);
    check("status is open", read.body.link?.status === "open");

    // Exactly what the hosted checkout does before unlocking the pay button.
    const decoded = decode(JSON.stringify(read.body.link.request));
    const verdict = await verifyRequest(decoded, Math.floor(Date.now() / 1000), {
      expectedSettlement: SETTLEMENT,
      requireEns: false,
    });
    check("checkout verification passes all 5 mandatory checks", verdict.ok, verdict);
    check("blank ENS skips only the ENS checks", verdict.ensSkipped === true, verdict);

    const tampered = { ...decoded, req: { ...decoded.req, amount: decoded.req.amount + 1n } };
    const tamperVerdict = await verifyRequest(tampered, Math.floor(Date.now() / 1000), {
      expectedSettlement: SETTLEMENT,
      requireEns: false,
    });
    check("tampered amount fails signature", tamperVerdict.ok === false && tamperVerdict.checks.signature === false, tamperVerdict);

    const wrongContract = await verifyRequest(decoded, Math.floor(Date.now() / 1000), {
      expectedSettlement: "0x0000000000000000000000000000000000000001",
      requireEns: false,
    });
    check("wrong settlement contract fails", wrongContract.ok === false && wrongContract.checks.contract === false, wrongContract);

    const list = await api(`/api/links?merchant=${merchant.address}`);
    check("lists by merchant", list.body.links?.some((l: any) => l.id === link.id));

    const nfc = await api(`/api/links/${link.id}/nfc`);
    const parsed = JSON.parse(nfc.body.payload ?? "{}");
    check("NFC payload carries the signed request", parsed.r?.nonce?.toLowerCase() === payload.r.nonce.toLowerCase());

    const bogus = await api(`/api/links/${link.id}/settle`, {
      method: "POST",
      body: JSON.stringify({ txHash: `0x${"ab".repeat(32)}` }),
    });
    check("rejects an unknown tx hash with 400", bogus.status === 400, bogus);

    const wrongSig = await impostor.signMessage({ message: `Cancel PayFlux payment link ${link.id}` });
    const unauth = await api(`/api/links/${link.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled", merchant: impostor.address, signature: wrongSig }),
    });
    check("rejects a cancel signed by another wallet", unauth.status === 401, unauth);

    const sig = await merchant.signMessage({ message: `Cancel PayFlux payment link ${link.id}` });
    const cancelled = await api(`/api/links/${link.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled", merchant: merchant.address, signature: sig }),
    });
    check("cancels with the merchant signature", cancelled.body.link?.status === "cancelled", cancelled);

    const afterCancel = await api(`/api/links/${link.id}/nfc`);
    check("cancelled link stops serving NFC", afterCancel.status === 410, afterCancel);

    const balance = await api(`/api/merchant/${merchant.address}/balance`);
    check("balance endpoint answers", balance.status === 200 && "balance" in balance.body, balance);
  } finally {
    server.kill("SIGTERM");
  }

  console.log(failures === 0 ? "\nall smoke checks passed" : `\n${failures} smoke check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
