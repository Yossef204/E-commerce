import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Wallet,
  Lock,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import vendorApi from '../../../api/vendorApi';
import type { SellingEntity } from '../../../types/vendor';

interface FinancialSummaryData {
  summary: {
    totalGrossSales: number;
    totalPlatformFees: number;
    heldEscrowBalance: number;
    availablePayoutBalance: number;
    totalEscrowRecords: number;
    totalPayoutBatches: number;
  };
  payoutHistory: Array<{
    _id: string;
    totalAmount: number;
    status: string;
    payoutReference: string;
    processedAt?: string;
    createdAt?: string;
  }>;
}

export const VendorPayoutsPage: React.FC = () => {
  const { entity } = useOutletContext<{ entity: SellingEntity | null }>();
  const [data, setData] = useState<FinancialSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!entity?._id) return;
      try {
        setLoading(true);
        const res = await vendorApi.getFinancialSummary(entity._id);
        setData(res);
      } catch (err: any) {
        setError(err.response?.data?.message || 'فشل في تحميل المستحقات والسجل المالي');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [entity]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-xs text-slate-500 font-semibold">جاري تحضير دفتر الحسابات والمستحقات...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center shadow-sm">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-800">{error || 'لا توجد بيانات مالية متاحة'}</p>
      </div>
    );
  }

  const { summary, payoutHistory } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-blue-600" />
          المحفظة والمستحقات الماليّة (Payouts & Escrow)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          متابعة الأرباح، الأموال المحتجزة بحساب الضمان الاجتماعي، ودفعات المستحقات المحولة لـ {entity?.tradeName}.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Held Escrow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">رصيد الضمان (HELD)</span>
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-amber-600">
              {summary.heldEscrowBalance.toLocaleString()} <span className="text-xs text-slate-500 font-normal">ج.م</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold mt-1 inline-block">
              يُطلق فور تأكيد توصيل الشحنات
            </span>
          </div>
        </div>

        {/* Card 2: Available Payout */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">القابل للسحب / التحويل</span>
            <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-emerald-600">
              {summary.availablePayoutBalance.toLocaleString()} <span className="text-xs text-slate-500 font-normal">ج.م</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold mt-1 inline-block">
              جاهز لمعالجة السحب (Payout Batch)
            </span>
          </div>
        </div>

        {/* Card 3: Total Gross Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المبيعات الإجمالية</span>
            <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900">
              {summary.totalGrossSales.toLocaleString()} <span className="text-xs text-slate-500 font-normal">ج.م</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold mt-1 inline-block">
              من أصل {summary.totalEscrowRecords} عمليات شراء
            </span>
          </div>
        </div>

        {/* Card 4: Platform Fees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">عمولة المنصة (10%)</span>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-slate-900">
              {summary.totalPlatformFees.toLocaleString()} <span className="text-xs text-slate-500 font-normal">ج.م</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold mt-1 inline-block">
              رسوم الخدمة والاستضافة
            </span>
          </div>
        </div>
      </div>

      {/* Payout History Batches Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          سجل التحويلات والمستحقات (Payout History)
        </h3>

        {payoutHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
            لا توجد تحويلات سابقة حتى الآن.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">رقم المرجع (Payout Ref)</th>
                  <th className="p-3">إجمالي مبلغ التحويل</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">تاريخ المعالجة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payoutHistory.map((payout) => (
                  <tr key={payout._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-600">{payout.payoutReference}</td>
                    <td className="p-3 font-bold text-emerald-600">
                      {payout.totalAmount?.toLocaleString()} ج.م
                    </td>
                    <td className="p-3">
                      {payout.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" /> تم التحويل بنجاح
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <Clock className="w-3 h-3" /> قيد التحويل
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-400">
                      {payout.processedAt
                        ? new Date(payout.processedAt).toLocaleDateString('ar-EG')
                        : 'معلق'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorPayoutsPage;
