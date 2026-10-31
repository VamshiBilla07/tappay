import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  CreditCard, 
  Building2, 
  Wallet, 
  CheckCircle2, 
  Copy, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { PaymentMethod, Transaction } from '../types';
import { formatINR } from '../utils/formatters';

interface QuickPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionCreated: (newTxn: Transaction) => void;
}

export const QuickPaymentModal: React.FC<QuickPaymentModalProps> = ({
  isOpen,
  onClose,
  onTransactionCreated,
}) => {
  const [customerName, setCustomerName] = useState('Dev Sharma');
  const [customerEmail, setCustomerEmail] = useState('dev.sharma@startup.in');
  const [amount, setAmount] = useState('2850');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [notes, setNotes] = useState('Invoice #INV-2026-904');
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  if (!isOpen) return null;

  const handleGenerateLink = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 1000;
    const link = `https://payflux.in/pay/pf_${Math.random().toString(36).substring(2, 9)}?amt=${numAmount}`;
    setCreatedLink(link);
  };

  const handleSimulatePayment = () => {
    setIsSimulating(true);
    const numAmount = parseFloat(amount) || 1000;
    const fee = paymentMethod === 'UPI' ? numAmount * 0.005 : numAmount * 0.018;
    const tax = fee * 0.18;
    const net = numAmount - (fee + tax);

    setTimeout(() => {
      const newTxn: Transaction = {
        id: `TX-${Math.floor(10000 + Math.random() * 90000)}`,
        referenceId: `UPI-${Date.now().toString().slice(-8)}`,
        customer: {
          id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
          name: customerName,
          handle: `@${customerName.toLowerCase().replace(/\s+/g, '')}`,
          email: customerEmail,
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
        },
        amount: numAmount,
        currency: 'INR',
        fee: Math.round(fee * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        netAmount: Math.round(net * 100) / 100,
        paymentMethod: paymentMethod,
        paymentSubtype: paymentMethod === 'UPI' ? 'Google Pay' : 'HDFC Visa Platinum',
        status: 'Successful',
        createdAt: new Date().toISOString(),
        settlementStatus: 'Pending',
        upiRefNo: `6298${Math.floor(10000000 + Math.random() * 90000000)}`,
      };

      onTransactionCreated(newTxn);
      setIsSimulating(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-100 overflow-hidden"
        role="dialog"
        aria-labelledby="quick-payment-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="font-extrabold text-base text-neutral-900" id="quick-payment-title">
              Create Payment Link / Simulate
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Customer Full Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-neutral-50 px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
              placeholder="e.g. Rahul Sharma"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Customer Email / UPI
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full bg-neutral-50 px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
              placeholder="e.g. rahul@enterprise.in"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Amount (INR ₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-neutral-500 text-sm">
                ₹
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-neutral-50 pl-8 pr-4 py-2 rounded-xl text-sm font-extrabold text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
                min="10"
                step="1"
                required
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-2">
              Preferred Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['UPI', 'Credit Card', 'Debit Card', 'Net Banking'] as PaymentMethod[]).map((method) => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === method
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {method === 'UPI' && <Smartphone className="w-4 h-4" />}
                  {method === 'Credit Card' && <CreditCard className="w-4 h-4" />}
                  {method === 'Debit Card' && <CreditCard className="w-4 h-4" />}
                  {method === 'Net Banking' && <Building2 className="w-4 h-4" />}
                  <span>{method}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Created Link display if generated */}
          {createdLink && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-emerald-800">
                Payment Link Generated:
              </span>
              <div className="flex items-center gap-2 text-xs font-mono bg-white p-2 rounded-lg border border-emerald-100">
                <span className="truncate flex-1 text-emerald-900">{createdLink}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdLink);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="p-1 hover:bg-neutral-100 rounded text-neutral-600 cursor-pointer"
                >
                  {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-50 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleGenerateLink}
            className="text-xs font-bold text-neutral-700 hover:text-neutral-950 cursor-pointer"
          >
            Generate Link
          </button>

          <button
            type="button"
            onClick={handleSimulatePayment}
            disabled={isSimulating}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isSimulating ? 'Processing...' : 'Simulate Customer Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};
