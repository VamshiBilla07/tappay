import type { Customer, PaymentItem, PaymentMethod, Transaction, VolumeBarData } from '../types';
import type { Sale } from './chain';
import type { PaymentLinkView } from './paylink';
import { shortAddr } from './config';

export const UPI_METHODS: PaymentMethod[] = ['UPI', 'Wallet', 'Digital Wallets', 'Cryptocurrency'];

const asMethod = (value: string | undefined, fallback: PaymentMethod): PaymentMethod =>
  (['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet', 'Digital Wallets', 'NFC / Contactless', 'Cryptocurrency'] as string[])
    .includes(value ?? '') ? (value as PaymentMethod) : fallback;

const txStatusFor = (status: PaymentLinkView['status']): Transaction['status'] =>
  status === 'paid' ? 'Successful'
    : status === 'expired' ? 'Expired'
      : status === 'cancelled' ? 'Cancelled'
        : 'Created';

/** A settled PaymentSettled event → the dashboard's INR-denominated row. */
export function saleToTransaction(sale: Sale, rate: number, link?: PaymentLinkView, usdc?: bigint): Transaction {
  const usdcAmount = usdc ?? sale.usdcAmount;
  const inr = Number(usdcAmount) / 1e6 * rate;
  const method = asMethod(link?.method, sale.paidWithEth ? 'Credit Card' : 'Cryptocurrency');
  const when = sale.time ? new Date(sale.time * 1000).toISOString() : new Date().toISOString();
  const who = link?.customer?.name?.trim() || shortAddr(sale.payer);
  return {
    id: `TX-${sale.nonce.slice(2, 10).toUpperCase()}`,
    referenceId: sale.nonce,
    paymentLinkId: link?.id,
    customer: {
      id: sale.payer,
      name: who,
      handle: shortAddr(sale.payer),
      email: link?.customer?.email ?? '',
      phone: link?.customer?.phone,
    },
    amount: round2(inr),
    currency: 'INR',
    fee: 0,
    tax: 0,
    netAmount: round2(inr),
    paymentMethod: method,
    paymentSubtype: sale.paidWithEth ? 'ETH → USDC swap' : 'USDC on Base',
    status: 'Successful',
    createdAt: when,
    updatedAt: when,
    settlementStatus: 'Settled',
    txHash: sale.tx,
    metadata: {
      usdc: (Number(usdcAmount) / 1e6).toFixed(6),
      rail: sale.paidWithEth ? 'ETH' : 'USDC',
      payer: sale.payer,
    },
  };
}

/** An unpaid (or server-recorded) link → a pending row. Never counts as revenue. */
export function linkToTransaction(link: PaymentLinkView): Transaction {
  const method = asMethod(link.method ?? link.methods[0], 'UPI');
  const who = link.customer?.name?.trim() || 'Guest customer';
  return {
    id: `PL-${link.id.replace(/^plink_/, '').toUpperCase()}`,
    referenceId: link.id,
    paymentLinkId: link.id,
    customer: {
      id: link.customer?.email || link.id,
      name: who,
      handle: link.customer?.email ? `@${link.customer.email.split('@')[0]}` : '@guest',
      email: link.customer?.email ?? '',
      phone: link.customer?.phone,
    },
    amount: round2(link.inr),
    currency: 'INR',
    fee: 0,
    tax: 0,
    netAmount: round2(link.inr),
    paymentMethod: method,
    paymentSubtype: link.methods.join(' · '),
    status: txStatusFor(link.status),
    createdAt: new Date(link.createdAt * 1000).toISOString(),
    updatedAt: new Date(link.createdAt * 1000).toISOString(),
    settlementStatus: 'Pending',
    txHash: link.txHash,
    metadata: { usdc: link.usdc },
  };
}

/** Merges chain sales with pending links, de-duplicating by nonce. */
export function buildTransactions(
  sales: Sale[],
  links: PaymentLinkView[],
  rate: number,
  demoTransactions: Transaction[] | null,
): Transaction[] {
  if (demoTransactions) return demoTransactions;
  const byNonce = new Map<string, PaymentLinkView>();
  for (const l of links) byNonce.set(l.request.r.nonce.toLowerCase(), l);
  const seen = new Set<string>();
  const rows: Transaction[] = [];
  for (const s of sales) {
    const key = s.nonce.toLowerCase();
    seen.add(key);
    rows.push(saleToTransaction(s, rate, byNonce.get(key)));
  }
  for (const l of links) {
    if (seen.has(l.request.r.nonce.toLowerCase())) continue;
    rows.push(linkToTransaction(l));
  }
  return rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function deriveVolumeBars(transactions: Transaction[], days: number): VolumeBarData[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const buckets: VolumeBarData[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      timeLabel: String(d.getDate()),
      upiValue: 0,
      cardNetValue: 0,
      total: 0,
    };
  });
  for (const t of transactions) {
    if (t.status !== 'Successful') continue;
    const d = new Date(t.createdAt);
    d.setHours(0, 0, 0, 0);
    const idx = Math.round((+d - +start) / 86_400_000);
    if (idx < 0 || idx >= buckets.length) continue;
    const b = buckets[idx];
    if (UPI_METHODS.includes(t.paymentMethod)) b.upiValue += t.amount;
    else b.cardNetValue += t.amount;
    b.total += t.amount;
  }
  return buckets;
}

export function deriveRecentPayments(transactions: Transaction[]): PaymentItem[] {
  return transactions
    .filter((t) => t.status === 'Successful')
    .slice(0, 6)
    .map((t) => ({
      id: `PAY-${t.id.replace(/^TX-/, '')}`,
      customerName: t.customer.name,
      customerHandle: t.customer.handle,
      avatar: t.customer.avatar,
      amount: t.amount,
      feePercent: 0,
      feeAmount: 0,
      paymentMethod: t.paymentMethod,
      status: 'Completed',
      timestamp: t.createdAt,
    }));
}

export function deriveCustomers(transactions: Transaction[]): Customer[] {
  const byId = new Map<string, Customer>();
  for (const t of transactions) {
    if (t.status !== 'Successful') continue;
    const id = t.customer.id || t.customer.email || t.customer.name;
    const prev = byId.get(id);
    if (prev) {
      prev.totalSpent += t.amount;
      prev.transactionsCount += 1;
    } else {
      byId.set(id, {
        id,
        name: t.customer.name,
        email: t.customer.email,
        phone: t.customer.phone,
        avatar: t.customer.avatar,
        handle: t.customer.handle,
        totalSpent: t.amount,
        transactionsCount: 1,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.totalSpent - a.totalSpent);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
