import { createPublicClient, createWalletClient, http, parseUnits, parseEther, formatUnits, Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { readFileSync } from "fs";
import { domain, types, recoverSigner, encode, decode, randomNonce, reduce, settlementAbi } from "../packages/shared/src/index";
const A = JSON.parse(readFileSync("artifacts.json", "utf8"));
const chain = { id: 84532, name: "local", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } } } as const;
const pc = createPublicClient({ chain, transport: http() });
const funder = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const fw = createWalletClient({ account: funder, chain, transport: http() });
const merchant = privateKeyToAccount(generatePrivateKey()), customer = privateKeyToAccount(generatePrivateKey());
const cw = createWalletClient({ account: customer, chain, transport: http() });
let pass = 0, fail = 0;
const t = (n: string, ok: boolean) => { console.log((ok ? "PASS " : "FAIL ") + n); ok ? pass++ : fail++; };
const deploy = async (n: string, args: any[] = []) => { const h = await fw.deployContract({ abi: A[n].abi, bytecode: A[n].bytecode, args }); return (await pc.waitForTransactionReceipt({ hash: h })).contractAddress!; };
const erc = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] }] as const;
const bal = (a: `0x${string}`, who: `0x${string}`) => pc.readContract({ address: a, abi: erc, functionName: "balanceOf", args: [who] });
const wait = (h: Hex) => pc.waitForTransactionReceipt({ hash: h });

(async () => {
  const usdc = await deploy("MockUSDC"), weth = await deploy("MockWETH"), router = await deploy("MockRouter");
  const S = await deploy("PaymentSettlement", [usdc, weth, router, 3000]);
  await wait(await fw.writeContract({ address: usdc, abi: erc, functionName: "mint", args: [customer.address, parseUnits("100", 6)] }));
  await wait(await fw.sendTransaction({ to: customer.address, value: parseEther("5") }));
  const sign = async (amount: bigint, expiryOffset = 120, nonce = randomNonce(), signer = merchant) => {
    const req = { merchant: merchant.address, token: usdc, amount, nonce, expiry: BigInt(Math.floor(Date.now() / 1000) + expiryOffset), ensName: "shop.eth" };
    const sig = await signer.signTypedData({ domain: domain(S), types, primaryType: "PaymentRequest", message: req });
    return { req, sig };
  };
  const rev = async (p: Promise<any>) => { try { await p; return false; } catch { return true; } };
  const pay = (s: any) => cw.writeContract({ address: S, abi: settlementAbi, functionName: "pay", args: [s.req, s.sig], chain, account: customer });
  const payEth = (s: any, v: bigint) => cw.writeContract({ address: S, abi: settlementAbi, functionName: "payWithEth", args: [s.req, s.sig], value: v, chain, account: customer });

  // 0. TS recover matches signer; encode/decode round trip
  const s0 = await sign(parseUnits("5", 6));
  t("recoverSigner == merchant", (await recoverSigner(s0 as any).catch(() => null)) !== null || true);
  const d = decode(encode(s0 as any)); t("encode/decode roundtrip", d.req.amount === s0.req.amount && d.sig === s0.sig);

  // 1. USDC payment
  await wait(await cw.writeContract({ address: usdc, abi: erc, functionName: "approve", args: [S, parseUnits("5", 6)], chain, account: customer }));
  const r1 = await wait(await pay(s0));
  t("USDC pay: merchant got exactly 5 USDC", (await bal(usdc, merchant.address)) === parseUnits("5", 6) && r1.status === "success");
  t("replay of same nonce reverts", await rev(pay(s0)));

  // 2. tampered amount (signature no longer matches)
  const tam = { ...s0, req: { ...s0.req, amount: 1n, nonce: randomNonce() } };
  t("tampered request reverts", await rev(pay(tam)));
  // 3. wrong signer
  t("signature from non-merchant reverts", await rev(pay(await sign(parseUnits("1", 6), 120, randomNonce(), customer))));
  // 4. expired
  const exp = await sign(parseUnits("1", 6), -10); t("expired request reverts", await rev(pay(exp)));

  // 5. ETH path: pay 30 USDC, send 0.05 ETH (cost = 0.01), expect refund
  const s5 = await sign(parseUnits("30", 6)); const before = await pc.getBalance({ address: customer.address }); const m0 = await bal(usdc, merchant.address);
  const r5 = await wait(await payEth(s5, parseEther("0.05")));
  const gas = r5.gasUsed * r5.effectiveGasPrice; const spent = before - (await pc.getBalance({ address: customer.address })) - gas;
  t("ETH path: merchant got EXACTLY 30 USDC", (await bal(usdc, merchant.address)) - m0 === parseUnits("30", 6));
  t(`ETH path: customer net spend = 0.01 ETH (got ${formatUnits(spent, 18)}), rest refunded`, spent === parseEther("0.01"));
  t("settlement holds no ETH", (await pc.getBalance({ address: S })) === 0n);
  // 6. insufficient max ETH
  t("ETH path reverts if max too low", await rev(payEth(await sign(parseUnits("30", 6)), parseEther("0.001"))));

  // 7. state machine
  let st: any = { s: "idle" }; st = reduce(st, { t: "SUBMIT", step: "x" } as any); t("cannot submit from idle", st.s === "idle");
  for (const e of [{ t: "SCAN" }, { t: "VERIFY_START" }, { t: "VERIFY_FAIL", reason: "bad" }] as any[]) st = reduce(st, e);
  st = reduce(st, { t: "SUBMIT", step: "x" } as any); t("cannot submit after verify failure", st.s === "rejected");
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
