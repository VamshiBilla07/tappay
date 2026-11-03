import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Actions from "./components/Actions";
import Accounts from "./components/Accounts";
import Transactions from "./components/Transactions";
import Bills from "./components/Bills";
import Spend from "./components/Spend";
import Rewards from "./components/Rewards";
import Security from "./components/Security";
import ScannerModal from "./components/ScannerModal";
import CheckoutSheet from "./components/CheckoutSheet";
import QuickPaySheet from "./components/QuickPaySheet";
import { TX, inr } from "./data";

export default function App() {
  const [dark, setDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const [show, setShow] = useState(true);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [scanTab, setScanTab] = useState(null);
  const [intent, setIntent] = useState(null);
  const [quick, setQuick] = useState(null);
  const [items, setItems] = useState(TX);
  const timer = useRef();

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 1200); return () => clearTimeout(t); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const toast = useCallback((m) => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(""), 2200); }, []);

  const addPayment = useCallback((payment) => {
    const amount = Math.round(Number(payment?.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return;
    setItems((current) => [{
      n: payment.name || "Merchant",
      t: "m",
      d: "Just now",
      b: payment.meta || (payment.vpa ? `UPI · ${payment.vpa}` : `TapPay · ${payment.method || "payment"}`),
      a: -amount,
      s: "Success",
      c: "#1a73e8",
      demo: true,
    }, ...current]);
    toast(`Paid ${inr(amount)} to ${payment.name || "merchant"} · demo`);
  }, [toast]);

  const addRequest = useCallback(({ amount, people, note }) => {
    const value = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0) return;
    const count = Number(people) || 1;
    setItems((current) => [{
      n: `Split request · ${count} ${count === 1 ? "person" : "people"}`,
      t: "t",
      d: "Just now",
      b: note ? `UPI request · ${note}` : "UPI request",
      a: value,
      s: "Pending",
      c: "#fbbc04",
      demo: true,
    }, ...current]);
    toast(`Requested ${inr(value)} from ${count} ${count === 1 ? "person" : "people"} · demo`);
  }, [toast]);

  const handleScan = useCallback((next) => {
    setScanTab(null);
    setIntent(next);
  }, []);

  const handlePaid = useCallback((payment) => {
    addPayment(payment);
  }, [addPayment]);

  const openQuick = useCallback((mode) => setQuick({ mode }), []);
  const openBill = useCallback((bill) => setQuick({ mode: "bill", bill }), []);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <Header
        dark={dark}
        setDark={setDark}
        q={q}
        setQ={setQ}
        toast={toast}
        onQuick={openQuick}
        onOpenNfc={() => setScanTab("nfc")}
      />
      <Hero />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        <div className="lg:col-span-8 grid gap-4 md:gap-6 content-start order-2 lg:order-1">
          <Actions onScan={() => setScanTab("qr")} onNfc={() => setScanTab("nfc")} onQuick={openQuick} />
          <Transactions q={q} loading={loading} toast={toast} items={items} />
          <Spend loading={loading} />
        </div>
        <div className="lg:col-span-4 grid gap-4 md:gap-6 content-start order-1 lg:order-2">
          <Accounts show={show} setShow={setShow} toast={toast} loading={loading} />
          <Bills onPay={openBill} />
          <Rewards toast={toast} />
          <Security />
        </div>
      </div>
      {msg && <div role="status" className="fixed left-1/2 -translate-x-1/2 z-20 px-5 py-3 rounded-xl text-sm" style={{ bottom: "calc(16px + env(safe-area-inset-bottom,0px))", background: "var(--tx)", color: "var(--bg)" }}>{msg}</div>}

      {scanTab && (
        <ScannerModal
          initialTab={scanTab}
          onClose={() => setScanTab(null)}
          onScan={handleScan}
        />
      )}
      {intent && (
        <CheckoutSheet
          intent={intent}
          onClose={() => setIntent(null)}
          onPaid={handlePaid}
        />
      )}
      {quick && (
        <QuickPaySheet
          key={`${quick.mode}-${quick.bill?.n ?? ""}`}
          mode={quick.mode}
          presetBill={quick.bill}
          onClose={() => setQuick(null)}
          onComplete={addPayment}
          onRequest={addRequest}
        />
      )}
    </div>
  );
}
