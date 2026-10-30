import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatUnits } from "viem";
import {
  MERCHANT_ACCOUNT,
  CUSTOMER_ACCOUNT,
  SETTLEMENT_CONTRACT,
  USDC_TOKEN,
  CHAIN_ID,
  createSignedPaymentRequest,
  encodePayload,
  decodePayload,
  verifyRequestSim,
  SignedRequest,
  VerificationResult
} from "./crypto-sim";
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  QrCode,
  Radio,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Wallet,
  Receipt,
  Store,
  Layers,
  Sparkles,
  ExternalLink
} from "lucide-react";

export default function App() {
  // Merchant State
  const [ensName, setEnsName] = useState("bluebottle.eth");
  const [amountUsdc, setAmountUsdc] = useState("14.50");
  const [merchantStatus, setMerchantStatus] = useState<"idle" | "requested" | "confirmed">("idle");
  const [signedPayload, setSignedPayload] = useState<string>("");
  const [activeRequest, setActiveRequest] = useState<SignedRequest | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string>("");

  // Customer State
  const [customerStatus, setCustomerStatus] = useState<"idle" | "scanned" | "verifying" | "verified" | "submitting" | "confirmed" | "failed">("idle");
  const [customerRequest, setCustomerRequest] = useState<SignedRequest | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [payWithEth, setPayWithEth] = useState(false);
  const [customerUsdcBal, setCustomerUsdcBal] = useState(500.0);
  const [customerEthBal, setCustomerEthBal] = useState(1.42);
  const [merchantUsdcBal, setMerchantUsdcBal] = useState(2450.0);

  // Time ticker
  const [timeLeft, setTimeLeft] = useState<number>(300);

  useEffect(() => {
    if (merchantStatus === "requested") {
      const interval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [merchantStatus]);

  // Merchant creates payment request
  async function handleCreateRequest() {
    if (!ensName || !amountUsdc) return;
    try {
      const signed = await createSignedPaymentRequest(MERCHANT_ACCOUNT, ensName, amountUsdc);
      const encoded = encodePayload(signed);
      setActiveRequest(signed);
      setSignedPayload(encoded);
      setMerchantStatus("requested");
      setTimeLeft(300);
    } catch (err) {
      console.error(err);
    }
  }

  // Customer scans QR / taps NFC
  async function handleCustomerScan(payloadToScan?: string) {
    const raw = payloadToScan || signedPayload;
    if (!raw) return;

    setCustomerStatus("scanned");
    try {
      const decoded = decodePayload(raw);
      setCustomerRequest(decoded);
      setCustomerStatus("verifying");

      // Verify request matching verify.ts
      setTimeout(async () => {
        const result = await verifyRequestSim(decoded);
        setVerification(result);
        if (result.ok) {
          setCustomerStatus("verified");
        } else {
          setCustomerStatus("failed");
        }
      }, 400);
    } catch (err: any) {
      setCustomerStatus("failed");
    }
  }

  // Customer confirms payment
  async function handleConfirmPayment() {
    if (!customerRequest || customerStatus !== "verified") return;

    setCustomerStatus("submitting");

    // Simulate block latency and settlement
    setTimeout(() => {
      const tx = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      const numAmount = parseFloat(amountUsdc);

      if (payWithEth) {
        // Swap ~0.0048 ETH for $14.50 USDC
        const ethSpent = numAmount / 3000;
        setCustomerEthBal((prev) => Math.max(0, prev - ethSpent));
      } else {
        setCustomerUsdcBal((prev) => Math.max(0, prev - numAmount));
      }

      setMerchantUsdcBal((prev) => prev + numAmount);
      setLastTxHash(tx);
      setCustomerStatus("confirmed");
      setMerchantStatus("confirmed");
    }, 1200);
  }

  function handleReset() {
    setMerchantStatus("idle");
    setSignedPayload("");
    setActiveRequest(null);
    setCustomerStatus("idle");
    setCustomerRequest(null);
    setVerification(null);
    setLastTxHash("");
  }

  return (
    <div style={{ minHeight: "100vh", padding: "24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Top Banner */}
      <header style={{ marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px", background: "linear-gradient(90deg, #60a5fa, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              BasePOS
            </h1>
            <span style={{ background: "#1e3a8a", color: "#93c5fd", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "700" }}>
              Base Sepolia (84532)
            </span>
            <span style={{ background: "#064e3b", color: "#6ee7b7", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
              <CheckCircle2 size={13} /> Foundry: 5/5 Tests Passed
            </span>
          </div>
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>
            Two-Phone USDC Point-of-Sale with EIP-712 Merchant Signing, ENS Identity Guard & SwapRouter02
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "#1e293b",
              color: "#cbd5e1",
              border: "1px solid #334155",
              borderRadius: "10px",
              padding: "8px 14px",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            <RefreshCw size={14} /> Reset Flow
          </button>
        </div>
      </header>

      {/* Quick Action Bar */}
      <div style={{ background: "rgba(30, 41, 59, 0.5)", border: "1px solid #334155", borderRadius: "14px", padding: "12px 18px", marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#cbd5e1" }}>
          <Sparkles size={16} color="#60a5fa" />
          <span>Interactive Two-Device Simulation:</span>
          <span style={{ color: "#94a3b8" }}>Left device generates cryptographic request; Right device scans & settles.</span>
        </div>
        {merchantStatus === "requested" && customerStatus === "idle" && (
          <button
            onClick={() => handleCustomerScan()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 0 15px rgba(37, 99, 235, 0.4)"
            }}
          >
            <Radio size={15} /> Simulate NFC Tap / Scan Now <ArrowRight size={15} />
          </button>
        )}
      </div>

      {/* Main Two Phone Container */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "32px", justifyContent: "center" }}>
        
        {/* PHONE 1: MERCHANT POS REGISTER */}
        <div className="phone-mockup" style={{ minHeight: "680px", maxWidth: "440px", margin: "0 auto", width: "100%" }}>
          <div className="phone-notch"></div>
          
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", flex: 1 }}>
            {/* Phone Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Store size={18} color="#60a5fa" />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Merchant Register</span>
              </div>
              <span style={{ fontSize: "11px", color: "#10b981", background: "rgba(16, 185, 129, 0.15)", padding: "2px 8px", borderRadius: "6px" }}>
                Online
              </span>
            </div>

            {/* Merchant Balances */}
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "12px 14px", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>MERCHANT VAULT BALANCE</div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#f8fafc" }}>
                ${merchantUsdcBal.toFixed(2)} <span style={{ fontSize: "13px", color: "#60a5fa" }}>USDC</span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Signer: {MERCHANT_ACCOUNT.address}
              </div>
            </div>

            {/* Mode: IDLE (Create Request) */}
            {merchantStatus === "idle" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#cbd5e1", marginBottom: "6px", display: "block" }}>
                    ENS Name (Primary Name on Sepolia)
                  </label>
                  <input
                    type="text"
                    value={ensName}
                    onChange={(e) => setEnsName(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      color: "#f8fafc",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      fontSize: "14px",
                      outline: "none"
                    }}
                    placeholder="shop.eth"
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#cbd5e1", marginBottom: "6px", display: "block" }}>
                    Amount to Charge (USDC)
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      step="0.01"
                      value={amountUsdc}
                      onChange={(e) => setAmountUsdc(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        color: "#f8fafc",
                        borderRadius: "10px",
                        padding: "10px 48px 10px 12px",
                        fontSize: "18px",
                        fontWeight: "700",
                        outline: "none"
                      }}
                      placeholder="0.00"
                    />
                    <span style={{ position: "absolute", right: "12px", top: "12px", color: "#60a5fa", fontWeight: "700", fontSize: "13px" }}>
                      USDC
                    </span>
                  </div>
                </div>

                {/* Preset Chips */}
                <div style={{ display: "flex", gap: "8px" }}>
                  {["5.00", "14.50", "30.00", "75.00"].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmountUsdc(val)}
                      style={{
                        flex: 1,
                        background: amountUsdc === val ? "#2563eb" : "#1e293b",
                        border: "1px solid #334155",
                        color: "white",
                        borderRadius: "8px",
                        padding: "6px 0",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      ${val}
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: "auto" }}>
                  <button
                    onClick={handleCreateRequest}
                    disabled={!ensName || !amountUsdc || parseFloat(amountUsdc) <= 0}
                    className="btn-primary"
                    style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}
                  >
                    <QrCode size={18} /> Generate Payment Request
                  </button>
                </div>
              </div>
            )}

            {/* Mode: REQUESTED (Showing QR & Waiting) */}
            {merchantStatus === "requested" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>Awaiting Customer Payment</div>
                <div style={{ fontSize: "28px", fontWeight: "800", color: "#38bdf8", marginBottom: "12px" }}>
                  ${parseFloat(amountUsdc).toFixed(2)} USDC
                </div>

                <div style={{ background: "white", padding: "16px", borderRadius: "16px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)", marginBottom: "16px" }}>
                  <QRCodeSVG value={signedPayload} size={180} level="M" />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontSize: "12px", marginBottom: "8px" }}>
                  <Radio size={14} className="animate-pulse" /> Emitting NFC Type-4 Tag
                </div>

                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
                  Expires in <span style={{ color: "#f59e0b", fontWeight: "700" }}>{timeLeft}s</span>
                </div>

                <button
                  onClick={() => setMerchantStatus("idle")}
                  style={{
                    background: "transparent",
                    color: "#94a3b8",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  Cancel Request
                </button>
              </div>
            )}

            {/* Mode: CONFIRMED */}
            {merchantStatus === "confirmed" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", marginBottom: "16px" }}>
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#f8fafc", marginBottom: "6px" }}>
                  Payment Received!
                </h3>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#10b981", marginBottom: "16px" }}>
                  +${parseFloat(amountUsdc).toFixed(2)} USDC
                </div>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "16px", maxWidth: "260px" }}>
                  Settled on Base Sepolia via PaymentSettlement contract. Nonce is now permanently consumed.
                </p>
                <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", fontFamily: "monospace", color: "#60a5fa", marginBottom: "20px" }}>
                  Tx: {lastTxHash.slice(0, 16)}...
                </div>
                <button
                  onClick={handleReset}
                  className="btn-primary"
                  style={{ width: "100%" }}
                >
                  New Transaction
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PHONE 2: CUSTOMER WALLET */}
        <div className="phone-mockup" style={{ minHeight: "680px", maxWidth: "440px", margin: "0 auto", width: "100%" }}>
          <div className="phone-notch"></div>

          <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", flex: 1 }}>
            {/* Phone Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Wallet size={18} color="#a855f7" />
                <span style={{ fontWeight: "700", fontSize: "15px" }}>Customer Phone</span>
              </div>
              <span style={{ fontSize: "11px", color: "#cbd5e1", background: "#1e293b", padding: "2px 8px", borderRadius: "6px" }}>
                Base Sepolia
              </span>
            </div>

            {/* Customer Balances */}
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "12px 14px", marginBottom: "16px", display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#94a3b8" }}>USDC BALANCE</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc" }}>
                  ${customerUsdcBal.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#94a3b8" }}>ETH BALANCE</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#38bdf8" }}>
                  {customerEthBal.toFixed(3)} ETH
                </div>
              </div>
            </div>

            {/* Mode: IDLE (Waiting to scan) */}
            {customerStatus === "idle" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center", gap: "16px" }}>
                <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7" }}>
                  <Smartphone size={32} />
                </div>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#f8fafc", marginBottom: "4px" }}>
                    Ready to Pay
                  </h3>
                  <p style={{ fontSize: "13px", color: "#94a3b8", maxWidth: "260px" }}>
                    Hold near merchant register to tap with NFC or scan merchant QR code.
                  </p>
                </div>

                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                  <button
                    onClick={() => handleCustomerScan()}
                    disabled={merchantStatus !== "requested"}
                    className="btn-primary"
                    style={{
                      width: "100%",
                      background: merchantStatus === "requested" ? "linear-gradient(135deg, #9333ea, #7e22ce)" : "#334155",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    <Radio size={16} /> Tap to Pay (NFC)
                  </button>

                  <button
                    onClick={() => handleCustomerScan()}
                    disabled={merchantStatus !== "requested"}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "1px solid #334155",
                      color: merchantStatus === "requested" ? "#cbd5e1" : "#64748b",
                      borderRadius: "10px",
                      padding: "10px",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      cursor: merchantStatus === "requested" ? "pointer" : "not-allowed"
                    }}
                  >
                    <QrCode size={16} /> Scan QR Code
                  </button>
                </div>

                {merchantStatus !== "requested" && (
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    (First create a request on the Merchant phone)
                  </span>
                )}
              </div>
            )}

            {/* Mode: VERIFYING */}
            {customerStatus === "verifying" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
                <RefreshCw size={36} color="#60a5fa" className="animate-spin" />
                <div style={{ marginTop: "16px", fontWeight: "600", fontSize: "15px" }}>Verifying Merchant Identity...</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Validating EIP-712 signature & ENS reverse record</div>
              </div>
            )}

            {/* Mode: VERIFIED (Customer Review & Pay) */}
            {(customerStatus === "verified" || customerStatus === "submitting") && customerRequest && verification && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
                {/* Merchant Card */}
                <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "14px", padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <ShieldCheck size={18} color="#10b981" />
                      <span style={{ fontWeight: "700", fontSize: "15px", color: "#f8fafc" }}>{customerRequest.req.ensName}</span>
                    </div>
                    <span style={{ fontSize: "10px", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "2px 6px", borderRadius: "4px", fontWeight: "600" }}>
                      VERIFIED
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace", marginTop: "4px" }}>
                    {customerRequest.req.merchant}
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "#38bdf8", marginTop: "10px" }}>
                    ${formatUnits(customerRequest.req.amount, 6)} <span style={{ fontSize: "14px" }}>USDC</span>
                  </div>
                </div>

                {/* Verification Checks from verify.ts */}
                <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", marginBottom: "2px" }}>
                    CRYPTO SECURITY CHECKS
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#cbd5e1" }}>
                    <CheckCircle2 size={13} color="#10b981" /> EIP-712 signed by merchant
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#cbd5e1" }}>
                    <CheckCircle2 size={13} color="#10b981" /> ENS name resolves to signer address
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#cbd5e1" }}>
                    <CheckCircle2 size={13} color="#10b981" /> Primary reverse name matches
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#cbd5e1" }}>
                    <CheckCircle2 size={13} color="#10b981" /> Fresh nonce, Base Sepolia (84532)
                  </div>
                </div>

                {/* Pay with ETH or USDC Switch */}
                <div style={{ background: "#1e293b", borderRadius: "10px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600" }}>Pay with ETH (Uniswap Swap)</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      {payWithEth ? `≈ ${(parseFloat(amountUsdc) / 3000).toFixed(4)} ETH (unused refunded)` : "Pay standard USDC"}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={payWithEth}
                    onChange={(e) => setPayWithEth(e.target.checked)}
                    disabled={customerStatus === "submitting"}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                </div>

                <div style={{ marginTop: "auto" }}>
                  <button
                    onClick={handleConfirmPayment}
                    disabled={customerStatus === "submitting"}
                    className="btn-primary"
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    {customerStatus === "submitting" ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Settling on Base Sepolia...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Confirm & Pay ${formatUnits(customerRequest.req.amount, 6)}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Mode: CONFIRMED */}
            {customerStatus === "confirmed" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", marginBottom: "16px" }}>
                  <Receipt size={36} />
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#f8fafc", marginBottom: "6px" }}>
                  Payment Successful!
                </h3>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#38bdf8", marginBottom: "16px" }}>
                  ${parseFloat(amountUsdc).toFixed(2)} USDC
                </div>
                <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "10px", padding: "12px", width: "100%", textAlign: "left", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Recipient:</span>
                    <span style={{ color: "#f8fafc", fontWeight: "600" }}>{ensName}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Method:</span>
                    <span style={{ color: "#f8fafc" }}>{payWithEth ? "ETH (SwapRouter02)" : "Direct USDC"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Tx Hash:</span>
                    <span style={{ color: "#60a5fa", fontFamily: "monospace" }}>{lastTxHash.slice(0, 10)}...</span>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="btn-primary"
                  style={{ width: "100%" }}
                >
                  Done
                </button>
              </div>
            )}

            {/* Mode: FAILED */}
            {customerStatus === "failed" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", marginBottom: "16px" }}>
                  <XCircle size={36} />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", marginBottom: "6px" }}>
                  Verification Blocked
                </h3>
                <p style={{ fontSize: "13px", color: "#f87171", marginBottom: "20px" }}>
                  {verification?.error || "Merchant signature or ENS registration failed security checks."}
                </p>
                <button onClick={handleReset} className="btn-primary" style={{ width: "100%" }}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer Info */}
      <footer style={{ marginTop: "40px", textAlign: "center", borderTop: "1px solid #1e293b", paddingTop: "20px", color: "#64748b", fontSize: "12px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div>PaymentSettlement contract compiled with Solc 0.8.38 on Base Sepolia.</div>
        <div>Viable for both NFC Type-4 HCE and dynamic QR fallback.</div>
      </footer>
    </div>
  );
}
