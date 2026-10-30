import { createPublicClient, getAddress, http, isAddressEqual } from "viem";
import { normalize } from "viem/ens";
import { CHAIN, ENS_CHAIN, ENS_RPC, EXPIRY_SAFETY_SECONDS, SETTLEMENT, USDC } from "./config";
import { SignedRequest, recoverSigner } from "./request";

const ensClient = createPublicClient({ chain: ENS_CHAIN, transport: http(ENS_RPC) });

export interface Verification {
  ok: boolean; // true only if EVERY check passes. The UI must gate "Confirm" on this.
  checks: { chain: boolean; contract: boolean; token: boolean; notExpired: boolean; signature: boolean; ensForward: boolean; ensReverse: boolean };
  ensName: string; error?: string;
}

export async function verifyRequest(p: SignedRequest & { chainId: number; settlement: `0x${string}` },
  now = Math.floor(Date.now() / 1000)): Promise<Verification> {
  const checks = { chain: false, contract: false, token: false, notExpired: false, signature: false, ensForward: false, ensReverse: false };
  const out = (error?: string): Verification => ({ ok: Object.values(checks).every(Boolean), checks, ensName: p.req.ensName, error });
  try {
    checks.chain = p.chainId === CHAIN.id;
    checks.contract = isAddressEqual(p.settlement, SETTLEMENT);
    checks.token = isAddressEqual(p.req.token, USDC) && p.req.amount > 0n;
    checks.notExpired = Number(p.req.expiry) > now + EXPIRY_SAFETY_SECONDS;
    checks.signature = isAddressEqual(await recoverSigner(p), p.req.merchant);
    const name = normalize(p.req.ensName);
    const fwd = await ensClient.getEnsAddress({ name });                 // name -> address
    checks.ensForward = !!fwd && isAddressEqual(fwd, getAddress(p.req.merchant));
    const rev = await ensClient.getEnsName({ address: p.req.merchant }); // address -> primary name
    checks.ensReverse = rev?.toLowerCase() === name.toLowerCase();
    return out();
  } catch (e: any) { return out(e?.shortMessage ?? e?.message ?? "verification failed"); }
}
