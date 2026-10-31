import { ScanLine, User, Smartphone, Landmark, Receipt, Users } from "lucide-react";
const ACTIONS = [[ScanLine, "Scan QR", "#1a73e8"], [User, "Pay contact", "#34a853"], [Smartphone, "Pay number", "#f29900"], [Landmark, "Bank transfer", "#ea4335"], [Receipt, "Pay bills", "#a142f4"], [Users, "Split / request", "#00897b"]];
export default function Actions({ toast }) {
  return (
    <section className="card" aria-label="Quick actions">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {ACTIONS.map(([Icon, label, color]) => (
          <button key={label} className="qa" onClick={() => toast(label + " (demo)")}>
            <span className="c" style={{ "--a": color }}><Icon size={26} /></span>{label}
          </button>
        ))}
      </div>
    </section>
  );
}
