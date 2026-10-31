import React, { useState } from 'react';
import { Plus, ArrowRight, ArrowUpRight, Check, Clock, AlertCircle } from 'lucide-react';
import { PaymentItem } from '../types';
import { formatINR } from '../utils/formatters';

interface AnalyticsCardsProps {
  paymentsTodayCount: number;
  paymentsTodayAmount: number;
  successRate: number;
  upiSharePercent: number;
  last30DaysRevenue: number;
  recentPayments: PaymentItem[];
  onOpenQuickPayment: () => void;
  onSelectPayment?: (payment: PaymentItem) => void;
  onViewAllPayments?: () => void;
}

export const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({
  paymentsTodayCount,
  paymentsTodayAmount,
  successRate,
  upiSharePercent,
  last30DaysRevenue,
  recentPayments,
  onOpenQuickPayment,
  onSelectPayment,
  onViewAllPayments,
}) => {
  const [activeRevenueTab, setActiveRevenueTab] = useState<'30d' | '7d'>('30d');

  // Soundwave bars data for the Total Revenue glowing card
  const revenueWaveform = [
    12, 18, 14, 28, 22, 35, 18, 42, 26, 32, 48, 55, 30, 44, 62, 50, 
    38, 46, 58, 65, 42, 36, 52, 70, 85, 60, 48, 72, 64, 80, 92, 75,
    60, 45, 55, 70, 85, 95, 68, 78, 88, 62, 50, 40, 65, 75, 90, 82
  ];

  // Dot matrix columns for the Payment Mix / Success card
  const dotColumns = [
    [1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1],
  ];

  const getStatusBadge = (status: PaymentItem['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#e8f8f0] text-[#107e4d] border border-[#c1ebd5]">
            Completed
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#edf1fe] text-[#4462e0] border border-[#d2dcfe]">
            Processing
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#fef5e7] text-[#b46b0a] border border-[#fde2b4]">
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 items-stretch py-2">
      {/* 1. Sky Blue / Periwinkle Card: Payments Today */}
      <div className="xl:col-span-3 rounded-[28px] p-6 bg-gradient-to-b from-[#8ba7f8] via-[#8fa9f7] to-[#99b5ff] text-white flex flex-col justify-between shadow-sm relative overflow-hidden group">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-start justify-between relative z-10">
          <div>
            <div className="text-3xl font-extrabold tracking-tight">
              {paymentsTodayCount}
            </div>
            <div className="text-xs font-medium text-white/85 mt-0.5">
              Payments today
            </div>
          </div>

          <button
            onClick={onOpenQuickPayment}
            aria-label="Create payment"
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Center: Stylized Floating Translucent Document / Payment Slips */}
        <div className="my-6 flex items-center justify-center relative py-4">
          {/* Back document */}
          <div className="w-16 h-20 bg-white/25 backdrop-blur-md rounded-xl rotate-[-12deg] shadow-lg border border-white/30 transition-transform group-hover:rotate-[-16deg]" />
          {/* Front document */}
          <div className="w-18 h-22 bg-white/40 backdrop-blur-md rounded-xl rotate-[8deg] -ml-8 shadow-xl border border-white/40 flex flex-col p-2.5 justify-between transition-transform group-hover:rotate-[12deg]">
            <div className="space-y-1">
              <div className="w-6 h-1.5 bg-white/80 rounded-full" />
              <div className="w-9 h-1.5 bg-white/60 rounded-full" />
            </div>
            <div className="flex items-center justify-between text-[8px] font-bold text-white/90">
              <span>USDC</span>
              <span>Base</span>
            </div>
          </div>
        </div>

        {/* Bottom Pill: Processed Volume */}
        <div className="relative z-10 pt-2">
          <button
            onClick={onViewAllPayments}
            className="w-full bg-white/20 hover:bg-white/25 backdrop-blur-md border border-white/30 rounded-2xl px-3.5 py-2.5 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="text-left">
              <div className="text-xs font-extrabold tracking-tight">
                {formatINR(paymentsTodayAmount, false)}
              </div>
              <div className="text-[10px] text-white/80">
                Processed today
              </div>
            </div>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </div>
          </button>
        </div>
      </div>

      {/* 2. Lavender to Peach Sunset Card: Payment Success / Mix */}
      <div className="xl:col-span-3 rounded-[28px] p-6 bg-gradient-to-b from-[#8fa0f0] via-[#c693df] to-[#f89582] text-white flex flex-col justify-between shadow-sm relative overflow-hidden group">
        {/* Top Tag */}
        <div className="flex items-center justify-center">
          <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-semibold text-white/90 border border-white/20">
            Payment mix
          </span>
        </div>

        {/* Center Big Typography */}
        <div className="text-center my-auto py-2">
          <div className="text-4xl font-extrabold tracking-tight">
            {upiSharePercent}%
          </div>
          <div className="text-xs font-medium text-white/85 mt-1">
            Direct-USDC share
          </div>
          <div className="text-[11px] text-white/70 mt-0.5">
            Success rate: <strong className="text-white font-bold">{successRate}%</strong>
          </div>
        </div>

        {/* Bottom: Stylized Soundwave / Dot Matrix equalizer */}
        <div className="flex items-end justify-center gap-1.5 h-12 pt-2">
          {dotColumns.map((col, cIdx) => (
            <div key={cIdx} className="flex flex-col gap-1 items-center">
              {col.map((_, dotIdx) => (
                <span
                  key={dotIdx}
                  className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-xs"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Radiant Peach to Sunset Orange Glowing Card: Total Revenue */}
      <div className="xl:col-span-3 rounded-[28px] p-6 bg-gradient-to-r from-[#fcb383] via-[#ff8d69] to-[#f43f75] text-white flex flex-col justify-between shadow-sm relative overflow-hidden group">
        {/* Top Tag */}
        <div className="flex items-center justify-center">
          <span className="px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-semibold text-white/95 border border-white/20">
            Total revenue
          </span>
        </div>

        {/* Center Typography matching screenshot */}
        <div className="text-center my-auto py-2">
          <div className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-xs">
            {formatINR(last30DaysRevenue, false)}
          </div>
          <div className="text-xs font-semibold text-white/85 mt-1">
            Last 30 days
          </div>
        </div>

        {/* Bottom: High-density Soundwave Pulse Bars */}
        <div className="w-full flex items-end justify-between gap-[2px] h-10 px-1 pt-2">
          {revenueWaveform.map((val, idx) => (
            <div
              key={idx}
              style={{ height: `${(val / 100) * 32 + 4}px` }}
              className="w-[2px] bg-white/80 rounded-full transition-all duration-150 group-hover:bg-white"
            />
          ))}
        </div>
      </div>

      {/* 4. Recent Payments List Card matching Screenshot */}
      <div className="xl:col-span-3 rounded-[28px] p-5 bg-white border border-neutral-100 shadow-sm flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-1">
          <h3 className="text-base font-extrabold text-neutral-900 tracking-tight">
            Recent Payments
          </h3>
          <button
            onClick={onViewAllPayments}
            aria-label="View all payments"
            className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Rows */}
        <div className="space-y-3.5 flex-1">
          {recentPayments.length === 0 && (
            <div className="h-full min-h-24 flex items-center justify-center text-center px-3">
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                No settled payments yet. Create a payment link and pay it from a second wallet.
              </p>
            </div>
          )}
          {recentPayments.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectPayment?.(item)}
              className="flex items-center justify-between text-xs p-1.5 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt={item.customerName}
                    className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-neutral-100"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 shrink-0 ring-1 ring-indigo-100 flex items-center justify-center text-[10px] font-extrabold">
                    {item.customerName.replace(/^0x/, '').slice(0, 2).toUpperCase() || 'GH'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-neutral-900 whitespace-nowrap truncate">
                    {item.customerName}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono truncate">
                    {item.customerHandle}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right whitespace-nowrap">
                  <span className="font-bold text-neutral-900">
                    {formatINR(item.amount, false)}
                  </span>
                </div>
                {getStatusBadge(item.status)}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center border-t border-neutral-100 mt-2">
          <button
            onClick={onViewAllPayments}
            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            View all payments →
          </button>
        </div>
      </div>
    </div>
  );
};
