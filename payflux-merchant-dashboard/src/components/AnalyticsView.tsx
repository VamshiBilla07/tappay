import React, { useMemo } from 'react';
import { TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { PaymentMethod, Transaction } from '../types';
import { formatINR } from '../utils/formatters';

interface AnalyticsViewProps {
  transactions: Transaction[];
}

const METHOD_COLOR: Record<string, string> = {
  UPI: 'bg-emerald-500',
  'Credit Card': 'bg-indigo-500',
  'Debit Card': 'bg-blue-500',
  'Net Banking': 'bg-cyan-500',
  'Digital Wallets': 'bg-amber-500',
  Wallet: 'bg-teal-500',
  'NFC / Contactless': 'bg-violet-500',
  Cryptocurrency: 'bg-purple-500',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ transactions }) => {
  const stats = useMemo(() => {
    const successful = transactions.filter((t) => t.status === 'Successful');
    const settled = transactions.filter((t) =>
      ['Successful', 'Failed', 'Cancelled', 'Refunded'].includes(t.status),
    );
    const refunded = transactions.filter((t) => t.status === 'Refunded');
    const from30 = Date.now() - 30 * 86_400_000;
    const recent = successful.filter((t) => +new Date(t.createdAt) >= from30);
    const total = round2(recent.reduce((a, t) => a + t.amount, 0));
    const count = recent.length;

    const byMethod = new Map<string, { volume: number; count: number }>();
    for (const t of recent) {
      const prev = byMethod.get(t.paymentMethod) ?? { volume: 0, count: 0 };
      prev.volume += t.amount;
      prev.count += 1;
      byMethod.set(t.paymentMethod, prev);
    }
    const methods = [...byMethod.entries()]
      .map(([method, v]) => ({
        method: method as PaymentMethod,
        volume: round2(v.volume),
        count: v.count,
        percent: total > 0 ? round2((v.volume / total) * 100) : 0,
        color: METHOD_COLOR[method] ?? 'bg-neutral-500',
      }))
      .sort((a, b) => b.volume - a.volume);

    const ethRail = recent.filter((t) => t.metadata?.rail === 'ETH');
    const usdcRail = recent.filter((t) => t.metadata?.rail !== 'ETH');
    const railVolume = (rows: Transaction[]) => round2(rows.reduce((a, t) => a + t.amount, 0));

    return {
      total,
      count,
      aov: count > 0 ? round2(total / count) : 0,
      successRate: settled.length > 0 ? round2((successful.length / settled.length) * 100) : 100,
      refunds: refunded.length,
      refundRate: settled.length > 0 ? round2((refunded.length / settled.length) * 100) : 0,
      methods,
      rails: [
        {
          key: 'USDC',
          label: 'Direct USDC transfer',
          detail: 'pay() — customer holds testnet USDC',
          count: usdcRail.length,
          volume: railVolume(usdcRail),
          color: 'bg-[#8da3f8]',
        },
        {
          key: 'ETH',
          label: 'ETH → exact USDC swap',
          detail: 'payWithEth() — Uniswap 0.3% pool, excess refunded',
          count: ethRail.length,
          volume: railVolume(ethRail),
          color: 'bg-neutral-900',
        },
      ],
    };
  }, [transactions]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Headline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-400">Total 30-Day Volume</span>
          <div className="text-2xl font-black text-neutral-900 mt-1">{formatINR(stats.total)}</div>
          <div className="text-xs font-bold text-neutral-500 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> {stats.count} settled payment{stats.count === 1 ? '' : 's'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-400">Average Order Value (AOV)</span>
          <div className="text-2xl font-black text-neutral-900 mt-1">{formatINR(stats.aov)}</div>
          <div className="text-xs font-semibold text-neutral-500 mt-1">
            Based on {stats.count} settled order{stats.count === 1 ? '' : 's'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-400">Overall Success Rate</span>
          <div className="text-2xl font-black text-indigo-600 mt-1">{stats.successRate}%</div>
          <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Settled / attempted on-chain
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-400">Refund / Dispute Rate</span>
          <div className="text-2xl font-black text-neutral-900 mt-1">{stats.refundRate}%</div>
          <div className="text-xs font-bold text-neutral-500 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> {stats.refunds} refund{stats.refunds === 1 ? '' : 's'} recorded
          </div>
        </div>
      </div>

      {/* Grid: Payment Method Mix & Settlement Rails */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Payment Method Distribution */}
        <div className="lg:col-span-6 bg-white p-6 rounded-[28px] border border-neutral-100 shadow-2xs">
          <h3 className="font-extrabold text-base text-neutral-900 tracking-tight mb-4">
            Payment Method Breakdown
          </h3>

          {stats.methods.length === 0 ? (
            <div className="py-10 text-center text-xs text-neutral-400">
              No settled payments in the last 30 days.
            </div>
          ) : (
            <div className="space-y-4">
              {stats.methods.map((item) => (
                <div key={item.method} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-neutral-700">{item.method}</span>
                    <span className="text-neutral-900">
                      {item.percent}% ({formatINR(item.volume)})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(item.percent, 1)}%` }}
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs text-neutral-600">
            <strong>How the label maps to money:</strong> UPI, wallet, NFC and crypto selections settle as a direct
            testnet USDC transfer. Card and net-banking selections swap ETH to exactly the invoiced USDC. No bank
            debit or card acquiring is connected in this build.
          </div>
        </div>

        {/* Right: Settlement Rail Performance */}
        <div className="lg:col-span-6 bg-white p-6 rounded-[28px] border border-neutral-100 shadow-2xs">
          <h3 className="font-extrabold text-base text-neutral-900 tracking-tight mb-4">
            Settlement Rails
          </h3>

          <div className="divide-y divide-neutral-100">
            {stats.rails.map((rail) => (
              <div key={rail.key} className="py-3.5 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${rail.color}`} />
                    {rail.label}
                  </div>
                  <div className="text-neutral-400 text-[11px] font-mono truncate">{rail.detail}</div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-extrabold text-neutral-900">{formatINR(rail.volume)}</div>
                  <div className="text-neutral-400 text-[11px]">
                    {rail.count} payment{rail.count === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Settlement contract</span>
            <span className="font-semibold text-emerald-600">Base Sepolia · EIP-712</span>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400">
            <span>Fees</span>
            <span>None taken by this app (gas only)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
