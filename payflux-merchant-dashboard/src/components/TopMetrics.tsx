import React, { useState } from 'react';
import { ChevronDown, ArrowUpRight } from 'lucide-react';
import { VolumeBarData, DateRangeOption } from '../types';
import { formatINR } from '../utils/formatters';

interface TopMetricsProps {
  availableBalance: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  todayGrowth: number;
  volumeBars: VolumeBarData[];
  selectedRange: DateRangeOption;
  onRangeChange: (range: DateRangeOption) => void;
  onPayoutClick?: () => void;
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}%`;

export const TopMetrics: React.FC<TopMetricsProps> = ({
  availableBalance,
  todayRevenue,
  yesterdayRevenue,
  todayGrowth,
  volumeBars,
  selectedRange,
  onRangeChange,
  onPayoutClick,
}) => {
  const [hoveredBar, setHoveredBar] = useState<VolumeBarData | null>(null);
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);

  const rangeLabels: Record<DateRangeOption, string> = {
    today: 'Today',
    '7days': 'Last 7 days',
    '30days': 'Last 30 days',
    '90days': 'Last 90 days',
  };

  // Bars are INR, so scale them against the busiest bucket instead of a fixed baseline.
  const maxTotal = Math.max(
    1,
    ...volumeBars.map((b) => b.upiValue + b.cardNetValue),
  );
  const CHART_HEIGHT = 68;
  const heightFor = (value: number) =>
    value <= 0 ? 2 : Math.max(3, (value / maxTotal) * CHART_HEIGHT);

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start py-2">
      {/* 1. Wallet / Available Balance */}
      <div className="lg:col-span-3 flex flex-col justify-between">
        <div>
          <span className="text-sm font-medium text-neutral-500 tracking-normal">
            USDC Wallet Balance
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              {formatINR(availableBalance)}
            </h2>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
            <span>Today's revenue</span>
            <span className={todayGrowth >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
              {signed(todayGrowth)}
            </span>
          </div>
        </div>

        {onPayoutClick && (
          <div className="mt-4">
            <button
              onClick={onPayoutClick}
              className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
            >
              View settlements <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Today's Revenue */}
      <div className="lg:col-span-3 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-500 tracking-normal">
              Today's Revenue
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                todayGrowth >= 0
                  ? 'bg-[#8da3f8]/20 text-[#4c63d2]'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {signed(todayGrowth)}
            </span>
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              {formatINR(todayRevenue, false)}
            </h2>
          </div>

          <p className="mt-2 text-xs font-medium text-neutral-400">
            vs. yesterday ({formatINR(yesterdayRevenue, false)})
          </p>
        </div>
      </div>

      {/* 3. Payment Volume & Visualizer Bar Chart */}
      <div className="lg:col-span-6 flex flex-col">
        {/* Top Controls: Legend and Date Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-neutral-800">
              Payment Volume
            </span>
            <div className="flex items-center gap-3 text-xs font-medium text-neutral-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8da3f8]" />
                Direct USDC
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-900" />
                ETH → USDC
              </span>
            </div>
          </div>

          {/* Date Range Selector Pill */}
          <div className="relative">
            <button
              onClick={() => setRangeDropdownOpen(!rangeDropdownOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
            >
              <span>{rangeLabels[selectedRange]}</span>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>

            {rangeDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-36 bg-white rounded-xl shadow-lg border border-neutral-100 py-1 z-30">
                {(Object.keys(rangeLabels) as DateRangeOption[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      onRangeChange(key);
                      setRangeDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      selectedRange === key
                        ? 'bg-neutral-900 text-white font-semibold'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {rangeLabels[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Custom Equalizer Volume Bars */}
        <div className="relative w-full h-24 bg-neutral-50/60 rounded-2xl p-2.5 flex items-end justify-between gap-1.5 sm:gap-2">
          {volumeBars.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
              No settled payments in this range yet.
            </div>
          ) : (
            volumeBars.map((bar, index) => (
              <div
                key={index}
                onMouseEnter={() => setHoveredBar(bar)}
                onMouseLeave={() => setHoveredBar(null)}
                className="group relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer py-1"
              >
                {/* Upper bar: ETH-swapped settlements */}
                <div
                  style={{ height: `${heightFor(bar.cardNetValue)}px` }}
                  className="w-full max-w-[20px] rounded-md bg-neutral-900 mb-1 transition-all duration-200 group-hover:scale-y-110 relative overflow-hidden"
                >
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, #fff, #fff 2px, transparent 2px, transparent 4px)',
                    }}
                  />
                </div>

                {/* Lower bar: direct USDC settlements */}
                <div
                  style={{ height: `${heightFor(bar.upiValue)}px` }}
                  className="w-full max-w-[20px] rounded-lg bg-[#8da3f8] group-hover:bg-[#7b92f7] transition-all duration-200 shadow-2xs"
                />
              </div>
            ))
          )}

          {/* Interactive Tooltip */}
          {hoveredBar && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-neutral-900 text-white px-3 py-1.5 rounded-xl text-[11px] font-medium shadow-xl pointer-events-none z-30 flex items-center gap-2 whitespace-nowrap">
              <span className="font-bold text-white">{hoveredBar.timeLabel}:</span>
              <span className="text-[#a5b4fc]">USDC {formatINR(hoveredBar.upiValue, false)}</span>
              <span className="text-neutral-400">•</span>
              <span className="text-neutral-200">ETH {formatINR(hoveredBar.cardNetValue, false)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
