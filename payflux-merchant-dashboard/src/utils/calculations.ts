import type { Transaction } from '../types';

export interface DashboardSummary {
  availableBalance: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  todayRevenueGrowth: number;
  totalVolume: number;
  paymentsTodayCount: number;
  paymentsTodayAmount: number;
  successRate: number;
  last30DaysRevenue: number;
  upiSharePercent: number;
  pendingCount: number;
}

const UPI_METHODS = new Set(['UPI', 'Wallet', 'Digital Wallets', 'Cryptocurrency']);

const sum = (rows: Transaction[], pick: (t: Transaction) => number = (t) => t.amount): number =>
  rows.reduce((acc, t) => acc + pick(t), 0);

const round2 = (n: number): number => Math.round(n * 100) / 100;

const startOfDay = (d: Date): number => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
};

/**
 * Every figure comes from the transactions passed in. Pending/Created/Failed
 * rows never contribute to revenue or balance. `walletBalance` is the live
 * on-chain USDC balance (in INR) when available.
 */
export function calculateSummary(transactions: Transaction[], walletBalance?: number): DashboardSummary {
  const successful = transactions.filter((t) => t.status === 'Successful');
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterday = new Date(todayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = yesterday.getTime();

  const today = successful.filter((t) => {
    const at = new Date(t.createdAt).getTime();
    return at >= todayStart;
  });
  const priorDay = successful.filter((t) => {
    const at = new Date(t.createdAt).getTime();
    return at >= yesterdayStart && at < todayStart;
  });

  const todayRevenue = round2(sum(today));
  const yesterdayRevenue = round2(sum(priorDay));
  const todayRevenueGrowth = yesterdayRevenue > 0
    ? round2(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
    : 0;

  const totalVolume = round2(sum(successful));
  const settled = transactions.filter((t) =>
    t.status === 'Successful' || t.status === 'Failed' || t.status === 'Cancelled' || t.status === 'Refunded');
  const successRate = settled.length > 0
    ? round2((successful.length / settled.length) * 100)
    : 100;

  const from30 = now.getTime() - 30 * 86_400_000;
  const last30DaysRevenue = round2(sum(successful.filter((t) => +new Date(t.createdAt) >= from30)));
  const upiVolume = sum(successful.filter((t) => UPI_METHODS.has(t.paymentMethod)));

  return {
    availableBalance: round2(walletBalance ?? sum(successful, (t) => t.netAmount)),
    todayRevenue,
    yesterdayRevenue,
    todayRevenueGrowth,
    totalVolume,
    paymentsTodayCount: today.length,
    paymentsTodayAmount: todayRevenue,
    successRate,
    last30DaysRevenue,
    upiSharePercent: totalVolume > 0 ? round2((upiVolume / totalVolume) * 100) : 0,
    pendingCount: transactions.filter(
      (t) => t.status === 'Pending' || t.status === 'Processing' || t.status === 'Created',
    ).length,
  };
}

export function filterTransactions(
  transactions: Transaction[],
  query: string,
  statusFilter: string,
  methodFilter: string,
): Transaction[] {
  return transactions.filter((t) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q ||
      t.id.toLowerCase().includes(q) ||
      t.referenceId.toLowerCase().includes(q) ||
      t.customer.name.toLowerCase().includes(q) ||
      t.customer.handle.toLowerCase().includes(q) ||
      t.customer.email.toLowerCase().includes(q) ||
      (t.upiRefNo && t.upiRefNo.toLowerCase().includes(q)) ||
      (t.txHash && t.txHash.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesMethod = methodFilter === 'All' || t.paymentMethod === methodFilter;

    return matchesQuery && matchesStatus && matchesMethod;
  });
}
