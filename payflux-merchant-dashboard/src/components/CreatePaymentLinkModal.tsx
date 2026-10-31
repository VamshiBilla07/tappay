import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Copy, Check, ExternalLink, QrCode, Smartphone, CreditCard, Building2,
  Wallet, Coins, Radio, Calendar, Clock, AlertCircle, Link2, Loader2, Nfc,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Address } from 'viem';
import { CHAIN, USDC, domain, encode, randomNonce, types } from '@pos/shared';
import { formatINR } from '../utils/formatters';
import { apiJson, fmtUsdc, inrToUsdc, type AppConfig } from '../lib/config';
import type { PaymentLinkView } from '../lib/paylink';
import { walletClientFor } from '../lib/wallet';
import { ALL_METHODS, isNfcSupported } from '../lib/methods';
import type { PaymentMethod } from '../types';

interface CreatePaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  merchant: Address | null;
  defaultEns: string;
  onEnsureWallet: () => Promise<Address | null>;
  onCreated: (link: PaymentLinkView) => void;
  onOpenCheckout: (url: string) => void;
}

const METHOD_META: Array<{ id: PaymentMethod; label: string; icon: React.ReactNode }> = [
  { id: 'UPI', label: 'UPI (QR / Intent)', icon: <Smartphone className="w-4 h-4 text-emerald-600" /> },
  { id: 'Credit Card', label: 'Credit Card', icon: <CreditCard className="w-4 h-4 text-indigo-600" /> },
  { id: 'Debit Card', label: 'Debit Card', icon: <CreditCard className="w-4 h-4 text-blue-600" /> },
  { id: 'Net Banking', label: 'Net Banking', icon: <Building2 className="w-4 h-4 text-cyan-600" /> },
  { id: 'Digital Wallets', label: 'Digital Wallets', icon: <Wallet className="w-4 h-4 text-amber-600" /> },
  { id: 'NFC / Contactless', label: 'NFC Contactless', icon: <Radio className="w-4 h-4 text-violet-600" /> },
  { id: 'Cryptocurrency', label: 'Crypto (USDC/ETH)', icon: <Coins className="w-4 h-4 text-purple-600" /> },
];

