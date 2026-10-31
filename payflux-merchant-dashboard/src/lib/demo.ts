import { USDC } from "@pos/shared";
import { parseUnits } from "viem";
import type { PaymentMethod, Transaction } from "../types";
import type { PaymentLinkView } from "./paylink";

/**
 * Demo-only payment links, kept in localStorage so the QR / hosted URL opens a
 * working checkout in another tab on this machine without MetaMask, a server
 * round-trip, or a deployed contract.
 *
 * Nothing here is signed and nothing reaches a chain — the wire payload is a
 * placeholder and the checkout labels it as a demo.
 */
const KEY = "payflux.demo.links.v1";

/** Placeholder merchant address so the shape stays valid; the UI shows a store label. */
export const DEMO_MERCHANT = "0x000000000000000000000000000000000000dEaD" as const;

type Store = Record<string, PaymentLinkView>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode / quota — the in-memory copy still renders */
  }
}

const randomHex = (bytes: number) => {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
};

export function listDemoLinks(): PaymentLinkView[] {
  return Object.values(read()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getDemoLink(id: string): PaymentLinkView | null {
  return read()[id] ?? null;
}

export function patchDemoLink(id: string, patch: Partial<PaymentLinkView>): PaymentLinkView | null {
  const store = read();
  const current = store[id];
  if (!current) return null;
  const next = { ...current, ...patch };
  store[id] = next;
  write(store);
  return next;
}

/** One paid demo link → one dashboard row, so every view reads the same sample money. */
export function demoTxnFromLink(link: PaymentLinkView): Transaction {
  const method = (link.method as PaymentMethod) ?? 'UPI';
  const name = link.customer?.name?.trim() || 'Walk-in customer';
  return {
    id: `TX-${link.id.slice(-8).toUpperCase()}`,
    referenceId: link.id,
    paymentLinkId: link.id,
    customer: {
      id: `demo-${link.id.slice(-6)}`,
      name,
      handle: `@${name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'customer'}`,
      email: link.customer?.email?.trim() || 'customer@example.com',
    },
    amount: link.inr,
    currency: 'INR',
    fee: 0,
    tax: 0,
    netAmount: link.inr,
    paymentMethod: method,
    paymentSubtype: 'Demo checkout',
    status: 'Successful',
    createdAt: new Date(link.createdAt * 1000).toISOString(),
    settlementStatus: 'Settled',
    metadata: { demo: true, usdc: link.usdc },
  };
}

export function createDemoLink(input: {
  inr: number;
  rate: number;
  description: string;
  methods: PaymentMethod[];
  customer?: { name?: string; email?: string; phone?: string };
  expirySeconds: number;
}): PaymentLinkView {
  const id = `plink_demo_${randomHex(4)}`;
  const now = Math.floor(Date.now() / 1000);
  const usdc = (input.inr / input.rate).toFixed(6);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const link: PaymentLinkView = {
    id,
    merchant: DEMO_MERCHANT,
    request: {
      v: 1,
      c: 84532,
      s: DEMO_MERCHANT,
      r: {
        merchant: DEMO_MERCHANT,
        token: USDC,
        amount: parseUnits(usdc, 6).toString(),
        nonce: `0x${randomHex(32)}`,
        expiry: String(now + input.expirySeconds),
        ensName: "",
      },
      g: "0x",
    },
    inr: input.inr,
    usdc,
    description: input.description,
    methods: input.methods,
    customer: input.customer ?? {},
    requireBillingAddress: false,
    createdAt: now,
    expiresAt: now + input.expirySeconds,
    status: "open",
    url: `${origin}/pay/${id}?demo=1`,
  };

  const store = read();
  store[id] = link;
  write(store);
  return link;
}
