import React, { useState } from 'react';
import { Customer } from '../types';
import { CUSTOMERS_LIST } from '../data/mockData';
import { formatINR } from '../utils/formatters';
import { Search, Mail, ExternalLink, ShieldCheck, UserCheck } from 'lucide-react';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(CUSTOMERS_LIST);
  const [search, setSearch] = useState('');

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.handle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-extrabold text-base text-neutral-900 tracking-tight">
              Customer Directory
            </h3>
            <p className="text-xs text-neutral-400">
              Verified buyers and client payment histories across all checkout methods
            </p>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or email..."
              className="w-full bg-neutral-50 pl-9 pr-4 py-2 rounded-xl text-xs border border-neutral-200 focus:outline-none focus:border-neutral-900"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                <th className="py-3 px-3">Customer Profile</th>
                <th className="py-3 px-3">Email Address</th>
                <th className="py-3 px-3">Total Paid Volume</th>
                <th className="py-3 px-3">Orders</th>
                <th className="py-3 px-3">Risk Assessment</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={c.avatar}
                        alt={c.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-neutral-200"
                      />
                      <div>
                        <div className="font-bold text-neutral-900">{c.name}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">{c.handle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-neutral-600 font-medium">{c.email}</td>
                  <td className="py-3.5 px-3 font-bold text-neutral-900">
                    {formatINR(c.totalSpent)}
                  </td>
                  <td className="py-3.5 px-3 text-neutral-700 font-semibold">
                    {c.transactionsCount} payments
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" /> Low Risk
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => alert(`Customer statement generated for ${c.name}`)}
                      className="text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:underline cursor-pointer"
                    >
                      Statement
                    </button>
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
