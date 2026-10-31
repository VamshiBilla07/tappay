import React, { useState } from 'react';
import { 
  Building2, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Download, 
  ShieldCheck, 
  Zap,
  Copy,
  Check
} from 'lucide-react';
import { SETTLEMENT_BATCHES } from '../data/mockData';
import { SettlementBatch } from '../types';
import { formatINR } from '../utils/formatters';

export const SettlementsView: React.FC = () => {
  const [batches, setBatches] = useState<SettlementBatch[]>(SETTLEMENT_BATCHES);
  const [isRequestingInstant, setIsRequestingInstant] = useState(false);
  const [instantSuccess, setInstantSuccess] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  const handleInstantPayout = () => {
    setIsRequestingInstant(true);
    setTimeout(() => {
      setIsRequestingInstant(false);
      setInstantSuccess(true);
      // Update batch
      setBatches((prev) => [
        {
          id: `SET-${Math.floor(10000 + Math.random() * 90000)}`,
          period: 'Today (Instant On-Demand)',
          totalVolume: 48250.00,
          deductions: 72.38,
          settledAmount: 48177.62,
          status: 'Completed',
          bankAccount: 'HDFC Bank •• 8492',
          settledAt: 'Just now',
          utrNumber: `HDFCN${Date.now().toString().slice(-11)}`,
        },
        ...prev,
      ]);
      setTimeout(() => setInstantSuccess(false), 4000);
    }, 1000);
  };

  const copyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner: Connected Bank Account & Payout Status */}
      <div className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-neutral-900">
                  Primary Settlement Account
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Penny Verified ✓
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                HDFC Bank Ltd • Current Account • A/C No: <strong>5020008492019</strong> • IFSC: <strong>HDFC0001048</strong>
              </p>
              <div className="text-xs text-neutral-600 font-medium mt-1">
                Account Holder: <strong>Apex Electronics & Gear Ltd.</strong>
              </div>
            </div>
          </div>

          {/* Quick Instant Payout Action */}
          <div className="text-right flex flex-col sm:items-end justify-center">
            <span className="text-xs text-neutral-400 font-medium">Unsettled Ready Balance</span>
            <div className="text-2xl font-black text-neutral-900 mt-0.5">
              ₹48,250.00
            </div>
            <button
              onClick={handleInstantPayout}
              disabled={isRequestingInstant}
              className="mt-2 inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              {isRequestingInstant ? 'Initiating IMPS...' : 'Instant Payout Now (0.15% fee)'}
            </button>
          </div>
        </div>

        {instantSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Instant payout of ₹48,177.62 dispatched via IMPS directly into your HDFC Bank account!</span>
          </div>
        )}
      </div>

      {/* Settlement Batches Table */}
      <div className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-base text-neutral-900 tracking-tight">
              Settlement Batches & UTR History
            </h3>
            <p className="text-xs text-neutral-400">
              Standard automated T+1 settlements processed every morning at 06:00 AM IST
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                <th className="py-3 px-3">Batch ID</th>
                <th className="py-3 px-3">Collection Period</th>
                <th className="py-3 px-3">Gross Volume</th>
                <th className="py-3 px-3">MDR & Tax</th>
                <th className="py-3 px-3">Net Credited</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">UTR Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="py-3.5 px-3 font-mono font-bold text-neutral-800">
                    {batch.id}
                  </td>
                  <td className="py-3.5 px-3 font-medium text-neutral-700">
                    {batch.period}
                  </td>
                  <td className="py-3.5 px-3 font-bold text-neutral-900">
                    {formatINR(batch.totalVolume)}
                  </td>
                  <td className="py-3.5 px-3 text-neutral-500 font-medium">
                    -{formatINR(batch.deductions)}
                  </td>
                  <td className="py-3.5 px-3 font-black text-emerald-700 text-sm">
                    {formatINR(batch.settledAmount)}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      batch.status === 'Completed'
                        ? 'bg-[#e8f8f0] text-[#107e4d] border border-[#c1ebd5]'
                        : 'bg-[#fef5e7] text-[#b46b0a] border border-[#fde2b4]'
                    }`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 font-mono text-neutral-500">
                    {batch.utrNumber !== 'PENDING_DISPATCH' ? (
                      <div className="flex items-center gap-1.5">
                        <span>{batch.utrNumber}</span>
                        <button
                          onClick={() => copyUtr(batch.utrNumber)}
                          className="hover:text-neutral-900 cursor-pointer p-0.5"
                          title="Copy UTR"
                        >
                          {copiedUtr === batch.utrNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-neutral-400 italic">Dispatches 06:00 AM</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
