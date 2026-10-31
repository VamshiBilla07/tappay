import React, { useState, useEffect } from 'react';
import { 
  Header, 
  TabType 
} from './components/Header';
import { TopMetrics } from './components/TopMetrics';
import { AnalyticsCards } from './components/AnalyticsCards';
import { RecentTransactionsTable } from './components/RecentTransactionsTable';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { CreatePaymentLinkModal } from './components/CreatePaymentLinkModal';
import { CustomerCheckout } from './components/checkout/CustomerCheckout';
import { TransactionsView } from './components/TransactionsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettlementsView } from './components/SettlementsView';
import { CustomersView } from './components/CustomersView';
import { SettingsView } from './components/SettingsView';

import { 
  INITIAL_TRANSACTIONS, 
  RECENT_PAYMENTS, 
  VOLUME_BARS 
} from './data/mockData';
import { 
  Transaction, 
  PaymentItem, 
  DateRangeOption, 
  VolumeBarData,
  PaymentLink 
} from './types';
import { calculateSummary } from './utils/calculations';

// Initial pre-configured payment link for instant demo testing
const INITIAL_PAYMENT_LINKS: PaymentLink[] = [
  {
    id: 'plink_demo_01',
    orderId: 'ORD-94820',
    amount: 2450.00,
    currency: 'INR',
    description: 'Gaming Headset & Mechanical Keycaps',
    customer: {
      name: 'Dev Sharma',
      email: 'dev.sharma@startup.in',
      phone: '9876543210',
      address: '42, Indiranagar, 100ft Road',
    },
    allowedMethods: [
      'UPI',
      'Credit Card',
      'Debit Card',
      'Net Banking',
      'Digital Wallets',
      'NFC / Contactless',
      'Cryptocurrency',
    ],
    requireBillingAddress: false,
    status: 'Created',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    shortUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/plink_demo_01`,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('Overview');
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<DateRangeOption>('30days');
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>(INITIAL_PAYMENT_LINKS);
  const [recentPayments, setRecentPayments] = useState<PaymentItem[]>(RECENT_PAYMENTS);
  const [volumeBars, setVolumeBars] = useState<VolumeBarData[]>(VOLUME_BARS);

  // Modals & Navigation state
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [createLinkOpen, setCreateLinkOpen] = useState<boolean>(false);
  const [activeCheckoutLink, setActiveCheckoutLink] = useState<PaymentLink | null>(null);

  // Check URL query or hash on mount e.g. #/pay/:id or ?pay=:id
  useEffect(() => {
    const handleUrlRouting = () => {
      const hash = window.location.hash;
      const search = new URLSearchParams(window.location.search);
      const payParam = search.get('pay');
      
      if (payParam) {
        const found = paymentLinks.find((l) => l.id === payParam);
        if (found) setActiveCheckoutLink(found);
      } else if (hash.startsWith('#/pay/')) {
        const linkId = hash.replace('#/pay/', '');
        const found = paymentLinks.find((l) => l.id === linkId);
        if (found) setActiveCheckoutLink(found);
      }
    };

    handleUrlRouting();
    window.addEventListener('hashchange', handleUrlRouting);
    return () => window.removeEventListener('hashchange', handleUrlRouting);
  }, [paymentLinks]);

  // Calculated summary (enforces verified Successful transactions only)
  const summary = calculateSummary(transactions);

  // 1. Merchant creates a payment link
  // CRITICAL REQUIREMENT: Creating a payment link does NOT increase revenue or available balance!
  const handlePaymentLinkCreated = (newLink: PaymentLink, initialTxn: Transaction) => {
    setPaymentLinks((prev) => [newLink, ...prev]);
    setTransactions((prev) => [initialTxn, ...prev]);
  };

  // 2. Customer completes payment successfully on checkout
  const handlePaymentSuccess = (verifiedTxn: Transaction) => {
    // Update transactions ledger
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === verifiedTxn.id || t.paymentLinkId === verifiedTxn.paymentLinkId);
      if (exists) {
        return prev.map((t) =>
          t.id === verifiedTxn.id || (verifiedTxn.paymentLinkId && t.paymentLinkId === verifiedTxn.paymentLinkId)
            ? { ...verifiedTxn, status: 'Successful', updatedAt: new Date().toISOString() }
            : t
        );
      }
      return [verifiedTxn, ...prev];
    });

    // Update payment link status to 'Paid'
    if (verifiedTxn.paymentLinkId) {
      setPaymentLinks((prev) =>
        prev.map((l) =>
          l.id === verifiedTxn.paymentLinkId
            ? { ...l, status: 'Paid', paidAt: new Date().toISOString(), transactionId: verifiedTxn.id }
            : l
        )
      );
    }

    // Add to recent payments list
    const newPayment: PaymentItem = {
      id: `PAY-${Date.now().toString().slice(-4)}`,
      customerName: verifiedTxn.customer.name,
      customerHandle: verifiedTxn.customer.handle,
      avatar: verifiedTxn.customer.avatar,
      amount: verifiedTxn.amount,
      feePercent: 0.8,
      feeAmount: verifiedTxn.fee,
      paymentMethod: verifiedTxn.paymentMethod,
      status: 'Completed',
      timestamp: 'Just now',
    };
    setRecentPayments((prev) => [newPayment, ...prev]);

    // Update volume bars
    setVolumeBars((prev) => {
      const copy = [...prev];
      if (copy.length > 0) {
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = {
          ...last,
          upiValue: verifiedTxn.paymentMethod === 'UPI' ? last.upiValue + 14 : last.upiValue,
          cardNetValue: verifiedTxn.paymentMethod !== 'UPI' ? last.cardNetValue + 12 : last.cardNetValue,
          total: last.total + 14,
        };
      }
      return copy;
    });
  };

  // 3. Customer payment fails
  const handlePaymentFailed = (failedTxn: Transaction) => {
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === failedTxn.id || t.paymentLinkId === failedTxn.paymentLinkId);
      if (exists) {
        return prev.map((t) =>
          t.id === failedTxn.id || (failedTxn.paymentLinkId && t.paymentLinkId === failedTxn.paymentLinkId)
            ? { ...failedTxn, status: 'Failed', updatedAt: new Date().toISOString() }
            : t
        );
      }
      return [failedTxn, ...prev];
    });

    if (failedTxn.paymentLinkId) {
      setPaymentLinks((prev) =>
        prev.map((l) =>
          l.id === failedTxn.paymentLinkId ? { ...l, status: 'Failed' } : l
        )
      );
    }
  };

  // 4. Customer cancels checkout
  const handlePaymentCancelled = (cancelledTxn: Transaction) => {
    setTransactions((prev) => {
      const exists = prev.some((t) => t.id === cancelledTxn.id || t.paymentLinkId === cancelledTxn.paymentLinkId);
      if (exists) {
        return prev.map((t) =>
          t.id === cancelledTxn.id || (cancelledTxn.paymentLinkId && t.paymentLinkId === cancelledTxn.paymentLinkId)
            ? { ...cancelledTxn, status: 'Cancelled', updatedAt: new Date().toISOString() }
            : t
        );
      }
      return [cancelledTxn, ...prev];
    });

    if (cancelledTxn.paymentLinkId) {
      setPaymentLinks((prev) =>
        prev.map((l) =>
          l.id === cancelledTxn.paymentLinkId ? { ...l, status: 'Cancelled' } : l
        )
      );
    }
  };

  // 5. Merchant cancels an unpaid link
  const handleCancelLink = (linkId: string) => {
    setPaymentLinks((prev) =>
      prev.map((l) => (l.id === linkId ? { ...l, status: 'Cancelled' } : l))
    );
    setTransactions((prev) =>
      prev.map((t) => (t.paymentLinkId === linkId ? { ...t, status: 'Cancelled' } : t))
    );
  };

  // 6. Handle refunding a transaction
  const handleRefund = (transactionId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? { ...t, status: 'Refunded', netAmount: -t.amount, failureReason: 'Refunded by merchant' }
          : t
      )
    );
    if (selectedTransaction && selectedTransaction.id === transactionId) {
      setSelectedTransaction((prev) =>
        prev ? { ...prev, status: 'Refunded', netAmount: -prev.amount, failureReason: 'Refunded by merchant' } : null
      );
    }
  };

  // Convert a recent payment to transaction modal for deep inspection
  const handleSelectPayment = (payment: PaymentItem) => {
    const found = transactions.find((t) => t.customer.name === payment.customerName);
    if (found) {
      setSelectedTransaction(found);
    } else {
      setSelectedTransaction({
        id: `TX-${payment.id.replace('PAY-', '084')}`,
        referenceId: `REF-${payment.id}`,
        customer: {
          id: 'CUST-PAY',
          name: payment.customerName,
          handle: payment.customerHandle,
          email: `${payment.customerHandle.replace('@', '')}@example.com`,
          avatar: payment.avatar,
        },
        amount: payment.amount,
        currency: 'INR',
        fee: payment.feeAmount,
        tax: payment.feeAmount * 0.18,
        netAmount: payment.amount - payment.feeAmount * 1.18,
        paymentMethod: payment.paymentMethod,
        status: payment.status === 'Completed' ? 'Successful' : payment.status,
        createdAt: new Date().toISOString(),
        settlementStatus: payment.status === 'Completed' ? 'Settled' : 'Pending',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#edeae4] text-neutral-900 font-sans p-2 sm:p-4 md:p-6 lg:p-8 flex justify-center items-start w-full overflow-x-hidden">
      {/* Main Floating Dashboard Canvas Container with fluid max-width */}
      <main className="w-full max-w-[1440px] bg-[#fdfcfb] sm:bg-white rounded-[28px] sm:rounded-[36px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.04)] p-3 sm:p-6 lg:p-8 space-y-6 overflow-hidden">
        
        {/* 1. Header with Logo, Adaptive Navigation, Profile Dropdown */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isTestMode={isTestMode}
          setIsTestMode={setIsTestMode}
          onOpenCreateLink={() => setCreateLinkOpen(true)}
          unreadCount={2}
          onOpenCustomerCheckoutPreview={() => {
            if (paymentLinks.length > 0) {
              setActiveCheckoutLink(paymentLinks[0]);
            } else {
              setCreateLinkOpen(true);
            }
          }}
        />

        {/* Tab Content */}
        {activeTab === 'Overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 2. Top Metrics Row: Available Balance, Today's Revenue, Payment Volume Equalizer */}
            <TopMetrics
              availableBalance={summary.availableBalance}
              todayRevenue={summary.todayRevenue}
              todayGrowth={summary.todayRevenueGrowth}
              volumeBars={volumeBars}
              selectedRange={dateRange}
              onRangeChange={setDateRange}
              onPayoutClick={() => setActiveTab('Settlements')}
            />

            {/* 3. Analytics Area: 3 Gradient Cards + Recent Payments Card */}
            <AnalyticsCards
              paymentsTodayCount={summary.paymentsTodayCount}
              paymentsTodayAmount={summary.paymentsTodayAmount}
              successRate={summary.successRate}
              upiSharePercent={summary.upiSharePercent}
              last30DaysRevenue={summary.last30DaysRevenue}
              recentPayments={recentPayments}
              onOpenQuickPayment={() => setCreateLinkOpen(true)}
              onSelectPayment={handleSelectPayment}
              onViewAllPayments={() => setActiveTab('Transactions')}
            />

            {/* 4. Recent Transactions Section */}
            <RecentTransactionsTable
              transactions={transactions}
              onSelectTransaction={(txn) => setSelectedTransaction(txn)}
              onViewAll={() => setActiveTab('Transactions')}
            />
          </div>
        )}

        {activeTab === 'Transactions' && (
          <TransactionsView
            transactions={transactions}
            paymentLinks={paymentLinks}
            onSelectTransaction={(txn) => setSelectedTransaction(txn)}
            onOpenCreateLink={() => setCreateLinkOpen(true)}
            onOpenCheckout={(link) => setActiveCheckoutLink(link)}
            onCancelLink={handleCancelLink}
          />
        )}

        {activeTab === 'Analytics' && <AnalyticsView />}

        {activeTab === 'Settlements' && <SettlementsView />}

        {activeTab === 'Customers' && <CustomersView />}

        {activeTab === 'Settings' && <SettingsView />}

        {/* Footer info & compliance watermark */}
        <footer className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>PayFlux Gateway Core Engine • Production Ready • NPCI & RBI PA/PG Compliant</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-500 font-medium">
            <button onClick={() => setActiveTab('Settings')} className="hover:text-neutral-900 cursor-pointer">API Docs</button>
            <button onClick={() => setActiveTab('Settlements')} className="hover:text-neutral-900 cursor-pointer">Settlement Terms</button>
            <button 
              onClick={() => {
                if (paymentLinks.length > 0) setActiveCheckoutLink(paymentLinks[0]);
                else setCreateLinkOpen(true);
              }} 
              className="hover:text-neutral-900 cursor-pointer font-bold text-indigo-600"
            >
              Test Customer Checkout →
            </button>
          </div>
        </footer>
      </main>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onRefund={handleRefund}
      />

      {/* Create Payment Link Modal */}
      <CreatePaymentLinkModal
        isOpen={createLinkOpen}
        onClose={() => setCreateLinkOpen(false)}
        onPaymentLinkCreated={handlePaymentLinkCreated}
        onOpenCheckout={(link) => setActiveCheckoutLink(link)}
      />

      {/* Real Customer-Facing Checkout Interface */}
      {activeCheckoutLink && (
        <CustomerCheckout
          paymentLink={activeCheckoutLink}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailed={handlePaymentFailed}
          onPaymentCancelled={handlePaymentCancelled}
          onClose={() => setActiveCheckoutLink(null)}
          isTestMode={isTestMode}
        />
      )}
    </div>
  );
}
