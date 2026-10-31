import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Copy, Check, ExternalLink, QrCode, Smartphone, CreditCard, Building2,
  Wallet, Coins, Radio, Calendar, Clock, AlertCircle, Link2, Loader2, Nfc,
  ChevronLeft, CheckCircle2, FlaskConical, RefreshCw,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Address } from 'viem';
import { USDC, domain, encode, randomNonce, types } from '@pos/shared';
import { formatINR } from '../utils/formatters';
import { apiJson, fmtUsdc, inrToUsdc, type AppConfig } from '../lib/config';
import type { PaymentLinkView } from '../lib/paylink';
import { createDemoLink, refreshDemoLink, simulateDemoLink } from '../lib/demo';
import { walletClientFor } from '../lib/wallet';
import { ALL_METHODS, isNfcSupported, railFor } from '../lib/methods';
import type { PaymentMethod } from '../types';

interface CreatePaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  merchant: Address | null;
  defaultEns: string;
  /** Demo mode never touches MetaMask, the API, or the chain. */
  demo: boolean;
  onEnsureWallet: () => Promise<Address | null>;
  onCreated: (link: PaymentLinkView) => void;
  onOpenCheckout: (url: string) => void;
  onDemoPaid: (link: PaymentLinkView) => void;
}

const METHOD_META: Array<{
  id: PaymentMethod;
  label: string;
  hint: string;
  icon: React.ReactNode;
  tint: string;
}> = [
  {
    id: 'UPI',
    label: 'UPI',
    hint: 'QR / intent',
    icon: <Smartphone className="w-5 h-5" />,
    tint: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  },
  {
    id: 'Credit Card',
    label: 'Credit Card',
    hint: 'Swap ETH → USDC',
    icon: <CreditCard className="w-5 h-5" />,
    tint: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  },
  {
    id: 'Debit Card',
    label: 'Debit Card',
    hint: 'Swap ETH → USDC',
    icon: <CreditCard className="w-5 h-5" />,
    tint: 'text-blue-600 bg-blue-50 border-blue-100',
  },
  {
    id: 'Net Banking',
    label: 'Net Banking',
    hint: 'Swap ETH → USDC',
    icon: <Building2 className="w-5 h-5" />,
    tint: 'text-cyan-600 bg-cyan-50 border-cyan-100',
  },
  {
    id: 'Digital Wallets',
    label: 'Wallets',
    hint: 'Direct USDC',
    icon: <Wallet className="w-5 h-5" />,
    tint: 'text-amber-600 bg-amber-50 border-amber-100',
  },
  {
    id: 'NFC / Contactless',
    label: 'NFC Tap',
    hint: 'Direct USDC',
    icon: <Radio className="w-5 h-5" />,
    tint: 'text-violet-600 bg-violet-50 border-violet-100',
  },
  {
    id: 'Cryptocurrency',
    label: 'Crypto',
    hint: 'Direct USDC',
    icon: <Coins className="w-5 h-5" />,
    tint: 'text-purple-600 bg-purple-50 border-purple-100',
  },
];

const fmtLeft = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return h > 0 ? `${h}:${m < 10 ? `0${m}` : m}:${ss}` : `${m}:${ss}`;
};

