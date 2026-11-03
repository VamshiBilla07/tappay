import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle,
  Clock,
  ArrowRight,
  Coins,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Transaction } from '../types';
import { formatINR, formatDateTime } from '../utils/formatters';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  /** Optional: only rendered when a real refund handler exists. */
  onRefund?: (transactionId: string) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onRefund,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  if (!transaction) return null;

  const copyText = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRefundClick = () => {
    if (!onRefund) return;
    setIsRefunding(true);
    setIsRefunding(false);
    onRefund(transaction.id);
  };

  /** Plain-text receipt built from the row itself — no claim of an emailed GST invoice. */
  const downloadReceipt = () => {
    const lines = [
      'PayFlux payment receipt (testnet)',
      `Transaction: ${transaction.id}`,
      `Reference: ${transaction.referenceId}`,
      `Status: ${transaction.status}`,
      `Amount: ${formatINR(transaction.amount)}`,
      `Method: ${transaction.paymentMethod}${transaction.paymentSubtype ? ` (${transaction.paymentSubtype})` : ''}`,
      `Customer: ${transaction.customer.name} <${transaction.customer.email || 'no email'}>`,
      `Created: ${transaction.createdAt}`,
      `Network: Base Sepolia (84532)`,
      ...(transaction.txHash ? [`Transaction hash: ${transaction.txHash}`] : []),
      '',
      'This receipt covers an on-chain testnet settlement. It is not a tax invoice.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${transaction.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'Successful':
        return 'bg-[#e8f8f0] text-[#107e4d] border border-[#c1ebd5]';
      case 'Processing':
        return 'bg-[#edf1fe] text-[#4462e0] border border-[#d2dcfe]';
      case 'Pending':
        return 'bg-[#fef5e7] text-[#b46b0a] border border-[#fde2b4]';
      case 'Created':
        return 'bg-sky-50 text-sky-700 border border-sky-200';
      case 'Failed':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'Cancelled':
        return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
      case 'Refunded':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'Expired':
        return 'bg-stone-100 text-stone-600 border border-stone-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-neutral-100 overflow-hidden my-4 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base text-neutral-900" id="modal-title">
              Transaction Details
            </span>
            <span className="text-xs font-mono font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
              {transaction.id}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Main Amount & Status Banner */}
          <div className="bg-neutral-50 rounded-2xl p-4 flex items-center justify-between border border-neutral-100">
            <div>
              <span className="text-xs font-medium text-neutral-500">Gross Payable Amount</span>
              <div className="text-2xl font-black text-neutral-900 mt-0.5">
                {formatINR(transaction.amount)}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-neutral-500">Status</span>
              <div className="mt-1">
                <span className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full ${getStatusBadge(transaction.status)}`}>
                  {transaction.status}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown: Fee & Net Settlement */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 text-neutral-600">
              <span>Gateway Processing Fee (MDR):</span>
              <span className="font-semibold">{formatINR(transaction.fee)}</span>
            </div>
            <div className="flex justify-between py-1 text-neutral-600">
              <span>GST on Gateway Fee (18%):</span>
              <span className="font-semibold">{formatINR(transaction.tax)}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-dashed border-neutral-200 text-neutral-900 font-bold">
              <span>Estimated Merchant Settlement:</span>
              <span className={`${transaction.status === 'Successful' ? 'text-emerald-700 font-black' : 'text-neutral-500'}`}>
                {transaction.status === 'Successful' ? formatINR(transaction.netAmount) : 'Pending Verification'}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="border-t border-neutral-100 pt-4 space-y-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400">
              Customer Information
            </h4>
            <div className="flex items-center gap-3">
              <img
                src={transaction.customer.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                alt={transaction.customer.name}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-neutral-200"
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-neutral-900">
                  {transaction.customer.name}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  {transaction.customer.email} {transaction.customer.phone ? `• ${transaction.customer.phone}` : ''}
                </div>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                {transaction.customer.handle}
              </span>
            </div>
          </div>

          {/* Technical Identifiers */}
          <div className="border-t border-neutral-100 pt-4 space-y-2.5 text-xs">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400 mb-2">
              Payment Gateway Trace
            </h4>
            
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Payment Method:</span>
              <span className="font-semibold text-neutral-900">
                {transaction.paymentMethod} {transaction.paymentSubtype ? `(${transaction.paymentSubtype})` : ''}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Order Reference ID:</span>
              <div className="flex items-center gap-1 font-mono text-neutral-700">
                <span>{transaction.referenceId}</span>
                <button
                  onClick={() => copyText('ref', transaction.referenceId)}
                  className="p-1 hover:bg-neutral-100 rounded text-neutral-400 cursor-pointer"
                >
                  {copiedKey === 'ref' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {transaction.upiRefNo && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">UPI RRN / NPCI Ref:</span>
                <div className="flex items-center gap-1 font-mono text-neutral-700">
                  <span>{transaction.upiRefNo}</span>
                  <button
                    onClick={() => copyText('rrn', transaction.upiRefNo!)}
                    className="p-1 hover:bg-neutral-100 rounded text-neutral-400 cursor-pointer"
                  >
                    {copiedKey === 'rrn' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            )}

            {transaction.utrNumber && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Bank UTR Number:</span>
                <div className="flex items-center gap-1 font-mono text-neutral-700">
                  <span>{transaction.utrNumber}</span>
                  <button
                    onClick={() => copyText('utr', transaction.utrNumber!)}
                    className="p-1 hover:bg-neutral-100 rounded text-neutral-400 cursor-pointer"
                  >
                    {copiedKey === 'utr' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            )}

            {transaction.txHash && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Blockchain Tx Hash:</span>
                <div className="flex items-center gap-1 font-mono text-neutral-700 max-w-[200px]">
                  <span className="truncate">{transaction.txHash}</span>
                  <button
                    onClick={() => copyText('hash', transaction.txHash!)}
                    className="p-1 hover:bg-neutral-100 rounded text-neutral-400 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'hash' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Settlement Status:</span>
              <span className={`font-semibold ${
                transaction.settlementStatus === 'Settled' ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {transaction.settlementStatus} (T+1 Cycle)
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Timestamp:</span>
              <span className="font-medium text-neutral-700">
                {formatDateTime(transaction.createdAt)}
              </span>
            </div>

            {transaction.failureReason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                <strong>Failure Reason:</strong> {transaction.failureReason}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-neutral-50 border-t border-neutral-100">
          <button
            onClick={downloadReceipt}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Receipt
          </button>

          <div className="flex items-center gap-2">
            {transaction.status === 'Successful' && onRefund && (
              <button
                onClick={handleRefundClick}
                disabled={isRefunding}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isRefunding ? 'Processing...' : 'Issue Refund'}
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
