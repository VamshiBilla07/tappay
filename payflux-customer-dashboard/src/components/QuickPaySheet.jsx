import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck, CheckCircle2, Landmark, Loader2, Receipt, Send, Smartphone, User,
} from "lucide-react";
import Sheet from "./Sheet";
import { BILLS, inr } from "../data";

const CONTACTS = [
  { name: "Aarav Sharma", vpa: "aarav@okhdfcbank" },
  { name: "Priya Nair", vpa: "priya@oksbi" },
  { name: "Kabir Singh", vpa: "kabir@okaxis" },
];

const VPA_RE = /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const COPY = {
  contact: { title: "Pay contact", subtitle: "Send to a saved UPI contact" },
  number: { title: "Pay number", subtitle: "Pay any UPI ID" },
  bank: { title: "Bank transfer", subtitle: "IMPS / NEFT to a bank account" },
  bill: { title: "Pay bills", subtitle: "Electricity, mobile and card bills" },
  split: { title: "Split / request", subtitle: "Request money from friends" },
};

function AmountField({ value, onChange, autoFocus = false }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 h-14" style={{ background: "var(--sf2)", border: "1px solid var(--ln)" }}>
      <span className="text-xl" style={{ color: "var(--mu)" }}>₹</span>
      <input
        className="s text-xl font-semibold"
        type="number"
        inputMode="decimal"
        min="1"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0.00"
        autoFocus={autoFocus}
        aria-label="Amount"
      />
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="mu text-xs block mb-1">{label}</span>
      <input
        {...props}
        className="w-full h-11 rounded-xl px-3 text-sm"
        style={{ background: "var(--sf2)", border: "1px solid var(--ln)", color: "var(--tx)" }}
      />
    </label>
  );
}

