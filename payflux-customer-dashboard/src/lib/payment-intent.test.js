import test from "node:test";
import assert from "node:assert/strict";
import { isPaymentIntent, parseScan, parseUpiUri } from "./payment-intent.js";

test("parses a UPI QR with a fixed amount", () => {
  const intent = parseScan("upi://pay?pa=chai@okhdfcbank&pn=Chai%20Point&am=125.50&cu=INR&tn=Order%2012");
  assert.equal(intent.kind, "upi");
  assert.equal(intent.payee, "chai@okhdfcbank");
  assert.equal(intent.name, "Chai Point");
  assert.equal(intent.amount, 125.5);
  assert.equal(intent.currency, "INR");
  assert.equal(intent.note, "Order 12");
});

test("parses a UPI QR without an amount", () => {
  const intent = parseScan("upi://pay?pa=shop@oksbi&pn=Shop");
  assert.equal(intent.kind, "upi");
  assert.equal(intent.amount, null);
  assert.equal(intent.name, "Shop");
});

test("rejects a UPI URI without a valid VPA", () => {
  assert.equal(parseUpiUri("upi://pay?pa=not-a-vpa&pn=Shop"), null);
  assert.equal(parseScan("upi://pay?pa=not-a-vpa").kind, "text");
});

test("parses a TapPay payment link and keeps the demo flag", () => {
  const intent = parseScan("https://pay.tappay.test/pay/plink_AbC-123?demo=1");
  assert.equal(intent.kind, "tapay");
  assert.equal(intent.linkId, "plink_AbC-123");
  assert.equal(intent.demo, true);
});

test("does not treat a non-pay URL as a TapPay link", () => {
  const intent = parseScan("https://pay.tappay.test/checkout/plink_AbC-123");
  assert.equal(intent.kind, "url");
  assert.equal(intent.host, "pay.tappay.test");
});

test("detects a signed EIP-712 payload", () => {
  const payload = JSON.stringify({
    v: 1,
    c: 84532,
    s: "0x0000000000000000000000000000000000000001",
    r: { merchant: "0x0000000000000000000000000000000000000002" },
    g: "0xabcd",
  });
  assert.equal(parseScan(payload).kind, "signed");
});

test("falls back to text for unrecognised codes", () => {
  const intent = parseScan("https://example.com/menu");
  assert.equal(intent.kind, "url");
  assert.equal(parseScan("hello world").kind, "text");
  assert.equal(parseScan("   ").kind, "empty");
  assert.equal(isPaymentIntent(parseScan("hello")), false);
  assert.equal(isPaymentIntent(parseScan("upi://pay?pa=shop@oksbi")), true);
});
