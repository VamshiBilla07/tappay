import React, { useEffect, useReducer, useRef, useState } from "react";
import { Button, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import { formatUnits, parseUnits } from "viem";
import { decode, encode, createSignedRequest, payEth, payUsdc, quoteEthIn, reduce, verifyRequest, watchSettlement,
  SignedRequest, Verification } from "@pos/shared";
import { importAccount, loadAccount, publicClient, walletFor } from "./src/wallet";
import { readTag, startEmitting, stopEmitting } from "./src/nfc";

export default function App() {
  const [mode, setMode] = useState<"merchant" | "customer" | null>(null);
  return (
    <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.pad}>
      <Text style={s.h1}>BasePOS (Base Sepolia)</Text>
      {!mode ? (<>
        <Button title="I'm the merchant" onPress={() => setMode("merchant")} />
        <View style={{ height: 12 }} />
        <Button title="I'm the customer" onPress={() => setMode("customer")} />
      </>) : (<>
        <Button title="← Switch role" onPress={() => setMode(null)} />
        {mode === "merchant" ? <Merchant /> : <Customer />}
      </>)}
    </ScrollView></SafeAreaView>
  );
}

function Merchant() {
  const [ens, setEns] = useState("");
  const [amount, setAmount] = useState("");
  const [addr, setAddr] = useState("");
  const [pkInput, setPkInput] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [st, dispatch] = useReducer(reduce, { s: "idle" });
  const [payload, setPayload] = useState<string>();
  const unwatch = useRef<() => void>();

  useEffect(() => { loadAccount("merchant").then((a) => setAddr(a.address)); }, []);
  useEffect(() => { const t = setInterval(() => dispatch({ t: "TICK", now: Date.now() / 1000 }), 1000); return () => clearInterval(t); }, []);

  async function start() {
    const account = await loadAccount("merchant");
    const signed = await createSignedRequest(account, ens.trim(), parseUnits(amount, 6));
    const text = encode(signed);
    setPayload(text);
    dispatch({ t: "REQUEST", expiry: Number(signed.req.expiry) });
    startEmitting(text).catch(() => {}); // NFC where supported; QR is always shown
    unwatch.current?.();
    unwatch.current = watchSettlement(publicClient as any, account.address, signed.req.nonce, (tx) => {
      dispatch({ t: "CONFIRMED", tx }); stopEmitting().catch(() => {});
    });
  }
  async function doImport() {
    try {
      const a = await importAccount("merchant", pkInput);
      setAddr(a.address); setPkInput(""); setImportMsg("Imported. Signer is now " + a.address);
    } catch (e: any) { setImportMsg("Import failed: " + e.message); }
  }
  const reset = () => { unwatch.current?.(); stopEmitting().catch(() => {}); setPayload(undefined); dispatch({ t: "RESET" }); };

  return (<View>
    <Text style={s.h2}>Merchant</Text>
    <Text selectable style={s.mono}>Signer: {addr}</Text>
    {st.s === "idle" && (<View style={s.card}>
      <Text>Use my own wallet (testnet key of the wallet that owns your ENS name)</Text>
      <TextInput style={s.in} value={pkInput} onChangeText={setPkInput} autoCapitalize="none" autoCorrect={false}
        secureTextEntry placeholder="0x… private key (testnet only)" />
      <Button title="Import key" disabled={!pkInput} onPress={doImport} />
      {!!importMsg && <Text style={s.mono}>{importMsg}</Text>}
    </View>)}
    <Text>ENS name (must resolve to the signer on Sepolia and have it as primary name)</Text>
    <TextInput style={s.in} value={ens} onChangeText={setEns} autoCapitalize="none" placeholder="shop.eth" />
    <Text>Amount (USDC)</Text>
    <TextInput style={s.in} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="5.00" />
    {st.s === "idle" && <Button title="Request payment" disabled={!ens || !amount} onPress={start} />}
    {st.s === "requested" && payload && (<View style={s.center}>
      <QRCode value={payload} size={260} ecl="L" />
      <Text>Waiting for payment · hold phones together for NFC</Text></View>)}
    {st.s === "confirmed" && <Text style={s.ok}>✅ Paid. Tx {st.tx.slice(0, 12)}…</Text>}
    {st.s === "expired" && <Text style={s.bad}>Request expired</Text>}
    {st.s !== "idle" && <Button title="New request" onPress={reset} />}
  </View>);
}