export default function QuickPaySheet({ mode = "contact", presetBill, onClose, onComplete, onRequest }) {
  const copy = COPY[mode] || COPY.contact;
  const initialBill = presetBill || BILLS[0];

  const [contact, setContact] = useState(CONTACTS[0]);
  const [vpa, setVpa] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bill, setBill] = useState(initialBill);
  const [amount, setAmount] = useState(mode === "bill" ? String(initialBill.a) : "");
  const [selected, setSelected] = useState([CONTACTS[0].name]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = Number(amount);
  const validAmount = Number.isFinite(value) && value > 0;

  const run = (payload) => {
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setBusy(false);
      setDone(true);
      payload.request ? onRequest?.(payload.request) : onComplete?.(payload.payment);
    }, 950);
  };

  const submit = (event) => {
    event.preventDefault();
    if (busy || done) return;
    setError("");
    if (!validAmount) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (mode === "contact") {
      run({ payment: { name: contact.name, vpa: contact.vpa, amount: value, meta: `UPI · ${contact.vpa}`, method: "UPI" } });
      return;
    }
    if (mode === "number") {
      if (!VPA_RE.test(vpa.trim())) {
        setError("Enter a valid UPI ID, for example name@bank.");
        return;
      }
      run({ payment: { name: vpa.trim(), vpa: vpa.trim(), amount: value, meta: `UPI · ${vpa.trim()}`, method: "UPI" } });
      return;
    }
    if (mode === "bank") {
      if (!accountName.trim()) { setError("Enter the account holder name."); return; }
      if (!/^\d{9,18}$/.test(accountNumber.trim())) { setError("Enter a 9–18 digit account number."); return; }
      if (!IFSC_RE.test(ifsc.trim().toUpperCase())) { setError("Enter a valid IFSC code, for example HDFC0001234."); return; }
      run({
        payment: {
          name: accountName.trim(),
          amount: value,
          meta: `Bank · A/C ••${accountNumber.trim().slice(-4)}`,
          method: "Bank transfer",
        },
      });
      return;
    }
    if (mode === "bill") {
      run({ payment: { name: bill.n, amount: value, meta: `Bill · ${bill.n}`, method: "Bill payment" } });
      return;
    }
    if (mode === "split") {
      if (!selected.length) { setError("Choose at least one person."); return; }
      run({ request: { amount: value, people: selected.length, names: selected, note: note.trim() } });
    }
  };

  if (done) {
    return (
      <Sheet
        title={mode === "split" ? "Request sent" : "Payment recorded"}
        subtitle="Demo settlement"
        onClose={onClose}
      >
        <div className="text-center py-6">
          <CheckCircle2 size={54} className="mx-auto" style={{ color: "var(--gn)" }} />
          <div className="text-lg font-semibold mt-3">
            {mode === "split"
              ? `${inr(value)} requested from ${selected.length} ${selected.length === 1 ? "person" : "people"}`
              : `${inr(value)} to ${mode === "bank" ? accountName : mode === "bill" ? bill.n : mode === "number" ? vpa : contact.name}`}
          </div>
          <div className="rounded-xl p-3 mt-4 text-xs text-left" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>
            Demo only — no money moved. The entry was added to Recent activity so you can see the
            full flow.
          </div>
          <button type="button" className="btn w-full mt-4" onClick={onClose}>Done</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={copy.title} subtitle={copy.subtitle} onClose={onClose}>
      <form onSubmit={submit}>
        {mode === "contact" && (
          <div className="grid gap-1">
            {CONTACTS.map((item) => (
              <button
                key={item.vpa}
                type="button"
                className="row text-left"
                aria-pressed={contact.vpa === item.vpa}
                onClick={() => setContact(item)}
                style={contact.vpa === item.vpa ? { background: "var(--prbg)" } : undefined}
              >
                <div className="av" style={{ background: "var(--pr)" }}>{item.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="mu text-xs truncate">{item.vpa}</div>
                </div>
                {contact.vpa === item.vpa && <BadgeCheck size={18} style={{ color: "var(--pr)" }} />}
              </button>
            ))}
          </div>
        )}

        {mode === "number" && (
          <div className="flex items-center gap-3 rounded-xl p-3 mb-3" style={{ background: "var(--sf2)" }}>
            <Smartphone size={20} style={{ color: "var(--pr)" }} />
            <div className="flex-1">
              <Field
                label="UPI ID"
                value={vpa}
                onChange={(event) => { setVpa(event.target.value); setError(""); }}
                placeholder="name@bank"
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>
        )}

        {mode === "bank" && (
          <div className="grid gap-3 mb-3">
            <Field label="Account holder" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Full name" />
            <Field label="Account number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="9–18 digits" inputMode="numeric" />
            <Field label="IFSC" value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase())} placeholder="HDFC0001234" autoCapitalize="characters" />
          </div>
        )}

        {mode === "bill" && (
          <div className="grid gap-1 mb-3">
            {BILLS.map((item) => (
              <button
                key={item.n}
                type="button"
                className="row text-left"
                aria-pressed={bill.n === item.n}
                onClick={() => { setBill(item); setAmount(String(item.a)); }}
                style={bill.n === item.n ? { background: "var(--prbg)" } : undefined}
              >
                <div className="av" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>
                  <Receipt size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{item.n}</div>
                  <div className="mu text-xs">{item.due}</div>
                </div>
                <div className="font-medium">{inr(item.a)}</div>
              </button>
            ))}
          </div>
        )}

        {mode === "split" && (
          <div className="grid gap-1 mb-3">
            {CONTACTS.map((item) => {
              const checked = selected.includes(item.name);
              return (
                <button
                  key={item.vpa}
                  type="button"
                  className="row text-left"
                  aria-pressed={checked}
                  onClick={() => setSelected((current) => checked ? current.filter((name) => name !== item.name) : [...current, item.name])}
                  style={checked ? { background: "var(--prbg)" } : undefined}
                >
                  <div className="av" style={{ background: checked ? "var(--pr)" : "var(--sf2)", color: checked ? "#fff" : "var(--mu)" }}>
                    {item.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="mu text-xs">{item.vpa}</div>
                  </div>
                  {checked && <CheckCircle2 size={18} style={{ color: "var(--pr)" }} />}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <div className="mu text-xs mb-1">{mode === "split" ? "Amount per person" : "Amount"}</div>
          <AmountField value={amount} onChange={(next) => { setAmount(next); setError(""); }} autoFocus={mode !== "number"} />
        </div>

        {mode === "split" && (
          <label className="block mt-3">
            <span className="mu text-xs block mb-1">Note (optional)</span>
            <input
              className="w-full h-11 rounded-xl px-3 text-sm"
              style={{ background: "var(--sf2)", border: "1px solid var(--ln)", color: "var(--tx)" }}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Dinner split"
            />
          </label>
        )}

        {error && <p className="text-xs mt-2" style={{ color: "var(--rd)" }}>{error}</p>}

        <button type="submit" className="btn w-full mt-4" disabled={busy || !validAmount}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : mode === "split" ? <Send size={16} /> : mode === "bank" ? <Landmark size={16} /> : mode === "bill" ? <Receipt size={16} /> : mode === "number" ? <Smartphone size={16} /> : <User size={16} />}
          {busy ? "Processing…" : mode === "split" ? `Request ${validAmount ? inr(value) : ""}` : `Pay ${validAmount ? inr(value) : ""}`}
        </button>

        <p className="mu text-[11px] text-center mt-3 mb-0">
          Demo mode — no real money moves. TapPay settles USDC on Base Sepolia.
        </p>
      </form>
    </Sheet>
  );
}
