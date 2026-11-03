import { useEffect, useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import { Card } from "./ui";
import Sheet from "./Sheet";
import { inr } from "../data";

const pad = (n) => String(n).padStart(2, "0");

const CARDS = [
  { id: "c1", label: "UPI spend streak", value: 75 },
  { id: "c2", label: "Weekend cashback", value: 120 },
  { id: "c3", label: "Bill pay bonus", value: 40 },
];

export default function Rewards({ toast }) {
  const [s, setS] = useState(7200);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState([]);

  useEffect(() => { const t = setInterval(() => setS((x) => Math.max(0, x - 1)), 1000); return () => clearInterval(t); }, []);
  const clock = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  const unclaimed = CARDS.length - revealed.length;
  const earned = CARDS.filter((c) => revealed.includes(c.id)).reduce((sum, c) => sum + c.value, 0);

  const scratch = (card) => {
    if (revealed.includes(card.id)) return;
    setRevealed((current) => [...current, card.id]);
    toast(`You won ${inr(card.value)} cashback · ${card.label}`);
  };

  return (
    <Card title="Rewards and offers">
      <div className="flex items-center gap-3 mb-3">
        <div className="av" style={{ background: "#34a853" }}><Gift size={20} /></div>
        <div><div className="text-[22px] font-medium">{inr(1865 + earned)}</div><div className="mu text-xs">total cashback earned</div></div>
      </div>
      <button className="btn scratch w-full mb-3" onClick={() => setOpen(true)}>
        <Sparkles size={15} /> {unclaimed ? `Scratch ${unclaimed} unclaimed card${unclaimed === 1 ? "" : "s"}` : "All cards scratched"}
      </button>
      {[["Zomato", "20% off up to ₹100"], ["BookMyShow", "₹50 cashback on 2 tickets"]].map(([n, d]) => (
        <div key={n} className="row"><div className="flex-1"><div className="text-sm font-medium">{n}</div><div className="mu text-xs">{d}</div></div><span className="tag pend">{clock}</span></div>
      ))}

      {open && (
        <Sheet
          title="Scratch cards"
          subtitle={unclaimed ? `${unclaimed} waiting — tap a card to reveal it` : "All scratched"}
          onClose={() => setOpen(false)}
        >
          <div className="grid gap-2">
            {CARDS.map((card) => {
              const done = revealed.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => scratch(card)}
                  className="w-full text-left rounded-2xl p-4 flex items-center gap-3"
                  style={{
                    border: `1px dashed ${done ? "var(--gn)" : "var(--ln)"}`,
                    background: done ? "var(--sf2)" : "var(--prbg)",
                  }}
                >
                  <span className="av" style={{ background: done ? "var(--gn)" : "var(--pr)", color: "#fff" }}>
                    {done ? "✓" : <Gift size={18} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{card.label}</span>
                    <span className="block mu text-xs">{done ? "Cashback credited to your balance" : "Tap to scratch"}</span>
                  </span>
                  <span className="font-semibold" style={{ color: done ? "var(--gn)" : "var(--pr)" }}>
                    {done ? `+${inr(card.value)}` : "•••"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mu text-[11px] mt-3 mb-0">
            Cashback is a demo reward — nothing is credited to a real wallet and no chain transaction is sent.
          </p>
          <button type="button" className="btn w-full mt-3" onClick={() => setOpen(false)}>Done</button>
        </Sheet>
      )}
    </Card>
  );
}
