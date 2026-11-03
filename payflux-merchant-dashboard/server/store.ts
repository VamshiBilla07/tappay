import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LinkRecord } from "./types";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
}

let db: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!db) db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return db;
}

function toRow(link: LinkRecord) {
  return {
    id: link.id,
    merchant: link.merchant,
    request: link.request,
    inr: link.inr,
    usdc: link.usdc,
    description: link.description,
    methods: link.methods,
    customer: link.customer,
    require_billing_address: link.requireBillingAddress,
    created_at: link.createdAt,
    expires_at: link.expiresAt,
    status: link.status,
    demo: link.demo ?? false,
    tx_hash: link.txHash ?? null,
    payer: link.payer ?? null,
    paid_with_eth: link.paidWithEth ?? null,
    method: link.method ?? null,
  };
}

function fromRow(row: any): LinkRecord {
  return {
    id: row.id,
    merchant: row.merchant,
    request: row.request,
    inr: row.inr,
    usdc: row.usdc,
    description: row.description ?? "",
    methods: row.methods ?? [],
    customer: row.customer ?? {},
    requireBillingAddress: row.require_billing_address ?? false,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status,
    demo: row.demo ?? undefined,
    txHash: row.tx_hash ?? undefined,
    payer: row.payer ?? undefined,
    paidWithEth: row.paid_with_eth ?? undefined,
    method: row.method ?? undefined,
  };
}

export async function findLink(id: string): Promise<LinkRecord | undefined> {
  const { data, error } = await supabase()
    .from("links")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return fromRow(data);
}

export async function listLinks(merchant: string): Promise<LinkRecord[]> {
  const { data, error } = await supabase()
    .from("links")
    .select("*")
    .eq("merchant", merchant.toLowerCase())
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

export async function nonceExists(nonce: string): Promise<boolean> {
  const { data } = await supabase()
    .from("links")
    .select("id")
    .filter("request->r->>nonce", "eq", nonce.toLowerCase())
    .limit(1);
  return !!(data && data.length > 0);
}

export async function insertLink(link: LinkRecord): Promise<void> {
  const { error } = await supabase().from("links").insert(toRow(link));
  if (error) throw error;
}

export async function updateLink(
  id: string,
  patch: Partial<LinkRecord>,
): Promise<LinkRecord | undefined> {
  const row: any = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.txHash !== undefined) row.tx_hash = patch.txHash ?? null;
  if (patch.payer !== undefined) row.payer = patch.payer ?? null;
  if (patch.paidWithEth !== undefined) row.paid_with_eth = patch.paidWithEth ?? null;
  if (patch.method !== undefined) row.method = patch.method ?? null;

  const { data, error } = await supabase()
    .from("links")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return undefined;
  return fromRow(data);
}
