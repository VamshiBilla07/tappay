import React, { useState } from 'react';
import { Transaction, PaymentLink } from '../types';
import { RecentTransactionsTable } from './RecentTransactionsTable';
import { formatINR, formatDateTime } from '../utils/formatters';
import { 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Link2, 
  Copy, 
  Check, 
  ExternalLink,
  XCircle,
  Ban
} from 'lucide-react';

interface TransactionsViewProps {
  transactions: Transaction[];
  paymentLinks: PaymentLink[];
  onSelectTransaction: (txn: Transaction) => void;
  onOpenCreateLink: () => void;
  onOpenCheckout: (link: PaymentLink) => void;
  onCancelLink: (linkId: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  paymentLinks,
  onSelectTransaction,
  onOpenCreateLink,
  onOpenCheckout,
  onCancelLink,
}) => {
  const [subTab, setSubTab] = useState<'transactions' | 'payment_links'>('transactions');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const successCount = transactions.filter((t) => t.status === 'Successful').length;
  const pendingCount = transactions.filter((t) => t.status === 'Pending' || t.status === 'Processing' || t.status === 'Created').length;
  const totalGross = transactions.reduce((acc, t) => acc + (t.status === 'Successful' ? t.amount : 0), 0);

  const copyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkId(id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Verified Settled Revenue</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-neutral-900 mt-2">
            {formatINR(totalGross)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {successCount} verified payments
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>In-Flight & Created</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-neutral-900 mt-2">
            {pendingCount} Orders
          </div>
          <div className="text-[11px] text-neutral-500 font-semibold mt-1">
            Awaiting customer payment completion
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-500 text-xs font-semibold">
            <span>Payment Link Generator</span>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
              Multi-Channel
            </span>
          </div>
          <div>
            <button
              onClick={onOpenCreateLink}
              className="w-full mt-2 inline-flex items-center justify-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs py-2 px-3 rounded-xl transition-colors cursor-pointer"
            >
              + Create Payment Link <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tabs: Transactions vs Payment Links */}
      <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('transactions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'transactions'
                ? 'bg-neutral-900 text-white shadow-2xs'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            }`}
          >
            Transactions Ledger ({transactions.length})
          </button>

          <button
            onClick={() => setSubTab('payment_links')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              subTab === 'payment_links'
                ? 'bg-neutral-900 text-white shadow-2xs'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Generated Payment Links ({paymentLinks.length})</span>
          </button>
        </div>
      </div>

      {/* View 1: Transactions Table */}
      {subTab === 'transactions' && (
        <RecentTransactionsTable
          transactions={transactions}
          onSelectTransaction={onSelectTransaction}
          isDetailedView={true}
        />
      )}

      {/* View 2: Payment Links Directory */}
      {subTab === 'payment_links' && (
        <div className="bg-white rounded-[28px] border border-neutral-100 shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base text-neutral-900">
                Active & Historic Payment Links
              </h3>
              <p className="text-xs text-neutral-400">
                Live records from the payment server — copy a link, reopen checkout, or cancel an unpaid request
              </p>
            </div>

            <button
              onClick={onOpenCreateLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              + Create New Link
            </button>
          </div>

          <div className="overflow-x-auto -mx-5 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Link ID / Order</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Payable Amount</th>
                  <th className="py-3 px-3">Allowed Methods</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paymentLinks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-400">
                      No payment links generated yet. Click "+ Create New Link" above.
                    </td>
                  </tr>
                ) : (
                  paymentLinks.map((link) => (
                    <tr key={link.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-3 font-mono font-bold text-neutral-900">
                        <div>{link.orderId}</div>
                        <div className="text-[10px] text-neutral-400 font-normal truncate max-w-[150px]">
                          {link.description}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-neutral-900">
                          {link.customer.name || 'Open to all'}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {link.customer.email || 'Will enter at checkout'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-bold text-neutral-900 text-sm">
                        {formatINR(link.amount)}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md">
                          {link.allowedMethods.length} methods enabled
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          link.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : link.status === 'Cancelled'
                            ? 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {link.status === 'Paid' ? 'Paid ✓' : link.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => copyLink(link.id, link.shortUrl)}
                            className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-700 cursor-pointer"
                            title="Copy customer checkout URL"
                          >
                            {copiedLinkId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => onOpenCheckout(link)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] border border-indigo-200 cursor-pointer"
                            title="Open Customer Checkout Page"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Checkout</span>
                          </button>

                          {link.status === 'Created' || link.status === 'Pending' ? (
                            <button
                              onClick={() => onCancelLink(link.id)}
                              className="p-1.5 rounded-lg border border-neutral-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                              title="Cancel or expire link"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
