import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Card, Skeleton } from "./ui";
import { TX, inr } from "../data";
import { downloadStatementCsv } from "../lib/statement";

const FILTERS = { All: () => true, Merchants: (x) => x.t === "m", Transfers: (x) => x.t === "t", Bills: (x) => x.t === "b", Failed: (x) => x.s === "Failed" };
const STATUS = { Success: "ok", Pending: "pend", Failed: "bad" };

export default function Transactions({ q, loading, toast, items = TX }) {
  const [f, setF] = useState("All");
  const list = items.filter(FILTERS[f]).filter((x) => x.n.toLowerCase().includes(q.toLowerCase()));

  const exportCsv = () => {
    if (!list.length) {
      toast("Nothing to export — adjust the filter first");
      return;
    }
    const name = downloadStatementCsv(list);
    toast(`Downloaded ${name}`);
  };

  /* The print dialog's "Save as PDF" is the PDF export — print CSS prints only this card. */
  const exportPdf = () => window.print();

  return (
    <Card title="Recent activity" id="statement" right={
      <div className="flex gap-2 no-print">
        <button className="chip" onClick={exportCsv} title="Download these rows as a CSV statement">
          <Download size={14} />CSV
        </button>
        <button className="chip" onClick={exportPdf} title="Print this statement, or save it as a PDF">
          <Printer size={14} />PDF
        </button>
      </div>}>
      <div className="flex gap-2 flex-wrap mb-2 no-print" role="group" aria-label="Filter">
        {Object.keys(FILTERS).map((k) => <button key={k} className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{k}</button>)}
      </div>
      {loading ? <div className="grid gap-2 mt-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={56} />)}</div>
        : list.length === 0 ? <div className="text-center py-10 mu"><div className="text-3xl">∅</div>No transactions match. Try another filter or search.</div>
        : list.map((x, index) => (
          <div key={x.n + x.d + index} className="row">
            <div className="av" style={{ background: x.c }}>{x.n[0]}</div>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium">{x.n}</div><div className="mu text-xs">{x.d} · {x.b}</div></div>
            <div className="text-right">
              <div className="font-medium" style={{ color: x.a > 0 ? "var(--gn)" : "var(--tx)" }}>{x.a > 0 ? "+" : "−"}{inr(Math.abs(x.a))}</div>
              <div className="flex items-center justify-end gap-1">
                <span className={"tag " + STATUS[x.s]}>{x.s}</span>
                {x.demo && <span className="tag" style={{ background: "var(--prbg)", color: "var(--pr)" }}>Demo</span>}
              </div>
            </div>
          </div>))}
    </Card>
  );
}
