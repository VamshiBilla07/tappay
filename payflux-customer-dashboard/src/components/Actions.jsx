import { ArrowRight, Landmark, Nfc, Receipt, ScanLine, Smartphone, User, Users } from "lucide-react";

const ACTIONS = [
  { key: "scan", Icon: ScanLine, label: "Scan QR", color: "#1a73e8" },
  { key: "contact", Icon: User, label: "Pay contact", color: "#34a853" },
  { key: "number", Icon: Smartphone, label: "Pay number", color: "#f29900" },
  { key: "bank", Icon: Landmark, label: "Bank transfer", color: "#ea4335" },
  { key: "bill", Icon: Receipt, label: "Pay bills", color: "#a142f4" },
  { key: "split", Icon: Users, label: "Split / request", color: "#00897b" },
];

export default function Actions({ onScan, onNfc, onQuick }) {
  return (
    <section className="card" aria-label="Quick actions">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {ACTIONS.map(({ key, Icon, label, color }) => (
          <button
            key={key}
            type="button"
            className="qa"
            onClick={() => (key === "scan" ? onScan?.() : onQuick?.(key))}
          >
            <span className="c" style={{ "--a": color }}><Icon size={26} /></span>
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="w-full mt-3 flex items-center gap-3 rounded-2xl p-3 text-left"
        style={{ background: "var(--prbg)", color: "var(--pr)", border: 0, cursor: "pointer" }}
        onClick={onNfc}
      >
        <span
          className="w-11 h-11 rounded-2xl grid place-items-center flex-none"
          style={{ background: "var(--pr)", color: "#fff" }}
        >
          <Nfc size={22} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold">Tap to pay with NFC</span>
          <span className="block text-xs opacity-80">Hold your phone near the merchant&apos;s tag or terminal</span>
        </span>
        <ArrowRight size={18} />
      </button>
    </section>
  );
}
