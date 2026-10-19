import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Landmark,
  Lock,
  Unlock,
  CheckCircle2,
  DollarSign,
  Send,
  AlertCircle,
  Loader2,
  BarChart3,
  Download,
  Printer,
  Calendar,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Zap,
  TrendingDown,
  Clock,
  Award,
} from 'lucide-react';
import adminApi from '../../../api/adminApi';
import type {
  EscrowLedgerItem,
  VendorPayoutSummary,
  SellingEntityAdmin,
  VendorReportFullData,
} from '../../../types/admin';

export const AdminFinancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ESCROW' | 'PAYOUTS' | 'REPORTS'>('ESCROW');

  // Filter & Selected Merchant state
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  // Report Period States
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'month' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);

  // 1. Fetch Escrow Ledgers
  const { data: escrows = [], isLoading: isLoadingEscrows } = useQuery<EscrowLedgerItem[]>({
    queryKey: ['adminEscrowLedgers'],
    queryFn: () => adminApi.getEscrowLedgers(),
  });

  // 2. Fetch Entities list to pick for payout summary & reports
  const { data: entities = [] } = useQuery<SellingEntityAdmin[]>({
    queryKey: ['sellingEntitiesForFinance'],
    queryFn: () => adminApi.getSellingEntities(),
  });

  // 3. Fetch Selected Seller Financial Summary
  const {
    data: sellerSummary,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = useQuery<VendorPayoutSummary>({
    queryKey: ['sellerFinancialSummary', selectedEntityId],
    queryFn: () => adminApi.getSellerFinancialSummary(selectedEntityId),
    enabled: !!selectedEntityId,
  });

  // 4. Fetch Full Report & Decision Analytics
  const {
    data: reportData,
    isLoading: isLoadingReport,
    refetch: refetchReport,
  } = useQuery<VendorReportFullData>({
    queryKey: [
      'vendorFullReport',
      selectedEntityId,
      selectedPeriod,
      selectedPeriod === 'custom' ? customStartDate : '',
      selectedPeriod === 'custom' ? customEndDate : '',
    ],
    queryFn: () =>
      adminApi.getVendorReport(selectedEntityId, {
        period: selectedPeriod,
        startDate: selectedPeriod === 'custom' ? customStartDate : undefined,
        endDate: selectedPeriod === 'custom' ? customEndDate : undefined,
      }),
    enabled: !!selectedEntityId && activeTab === 'REPORTS',
  });

  // Manual Escrow Release Mutation
  const releaseEscrowMutation = useMutation({
    mutationFn: (entityOrderId: string) => adminApi.releaseEscrow(entityOrderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEscrowLedgers'] });
      if (selectedEntityId) {
        refetchSummary();
        refetchReport();
      }
    },
  });

  // Process Vendor Payout Mutation
  const processPayoutMutation = useMutation({
    mutationFn: (sellingEntityId: string) => adminApi.processVendorPayout(sellingEntityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEscrowLedgers'] });
      if (selectedEntityId) {
        refetchSummary();
        refetchReport();
      }
    },
  });

  const handleDownloadCsv = async () => {
    if (!selectedEntityId) return;
    try {
      setIsDownloadingCsv(true);
      await adminApi.downloadVendorReportCsv(selectedEntityId, {
        period: selectedPeriod,
        startDate: selectedPeriod === 'custom' ? customStartDate : undefined,
        endDate: selectedPeriod === 'custom' ? customEndDate : undefined,
      });
    } catch (err) {
      console.error('Failed to download CSV report', err);
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const getEscrowStatusBadge = (status: string) => {
    switch (status) {
      case 'HELD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Lock className="w-3.5 h-3.5" /> محتجز (HELD)
          </span>
        );
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> محرر (RELEASED)
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" /> مسترد (REFUNDED)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-amber-400" />
            التسويات المالية والـ Escrow والتقارير الذكية
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            مراقبة دفتر الأستاذ، أرصدة الضمان المحتجزة، تسويات التجار، والتحليلات الذكية لدعم اتخاذ القرار.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <button
          onClick={() => setActiveTab('ESCROW')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'ESCROW'
              ? 'bg-slate-900 text-amber-400 shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>قيود الضمان (Escrow Ledgers)</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYOUTS')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'PAYOUTS'
              ? 'bg-slate-900 text-amber-400 shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>تسويات ودفعات التجار (Vendor Payouts)</span>
        </button>

        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'REPORTS'
              ? 'bg-slate-900 text-amber-400 shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>التقارير المالية ومحرك اتخاذ القرار (Analytics & Reports)</span>
        </button>
      </div>

      {/* TAB 1: ESCROW LEDGERS */}
      {activeTab === 'ESCROW' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">سجل قيود الضمان المركزية</h3>
              <p className="text-xs text-slate-400">إجمالي القيود المسجلة: {escrows.length}</p>
            </div>
          </div>

          {isLoadingEscrows ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
              <span className="text-xs font-bold text-slate-500">جاري تحميل قيود الـ Escrow...</span>
            </div>
          ) : escrows.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs font-medium">
              لا توجد قيود escrow مسجلة في النظام حالياً.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">معرف الطلب الفرعي</th>
                    <th className="py-3.5 px-4">الكيان التجاري</th>
                    <th className="py-3.5 px-4">المبلغ الإجمالي</th>
                    <th className="py-3.5 px-4">عمولة المنصة</th>
                    <th className="py-3.5 px-4">صافي التاجر</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4 text-center">إجراء طارئ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {escrows.map((escrow) => (
                    <tr key={escrow._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        #{escrow.entityOrderId.substring(0, 10)}...
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {escrow.sellingEntityId.substring(0, 10)}...
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {escrow.grossAmount.toLocaleString()} ج.م
                      </td>
                      <td className="py-3.5 px-4 font-bold text-blue-600">
                        {escrow.platformFee.toLocaleString()} ج.م
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600">
                        {escrow.netAmount.toLocaleString()} ج.م
                      </td>
                      <td className="py-3.5 px-4">{getEscrowStatusBadge(escrow.status)}</td>
                      <td className="py-3.5 px-4 text-center">
                        {escrow.status === 'HELD' ? (
                          <button
                            onClick={() => releaseEscrowMutation.mutate(escrow.entityOrderId)}
                            disabled={releaseEscrowMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors shadow-sm"
                            title="تحرير المبلغ يدوياً لصالح التاجر"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>تحرير طارئ</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">محرر مسبقاً</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VENDOR PAYOUTS & SUMMARIES */}
      {activeTab === 'PAYOUTS' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-500" />
              <span>استعلام وتسوية مستحقات كيان تجاري (دفتر الأستاذ الحي)</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full sm:w-96 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- اختر المتجر أو الكيان التجاري --</option>
                {entities.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.tradeName} ({e.type === 'COMPANY' ? 'شركة' : 'تاجر مستقل'}) - ID: {e._id.substring(0, 8)}...
                  </option>
                ))}
              </select>

              <div className="text-xs text-slate-400">
                اختر الكيان لعرض رصيده المتاح للصرف بعد خصم المرتجعات والعمولات.
              </div>
            </div>
          </div>

          {selectedEntityId && (
            <div className="space-y-6">
              {isLoadingSummary ? (
                <div className="bg-white rounded-2xl p-12 text-center flex flex-col items-center justify-center border border-slate-200">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                  <span className="text-xs font-bold text-slate-500">جاري حساب الملخص المالي للتاجر...</span>
                </div>
              ) : sellerSummary ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-bold">إجمالي المبيعات (Gross Sales)</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        {sellerSummary.summary.totalGrossSales.toLocaleString()} ج.م
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-bold">عمولات المنصة المستقطعة</div>
                      <div className="text-2xl font-black text-blue-600 mt-1">
                        {sellerSummary.summary.totalPlatformFees.toLocaleString()} ج.م
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-bold">رصيد الضمان المعلق (Held Escrow)</div>
                      <div className="text-2xl font-black text-amber-600 mt-1">
                        {sellerSummary.summary.heldEscrowBalance.toLocaleString()} ج.م
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm bg-emerald-50/50 border-emerald-200">
                      <div className="text-xs text-emerald-800 font-bold">الرصيد المتاح للصرف (Available Payout)</div>
                      <div className="text-2xl font-black text-emerald-600 mt-1">
                        {sellerSummary.summary.availablePayoutBalance.toLocaleString()} ج.م
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        إصدار تحويل مالي ودفع المستحقات (Process Payout Batch)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        سيتم تجميع كافة مبالغ الـ Escrow المحررة لحساب التاجر وإصدار دفعة Payout رسمية بعد موازنة عمولات الـ COD.
                      </p>
                    </div>

                    <button
                      onClick={() => processPayoutMutation.mutate(selectedEntityId)}
                      disabled={
                        processPayoutMutation.isPending ||
                        sellerSummary.summary.availablePayoutBalance <= 0
                      }
                      className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                        sellerSummary.summary.availablePayoutBalance > 0
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {processPayoutMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>إصدار تحويل بقيمة {sellerSummary.summary.availablePayoutBalance.toLocaleString()} ج.م</span>
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-3">
                    <h4 className="font-bold text-slate-900 text-sm">أرشيف التحويلات المالية الصادرة للتاجر</h4>
                    {sellerSummary.payoutHistory.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        لم يتم إصدار أي تحويلات Payout سابقة لهذا الكيان.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-3 px-4">رقم دفعة التحويل</th>
                              <th className="py-3 px-4">المبلغ المستحول</th>
                              <th className="py-3 px-4">عدد العمليات المضمنة</th>
                              <th className="py-3 px-4">الحالة</th>
                              <th className="py-3 px-4">تاريخ المعالجة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {sellerSummary.payoutHistory.map((payout) => (
                              <tr key={payout._id} className="hover:bg-slate-50">
                                <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                  #{payout._id}
                                </td>
                                <td className="py-3 px-4 font-bold text-emerald-600">
                                  {payout.totalAmount.toLocaleString()} ج.م
                                </td>
                                <td className="py-3 px-4 font-mono">{payout.escrowIds?.length || 0} قيود</td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {payout.status || 'PAID'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-500 text-[11px]">
                                  {payout.processedAt
                                    ? new Date(payout.processedAt).toLocaleString('ar-EG')
                                    : 'غير محدد'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REPORTS & DECISION-MAKING ANALYTICS */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-6">
          {/* Vendor Selector & Filter Controls */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <span>نظام تقارير التجار ومحرك التحليلات الذكية</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  فلترة مالية زمنية وتقييم ذكي لمعدلات الارتجاع، مديونية الـ COD، وسرعة تسليم الطلبات لاتخاذ القرارات.
                </p>
              </div>

              {/* Action Buttons: Export CSV & Print PDF */}
              {selectedEntityId && reportData && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadCsv}
                    disabled={isDownloadingCsv}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                  >
                    {isDownloadingCsv ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 text-amber-400" />
                    )}
                    <span>تصدير CSV</span>
                  </button>

                  <button
                    onClick={handlePrintPdf}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة PDF</span>
                  </button>
                </div>
              )}
            </div>

            {/* Merchant and Time Window Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">اختر الكيان التجاري</label>
                <select
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- اختر المتجر أو التاجر --</option>
                  {entities.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.tradeName} ({e.type === 'COMPANY' ? 'شركة' : 'تاجر مستقل'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">الفترة الزمنية</label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod('day')}
                    className={`py-1.5 rounded-lg transition-all ${
                      selectedPeriod === 'day' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:bg-slate-200'
                    }`}
                  >
                    اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod('month')}
                    className={`py-1.5 rounded-lg transition-all ${
                      selectedPeriod === 'month' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:bg-slate-200'
                    }`}
                  >
                    هذا الشهر
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod('year')}
                    className={`py-1.5 rounded-lg transition-all ${
                      selectedPeriod === 'year' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:bg-slate-200'
                    }`}
                  >
                    هذا العام
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod('custom')}
                    className={`py-1.5 rounded-lg transition-all ${
                      selectedPeriod === 'custom' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:bg-slate-200'
                    }`}
                  >
                    مخصص
                  </button>
                </div>
              </div>

              {selectedPeriod === 'custom' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">من تاريخ</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">إلى تاريخ</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {!selectedEntityId ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 text-xs font-bold border border-slate-200">
              يرجى اختيار متجر أو كيان تجاري من القائمة أعلاه لعرض التقارير والتحليلات الذكية.
            </div>
          ) : isLoadingReport ? (
            <div className="bg-white rounded-2xl p-12 text-center flex flex-col items-center justify-center border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
              <span className="text-xs font-bold text-slate-500">جاري تجميع بيانات التقرير والتحليلات الذكية...</span>
            </div>
          ) : reportData ? (
            <div className="space-y-6">
              {/* SECTION 1: SMART DECISION-MAKING ENGINE CARDS */}
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>محرك التحليلات الذكية والتوجيه الإداري (Decision-Making Cards)</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* CARD 1: Return Rate */}
                  <div
                    className={`p-5 rounded-2xl border transition-all ${
                      reportData.decisionAnalytics.returnRate.isAlert
                        ? 'bg-rose-50/70 border-rose-200 shadow-sm'
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                        1. معدل الارتجاع (Return Rate)
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          reportData.decisionAnalytics.returnRate.isAlert
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {reportData.decisionAnalytics.returnRate.badge}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="text-3xl font-black text-slate-900">
                        {reportData.decisionAnalytics.returnRate.ratePercentage}%
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {reportData.decisionAnalytics.returnRate.returnOrders} طلب مرتجع من إجمالي{' '}
                        {reportData.decisionAnalytics.returnRate.totalOrders} طلب
                      </p>
                    </div>

                    <div
                      className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${
                        reportData.decisionAnalytics.returnRate.isAlert
                          ? 'bg-rose-100/80 text-rose-900 border border-rose-200'
                          : 'bg-slate-50 text-slate-700 border border-slate-100'
                      }`}
                    >
                      {reportData.decisionAnalytics.returnRate.isAlert ? (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-extrabold text-[11px]">القرار الإداري المقترح:</div>
                        <div className="mt-0.5 leading-relaxed">
                          {reportData.decisionAnalytics.returnRate.decision}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: COD Debt Index */}
                  <div
                    className={`p-5 rounded-2xl border transition-all ${
                      reportData.decisionAnalytics.codDebt.isAlert
                        ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                        2. مؤشر مديونية الـ COD
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          reportData.decisionAnalytics.codDebt.isAlert
                            ? 'bg-amber-600 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {reportData.decisionAnalytics.codDebt.badge}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="text-3xl font-black text-slate-900">
                        {reportData.decisionAnalytics.codDebt.outstandingCodDebt.toLocaleString()} ج.م
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        عمولات COD مستحقة:{' '}
                        {reportData.decisionAnalytics.codDebt.totalCodPlatformFees.toLocaleString()} ج.م
                      </p>
                    </div>

                    <div
                      className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${
                        reportData.decisionAnalytics.codDebt.isAlert
                          ? 'bg-amber-100 text-amber-950 border border-amber-300'
                          : 'bg-slate-50 text-slate-700 border border-slate-100'
                      }`}
                    >
                      {reportData.decisionAnalytics.codDebt.isAlert ? (
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-extrabold text-[11px]">القرار الإداري المقترح:</div>
                        <div className="mt-0.5 leading-relaxed">
                          {reportData.decisionAnalytics.codDebt.decision}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CARD 3: Fulfillment Velocity */}
                  <div
                    className={`p-5 rounded-2xl border transition-all ${
                      reportData.decisionAnalytics.fulfillmentVelocity.isTopSellerPriority
                        ? 'bg-indigo-50/70 border-indigo-200 shadow-sm'
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        3. سرعة تنفيذ وتسليم الطلبات
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          reportData.decisionAnalytics.fulfillmentVelocity.isTopSellerPriority
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {reportData.decisionAnalytics.fulfillmentVelocity.badge}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="text-3xl font-black text-slate-900">
                        {reportData.decisionAnalytics.fulfillmentVelocity.averageDeliveryHours} ساعة
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        متوسط: {reportData.decisionAnalytics.fulfillmentVelocity.averageDeliveryDays} يوم (بين التأكيد
                        والتسليم)
                      </p>
                    </div>

                    <div
                      className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${
                        reportData.decisionAnalytics.fulfillmentVelocity.isTopSellerPriority
                          ? 'bg-indigo-100 text-indigo-950 border border-indigo-200'
                          : 'bg-slate-50 text-slate-700 border border-slate-100'
                      }`}
                    >
                      {reportData.decisionAnalytics.fulfillmentVelocity.isTopSellerPriority ? (
                        <Award className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-extrabold text-[11px]">القرار الإداري المقترح:</div>
                        <div className="mt-0.5 leading-relaxed">
                          {reportData.decisionAnalytics.fulfillmentVelocity.decision}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: TIME-FILTERED FINANCIAL REPORT */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>تقرير الفترة المحددة: {reportData.periodReport.tradeName}</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      من {new Date(reportData.periodReport.startDate).toLocaleDateString('ar-EG')} إلى{' '}
                      {new Date(reportData.periodReport.endDate).toLocaleDateString('ar-EG')}
                    </p>
                  </div>

                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-bold text-xs">
                    العملة: {reportData.periodReport.currency} (ج.م)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500">إجمالي المبيعات (Gross)</div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {reportData.periodReport.grossSales.toLocaleString()} ج.م
                    </div>
                  </div>

                  <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                    <div className="text-[11px] font-bold text-blue-700">عمولات المنصة</div>
                    <div className="text-xl font-extrabold text-blue-800 mt-1">
                      {reportData.periodReport.platformFees.toLocaleString()} ج.م
                    </div>
                  </div>

                  <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-100">
                    <div className="text-[11px] font-bold text-rose-700">المبالغ المستردة</div>
                    <div className="text-xl font-extrabold text-rose-800 mt-1">
                      {reportData.periodReport.totalRefundedAmount.toLocaleString()} ج.م
                    </div>
                  </div>

                  <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200">
                    <div className="text-[11px] font-bold text-emerald-800">صافي مستحقات التاجر</div>
                    <div className="text-xl font-extrabold text-emerald-700 mt-1">
                      {reportData.periodReport.netVendorEarnings.toLocaleString()} ج.م
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500">الطلبات المكتملة</div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {reportData.periodReport.completedOrdersCount} طلب
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500">عدد المرتجعات</div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {reportData.periodReport.refundsCount} عملية
                    </div>
                  </div>
                </div>

                {/* Period Orders Table */}
                <div className="pt-2">
                  <h5 className="font-bold text-slate-900 text-xs mb-3">تفاصيل طلبات الفترة ({reportData.periodReport.orders.length} طلب)</h5>
                  {reportData.periodReport.orders.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
                      لا توجد طلبات منفذة للتاجر في هذا النطاق الزمني.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                          <tr>
                            <th className="py-2.5 px-3">معرف الطلب</th>
                            <th className="py-2.5 px-3">المبلغ (ج.م)</th>
                            <th className="py-2.5 px-3">الحالة</th>
                            <th className="py-2.5 px-3">تاريخ الطلب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {reportData.periodReport.orders.slice(0, 15).map((o) => (
                            <tr key={o.entityOrderId} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                #{o.entityOrderId.substring(0, 10)}...
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-800">
                                {o.subtotal.toLocaleString()} ج.م
                              </td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {o.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-500 text-[11px]">
                                {o.createdAt ? new Date(o.createdAt).toLocaleString('ar-EG') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AdminFinancePage;
