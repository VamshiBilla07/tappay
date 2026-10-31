import test from 'node:test';
import assert from 'node:assert/strict';
import { formatINR, formatCompactINR, formatPercent } from './formatters';
import { calculateSummary, filterTransactions } from './calculations';
import { Transaction } from '../types';

/** ISO timestamp `daysAgo` days back at a fixed local hour, so day-bucket tests stay deterministic. */
const at = (daysAgo: number, hour = 12): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const tx = (over: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'status'>): Transaction => ({
  referenceId: `ref_${over.id}`,
  customer: { id: 'c1', name: 'Alex Morgan', handle: '@alexm', email: 'alex@example.com' },
  currency: 'INR',
  fee: 0,
  tax: 0,
  netAmount: over.amount,
  paymentMethod: 'UPI',
  createdAt: at(0),
  settlementStatus: 'Settled',
  ...over,
});

test('formatINR correctly formats standard Indian Rupee amounts with commas', () => {
  assert.equal(formatINR(48250), '₹48,250.00');
  assert.equal(formatINR(136580), '₹1,36,580.00');
  assert.equal(formatINR(8420, false), '₹8,420');
  assert.equal(formatINR(0), '₹0.00');
  assert.equal(formatINR(-500), '-₹500.00');
});

test('formatCompactINR formats values into K, L, and Cr properly', () => {
  assert.equal(formatCompactINR(42800), '₹42.8K');
  assert.equal(formatCompactINR(136580), '₹1.37L');
  assert.equal(formatCompactINR(8420), '₹8.4K');
  assert.equal(formatCompactINR(500), '₹500');
});

test('formatPercent handles positive and negative percentages', () => {
  assert.equal(formatPercent(12.8), '+12.8%');
  assert.equal(formatPercent(-3.5), '-3.5%');
  assert.equal(formatPercent(96.4, false), '96.4%');
});

test('CRITICAL: Created, Pending, or Failed payments DO NOT increase revenue or available balance', () => {
  const baseTxns: Transaction[] = [tx({ id: 'TX-10482', amount: 4250, status: 'Successful' })];

  const baseSummary = calculateSummary(baseTxns);
  assert.equal(baseSummary.todayRevenue, 4250);

  // Add an unverified payment link request (Created / Pending)
  const pendingTxn = tx({ id: 'TX-99999', amount: 10000, status: 'Pending' });

  const pendingSummary = calculateSummary([pendingTxn, ...baseTxns]);
  // Revenue and available balance MUST remain identical to base because payment is still Pending!
  assert.equal(pendingSummary.todayRevenue, baseSummary.todayRevenue);
  assert.equal(pendingSummary.availableBalance, baseSummary.availableBalance);
  assert.equal(pendingSummary.paymentsTodayCount, baseSummary.paymentsTodayCount);
  assert.equal(pendingSummary.pendingCount, 1);

  // Now simulate successful payment verification
  const verifiedSummary = calculateSummary([{ ...pendingTxn, status: 'Successful' }, ...baseTxns]);
  // Now revenue and balance MUST increase!
  assert.ok(verifiedSummary.todayRevenue > baseSummary.todayRevenue);
  assert.ok(verifiedSummary.availableBalance > baseSummary.availableBalance);
  assert.equal(verifiedSummary.paymentsTodayCount, baseSummary.paymentsTodayCount + 1);
  assert.equal(verifiedSummary.pendingCount, 0);
});

test('day buckets separate today from yesterday and compute growth from real rows', () => {
  const rows = [
    tx({ id: 'TX-1', amount: 1000, status: 'Successful', createdAt: at(0, 9) }),
    tx({ id: 'TX-2', amount: 500, status: 'Successful', createdAt: at(0, 18) }),
    tx({ id: 'TX-3', amount: 1000, status: 'Successful', createdAt: at(1, 9) }),
    tx({ id: 'TX-4', amount: 2000, status: 'Successful', createdAt: at(2, 9) }),
  ];
  const s = calculateSummary(rows);

  assert.equal(s.todayRevenue, 1500);
  assert.equal(s.yesterdayRevenue, 1000);
  assert.equal(s.todayRevenueGrowth, 50);
  assert.equal(s.totalVolume, 4500);
  assert.equal(s.last30DaysRevenue, 4500);
  assert.equal(s.paymentsTodayCount, 2);
});

test('an explicit wallet balance wins over summed revenue', () => {
  const rows = [tx({ id: 'TX-1', amount: 1000, status: 'Successful' })];
  assert.equal(calculateSummary(rows, 777.5).availableBalance, 777.5);
  assert.equal(calculateSummary(rows).availableBalance, 1000);
});

test('empty history reports zeros, not fake baselines', () => {
  const s = calculateSummary([]);
  assert.equal(s.todayRevenue, 0);
  assert.equal(s.yesterdayRevenue, 0);
  assert.equal(s.availableBalance, 0);
  assert.equal(s.totalVolume, 0);
  assert.equal(s.paymentsTodayCount, 0);
  assert.equal(s.successRate, 100);
  assert.equal(s.upiSharePercent, 0);
});

test('filterTransactions filters by status and payment method correctly', () => {
  const mockTxns: Transaction[] = [
    {
      id: 'TX-10482',
      referenceId: 'ref_1',
      customer: { id: 'c1', name: 'Alex Morgan', handle: '@alexm', email: 'alex@example.com' },
      amount: 4250,
      currency: 'INR',
      fee: 42.5,
      tax: 7.65,
      netAmount: 4199.85,
      paymentMethod: 'UPI',
      status: 'Successful',
      createdAt: '2026-10-30T10:15:00Z',
      settlementStatus: 'Settled',
    },
    {
      id: 'TX-10483',
      referenceId: 'ref_2',
      customer: { id: 'c2', name: 'Maya Chen', handle: '@mayac', email: 'maya@example.com' },
      amount: 1685,
      currency: 'INR',
      fee: 33.7,
      tax: 6.06,
      netAmount: 1645.24,
      paymentMethod: 'Credit Card',
      status: 'Processing',
      createdAt: '2026-10-30T11:20:00Z',
      settlementStatus: 'Pending',
    },
    {
      id: 'TX-10484',
      referenceId: 'ref_3',
      customer: { id: 'c3', name: 'Satoshi Nakamoto', handle: '@sat', email: 'sat@block.org' },
      amount: 8900,
      currency: 'INR',
      fee: 89,
      tax: 16.02,
      netAmount: 8794.98,
      paymentMethod: 'Cryptocurrency',
      status: 'Created',
      createdAt: '2026-10-30T12:00:00Z',
      settlementStatus: 'Pending',
    },
  ];

  const cryptoResult = filterTransactions(mockTxns, '', 'All', 'Cryptocurrency');
  assert.equal(cryptoResult.length, 1);
  assert.equal(cryptoResult[0].paymentMethod, 'Cryptocurrency');

  const createdResult = filterTransactions(mockTxns, '', 'Created', 'All');
  assert.equal(createdResult.length, 1);
  assert.equal(createdResult[0].status, 'Created');
});
