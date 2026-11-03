import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  Camera, CheckCircle2, Flashlight, Keyboard, Loader2, Nfc, QrCode, RefreshCw, ShieldCheck,
} from "lucide-react";
import Sheet from "./Sheet";
import { parseScan } from "../lib/payment-intent";
import { nfcErrorMessage, nfcSupport, startNfcRead } from "../lib/nfc";

function cameraErrorMessage(err) {
  switch (err?.name) {
    case "NotAllowedError":
      return "Camera permission blocked. Chrome settings → Site settings → Camera → Allow.";
    case "NotFoundError":
      return "No camera found. Paste a UPI ID or payment link below instead.";
    case "NotReadableError":
      return "Camera in use by another app. Close it, then retry.";
    case "NotSupportedError":
      return "Camera not supported. Paste a link below instead.";
    case "OverconstrainedError":
      return "Camera constraints not supported. Retry with default camera.";
    default:
      return err?.message || "Could not start camera. Paste a link below instead.";
  }
}

export default function ScannerModal({ initialTab = "qr", onClose, onScan }) {
  const [tab, setTab] = useState(initialTab === "nfc" ? "nfc" : "qr");
  const [cameraState, setCameraState] = useState("idle"); // idle | starting | live | error
  const [cameraError, setCameraError] = useState("");
  const [scanError, setScanError] = useState("");
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState("");
  const [nfcState, setNfcState] = useState("idle");
  const [nfcError, setNfcError] = useState("");
  const [nfcInfo, setNfcInfo] = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const [torchOn, setTorchOn] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const nfcAbortRef = useRef(null);
  const onScanRef = useRef(onScan);
  const support = nfcSupport();
  const retryCountRef = useRef(0);
  const lastDecodeRef = useRef(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
  }, []);

  const resolveIntent = useCallback((text) => {
    const raw = String(text ?? "").trim();
    if (!raw) return null;
    const intent = parseScan(raw);
    return intent.kind === "empty" || intent.kind === "text" ? null : intent;
  }, []);

  const finish = useCallback((text) => {
    setDebugInfo(`Scanned: ${text.substring(0, 60)}…`);
    const intent = resolveIntent(text);
    if (!intent) {
      setScanError("That QR is not a payment code. Try another QR.");
      return false;
    }
    stopCamera();
    nfcAbortRef.current?.abort();
    onScanRef.current(intent);
    return true;
  }, [resolveIntent, stopCamera]);

  const toggleTorch = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    try {
      const track = stream.getVideoTracks()[0];
      if (track.getCapabilities?.().torch) {
        const next = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: next }] });
        setTorchOn(next);
      }
    } catch {
      /* torch not available on this device */
    }
  };

  const startCamera = useCallback(async (isCancelled = () => false) => {
    stopCamera();
    setCameraState("starting");
    setCameraError("");
    setScanError("");
    setDebugInfo("Requesting camera access…");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("error");
      setCameraError("Camera API not available. Paste a UPI ID or link below instead.");
      return;
    }

    if (!window.isSecureContext) {
      setCameraState("error");
      setCameraError("Camera requires HTTPS. Open this page over https://, then retry.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
    } catch (err) {
      if (isCancelled()) return;
      setCameraState("error");
      setCameraError(cameraErrorMessage(err));
      retryCountRef.current += 1;
      if (retryCountRef.current <= 2) {
        setDebugInfo(`Retrying camera in 1s…`);
        setTimeout(() => void startCamera(() => cancelled), 1000);
      }
      return;
    }

    const cancelled = isCancelled();
    if (cancelled) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      stopCamera();
      setCameraError("Camera elements not ready. Retry camera.");
      return;
    }

    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* autoplay can reject while animating */
    }

    if (isCancelled()) {
      stopCamera();
      return;
    }
    setCameraState("live");
    setDebugInfo("Camera live. Point at QR code.");
    retryCountRef.current = 0;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    let lastTick = 0;
    const tick = (timestamp) => {
      if (isCancelled() || !context) return;
      if (timestamp - lastTick > 60) { // scan every 60ms for faster detection
        lastTick = timestamp;
        const currentVideo = videoRef.current;
        if (currentVideo && currentVideo.readyState >= 2 && currentVideo.videoWidth) {
          canvas.width = currentVideo.videoWidth;
          canvas.height = currentVideo.videoHeight;
          context.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
          try {
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, image.width, image.height, {
              inversionAttempts: "dontInvert",
            });
            if (code?.data) {
              const now = Date.now();
              if (now - lastDecodeRef.current > 500) {
                lastDecodeRef.current = now;
                if (finish(code.data)) return;
                setScanError("Not a payment QR. Try another.");
              }
            }
          } catch {
            /* image not ready */
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [finish, stopCamera, torchOn]);

  useEffect(() => {
    if (tab !== "qr") {
      stopCamera();
      return undefined;
    }
    let cancelled = false;
    void startCamera(() => cancelled);
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [tab, startCamera, stopCamera]);

  const stopNfc = useCallback(() => {
    nfcAbortRef.current?.abort();
    nfcAbortRef.current = null;
    setNfcState("idle");
    setNfcInfo("");
    setNfcError("");
  }, []);

  useEffect(() => {
    if (tab === "nfc") {
      setNfcState("idle");
      setNfcError("");
      setNfcInfo("");
      return undefined;
    }
    stopNfc();
    return undefined;
  }, [tab, stopNfc]);

  useEffect(() => () => {
    stopCamera();
    nfcAbortRef.current?.abort();
  }, [stopCamera]);

  const startNfc = useCallback(async () => {
    if (!support.supported || nfcState === "scanning") return;
    setNfcState("scanning");
    setNfcError("");
    setNfcInfo("Waiting for a tag. Hold your phone near it…");

    const controller = new AbortController();
    nfcAbortRef.current = controller;
    try {
      await startNfcRead({
        signal: controller.signal,
        onStarted: () => setNfcInfo("NFC armed. Hold phone near the tag."),
        onReading: ({ texts }) => {
          const text = texts.find(Boolean);
          if (!text) {
            setNfcState("error");
            setNfcError("This tag has no readable text.");
            return;
          }
          const intent = resolveIntent(text);
          if (!intent) {
            controller.abort();
            setNfcState("error");
            setNfcError("That tag is not a payment code.");
            return;
          }
          controller.abort();
          stopCamera();
          onScanRef.current(intent);
        },
        onError: (err) => {
          setNfcState("error");
          setNfcError(err.message);
        },
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      setNfcState("error");
      setNfcError(nfcErrorMessage(err));
    }
  }, [nfcState, resolveIntent, stopCamera, support.supported]);

  const submitManual = (event) => {
    event.preventDefault();
    setManualError("");
    const value = manual.trim();
    if (!value) return;
    setDebugInfo(`Manual: ${value.substring(0, 60)}…`);
    if (!finish(value)) {
      setManualError("Enter a UPI ID (name@bank), upi:// link, or TapPay /pay/plink_… URL.");
    }
  };

  const stepCamera = () => {
    retryCountRef.current = 0;
    setScanError("");
    setDebugInfo("Restarting camera…");
    void startCamera();
  };

  return (
    <Sheet
      title="Scan to pay"
      subtitle={tab === "qr" ? "Point camera at a UPI or TapPay QR" : "Tap an NFC tag or terminal"}
      onClose={onClose}
    >
      <div className="flex gap-2 p-1 rounded-full mb-4" style={{ background: "var(--sf2)" }}>
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-sm font-medium"
          style={tab === "qr" ? { background: "var(--sf)", color: "var(--pr)", boxShadow: "0 1px 3px rgba(0,0,0,.12)" } : { color: "var(--mu)" }}
          onClick={() => setTab("qr")}
        >
          <QrCode size={17} /> QR code
        </button>
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full text-sm font-medium"
          style={tab === "nfc" ? { background: "var(--sf)", color: "var(--pr)", boxShadow: "0 1px 3px rgba(0,0,0,.12)" } : { color: "var(--mu)" }}
          onClick={() => setTab("nfc")}
        >
          <Nfc size={17} /> NFC tap
        </button>
      </div>

      {tab === "qr" ? (
        <>
          <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "1 / 1" }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              webkit-playsinline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="absolute inset-[11%] rounded-2xl" style={{ border: "1px solid rgba(255,255,255,.35)" }} />
            <span className="absolute left-[11%] top-[11%] w-7 h-7 rounded-tl-xl" style={{ borderLeft: "4px solid #fff", borderTop: "4px solid #fff" }} />
            <span className="absolute right-[11%] top-[11%] w-7 h-7 rounded-tr-xl" style={{ borderRight: "4px solid #fff", borderTop: "4px solid #fff" }} />
            <span className="absolute left-[11%] bottom-[11%] w-7 h-7 rounded-bl-xl" style={{ borderLeft: "4px solid #fff", borderBottom: "4px solid #fff" }} />
            <span className="absolute right-[11%] bottom-[11%] w-7 h-7 rounded-br-xl" style={{ borderRight: "4px solid #fff", borderBottom: "4px solid #fff" }} />
            {cameraState === "live" && <span className="scanline" style={{ top: "20%" }} />}

            {cameraState === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6" style={{ background: "rgba(0,0,0,.72)", color: "#fff" }}>
                <Loader2 size={30} className="animate-spin" />
                <div className="text-sm mt-3">Starting camera…</div>
                {debugInfo && <div className="text-xs mt-2 opacity-70">{debugInfo}</div>}
              </div>
            )}

            {cameraState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6" style={{ background: "rgba(0,0,0,.72)", color: "#fff" }}>
                <Camera size={30} />
                <div className="text-sm mt-3 max-w-[260px]">{cameraError}</div>
                <button type="button" className="btn mt-4" onClick={stepCamera}>
                  <RefreshCw size={15} /> Retry camera
                </button>
              </div>
            )}
          </div>

          {cameraState === "live" && torchOn && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <button type="button" className="btn btn2 rounded-full p-2" onClick={toggleTorch} aria-label="Turn off flashlight">
                <Flashlight size={16} /> Torch on
              </button>
            </div>
          )}
          {cameraState === "live" && !torchOn && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <button type="button" className="btn btn2 rounded-full p-2" onClick={toggleTorch} aria-label="Turn on flashlight">
                <Flashlight size={16} className="rotate-180" /> Flashlight
              </button>
            </div>
          )}

          {scanError && <p className="text-xs mt-2" style={{ color: "var(--rd)" }}>{scanError}</p>}
          <p className="mu text-xs mt-2 mb-0">
            Works with UPI QR codes and TapPay payment links. Nothing is sent until you confirm.
          </p>

          <form className="mt-4" onSubmit={submitManual}>
            <label htmlFor="manual-code" className="mu text-xs flex items-center gap-1.5 mb-1.5">
              <Keyboard size={14} /> Or paste a UPI ID / payment link
            </label>
            <div className="flex gap-2">
              <input
                id="manual-code"
                className="flex-1 min-w-0 h-11 rounded-xl px-3 text-sm"
                style={{ background: "var(--sf2)", border: "1px solid var(--ln)", color: "var(--tx)" }}
                value={manual}
                onChange={(e) => { setManual(e.target.value); setManualError(""); }}
                placeholder="name@bank or https://…/pay/plink_…"
                autoComplete="off"
              />
              <button className="btn" type="submit" disabled={!manual.trim()}>
                Open
              </button>
            </div>
            {manualError && <p className="text-xs mt-2" style={{ color: "var(--rd)" }}>{manualError}</p>}
          </form>

          {debugInfo && (
            <div className="mt-3 rounded-xl p-2 text-[10px] text-[var(--mu)]" style={{ background: "var(--sf2)" }}>
              {debugInfo}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-2">
          <div className="mx-auto w-20 h-20 rounded-[24px] grid place-items-center mb-4" style={{ background: "var(--prbg)", color: "var(--pr)" }}>
            <Nfc size={36} />
          </div>
          <h3 className="text-base font-semibold m-0">Tap to pay</h3>
          <p className="mu text-sm max-w-[300px] mx-auto mt-2">
            Hold the top of your phone near the merchant&apos;s NFC tag to read the payment link.
          </p>

          {!support.supported ? (
            <div className="rounded-xl p-3 mt-4 text-left text-xs" style={{ background: "var(--ylbg)", color: "var(--yl)" }}>
              <div className="flex items-center gap-2 font-medium mb-1"><ShieldCheck size={15} /> NFC unavailable here</div>
              {support.reason} {support.hint}
            </div>
          ) : nfcState === "scanning" ? (
            <div className="rounded-xl p-4 mt-4" style={{ background: "var(--prbg)", color: "var(--pr)" }}>
              <Loader2 size={22} className="animate-spin mx-auto" />
              <div className="text-sm mt-2">{nfcInfo || "Waiting for a tag…"}</div>
            </div>
          ) : nfcState === "error" ? (
            <div className="rounded-xl p-3 mt-4 text-left text-xs" style={{ background: "var(--rdbg)", color: "var(--rd)" }}>
              {nfcError || "NFC could not start."}
            </div>
          ) : (
            <button type="button" className="btn mt-4" onClick={startNfc}>
              <Nfc size={16} /> Start NFC scan
            </button>
          )}

          {support.supported && nfcState === "error" && (
            <button type="button" className="btn btn2 mt-2" onClick={startNfc}>
              <RefreshCw size={15} /> Retry NFC
            </button>
          )}
          {support.supported && nfcState === "scanning" && (
            <button type="button" className="btn btn2 mt-2" onClick={stopNfc}>
              Stop scanning
            </button>
          )}

          <div className="rounded-xl p-3 mt-5 text-left text-xs" style={{ background: "var(--sf2)", color: "var(--mu)" }}>
            <div className="flex items-center gap-1.5 font-medium mb-1" style={{ color: "var(--tx)" }}>
              <CheckCircle2 size={14} /> What works today
            </div>
            Web NFC works in Chrome on Android over HTTPS and reads NDEF URL/text tags. For two-phone taps, use QR code or TapPay mobile app.
          </div>
        </div>
      )}
    </Sheet>
  );
}
