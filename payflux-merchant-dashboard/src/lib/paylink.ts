import type { Address, Hex } from "viem";
import type { PaymentMethod } from "../types";

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

export interface PaymentLinkView {
  id: string;
  merchant: Address;
  request: WirePayload;
  inr: number;
  usdc: string;
  description: string;
  methods: PaymentMethod[];
  customer: { name?: string; email?: string; phone?: string };
  requireBillingAddress: boolean;
  createdAt: number;
  expiresAt: number;
  status: LinkStatus;
  /** Server-backed demo links set this; legacy local demo links do not. */
  demo?: boolean;
  url: string;
  txHash?: Hex;
  payer?: Address;
  paidWithEth?: boolean;
  method?: string;
}
