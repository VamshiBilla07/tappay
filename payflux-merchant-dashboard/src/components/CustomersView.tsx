import React, { useMemo, useState } from 'react';
import { Customer, Transaction } from '../types';
import { formatINR, formatDateTime } from '../utils/formatters';
import { Search, ExternalLink, ShieldCheck, Mail } from 'lucide-react';
import { basescanAddress, shortAddr } from '../lib/config';

interface CustomersViewProps {
  transactions: Transaction[];
  customers: Customer[];
}

export const CustomersView: React.FC<CustomersViewProps> = ({ transactions, customers }) => {
  const [search, setSearch] = useState('');

  const lastPaymentByCustomer = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of transactions) {
      if (t.status !== 'Successful') continue;
      const key = t.customer.id || t.customer.email || t.customer.name;
      const prev = map.get(key);
      if (!prev || +new Date(t.createdAt) > +new Date(prev)) map.set(key, t.createdAt);
    }
    return map;
  }, [transactions]);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-extrabold text-base text-neutral-900 tracking-tight">
              Customer Directory
            </h3>
            <p className="text-xs text-neutral-400">
              Built from settled payments only — one row per payer wallet or named customer
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

        {filtered.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <p className="text-sm font-semibold text-neutral-700">
              {customers.length === 0 ? 'No customers yet' : 'No matching customers'}
            </p>
            <p className="text-xs text-neutral-400">
              {customers.length === 0
                ? 'A customer appears here after their first settled payment.'
                : 'Try a different name, handle, or email.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Wallet / Email</th>
                  <th className="py-3 px-3">Total Paid</th>
                  <th className="py-3 px-3">Payments</th>
                  <th className="py-3 px-3">Last Payment</th>
                  <th className="py-3 px-3 text-right">Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {filtered.map((c) => {
                  const isWallet = /^0x[0-9a-fA-F]{40}$/.test(c.id);
                  const initial = c.name.replace(/^0x/, '').slice(0, 2).toUpperCase() || 'GH';
                  const last = lastPaymentByCustomer.get(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {c.avatar ? (
                            <img
                              src={c.avatar}
                              alt={c.name}
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-neutral-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 flex items-center justify-center text-[10px] font-extrabold shrink-0">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-neutral-900 truncate max-w-[160px]">{c.name}</div>
                            <div className="text-[11px] text-neutral-400 font-mono truncate max-w-[160px]">
                              {c.handle}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-neutral-600 font-medium">
                        {isWallet ? (
                          <span className="font-mono" title={c.id}>{shortAddr(c.id)}</span>
                        ) : c.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3 text-neutral-400" />
                            {c.email}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">not provided</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-neutral-900 whitespace-nowrap">
                        {formatINR(c.totalSpent)}
                      </td>
                      <td className="py-3.5 px-3 text-neutral-700 font-semibold whitespace-nowrap">
                        {c.transactionsCount}
                      </td>
                      <td className="py-3.5 px-3 text-neutral-600 font-medium whitespace-nowrap">
                        {last ? formatDateTime(last) : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {isWallet ? (
                          <a
                            href={basescanAddress(c.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:underline"
                          >
                            BaseScan <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" /> settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
