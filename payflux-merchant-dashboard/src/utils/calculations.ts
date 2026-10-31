import { Transaction, TransactionStatus, PaymentMethod } from '../types';

export interface DashboardSummary {
  availableBalance: number;
  todayRevenue: number;
  todayRevenueGrowth: number;
  totalVolume: number;
  paymentsTodayCount: number;
  paymentsTodayAmount: number;
  successRate: number;
  last30DaysRevenue: number;
  upiSharePercent: number;
  pendingCount: number;
}

export function calculateSummary(transactions: Transaction[]): DashboardSummary {
  // Base numbers from prototype reference, enhanced dynamically by newly verified successful transactions
  const newlyAdded = transactions.filter((t) => !t.id.startsWith('TX-08') && !t.id.startsWith('TX-10482'));
  
  // CRITICAL REQUIREMENT: Only Successful transactions increase revenue or settlement totals!
  const newlyVerifiedSuccess = newlyAdded.filter((t) => t.status === 'Successful');
  const newlyAddedVolume = newlyVerifiedSuccess.reduce((acc, t) => acc + t.amount, 0);
  
  // Pending or Created transactions should count toward in-flight orders, but NOT revenue
  const pendingTransactions = transactions.filter(
    (t) => t.status === 'Pending' || t.status === 'Processing' || t.status === 'Created'
  );

  const paymentsTodayCount = 173 + newlyVerifiedSuccess.length;
  const paymentsTodayAmount = 42800 + newlyAddedVolume;
  const todayRevenue = 8420.00 + (newlyAddedVolume > 0 ? newlyAddedVolume * 0.98 : 0);
  const availableBalance = 48250.00 + (newlyAddedVolume > 0 ? newlyAddedVolume * 0.98 : 0);

  // Success rate across settled transactions (excluding in-flight pending/created)
  const allSettled = transactions.filter((t) => 
    t.status === 'Successful' || t.status === 'Failed' || t.status === 'Cancelled'
  );
  const totalCompleted = transactions.filter((t) => t.status === 'Successful').length;
  const successRate = allSettled.length > 0 
    ? Math.min(99.4, Math.max(90.0, (totalCompleted / allSettled.length) * 100)) 
    : 96.4;

  return {
    availableBalance: Math.round(availableBalance * 100) / 100,
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    todayRevenueGrowth: 12.8,
    totalVolume: Math.round((136580.00 + newlyAddedVolume) * 100) / 100,
    paymentsTodayCount,
    paymentsTodayAmount,
    successRate: Math.round(successRate * 10) / 10,
    last30DaysRevenue: Math.round((136580.00 + newlyAddedVolume) * 100) / 100,
    upiSharePercent: 67,
    pendingCount: pendingTransactions.length,
  };
}

export function filterTransactions(
  transactions: Transaction[],
  query: string,
  statusFilter: string,
  methodFilter: string
): Transaction[] {
  return transactions.filter((t) => {
    // Search query matches id, customer name, email, or handle
    const q = query.trim().toLowerCase();
    const matchesQuery = !q ||
      t.id.toLowerCase().includes(q) ||
      t.referenceId.toLowerCase().includes(q) ||
      t.customer.name.toLowerCase().includes(q) ||
      t.customer.handle.toLowerCase().includes(q) ||
      t.customer.email.toLowerCase().includes(q) ||
      (t.upiRefNo && t.upiRefNo.toLowerCase().includes(q)) ||
      (t.txHash && t.txHash.toLowerCase().includes(q));

    // Status filter
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;

    // Method filter
    const matchesMethod = methodFilter === 'All' || t.paymentMethod === methodFilter;

    return matchesQuery && matchesStatus && matchesMethod;
  });
}
