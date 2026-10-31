import { useState } from "react";
import { Download } from "lucide-react";
import { Card, Skeleton } from "./ui";
import { TX, inr } from "../data";
const FILTERS = { All: () => true, Merchants: (x) => x.t === "m", Transfers: (x) => x.t === "t", Bills: (x) => x.t === "b", Failed: (x) => x.s === "Failed" };
const STATUS = { Success: "ok", Pending: "pend", Failed: "bad" };
export default function Transactions({ q, loading, toast }) {
  const [f, setF] = useState("All");
  const list = TX.filter(FILTERS[f]).filter((x) => x.n.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card title="Recent activity" right={
      <div className="flex gap-2">
        {["CSV", "PDF"].map((t) => <button key={t} className="chip" onClick={() => toast(`Statement ${t} (demo)`)}><Download size={14} />{t}</button>)}
      </div>}>
      <div className="flex gap-2 flex-wrap mb-2" role="group" aria-label="Filter">
        {Object.keys(FILTERS).map((k) => <button key={k} className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{k}</button>)}
      </div>
      {loading ? <div className="grid gap-2 mt-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={56} />)}</div>
        : list.length === 0 ? <div className="text-center py-10 mu"><div className="text-3xl">∅</div>No transactions match. Try another filter or search.</div>
        : list.map((x) => (
          <div key={x.n + x.d} className="row">
            <div className="av" style={{ background: x.c }}>{x.n[0]}</div>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium">{x.n}</div><div className="mu text-xs">{x.d} · {x.b}</div></div>
            <div className="text-right">
              <div className="font-medium" style={{ color: x.a > 0 ? "var(--gn)" : "var(--tx)" }}>{x.a > 0 ? "+" : "−"}{inr(Math.abs(x.a))}</div>
              <span className={"tag " + STATUS[x.s]}>{x.s}</span>
            </div>
          </div>))}
    </Card>
  );
}
