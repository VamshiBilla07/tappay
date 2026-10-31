import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Smartphone, 
  CreditCard, 
  Building2, 
  Wallet, 
  Coins, 
  Radio, 
  Calendar, 
  Clock, 
  AlertCircle,
  Sparkles,
  Link2
} from 'lucide-react';
import { PaymentLink, PaymentMethod, Transaction } from '../types';
import { formatINR } from '../utils/formatters';

interface CreatePaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentLinkCreated: (link: PaymentLink, initialTxn: Transaction) => void;
  onOpenCheckout: (link: PaymentLink) => void;
}

export const CreatePaymentLinkModal: React.FC<CreatePaymentLinkModalProps> = ({
  isOpen,
  onClose,
  onPaymentLinkCreated,
  onOpenCheckout,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState('2450');
  const [description, setDescription] = useState('Payment for Order #ORD-2026-948');
  const [expiryOption, setExpiryOption] = useState<'15m' | '24h' | '7d'>('24h');
  const [requireBillingAddress, setRequireBillingAddress] = useState(false);
  const [allowedMethods, setAllowedMethods] = useState<PaymentMethod[]>([
    'UPI',
    'Credit Card',
    'Debit Card',
    'Net Banking',
    'Digital Wallets',
    'NFC / Contactless',
    'Cryptocurrency',
  ]);

  const [generatedLink, setGeneratedLink] = useState<PaymentLink | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleMethod = (method: PaymentMethod) => {
    if (allowedMethods.includes(method)) {
      if (allowedMethods.length === 1) return; // Must keep at least one
      setAllowedMethods(allowedMethods.filter((m) => m !== method));
    } else {
      setAllowedMethods([...allowedMethods, method]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 1) {
      setValidationError('Please enter a valid amount of at least ₹1.00');
      return;
    }
    setValidationError(null);

    const linkId = `plink_${Math.random().toString(36).substring(2, 10)}`;
    const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

    // Expiry calculation
    const now = new Date();
    const expiryTime = new Date(now);
    if (expiryOption === '15m') expiryTime.setMinutes(now.getMinutes() + 15);
    else if (expiryOption === '24h') expiryTime.setHours(now.getHours() + 24);
    else expiryTime.setDate(now.getDate() + 7);

    const appOrigin = window.location.origin;
    const shortUrl = `${appOrigin}/pay/${linkId}`;

    const newPaymentLink: PaymentLink = {
      id: linkId,
      orderId,
      amount: numAmount,
      currency: 'INR',
      description: description || `Payment to Apex Electronics`,
      customer: {
        name: customerName || undefined,
        email: customerEmail || undefined,
        phone: customerPhone || undefined,
      },
      allowedMethods,
      requireBillingAddress,
      status: 'Created', // CRITICAL: Link is Created, NOT Paid or Successful!
      createdAt: now.toISOString(),
      expiresAt: expiryTime.toISOString(),
      shortUrl,
    };

    // Calculate MDR fee estimate
    const fee = numAmount * 0.015;
    const tax = fee * 0.18;
    const net = numAmount - (fee + tax);

    // Initial linked transaction record in 'Created' status
    const initialTxn: Transaction = {
      id: `TX-${Math.floor(10000 + Math.random() * 90000)}`,
      referenceId: orderId,
      paymentLinkId: linkId,
      customer: {
        id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
        name: customerName || 'Guest Customer',
        handle: `@${(customerName || 'guest').toLowerCase().replace(/\s+/g, '')}`,
        email: customerEmail || 'customer@payflux.gateway',
        phone: customerPhone || '+91 98765 43210',
      },
      amount: numAmount,
      currency: 'INR',
      fee: Math.round(fee * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      netAmount: Math.round(net * 100) / 100,
      paymentMethod: allowedMethods[0] || 'UPI',
      status: 'Created', // CRITICAL: Initial status is Created, NOT Successful!
      createdAt: now.toISOString(),
      settlementStatus: 'Pending',
    };

    onPaymentLinkCreated(newPaymentLink, initialTxn);
    setGeneratedLink(newPaymentLink);
  };

  const copyLinkToClipboard = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink.shortUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const allAvailableMethods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { id: 'UPI', label: 'UPI (QR / Intent)', icon: <Smartphone className="w-4 h-4 text-emerald-600" /> },
    { id: 'Credit Card', label: 'Credit Card', icon: <CreditCard className="w-4 h-4 text-indigo-600" /> },
    { id: 'Debit Card', label: 'Debit Card', icon: <CreditCard className="w-4 h-4 text-blue-600" /> },
    { id: 'Net Banking', label: 'Net Banking (50+ Banks)', icon: <Building2 className="w-4 h-4 text-cyan-600" /> },
    { id: 'Digital Wallets', label: 'Digital Wallets', icon: <Wallet className="w-4 h-4 text-amber-600" /> },
    { id: 'NFC / Contactless', label: 'NFC Contactless', icon: <Radio className="w-4 h-4 text-violet-600" /> },
    { id: 'Cryptocurrency', label: 'Web3 Crypto (USDT/ETH)', icon: <Coins className="w-4 h-4 text-purple-600" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-neutral-100 overflow-hidden my-4"
        role="dialog"
        aria-labelledby="create-link-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900" id="create-link-title">
                {generatedLink ? 'Payment Link Ready' : 'Create Payment Link'}
              </h3>
              <p className="text-[11px] text-neutral-400">
                {generatedLink ? 'Share with customer to complete payment' : 'Generate an authentic customer checkout link'}
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

        {/* Content: Generated Link Screen OR Form */}
        {generatedLink ? (
          <div className="p-5 sm:p-6 space-y-5 animate-in fade-in duration-200">
            {/* Success Created Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 space-y-1">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Payment Link Created (Status: Created / Pending Payment)</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                Payment request of <strong>{formatINR(generatedLink.amount)}</strong> generated. Awaiting customer checkout.
              </p>
            </div>

            {/* Link Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700">Customer Checkout URL</label>
              <div className="flex items-center gap-2 p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200">
                <span className="text-xs font-mono text-neutral-800 truncate flex-1 select-all">
                  {generatedLink.shortUrl}
                </span>
                <button
                  onClick={copyLinkToClipboard}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border border-neutral-200 text-xs font-bold text-neutral-800 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Order Summary & Expiry */}
            <div className="p-4 bg-neutral-50 rounded-2xl space-y-2 text-xs border border-neutral-100">
              <div className="flex justify-between">
                <span className="text-neutral-500">Order ID:</span>
                <span className="font-mono font-bold text-neutral-800">{generatedLink.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Description:</span>
                <span className="font-medium text-neutral-800 truncate max-w-[200px]">{generatedLink.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Allowed Methods:</span>
                <span className="font-semibold text-neutral-800">{generatedLink.allowedMethods.length} methods enabled</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-neutral-200/60">
                <span className="text-neutral-500">Expires At:</span>
                <span className="font-medium text-neutral-700">
                  {new Date(generatedLink.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(generatedLink.expiresAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => {
                  onOpenCheckout(generatedLink);
                  onClose();
                }}
                className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Customer Checkout Page</span>
              </button>

              <button
                onClick={onClose}
                className="w-full sm:w-auto py-3 px-5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Create Form */
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {validationError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Payable Amount (INR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-neutral-500 text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-neutral-50 pl-8 pr-4 py-2.5 rounded-xl text-base font-black text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:bg-white"
                  placeholder="2450.00"
                  min="1"
                  step="0.01"
                  required
                />
              </div>
            </div>

            {/* Purpose / Description */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">
                Payment Description / Purpose
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-neutral-50 px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:bg-white"
                placeholder="e.g. Consulting Invoice #948 or Product Purchase"
              />
            </div>

            {/* Customer Details (Optional on link creation, customer can fill at checkout) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-xl text-xs text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
                  placeholder="Dev Sharma"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                  Customer Email (Optional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-xl text-xs text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
                  placeholder="dev@startup.in"
                />
              </div>
            </div>

            {/* Expiry Options */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>Link Expiration</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['15m', '24h', '7d'] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => setExpiryOption(opt)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                      expiryOption === opt
                        ? 'border-neutral-900 bg-neutral-900 text-white shadow-2xs'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {opt === '15m' && '15 Minutes'}
                    {opt === '24h' && '24 Hours'}
                    {opt === '7d' && '7 Days'}
                  </button>
                ))}
              </div>
            </div>

            {/* Allowed Payment Methods */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-neutral-700">
                  Allowed Payment Methods
                </label>
                <span className="text-[10px] text-neutral-400">
                  {allowedMethods.length} selected
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allAvailableMethods.map((m) => {
                  const isChecked = allowedMethods.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggleMethod(m.id)}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                        isChecked
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <div className="shrink-0">{m.icon}</div>
                      <span className="truncate flex-1">{m.label}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Require Billing Address */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={requireBillingAddress}
                  onChange={(e) => setRequireBillingAddress(e.target.checked)}
                  className="rounded text-neutral-900 focus:ring-neutral-900 w-4 h-4 cursor-pointer"
                />
                <span>Require customer to enter full billing address at checkout</span>
              </label>
            </div>

            {/* Submit Actions */}
            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-800 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Generate Payment Link</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
