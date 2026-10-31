import { useState } from "react";
import { ShieldCheck, CreditCard, Smartphone } from "lucide-react";
import { Card, Toggle } from "./ui";
export default function Security() {
  const [bio, setBio] = useState(true);
  return (
    <Card title="Security and privacy">
      <div className="row"><ShieldCheck size={20} /><div className="flex-1 text-sm">Biometric unlock</div><Toggle on={bio} onChange={setBio} label="Biometric unlock" /></div>
      <div className="row"><CreditCard size={20} /><div className="flex-1 text-sm">Daily limit<div className="mu text-xs">₹1,00,000 per day</div></div><button className="chip">Edit</button></div>
      {[["Pixel 8 · This device", "Active now", false], ["Chrome on Windows", "2 hours ago", true]].map(([n, t, out]) => (
        <div key={n} className="row"><Smartphone size={20} /><div className="flex-1 text-sm">{n}<div className="mu text-xs">{t}</div></div>{out && <button className="chip">Sign out</button>}</div>
      ))}
    </Card>
  );
}
