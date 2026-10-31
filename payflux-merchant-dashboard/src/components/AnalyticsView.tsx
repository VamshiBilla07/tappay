import React from 'react';
import { 
  TrendingUp, 
  ShieldCheck, 
  Smartphone, 
  CreditCard, 
  Building2, 
  Wallet,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

export const AnalyticsView: React.FC = () => {
  const bankRates = [
    { name: 'HDFC Bank', success: 98.2, volume: '₹48,200', latency: '420ms' },
    { name: 'ICICI Bank', success: 97.5, volume: '₹34,100', latency: '480ms' },
    { name: 'State Bank of India', success: 94.1, volume: '₹29,800', latency: '750ms' },
    { name: 'Axis Bank', success: 96.8, volume: '₹22,400', latency: '510ms' },
  ];

  const methodDistribution = [
    { method: 'UPI (GPay / PhonePe / Paytm)', percent: 67, volume: '₹91,500', color: 'bg-emerald-500' },
    { method: 'Credit & Debit Cards', percent: 21, volume: '₹28,680', color: 'bg-indigo-500' },
    { method: 'Net Banking (Corporate & Retail)', percent: 8, volume: '₹10,920', color: 'bg-blue-500' },
    { method: 'Prepaid Wallets & BNPL', percent: 4, volume: '₹5,480', color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Headline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-400">Total 30-Day Volume</span>
          <div className="text-2xl font-black text-neutral-900 mt-1">₹1,36,580.00</div>
          <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +24.6% month-over-month
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-400">Average Order Value (AOV)</span>
          <div className="text-2xl font-black text-neutral-900 mt-1">₹2,460.00</div>
          <div className="text-xs font-semibold text-neutral-500 mt-1">Based on 173 settled orders</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-400">Overall Success Rate</span>
          <div className="text-2xl font-black text-indigo-600 mt-1">96.4%</div>
          <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Top 5% tier in India
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-400">Refund / Dispute Rate</span>
          <div className="text-2xl font-black text-neutral-900 mt-1">0.38%</div>
          <div className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Well below 1.0% limit
          </div>
        </div>
      </div>

      {/* Grid: Payment Method Mix & Bank Routing Latencies */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Payment Method Distribution */}
        <div className="lg:col-span-6 bg-white p-6 rounded-[28px] border border-neutral-100 shadow-2xs">
          <h3 className="font-extrabold text-base text-neutral-900 tracking-tight mb-4">
            Payment Method Breakdown
          </h3>

          <div className="space-y-4">
            {methodDistribution.map((item) => (
              <div key={item.method} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-neutral-700">{item.method}</span>
                  <span className="text-neutral-900">{item.percent}% ({item.volume})</span>
                </div>
                <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${item.percent}%` }}
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs text-neutral-600">
            <strong>Intelligent Routing:</strong> PayFlux dynamic checkout promotes UPI Intent & QR which generates 18% higher conversion compared to 3D-Secure cards.
          </div>
        </div>

        {/* Right: Bank Gateway Latencies & Success Rates */}
        <div className="lg:col-span-6 bg-white p-6 rounded-[28px] border border-neutral-100 shadow-2xs">
          <h3 className="font-extrabold text-base text-neutral-900 tracking-tight mb-4">
            Issuer Bank Performance
          </h3>

          <div className="divide-y divide-neutral-100">
            {bankRates.map((b) => (
              <div key={b.name} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-neutral-900">{b.name}</div>
                  <div className="text-neutral-400 text-[11px]">Avg response: {b.latency}</div>
                </div>

                <div className="text-right">
                  <div className="font-extrabold text-emerald-600">{b.success}% Success</div>
                  <div className="text-neutral-400 text-[11px]">{b.volume} processed</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Dynamic Failover Engine</span>
            <span className="font-semibold text-emerald-600">Active (Zero-Downtime)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
