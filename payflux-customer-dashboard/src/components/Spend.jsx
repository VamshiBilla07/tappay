import { useState } from "react";
import { Card, Skeleton } from "./ui";
import { CATS, inr } from "../data";
export default function Spend({ loading }) {
  const [limit, setLimit] = useState(35000);
  const total = CATS.reduce((s, c) => s + c[1], 0), R = 52, C = 2 * Math.PI * R;
  const pct = Math.min(100, Math.round((total / limit) * 100)), hot = pct > 85;
  let offset = 0;
  return (
    <Card title="Spend analytics · October">
      {loading ? <Skeleton h={160} /> : (
        <div className="flex flex-wrap items-center gap-6">
          <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Spend by category donut">
            {CATS.map(([n, v, c]) => { const len = (v / total) * C; const el = <circle key={n} cx="70" cy="70" r={R} fill="none" stroke={c} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />; offset += len; return el; })}
            <text x="70" y="68" textAnchor="middle" fill="var(--tx)" fontSize="15" fontWeight="500">{inr(total)}</text>
            <text x="70" y="86" textAnchor="middle" fill="var(--mu)" fontSize="11">spent</text>
          </svg>
          <ul className="flex-1 m-0 p-0 list-none min-w-[150px]">
            {CATS.map(([n, v, c]) => <li key={n} className="flex items-center gap-2 py-1 text-sm"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} /><span className="flex-1">{n}</span><span className="mu">{inr(v)}</span></li>)}
          </ul>
        </div>)}
      <div className="mt-4">
        <div className="flex justify-between text-[13px]"><span>Budget {inr(total)} of {inr(limit)}</span><span style={{ color: hot ? "var(--rd)" : "var(--mu)" }}>{pct}%</span></div>
        <div className="h-2.5 rounded-full my-2" style={{ background: "var(--sf2)" }}><div className="h-full rounded-full" style={{ width: pct + "%", background: hot ? "var(--rd)" : "var(--pr)" }} /></div>
        <label className="mu text-xs">Monthly limit <input type="range" min="20000" max="60000" step="1000" value={limit} onChange={(e) => setLimit(+e.target.value)} aria-label="Monthly limit" /></label>
      </div>
    </Card>
  );
}
