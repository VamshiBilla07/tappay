const API_BASE = (import.meta.env.VITE_PAYFLUX_API || "").replace(/\/$/, "");

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function requestJson(path, init, { signal, timeout = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const relayAbort = () => controller.abort();
  signal?.addEventListener("abort", relayAbort);

  try {
    const res = await fetch(apiUrl(path), {
      ...init,
      signal: controller.signal,
      headers: { accept: "application/json", ...(init.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
    return body;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", relayAbort);
  }
}

export function getJson(path, opts) {
  return requestJson(path, {}, opts);
}

export function postJson(path, body, opts) {
  return requestJson(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }, opts);
}

export function fetchPaymentLink(linkId, opts) {
  return getJson(`/api/links/${encodeURIComponent(linkId)}`, opts);
}

export function simulatePaymentLink(linkId, method, opts) {
  return postJson(`/api/links/${encodeURIComponent(linkId)}/simulate`, { method }, opts);
}
