import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  PlusCircle, 
  CheckCircle2, 
  FlaskConical, 
  Menu, 
  X,
  ExternalLink,
  ChevronDown,
  Building,
  ShieldCheck,
  CreditCard,
  LogOut,
  Smartphone
} from 'lucide-react';

export type TabType = 'Overview' | 'Transactions' | 'Analytics' | 'Settlements' | 'Customers' | 'Settings';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isTestMode: boolean;
  setIsTestMode: (val: boolean) => void;
  onOpenCreateLink: () => void;
  unreadCount?: number;
  onOpenCustomerCheckoutPreview?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isTestMode,
  setIsTestMode,
  onOpenCreateLink,
  unreadCount = 2,
  onOpenCustomerCheckoutPreview,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [moreNavDropdownOpen, setMoreNavDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const moreNavRef = useRef<HTMLDivElement>(null);

  const mainTabs: TabType[] = ['Overview', 'Transactions', 'Analytics'];
  const moreTabs: TabType[] = ['Settlements', 'Customers', 'Settings'];
  const allTabs: TabType[] = [...mainTabs, ...moreTabs];

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (moreNavRef.current && !moreNavRef.current.contains(event.target as Node)) {
        setMoreNavDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="w-full relative z-30">
      {/* Top Banner indicating Sandbox / Demo environment */}
      {isTestMode ? (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between text-xs text-amber-800 font-medium gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>
              <strong>Demonstration Sandbox Active:</strong> Test payments with multiple mock payment providers.
            </span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {onOpenCustomerCheckoutPreview && (
              <button
                onClick={onOpenCustomerCheckoutPreview}
                className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 bg-white/80 px-2 py-0.5 rounded-md border border-indigo-200 cursor-pointer text-[11px]"
              >
                <Smartphone className="w-3 h-3 text-indigo-600" />
                <span>Customer Checkout Demo</span>
              </button>
            )}
            <button
              onClick={() => setIsTestMode(false)}
              className="inline-flex items-center gap-1 font-semibold hover:underline text-amber-900 cursor-pointer"
            >
              Switch to Live Mode <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between text-xs text-emerald-800 font-medium gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span>
              <strong>Production Live Gateway:</strong> Connected to NPCI UPI Switch and RBI-approved acquiring banks.
            </span>
          </div>
          <button
            onClick={() => setIsTestMode(true)}
            className="inline-flex items-center gap-1 font-semibold hover:underline text-emerald-900 cursor-pointer ml-auto"
          >
            Switch to Sandbox <FlaskConical className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Bar */}
      <div className="flex items-center justify-between py-3.5 px-2 sm:px-4 gap-2">
        {/* Left: Brand Logo & Identifier */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => setActiveTab('Overview')}
            title="PayFlux Gateway Home"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-rose-400 p-0.5 shadow-sm flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-indigo-600 transition-transform group-hover:scale-110"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 3h5v5" />
                  <path d="M4 20L21 3" />
                  <path d="M21 16v5h-5" />
                  <path d="M15 15l6 6" />
                  <path d="M4 4l5 5" />
                </svg>
              </div>
            </div>
            <div className="leading-none">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-neutral-900">
                  PayFlux
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                  Gateway
                </span>
              </div>
            </div>
          </div>

          {/* Test / Live Toggle Pill (Medium+ viewports) */}
          <button
            onClick={() => setIsTestMode(!isTestMode)}
            className={`hidden 2xl:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer shrink-0 ${
              isTestMode
                ? 'bg-amber-100 text-amber-800 border border-amber-300/60 hover:bg-amber-200/60'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300/60 hover:bg-emerald-200/60'
            }`}
            title="Click to toggle between Demo Sandbox and Production data"
          >
            {isTestMode ? (
              <>
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Demo Sandbox</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Live Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Center: Adaptive Navigation Tabs */}
        {/* Full navigation for extra large viewports (>= 1280px) */}
        <nav className="hidden xl:flex items-center bg-[#f0eee9]/80 p-1 rounded-full border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] shrink-0">
          {allTabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.04]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </nav>

        {/* Compact navigation with "More" dropdown for large viewports (1024px - 1279px) */}
        <nav className="hidden lg:flex xl:hidden items-center bg-[#f0eee9]/80 p-1 rounded-full border border-black/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] shrink-0">
          {mainTabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.04]'
                }`}
              >
                {tab}
              </button>
            );
          })}

          <div className="relative" ref={moreNavRef}>
            <button
              onClick={() => setMoreNavDropdownOpen(!moreNavDropdownOpen)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                moreTabs.includes(activeTab)
                  ? 'bg-neutral-900 text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.04]'
              }`}
            >
              <span>{moreTabs.includes(activeTab) ? activeTab : 'More'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {moreNavDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl shadow-xl border border-neutral-100 py-1.5 z-50">
                {moreTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setMoreNavDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === tab
                        ? 'bg-neutral-100 text-neutral-900 font-bold'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Right Actions & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Create Payment Link Action */}
          <button
            onClick={onOpenCreateLink}
            className="inline-flex items-center gap-1 sm:gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full transition-all shadow-xs cursor-pointer shrink-0"
            title="Generate a new payment link for a customer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Create Link</span>
            <span className="sm:hidden">Link</span>
          </button>

          {/* Notifications */}
          <button
            aria-label="View notifications"
            className="relative p-1.5 sm:p-2 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* User Profile - ALWAYS visible and accessible with Popover Dropdown */}
          <div className="relative shrink-0" ref={profileRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 py-0.5 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
              aria-label="Merchant profile menu"
              aria-expanded={profileDropdownOpen}
            >
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
                  alt="Alex Morgan"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-white shadow-xs"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              <div className="hidden xl:block text-left leading-tight">
                <div className="font-bold text-xs text-neutral-900 flex items-center gap-1">
                  <span>Alex Morgan</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400" />
                </div>
                <div className="text-[11px] text-neutral-500">@alex_payflux</div>
              </div>
            </button>

            {/* Profile Dropdown Popover */}
            {profileDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-neutral-100 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-neutral-100">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
                    alt="Alex Morgan"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-50"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-neutral-900 truncate">Alex Morgan</div>
                    <div className="text-xs text-neutral-500 truncate">alex.m@apexgear.in</div>
                  </div>
                </div>

                <div className="py-2 space-y-1.5 text-xs text-neutral-600">
                  <div className="flex items-center justify-between px-2 py-1 bg-neutral-50 rounded-lg">
                    <span className="text-neutral-400">Merchant MID:</span>
                    <span className="font-mono font-bold text-neutral-800">MID_9482014</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 bg-neutral-50 rounded-lg">
                    <span className="text-neutral-400">Store:</span>
                    <span className="font-medium text-neutral-800 truncate max-w-[120px]">Apex Electronics</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 bg-neutral-50 rounded-lg">
                    <span className="text-neutral-400">Mode:</span>
                    <span className={`font-bold ${isTestMode ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {isTestMode ? 'Sandbox' : 'Production Live'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 space-y-1">
                  <button
                    onClick={() => {
                      setIsTestMode(!isTestMode);
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 flex items-center justify-between cursor-pointer"
                  >
                    <span>Switch to {isTestMode ? 'Live Mode' : 'Sandbox Demo'}</span>
                    <FlaskConical className="w-3.5 h-3.5 text-neutral-500" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('Settings');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-neutral-100 flex items-center justify-between cursor-pointer"
                  >
                    <span>Account Settings</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile & Tablet Menu Trigger (Hamburger) on < lg */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 sm:p-2 rounded-xl text-neutral-700 hover:bg-neutral-100 cursor-pointer shrink-0"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation (visible on < 1024px when toggled) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-200 py-3 px-3 flex flex-col gap-1 bg-white rounded-2xl mb-3 shadow-lg border border-neutral-100">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-neutral-100 px-1">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Navigation Menu
            </span>
            <span className="text-xs font-semibold text-neutral-600">
              {isTestMode ? 'Sandbox Active' : 'Live Gateway'}
            </span>
          </div>

          {allTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
              }}
              className={`text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {tab}
            </button>
          ))}

          <div className="pt-2 mt-1 border-t border-neutral-100 flex flex-col gap-2">
            {onOpenCustomerCheckoutPreview && (
              <button
                onClick={() => {
                  onOpenCustomerCheckoutPreview();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-center py-2 px-3 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-200/80 cursor-pointer"
              >
                Open Customer Checkout Demo
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTestMode(!isTestMode)}
                className="flex-1 text-xs font-semibold py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 cursor-pointer text-center"
              >
                Mode: {isTestMode ? 'Demo Sandbox' : 'Live'}
              </button>
              <button
                onClick={() => {
                  onOpenCreateLink();
                  setMobileMenuOpen(false);
                }}
                className="flex-1 text-xs font-semibold py-2 px-3 rounded-xl bg-neutral-900 text-white cursor-pointer text-center"
              >
                + Create Link
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
