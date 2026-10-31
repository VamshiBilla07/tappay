import React, { useState } from 'react';
import { ChevronDown, ArrowUpRight } from 'lucide-react';
import { VolumeBarData, DateRangeOption } from '../types';
import { formatINR } from '../utils/formatters';

interface TopMetricsProps {
  availableBalance: number;
  todayRevenue: number;
  todayGrowth: number;
  volumeBars: VolumeBarData[];
  selectedRange: DateRangeOption;
  onRangeChange: (range: DateRangeOption) => void;
  onPayoutClick?: () => void;
}

export const TopMetrics: React.FC<TopMetricsProps> = ({
  availableBalance,
  todayRevenue,
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

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start py-2">
      {/* 1. Wallet / Available Balance */}
      <div className="lg:col-span-3 flex flex-col justify-between">
        <div>
          <span className="text-sm font-medium text-neutral-500 tracking-normal">
            Wallet Balance
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              {formatINR(availableBalance)}
            </h2>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
            <span>Today's revenue</span>
            <span className="text-emerald-600 font-bold">+{todayGrowth}%</span>
          </div>
        </div>

        {onPayoutClick && (
          <div className="mt-4">
            <button
              onClick={onPayoutClick}
              className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
            >
              Request Settlement Payout <ArrowUpRight className="w-3 h-3" />
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
            <span className="bg-[#8da3f8]/20 text-[#4c63d2] text-[11px] font-bold px-2 py-0.5 rounded-full">
              +{todayGrowth}%
            </span>
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              {formatINR(todayRevenue, false)}
            </h2>
          </div>

          <p className="mt-2 text-xs font-medium text-neutral-400">
            vs. yesterday (₹7,460)
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
                UPI
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-900" />
                Cards & Net
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

        {/* Custom Equalizer Volume Bars matching Screenshot */}
        <div className="relative w-full h-24 bg-neutral-50/60 rounded-2xl p-2.5 flex items-end justify-between gap-1.5 sm:gap-2">
          {volumeBars.map((bar, index) => {
            // Heights calculation normalized to fit height
            const upiHeight = Math.max(12, Math.min(54, (bar.upiValue / 100) * 44 + 10));
            const cardHeight = Math.max(8, Math.min(28, (bar.cardNetValue / 60) * 20 + 8));

            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredBar(bar)}
                onMouseLeave={() => setHoveredBar(null)}
                className="group relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer py-1"
              >
                {/* Upper bar: Charcoal with diagonal stripe texture or sleek pill */}
                <div
                  style={{ height: `${cardHeight}px` }}
                  className="w-full max-w-[20px] rounded-md bg-neutral-900 mb-1 transition-all duration-200 group-hover:scale-y-110 relative overflow-hidden"
                >
                  {/* Subtle hatched stripe pattern on top bar */}
                  <div 
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, #fff, #fff 2px, transparent 2px, transparent 4px)',
                    }}
                  />
                </div>

                {/* Lower bar: Soft periwinkle blue rounded pill */}
                <div
                  style={{ height: `${upiHeight}px` }}
                  className="w-full max-w-[20px] rounded-lg bg-[#8da3f8] group-hover:bg-[#7b92f7] transition-all duration-200 shadow-2xs"
                />
              </div>
            );
          })}

          {/* Interactive Tooltip */}
          {hoveredBar && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-neutral-900 text-white px-3 py-1.5 rounded-xl text-[11px] font-medium shadow-xl pointer-events-none z-30 flex items-center gap-2 whitespace-nowrap">
              <span className="font-bold text-white">{hoveredBar.timeLabel}:</span>
              <span className="text-[#a5b4fc]">UPI ₹{(hoveredBar.upiValue * 380).toLocaleString()}</span>
              <span className="text-neutral-400">•</span>
              <span className="text-neutral-200">Cards ₹{(hoveredBar.cardNetValue * 380).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
