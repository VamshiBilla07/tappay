import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { Card } from "./ui";
import { inr } from "../data";
const pad = (n) => String(n).padStart(2, "0");
export default function Rewards({ toast }) {
  const [s, setS] = useState(7200);
  useEffect(() => { const t = setInterval(() => setS((x) => Math.max(0, x - 1)), 1000); return () => clearInterval(t); }, []);
  const clock = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return (
    <Card title="Rewards and offers">
      <div className="flex items-center gap-3 mb-3">
        <div className="av" style={{ background: "#34a853" }}><Gift size={20} /></div>
        <div><div className="text-[22px] font-medium">{inr(1865)}</div><div className="mu text-xs">total cashback earned</div></div>
      </div>
      <button className="btn scratch w-full mb-3" onClick={() => toast("3 scratch cards waiting (demo)")}>✨ Scratch 3 unclaimed cards</button>
      {[["Zomato", "20% off up to ₹100"], ["BookMyShow", "₹50 cashback on 2 tickets"]].map(([n, d]) => (
        <div key={n} className="row"><div className="flex-1"><div className="text-sm font-medium">{n}</div><div className="mu text-xs">{d}</div></div><span className="tag pend">{clock}</span></div>
      ))}
    </Card>
  );
}
