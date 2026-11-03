import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowUpRight, Building2, Check, CheckCircle2, Clock, Coins,
  CreditCard, ExternalLink, Loader2, Lock, Radio, ShieldCheck, Smartphone,
  Wallet, XCircle,
} from 'lucide-react';
import type { Address } from 'viem';
import {
  decode, payEth, payUsdc, verifyRequest, type Verification,
} from '@pos/shared';
import { formatINR } from '../utils/formatters';
import {
  apiJson, basescanTx, fmtUsdc, getConfig, shortAddr, type AppConfig,
} from '../lib/config';
import type { PaymentLinkView } from '../lib/paylink';
import {
  connectInjected, authorizedAccount, isUserRejection, publicClient, walletClientFor, watchAccounts,
} from '../lib/wallet';
import { ALL_METHODS, RAIL_COPY, METHOD_SUBTYPE, railFor, type Rail } from '../lib/methods';
import { metamaskLink } from '../lib/links';
import { getDemoLink, patchDemoLink } from '../lib/demo';
import { FlaskConical } from 'lucide-react';
import type { PaymentMethod } from '../types';

const pc = publicClient();

const CHECK_COPY: Record<keyof Verification['checks'], string> = {
  chain: 'Right chain (Base Sepolia)',
  contract: 'Known settlement contract',
  token: 'Pays testnet USDC',
  notExpired: 'Request is still fresh',
  signature: 'Signed by the merchant',
  ensForward: 'ENS name points to merchant',
  ensReverse: 'Merchant primary name matches',
};

const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  UPI: <Smartphone className="w-4 h-4" />,
  'Credit Card': <CreditCard className="w-4 h-4" />,
  'Debit Card': <CreditCard className="w-4 h-4" />,
  'Net Banking': <Building2 className="w-4 h-4" />,
  Wallet: <Wallet className="w-4 h-4" />,
  'Digital Wallets': <Wallet className="w-4 h-4" />,
  'NFC / Contactless': <Radio className="w-4 h-4" />,
  Cryptocurrency: <Coins className="w-4 h-4" />,
};

const fmtLeft = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return h > 0 ? `${h}:${m < 10 ? `0${m}` : m}:${ss}` : `${m}:${ss}`;
};

export default function PayLinkPage({ linkId }: { linkId: string }) {
  const demo = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('demo') === '1';
  return demo ? <DemoCheckout linkId={linkId} /> : <LiveCheckout linkId={linkId} />;
}

