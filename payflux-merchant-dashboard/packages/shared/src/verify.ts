import { createPublicClient, getAddress, http, isAddressEqual } from "viem";
import { normalize } from "viem/ens";
import { CHAIN, ENS_CHAIN, ENS_RPC, EXPIRY_SAFETY_SECONDS, SETTLEMENT, USDC } from "./config";
import { SignedRequest, recoverSigner } from "./request";

const ensClient = createPublicClient({ chain: ENS_CHAIN, transport: http(ENS_RPC) });

export interface Verification {
  ok: boolean; // true only if EVERY check passes. The UI must gate "Confirm" on this.
  checks: { chain: boolean; contract: boolean; token: boolean; notExpired: boolean; signature: boolean; ensForward: boolean; ensReverse: boolean };
  ensName: string;
  /** True when the request carried no ENS name and the caller allowed ENS-free requests. */
  ensSkipped: boolean;
  error?: string;
}

export interface VerifyOptions {
  /** Trust anchor for the settlement contract (defaults to the compiled-in SETTLEMENT). */
  expectedSettlement?: `0x${string}`;
  /** When false, a blank ensName skips the two ENS checks instead of failing them. Defaults to true. */
  requireEns?: boolean;
}

export async function verifyRequest(p: SignedRequest & { chainId: number; settlement: `0x${string}` },
  now = Math.floor(Date.now() / 1000), opts: VerifyOptions = {}): Promise<Verification> {
  const expectedSettlement = opts.expectedSettlement ?? SETTLEMENT;
  const requireEns = opts.requireEns ?? true;
  const checks = { chain: false, contract: false, token: false, notExpired: false, signature: false, ensForward: false, ensReverse: false };
  let ensSkipped = false;
  const out = (error?: string): Verification => ({ ok: Object.values(checks).every(Boolean), checks, ensName: p.req.ensName, ensSkipped, error });
  try {
    checks.chain = p.chainId === CHAIN.id;
    checks.contract = isAddressEqual(p.settlement, expectedSettlement);
    checks.token = isAddressEqual(p.req.token, USDC) && p.req.amount > 0n;
    checks.notExpired = Number(p.req.expiry) > now + EXPIRY_SAFETY_SECONDS;
    checks.signature = isAddressEqual(await recoverSigner(p, p.settlement), p.req.merchant);
    const rawName = (p.req.ensName ?? "").trim();
    if (!rawName) {
      ensSkipped = true;
      checks.ensForward = !requireEns;
      checks.ensReverse = !requireEns;
      return out(requireEns ? "merchant ENS name is required" : undefined);
    }
    const name = normalize(rawName);
    const fwd = await ensClient.getEnsAddress({ name });                 // name -> address
    checks.ensForward = !!fwd && isAddressEqual(fwd, getAddress(p.req.merchant));
    const rev = await ensClient.getEnsName({ address: p.req.merchant }); // address -> primary name
    checks.ensReverse = rev?.toLowerCase() === name.toLowerCase();
    return out();
  } catch (e: any) { return out(e?.shortMessage ?? e?.message ?? "verification failed"); }
}
