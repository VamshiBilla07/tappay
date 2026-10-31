import React, { useState } from 'react';
import type { Address } from 'viem';
import {
  Wallet,
  Copy,
  Check,
  ShieldCheck,
  Building,
  Smartphone,
  CreditCard,
  Coins,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Rocket,
  Globe,
  Network,
  FileCode2,
  Link2,
} from 'lucide-react';
import { fmtUsdc, basescanAddress, shortAddr, type AppConfig } from '../lib/config';
import { ALL_METHODS, railFor } from '../lib/methods';
import { formatINR } from '../utils/formatters';

interface SettingsViewProps {
  config: AppConfig | null;
  configError?: string;
  address: Address | null;
  ensName: string;
  balance: bigint | null;
  onConnect: () => void;
  onEnsChange: (value: string) => void;
  onDeploy: () => void;
  deploying: boolean;
  deployStep: string;
  deployError?: string;
}

const CopyRow: React.FC<{ label: string; value: string; href?: string; mono?: boolean }> = ({
  label,
  value,
  href,
  mono = true,
}) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="p-3 bg-neutral-50 rounded-xl min-w-0">
      <span className="text-neutral-400 block font-medium text-[11px]">{label}</span>
      <div className="flex items-center gap-2 mt-0.5 min-w-0">
        <span
          className={`text-neutral-900 font-bold text-[11px] truncate flex-1 ${mono ? 'font-mono' : ''}`}
          title={value}
        >
          {value}
        </span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-400 hover:text-neutral-900 shrink-0"
            title={`Open ${label}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <button
          onClick={copy}
          className="text-neutral-400 hover:text-neutral-900 shrink-0 cursor-pointer"
          title={`Copy ${label}`}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, badge, children }) => (
  <div className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs">
    <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-100">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-800 shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-extrabold text-base text-neutral-900">{title}</h3>
          <p className="text-xs text-neutral-400">{subtitle}</p>
        </div>
      </div>
      {badge}
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  configError,
  address,
  ensName,
  balance,
  onConnect,
  onEnsChange,
  onDeploy,
  deploying,
  deployStep,
  deployError,
}) => {
  const deployed = !!config?.deployed;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Payment server health */}
      {configError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          Payment server unreachable: {configError}. Start it with{' '}
          <span className="font-mono">npm run dev</span> in{' '}
          <span className="font-mono">payflux-merchant-dashboard</span>.
        </div>
      )}

      {/* Wallet & network */}
      <Section
        icon={<Wallet className="w-5 h-5" />}
        title="Merchant wallet"
        subtitle="The only key this app uses — it stays inside MetaMask"
        badge={
          <span
            className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1 ${
              address
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-neutral-600 bg-neutral-100 border-neutral-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> {address ? 'Connected' : 'Not connected'}
          </span>
        }
      >
        {address ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CopyRow
              label="Address"
              value={address}
              href={basescanAddress(address)}
            />
            <div className="p-3 bg-neutral-50 rounded-xl">
              <span className="text-neutral-400 block font-medium text-[11px]">USDC balance</span>
              <span className="text-neutral-900 font-bold text-sm tabular-nums">
                {balance === null ? 'reading…' : `${fmtUsdc(balance)} USDC`}
              </span>
              {config && balance !== null && (
                <span className="text-[10px] text-neutral-400 block">
                  ≈ {formatINR(Number(fmtUsdc(balance).replace(/,/g, '')) * config.inrPerUsdc, false)} at ₹
                  {config.inrPerUsdc}/USDC
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Connect MetaMask on Base Sepolia. Payment requests are signed by this wallet, and every settlement
              lands in it.
            </p>
            <button
              onClick={onConnect}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0"
            >
              <Wallet className="w-3.5 h-3.5 text-indigo-300" /> Connect MetaMask
            </button>
          </div>
        )}
      </Section>

      {/* Settlement contract */}
      <Section
        icon={<FileCode2 className="w-5 h-5" />}
        title="Settlement contract"
        subtitle="PaymentSettlement — EIP-712 signed requests, one nonce per payment"
        badge={
          <span
            className={`shrink-0 text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1 ${
              deployed
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}
          >
            {deployed ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {deployed ? 'Deployed' : 'Not deployed'}
          </span>
        }
      >
        {config ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CopyRow
                label="Contract address"
                value={config.settlement}
                href={deployed ? basescanAddress(config.settlement) : undefined}
              />
              <CopyRow label="USDC token" value={config.usdc} href={basescanAddress(config.usdc)} />
              <CopyRow label="WETH token" value={config.weth} href={basescanAddress(config.weth)} />
              <CopyRow
                label="Swap router (Uniswap v3)"
                value={config.swapRouter}
                href={basescanAddress(config.swapRouter)}
              />
            </div>

            {!deployed && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                <div className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Payment links cannot be signed until the contract exists on Base Sepolia. Deploying sends a
                    one-time contract-creation transaction from your wallet; it needs a small amount of testnet ETH
                    for gas. The app then registers the address with the payment server, which re-reads its
                    USDC/WETH/pool getters before trusting it.
                  </p>
                </div>
                <button
                  onClick={onDeploy}
                  disabled={deploying || !address}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  {deploying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {deployStep || 'Deploying…'}
                    </>
                  ) : (
                    <>
                      <Rocket className="w-3.5 h-3.5 text-indigo-300" />
                      {address ? 'Deploy from this wallet' : 'Connect a wallet first'}
                    </>
                  )}
                </button>
                {deployError && (
                  <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                    {deployError}
                  </p>
                )}
                {deploying && deployStep && (
                  <p className="text-[11px] text-neutral-500">{deployStep}</p>
                )}
              </div>
            )}

            {deployed && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
                <span className="inline-flex items-center gap-1">
                  <Network className="w-3.5 h-3.5" /> {config.chainName} ({config.chainId})
                </span>
                <span className="inline-flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Pool fee {config.poolFee / 10_000}%
                </span>
                {config.settlementDeployer && (
                  <span className="inline-flex items-center gap-1 font-mono">
                    deployer {shortAddr(config.settlementDeployer)}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-neutral-400">Loading server config…</p>
        )}
      </Section>

      {/* ENS identity */}
      <Section
        icon={<Globe className="w-5 h-5" />}
        title="Merchant identity (ENS)"
        subtitle="Optional: let customers verify your name instead of a hex address"
      >
        <label htmlFor="ens-name" className="block text-xs font-bold text-neutral-700 mb-1">
          ENS name
        </label>
        <input
          id="ens-name"
          value={ensName}
          onChange={(e) => onEnsChange(e.target.value)}
          placeholder="shop.eth"
          className="w-full bg-neutral-50 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:bg-white"
        />
        <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">
          Names live on Ethereum Sepolia (L1), not Base. When set, checkout verifies the name resolves to your
          wallet <em>and</em> that your wallet's primary name matches. Leave it blank and those two checks are
          skipped — signature, chain, contract, token, and expiry still apply.
        </p>
      </Section>

      {/* Method → rail mapping */}
      <Section
        icon={<CreditCard className="w-5 h-5" />}
        title="Payment methods and what they settle"
        subtitle="Each checkout button maps to a real on-chain rail"
      >
        <div className="divide-y divide-neutral-100">
          {ALL_METHODS.map((method) => {
            const rail = railFor(method);
            return (
              <div key={method} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-neutral-800">{method}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {rail === 'ETH' ? 'ETH → exact USDC' : 'Direct USDC'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100 text-[11px] text-neutral-600 leading-relaxed">
          <strong className="text-neutral-900">Honest limitation:</strong> UPI, card, net-banking and wallet
          acquiring requires a licensed PSP and bank settlement rails, which this testnet build does not have.
          The method you pick selects how the customer funds the payment on-chain — it does not debit a bank
          account or card.
        </div>
      </Section>

      {/* Server facts */}
      <Section
        icon={<Building className="w-5 h-5" />}
        title="Server configuration"
        subtitle="Runtime values the payment API is using"
      >
        {config ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CopyRow label="Display rate" value={`₹${config.inrPerUsdc} per USDC`} mono={false} />
            <CopyRow
              label="Maximum link lifetime"
              value={`${Math.round(config.maxLinkSeconds / 86_400)} days`}
              mono={false}
            />
            <CopyRow label="Chain" value={`${config.chainName} · ${config.chainId}`} mono={false} />
            <CopyRow
              label="Checkout host"
              value={typeof window !== 'undefined' ? window.location.origin : '—'}
              mono
            />
          </div>
        ) : (
          <p className="text-xs text-neutral-400">Loading…</p>
        )}
        <p className="text-[11px] text-neutral-400 mt-3 leading-relaxed">
          The INR amount is display currency only. USDC is the unit that moves on-chain, converted at the rate
          above. Set <span className="font-mono">INR_PER_USDC</span> in the server environment to change it.
        </p>
      </Section>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-[28px] p-5 border border-neutral-100 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-extrabold text-neutral-900">
            <Smartphone className="w-4 h-4 text-indigo-500" /> Two-phone NFC flow
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
            The mobile app reads the same signed request over NFC. Create a link, then write its payload to a tag
            with Chrome on Android.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline mt-2"
          >
            Back to dashboard <Link2 className="w-3 h-3" />
          </a>
        </div>
        <div className="bg-white rounded-[28px] p-5 border border-neutral-100 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-extrabold text-neutral-900">
            <ExternalLink className="w-4 h-4 text-indigo-500" /> Explorers
          </div>
          <div className="mt-2 space-y-1.5 text-[11px]">
            <a
              href="https://sepolia.basescan.org"
              target="_blank"
              rel="noreferrer"
              className="block text-indigo-600 hover:underline"
            >
              Base Sepolia explorer →
            </a>
            <a
              href="https://sepolia.app.ens.domains"
              target="_blank"
              rel="noreferrer"
              className="block text-indigo-600 hover:underline"
            >
              ENS on Sepolia →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
