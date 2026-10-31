import { Eye, EyeOff, Landmark } from "lucide-react";
import { Card, Skeleton } from "./ui";
import { inr } from "../data";
export default function Accounts({ show, setShow, toast, loading }) {
  const mask = (v) => (show ? inr(v) : "••••");
  return (
    <Card title="Accounts and wallet" right={
      <button className="chip" aria-pressed={show} onClick={() => setShow(!show)}>{show ? <Eye size={16} /> : <EyeOff size={16} />}{show ? "Hide" : "Show"}</button>}>
      {loading ? <div className="grid gap-3"><Skeleton h={84} /><Skeleton h={56} /><Skeleton h={56} /></div> : (
        <div>
          <div className="gcard">
            <div className="flex justify-between text-[13px] opacity-90"><span>Google Pay balance</span><span className="font-bold tracking-wider">VISA</span></div>
            <div className="text-[28px] font-medium">{show ? inr(8450.5) : "₹ •••••"}</div>
          </div>
          {[["HDFC Bank ••4821", true, 42310], ["SBI ••1093", false, 18940]].map(([n, primary, b]) => (
            <div key={n} className="row">
              <div className="av" style={{ background: "var(--prbg)", color: "var(--pr)" }}><Landmark size={18} /></div>
              <div className="flex-1"><div className="text-sm">{n}</div><div className="mu text-xs">{mask(b)}</div></div>
              {primary && <span className="tag ok">Primary</span>}
            </div>
          ))}
          <div className="row">
            <div className="av" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>L</div>
            <div className="flex-1"><div className="text-sm">UPI Lite</div><div className="mu text-xs">{mask(350)}</div></div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="btn btn2" onClick={() => toast("Manage cards (demo)")}>Manage cards</button>
            <button className="btn btn2" onClick={() => toast("Primary account (demo)")}>Set primary</button>
            <button className="btn" onClick={() => toast("Add bank or card (demo)")}>+ Add</button>
          </div>
        </div>
      )}
    </Card>
  );
}
