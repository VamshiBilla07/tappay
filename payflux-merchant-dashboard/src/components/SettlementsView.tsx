import React, { useMemo, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { Transaction } from '../types';
import { formatINR, formatDateTime } from '../utils/formatters';
import { basescanAddress, basescanTx, shortAddr } from '../lib/config';

interface SettlementsViewProps {
  transactions: Transaction[];
  walletAddress?: string | null;
  /** Live wallet balance in INR, when it could be read. */
  balance?: number | null;
}

export const SettlementsView: React.FC<SettlementsViewProps> = ({
  transactions,
  walletAddress,
  balance,
}) => {
  const [copied, setCopied] = useState<string | null>(null);

  const settled = useMemo(
    () =>
      transactions
        .filter((t) => t.status === 'Successful')
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [transactions],
  );

  const pending = useMemo(
    () => transactions.filter((t) => ['Created', 'Pending', 'Processing'].includes(t.status)),
    [transactions],
  );

  const totalSettled = useMemo(
    () => Math.round(settled.reduce((a, t) => a + t.amount, 0) * 100) / 100,
    [settled],
  );

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner: settlement wallet instead of a bank account */}
      <div className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold text-lg text-neutral-900">
                  Settlement Wallet
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Base Sepolia · USDC
                </span>
              </div>
              {walletAddress ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-mono text-neutral-600">{walletAddress}</span>
                  <button
                    onClick={() => copy(walletAddress)}
                    className="p-0.5 text-neutral-400 hover:text-neutral-900 cursor-pointer"
                    title="Copy wallet address"
                  >
                    {copied === walletAddress ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-neutral-500 mt-1">
                  Connect MetaMask to see the wallet that receives settlements.
                </p>
              )}
              <p className="text-[11px] text-neutral-400 mt-1.5 max-w-md leading-relaxed">
                Payments settle immediately into this wallet when the customer's transaction confirms. There is no
                batching, no T+1 cut-off, and no intermediary holding your funds.
              </p>
            </div>
          </div>

          <div className="text-left md:text-right flex flex-col md:items-end justify-center shrink-0">
            <span className="text-xs text-neutral-400 font-medium">Settled volume</span>
            <div className="text-2xl font-black text-neutral-900 mt-0.5">
              {formatINR(totalSettled)}
            </div>
            {balance != null && (
              <span className="text-[11px] text-neutral-400 mt-0.5">
                Wallet balance {formatINR(balance)}
              </span>
            )}
            {walletAddress && (
              <a
                href={basescanAddress(walletAddress)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-300" />
                View wallet on BaseScan
              </a>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              <strong className="text-neutral-900">{settled.length}</strong> settled payment
              {settled.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-neutral-600">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>
              <strong className="text-neutral-900">{pending.length}</strong> awaiting payment
            </span>
          </div>
          <div className="flex items-center gap-2 text-neutral-600">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>Signed by the merchant wallet</span>
          </div>
        </div>
      </div>

      {/* Settlement ledger */}
      <div className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-extrabold text-base text-neutral-900 tracking-tight">
              On-chain settlement ledger
            </h3>
            <p className="text-xs text-neutral-400">
              One row per confirmed <span className="font-mono">PaymentSettled</span> event — this is the money
              trail, not a bank batch.
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
            {settled.length} record{settled.length === 1 ? '' : 's'}
          </span>
        </div>

        {settled.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <p className="text-sm font-semibold text-neutral-700">No settlements yet</p>
            <p className="text-xs text-neutral-400">
              Create a payment link, open it in a second wallet, and pay — the settlement lands here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Transaction</th>
                  <th className="py-3 px-3">Settled at</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">USDC</th>
                  <th className="py-3 px-3">Rail</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Tx hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {settled.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-mono font-bold text-neutral-800">{t.id}</div>
                      <div className="text-[11px] text-neutral-400 truncate max-w-[160px]">
                        {t.customer.name}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-neutral-700 whitespace-nowrap">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="py-3.5 px-3 font-black text-emerald-700 text-sm whitespace-nowrap">
                      {formatINR(t.amount)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-neutral-600 whitespace-nowrap">
                      {t.metadata?.usdc ? `${t.metadata.usdc} USDC` : '—'}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {t.metadata?.rail === 'ETH' ? 'ETH → USDC' : 'USDC'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#e8f8f0] text-[#107e4d] border border-[#c1ebd5]">
                        Settled
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-neutral-500 whitespace-nowrap">
                      {t.txHash ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={basescanTx(t.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-neutral-900 hover:underline inline-flex items-center gap-1"
                            title={t.txHash}
                          >
                            {shortAddr(t.txHash)}
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => copy(t.txHash!)}
                            className="hover:text-neutral-900 cursor-pointer p-0.5"
                            title="Copy transaction hash"
                          >
                            {copied === t.txHash ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
