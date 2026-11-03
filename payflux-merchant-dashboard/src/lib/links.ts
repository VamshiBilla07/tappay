/** Shareable link helpers (QR + NFC use the same signed request). */

export function b64urlEncode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function b64urlDecode(s: string): string {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Deep link that opens a URL inside the MetaMask in-app browser. */
export function metamaskLink(url: string): string {
  const u = new URL(url);
  const port = u.port && u.port !== "443" ? `:${u.port}` : "";
  return `https://metamask.app.link/dapp/${u.hostname}${port}${u.pathname}${u.search}`;
}
