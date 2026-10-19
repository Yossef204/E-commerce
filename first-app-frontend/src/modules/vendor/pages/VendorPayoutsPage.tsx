import React, { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Wallet,
  Lock,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  Smartphone,
  Zap,
  RefreshCw,
  Plus,
  Check,
  ChevronRight,
  ChevronLeft,
  FileText,
  Settings,
  HelpCircle,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  X,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import vendorApi from '../../../api/vendorApi';
import type {
  SellingEntity,
  WalletBalanceSummary,
  LedgerEntry,
  SellerPayoutMethod,
  PayoutRequestItem,
  PayoutMethodType,
} from '../../../types/vendor';

export const VendorPayoutsPage: React.FC = () => {
  const { entity } = useOutletContext<{ entity: SellingEntity | null }>();

  // State: Tab & Loading
  const [activeTab, setActiveTab] = useState<'ledger' | 'payouts' | 'methods'>('ledger');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Financial Data State
  const [balance, setBalance] = useState<WalletBalanceSummary>({
    pendingBalance: 0,
    availableBalance: 0,
    withdrawnBalance: 0,
    currency: 'EGP',
  });
  const [payoutMethods, setPayoutMethods] = useState<SellerPayoutMethod[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRequestItem[]>([]);

  // Ledger Table State
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>('ALL');
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Modals State
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isAddMethodModalOpen, setIsAddMethodModalOpen] = useState(false);

  // Payout Request Form State
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [payoutNotes, setPayoutNotes] = useState<string>('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutFormError, setPayoutFormError] = useState<string | null>(null);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);

  // Add Payout Method Form State
  const [newMethodType, setNewMethodType] = useState<PayoutMethodType>('BANK_ACCOUNT');
  const [bankHolderName, setBankHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankSwift, setBankSwift] = useState('');
  const [walletNumber, setWalletNumber] = useState('');
  const [instaPayAddress, setInstaPayAddress] = useState('');
  const [makeDefault, setMakeDefault] = useState(true);
  const [submittingMethod, setSubmittingMethod] = useState(false);
  const [methodFormError, setMethodFormError] = useState<string | null>(null);

  // Fetch full financial data
  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!entity?._id) return;
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const [balRes, methodsRes, historyRes] = await Promise.all([
          vendorApi.getWalletBalance(entity._id).catch(() => ({
            pendingBalance: 0,
            availableBalance: 0,
            withdrawnBalance: 0,
            currency: 'EGP',
          })),
          vendorApi.getPayoutMethods(entity._id).catch(() => []),
          vendorApi.getPayoutHistory(entity._id).catch(() => []),
        ]);

        setBalance(balRes);
        setPayoutMethods(methodsRes);
        setPayoutHistory(historyRes);

        // Auto select default payout method in modal
        const defMethod = methodsRes.find((m) => m.isDefault) || methodsRes[0];
        if (defMethod) {
          setSelectedMethodId(defMethod._id);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'فشل في تحميل بيانات المحفظة والسحب');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [entity?._id]
  );

  // Fetch ledger entries with pagination & filter
  const fetchLedger = useCallback(async () => {
    if (!entity?._id) return;
    setLoadingLedger(true);
    try {
      const res = await vendorApi.getLedgerEntries({
        sellingEntityId: entity._id,
        page: ledgerPage,
        limit: 10,
        status: ledgerStatusFilter,
      });
      setLedgerEntries(res.entries || []);
      setLedgerTotal(res.total || 0);
      setLedgerTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Error fetching ledger entries:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, [entity?._id, ledgerPage, ledgerStatusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Handle Payout Request Submission
  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutFormError(null);
    setPayoutSuccessMsg(null);

    const amountNum = parseFloat(payoutAmount);
    if (isNaN(amountNum) || amountNum < 500) {
      setPayoutFormError('الحد الأدنى لطلب سحب الأرباح هو 500 ج.م');
      return;
    }

    if (amountNum > balance.availableBalance) {
      setPayoutFormError(
        `المبلغ المطلوب (${amountNum.toLocaleString()} ج.م) يتجاوز الرصيد المتاح حالياً (${balance.availableBalance.toLocaleString()} ج.م)`
      );
      return;
    }

    if (!selectedMethodId) {
      setPayoutFormError('يرجى اختيار وسيلة سحب صالحة');
      return;
    }

    try {
      setSubmittingPayout(true);
      const res = await vendorApi.requestPayout({
        amount: amountNum,
        payoutMethodId: selectedMethodId,
        sellingEntityId: entity?._id,
        notes: payoutNotes,
      });

      setPayoutSuccessMsg(res.message || 'تم تأكيد طلب السحب بنجاح وتحويل المبلغ فورياً.');
      setPayoutAmount('');
      setPayoutNotes('');
      // Refresh data
      await fetchData(true);
      await fetchLedger();

      setTimeout(() => {
        setIsPayoutModalOpen(false);
        setPayoutSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      setPayoutFormError(err.response?.data?.message || 'حدث خطأ أثناء معالجة طلب السحب');
    } finally {
      setSubmittingPayout(false);
    }
  };

  // Handle Add Payout Method Submission
  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setMethodFormError(null);

    let details: Record<string, any> = {};

    if (newMethodType === 'BANK_ACCOUNT') {
      if (!bankHolderName.trim() || !bankName.trim() || !bankIban.trim()) {
        setMethodFormError('يرجى ملء جميع الحقول المطلوبة للحساب البنكي (الاسم، البنك، الـ IBAN)');
        return;
      }
      details = {
        accountHolderName: bankHolderName.trim(),
        bankName: bankName.trim(),
        iban: bankIban.trim(),
        swiftCode: bankSwift.trim() || undefined,
      };
    } else if (newMethodType === 'VODAFONE_CASH') {
      const trimmedWallet = walletNumber.trim();
      const phoneRegex = /^01[0125][0-9]{8}$/;
      if (!phoneRegex.test(trimmedWallet)) {
        setMethodFormError('رقم المحفظة غير صحيح، يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015');
        return;
      }
      details = { walletNumber: trimmedWallet };
    } else if (newMethodType === 'INSTAPAY') {
      const trimmedIpa = instaPayAddress.trim();
      if (!trimmedIpa || trimmedIpa.length < 3) {
        setMethodFormError('يرجى كتابة عنوان أو رقم إنستاباي صحيح (InstaPay IPA / Mobile)');
        return;
      }
      details = { instaPayAddress: trimmedIpa };
    }

    try {
      setSubmittingMethod(true);
      await vendorApi.createPayoutMethod({
        type: newMethodType,
        details,
        isDefault: makeDefault,
        sellingEntityId: entity?._id,
      });

      // Reset Form
      setBankHolderName('');
      setBankName('');
      setBankIban('');
      setBankSwift('');
      setWalletNumber('');
      setInstaPayAddress('');
      setIsAddMethodModalOpen(false);

      await fetchData(true);
    } catch (err: any) {
      setMethodFormError(err.response?.data?.message || 'فشل في حفظ طريقة السحب');
    } finally {
      setSubmittingMethod(false);
    }
  };

  // Handle Setting Default Method
  const handleSetDefault = async (methodId: string) => {
    try {
      await vendorApi.setDefaultPayoutMethod(methodId, entity?._id);
      await fetchData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل في تعيين الطريقة كافتراضية');
    }
  };

  // Helper: Status Badges for Ledger
  const renderLedgerStatusBadge = (status: string) => {
    switch (status) {
      case 'HELD_ESCROW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Lock className="w-3 h-3 text-amber-500" />
            معلق في الضمان
          </span>
        );
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            متاح للسحب
          </span>
        );
      case 'SETTLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck className="w-3 h-3 text-blue-500" />
            مسوّى ومحول
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3 h-3 text-rose-500" />
            ملغي
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  // Helper: Entry Type Labels
  const getEntryTypeDetails = (entryType: string, type?: string, entry?: LedgerEntry) => {
    const isCOD =
      entry?.paymentMethod === 'COD' ||
      entry?.reference?.startsWith('COD') ||
      entry?.description?.includes('COD') ||
      entry?.description?.includes('كاش');

    if (isCOD && entryType === 'ORDER_CREDIT') {
      return {
        label: 'طلب كاش (COD)',
        isCredit: true,
        icon: Smartphone,
        colorClass: 'text-amber-600 font-bold',
      };
    }
    if (isCOD && entryType === 'PLATFORM_FEE_DEBIT') {
      return {
        label: 'عمولة منصة (COD)',
        isCredit: false,
        icon: ArrowUpRight,
        colorClass: 'text-purple-600 font-bold',
      };
    }

    const isCredit = type === 'CREDIT' || entryType === 'ORDER_CREDIT';
    switch (entryType) {
      case 'ORDER_CREDIT':
        return {
          label: 'إيداع إلكتروني',
          isCredit: true,
          icon: ArrowDownRight,
          colorClass: 'text-emerald-600 font-bold',
        };
      case 'PLATFORM_FEE_DEBIT':
        return {
          label: 'خصم عمولة المنصة',
          isCredit: false,
          icon: ArrowUpRight,
          colorClass: 'text-purple-600 font-bold',
        };
      case 'PAYOUT_DEBIT':
        return {
          label: 'سحب أرباح للتاجر',
          isCredit: false,
          icon: ArrowUpRight,
          colorClass: 'text-rose-600 font-bold',
        };
      case 'REFUND_DEBIT':
        return {
          label: 'خصم استرجاع طلب',
          isCredit: false,
          icon: ArrowUpRight,
          colorClass: 'text-rose-600 font-bold',
        };
      default:
        return {
          label: entryType || 'حركة مالية',
          isCredit,
          icon: isCredit ? ArrowDownRight : ArrowUpRight,
          colorClass: isCredit ? 'text-emerald-600' : 'text-slate-800',
        };
    }
  };

  // Helper: Payout Method Type Display
  const renderMethodIcon = (type: PayoutMethodType) => {
    switch (type) {
      case 'BANK_ACCOUNT':
        return <Building className="w-5 h-5 text-blue-600" />;
      case 'VODAFONE_CASH':
        return <Smartphone className="w-5 h-5 text-rose-600" />;
      case 'INSTAPAY':
        return <Zap className="w-5 h-5 text-purple-600" />;
    }
  };

  const getMethodTypeTitle = (type: PayoutMethodType) => {
    switch (type) {
      case 'BANK_ACCOUNT':
        return 'حساب بنكي';
      case 'VODAFONE_CASH':
        return 'محفظة إلكترونية';
      case 'INSTAPAY':
        return 'إنستاباي (InstaPay)';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200/80 shadow-sm text-center">
        <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <h3 className="text-sm font-bold text-slate-800 mb-1">جاري تحميل المحفظة ودفتر الأستاذ...</h3>
        <p className="text-xs text-slate-400">نستعلم عن أرصدة الضمان والعمليات المالية لـ {entity?.tradeName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                المحفظة والأرباح (Seller Payouts & Escrow Ledger)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                إدارة مستحقات المتجر، متابعة قيود دفتر الأستاذ (Immutable Ledger)، وتنفيذ سحب الأرباح فورياً.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={() => setIsPayoutModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md shadow-emerald-500/20 text-xs transition-all active:scale-[0.98]"
          >
            <ArrowDownToLine className="w-4 h-4" />
            طلب سحب الأرباح
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Stat Cards Grid (4 Cards: Available, Pending Escrow, Platform COD Dues, Total Withdrawn) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Available Balance */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-white to-teal-500/5 p-6 rounded-3xl border border-emerald-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-emerald-800 tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              الرصيد المتاح للسحب
            </span>
            <div className="w-10 h-10 bg-emerald-100/80 text-emerald-700 rounded-2xl flex items-center justify-center shadow-sm">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="my-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-950 tracking-tight">
                {balance.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-emerald-700">ج.م</span>
            </div>
            <p className="text-[11px] text-emerald-800/80 mt-1 font-medium">
              أرباح المبيعات الإلكترونية الجاهزة للتحويل الفوري لحسابك البنكي أو محفظتك.
            </p>
          </div>

          <button
            onClick={() => setIsPayoutModalOpen(true)}
            disabled={balance.availableBalance <= 0}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs transition-colors shadow-sm"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            سحب الرصيد الآن
          </button>
        </div>

        {/* Card 2: Pending Escrow Balance */}
        <div className="bg-gradient-to-br from-amber-500/10 via-white to-yellow-500/5 p-6 rounded-3xl border border-amber-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-amber-800 tracking-wide flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              الرصيد المعلق في الضمان
            </span>
            <div className="w-10 h-10 bg-amber-100/80 text-amber-700 rounded-2xl flex items-center justify-center shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
          </div>

          <div className="my-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-950 tracking-tight">
                {balance.pendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-amber-700">ج.م</span>
            </div>
            <div className="mt-2 p-2 bg-amber-100/50 rounded-xl border border-amber-200/60 text-[10px] text-amber-800 flex items-start gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>للطلبات الإلكترونية: يُحرر تلقائياً فور استلام العميل وتأكيد التسليم.</span>
            </div>
          </div>

          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between pt-2 border-t border-amber-100">
            <span>حماية المعاملات</span>
            <span className="text-amber-700 font-bold">حساب وسيط (Escrow)</span>
          </div>
        </div>

        {/* Card 3: Platform Dues (COD Commissions) */}
        <div className="bg-gradient-to-br from-purple-500/10 via-white to-indigo-500/5 p-6 rounded-3xl border border-purple-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-purple-900 tracking-wide flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              عمولات المنصة (COD)
            </span>
            <div className="w-10 h-10 bg-purple-100/80 text-purple-700 rounded-2xl flex items-center justify-center shadow-sm">
              <Building className="w-5 h-5" />
            </div>
          </div>

          <div className="my-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-950 tracking-tight">
                {(balance.platformDues || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-purple-700">ج.م</span>
            </div>
            <div className="mt-2 p-2 bg-purple-50 rounded-xl border border-purple-200/60 text-[10px] text-purple-800 flex items-start gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-purple-600 flex-shrink-0 mt-0.5" />
              <span>مبيعات الكاش حصّلها التاجر مباشرة، وتُقتطع عمولة المنصة من أي رصيد متاح.</span>
            </div>
          </div>

          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between pt-2 border-t border-purple-100">
            <span>حالة العمولات</span>
            <span className={`font-bold ${(balance.platformDues || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {(balance.platformDues || 0) > 0 ? 'مستحقة السداد/الخصم' : 'مسواة بالكامل'}
            </span>
          </div>
        </div>

        {/* Card 4: Total Withdrawn */}
        <div className="bg-gradient-to-br from-blue-500/10 via-white to-cyan-500/5 p-6 rounded-3xl border border-blue-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-blue-800 tracking-wide">
              إجمالي المبالغ المسحوبة
            </span>
            <div className="w-10 h-10 bg-blue-100/80 text-blue-700 rounded-2xl flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="my-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-950 tracking-tight">
                {balance.withdrawnBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-blue-700">ج.م</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              مجموع الأرباح المسددة والمسواة بحساباتك بنجاح منذ إنشاء المتجر.
            </p>
          </div>

          <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between pt-2 border-t border-blue-100">
            <span>عمليات التحويل</span>
            <span className="text-blue-700 font-bold">
              {payoutHistory.filter((p) => p.status === 'COMPLETED').length} عملية سحب
            </span>
          </div>
        </div>
      </div>

      {/* COD Notice Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/70 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <span className="font-extrabold block text-amber-950 mb-0.5">
            سياسة تسوية مبيعات الدفع عند الاستلام (COD):
          </span>
          طلبات الدفع عند الاستلام يتم تحصيل قيمتها بالكامل نقداً بواسطة التاجر أو مندوب الشحن مباشرة عند التسليم، وبالتالي لا تضاف قيمتها لخزينة المنصة أو خانة الرصيد المتاح للسحب. تقوم المنصة بتسجيل نسبة عمولتها المستحقة كخصم يُسوّى تلقائياً من أرباحك الإلكترونية أو تظهر في خانة "عمولات المنصة (COD)".
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-2">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'ledger'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          دفتر الأستاذ وسجل الحركات المالية
        </button>

        <button
          onClick={() => setActiveTab('payouts')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'payouts'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          سجل طلبات السحب ({payoutHistory.length})
        </button>

        <button
          onClick={() => setActiveTab('methods')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'methods'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Settings className="w-4 h-4" />
          طرق ووسائل السحب ({payoutMethods.length})
        </button>
      </div>

      {/* Tab 1: Interactive Ledger Table */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                دفتر الحسابات القياسي (Immutable Double-Entry Ledger)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                سجل حسابات غير قابل للتعديل يوثق جميع قيود المبيعات والعمولات والسحوبات بدقة متناهية.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold px-2 flex items-center gap-1">
                <Filter className="w-3 h-3" /> تصفية:
              </span>
              {[
                { key: 'ALL', label: 'الكل' },
                { key: 'HELD_ESCROW', label: 'الضمان المعلق' },
                { key: 'AVAILABLE', label: 'المتاح للسحب' },
                { key: 'SETTLED', label: 'المسوّى' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => {
                    setLedgerStatusFilter(f.key);
                    setLedgerPage(1);
                  }}
                  className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-colors ${
                    ledgerStatusFilter === f.key
                      ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loadingLedger ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mb-2" />
              <p className="text-xs text-slate-400">جاري تحميل حركات الدفتر...</p>
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-slate-700">لا توجد حركات مالية مسجلة في هذا التصنيف</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                ستظهر القيود المالية تلقائياً فور إتمام وتأكيد طلبات الشراء.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
                    <th className="p-3.5">التاريخ والوقت</th>
                    <th className="p-3.5">نوع الحركة</th>
                    <th className="p-3.5">رقم الطلب / المرجع</th>
                    <th className="p-3.5">الوصف والبيان</th>
                    <th className="p-3.5">المبلغ</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">الرصيد بعد الحركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {ledgerEntries.map((entry) => {
                    const typeInfo = getEntryTypeDetails(entry.entryType, entry.type, entry);
                    const TypeIcon = typeInfo.icon;
                    return (
                      <tr key={entry._id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 text-slate-500 whitespace-nowrap">
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleDateString('ar-EG', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 font-bold">
                            <TypeIcon
                              className={`w-3.5 h-3.5 ${
                                typeInfo.isCredit ? 'text-emerald-500' : 'text-purple-500'
                              }`}
                            />
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {entry.orderId?.orderNumber ? (
                            <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold">
                              #{entry.orderId.orderNumber}
                            </span>
                          ) : entry.reference ? (
                            <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                              {entry.reference}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-600 max-w-xs truncate" title={entry.description}>
                          {entry.description}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          {entry.amount === 0 ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                              <Smartphone className="w-3 h-3 text-amber-600" />
                              كاش مع التاجر
                            </span>
                          ) : (
                            <span
                              className={`font-black tracking-tight text-sm ${
                                typeInfo.isCredit ? 'text-emerald-600' : 'text-slate-800'
                              }`}
                            >
                              {typeInfo.isCredit ? '+' : '-'}
                              {Math.abs(entry.amount || 0)?.toLocaleString()} {entry.currency || 'ج.م'}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">{renderLedgerStatusBadge(entry.status)}</td>
                        <td className="p-3.5 whitespace-nowrap font-mono font-bold text-slate-700">
                          {entry.balanceAfter !== undefined && entry.balanceAfter !== null
                            ? `${entry.balanceAfter.toLocaleString()} ج.م`
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {ledgerTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-400 font-semibold">
                    عرض الصفحة {ledgerPage} من أصل {ledgerTotalPages} (إجمالي {ledgerTotal} قيد)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                      disabled={ledgerPage === 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      السابق
                    </button>
                    <button
                      onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))}
                      disabled={ledgerPage === ledgerTotalPages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      التالي
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Payout Requests History */}
      {activeTab === 'payouts' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                سجل طلبات ودفعات السحب (Payouts History)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                متابعة دورة تحويل الأرباح لحسابك البنكي، محفظتك الإلكترونية، أو إنستاباي.
              </p>
            </div>
            <button
              onClick={() => setIsPayoutModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              طلب سحب جديد
            </button>
          </div>

          {payoutHistory.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-slate-700">لم تقم بإجراء أي طلبات سحب حتى الآن</h4>
              <p className="text-[11px] text-slate-400 mt-1">
                عند وصول رصيدك المتاح إلى 500 ج.م أو أكثر، يمكنك طلب سحب أرباحك فوراً.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
                    <th className="p-3.5">تاريخ الطلب</th>
                    <th className="p-3.5">رقم المرجع (Gateway Ref)</th>
                    <th className="p-3.5">المبلغ المطلوب</th>
                    <th className="p-3.5">وسيلة السحب</th>
                    <th className="p-3.5">حالة التحويل</th>
                    <th className="p-3.5">تاريخ المعالجة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {payoutHistory.map((payout) => (
                    <tr key={payout._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {payout.requestedAt
                          ? new Date(payout.requestedAt).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {payout.gatewayReference || payout._id}
                      </td>
                      <td className="p-3.5 font-black text-slate-900 text-sm whitespace-nowrap">
                        {payout.amount?.toLocaleString()} ج.م
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {renderMethodIcon(payout.payoutMethodSnapshot?.type || 'BANK_ACCOUNT')}
                          <span className="text-xs font-bold text-slate-700">
                            {getMethodTypeTitle(payout.payoutMethodSnapshot?.type || 'BANK_ACCOUNT')}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {payout.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            تم التحويل بنجاح
                          </span>
                        ) : payout.status === 'PROCESSING' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                            جاري المعالجة
                          </span>
                        ) : payout.status === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <X className="w-3 h-3 text-rose-500" />
                            مرفوض
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            قيد الانتظار
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {payout.processedAt
                          ? new Date(payout.processedAt).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'فوري'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payout Methods Settings */}
      {activeTab === 'methods' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                طرق سحب الأرباح المسجلة (Payout Accounts)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                أضف حسابك البنكي، محفظتك الإلكترونية، أو حساب إنستاباي لاستلام أموالك مباشرة.
              </p>
            </div>
            <button
              onClick={() => setIsAddMethodModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة طريقة سحب جديدة
            </button>
          </div>

          {payoutMethods.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Building className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-slate-700">لم تقم بإضافة أي طريقة سحب بعد</h4>
              <p className="text-[11px] text-slate-400 mt-1 mb-4">
                أضف حسابك البنكي أو محفظتك لتتمكن من سحب أرباحك عند اكتمال الطلبات.
              </p>
              <button
                onClick={() => setIsAddMethodModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة وسيلة سحب الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {payoutMethods.map((pm) => (
                <div
                  key={pm._id}
                  className={`p-5 rounded-2xl border transition-all relative ${
                    pm.isDefault
                      ? 'bg-blue-50/50 border-blue-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                        {renderMethodIcon(pm.type)}
                      </div>
                      <span className="font-extrabold text-xs text-slate-900">{getMethodTypeTitle(pm.type)}</span>
                    </div>

                    {pm.isDefault ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                        <Check className="w-3 h-3" /> الافتراضية
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(pm._id)}
                        className="text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-100 px-2 py-0.5 rounded-md transition-colors"
                      >
                        تعيين كافتراضية
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    {pm.type === 'BANK_ACCOUNT' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-400">صاحب الحساب:</span>
                          <span className="font-bold text-slate-800">{pm.details.accountHolderName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">البنك:</span>
                          <span className="font-bold text-slate-800">{pm.details.bankName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">رقم IBAN:</span>
                          <span className="font-mono font-bold text-slate-700 text-[11px] dir-ltr text-right">
                            {pm.details.iban}
                          </span>
                        </div>
                      </>
                    )}

                    {pm.type === 'VODAFONE_CASH' && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">رقم المحفظة:</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{pm.details.walletNumber}</span>
                      </div>
                    )}

                    {pm.type === 'INSTAPAY' && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">عنوان إنستاباي:</span>
                        <span className="font-mono font-bold text-purple-700 text-xs">
                          {pm.details.instaPayAddress}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Request Payout */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
                  <ArrowDownToLine className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-base">طلب سحب الأرباح</h3>
                  <p className="text-xs text-emerald-100">تحويل فوري إلى وسيلة الدفع المعتمدة</p>
                </div>
              </div>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <form onSubmit={handleRequestPayout} className="p-6 space-y-5">
              {payoutFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{payoutFormError}</span>
                </div>
              )}

              {payoutSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{payoutSuccessMsg}</span>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">المبلغ المطلوب سحبه (ج.م) *</label>
                  <span className="text-[11px] font-bold text-emerald-600">
                    المتاح: {balance.availableBalance.toLocaleString()} ج.م
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="500"
                    max={balance.availableBalance}
                    step="any"
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="أدخل المبلغ (الحد الأدنى 500 ج.م)"
                    className="w-full text-lg font-black pr-4 pl-14 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ج.م
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                  <span>الحد الأدنى للسحب: 500 ج.م</span>
                  <button
                    type="button"
                    onClick={() => setPayoutAmount(balance.availableBalance.toString())}
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    سحب كامل الرصيد المتاح
                  </button>
                </div>
              </div>

              {/* Payout Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">اختر وسيلة السحب *</label>
                {payoutMethods.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
                    <p className="text-xs font-bold text-amber-800">لا توجد وسيلة سحب مسجلة حتى الآن</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPayoutModalOpen(false);
                        setIsAddMethodModalOpen(true);
                      }}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      + أضف وسيلة سحب الآن
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {payoutMethods.map((method) => (
                      <label
                        key={method._id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          selectedMethodId === method._id
                            ? 'bg-emerald-50/60 border-emerald-500 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payoutMethod"
                            value={method._id}
                            checked={selectedMethodId === method._id}
                            onChange={(e) => setSelectedMethodId(e.target.value)}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                            {renderMethodIcon(method.type)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              {getMethodTypeTitle(method.type)}
                              {method.isDefault && (
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">
                                  افتراضية
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {method.type === 'BANK_ACCOUNT' && `${method.details.bankName} - ${method.details.iban}`}
                              {method.type === 'VODAFONE_CASH' && method.details.walletNumber}
                              {method.type === 'INSTAPAY' && method.details.instaPayAddress}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Commission notice */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-medium text-slate-600">
                <span>رسوم السحب والتحويل:</span>
                <span className="text-emerald-700 font-bold">مجاناً (بدون رسوم سحب)</span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingPayout || payoutMethods.length === 0}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingPayout ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري معالجة التحويل...
                    </>
                  ) : (
                    'تأكيد وتنفيذ السحب'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Payout Method */}
      {isAddMethodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/30 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-black text-base">إضافة وسيلة سحب أرباح</h3>
                  <p className="text-xs text-slate-400">اختر طريقة السحب المناسبة وأدخل البيانات المعتمدة</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddMethodModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <form onSubmit={handleAddMethod} className="p-6 space-y-4">
              {methodFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{methodFormError}</span>
                </div>
              )}

              {/* Method Type Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">نوع وسيلة السحب *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'BANK_ACCOUNT', label: 'حساب بنكي', icon: Building },
                    { key: 'VODAFONE_CASH', label: 'محفظة إلكترونية', icon: Smartphone },
                    { key: 'INSTAPAY', label: 'إنستاباي (InstaPay)', icon: Zap },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = newMethodType === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setNewMethodType(m.key as PayoutMethodType)}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="text-[11px] font-bold">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Form Fields */}
              {newMethodType === 'BANK_ACCOUNT' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم صاحب الحساب الرباعي *</label>
                    <input
                      type="text"
                      required
                      value={bankHolderName}
                      onChange={(e) => setBankHolderName(e.target.value)}
                      placeholder="كما هو مسجل في البنك بالضبط"
                      className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم البنك *</label>
                      <input
                        type="text"
                        required
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="مثال: البنك الأهلي المصري"
                        className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رمز السويفت (SWIFT / BIC)</label>
                      <input
                        type="text"
                        value={bankSwift}
                        onChange={(e) => setBankSwift(e.target.value)}
                        placeholder="اختياري (مثل: NBEGEGCX)"
                        className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رقم الحساب الدولي (IBAN) *</label>
                    <input
                      type="text"
                      required
                      value={bankIban}
                      onChange={(e) => setBankIban(e.target.value)}
                      placeholder="EGxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-mono dir-ltr text-right"
                    />
                  </div>
                </div>
              )}

              {newMethodType === 'VODAFONE_CASH' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رقم المحفظة الإلكترونية *</label>
                    <input
                      type="tel"
                      required
                      maxLength={11}
                      value={walletNumber}
                      onChange={(e) => setWalletNumber(e.target.value)}
                      placeholder="010xxxxxxxx أو 011 أو 012 أو 015"
                      className="w-full text-sm font-black px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      يدعم فودافون كاش، أورنج كاش، اتصالات كاش، ومحفظة وي باي (11 رقماً).
                    </p>
                  </div>
                </div>
              )}

              {newMethodType === 'INSTAPAY' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عنوان إنستاباي (InstaPay IPA / Mobile) *</label>
                    <input
                      type="text"
                      required
                      value={instaPayAddress}
                      onChange={(e) => setInstaPayAddress(e.target.value)}
                      placeholder="username@instapay أو رقم الهاتف المسجل"
                      className="w-full text-sm font-black px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      سيتم تحويل الأرباح مباشرة عبر شبكة المدفوعات اللحظية (IPN).
                    </p>
                  </div>
                </div>
              )}

              {/* Set as Default Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(e) => setMakeDefault(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-700">تعيين هذه الوسيلة كطريقة سحب افتراضية</span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddMethodModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingMethod}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingMethod ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    'حفظ وسيلة السحب'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorPayoutsPage;