function Customer() {
  const [st, dispatch] = useReducer(reduce, { s: "idle" });
  const [signed, setSigned] = useState<SignedRequest>();
  const [ver, setVer] = useState<Verification>();
  const [useEth, setUseEth] = useState(false);
  const [ethEst, setEthEst] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [perm, askPerm] = useCameraPermissions();
  const [addr, setAddr] = useState("");
  useEffect(() => { loadAccount("customer").then((a) => setAddr(a.address)); }, []);

  async function onPayload(text: string) {
    setScanning(false); dispatch({ t: "RESET" }); setVer(undefined);
    try {
      const d = decode(text); setSigned(d); dispatch({ t: "SCAN" }); dispatch({ t: "VERIFY_START" });
      const v = await verifyRequest(d); setVer(v);
      v.ok ? dispatch({ t: "VERIFY_OK" }) : dispatch({ t: "VERIFY_FAIL", reason: v.error ?? "Merchant could not be verified" });
    } catch (e: any) { dispatch({ t: "SCAN" }); dispatch({ t: "VERIFY_START" }); dispatch({ t: "VERIFY_FAIL", reason: e.message }); }
  }
  useEffect(() => { if (signed && useEth) quoteEthIn(publicClient as any, signed.req.amount).then((q) => setEthEst(formatUnits(q.maxIn, 18))).catch(() => setEthEst("quote unavailable")); }, [useEth, signed]);

  async function confirm() {
    if (st.s !== "verified" || !signed || !ver?.ok) return; // hard gate: nothing proceeds without a passing verification
    try {
      const wc = walletFor(await loadAccount("customer"));
      const step = (m: string) => dispatch({ t: "SUBMIT", step: m });
      step("Starting");
      const rcpt = useEth ? await payEth(publicClient as any, wc, signed, step) : await payUsdc(publicClient as any, wc, signed, step);
      rcpt.status === "success" ? dispatch({ t: "CONFIRMED", tx: rcpt.transactionHash }) : dispatch({ t: "FAILED", error: "Reverted" });
    } catch (e: any) { dispatch({ t: "FAILED", error: e.shortMessage ?? e.message }); }
  }

  const C = ({ ok, label }: { ok: boolean; label: string }) => <Text style={ok ? s.ok : s.bad}>{ok ? "✓" : "✗"} {label}</Text>;
  return (<View>
    <Text style={s.h2}>Customer</Text>
    <Text selectable style={s.mono}>Wallet: {addr}</Text>
    {(st.s === "idle" || st.s === "rejected" || st.s === "failed") && (<>
      <Button title="Tap to pay (NFC)" onPress={() => readTag().then(onPayload).catch((e) => dispatch({ t: "FAILED", error: e.message }))} />
      <View style={{ height: 8 }} />
      <Button title="Scan QR instead" onPress={async () => { if (!perm?.granted) await askPerm(); setScanning(true); }} />
    </>)}
    {scanning && <CameraView style={{ height: 320 }} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => onPayload(data)} />}
    {st.s === "verifying" && <Text>Verifying merchant…</Text>}
    {signed && ver && (<View style={s.card}>
      <Text style={s.h2}>{ver.ensName}</Text>
      <Text style={s.mono}>{signed.req.merchant}</Text>
      <Text style={s.big}>{formatUnits(signed.req.amount, 6)} USDC</Text>
      <C ok={ver.checks.signature} label="Signed by merchant" />
      <C ok={ver.checks.ensForward} label="ENS name resolves to this address" />
      <C ok={ver.checks.ensReverse} label="Address's primary ENS name matches" />
      <C ok={ver.checks.notExpired && ver.checks.chain && ver.checks.contract && ver.checks.token} label="Fresh, correct chain/contract/token" />
    </View>)}
    {st.s === "rejected" && <Text style={s.bad}>Blocked: {st.reason}</Text>}
    {(st.s === "verified" || st.s === "submitting") && (<>
      <View style={s.row}><Text>Pay with ETH (swap)</Text><Switch value={useEth} onValueChange={setUseEth} disabled={st.s === "submitting"} /></View>
      {useEth && <Text>Max ETH spend ≈ {ethEst ?? "…"} (unused ETH refunded; merchant gets exact USDC)</Text>}
      <Button title={st.s === "submitting" ? st.step + "…" : "Confirm & pay"} disabled={st.s === "submitting"} onPress={confirm} />
    </>)}
    {st.s === "confirmed" && <Text style={s.ok}>✅ Payment confirmed {st.tx.slice(0, 12)}…</Text>}
    {st.s === "failed" && <Text style={s.bad}>Failed: {st.error}</Text>}
  </View>);
}

const s = StyleSheet.create({
  root: { flex: 1 }, pad: { padding: 20, gap: 8 }, h1: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: "600", marginTop: 12 }, big: { fontSize: 28, fontWeight: "700", marginVertical: 8 },
  in: { borderWidth: 1, borderColor: "#999", borderRadius: 6, padding: 8, marginBottom: 8 },
  mono: { fontFamily: "monospace", fontSize: 11 }, ok: { color: "#0a7d2c" }, bad: { color: "#b00020" },
  center: { alignItems: "center", gap: 8, marginVertical: 12 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  card: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginVertical: 8 },
});
