import { useState } from "react";
import {
  Bell, CheckCheck, Landmark, Moon, Nfc, Receipt, Search, Settings, Smartphone, Sun, Tag,
} from "lucide-react";
import Sheet from "./Sheet";
import { nfcSupport } from "../lib/nfc";

const NOTES = [
  {
    id: "bill",
    Icon: Receipt,
    color: "#a142f4",
    title: "Electricity bill due in 2 days",
    body: "BESCOM · ₹1,860.00",
    action: "Pay bill",
    quick: "bill",
  },
  {
    id: "request",
    Icon: Landmark,
    color: "#34a853",
    title: "Kabir requested ₹450.00",
    body: "Dinner split · 3 people",
    action: "Split / request",
    quick: "split",
  },
  {
    id: "offer",
    Icon: Tag,
    color: "#f29900",
    title: "20% off on Zomato",
    body: "Up to ₹100 · ends Sunday",
    action: "See rewards",
    quick: null,
  },
];

export default function Header({ dark, setDark, q, setQ, toast, onQuick, onOpenNfc }) {
  const [pane, setPane] = useState(null); // "notifications" | "settings"
  const [read, setRead] = useState([]);
  const support = nfcSupport();
  const unread = NOTES.length - read.length;

  const openNote = (note) => {
    setRead((current) => (current.includes(note.id) ? current : [...current, note.id]));
    setPane(null);
    if (note.quick) onQuick?.(note.quick);
    else toast("Offers are listed under Rewards and offers");
  };

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
        <button className="ib" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => setPane("notifications")} style={{ position: "relative" }}>
          <Bell size={20} />
          {unread > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 8,
                background: "var(--rd)", boxShadow: "0 0 0 2px var(--sf)",
              }}
            />
          )}
        </button>
        <button className="ib" aria-label="Settings" onClick={() => setPane("settings")}><Settings size={20} /></button>
      </div>

      {pane === "notifications" && (
        <Sheet
          title="Notifications"
          subtitle={unread ? `${unread} unread` : "You're all caught up"}
          onClose={() => setPane(null)}
        >
          <div className="grid gap-2">
            {NOTES.map((note) => {
              const isRead = read.includes(note.id);
              return (
                <button
                  key={note.id}
                  type="button"
                  className="row text-left"
                  onClick={() => openNote(note)}
                  style={isRead ? undefined : { background: "var(--prbg)" }}
                >
                  <div className="av" style={{ background: "var(--sf2)", color: note.color }}><note.Icon size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{note.title}</div>
                    <div className="mu text-xs">{note.body}</div>
                  </div>
                  <span className="mu text-xs" style={{ color: "var(--pr)" }}>{note.action}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <button type="button" className="btn btn2 flex-1" onClick={() => setRead(NOTES.map((n) => n.id))} disabled={!unread}>
              <CheckCheck size={15} /> Mark all read
            </button>
            <button type="button" className="btn flex-1" onClick={() => setPane(null)}>Done</button>
          </div>
        </Sheet>
      )}

      {pane === "settings" && (
        <Sheet title="Settings" subtitle="This device" onClose={() => setPane(null)}>
          <div className="grid gap-1">
            <div className="row">
              <div className="av" style={{ background: "var(--sf2)", color: "var(--pr)" }}>{dark ? <Moon size={18} /> : <Sun size={18} />}</div>
              <div className="flex-1"><div className="text-sm">Dark theme</div><div className="mu text-xs">Match this device</div></div>
              <button
                type="button"
                className="chip"
                aria-pressed={dark}
                onClick={() => setDark(!dark)}
              >
                {dark ? "On" : "Off"}
              </button>
            </div>
            <div className="row">
              <div className="av" style={{ background: "var(--sf2)", color: "var(--pr)" }}><Nfc size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm">NFC reader</div>
                <div className="mu text-xs truncate">{support.supported ? "Ready — tap a tag to pay" : support.reason}</div>
              </div>
              <button type="button" className="chip" onClick={() => { setPane(null); onOpenNfc?.(); }}>
                {support.supported ? "Scan" : "Open"}
              </button>
            </div>
            <div className="row">
              <div className="av" style={{ background: "var(--sf2)", color: "var(--pr)" }}><Smartphone size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm">QR scanning</div>
                <div className="mu text-xs">Camera · UPI and TapPay codes</div>
              </div>
              <span className="tag ok">On</span>
            </div>
            <div className="row">
              <div className="av" style={{ background: "var(--sf2)", color: "var(--pr)" }}><Landmark size={18} /></div>
              <div className="flex-1"><div className="text-sm">Settlement</div><div className="mu text-xs">Base Sepolia testnet · USDC</div></div>
              <span className="tag pend">Testnet</span>
            </div>
          </div>
          <p className="mu text-[11px] mt-3 mb-0">
            TapPay is a demo build. Keys live on this device only; funds are testnet USDC.
          </p>
          <button type="button" className="btn w-full mt-3" onClick={() => setPane(null)}>Done</button>
        </Sheet>
      )}
    </header>
  );
}
