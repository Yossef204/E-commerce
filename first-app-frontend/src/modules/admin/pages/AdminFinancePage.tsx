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
} from 'lucide-react';
import adminApi from '../../../api/adminApi';
import type { EscrowLedgerItem, VendorPayoutSummary, SellingEntityAdmin } from '../../../types/admin';

export const AdminFinancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ESCROW' | 'PAYOUTS'>('ESCROW');

  // Filter & Selected Merchant state for Payouts
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  // 1. Fetch Escrow Ledgers
  const { data: escrows = [], isLoading: isLoadingEscrows } = useQuery<EscrowLedgerItem[]>({
    queryKey: ['adminEscrowLedgers'],
    queryFn: () => adminApi.getEscrowLedgers(),
  });

  // 2. Fetch Entities list to pick for payout summary
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

  // Manual Escrow Release Mutation
  const releaseEscrowMutation = useMutation({
    mutationFn: (entityOrderId: string) => adminApi.releaseEscrow(entityOrderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEscrowLedgers'] });
      if (selectedEntityId) refetchSummary();
    },
  });

  // Process Vendor Payout Mutation
  const processPayoutMutation = useMutation({
    mutationFn: (sellingEntityId: string) => adminApi.processVendorPayout(sellingEntityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminEscrowLedgers'] });
      if (selectedEntityId) refetchSummary();
    },
  });

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
            التسويات المالية والـ Escrow والتدفقات النقدية
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            مراقبة القيود المالية، التحرير اليدوي لأرصدة الضمان المعلقة، وتنفيذ دفعات التجار.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
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
                      <td className="py-3.5 px-4 font-bold text-slate-900">${escrow.grossAmount}</td>
                      <td className="py-3.5 px-4 font-bold text-blue-600">${escrow.platformFee}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600">${escrow.netAmount}</td>
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
              <span>استعلام وتسوية مستحقات كيان تجاري</span>
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
                اختر الكيان لعرض رصيده المتاح للصرف وإجراء عملية تحويل Payout.
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
                      <div className="text-xs text-slate-500 font-bold">إجمالي المبيعات (Gross)</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        ${sellerSummary.summary.totalGrossSales}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-bold">عمولات المنصة المستقطعة</div>
                      <div className="text-2xl font-black text-blue-600 mt-1">
                        ${sellerSummary.summary.totalPlatformFees}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-xs text-slate-500 font-bold">رصيد الضمان المعلق (Held)</div>
                      <div className="text-2xl font-black text-amber-600 mt-1">
                        ${sellerSummary.summary.heldEscrowBalance}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm bg-emerald-50/50 border-emerald-200">
                      <div className="text-xs text-emerald-800 font-bold">الرصيد المتاح للصرف (Available Payout)</div>
                      <div className="text-2xl font-black text-emerald-600 mt-1">
                        ${sellerSummary.summary.availablePayoutBalance}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        إصدار تحويل مالي ودفع المستحقات (Process Payout Batch)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        سيتم تجميع كافة مبالغ الـ Escrow المحررة لحساب التاجر وإصدار دفعة Payout رسمية.
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
                      <span>إصدار تحويل بقيمة ${sellerSummary.summary.availablePayoutBalance}</span>
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
                                  ${payout.totalAmount}
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
    </div>
  );
};

export default AdminFinancePage;
