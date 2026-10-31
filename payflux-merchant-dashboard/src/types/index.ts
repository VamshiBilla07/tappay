export type PaymentMethod = 
  | 'UPI' 
  | 'Credit Card' 
  | 'Debit Card' 
  | 'Net Banking' 
  | 'Wallet'
  | 'Digital Wallets'
  | 'NFC / Contactless' 
  | 'Cryptocurrency';

export type TransactionStatus = 
  | 'Created'
  | 'Pending' 
  | 'Processing' 
  | 'Successful' 
  | 'Failed' 
  | 'Cancelled' 
  | 'Refunded' 
  | 'Expired';

export type DateRangeOption = 'today' | '7days' | '30days' | '90days';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  handle: string;
  totalSpent: number;
  transactionsCount: number;
}

export interface BillingDetails {
  name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  pincode?: string;
}

export interface PaymentItem {
  id: string;
  customerName: string;
  customerHandle: string;
  avatar?: string;
  amount: number;
  feePercent: number;
  feeAmount: number;
  paymentMethod: PaymentMethod;
  status: 'Completed' | 'Processing' | 'Pending' | 'Failed';
  timestamp: string;
}

export interface Transaction {
  id: string;
  referenceId: string;
  paymentLinkId?: string;
  customer: {
    id: string;
    name: string;
    handle: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  amount: number;
  currency: 'INR';
  fee: number;
  tax: number;
  netAmount: number;
  paymentMethod: PaymentMethod;
  paymentSubtype?: string; // e.g. "Google Pay", "PhonePe", "HDFC Visa", "SBI NetBanking", "Polygon USDT", "NFC Terminal"
  status: TransactionStatus;
  createdAt: string;
  updatedAt?: string;
  settlementStatus: 'Settled' | 'Pending' | 'On Hold';
  upiRefNo?: string;
  utrNumber?: string;
  txHash?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface PaymentLink {
  id: string;
  orderId: string;
  amount: number;
  currency: 'INR';
  description: string;
  customer: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  allowedMethods: PaymentMethod[];
  requireBillingAddress: boolean;
  status: 'Created' | 'Pending' | 'Paid' | 'Failed' | 'Expired' | 'Cancelled';
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
  transactionId?: string;
  shortUrl: string;
}

export interface SettlementBatch {
  id: string;
  period: string;
  totalVolume: number;
  deductions: number;
  settledAmount: number;
  status: 'Completed' | 'Scheduled' | 'Processing';
  bankAccount: string;
  settledAt: string;
  utrNumber: string;
}

export interface VolumeBarData {
  timeLabel: string;
  upiValue: number;
  cardNetValue: number;
  total: number;
}
