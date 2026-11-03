import { useState } from "react";
import { Eye, EyeOff, Landmark, Plus, Star } from "lucide-react";
import { Card, Skeleton } from "./ui";
import Sheet from "./Sheet";
import { inr } from "../data";

const START = [
  { id: "hdfc", name: "HDFC Bank", last4: "4821", balance: 42310 },
  { id: "sbi", name: "SBI", last4: "1093", balance: 18940 },
];

export default function Accounts({ show, setShow, toast, loading }) {
  const [accounts, setAccounts] = useState(START);
  const [primary, setPrimary] = useState("hdfc");
  const [sheet, setSheet] = useState(null); // "manage" | "add" | null
  const [bank, setBank] = useState("");
  const [last4, setLast4] = useState("");
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");

  const mask = (v) => (show ? inr(v) : "••••");

  const addAccount = (event) => {
    event.preventDefault();
    const name = bank.trim();
    const digits = last4.trim();
    if (!name) {
      setError("Enter a bank name.");
      return;
    }
    if (!/^\d{4}$/.test(digits)) {
      setError("Enter the last 4 digits of the account.");
      return;
    }
    const value = Number(opening);
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter an opening balance (0 is fine).");
      return;
    }
    const account = { id: `${name.toLowerCase().replace(/\W+/g, "")}-${digits}`, name, last4: digits, balance: value };
    setAccounts((current) => [...current, account]);
    setSheet(null);
    setBank("");
    setLast4("");
    setOpening("");
    setError("");
    toast(`${name} ••${digits} added`);
  };

  return (
    <Card title="Accounts and wallet" right={
      <button className="chip" aria-pressed={show} onClick={() => setShow(!show)}>{show ? <Eye size={16} /> : <EyeOff size={16} />}{show ? "Hide" : "Show"}</button>}>
      {loading ? <div className="grid gap-3"><Skeleton h={84} /><Skeleton h={56} /><Skeleton h={56} /></div> : (
        <div>
          <div className="gcard">
            <div className="flex justify-between text-[13px] opacity-90"><span>Google Pay balance</span><span className="font-bold tracking-wider">VISA</span></div>
            <div className="text-[28px] font-medium">{show ? inr(8450.5) : "₹ •••••"}</div>
          </div>
          {accounts.map((a) => (
            <div key={a.id} className="row">
              <div className="av" style={{ background: "var(--prbg)", color: "var(--pr)" }}><Landmark size={18} /></div>
              <div className="flex-1 min-w-0"><div className="text-sm truncate">{a.name} ••{a.last4}</div><div className="mu text-xs">{mask(a.balance)}</div></div>
              {primary === a.id
                ? <span className="tag ok">Primary</span>
                : <button className="chip" onClick={() => { setPrimary(a.id); toast(`${a.name} ••${a.last4} set as primary`); }}>Set primary</button>}
            </div>
          ))}
          <div className="row">
            <div className="av" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>L</div>
            <div className="flex-1"><div className="text-sm">UPI Lite</div><div className="mu text-xs">{mask(350)}</div></div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="btn btn2" onClick={() => setSheet("manage")}>Manage cards</button>
            <button className="btn btn2" onClick={() => setSheet("manage")}>Set primary</button>
            <button className="btn" onClick={() => setSheet("add")}><Plus size={15} /> Add</button>
          </div>
        </div>
      )}

      {sheet === "manage" && (
        <Sheet title="Linked accounts" subtitle="Choose the account TapPay debits first" onClose={() => setSheet(null)}>
          <div className="grid gap-1">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                className="row text-left"
                aria-pressed={primary === a.id}
                onClick={() => { setPrimary(a.id); toast(`${a.name} ••${a.last4} set as primary`); }}
                style={primary === a.id ? { background: "var(--prbg)" } : undefined}
              >
                <div className="av" style={{ background: "var(--prbg)", color: "var(--pr)" }}><Landmark size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{a.name} ••{a.last4}</div>
                  <div className="mu text-xs">{inr(a.balance)} available</div>
                </div>
                {primary === a.id ? <Star size={17} style={{ color: "var(--pr)" }} /> : <span className="mu text-xs">Set primary</span>}
              </button>
            ))}
          </div>
          <p className="mu text-[11px] mt-3 mb-0">
            Sample accounts — TapPay never debits a bank in this build. Card and bank rails route through
            the merchant&apos;s testnet settlement instead.
          </p>
          <button type="button" className="btn w-full mt-3" onClick={() => setSheet(null)}>Done</button>
        </Sheet>
      )}

      {sheet === "add" && (
        <Sheet title="Add account" subtitle="Link a bank account for UPI" onClose={() => setSheet(null)}>
          <form onSubmit={addAccount} className="grid gap-3">
            <label className="block">
              <span className="mu text-xs block mb-1">Bank name</span>
              <input
                className="w-full h-11 rounded-xl px-3 text-sm"
                style={{ background: "var(--sf2)", border: "1px solid var(--ln)", color: "var(--tx)" }}
                value={bank}
                onChange={(e) => { setBank(e.target.value); setError(""); }}
                placeholder="ICICI Bank"
                autoFocus
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mu text-xs block mb-1">Last 4 digits</span>
                <input
                  className="w-full h-11 rounded-xl px-3 text-sm"
                  style={{ background: "var(--sf2)", border: "1px solid var(--ln)", color: "var(--tx)" }}
                  value={last4}
                  onChange={(e) => { setLast4(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
                  placeholder="0123"
                  inputMode="numeric"
                />
              </label>
              <label className="block">
                <span className="mu text-xs block mb-1">Balance</span>
                <input
                  className="w-full h-11 rounded-xl px-3 text-sm"
                  style={{ background: "var(--sf2)", border: "1px solid var(--ln)", color: "var(--tx)" }}
                  value={opening}
                  onChange={(e) => { setOpening(e.target.value); setError(""); }}
                  placeholder="0"
                  inputMode="decimal"
                />
              </label>
            </div>
            {error && <p className="text-xs m-0" style={{ color: "var(--rd)" }}>{error}</p>}
            <button type="submit" className="btn w-full"><Plus size={15} /> Add account</button>
            <p className="mu text-[11px] text-center m-0">
              Sample data for the demo — nothing is sent to a bank.
            </p>
          </form>
        </Sheet>
      )}
    </Card>
  );
}
