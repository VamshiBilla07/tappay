const VPA_RE = /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/;
const LINK_RE = /^\/pay\/(plink_[A-Za-z0-9_-]+)\/?$/;

export function parseUpiUri(raw) {
  if (!/^upi:/i.test(raw)) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const q = url.searchParams;
  const payee = (q.get("pa") || "").trim();
  if (!VPA_RE.test(payee)) return null;

  const am = q.get("am");
  const amount = am == null || am === "" ? null : Number(am);
  return {
    kind: "upi",
    raw,
    payee,
    name: (q.get("pn") || payee).trim().slice(0, 80),
    amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null,
    currency: (q.get("cu") || "INR").toUpperCase(),
    note: (q.get("tn") || "").trim().slice(0, 140),
  };
}

export function parsePayLink(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const match = url.pathname.match(LINK_RE);
  if (!match) return null;
  return {
    kind: "tapay",
    raw,
    url: url.toString(),
    linkId: match[1],
    demo: url.searchParams.get("demo") === "1",
  };
}

function parseSignedPayload(raw) {
  if (!raw.startsWith("{")) return null;
  try {
    const payload = JSON.parse(raw);
    if (payload && payload.v === 1 && payload.r && typeof payload.s === "string" && typeof payload.g === "string") {
      return { kind: "signed", raw, payload };
    }
  } catch {
    /* not JSON */
  }
  return null;
}

function parseWebUrl(raw) {
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    return { kind: "url", raw, url: url.toString(), host: url.host };
  } catch {
    return null;
  }
}

/**
 * Turn a QR / NFC / pasted string into a payment intent.
 * Order matters: UPI first, then a TapPay pay link, then a signed payload,
 * then any other web URL, then plain text.
 */
export function parseScan(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return { kind: "empty" };
  return (
    parseUpiUri(raw) ||
    parsePayLink(raw) ||
    parseSignedPayload(raw) ||
    parseWebUrl(raw) || { kind: "text", raw: raw.slice(0, 500) }
  );
}

export function isPaymentIntent(intent) {
  return Boolean(intent) && !["empty", "text"].includes(intent.kind);
}
