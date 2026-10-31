import React, { useState } from 'react';
import { 
  Key, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Save, 
  RefreshCw,
  Building,
  Smartphone
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showLiveKey, setShowLiveKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('https://api.apexgear.in/webhooks/payflux');
  const [upiVpa, setUpiVpa] = useState('apexgear@payflux');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const testKey = 'pf_test_9k82vls91a840192';
  const liveKey = 'pf_live_8492019482910482';

  const copyKey = (type: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Merchant Business KYC & Profile */}
      <div className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-800">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900">
                Business & Compliance Profile
              </h3>
              <p className="text-xs text-neutral-400">
                Registered merchant entity for GST invoices and NPCI settlements
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> KYC Verified
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
          <div className="p-3 bg-neutral-50 rounded-xl">
            <span className="text-neutral-400 block font-medium">Legal Entity Name</span>
            <span className="text-neutral-900 font-bold text-sm">Apex Electronics & Gear Ltd.</span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-xl">
            <span className="text-neutral-400 block font-medium">GSTIN</span>
            <span className="text-neutral-900 font-mono font-bold text-sm">27AABCA1234F1Z8</span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-xl">
            <span className="text-neutral-400 block font-medium">PAN</span>
            <span className="text-neutral-900 font-mono font-bold text-sm">AABCA1234F</span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-xl">
            <span className="text-neutral-400 block font-medium">Merchant Category Code (MCC)</span>
            <span className="text-neutral-900 font-bold text-sm">5732 - Electronic Sales & Gadgets</span>
          </div>
        </div>
      </div>

      {/* API Keys Configuration */}
      <div className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-neutral-900">
                Gateway API Credentials
              </h3>
              <p className="text-xs text-neutral-400">
                Authenticate checkout SDKs, plugins, and backend webhooks
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {/* Test API Key */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Sandbox Test API Key
            </label>
            <div className="flex items-center gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
              <span className="font-mono text-xs flex-1 text-neutral-700 truncate">
                {testKey}
              </span>
              <button
                onClick={() => copyKey('test', testKey)}
                className="text-xs font-semibold px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'test' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'test' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Live API Key */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">
              Production Live API Key
            </label>
            <div className="flex items-center gap-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
              <span className="font-mono text-xs flex-1 text-neutral-700 truncate">
                {showLiveKey ? liveKey : '••••••••••••••••••••••••••••••••'}
              </span>
              <button
                onClick={() => setShowLiveKey(!showLiveKey)}
                className="p-1.5 hover:bg-white rounded-lg text-neutral-500 cursor-pointer"
                title={showLiveKey ? 'Hide key' : 'Show key'}
              >
                {showLiveKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={() => copyKey('live', liveKey)}
                className="text-xs font-semibold px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'live' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'live' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Webhooks & UPI Setup Form */}
      <form onSubmit={handleSave} className="bg-white rounded-[28px] p-6 border border-neutral-100 shadow-2xs space-y-4">
        <h3 className="font-extrabold text-base text-neutral-900 pb-2 border-b border-neutral-100">
          Payment Endpoints & UPI VPA
        </h3>

        <div>
          <label className="block text-xs font-bold text-neutral-700 mb-1">
            Webhook Notification URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full bg-neutral-50 px-3.5 py-2 rounded-xl text-xs font-mono font-medium text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
            required
          />
          <p className="text-[11px] text-neutral-400 mt-1">
            Receives JSON payloads for `payment.captured`, `refund.processed`, and `settlement.dispatched`
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 mb-1">
            Merchant UPI Virtual Payment Address (VPA)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={upiVpa}
              onChange={(e) => setUpiVpa(e.target.value)}
              className="w-full bg-neutral-50 px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-900 border border-neutral-200 focus:outline-none focus:border-neutral-900"
              required
            />
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-2 rounded-xl shrink-0 border border-emerald-200">
              NPCI Approved
            </span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <Check className="w-4 h-4" /> Settings updated successfully
            </span>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
