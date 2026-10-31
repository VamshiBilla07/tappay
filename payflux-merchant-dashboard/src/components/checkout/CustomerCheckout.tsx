import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Smartphone, 
  CreditCard, 
  Building2, 
  Wallet, 
  Radio, 
  Coins, 
  Copy, 
  Check, 
  ArrowLeft, 
  ExternalLink, 
  Download, 
  RefreshCw, 
  ChevronRight,
  Info,
  Sparkles,
  Zap,
  RotateCcw
} from 'lucide-react';
import { PaymentLink, PaymentMethod, Transaction, BillingDetails } from '../../types';
import { formatINR, formatDateTime } from '../../utils/formatters';

interface CustomerCheckoutProps {
  paymentLink: PaymentLink;
  onPaymentSuccess: (updatedTxn: Transaction) => void;
  onPaymentFailed: (updatedTxn: Transaction) => void;
  onPaymentCancelled: (updatedTxn: Transaction) => void;
  onClose: () => void;
  isTestMode?: boolean;
}

type CheckoutStep = 'details' | 'payment' | 'authenticating' | 'success' | 'failed' | 'cancelled';

export const CustomerCheckout: React.FC<CustomerCheckoutProps> = ({
  paymentLink,
  onPaymentSuccess,
  onPaymentFailed,
  onPaymentCancelled,
  onClose,
  isTestMode = true,
}) => {
  // Step state
  const [step, setStep] = useState<CheckoutStep>('details');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(paymentLink.allowedMethods[0] || 'UPI');
  
  // Billing details
  const [billing, setBilling] = useState<BillingDetails>({
    name: paymentLink.customer.name || 'Dev Sharma',
    email: paymentLink.customer.email || 'dev.sharma@startup.in',
    phone: paymentLink.customer.phone || '9876543210',
    address: paymentLink.customer.address || (paymentLink.requireBillingAddress ? '42, Indiranagar, 100ft Road' : ''),
    city: paymentLink.requireBillingAddress ? 'Bengaluru' : '',
    pincode: paymentLink.requireBillingAddress ? '560038' : '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Payment form states
  // 1. UPI
  const [upiVpa, setUpiVpa] = useState('devsharma@okhdfcbank');
  const [copiedVpa, setCopiedVpa] = useState(false);

  // 2. Card
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardHolder, setCardHolder] = useState(billing.name || 'Dev Sharma');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('842');
  const [cardBrand, setCardBrand] = useState<'Visa' | 'Mastercard' | 'RuPay' | 'Amex'>('Visa');

  // 3. Net Banking
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  // 4. Digital Wallets
  const [selectedWallet, setSelectedWallet] = useState('Paytm');

  // 5. NFC
  const [nfcTapping, setNfcTapping] = useState(false);

  // 6. Crypto
  const [cryptoNetwork, setCryptoNetwork] = useState('Polygon (PoS)');
  const [cryptoToken, setCryptoToken] = useState('USDT');
  const [walletConnected, setWalletConnected] = useState(false);
  const [cryptoTxStage, setCryptoTxStage] = useState<'idle' | 'broadcasting' | 'confirming'>('idle');
  const [copiedCryptoAddress, setCopiedCryptoAddress] = useState(false);

  // 3D Secure / OTP Challenge
  const [otpValue, setOtpValue] = useState('492019');
  const [otpTimer, setOtpTimer] = useState(60);

  // Processing state & current transaction
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
  const [failureReason, setFailureReason] = useState<string>('');

  // Expiry timer
  const [secondsRemaining, setSecondsRemaining] = useState(15 * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Validate billing details
  const validateBilling = (): boolean => {
    const errors: Record<string, string> = {};
    if (!billing.name.trim()) errors.name = 'Full name is required';
    if (!billing.email.trim() || !billing.email.includes('@')) errors.email = 'Valid email is required';
    if (!billing.phone.trim() || billing.phone.replace(/\D/g, '').length < 10) {
      errors.phone = 'Valid 10-digit mobile number is required';
    }
    if (paymentLink.requireBillingAddress) {
      if (!billing.address?.trim()) errors.address = 'Billing address is required';
      if (!billing.city?.trim()) errors.city = 'City is required';
      if (!billing.pincode?.trim()) errors.pincode = 'PIN code is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Move from details to payment methods
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateBilling()) {
      setStep('payment');
    }
  };

  // Helper to construct transaction record
  const buildTransaction = (status: Transaction['status'], reason?: string): Transaction => {
    const fee = paymentLink.amount * 0.015;
    const tax = fee * 0.18;
    const net = paymentLink.amount - (fee + tax);

    let paymentSubtype = '';
    if (selectedMethod === 'UPI') paymentSubtype = 'Google Pay / NPCI';
    else if (selectedMethod === 'Credit Card') paymentSubtype = `${cardBrand} Credit Card •• 4242`;
    else if (selectedMethod === 'Debit Card') paymentSubtype = `${cardBrand} Debit Card •• 8492`;
    else if (selectedMethod === 'Net Banking') paymentSubtype = selectedBank;
    else if (selectedMethod === 'Digital Wallets') paymentSubtype = `${selectedWallet} Wallet`;
    else if (selectedMethod === 'NFC / Contactless') paymentSubtype = 'POS Tap to Pay Reader';
    else if (selectedMethod === 'Cryptocurrency') paymentSubtype = `${cryptoNetwork} (${cryptoToken})`;

    return {
      id: `TX-${Math.floor(10000 + Math.random() * 90000)}`,
      referenceId: paymentLink.orderId,
      paymentLinkId: paymentLink.id,
      customer: {
        id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
        name: billing.name,
        handle: `@${billing.name.toLowerCase().replace(/\s+/g, '')}`,
        email: billing.email,
        phone: billing.phone,
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
      },
      amount: paymentLink.amount,
      currency: 'INR',
      fee: Math.round(fee * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      netAmount: Math.round(net * 100) / 100,
      paymentMethod: selectedMethod,
      paymentSubtype,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settlementStatus: status === 'Successful' ? 'Settled' : 'Pending',
      upiRefNo: selectedMethod === 'UPI' ? `6298${Math.floor(10000000 + Math.random() * 90000000)}` : undefined,
      utrNumber: status === 'Successful' ? `HDFCN${Date.now().toString().slice(-11)}` : undefined,
      txHash: selectedMethod === 'Cryptocurrency' ? `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}` : undefined,
      failureReason: reason,
    };
  };

  // Initiating the payment flow
  const handleInitiatePayment = () => {
    // If card payment, go to 3D Secure / OTP challenge first!
    if (selectedMethod === 'Credit Card' || selectedMethod === 'Debit Card') {
      setStep('authenticating');
      return;
    }

    if (selectedMethod === 'Cryptocurrency') {
      if (!walletConnected) {
        alert('Please connect your Web3 wallet first to sign the transaction.');
        return;
      }
      setCryptoTxStage('broadcasting');
      setIsProcessing(true);
      setTimeout(() => {
        setCryptoTxStage('confirming');
        setTimeout(() => {
          executePaymentOutcome('Successful');
        }, 1500);
      }, 1200);
      return;
    }

    // Default flow: simulate network processing -> success
    setIsProcessing(true);
    setTimeout(() => {
      executePaymentOutcome('Successful');
    }, 1500);
  };

  // Central payment outcome execution
  const executePaymentOutcome = (outcome: 'Successful' | 'Failed' | 'Cancelled', reason?: string) => {
    setIsProcessing(false);
    const txn = buildTransaction(outcome, reason);
    setCurrentTransaction(txn);

    if (outcome === 'Successful') {
      setStep('success');
      onPaymentSuccess(txn);
    } else if (outcome === 'Failed') {
      setFailureReason(reason || 'Bank Gateway Timeout (NPCI-RB04). Please retry or choose another method.');
      setStep('failed');
      onPaymentFailed(txn);
    } else {
      setStep('cancelled');
      onPaymentCancelled(txn);
    }
  };

  // Card brand detection
  const handleCardNumberChange = (val: string) => {
    setCardNumber(val);
    const clean = val.replace(/\D/g, '');
    if (clean.startsWith('4')) setCardBrand('Visa');
    else if (clean.startsWith('5')) setCardBrand('Mastercard');
    else if (clean.startsWith('6') || clean.startsWith('8')) setCardBrand('RuPay');
    else if (clean.startsWith('3')) setCardBrand('Amex');
  };

  const copyUpiVpa = () => {
    navigator.clipboard.writeText('apexgear@payflux');
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const copyCryptoAddress = () => {
    navigator.clipboard.writeText('0x29F8aB901C635B84920Ea77B492019482Ac49B01');
    setCopiedCryptoAddress(true);
    setTimeout(() => setCopiedCryptoAddress(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral-900/70 backdrop-blur-sm overflow-y-auto">
      <div 
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-neutral-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-labelledby="checkout-title"
        aria-modal="true"
      >
        {/* Top Header: PayFlux Gateway Branding & Security */}
        <div className="bg-neutral-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-rose-400 p-0.5 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-neutral-900 rounded-[10px] flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M16 3h5v5" />
                  <path d="M4 20L21 3" />
                  <path d="M21 16v5h-5" />
                  <path d="M15 15l6 6" />
                  <path d="M4 4l5 5" />
                </svg>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-white" id="checkout-title">
                  PayFlux Checkout
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-neutral-800 text-indigo-300 rounded border border-neutral-700">
                  Secured
                </span>
              </div>
              <div className="text-[11px] text-neutral-400">
                Apex Electronics & Gear Ltd.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-neutral-400 bg-neutral-800/80 px-2.5 py-1 rounded-full border border-neutral-700">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>

            <button
              onClick={onClose}
              aria-label="Close checkout"
              className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Order Price & Merchant Summary */}
        <div className="bg-neutral-50 px-5 sm:px-6 py-3.5 border-b border-neutral-200/80 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wider">
              Amount Payable
            </span>
            <div className="text-2xl font-black text-neutral-900 tracking-tight">
              {formatINR(paymentLink.amount)}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-neutral-400 font-mono">
              Ref: {paymentLink.orderId}
            </span>
            <div className="text-xs font-medium text-neutral-600 truncate max-w-[200px]">
              {paymentLink.description}
            </div>
          </div>
        </div>

        {/* Main Body per Step */}
        <div className="p-5 sm:p-6 max-h-[65vh] overflow-y-auto">
          {/* STEP 1: BILLING DETAILS */}
          {step === 'details' && (
            <form onSubmit={handleProceedToPayment} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <span className="font-extrabold text-sm text-neutral-900">
                  Step 1: Customer Billing Information
                </span>
                <span className="text-xs text-neutral-400">Required by RBI</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={billing.name}
                  onChange={(e) => setBilling({ ...billing, name: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border bg-neutral-50 focus:bg-white focus:outline-none ${
                    validationErrors.name ? 'border-rose-400' : 'border-neutral-200 focus:border-neutral-900'
                  }`}
                  placeholder="e.g. Dev Sharma"
                  required
                />
                {validationErrors.name && (
                  <p className="text-[11px] text-rose-600 mt-1">{validationErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={billing.email}
                    onChange={(e) => setBilling({ ...billing, email: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border bg-neutral-50 focus:bg-white focus:outline-none ${
                      validationErrors.email ? 'border-rose-400' : 'border-neutral-200 focus:border-neutral-900'
                    }`}
                    placeholder="dev@startup.in"
                    required
                  />
                  {validationErrors.email && (
                    <p className="text-[11px] text-rose-600 mt-1">{validationErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Mobile Number (+91) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={billing.phone}
                    onChange={(e) => setBilling({ ...billing, phone: e.target.value })}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border bg-neutral-50 focus:bg-white focus:outline-none ${
                      validationErrors.phone ? 'border-rose-400' : 'border-neutral-200 focus:border-neutral-900'
                    }`}
                    placeholder="9876543210"
                    maxLength={10}
                    required
                  />
                  {validationErrors.phone && (
                    <p className="text-[11px] text-rose-600 mt-1">{validationErrors.phone}</p>
                  )}
                </div>
              </div>

              {paymentLink.requireBillingAddress && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Billing Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={billing.address}
                      onChange={(e) => setBilling({ ...billing, address: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl text-xs font-medium border border-neutral-200 bg-neutral-50 focus:bg-white"
                      placeholder="Street address, Flat / Suite"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">City</label>
                      <input
                        type="text"
                        value={billing.city}
                        onChange={(e) => setBilling({ ...billing, city: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl text-xs border border-neutral-200 bg-neutral-50"
                        placeholder="Bengaluru"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">Pincode</label>
                      <input
                        type="text"
                        value={billing.pincode}
                        onChange={(e) => setBilling({ ...billing, pincode: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl text-xs border border-neutral-200 bg-neutral-50"
                        placeholder="560038"
                        maxLength={6}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span>Continue to Payment</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: PAYMENT METHOD SELECTION & METHOD WORKFLOW */}
          {step === 'payment' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <button
                  onClick={() => setStep('details')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to details
                </button>
                <span className="text-xs font-bold text-neutral-700">
                  Paying as: <strong className="text-neutral-900">{billing.name}</strong>
                </span>
              </div>

              {/* Method Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {paymentLink.allowedMethods.map((method) => {
                  const isSelected = selectedMethod === method;
                  return (
                    <button
                      key={method}
                      onClick={() => setSelectedMethod(method)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex flex-col justify-between h-16 ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                          : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        {method === 'UPI' && <Smartphone className={`w-4 h-4 ${isSelected ? 'text-emerald-300' : 'text-emerald-600'}`} />}
                        {method === 'Credit Card' && <CreditCard className={`w-4 h-4 ${isSelected ? 'text-indigo-300' : 'text-indigo-600'}`} />}
                        {method === 'Debit Card' && <CreditCard className={`w-4 h-4 ${isSelected ? 'text-blue-300' : 'text-blue-600'}`} />}
                        {method === 'Net Banking' && <Building2 className={`w-4 h-4 ${isSelected ? 'text-cyan-300' : 'text-cyan-600'}`} />}
                        {method === 'Digital Wallets' && <Wallet className={`w-4 h-4 ${isSelected ? 'text-amber-300' : 'text-amber-600'}`} />}
                        {method === 'NFC / Contactless' && <Radio className={`w-4 h-4 ${isSelected ? 'text-rose-300' : 'text-rose-600'}`} />}
                        {method === 'Cryptocurrency' && <Coins className={`w-4 h-4 ${isSelected ? 'text-purple-300' : 'text-purple-600'}`} />}
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-[11px] leading-tight truncate">{method}</span>
                    </button>
                  );
                })}
              </div>

              {/* PAYMENT METHOD 1: UPI */}
              {selectedMethod === 'UPI' && (
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Dynamic UPI QR Code (SVG Vector rendering standard UPI spec) */}
                    <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-neutral-200 shrink-0 text-center">
                      <svg className="w-32 h-32 mx-auto" viewBox="0 0 120 120">
                        {/* Realistic QR pattern */}
                        <rect width="120" height="120" fill="white" />
                        <rect x="10" y="10" width="30" height="30" fill="#0f172a" rx="4" />
                        <rect x="16" y="16" width="18" height="18" fill="white" />
                        <rect x="20" y="20" width="10" height="10" fill="#0f172a" />
                        <rect x="80" y="10" width="30" height="30" fill="#0f172a" rx="4" />
                        <rect x="86" y="16" width="18" height="18" fill="white" />
                        <rect x="90" y="20" width="10" height="10" fill="#0f172a" />
                        <rect x="10" y="80" width="30" height="30" fill="#0f172a" rx="4" />
                        <rect x="16" y="86" width="18" height="18" fill="white" />
                        <rect x="20" y="90" width="10" height="10" fill="#0f172a" />
                        {/* Dynamic bits */}
                        <rect x="46" y="12" width="6" height="6" fill="#0f172a" />
                        <rect x="56" y="16" width="8" height="6" fill="#0f172a" />
                        <rect x="68" y="12" width="6" height="8" fill="#0f172a" />
                        <rect x="48" y="26" width="14" height="6" fill="#0f172a" />
                        <rect x="66" y="24" width="8" height="10" fill="#0f172a" />
                        <rect x="46" y="44" width="28" height="28" fill="#4f46e5" rx="6" />
                        {/* UPI Emblem in center of QR */}
                        <circle cx="60" cy="58" r="8" fill="white" />
                        <path d="M57 54l6 4-6 4" stroke="#4f46e5" strokeWidth="2" fill="none" />
                        {/* Data rows */}
                        <rect x="12" y="48" width="8" height="6" fill="#0f172a" />
                        <rect x="24" y="46" width="14" height="6" fill="#0f172a" />
                        <rect x="14" y="58" width="6" height="12" fill="#0f172a" />
                        <rect x="26" y="58" width="8" height="6" fill="#0f172a" />
                        <rect x="82" y="46" width="12" height="6" fill="#0f172a" />
                        <rect x="98" y="48" width="10" height="6" fill="#0f172a" />
                        <rect x="84" y="60" width="24" height="6" fill="#0f172a" />
                        <rect x="46" y="82" width="10" height="6" fill="#0f172a" />
                        <rect x="62" y="86" width="14" height="8" fill="#0f172a" />
                        <rect x="48" y="96" width="26" height="6" fill="#0f172a" />
                        <rect x="82" y="82" width="10" height="10" fill="#0f172a" />
                        <rect x="96" y="88" width="14" height="6" fill="#0f172a" />
                        <rect x="86" y="100" width="20" height="8" fill="#0f172a" />
                      </svg>
                      <span className="text-[10px] font-bold text-neutral-500 mt-1 block">
                        Scan with any UPI App
                      </span>
                    </div>

                    {/* VPA Info and Intent */}
                    <div className="flex-1 space-y-2.5 text-xs">
                      <div>
                        <span className="text-[11px] text-neutral-500 font-medium">Merchant UPI VPA:</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-bold text-neutral-900 bg-white px-2.5 py-1 rounded-lg border border-neutral-200">
                            apexgear@payflux
                          </span>
                          <button
                            onClick={copyUpiVpa}
                            className="p-1.5 bg-white hover:bg-neutral-100 rounded-lg border border-neutral-200 text-neutral-600 cursor-pointer"
                            title="Copy UPI ID"
                          >
                            {copiedVpa ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* UPI Apps selection */}
                      <div>
                        <span className="text-[11px] text-neutral-500 font-medium">Popular UPI Apps:</span>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {['Google Pay', 'PhonePe', 'Paytm', 'CRED Pay'].map((app) => (
                            <button
                              key={app}
                              type="button"
                              onClick={() => {
                                setIsProcessing(true);
                                setTimeout(() => executePaymentOutcome('Successful'), 1500);
                              }}
                              className="px-2.5 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-800 font-semibold text-[11px] text-left flex items-center justify-between cursor-pointer"
                            >
                              <span>{app}</span>
                              <ChevronRight className="w-3 h-3 text-neutral-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Or Enter UPI ID */}
                  <div className="pt-2 border-t border-neutral-200/80">
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Or pay via your UPI ID:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={upiVpa}
                        onChange={(e) => setUpiVpa(e.target.value)}
                        className="flex-1 bg-white px-3 py-2 rounded-xl text-xs border border-neutral-200 font-mono focus:outline-none focus:border-neutral-900"
                        placeholder="username@okhdfcbank"
                      />
                      <button
                        type="button"
                        onClick={handleInitiatePayment}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                      >
                        {isProcessing ? 'Verifying...' : 'Pay Now'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PAYMENT METHOD 2: CREDIT / DEBIT CARDS */}
              {(selectedMethod === 'Credit Card' || selectedMethod === 'Debit Card') && (
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800">
                      Card Details (Tokenized & Encrypted)
                    </span>
                    <span className="text-xs font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      {cardBrand}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                      Card Number
                    </label>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => handleCardNumberChange(e.target.value)}
                        className="w-full bg-white pl-9 pr-4 py-2 rounded-xl text-xs font-mono font-medium border border-neutral-200 focus:outline-none focus:border-neutral-900"
                        placeholder="4242 4242 4242 4242"
                        maxLength={19}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full bg-white px-3 py-2 rounded-xl text-xs font-medium border border-neutral-200 focus:outline-none focus:border-neutral-900"
                      placeholder="Name on card"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                        Expiry (MM/YY)
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full bg-white px-3 py-2 rounded-xl text-xs font-mono border border-neutral-200"
                        placeholder="MM/YY"
                        maxLength={5}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                        CVV (3 or 4 digits)
                      </label>
                      <input
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full bg-white px-3 py-2 rounded-xl text-xs font-mono border border-neutral-200"
                        placeholder="•••"
                        maxLength={4}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>RBI CoFT Tokenized Payment • 256-bit TLS Security</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleInitiatePayment}
                    className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    Proceed to 3D Secure Authentication →
                  </button>
                </div>
              )}

              {/* PAYMENT METHOD 3: NET BANKING */}
              {selectedMethod === 'Net Banking' && (
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-3">
                  <span className="text-xs font-bold text-neutral-800 block">
                    Select Your Bank:
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Bank', 'Punjab National Bank'].map((bank) => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => setSelectedBank(bank)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                          selectedBank === bank
                            ? 'border-neutral-900 bg-neutral-900 text-white shadow-2xs'
                            : 'border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        {bank}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Or choose from all other 50+ scheduled banks:
                    </label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full bg-white px-3 py-2 rounded-xl text-xs border border-neutral-200"
                    >
                      <option value="HDFC Bank">HDFC Bank Ltd</option>
                      <option value="ICICI Bank">ICICI Bank Ltd</option>
                      <option value="State Bank of India">State Bank of India</option>
                      <option value="Axis Bank">Axis Bank Ltd</option>
                      <option value="Bank of Baroda">Bank of Baroda</option>
                      <option value="Canara Bank">Canara Bank</option>
                      <option value="IndusInd Bank">IndusInd Bank Ltd</option>
                      <option value="IDFC FIRST Bank">IDFC FIRST Bank</option>
                      <option value="Yes Bank">Yes Bank</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleInitiatePayment}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs mt-2"
                  >
                    {isProcessing ? 'Connecting to Bank Gateway...' : `Proceed to ${selectedBank} NetBanking`}
                  </button>
                </div>
              )}

              {/* PAYMENT METHOD 4: DIGITAL WALLETS */}
              {selectedMethod === 'Digital Wallets' && (
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-3">
                  <span className="text-xs font-bold text-neutral-800 block">
                    Choose Wallet Provider:
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {['Paytm Wallet', 'PhonePe Wallet', 'Mobikwik ZIP', 'Amazon Pay'].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setSelectedWallet(w)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                          selectedWallet === w
                            ? 'border-neutral-900 bg-neutral-900 text-white'
                            : 'border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-neutral-200 text-xs space-y-1">
                    <span className="text-neutral-500">Linked Account Mobile:</span>
                    <div className="font-mono font-bold text-neutral-900">
                      +91 {billing.phone}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleInitiatePayment}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    {isProcessing ? 'Authorizing Wallet...' : `Pay ${formatINR(paymentLink.amount)} with ${selectedWallet}`}
                  </button>
                </div>
              )}

              {/* PAYMENT METHOD 5: NFC / CONTACTLESS */}
              {selectedMethod === 'NFC / Contactless' && (
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>

                  <div>
                    <h4 className="font-extrabold text-xs text-neutral-900">
                      Contactless Tap to Pay
                    </h4>
                    <p className="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto">
                      Hold your contactless credit/debit card, Apple Pay, or Google Wallet against the payment reader terminal.
                    </p>
                  </div>

                  {/* Hardware Capability Notice */}
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] text-left space-y-1">
                    <strong>Hardware Integration Status:</strong>
                    <p>
                      Standard desktop web browsers do not have EMV hardware access for contactless card taps. In production, this requires an authorized PayFlux SmartPOS Terminal or Android device with Web NFC.
                    </p>
                  </div>

                  {/* Sandbox Hardware Emulator */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNfcTapping(true);
                        setTimeout(() => {
                          setNfcTapping(false);
                          executePaymentOutcome('Successful');
                        }, 1800);
                      }}
                      disabled={nfcTapping}
                      className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      {nfcTapping ? 'Simulating NFC Tap & EMV Handshake...' : 'Simulate Contactless Card Tap (Sandbox)'}
                    </button>
                  </div>
                </div>
              )}

              {/* PAYMENT METHOD 6: CRYPTOCURRENCY */}
              {selectedMethod === 'Cryptocurrency' && (
                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-800 block">
                        Web3 Crypto Gateway
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        Zero-slippage conversion via decentralized liquidity
                      </span>
                    </div>

                    {/* Network & Token Selector */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={cryptoNetwork}
                        onChange={(e) => setCryptoNetwork(e.target.value)}
                        className="bg-white px-2 py-1 rounded-lg text-[11px] font-semibold border border-neutral-200"
                      >
                        <option value="Polygon (PoS)">Polygon</option>
                        <option value="Ethereum">Ethereum</option>
                        <option value="Arbitrum">Arbitrum</option>
                        <option value="BNB Chain">BNB Chain</option>
                      </select>

                      <select
                        value={cryptoToken}
                        onChange={(e) => setCryptoToken(e.target.value)}
                        className="bg-white px-2 py-1 rounded-lg text-[11px] font-semibold border border-neutral-200"
                      >
                        <option value="USDT">USDT</option>
                        <option value="USDC">USDC</option>
                        <option value="ETH">ETH</option>
                        <option value="MATIC">MATIC</option>
                      </select>
                    </div>
                  </div>

                  {/* Calculated Quote */}
                  <div className="p-3 bg-white rounded-xl border border-neutral-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Estimated Crypto Amount:</span>
                      <span className="font-mono font-bold text-neutral-900 text-sm">
                        {(paymentLink.amount / 89.2).toFixed(2)} {cryptoToken}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-neutral-400 block text-[10px]">Exchange Rate:</span>
                      <span className="font-mono text-neutral-600">1 {cryptoToken} = ₹89.20</span>
                    </div>
                  </div>

                  {/* Wallet Connection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-neutral-700">Wallet Status:</span>
                      {walletConnected ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Connected: 0x71C...48B9
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setWalletConnected(true)}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 cursor-pointer"
                        >
                          Connect Wallet
                        </button>
                      )}
                    </div>

                    {/* Deposit address */}
                    <div className="p-2.5 bg-neutral-100/70 rounded-xl space-y-1">
                      <span className="text-[10px] text-neutral-500 font-semibold uppercase">Merchant Receiving Address:</span>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-800 bg-white p-1.5 rounded-lg border border-neutral-200">
                        <span className="truncate flex-1">0x29F8aB901C635B84920Ea77B492019482Ac49B01</span>
                        <button
                          onClick={copyCryptoAddress}
                          className="p-1 hover:bg-neutral-100 rounded text-neutral-600 cursor-pointer"
                          title="Copy address"
                        >
                          {copiedCryptoAddress ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {cryptoTxStage !== 'idle' && (
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-indigo-900 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-bold">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        <span>
                          {cryptoTxStage === 'broadcasting' ? 'Broadcasting on-chain transaction...' : 'Waiting for block confirmations (1/3)...'}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-700 font-mono">
                        Hash: 0x4f829...912a • Network: {cryptoNetwork}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleInitiatePayment}
                    disabled={isProcessing || cryptoTxStage !== 'idle'}
                    className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    {walletConnected ? 'Authorize & Sign Payment' : 'Connect Wallet to Pay'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: 3D SECURE OTP AUTHENTICATION CHALLENGE */}
          {step === 'authenticating' && (
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-4 animate-in fade-in duration-200 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-neutral-900">
                  Bank 3D Secure 2.0 Challenge
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  We've sent a 6-digit one-time password to mobile ending in ••••••{billing.phone.slice(-4) || '8492'}
                </p>
              </div>

              <div className="max-w-xs mx-auto">
                <input
                  type="text"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value)}
                  className="w-full text-center tracking-[0.5em] text-xl font-mono font-bold bg-white p-3 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-900"
                  maxLength={6}
                />
              </div>

              <div className="text-[11px] text-neutral-400">
                Resend OTP in <span className="font-mono text-neutral-700 font-bold">{otpTimer}s</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('payment')}
                  className="flex-1 py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsProcessing(true);
                    setTimeout(() => executePaymentOutcome('Successful'), 1000);
                  }}
                  disabled={isProcessing}
                  className="flex-1 py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {isProcessing ? 'Verifying with Bank...' : 'Authorize Payment'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS OUTCOME */}
          {step === 'success' && currentTransaction && (
            <div className="text-center py-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                  Verified Payment Successful
                </span>
                <h3 className="text-2xl font-black text-neutral-900 mt-1">
                  {formatINR(currentTransaction.amount)}
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Paid to Apex Electronics & Gear Ltd.
                </p>
              </div>

              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 text-left text-xs space-y-2 max-w-md mx-auto">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Transaction ID:</span>
                  <span className="font-mono font-bold text-neutral-900">{currentTransaction.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Method:</span>
                  <span className="font-semibold text-neutral-900">{currentTransaction.paymentMethod} ({currentTransaction.paymentSubtype})</span>
                </div>
                {currentTransaction.utrNumber && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Bank UTR / Ref:</span>
                    <span className="font-mono text-neutral-800">{currentTransaction.utrNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">Paid by:</span>
                  <span className="font-medium text-neutral-800">{billing.name} ({billing.email})</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-neutral-200/60">
                  <span className="text-neutral-500">Time:</span>
                  <span className="font-medium text-neutral-700">{formatDateTime(currentTransaction.createdAt)}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => alert(`Official GST Receipt downloaded for ${currentTransaction.id}`)}
                  className="w-full sm:w-auto px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: FAILED OUTCOME */}
          {step === 'failed' && (
            <div className="text-center py-4 space-y-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                <XCircle className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 uppercase tracking-wider">
                  Payment Failed
                </span>
                <h3 className="text-xl font-black text-neutral-900 mt-1">
                  Transaction Declined
                </h3>
                <p className="text-xs text-rose-700 mt-2 p-3 bg-rose-50 rounded-xl border border-rose-200 max-w-md mx-auto">
                  {failureReason}
                </p>
              </div>

              <p className="text-xs text-neutral-500">
                Your account was not debited. You can retry with the same method or select a different option.
              </p>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('payment')}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again / Change Method</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Exit
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: CANCELLED OUTCOME */}
          {step === 'cancelled' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-500 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-neutral-900">
                Payment Cancelled
              </h3>
              <p className="text-xs text-neutral-500">
                This transaction has been cancelled. No funds were transferred.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setStep('details')}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Restart Checkout
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM: SANDBOX TEST CONTROLLER */}
        {isTestMode && step !== 'success' && step !== 'failed' && (
          <div className="bg-amber-500/10 border-t border-amber-500/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Sandbox Test Controller:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => executePaymentOutcome('Successful')}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg cursor-pointer"
                title="Force test successful payment"
              >
                Simulate Success
              </button>
              <button
                type="button"
                onClick={() => executePaymentOutcome('Failed', 'Card Issuer Declined: Insufficient Account Balance (RB-51)')}
                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg cursor-pointer"
                title="Force test bank failure"
              >
                Simulate Decline
              </button>
              <button
                type="button"
                onClick={() => executePaymentOutcome('Failed', 'Authentication Error: 3D Secure OTP Expired (ACS-08)')}
                className="px-2 py-1 bg-amber-700 hover:bg-amber-800 text-white font-bold text-[10px] rounded-lg cursor-pointer"
                title="Force test OTP timeout"
              >
                Simulate OTP Timeout
              </button>
              <button
                type="button"
                onClick={() => executePaymentOutcome('Cancelled', 'Customer aborted checkout session')}
                className="px-2 py-1 bg-neutral-700 hover:bg-neutral-800 text-white font-bold text-[10px] rounded-lg cursor-pointer"
                title="Force cancel payment"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
