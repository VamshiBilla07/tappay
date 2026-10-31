import { useState } from "react";
import { Card, Toggle } from "./ui";
import { BILLS, MANDATES, inr } from "../data";
export default function Bills({ onPay }) {
  const [on, setOn] = useState({ Netflix: true, Spotify: false, Gym: true });
  return (
    <Card title="Bills and AutoPay">
      {BILLS.map((b) => (
        <div key={b.n} className="row">
          <div className="flex-1"><div className="text-sm">{b.n}</div><div className="text-xs" style={{ color: b.u < 3 ? "var(--rd)" : "var(--mu)" }}>{b.due}</div></div>
          <div className="font-medium">{inr(b.a)}</div>
          <button className="chip" onClick={() => onPay?.(b)}>Pay</button>
        </div>
      ))}
      <div className="mu text-[13px] mt-3 mb-1">AutoPay mandates</div>
      {MANDATES.map((n) => (
        <div key={n} className="row">
          <div className="flex-1 text-sm">{n}<div className="mu text-xs">{on[n] ? "Active" : "Paused"}</div></div>
          <Toggle on={on[n]} label={`${n} AutoPay`} onChange={(v) => setOn({ ...on, [n]: v })} />
        </div>
      ))}
    </Card>
  );
}
