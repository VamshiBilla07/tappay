export function nfcSupport() {
  if (typeof window === "undefined") {
    return { supported: false, reason: "NFC needs a browser.", hint: "Open this dashboard on an Android phone." };
  }
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: "Web NFC needs HTTPS (or localhost).",
      hint: "Serve this dashboard over https:// in Chrome on Android to enable taps.",
    };
  }
  if (!("NDEFReader" in window)) {
    return {
      supported: false,
      reason: "Web NFC is only available in Chrome on Android.",
      hint: "Use the QR tab instead.",
    };
  }
  return { supported: true, reason: "", hint: "" };
}

function decodeRecord(record) {
  if (!record?.data) return "";
  const type = record.recordType;
  if (type === "text" || type === "url" || type === "absolute-url") {
    return new TextDecoder(record.encoding || "utf-8").decode(record.data);
  }
  if (type === "mime" && /json|text/i.test(record.mediaType || "")) {
    return new TextDecoder().decode(record.data);
  }
  return "";
}

/**
 * Start a Web NFC scan. Resolves once the scan is armed; call the returned
 * controller's abort() to stop it. NDEF text/url records are decoded and
 * handed back as an array.
 */
export async function startNfcRead({ signal, onReading, onError, onStarted }) {
  if (!("NDEFReader" in window)) throw new Error("Web NFC is not available in this browser.");

  const reader = new NDEFReader();
  reader.addEventListener("readingerror", () => {
    onError?.(new Error("This NFC tag could not be read. Try again."));
  });
  reader.addEventListener("reading", (event) => {
    const texts = [];
    for (const record of event.message.records) {
      const text = decodeRecord(record).trim();
      if (text) texts.push(text);
    }
    onReading?.({ serialNumber: event.serialNumber, texts });
  });

  await reader.scan({ signal });
  onStarted?.();
  return reader;
}

export function nfcErrorMessage(err) {
  switch (err?.name) {
    case "NotAllowedError":
      return "NFC permission was denied. Allow it in Chrome's site settings and retry.";
    case "NotSupportedError":
      return "NFC is not available on this device.";
    case "NotReadableError":
      return "NFC is busy or turned off. Enable NFC and try again.";
    case "InvalidStateError":
      return "An NFC scan is already running.";
    case "AbortError":
      return "";
    default:
      return err?.message || "Could not start the NFC reader.";
  }
}