function LiveCheckout({ linkId }: { linkId: string }) {
  const [link, setLink] = useState<PaymentLinkView | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [address, setAddress] = useState<Address | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [payError, setPayError] = useState<string>();
  const [tx, setTx] = useState<string>();
  const [paid, setPaid] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, body] = await Promise.all([
          getConfig(),
          apiJson<{ link: PaymentLinkView }>(`/api/links/${encodeURIComponent(linkId)}`),
        ]);
        if (cancelled) return;
        const allowed = (body.link.methods ?? []).filter((m): m is PaymentMethod =>
          (ALL_METHODS as string[]).includes(m));
        const normalized: PaymentLinkView = {
          ...body.link,
          methods: allowed.length ? allowed : ALL_METHODS,
        };
        setConfig(cfg);
        setLink(normalized);
        setMethod(normalized.methods[0]);
        setPaid(normalized.status === 'paid');
        setTx(normalized.txHash);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? 'Could not load this payment link.');
      }
    })();
    return () => { cancelled = true; };
  }, [linkId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void authorizedAccount().then(setAddress);
    return watchAccounts(setAddress);
  }, []);

  const verify = useCallback(async () => {
    if (!link || !config) return;
    setVerifying(true);
    try {
      const decoded = decode(JSON.stringify(link.request));
      const v = await verifyRequest(decoded, Math.floor(Date.now() / 1000), {
        expectedSettlement: config.settlement,
        requireEns: Boolean(link.request.r.ensName),
      });
      setVerification(v);
    } catch (e: any) {
      setVerification({
        ok: false,
        checks: {
          chain: false, contract: false, token: false, notExpired: false,
          signature: false, ensForward: false, ensReverse: false,
        },
        ensName: link.request.r.ensName,
        ensSkipped: false,
        error: e?.message ?? 'The request could not be decoded.',
      });
    } finally {
      setVerifying(false);
    }
  }, [link, config]);

  useEffect(() => { void verify(); }, [verify]);

  const secondsLeft = link ? Math.max(0, link.expiresAt - now) : 0;
  const expired = !!link && (secondsLeft <= 0 || link.status === 'expired');
  const cancelled = link?.status === 'cancelled';

  const liveNotExpired = !!link && !!config &&
    Number(link.request.r.expiry) > now + (config.expirySafetySeconds ?? 15);
  const checks = verification
    ? { ...verification.checks, notExpired: liveNotExpired }
    : null;
  const allOk = !!checks && Object.values(checks).every(Boolean) && !expired && !cancelled;
  const rail: Rail = railFor(method);
  const railCopy = RAIL_COPY[rail];

  const connect = async () => {
    setPayError(undefined);
    try {
      const a = await connectInjected();
      setAddress(a);
      return a;
    } catch (e: any) {
      setPayError(isUserRejection(e) ? 'You closed the wallet request.' : (e?.message ?? 'Could not connect MetaMask.'));
      return null;
    }
  };

  const pay = async () => {
    if (!link || !config || busy) return;
    setPayError(undefined);
    if (!config.deployed) {
      setPayError('The settlement contract is not deployed yet. Ask the merchant to deploy it.');
      return;
    }
    const payer = address ?? (await connect());
    if (!payer) return;
    setBusy(true);
    setStep('Preparing');
    try {
      const req = decode(JSON.stringify(link.request));
      const wc = walletClientFor(payer);
      const receipt = rail === 'ETH'
        ? await payEth(pc, wc, req, setStep, config.settlement)
        : await payUsdc(pc, wc, req, setStep, config.settlement);
      setTx(receipt.transactionHash);
      setPaid(true);
      setStep('Confirmed');
      try {
        const body = await apiJson<{ link: PaymentLinkView }>(`/api/links/${link.id}/settle`, {
          method: 'POST',
          body: JSON.stringify({ txHash: receipt.transactionHash, method }),
        });
        setLink(body.link);
      } catch {
        setSyncWarning('Paid on-chain, but the receipt could not be saved on the server. Keep the transaction hash below.');
      }
    } catch (e: any) {
      setPayError(
        isUserRejection(e)
          ? 'You declined the payment — nothing was sent.'
          : (e?.shortMessage ?? e?.message ?? 'The payment failed on-chain.'),
      );
    } finally {
      setBusy(false);
      setStep('');
    }
  };

  const openMetaMask = () => {
    if (typeof window !== 'undefined') window.location.href = metamaskLink(window.location.href);
  };

  const merchantLabel = link?.request.r.ensName || shortAddr(link?.merchant);

  if (loadError) {
    return (
      <Shell>
        <div className="p-6 text-center space-y-3">
          <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-lg font-extrabold text-neutral-900">Payment link unavailable</h1>
          <p className="text-sm text-neutral-500">{loadError}</p>
          <a href="/" className="inline-block mt-2 text-xs font-bold text-indigo-600 hover:underline">Back to PayFlux</a>
        </div>
      </Shell>
    );
  }

  if (!link || !config) {
    return (
      <Shell>
        <div className="p-10 flex flex-col items-center gap-3 text-neutral-500">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-sm font-semibold">Loading the signed request…</span>
        </div>
      </Shell>
    );
  }

  if (paid) {
    return (
      <Shell>
        <div className="p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-neutral-900">Payment settled</h1>
            <p className="text-sm text-neutral-500 mt-1">
              {formatINR(link.inr)} · {fmtUsdc(link.usdc)} USDC to {merchantLabel}
            </p>
          </div>
          {tx && (
            <a
              href={basescanTx(tx)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              View transaction on BaseScan <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {syncWarning && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">{syncWarning}</p>
          )}
          <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-400">
            Testnet only · USDC settled by PaymentSettlement on Base Sepolia
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="p-5 sm:p-7 space-y-5">
        {/* merchant + amount */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Paying</div>
            <div className="text-sm font-extrabold text-neutral-900 truncate">{merchantLabel}</div>
            {link.request.r.ensName ? (
              <div className="text-[11px] text-neutral-400 font-mono truncate">{shortAddr(link.merchant)}</div>
            ) : (
              <div className="text-[11px] text-neutral-400">Merchant wallet</div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Amount</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tabular-nums">{formatINR(link.inr)}</div>
            <div className="text-[11px] font-semibold text-neutral-500 tabular-nums">≈ {Number(link.usdc).toFixed(2)} USDC</div>
          </div>
        </div>

        {link.description && (
          <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-3 text-xs text-neutral-700">
            {link.description}
          </div>
        )}

        {/* status band */}
        <div className={`flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-semibold border ${
          expired || cancelled
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-indigo-50/70 border-indigo-100 text-indigo-800'
        }`}>
          <span className="inline-flex items-center gap-1.5">
            {expired || cancelled ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            {cancelled ? 'This link was cancelled by the merchant.' : expired ? 'This request expired. Ask for a fresh link.' : `Expires in ${fmtLeft(secondsLeft)}`}
          </span>
          <span className="text-[10px] uppercase tracking-wide opacity-70">Base Sepolia</span>
        </div>

        {!config.deployed && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              The merchant has not deployed the settlement contract yet, so payment is disabled.
              This is a testnet deployment step, not a card/UPI gateway.
            </span>
          </div>
        )}

        {/* method picker */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Payment method</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {link.methods.map((m) => {
              const active = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  disabled={busy}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                    active
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <span className={active ? 'text-indigo-300' : 'text-neutral-400'}>{METHOD_ICON[m]}</span>
                  <span className="leading-tight">{m}</span>
                </button>
              );
            })}
          </div>
          <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-3 text-[11px] text-neutral-600">
            <div className="flex items-center gap-1.5 font-bold text-neutral-800">
              {railCopy.badge}
              <span className="font-normal text-neutral-400">· {METHOD_SUBTYPE[method]}</span>
            </div>
            <p className="mt-1 leading-relaxed">
              {railCopy.detail} UPI/card acquiring is not connected in this testnet build — the method
              selects a real on-chain rail, not a bank debit.
            </p>
          </div>
        </div>

        {/* security strip */}
        <div className="rounded-2xl border border-neutral-100 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Request checks</span>
            {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
            {(Object.keys(CHECK_COPY) as Array<keyof Verification['checks']>).map((k) => {
              const state = !checks ? 'wait' : checks[k] ? 'ok' : 'bad';
              const skipped = verification?.ensSkipped && (k === 'ensForward' || k === 'ensReverse');
              return (
                <div key={k} className="flex items-center gap-1.5 text-[11px]">
                  {state === 'ok'
                    ? <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                    : state === 'bad'
                      ? <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                      : <span className="w-3 h-3 rounded-full border border-neutral-300 shrink-0" />}
                  <span className={state === 'bad' ? 'text-rose-700' : 'text-neutral-600'}>
                    {CHECK_COPY[k]}{skipped ? ' (not set)' : ''}
                  </span>
                </div>
              );
            })}
          </div>
          {verification && !verification.ok && (
            <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2 mt-1">
              {verification.error ?? 'A check failed — payment stays locked.'}
              <button type="button" onClick={() => void verify()} className="ml-2 font-bold underline">Re-run</button>
            </div>
          )}
        </div>

        {payError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800" role="alert">
            {payError}
          </div>
        )}

        {/* wallet + pay */}
        {!address ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void connect()}
              className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Wallet className="w-4 h-4 text-indigo-300" /> Connect MetaMask to pay
            </button>
            <button
              type="button"
              onClick={openMetaMask}
              className="w-full py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Open in MetaMask app <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <p className="text-[11px] text-neutral-400 text-center">
              Your keys stay in MetaMask. This page only asks it to sign the payment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-neutral-500">
              <span className="inline-flex items-center gap-1.5 font-mono">{shortAddr(address)}</span>
              <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> wallet connected</span>
            </div>
            <button
              type="button"
              onClick={() => void pay()}
              disabled={!allOk || busy || !config.deployed}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {step || 'Paying'}…</> : <>{railCopy.title} · {fmtUsdc(link.usdc)} USDC</>}
            </button>
            <p className="text-[11px] text-neutral-400 text-center">
              {rail === 'ETH'
                ? 'ETH is quoted and swapped in the same transaction; unused ETH is refunded.'
                : 'If needed you will see an Approve popup first, then the payment popup.'}
            </p>
          </div>
        )}

        <div className="pt-1 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> EIP-712 signed request</span>
          <span>Testnet only</span>
        </div>
      </div>
    </Shell>
  );
}

/**
 * Demo checkout: renders from localStorage, never asks for a wallet and never
 * touches the chain. Clearly labelled so it can't be mistaken for a real charge.
 */
function DemoCheckout({ linkId }: { linkId: string }) {
  const [localLink] = useState<PaymentLinkView | null>(() => getDemoLink(linkId));
  const [link, setLink] = useState<PaymentLinkView | null>(localLink);
  const [loading, setLoading] = useState(!localLink);
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [paid, setPaid] = useState(() => localLink?.status === 'paid');
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string>();

  useEffect(() => {
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (localLink) return;
    let cancelled = false;
    apiJson<{ link: PaymentLinkView }>(`/api/links/${encodeURIComponent(linkId)}`)
      .then((body) => {
        if (cancelled) return;
        setLink(body.link);
        setPaid(body.link.status === 'paid');
      })
      .catch(() => {
        /* shown as not found below */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [linkId, localLink]);

  useEffect(() => {
    if (link?.methods[0]) setMethod(link.methods[0]);
  }, [link]);

  if (loading) {
    return (
      <Shell demo>
        <div className="p-10 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs text-neutral-500 mt-3">Loading demo request…</p>
        </div>
      </Shell>
    );
  }

  if (!link) {
    return (
      <Shell demo>
        <div className="p-6 text-center space-y-3">
          <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-lg font-extrabold text-neutral-900">Demo link not found</h1>
          <p className="text-sm text-neutral-500">
            This demo link is not on the server. Create a fresh one from the merchant dashboard so
            both phones can resolve it.
          </p>
          <a href="/" className="inline-block mt-2 text-xs font-bold text-indigo-600 hover:underline">Back to PayFlux</a>
        </div>
      </Shell>
    );
  }

  const secondsLeft = Math.max(0, link.expiresAt - now);
  const expired = secondsLeft <= 0;

  const pay = () => {
    if (busy || expired) return;
    setBusy(true);
    setPayError(undefined);
    window.setTimeout(async () => {
      try {
        if (link.demo) {
          const body = await apiJson<{ link: PaymentLinkView }>(
            `/api/links/${encodeURIComponent(link.id)}/simulate`,
            { method: 'POST', body: JSON.stringify({ method }) },
          );
          setLink(body.link);
          patchDemoLink(link.id, { status: 'paid' });
        } else {
          const updated = patchDemoLink(link.id, { status: 'paid' }) ?? link;
          setLink(updated);
        }
        setPaid(true);
      } catch (e: any) {
        setPayError(e?.message ?? 'Could not record the demo payment.');
      } finally {
        setBusy(false);
      }
    }, 700);
  };

  if (paid) {
    return (
      <Shell demo>
        <div className="p-6 sm:p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-neutral-900">Demo payment complete</h1>
            <p className="text-sm text-neutral-500 mt-1">
              {formatINR(link.inr)} · {method}
            </p>
          </div>
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
            This was a demonstration. No signature was checked, no USDC moved and no contract was called.
          </p>
          <a href="/" className="inline-block text-xs font-bold text-indigo-600 hover:underline">Back to the dashboard</a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell demo>
      <div className="p-5 sm:p-7 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Paying</div>
            <div className="text-sm font-extrabold text-neutral-900 truncate">PayFlux Demo Store</div>
            <div className="text-[11px] text-neutral-400">Sample merchant</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Amount</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tabular-nums">{formatINR(link.inr)}</div>
            <div className="text-[11px] font-semibold text-neutral-500 tabular-nums">≈ {Number(link.usdc).toFixed(2)} USDC</div>
          </div>
        </div>

        {link.description && (
          <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-3 text-xs text-neutral-700">
            {link.description}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <FlaskConical className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Demo mode. Nothing is signed and no funds move — the payment is recorded on the demo
            server and in this browser.
          </span>
        </div>

        <div className={`flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-semibold border ${
          expired ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-indigo-50/70 border-indigo-100 text-indigo-800'
        }`}>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {expired ? 'This demo request expired. Create a fresh one.' : `Expires in ${fmtLeft(secondsLeft)}`}
          </span>
          <span className="text-[10px] uppercase tracking-wide opacity-70">Demo</span>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Payment method</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {link.methods.map((m) => {
              const active = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  disabled={busy}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 ${
                    active
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <span className={active ? 'text-indigo-300' : 'text-neutral-400'}>{METHOD_ICON[m]}</span>
                  <span className="leading-tight">{m}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={pay}
          disabled={busy || expired}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
        >
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording demo payment…</> : `Pay ${formatINR(link.inr)} (demo)`}
        </button>

        {payError && <p className="text-[11px] text-rose-600 text-center">{payError}</p>}

        <p className="text-[11px] text-neutral-400 text-center">
          No wallet connection is needed. The real checkout asks MetaMask to sign a testnet USDC payment.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children, demo = false }: { children: React.ReactNode; demo?: boolean }) {
  return (
    <div className="min-h-screen bg-[#edeae4] text-neutral-900 font-sans p-3 sm:p-6 flex justify-center items-start">
      <main className="w-full max-w-lg bg-white rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] border border-black/5 overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-rose-400 p-0.5">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <div>
              <div className="font-extrabold text-sm leading-none">PayFlux</div>
              <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">Secure checkout</div>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Base Sepolia</span>
        </div>
        {children}
        <div className="px-5 sm:px-7 py-3 border-t border-neutral-100 text-center text-[10px] text-neutral-400">
          {demo
            ? 'Demonstration only · no signature, no chain call, no funds'
            : 'USDC is settled by the PaymentSettlement contract · testnet only'}
        </div>
      </main>
    </div>
  );
}