export const CreatePaymentLinkModal: React.FC<CreatePaymentLinkModalProps> = ({
  isOpen, onClose, config, merchant, defaultEns, onEnsureWallet, onCreated, onOpenCheckout,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState('2450');
  const [description, setDescription] = useState('Payment for Order #ORD-2026-948');
  const [expiryOption, setExpiryOption] = useState<'15m' | '24h' | '7d'>('24h');
  const [requireBillingAddress, setRequireBillingAddress] = useState(false);
  const [allowedMethods, setAllowedMethods] = useState<PaymentMethod[]>(ALL_METHODS);
  const [ensName, setEnsName] = useState(defaultEns);
  const [generated, setGenerated] = useState<PaymentLinkView | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [nfcMsg, setNfcMsg] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setEnsName((v) => v || defaultEns);
      setTimeout(() => amountRef.current?.focus(), 60);
    }
    if (!isOpen) {
      setGenerated(null);
      setError(null);
      setCopied(false);
      setNfcMsg(null);
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

  const usdcPreview = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n / (config?.inrPerUsdc || 85) : 0;
  }, [amount, config]);

  if (!isOpen) return null;

  const toggleMethod = (method: PaymentMethod) => {
    setAllowedMethods((prev) => {
      if (prev.includes(method)) {
        return prev.length === 1 ? prev : prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
  };

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
      setNfcMsg('Web NFC is only available in Chrome on Android over HTTPS. Copy the payload instead.');
      return;
    }
    try {
      const writer = new NDEF();
      await writer.write({ records: [{ recordType: 'text', data: JSON.stringify(generated.request) }] });
      setNfcMsg('NFC tag written. The customer phone can now read the signed request.');
    } catch (e: any) {
      setNfcMsg(e?.message ?? 'The NFC write failed.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNfcMsg(null);
    const numAmount = parseFloat(amount);
    if (!Number.isFinite(numAmount) || numAmount < 1) {
      setError('Please enter a valid amount of at least ₹1.00.');
      return;
    }
    if (!config) {
      setError('The payment server config has not loaded yet.');
      return;
    }
    if (!config.deployed) {
      setError('Deploy the settlement contract first (Settings → Network). Links cannot be signed before that.');
      return;
    }

    const payer = merchant ?? (await onEnsureWallet());
    if (!payer) {
      setError('Connect MetaMask first — the request must be signed by the wallet that receives the USDC.');
      return;
    }

    const seconds = expiryOption === '15m' ? 15 * 60 : expiryOption === '24h' ? 24 * 60 * 60 : 7 * 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
    const req = {
      merchant: payer,
      token: USDC,
      amount: inrToUsdc(numAmount, config.inrPerUsdc),
      nonce: randomNonce(),
      expiry: BigInt(now + seconds),
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
          methods: allowedMethods,
          customer: {
            name: customerName || undefined,
            email: customerEmail || undefined,
            phone: customerPhone || undefined,
          },
          requireBillingAddress,
        }),
      });
      setGenerated(body.link);
      onCreated(body.link);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-neutral-100 overflow-hidden my-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-link-title"
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              {generated ? <QrCode className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900" id="create-link-title">
                {generated ? 'Payment link ready' : 'Create payment link'}
              </h3>
              <p className="text-[11px] text-neutral-400">
                {generated ? 'Signed request — scan the QR or write it to NFC' : 'The request is signed by your wallet, not stored on a server key'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {generated ? (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-sm">
                <QRCodeSVG value={generated.url} size={190} level="M" includeMargin={false} />
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-extrabold text-neutral-900">{formatINR(generated.inr)}</div>
              <div className="text-xs font-semibold text-neutral-500 mt-0.5">
                ≈ {fmtUsdc(generated.usdc)} USDC · {generated.methods.length} method{generated.methods.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
              <div className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-1">Shareable checkout link</div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-neutral-700 truncate flex-1" title={generated.url}>{generated.url}</span>
                <button onClick={() => void copyLink()} className="p-1.5 rounded-lg hover:bg-white text-neutral-500 hover:text-neutral-900 cursor-pointer" aria-label="Copy link">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 block font-medium">Merchant</span>
                <span className="font-mono font-bold text-neutral-800 truncate block">{generated.request.r.merchant}</span>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-xl">
                <span className="text-neutral-400 block font-medium">Expires</span>
                <span className="font-bold text-neutral-800">{new Date(generated.expiresAt * 1000).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => onOpenCheckout(generated.url)}
                className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" /> Open customer checkout
              </button>
              <button
                onClick={() => void writeNfc()}
                className="w-full sm:w-auto py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                title="Write the signed request to an NFC tag (Chrome on Android)"
              >
                <Nfc className="w-4 h-4" /> Write NFC
              </button>
            </div>

            {nfcMsg && (
              <p className="text-[11px] text-neutral-600 bg-neutral-50 border border-neutral-100 rounded-xl p-2.5">{nfcMsg}</p>
            )}

            <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
              The QR opens the hosted checkout. The NFC record carries the same EIP-712 request, so the
              two-phone BasePOS app can relay it without the server.
            </p>

            <button onClick={onClose} className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs cursor-pointer">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="link-amount" className="block text-xs font-bold text-neutral-700 mb-1">
                  Payable amount (INR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-neutral-500 text-sm">₹</span>
                  <input
                    id="link-amount"
                    ref={amountRef}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-neutral-50 pl-8 pr-3 py-2.5 rounded-xl text-base font-black text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:bg-white tabular-nums"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mt-1 tabular-nums">
                  ≈ {usdcPreview.toFixed(2)} USDC at ₹{config?.inrPerUsdc ?? 85}/USDC
                </p>
              </div>
              <div>
                <label htmlFor="link-expiry" className="block text-xs font-bold text-neutral-700 mb-1">
                  Link expiry
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    id="link-expiry"
                    value={expiryOption}
                    onChange={(e) => setExpiryOption(e.target.value as typeof expiryOption)}
                    className="w-full bg-neutral-50 pl-8 pr-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 appearance-none"
                  >
                    <option value="15m">15 minutes</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                  </select>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1">The signature expires with the link.</p>
              </div>
            </div>

            <div>
              <label htmlFor="link-desc" className="block text-xs font-bold text-neutral-700 mb-1">Description</label>
              <input
                id="link-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-neutral-50 px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:bg-white"
                placeholder="e.g. Invoice #948 or product purchase"
              />
            </div>

            <div>
              <label htmlFor="link-ens" className="block text-xs font-bold text-neutral-700 mb-1">
                Merchant ENS name <span className="text-neutral-400 font-medium">(optional)</span>
              </label>
              <input
                id="link-ens"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                className="w-full bg-neutral-50 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:bg-white"
                placeholder="shop.eth"
              />
              <p className="text-[10px] text-neutral-400 mt-1">
                If set, the checkout verifies forward + reverse ENS. Leave blank to skip those two identity checks.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="link-name" className="block text-[11px] font-bold text-neutral-600 mb-1">Customer name (optional)</label>
                <input
                  id="link-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-xl text-xs text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
                  placeholder="Dev Sharma"
                />
              </div>
              <div>
                <label htmlFor="link-email" className="block text-[11px] font-bold text-neutral-600 mb-1">Customer email (optional)</label>
                <input
                  id="link-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-xl text-xs text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
                  placeholder="dev@startup.in"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-neutral-700">Accepted methods</label>
                <span className="text-[10px] text-neutral-400">{allowedMethods.length} enabled</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {METHOD_META.map((m) => {
                  const active = allowedMethods.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMethod(m.id)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[11px] font-semibold text-left transition-colors cursor-pointer ${
                        active ? 'bg-indigo-50/70 border-indigo-200 text-neutral-900' : 'bg-neutral-50 border-neutral-200 text-neutral-500'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-neutral-300'}`}>
                        {active && <Check className="w-3 h-3" />}
                      </span>
                      {m.icon}
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-neutral-400 mt-1.5">
                Each method maps to a real testnet rail (USDC or ETH→USDC). UPI/card acquiring itself is not connected.
              </p>
            </div>

            <label className="flex items-center gap-2 text-[11px] font-semibold text-neutral-600 cursor-pointer">
              <input
                type="checkbox"
                checked={requireBillingAddress}
                onChange={(e) => setRequireBillingAddress(e.target.checked)}
                className="rounded border-neutral-300"
              />
              Ask the customer for a billing address
            </label>

            <div className="pt-2 flex items-center gap-2 text-[10px] text-neutral-400">
              <Clock className="w-3 h-3" />
              Signed with {merchant ? merchant.slice(0, 6) + '…' + merchant.slice(-4) : 'your wallet'} on Base Sepolia.
            </div>

            <button
              type="submit"
              disabled={signing}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {signing ? <><Loader2 className="w-4 h-4 animate-spin" /> Waiting for MetaMask…</> : 'Sign & create payment link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