export const CreatePaymentLinkModal: React.FC<CreatePaymentLinkModalProps> = ({
  isOpen, onClose, config, merchant, defaultEns, demo,
  onEnsureWallet, onCreated, onOpenCheckout, onDemoPaid,
}) => {
  const [stage, setStage] = useState<'method' | 'charge'>('method');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [amount, setAmount] = useState('2450');
  const [description, setDescription] = useState('Payment for Order #ORD-2026-948');
  const [expiryOption, setExpiryOption] = useState<'15m' | '24h' | '7d'>('24h');
  const [ensName, setEnsName] = useState(defaultEns);
  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [generated, setGenerated] = useState<PaymentLinkView | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [nfcMsg, setNfcMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const amountRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setEnsName((v) => v || defaultEns);
      setStage('method');
      setGenerated(null);
      setPaid(false);
      setSelected(null);
      setTimeout(() => amountRef.current?.focus(), 60);
    }
    if (!isOpen) {
      setGenerated(null);
      setError(null);
      setCopied(false);
      setNfcMsg(null);
      setPaid(false);
      setStage('method');
    }
    wasOpen.current = isOpen;
  }, [isOpen, defaultEns]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || stage !== 'charge' || paid) return;
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [isOpen, stage, paid]);

  /* Demo: the customer pays on their own phone — poll the server so this panel flips to paid. */
  const generatedId = generated?.id;
  const generatedDemo = Boolean(generated?.demo);
  useEffect(() => {
    if (!isOpen || stage !== 'charge' || paid || !generatedId || !generatedDemo) return;
    let stopped = false;
    const check = async () => {
      const fresh = await refreshDemoLink(generatedId);
      if (stopped || !fresh || fresh.status !== 'paid') return;
      setGenerated(fresh);
      setPaid(true);
      onDemoPaid(fresh);
    };
    const timer = window.setInterval(() => void check(), 2_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [isOpen, stage, paid, generatedId, generatedDemo, onDemoPaid]);

  const usdcPreview = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n / (config?.inrPerUsdc || 85) : 0;
  }, [amount, config]);

  const secondsLeft = generated ? Math.max(0, generated.expiresAt - now) : 0;

  if (!isOpen) return null;

  const copyLink = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy — select the link text and copy it manually.');
    }
  };

  const writeNfc = async () => {
    if (!generated) return;
    const NDEF = (window as any).NDEFReader;
    if (!NDEF) {
      setNfcMsg('Web NFC needs Chrome on Android over HTTPS. Copy the link instead.');
      return;
    }
    try {
      const writer = new NDEF();
      await writer.write({ records: [{ recordType: 'url', data: generated.url }] });
      setNfcMsg('NFC tag written with the checkout link. The customer can tap it to open this payment.');
    } catch (e: any) {
      setNfcMsg(e?.message ?? 'The NFC write failed.');
    }
  };

  /** Fired by tapping a method tile: close the chooser, open the payment panel. */
  const startCharge = async (method: PaymentMethod) => {
    setError(null);
    setNfcMsg(null);
    const numAmount = parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount < 1) {
      setError('Enter a valid amount of at least ₹1.00 first.');
      return;
    }
    const seconds = expiryOption === '15m' ? 15 * 60 : expiryOption === '24h' ? 24 * 60 * 60 : 7 * 24 * 60 * 60;
    // Chosen method first so the checkout opens on it; the page can still switch.
    const methods: PaymentMethod[] = [method, ...ALL_METHODS.filter((m) => m !== method)];

    setSelected(method);

    if (demo) {
      const link = await createDemoLink({
        inr: numAmount,
        rate: config?.inrPerUsdc || 85,
        description: description || `Payment for ${method}`,
        methods,
        customer: {
          name: customerName || undefined,
          email: customerEmail || undefined,
        },
        expirySeconds: seconds,
      });
      setGenerated(link);
      onCreated(link);
      setStage('charge');
      return;
    }

    if (!config) {
      setError('The payment server config has not loaded yet.');
      return;
    }
    if (!config.deployed) {
      setError('Deploy the settlement contract first (Settings → Settlement contract).');
      return;
    }

    const payer = merchant ?? (await onEnsureWallet());
    if (!payer) {
      setError('Connect MetaMask first — the request must be signed by the wallet that receives the USDC.');
      return;
    }

    const req = {
      merchant: payer,
      token: USDC,
      amount: inrToUsdc(numAmount, config.inrPerUsdc),
      nonce: randomNonce(),
      expiry: BigInt(Math.floor(Date.now() / 1000) + seconds),
      ensName: ensName.trim(),
    };

    setSigning(true);
    try {
      const wc = walletClientFor(payer);
      const sig = await wc.signTypedData({
        domain: domain(config.settlement),
        types,
        primaryType: 'PaymentRequest' as const,
        message: req,
        account: payer,
      });
      const wire = JSON.parse(encode({ req, sig }, config.settlement));

      const body = await apiJson<{ link: PaymentLinkView }>('/api/links', {
        method: 'POST',
        body: JSON.stringify({
          payload: wire,
          inr: numAmount,
          description: description || `Payment to ${ensName || 'merchant'}`,
          methods,
          customer: {
            name: customerName || undefined,
            email: customerEmail || undefined,
          },
        }),
      });
      setGenerated(body.link);
      onCreated(body.link);
      setStage('charge');
    } catch (err: any) {
      setError(
        err?.code === 4001 || /user rejected|denied/i.test(err?.message ?? '')
          ? 'You declined to sign the request.'
          : (err?.shortMessage ?? err?.message ?? 'Could not create the payment link.'),
      );
    } finally {
      setSigning(false);
    }
  };

  /** Demo only: mark the request paid and let the dashboard pick the row up. */
  const simulatePayment = async () => {
    if (!generated || paid) return;
    setPaid(true);
    const updated = (await simulateDemoLink(generated.id, selected ?? 'UPI')) ?? generated;
    setGenerated(updated);
    onDemoPaid(updated);
  };

  const resetToChooser = () => {
    setStage('method');
    setGenerated(null);
    setPaid(false);
    setSelected(null);
    setCopied(false);
    setNfcMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-neutral-100 overflow-hidden my-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-link-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2 min-w-0">
            {stage === 'charge' ? (
              <button
                onClick={resetToChooser}
                aria-label="Back to payment methods"
                className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-extrabold text-base text-neutral-900 truncate" id="create-link-title">
                {stage === 'charge' ? 'Collect payment' : 'Create payment link'}
              </h3>
              <p className="text-[11px] text-neutral-400 truncate">
                {stage === 'charge'
                  ? selected
                    ? `${selected} · ${formatINR(generated?.inr ?? 0)}`
                    : formatINR(generated?.inr ?? 0)
                  : 'Pick how the customer pays, then show the QR'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {demo && stage === 'method' && (
          <div className="px-5 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-900 flex items-start gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              Demo mode — no wallet needed. The QR opens a working demo checkout that records a sample payment.
            </span>
          </div>
        )}

        {stage === 'method' ? (
          /* ---------- Stage 1: amount + method chooser ---------- */
          <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="link-amount" className="block text-xs font-bold text-neutral-700 mb-1">
                Payable amount
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-neutral-500 text-lg">₹</span>
                <input
                  id="link-amount"
                  ref={amountRef}
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-neutral-50 pl-8 pr-3 py-3 rounded-2xl text-2xl font-black text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:bg-white tabular-nums"
                  min="1"
                  step="0.01"
                />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 tabular-nums">
                ≈ {usdcPreview.toFixed(2)} USDC at ₹{config?.inrPerUsdc ?? 85}/USDC
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-neutral-700">Choose how the customer pays</span>
                <span className="text-[10px] text-neutral-400">Tap to open the payment panel</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {METHOD_META.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void startCharge(m.id)}
                    disabled={signing}
                    className="group flex items-center gap-2.5 p-3 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-900 hover:shadow-sm transition-all text-left cursor-pointer disabled:opacity-50"
                  >
                    <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${m.tint}`}>
                      {signing && selected === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : m.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-extrabold text-neutral-900 truncate">{m.label}</span>
                      <span className="block text-[10px] text-neutral-400 truncate">{m.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-[11px] font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
            >
              {showDetails ? '− Hide details' : '+ Description, expiry, customer'}
            </button>

            {showDetails && (
              <div className="space-y-3 pt-1">
                <div>
                  <label htmlFor="link-desc" className="block text-[11px] font-bold text-neutral-600 mb-1">Description</label>
                  <input
                    id="link-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-neutral-50 px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:bg-white"
                    placeholder="e.g. Invoice #948"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="link-expiry" className="block text-[11px] font-bold text-neutral-600 mb-1">Expiry</label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        id="link-expiry"
                        value={expiryOption}
                        onChange={(e) => setExpiryOption(e.target.value as typeof expiryOption)}
                        className="w-full bg-neutral-50 pl-8 pr-2 py-2.5 rounded-xl text-xs font-semibold text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 appearance-none"
                      >
                        <option value="15m">15 minutes</option>
                        <option value="24h">24 hours</option>
                        <option value="7d">7 days</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="link-name" className="block text-[11px] font-bold text-neutral-600 mb-1">Customer name</label>
                    <input
                      id="link-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-neutral-50 px-3 py-2.5 rounded-xl text-xs text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
                      placeholder="Dev Sharma"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="link-email" className="block text-[11px] font-bold text-neutral-600 mb-1">Customer email</label>
                  <input
                    id="link-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full bg-neutral-50 px-3.5 py-2.5 rounded-xl text-xs text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
                    placeholder="dev@startup.in"
                  />
                </div>

                {!demo && (
                  <div>
                    <label htmlFor="link-ens" className="block text-[11px] font-bold text-neutral-600 mb-1">
                      Merchant ENS name <span className="font-medium text-neutral-400">(optional)</span>
                    </label>
                    <input
                      id="link-ens"
                      value={ensName}
                      onChange={(e) => setEnsName(e.target.value)}
                      className="w-full bg-neutral-50 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:bg-white"
                      placeholder="shop.eth"
                    />
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-neutral-400 leading-relaxed">
              {demo
                ? 'Sample request only — no signature, no chain call, no money moves.'
                : 'The request is signed by your wallet, not stored on a server key. Card and net-banking settle as ETH swapped to exact USDC.'}
            </p>
          </div>
        ) : (
          /* ---------- Stage 2: the payment popup with QR ---------- */
          <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {paid ? (
              <div className="text-center space-y-3 py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-neutral-900">Payment received</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {selected} · {formatINR(generated?.inr ?? 0)}
                  </div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl text-[11px] text-neutral-500">
                  Recorded on the demo dashboard — Transactions, Settlements and Customers now show it.
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={resetToChooser}
                    className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Create another
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center justify-center">
                  <div className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-sm">
                    {generated && <QRCodeSVG value={generated.url} size={196} level="M" includeMargin={false} />}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-extrabold text-neutral-900 tabular-nums">
                    {formatINR(generated?.inr ?? 0)}
                  </div>
                  <div className="text-xs font-semibold text-neutral-500 mt-0.5">
                    ≈ {demo ? Number(generated?.usdc ?? 0).toFixed(2) : fmtUsdc(generated?.usdc ?? '0')} USDC · {selected}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold bg-indigo-50/70 border border-indigo-100 text-indigo-800">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Expires in {fmtLeft(secondsLeft)}
                  </span>
                  <span className="uppercase tracking-wide opacity-70">
                    {railFor(selected ?? 'UPI') === 'ETH' ? 'ETH → USDC' : 'Direct USDC'}
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-1">Shareable checkout link</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-700 truncate flex-1" title={generated?.url}>
                      {generated?.url}
                    </span>
                    <button onClick={() => void copyLink()} className="p-1.5 rounded-lg hover:bg-white text-neutral-500 hover:text-neutral-900 cursor-pointer" aria-label="Copy link">
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {demo ? (
                  <div className="space-y-2">
                    <button
                      onClick={simulatePayment}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" /> Simulate customer payment
                    </button>
                    <button
                      onClick={() => generated && onOpenCheckout(generated.url)}
                      className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open the customer checkout
                    </button>
                    <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
                      The QR and link work on a second phone while this demo server is reachable.
                      Nothing is signed and no funds move.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      onClick={() => generated && onOpenCheckout(generated.url)}
                      className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" /> Open customer checkout
                    </button>
                    {isNfcSupported() && (
                      <button
                        onClick={() => void writeNfc()}
                        className="w-full sm:w-auto py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                        title="Write the checkout link to an NFC tag"
                      >
                        <Nfc className="w-4 h-4" /> Write NFC
                      </button>
                    )}
                  </div>
                )}

                {nfcMsg && (
                  <p className="text-[11px] text-neutral-600 bg-neutral-50 border border-neutral-100 rounded-xl p-2.5">{nfcMsg}</p>
                )}

                <div className="flex items-center justify-between text-[10px] text-neutral-400">
                  <span className="inline-flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> {demo ? 'Demo request' : 'EIP-712 signed request'}
                  </span>
                  <span>Base Sepolia</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
