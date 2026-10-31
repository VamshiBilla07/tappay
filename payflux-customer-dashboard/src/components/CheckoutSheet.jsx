import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, BadgeCheck, CheckCircle2, Clock, Copy, ExternalLink, Loader2,
  ShieldCheck, Smartphone, TriangleAlert,
} from "lucide-react";
import Sheet from "./Sheet";
import { fetchPaymentLink, simulatePaymentLink } from "../lib/api";
import { inr } from "../data";

const shortAddress = (value) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "");

const STATUS_COPY = {
  open: { label: "Open", className: "ok" },
  paid: { label: "Paid", className: "ok" },
  expired: { label: "Expired", className: "bad" },
  cancelled: { label: "Cancelled", className: "bad" },
};

function TapayCheckout({ intent, onClose, onPaid }) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    fetchPaymentLink(intent.linkId, { signal: controller.signal })
      .then((body) => {
        if (!cancelled) setLink(body.link);
      })
      .catch((err) => {
        if (!cancelled && err?.name !== "AbortError") {
          setLoadError(err?.message || "Could not load the request details.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [intent.linkId]);

  const status = STATUS_COPY[link?.status] || null;
  const target = intent.url || link?.url;
  const host = (() => {
    try {
      return new URL(intent.url).host;
    } catch {
      return "payment link";
    }
  })();
  const demo = Boolean(link?.demo) || intent.demo || intent.linkId.startsWith("plink_demo_");
  const isOpen = link?.status === "open";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const openCheckout = () => {
    if (!target) return;
    window.location.assign(target);
  };

  const payDemo = async () => {
    if (!link || paying || !isOpen) return;
    setPaying(true);
    setPayError("");
    try {
      const body = await simulatePaymentLink(intent.linkId, link.methods?.[0] || "UPI");
      setLink(body.link);
      setPaid(true);
      onPaid?.({
        name: link.description || "TapPay merchant",
        amount: link.inr,
        meta: `TapPay · ${link.methods?.[0] || "UPI"} · demo`,
        method: link.methods?.[0] || "UPI",
      });
    } catch (err) {
      setPayError(err?.message || "Could not record the demo payment.");
    } finally {
      setPaying(false);
    }
  };

  if (paid) {
    return (
      <Sheet title="Payment complete" subtitle="Demo settlement" onClose={onClose}>
        <div className="text-center py-6">
          <CheckCircle2 size={54} className="mx-auto" style={{ color: "var(--gn)" }} />
          <div className="text-lg font-semibold mt-3">
            {link ? `${inr(link.inr)} to merchant` : "Payment recorded"}
          </div>
          <div className="mu text-sm mt-1">{link?.description || "TapPay demo request"}</div>
          <div className="rounded-xl p-3 mt-4 text-xs text-left" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>
            Demo only — the server marked this demo link paid for both devices. No funds moved
            and no on-chain transaction was sent.
          </div>
          <button type="button" className="btn w-full mt-4" onClick={onClose}>Done</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Payment request"
      subtitle={link?.description || "TapPay secure checkout"}
      onClose={onClose}
    >
      {loading ? (
        <div className="grid gap-3">
          <div className="sk h-28" />
          <div className="sk h-12" />
          <div className="sk h-12" />
        </div>
      ) : (
        <>
          <div className="rounded-2xl p-5 text-center" style={{ background: link ? "var(--prbg)" : "var(--ylbg)" }}>
            {link ? (
              <>
                <div className="mu text-xs">Amount requested</div>
                <div className="text-[34px] font-semibold leading-tight" style={{ color: "var(--tx)" }}>
                  {inr(link.inr)}
                </div>
                <div className="mu text-xs">
                  {Number(link.usdc).toFixed(2)} USDC · Base Sepolia
                </div>
              </>
            ) : (
              <>
                <TriangleAlert size={22} className="mx-auto" style={{ color: "var(--yl)" }} />
                <div className="text-sm font-semibold mt-2">Request details unavailable</div>
                <div className="mu text-xs mt-1">
                  Open the link to see the amount and pay on the secure checkout.
                </div>
              </>
            )}
          </div>

          <div className="grid gap-1 mt-4">
            <div className="row">
              <div className="av" style={{ background: "var(--prbg)", color: "var(--pr)" }}>
                <Smartphone size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Merchant</div>
                <div className="mu text-xs truncate">
                  {link ? shortAddress(link.merchant) : host}
                  {link?.request?.r?.ensName ? ` · ${link.request.r.ensName}` : ""}
                </div>
              </div>
              {status && <span className={`tag ${status.className}`}>{status.label}</span>}
              {demo && <span className="tag" style={{ background: "var(--prbg)", color: "var(--pr)" }}>Demo</span>}
            </div>
            {link && (
              <div className="row">
                <Clock size={18} style={{ color: "var(--mu)", flex: "none" }} />
                <div className="flex-1">
                  <div className="text-sm">Expires</div>
                  <div className="mu text-xs">
                    {new Date(link.expiresAt * 1000).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {loadError && (
            <div className="rounded-xl p-3 mt-3 text-xs flex gap-2" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>
              <TriangleAlert size={15} style={{ flex: "none", marginTop: 1 }} />
              <span>
                {loadError}{" "}
                {intent.linkId.startsWith("plink_demo_")
                  ? "This demo link was created in the merchant browser and is not on the server. Create a new demo link so both phones can resolve it."
                  : "You can still open the link below."}
              </span>
            </div>
          )}

          <div className="rounded-xl p-3 mt-3 text-xs flex gap-2" style={{ background: "var(--sf2)", color: "var(--mu)" }}>
            <ShieldCheck size={15} style={{ flex: "none", marginTop: 1 }} />
            <span>
              {demo
                ? "This is a server-backed demo request. Recording it marks the link paid on the server; no signature or on-chain settlement is involved."
                : "TapPay verifies the merchant signature, ENS name, chain, contract and token before you pay. Payment runs on Base Sepolia testnet."}
            </span>
          </div>

          {payError && <p className="text-xs mt-2" style={{ color: "var(--rd)" }}>{payError}</p>}

          {demo ? (
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn btn2 inline-flex items-center justify-center gap-2" onClick={copy} aria-label="Copy payment link">
                <Copy size={15} /> {copied ? "Copied" : "Copy"}
              </button>
              {link && isOpen ? (
                <button type="button" className="btn flex-1" onClick={payDemo} disabled={paying}>
                  {paying ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
                  {paying ? "Recording…" : `Pay ${inr(link.inr)} · demo`}
                </button>
              ) : (
                <button type="button" className="btn flex-1" onClick={onClose}>Done</button>
              )}
            </div>
          ) : (
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn btn2 inline-flex items-center justify-center gap-2" onClick={copy} aria-label="Copy payment link">
                <Copy size={15} /> {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" className="btn flex-1" onClick={openCheckout} disabled={!target}>
                {link?.status === "paid" ? "View receipt" : "Continue to checkout"} <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

function UpiCheckout({ intent, onClose, onPaid }) {
  const fixedAmount = intent.amount != null;
  const [amount, setAmount] = useState(fixedAmount ? String(intent.amount) : "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value > 0;

  const pay = () => {
    if (!valid || busy || done) return;
    setError("");
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setBusy(false);
      setDone(true);
      onPaid?.({
        name: intent.name,
        vpa: intent.payee,
        amount: value,
        note: intent.note,
        method: "UPI",
      });
    }, 1100);
  };

  if (done) {
    return (
      <Sheet title="Payment recorded" subtitle="Demo settlement" onClose={onClose}>
        <div className="text-center py-6">
          <CheckCircle2 size={54} className="mx-auto" style={{ color: "var(--gn)" }} />
          <div className="text-lg font-semibold mt-3">
            {inr(value)} to {intent.name}
          </div>
          <div className="mu text-sm mt-1">{intent.payee}</div>
          <div className="rounded-xl p-3 mt-4 text-xs text-left" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>
            Demo only — no money left your account and no on-chain transaction was sent. The
            payment was added to Recent activity.
          </div>
          <button type="button" className="btn w-full mt-4" onClick={onClose}>Done</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="UPI payment" subtitle="Scanned UPI code" onClose={onClose}>
      <div className="flex items-center gap-3">
        <div className="av" style={{ background: "var(--pr)", width: 48, height: 48, fontSize: 18 }}>
          {intent.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">{intent.name}</div>
          <div className="mu text-xs truncate">{intent.payee}</div>
        </div>
        <span className="tag" style={{ background: "var(--prbg)", color: "var(--pr)", marginLeft: "auto" }}>UPI</span>
      </div>

      <div className="mt-4">
        <div className="mu text-xs mb-1">Amount</div>
        {fixedAmount ? (
          <div className="text-[32px] font-semibold">{inr(intent.amount)}</div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl px-3 h-14" style={{ background: "var(--sf2)", border: "1px solid var(--ln)" }}>
            <span className="text-xl" style={{ color: "var(--mu)" }}>₹</span>
            <input
              className="s text-xl font-semibold"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => { setAmount(event.target.value); setError(""); }}
              placeholder="0.00"
              autoFocus
            />
          </div>
        )}
        {error && <p className="text-xs mt-2" style={{ color: "var(--rd)" }}>{error}</p>}
      </div>

      {intent.note && (
        <div className="rounded-xl p-3 mt-3 text-sm" style={{ background: "var(--sf2)" }}>
          <span className="mu text-xs">Note</span>
          <div>{intent.note}</div>
        </div>
      )}

      <div className="rounded-xl p-3 mt-3 text-xs flex gap-2" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>
        <TriangleAlert size={15} style={{ flex: "none", marginTop: 1 }} />
        <span>
          A UPI QR is settled by your bank or UPI app, not by TapPay. &ldquo;Open UPI app&rdquo; hands
          the request to your installed app; the demo button only records it here.
        </span>
      </div>

      <div className="grid gap-2 mt-4">
        <button type="button" className="btn" onClick={pay} disabled={!valid || busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
          {busy ? "Recording…" : valid ? `Record ${inr(value)} · demo` : "Enter an amount"}
        </button>
        <a
          className="btn btn2 flex items-center justify-center gap-2"
          href={intent.raw}
          style={{ textDecoration: "none" }}
        >
          <ExternalLink size={15} /> Open UPI app
        </a>
      </div>
    </Sheet>
  );
}

function SignedCheckout({ intent, onClose }) {
  const payload = intent.payload;
  const amount = Number(payload?.r?.amount) / 1e6;
  return (
    <Sheet title="Signed TapPay request" subtitle="Read from NFC" onClose={onClose}>
      <div className="rounded-2xl p-5 text-center" style={{ background: "var(--prbg)" }}>
        <div className="mu text-xs">Requested amount</div>
        <div className="text-[30px] font-semibold">
          {Number.isFinite(amount) ? `${amount.toFixed(2)} USDC` : "—"}
        </div>
        <div className="mu text-xs">Base Sepolia</div>
      </div>
      <div className="rounded-xl p-3 mt-4 text-xs flex gap-2" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>
        <ShieldCheck size={15} style={{ flex: "none", marginTop: 1 }} />
        <span>
          This tag carries a signed EIP-712 request rather than a link. Open it in the TapPay
          customer app to run the seven verification checks and pay.
        </span>
      </div>
      <div className="mu text-xs mt-3 break-all">{shortAddress(payload?.r?.merchant)}</div>
      <button type="button" className="btn w-full mt-4" onClick={onClose}>Close</button>
    </Sheet>
  );
}

function UrlCheckout({ intent, onClose }) {
  return (
    <Sheet title="Scanned link" subtitle={intent.host} onClose={onClose}>
      <div className="rounded-xl p-3 text-xs break-all" style={{ background: "var(--sf2)", color: "var(--mu)" }}>
        {intent.url}
      </div>
      <p className="mu text-sm mt-3">
        This is a web link, not a TapPay payment request. Open it only if you trust the source.
      </p>
      <a
        className="btn w-full mt-3 flex items-center justify-center gap-2"
        href={intent.url}
        target="_blank"
        rel="noreferrer noopener"
        style={{ textDecoration: "none" }}
      >
        Open link <ExternalLink size={15} />
      </a>
    </Sheet>
  );
}

export default function CheckoutSheet({ intent, onClose, onPaid }) {
  if (!intent) return null;
  if (intent.kind === "tapay") {
    return <TapayCheckout intent={intent} onClose={onClose} onPaid={onPaid} />;
  }
  if (intent.kind === "upi") {
    return <UpiCheckout intent={intent} onClose={onClose} onPaid={onPaid} />;
  }
  if (intent.kind === "signed") {
    return <SignedCheckout intent={intent} onClose={onClose} />;
  }
  if (intent.kind === "url") {
    return <UrlCheckout intent={intent} onClose={onClose} />;
  }
  return (
    <Sheet title="Not a payment code" subtitle="Scan result" onClose={onClose}>
      <div className="rounded-xl p-3 text-xs break-all" style={{ background: "var(--sf2)", color: "var(--mu)" }}>
        {intent.raw}
      </div>
      <button type="button" className="btn w-full mt-4" onClick={onClose}>Close</button>
    </Sheet>
  );
}
