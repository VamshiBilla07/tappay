import type { Address, Hex } from "viem";

/** The exact wire format shared by QR, NFC and the payment API (see @pos/shared encode()). */
export interface WireRequest {
  merchant: Address;
  token: Address;
  amount: string;
  nonce: Hex;
  expiry: string;
  ensName: string;
}

export interface WirePayload {
  v: 1;
  c: number;
  s: Address;
  r: WireRequest;
  g: Hex;
}

export type LinkStatus = "open" | "paid" | "expired" | "cancelled";

export interface LinkCustomer {
  name?: string;
  email?: string;
  phone?: string;
}

export interface LinkRecord {
  id: string;
  merchant: Address;
  request: WirePayload;
  /** Display amount in INR (the front-end prices in INR). */
  inr: number;
  /** Signed settlement amount in whole USDC, as a decimal string. */
  usdc: string;
  description: string;
  methods: string[];
  customer: LinkCustomer;
  requireBillingAddress: boolean;
  createdAt: number;
  expiresAt: number;
  status: LinkStatus;
  /** Demo links are server-backed, unsigned, and settle only through /simulate. */
  demo?: boolean;
  txHash?: Hex;
  payer?: Address;
  paidWithEth?: boolean;
  method?: string;
}

export interface LinkView extends LinkRecord {
  url: string;
}
