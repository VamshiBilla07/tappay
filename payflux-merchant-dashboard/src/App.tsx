import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { Header, TabType } from './components/Header';
import { TopMetrics } from './components/TopMetrics';
import { AnalyticsCards } from './components/AnalyticsCards';
import { RecentTransactionsTable } from './components/RecentTransactionsTable';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { CreatePaymentLinkModal } from './components/CreatePaymentLinkModal';
import { TransactionsView } from './components/TransactionsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettlementsView } from './components/SettlementsView';
import { CustomersView } from './components/CustomersView';
import { SettingsView } from './components/SettingsView';
import PayLinkPage from './pages/PayLinkPage';

import { INITIAL_TRANSACTIONS, RECENT_PAYMENTS, VOLUME_BARS } from './data/mockData';
import { DateRangeOption, PaymentLink, Transaction } from './types';
import { calculateSummary } from './utils/calculations';
import {
  apiJson, clearConfigCache, getConfig, shortAddr, usdcToInr, type AppConfig,
} from './lib/config';
import type { LinkStatus, PaymentLinkView } from './lib/paylink';
import { demoTxnFromLink, listDemoLinks, listServerDemoLinks, mergeDemoLinks } from './lib/demo';
import {
  authorizedAccount, connectInjected, isUserRejection, publicClient, walletClientFor, watchAccounts,
} from './lib/wallet';
import {
  fetchMerchantHistory, usdcBalance, watchSales, type Sale,
} from './lib/chain';
import {
  buildTransactions, deriveCustomers, deriveRecentPayments, deriveVolumeBars,
} from './lib/dashboard';
import { deploySettlement } from './lib/deploy';
import { cancelMessage, settlementMessage } from './lib/messages';

const pc = publicClient();
const QUERY = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
/** Sample data is the default showcase; `?demo=0` (or the header toggle) switches to live reads. */
const DEMO = QUERY.get('demo') !== '0';
const PATH = typeof window !== 'undefined' ? window.location.pathname : '/';
const TOTAL_DAYS: Record<DateRangeOption, number> = {
  today: 1,
  '7days': 7,
  '30days': 30,
  '90days': 30,
};

