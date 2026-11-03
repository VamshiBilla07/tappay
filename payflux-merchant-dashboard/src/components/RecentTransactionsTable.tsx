import React, { useState } from 'react';
import { 
  Search, 
  ChevronRight, 
  Copy, 
  Check, 
  Smartphone, 
  CreditCard, 
  Building2, 
  Wallet, 
  Coins,
  Radio,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { Transaction, TransactionStatus, PaymentMethod } from '../types';
import { formatINR, formatDateTime } from '../utils/formatters';

interface RecentTransactionsTableProps {
  transactions: Transaction[];
  onSelectTransaction: (txn: Transaction) => void;
  onViewAll?: () => void;
  isDetailedView?: boolean;
  title?: string;
  subtitle?: string;
}

export const RecentTransactionsTable: React.FC<RecentTransactionsTableProps> = ({
  transactions,
  onSelectTransaction,
  onViewAll,
  isDetailedView = false,
  title = 'Recent Transactions',
  subtitle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedMethod, setSelectedMethod] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const statuses: string[] = [
    'All', 
    'Successful', 
    'Processing', 
    'Pending', 
    'Created',
    'Failed', 
    'Cancelled',
    'Refunded', 
    'Expired'
  ];

  const methods: string[] = [
    'All', 
    'UPI', 
    'Credit Card', 
    'Debit Card', 
    'Net Banking', 
    'Digital Wallets', 
    'NFC / Contactless', 
    'Cryptocurrency'
  ];

  const copyToClipboard = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'UPI':
        return (
          <div className="w-6 h-6 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
        );
      case 'Credit Card':
      case 'Debit Card':
        return (
          <div className="w-6 h-6 rounded-lg bg-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
        );
      case 'Net Banking':
        return (
          <div className="w-6 h-6 rounded-lg bg-cyan-100/80 text-cyan-700 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
        );
      case 'Wallet':
      case 'Digital Wallets':
        return (
          <div className="w-6 h-6 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
            <Wallet className="w-3.5 h-3.5" />
          </div>
        );
      case 'NFC / Contactless':
        return (
          <div className="w-6 h-6 rounded-lg bg-rose-100/80 text-rose-700 flex items-center justify-center shrink-0">
            <Radio className="w-3.5 h-3.5" />
          </div>
        );
      case 'Cryptocurrency':
        return (
          <div className="w-6 h-6 rounded-lg bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
            <Coins className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'Successful':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#e8f8f0] text-[#107e4d] border border-[#c1ebd5]">
            <CheckCircle2 className="w-3 h-3" />
            <span>Successful</span>
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#edf1fe] text-[#4462e0] border border-[#d2dcfe]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>Processing</span>
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#fef5e7] text-[#b46b0a] border border-[#fde2b4]">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        );
      case 'Created':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            <Clock className="w-3 h-3" />
            <span>Created</span>
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]">
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
            <span>Cancelled</span>
          </span>
        );
      case 'Refunded':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            <RotateCcw className="w-3 h-3" />
            <span>Refunded</span>
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
            <span>Expired</span>
          </span>
        );
    }
  };

  // Filter transactions
  const filtered = transactions.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      t.id.toLowerCase().includes(q) ||
      t.referenceId.toLowerCase().includes(q) ||
      t.customer.name.toLowerCase().includes(q) ||
      t.customer.email.toLowerCase().includes(q) ||
      (t.upiRefNo && t.upiRefNo.toLowerCase().includes(q)) ||
      (t.txHash && t.txHash.toLowerCase().includes(q));

    const matchesStatus = selectedStatus === 'All' || t.status === selectedStatus;
    const matchesMethod = selectedMethod === 'All' || t.paymentMethod === selectedMethod;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const displayList = isDetailedView ? filtered : filtered.slice(0, 7);

  const exportCSV = () => {
    // Prefix formula-looking cells so a crafted customer name can't run in Excel/Sheets.
    const cell = (value: string | number) => {
      const raw = String(value ?? '');
      const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
      return `"${guarded.replace(/"/g, '""')}"`;
    };
    const headers = ['Transaction ID', 'Customer Name', 'Email', 'Payment Method', 'Amount (INR)', 'Status', 'Date', 'Tx Hash'];
    const rows = filtered.map((t) => [
      t.id,
      t.customer.name,
      t.customer.email,
      t.paymentMethod,
      t.amount,
      t.status,
      t.createdAt,
      t.txHash ?? '',
    ].map(cell));
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PayFlux_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-white rounded-[28px] border border-neutral-100 shadow-sm p-4 sm:p-6 my-2 overflow-hidden">
      {/* Top Header Row matching screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight">
              {title}
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
              {filtered.length} total
            </span>
          </div>
          {subtitle && <p className="text-[11px] text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
            title="Export filtered transactions to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {!isDetailedView && onViewAll && (
            <button
              onClick={onViewAll}
              className="inline-flex items-center gap-1 text-xs font-bold text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer ml-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, customer, email, or tx hash..."
            className="w-full bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white text-xs font-medium text-neutral-900 placeholder:text-neutral-400 pl-9 pr-4 py-2 rounded-xl border border-neutral-200/80 focus:border-neutral-900 focus:outline-none transition-all"
          />
        </div>

        {/* Method & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="text-xs font-semibold bg-neutral-100 hover:bg-neutral-200/70 text-neutral-700 px-3 py-1.5 rounded-full border border-neutral-200/60 cursor-pointer focus:outline-none"
            aria-label="Filter by payment method"
          >
            {methods.map((m) => (
              <option key={m} value={m}>
                {m === 'All' ? 'All Methods' : m}
              </option>
            ))}
          </select>

          {/* Status Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            {statuses.slice(0, 6).map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedStatus === status
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200/70 text-neutral-600'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Container with smooth horizontal scrolling */}
      <div className="overflow-x-auto -mx-4 sm:mx-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              <th className="py-3 px-4">Transaction ID</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Payment Method</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Date & Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/80 text-xs">
            {displayList.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-neutral-400">
                  No transactions match your current search and filters.
                </td>
              </tr>
            ) : (
              displayList.map((txn) => (
                <tr
                  key={txn.id}
                  onClick={() => onSelectTransaction(txn)}
                  className="hover:bg-neutral-50/80 transition-colors cursor-pointer group"
                >
                  {/* Transaction ID */}
                  <td className="py-3.5 px-4 font-mono font-medium text-neutral-800">
                    <div className="flex items-center gap-1.5">
                      <span className="group-hover:text-indigo-600 transition-colors font-bold">
                        {txn.id}
                      </span>
                      <button
                        onClick={(e) => copyToClipboard(e, txn.id)}
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-700 transition-opacity p-0.5 rounded cursor-pointer"
                        title="Copy Transaction ID"
                      >
                        {copiedId === txn.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={txn.customer.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                        alt={txn.customer.name}
                        className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-neutral-200"
                      />
                      <div>
                        <div className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">
                          {txn.customer.name}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {txn.customer.handle}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Amount (INR) */}
                  <td className="py-3.5 px-4 font-bold text-neutral-900 text-sm">
                    {formatINR(txn.amount)}
                  </td>

                  {/* Payment Method */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      {getMethodIcon(txn.paymentMethod)}
                      <div>
                        <span className="font-semibold text-neutral-800">
                          {txn.paymentMethod}
                        </span>
                        {txn.paymentSubtype && (
                          <span className="block text-[10px] text-neutral-400">
                            {txn.paymentSubtype}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    {getStatusBadge(txn.status)}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-right text-neutral-500 font-medium whitespace-nowrap">
                    {formatDateTime(txn.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
