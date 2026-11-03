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

export default function App() {
  const [dark, setDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const [show, setShow] = useState(true);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const timer = useRef();

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 1200); return () => clearTimeout(t); }, []);
  const toast = useCallback((m) => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(""), 2200); }, []);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <Header dark={dark} setDark={setDark} q={q} setQ={setQ} toast={toast} />
      <Hero />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        <div className="lg:col-span-8 grid gap-4 md:gap-6 content-start order-2 lg:order-1">
          <Actions toast={toast} />
          <Transactions q={q} loading={loading} toast={toast} />
          <Spend loading={loading} />
        </div>
        <div className="lg:col-span-4 grid gap-4 md:gap-6 content-start order-1 lg:order-2">
          <Accounts show={show} setShow={setShow} toast={toast} loading={loading} />
          <Bills toast={toast} />
          <Rewards toast={toast} />
          <Security />
        </div>
      </div>
      {msg && <div role="status" className="fixed left-1/2 -translate-x-1/2 z-20 px-5 py-3 rounded-xl text-sm" style={{ bottom: "calc(16px + env(safe-area-inset-bottom,0px))", background: "var(--tx)", color: "var(--bg)" }}>{msg}</div>}
    </div>
  );
}