const linkStatus: Record<LinkStatus, PaymentLink['status']> = {
  open: 'Created',
  paid: 'Paid',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

function toLegacyLink(link: PaymentLinkView): PaymentLink {
  return {
    id: link.id,
    orderId: `ORD-${link.id.slice(-8).toUpperCase()}`,
    amount: link.inr,
    currency: 'INR',
    description: link.description,
    customer: {
      name: link.customer.name,
      email: link.customer.email,
      phone: link.customer.phone,
    },
    allowedMethods: link.methods,
    requireBillingAddress: link.requireBillingAddress,
    status: linkStatus[link.status],
    createdAt: new Date(link.createdAt * 1000).toISOString(),
    expiresAt: new Date(link.expiresAt * 1000).toISOString(),
    paidAt: link.status === 'paid' ? new Date(link.createdAt * 1000).toISOString() : undefined,
    transactionId: link.txHash,
    shortUrl: link.url,
  };
}

function mergeSales(base: Sale[], fresh: Sale[]): Sale[] {
  const next = [...base];
  for (const s of fresh) {
    const i = next.findIndex((x) => x.nonce.toLowerCase() === s.nonce.toLowerCase());
    if (i >= 0) {
      if (!next[i].time && s.time) next[i] = { ...next[i], time: s.time };
    } else next.unshift(s);
  }
  return next.sort((a, b) => (b.time ?? 0) - (a.time ?? 0) || Number(b.blockNumber - a.blockNumber));
}

export default function App() {
  const pay = typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/pay\/([^/?#]+)/)
    : null;
  if (pay) return <PayLinkPage linkId={decodeURIComponent(pay[1])} />;
  return <Dashboard />;
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = QUERY.get('tab');
    return tab === 'transactions' ? 'Transactions'
      : tab === 'analytics' ? 'Analytics'
        : tab === 'settlements' ? 'Settlements'
          : tab === 'customers' ? 'Customers'
            : tab === 'settings' ? 'Settings'
              : 'Overview';
  });
  const [dateRange, setDateRange] = useState<DateRangeOption>('30days');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string>();
  const [address, setAddress] = useState<Address | null>(null);
  const [ensName, setEnsName] = useState(() =>
    (typeof window !== 'undefined' && localStorage.getItem('basepos.ens.v1')) || '');
  const [sales, setSales] = useState<Sale[] | null>(DEMO ? [] : null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [links, setLinks] = useState<PaymentLinkView[]>([]);
  /** Demo-only: links created in this browser and payments simulated against them. */
  const [demoLinks, setDemoLinks] = useState<PaymentLinkView[]>(() => (DEMO ? listDemoLinks() : []));
  const [chainError, setChainError] = useState<string>();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [createLinkOpen, setCreateLinkOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState('');
  const [deployError, setDeployError] = useState<string>();

  /* backend config */
  useEffect(() => {
    void getConfig()
      .then(setConfig)
      .catch((e: any) => setConfigError(e?.message ?? 'Could not reach the payment server.'));
  }, []);

  /* wallet */
  useEffect(() => {
    void authorizedAccount().then((a) => { if (a) setAddress(a); });
    return watchAccounts((a) => setAddress(a));
  }, []);

  const connect = useCallback(async (): Promise<Address | null> => {
    setChainError(undefined);
    try {
      const a = await connectInjected();
      setAddress(a);
      return a;
    } catch (e: any) {
      setChainError(isUserRejection(e) ? 'You closed the wallet request.' : (e?.message ?? 'Could not connect MetaMask.'));
      return null;
    }
  }, []);

  /* real chain history + live settlements */
  useEffect(() => {
    if (DEMO || !address || !config?.deployed) {
      if (!DEMO) { setSales([]); setBalance(null); }
      return;
    }
    let cancelled = false;
    setSales(null);
    setChainError(undefined);

    (async () => {
      try {
        const [history, bal] = await Promise.all([
          fetchMerchantHistory(pc, address, config.settlement),
          usdcBalance(pc, address).catch(() => null),
        ]);
        if (cancelled) return;
        setSales(history);
        if (bal !== null) setBalance(bal);
      } catch (e: any) {
        if (cancelled) return;
        setSales([]);
        setChainError(e?.shortMessage ?? e?.message ?? 'Could not read Base Sepolia — retry in a moment.');
      }
    })();

    const unwatch = watchSales(pc, address, config.settlement, (fresh) => {
      setSales((prev) => mergeSales(prev ?? [], fresh));
      void usdcBalance(pc, address).then(setBalance).catch(() => {});
    });
    return () => { cancelled = true; unwatch(); };
  }, [address, config?.deployed, config?.settlement]);

  /* server-held links */
  const loadLinks = useCallback(async () => {
    if (DEMO || !address) { setLinks([]); return; }
    try {
      const body = await apiJson<{ links: PaymentLinkView[] }>(`/api/links?merchant=${address}`);
      setLinks(body.links);
    } catch {
      /* keep the last list; chain sales still render */
    }
  }, [address]);

  useEffect(() => {
    void loadLinks();
    if (DEMO || !address) return;
    const timer = window.setInterval(() => void loadLinks(), 6_000);
    const onFocus = () => void loadLinks();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [loadLinks, address]);

  /* demo links: pick up a payment simulated in the checkout tab, on this or another phone */
  useEffect(() => {
    if (!DEMO) return;
    const refresh = () => setDemoLinks(listDemoLinks());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);

    let stopped = false;
    const poll = async () => {
      const server = await listServerDemoLinks();
      if (stopped || !server) return;
      setDemoLinks(mergeDemoLinks(server));
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2_500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const rate = config?.inrPerUsdc ?? 85;
  const balanceInr = balance === null ? undefined : usdcToInr(balance, rate);

  /** Sample mode should always look current, so slide the mock rows onto today. */
  const demoTransactions = useMemo(() => {
    if (!DEMO || INITIAL_TRANSACTIONS.length === 0) return INITIAL_TRANSACTIONS;
    const latest = Math.max(...INITIAL_TRANSACTIONS.map((t) => +new Date(t.createdAt)));
    const latestDay = new Date(latest);
    latestDay.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shift = today.getTime() - latestDay.getTime();
    if (shift === 0) return INITIAL_TRANSACTIONS;
    return INITIAL_TRANSACTIONS.map((t) => ({
      ...t,
      createdAt: new Date(+new Date(t.createdAt) + shift).toISOString(),
      updatedAt: t.updatedAt ? new Date(+new Date(t.updatedAt) + shift).toISOString() : t.updatedAt,
    }));
  }, []);

  /** Paid demo links are the single source of the simulated money. */
  const paidDemoTxns = useMemo(
    () => demoLinks.filter((l) => l.status === 'paid').map(demoTxnFromLink),
    [demoLinks],
  );
  const transactions = useMemo(() => {
    if (!DEMO) return buildTransactions(sales ?? [], links, rate, null);
    // Newest simulated demo payment first, then the dated sample history.
    return [...paidDemoTxns, ...demoTransactions];
  }, [DEMO, sales, links, rate, demoTransactions, paidDemoTxns]);
  const demoVolume = useMemo(
    () => Math.round(paidDemoTxns.reduce((a, t) => a + t.amount, 0) * 100) / 100,
    [paidDemoTxns],
  );
  const summary = useMemo(
    () => calculateSummary(transactions, DEMO ? 48_250 + demoVolume : balanceInr),
    [transactions, DEMO, balanceInr, demoVolume],
  );
  const volumeBars = useMemo(
    () => DEMO ? VOLUME_BARS : deriveVolumeBars(transactions, TOTAL_DAYS[dateRange]),
    [DEMO, transactions, dateRange],
  );
  const recentPayments = useMemo(
    () => DEMO ? RECENT_PAYMENTS : deriveRecentPayments(transactions),
    [DEMO, transactions],
  );
  const paymentLinks = useMemo(
    () => (DEMO ? demoLinks.map(toLegacyLink) : links.map(toLegacyLink)),
    [DEMO, demoLinks, links],
  );
  const customers = useMemo(() => deriveCustomers(transactions), [transactions]);
  const loading = !DEMO && !!address && sales === null;

  /** Opens the method chooser. Demo mode needs no wallet, deploy, or chain. */
  const openCreateLink = () => {
    if (!DEMO) {
      if (!address) { void connect(); return; }
      if (!config?.deployed) { setActiveTab('Settings'); return; }
    }
    setCreateLinkOpen(true);
  };

  const openCheckout = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    setCreateLinkOpen(false);
  };

  const cancelLink = async (id: string) => {
    if (!address) { await connect(); return; }
    try {
      const signature = await walletClientFor(address).signMessage({
        account: address,
        message: cancelMessage(id),
      });
      await apiJson(`/api/links/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled', merchant: address, signature }),
      });
      await loadLinks();
    } catch (e: any) {
      setChainError(isUserRejection(e) ? 'Cancellation was not signed.' : (e?.shortMessage ?? e?.message ?? 'Could not cancel the link.'));
    }
  };

  const deploy = async () => {
    setDeployError(undefined);
    const who = address ?? (await connect());
    if (!who) return;
    setDeploying(true);
    try {
      const contract = await deploySettlement(who, setDeployStep);
      setDeployStep('Registering the contract with the payment server');
      const signature = await walletClientFor(who).signMessage({
        account: who,
        message: settlementMessage(contract, who),
      });
      const cfg = await apiJson<AppConfig>('/api/admin/settlement', {
        method: 'POST',
        body: JSON.stringify({ address: contract, deployer: who, signature }),
      });
      clearConfigCache();
      setConfig(cfg);
      setDeployStep('');
    } catch (e: any) {
      setDeployError(isUserRejection(e) ? 'Deployment was cancelled.' : (e?.shortMessage ?? e?.message ?? 'Deployment failed.'));
    } finally {
      setDeploying(false);
    }
  };

  const onCreated = (link: PaymentLinkView) => {
    setLinks((prev) => [link, ...prev.filter((l) => l.id !== link.id)]);
    if (DEMO) setDemoLinks((prev) => [link, ...prev.filter((l) => l.id !== link.id)]);
  };

  /** A simulated demo payment: surface it everywhere the dashboard reads transactions. */
  const onDemoPaid = (link: PaymentLinkView) => {
    setDemoLinks((prev) => [link, ...prev.filter((l) => l.id !== link.id)]);
  };

  const onSelectPayment = (payment: { customerName: string }) => {
    const found = transactions.find((t) => t.customer.name === payment.customerName);
    if (found) setSelectedTransaction(found);
  };

  return (
    <div className="min-h-screen bg-[#edeae4] text-neutral-900 font-sans p-2 sm:p-4 md:p-6 lg:p-8 flex justify-center items-start w-full overflow-x-hidden">
      <main className="w-full max-w-[1440px] bg-[#fdfcfb] sm:bg-white rounded-[28px] sm:rounded-[36px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.04)] p-3 sm:p-6 lg:p-8 space-y-6 overflow-hidden">
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isTestMode={DEMO}
          setIsTestMode={(demo) => {
            window.location.href = `${PATH}?demo=${demo ? '1' : '0'}`;
          }}
          onOpenCreateLink={openCreateLink}
          unreadCount={summary.pendingCount}
          walletAddress={address}
          walletLabel={address ? shortAddr(address) : 'Connect'}
          onConnect={() => void connect()}
          settlementReady={!!config?.deployed}
          onOpenSettings={() => setActiveTab('Settings')}
        />

        {!DEMO && (
          <StatusStrip
            config={config}
            configError={configError}
            address={address}
            chainError={chainError}
            loading={loading}
            onConnect={() => void connect()}
            onSettings={() => setActiveTab('Settings')}
            onDeploy={() => void deploy()}
            deploying={deploying}
            deployStep={deployStep}
          />
        )}

        {activeTab === 'Overview' && (
          <>
            <TopMetrics
              availableBalance={summary.availableBalance}
              todayRevenue={summary.todayRevenue}
              yesterdayRevenue={summary.yesterdayRevenue}
              todayGrowth={summary.todayRevenueGrowth}
              volumeBars={volumeBars}
              selectedRange={dateRange}
              onRangeChange={setDateRange}
              onPayoutClick={() => setActiveTab('Settlements')}
            />
            <AnalyticsCards
              paymentsTodayCount={summary.paymentsTodayCount}
              paymentsTodayAmount={summary.paymentsTodayAmount}
              successRate={summary.successRate}
              upiSharePercent={summary.upiSharePercent}
              last30DaysRevenue={summary.last30DaysRevenue}
              recentPayments={recentPayments}
              onOpenQuickPayment={openCreateLink}
              onSelectPayment={onSelectPayment}
              onViewAllPayments={() => setActiveTab('Transactions')}
            />
            <RecentTransactionsTable
              transactions={transactions}
              onSelectTransaction={setSelectedTransaction}
              title="Recent transactions"
              subtitle="Live from PaymentSettled on Base Sepolia"
            />
          </>
        )}

        {activeTab === 'Transactions' && (
          <TransactionsView
            transactions={transactions}
            paymentLinks={paymentLinks}
            onSelectTransaction={setSelectedTransaction}
            onOpenCreateLink={openCreateLink}
            onOpenCheckout={(link) => openCheckout(link.shortUrl)}
            onCancelLink={(id) => void cancelLink(id)}
          />
        )}

        {activeTab === 'Analytics' && <AnalyticsView transactions={transactions} />}
        {activeTab === 'Settlements' && (
          <SettlementsView
            transactions={transactions}
            walletAddress={address}
            balance={summary.availableBalance}
          />
        )}
        {activeTab === 'Customers' && <CustomersView transactions={transactions} customers={customers} />}
        {activeTab === 'Settings' && (
          <SettingsView
            config={config}
            configError={configError}
            address={address}
            ensName={ensName}
            balance={balance}
            onConnect={() => void connect()}
            onEnsChange={(value) => {
              setEnsName(value);
              try { localStorage.setItem('basepos.ens.v1', value); } catch { /* ignore */ }
            }}
            onDeploy={() => void deploy()}
            deploying={deploying}
            deployStep={deployStep}
            deployError={deployError}
          />
        )}

        <footer className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-400">
          <span>
            Base Sepolia · USDC settled by PaymentSettlement
            {config?.settlement && !config.deployed ? ' (not deployed)' : ''}
          </span>
          <span className="font-mono">
            {config ? `${config.settlement.slice(0, 8)}…${config.settlement.slice(-6)}` : 'loading config…'}
          </span>
        </footer>
      </main>

      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      <CreatePaymentLinkModal
        isOpen={createLinkOpen}
        onClose={() => setCreateLinkOpen(false)}
        config={config}
        merchant={address}
        defaultEns={ensName}
        demo={DEMO}
        onEnsureWallet={connect}
        onCreated={onCreated}
        onOpenCheckout={openCheckout}
        onDemoPaid={onDemoPaid}
      />
    </div>
  );
}

function StatusStrip({
  config, configError, address, chainError, loading, onConnect, onSettings, onDeploy, deploying, deployStep,
}: {
  config: AppConfig | null;
  configError?: string;
  address: Address | null;
  chainError?: string;
  loading: boolean;
  onConnect: () => void;
  onSettings: () => void;
  onDeploy: () => void;
  deploying: boolean;
  deployStep: string;
}) {
  if (configError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
        Payment server unreachable: {configError}. Run <span className="font-mono">npm run dev</span> from
        <span className="font-mono"> payflux-merchant-dashboard</span>.
      </div>
    );
  }
  if (!config) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
        Loading payment server config…
      </div>
    );
  }
  if (!address) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-xs text-amber-900">
          Connect your merchant wallet to read live USDC balance and sign payment requests.
        </span>
        <button onClick={onConnect} className="text-xs font-bold bg-neutral-900 text-white px-3 py-1.5 rounded-full cursor-pointer self-start sm:self-auto">
          Connect MetaMask
        </button>
      </div>
    );
  }
  if (!config.deployed) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-xs text-amber-900">
          Settlement contract not deployed on Base Sepolia. Payments are disabled until it is.
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onSettings} className="text-xs font-bold text-amber-900 hover:underline cursor-pointer">Settings</button>
          <button
            onClick={onDeploy}
            disabled={deploying}
            className="text-xs font-bold bg-neutral-900 disabled:bg-neutral-400 text-white px-3 py-1.5 rounded-full cursor-pointer"
          >
            {deploying ? (deployStep || 'Deploying…') : 'Deploy now'}
          </button>
        </div>
      </div>
    );
  }
  if (chainError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{chainError}</div>
    );
  }
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-800">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Live on Base Sepolia · connected to the settlement contract
      </span>
      <span className="text-[11px] text-emerald-700/80">{loading ? 'Reading history…' : 'Live events on'}</span>
    </div>
  );
}
