import { inr } from "../data";
const BARS = [40, 65, 30, 80, 55, 95, 70];
export default function Hero() {
  const now = new Date(), hr = now.getHours();
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const date = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  return (
    <section className="hero mb-4 md:mb-6">
      <div className="relative z-[1] flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] opacity-90">{date}</div>
          <div className="text-[28px] font-bold leading-tight my-1">{greet}, Rohan</div>
          <div className="text-sm opacity-90 max-w-[380px]">You earned ₹412 cashback this week. Keep your 12-day payment streak going.</div>
        </div>
        <div className="flex items-end gap-1" role="img" aria-label="Spend over the last 7 days">
          {BARS.map((v, i) => <div key={i} style={{ width: 14, height: v * 0.6, borderRadius: 6, background: i === 5 ? "#fbbc04" : "rgba(255,255,255,.6)" }} />)}
        </div>
      </div>
      <div className="relative z-[1] grid grid-cols-3 gap-2 mt-4">
        {[["Spent", inr(32800)], ["Cashback", inr(1865)], ["Streak", "12 days"]].map(([l, v]) => (
          <div key={l} className="stat"><div className="text-xs opacity-85">{l}</div><div className="text-[17px] font-semibold">{v}</div></div>
        ))}
      </div>
    </section>
  );
}
