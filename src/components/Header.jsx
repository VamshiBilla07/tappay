import { Search, Bell, Settings, Moon, Sun } from "lucide-react";
export default function Header({ dark, setDark, q, setQ, toast }) {
  return (
    <header className="flex flex-wrap items-center gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className="av" style={{ background: "linear-gradient(135deg,#4285f4,#34a853)", width: 44, height: 44, boxShadow: "0 0 0 3px var(--bg),0 0 0 5px #fbbc04" }}>R</div>
        <div><div className="font-medium">Rohan Mehta</div><div className="mu text-[13px]">rohan.mehta@okhdfcbank</div></div>
      </div>
      <label className="flex items-center gap-2 flex-1 order-last md:order-none w-full md:w-auto rounded-full px-4 h-12 min-w-[220px] border" style={{ background: "var(--sf)", borderColor: "var(--ln)" }}>
        <Search size={20} />
        <input className="s" placeholder="Search transactions, contacts, bills, offers" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="flex items-center ml-auto">
        <button className="ib" aria-label="Toggle dark mode" onClick={() => setDark(!dark)}>{dark ? <Sun size={20} /> : <Moon size={20} />}</button>
        <button className="ib" aria-label="Notifications" onClick={() => toast("3 new: bill reminder, payment request, offer")}><Bell size={20} /></button>
        <button className="ib" aria-label="Settings" onClick={() => toast("Settings (demo)")}><Settings size={20} /></button>
      </div>
    </header>
  );
}
