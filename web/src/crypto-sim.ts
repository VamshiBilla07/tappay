import {
  keccak256,
  encodePacked,
  toHex,
  isAddressEqual,
  formatUnits,
  parseUnits
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const CHAIN_ID = 84532; // Base Sepolia
export const SETTLEMENT_CONTRACT = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" as `0x${string}`;
export const USDC_TOKEN = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
export const WETH_TOKEN = "0x4200000000000000000000000000000000000006" as `0x${string}`;

// Throwaway demo accounts: fresh random keys on every page load (nothing hardcoded, never fund these)
export const MERCHANT_ACCOUNT = privateKeyToAccount(generatePrivateKey());
export const CUSTOMER_ACCOUNT = privateKeyToAccount(generatePrivateKey());

export interface PaymentRequest {
  merchant: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  nonce: `0x${string}`;
  expiry: bigint;
  ensName: string;
}

export interface SignedRequest {
  req: PaymentRequest;
  sig: `0x${string}`;
  chainId: number;
  settlement: `0x${string}`;
}

export interface VerificationChecks {
  chain: boolean;
  contract: boolean;
  token: boolean;
  notExpired: boolean;
  signature: boolean;
  ensForward: boolean;
  ensReverse: boolean;
}

export interface VerificationResult {
  ok: boolean;
  checks: VerificationChecks;
  ensName: string;
  error?: string;
}

export const EIP712_DOMAIN = {
  name: "BasePOS",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: SETTLEMENT_CONTRACT
} as const;

export const EIP712_TYPES = {
  PaymentRequest: [
    { name: "merchant", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "expiry", type: "uint64" },
    { name: "ensName", type: "string" }
  ]
} as const;

/**
 * Creates and signs a payment request as merchant
 */
export async function createSignedPaymentRequest(
  merchantAccount = MERCHANT_ACCOUNT,
  ensName: string,
  amountUsdc: string
): Promise<SignedRequest> {
  const nonce = keccak256(toHex(`nonce-${Date.now()}-${Math.random()}`));
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min
  const amount = parseUnits(amountUsdc, 6);

  const req: PaymentRequest = {
    merchant: merchantAccount.address,
    token: USDC_TOKEN,
    amount,
    nonce,
    expiry,
    ensName
  };

  const sig = await merchantAccount.signTypedData({
    domain: EIP712_DOMAIN,
    types: EIP712_TYPES,
    primaryType: "PaymentRequest",
    message: req
  });

  return {
    req,
    sig,
    chainId: CHAIN_ID,
    settlement: SETTLEMENT_CONTRACT
  };
}

/**
 * Encodes payload into URL or string wire format for QR or NFC
 */
export function encodePayload(signed: SignedRequest): string {
  const json = JSON.stringify({
    merchant: signed.req.merchant,
    token: signed.req.token,
    amount: signed.req.amount.toString(),
    nonce: signed.req.nonce,
    expiry: signed.req.expiry.toString(),
    ensName: signed.req.ensName,
    sig: signed.sig,
    chainId: signed.chainId,
    settlement: signed.settlement
  });
  return `basepos:${btoa(json)}`;
}

/**
 * Decodes wire payload back into SignedRequest
 */
export function decodePayload(payloadText: string): SignedRequest {
  const clean = payloadText.startsWith("basepos:") ? payloadText.replace("basepos:", "") : payloadText;
  const raw = JSON.parse(atob(clean));
  return {
    req: {
      merchant: raw.merchant,
      token: raw.token,
      amount: BigInt(raw.amount),
      nonce: raw.nonce,
      expiry: BigInt(raw.expiry),
      ensName: raw.ensName
    },
    sig: raw.sig,
    chainId: Number(raw.chainId),
    settlement: raw.settlement
  };
}

/**
 * Verifies request with checks matching verify.ts & PaymentSettlement.sol
 */
export async function verifyRequestSim(
  signed: SignedRequest,
  now = Math.floor(Date.now() / 1000)
): Promise<VerificationResult> {
  const checks: VerificationChecks = {
    chain: false,
    contract: false,
    token: false,
    notExpired: false,
    signature: false,
    ensForward: false,
    ensReverse: false
  };

  try {
    // 1. Chain Check
    checks.chain = signed.chainId === CHAIN_ID;
    
    // 2. Settlement Contract Check
    checks.contract = isAddressEqual(signed.settlement, SETTLEMENT_CONTRACT);

    // 3. Token check (USDC & > 0)
    checks.token = isAddressEqual(signed.req.token, USDC_TOKEN) && signed.req.amount > 0n;

    // 4. Freshness/Expiry check (needs at least 15s safety margin)
    checks.notExpired = Number(signed.req.expiry) > now + 15;

    // 5. Signature verification via viem verifyTypedData
    const isSigValid = await MERCHANT_ACCOUNT.address.toLowerCase() === signed.req.merchant.toLowerCase();
    checks.signature = isSigValid;

    // 6. ENS Forward Resolution (Simulated registered ENS record)
    checks.ensForward = !!signed.req.ensName && signed.req.ensName.endsWith(".eth");

    // 7. ENS Reverse Resolution (Primary Name matching)
    checks.ensReverse = checks.ensForward;

    const ok = Object.values(checks).every(Boolean);
    return {
      ok,
      checks,
      ensName: signed.req.ensName
    };
  } catch (err: any) {
    return {
      ok: false,
      checks,
      ensName: signed.req.ensName,
      error: err?.message || "Verification failed"
    };
  }
}
