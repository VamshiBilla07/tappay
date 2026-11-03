import type { PaymentMethod } from "../types";

/** Every method a merchant can offer in the UI. */
export const ALL_METHODS: PaymentMethod[] = [
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
  "Digital Wallets",
  "NFC / Contactless",
  "Cryptocurrency",
];

/**
 * UPI / card / net-banking acquiring needs a licensed PSP and bank rails, which
 * this testnet build does not have. Each method therefore maps to a REAL
 * on-chain settlement route. The checkout labels the rail explicitly.
 */
export type Rail = "USDC" | "ETH";

export const METHOD_RAIL: Record<PaymentMethod, Rail> = {
  UPI: "USDC",
  Wallet: "USDC",
  "Digital Wallets": "USDC",
  "NFC / Contactless": "USDC",
  Cryptocurrency: "USDC",
  "Credit Card": "ETH",
  "Debit Card": "ETH",
  "Net Banking": "ETH",
};

export const railFor = (method: PaymentMethod): Rail => METHOD_RAIL[method] ?? "USDC";

export const RAIL_COPY: Record<Rail, { title: string; detail: string; badge: string }> = {
  USDC: {
    title: "Pay with USDC",
    detail: "A direct testnet USDC transfer to the merchant. If your allowance is short, an Approve prompt comes first.",
    badge: "Settles in USDC",
  },
  ETH: {
    title: "Pay with ETH",
    detail: "ETH is swapped on-chain for exactly the invoiced USDC. Unspent ETH is refunded in the same transaction.",
    badge: "ETH → exact USDC",
  },
};

export const METHOD_SUBTYPE: Record<PaymentMethod, string> = {
  UPI: "UPI · settles USDC",
  Wallet: "Wallet · settles USDC",
  "Digital Wallets": "Wallet · settles USDC",
  "NFC / Contactless": "NFC · settles USDC",
  Cryptocurrency: "USDC on Base",
  "Credit Card": "Card · ETH swap",
  "Debit Card": "Debit · ETH swap",
  "Net Banking": "Net banking · ETH swap",
};

export const isNfcSupported = (): boolean =>
  typeof window !== "undefined" && "NDEFReader" in window;
