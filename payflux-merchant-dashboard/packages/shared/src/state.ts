export type PayState =
  | { s: "idle" } | { s: "requested"; expiry: number } | { s: "scanned" }
  | { s: "verifying" } | { s: "verified" } | { s: "rejected"; reason: string }
  | { s: "submitting"; step: string } | { s: "confirmed"; tx: string } | { s: "expired" } | { s: "failed"; error: string };

export type PayEvent =
  | { t: "REQUEST"; expiry: number } | { t: "SCAN" } | { t: "VERIFY_START" } | { t: "VERIFY_OK" } | { t: "VERIFY_FAIL"; reason: string }
  | { t: "SUBMIT"; step: string } | { t: "CONFIRMED"; tx: string } | { t: "FAILED"; error: string } | { t: "TICK"; now: number } | { t: "RESET" };

export function reduce(st: PayState, e: PayEvent): PayState {
  if (e.t === "RESET") return { s: "idle" };
  if (e.t === "TICK") return (st.s === "requested" && e.now > st.expiry) ? { s: "expired" } : st;
  switch (st.s) {
    case "idle": return e.t === "REQUEST" ? { s: "requested", expiry: e.expiry } : e.t === "SCAN" ? { s: "scanned" } : st;
    case "requested": return e.t === "CONFIRMED" ? { s: "confirmed", tx: e.tx } : st;
    case "scanned": return e.t === "VERIFY_START" ? { s: "verifying" } : st;
    case "verifying": return e.t === "VERIFY_OK" ? { s: "verified" } : e.t === "VERIFY_FAIL" ? { s: "rejected", reason: e.reason } : st;
    case "verified": return e.t === "SUBMIT" ? { s: "submitting", step: e.step } : st; // only reachable via VERIFY_OK
    case "submitting": return e.t === "SUBMIT" ? { s: "submitting", step: e.step } : e.t === "CONFIRMED" ? { s: "confirmed", tx: e.tx } : e.t === "FAILED" ? { s: "failed", error: e.error } : st;
    default: return st;
  }
}
