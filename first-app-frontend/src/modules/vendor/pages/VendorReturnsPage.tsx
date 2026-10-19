import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  AlertCircle,
  Loader2,
  DollarSign,
  Search,
  Check,
  X,
  Boxes,
  ShieldCheck,
  User,
} from 'lucide-react';
import vendorApi from '../../../api/vendorApi';
import type { SellingEntity } from '../../../types/vendor';
import type {
  ReturnRequest,
  ReturnStatus,
  InspectionResult,
} from '../../../types/return';

export const VendorReturnsPage: React.FC = () => {
  const { entity } = useOutletContext<{ entity: SellingEntity | null }>();

  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Tabs
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Inspection Modal State
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [decision, setDecision] = useState<'INSPECTED' | 'REJECTED'>('INSPECTED');
  const [inspectionResult, setInspectionResult] = useState<InspectionResult>('RESALABLE');
  const [vendorNote, setVendorNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Process refund loading state
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const fetchReturns = async () => {
    if (!entity?._id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await vendorApi.getVendorReturns(entity._id, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setReturns(res?.returns || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في تحميل طلبات المرتجعات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [entity?._id, statusFilter]);

  const handleOpenInspect = (item: ReturnRequest) => {
    setSelectedReturn(item);
    setDecision('INSPECTED');
    setInspectionResult('RESALABLE');
    setVendorNote('');
    setRejectionReason('');
    setInspectModalOpen(true);
  };

  const handleCloseInspect = () => {
    setInspectModalOpen(false);
    setSelectedReturn(null);
  };

  const handleSubmitInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;

    try {
      setSubmittingAction(true);
      setError(null);

      await vendorApi.inspectReturnRequest(selectedReturn._id, {
        status: decision,
        inspectionResult: decision === 'INSPECTED' ? inspectionResult : undefined,
        vendorNote: vendorNote || undefined,
        rejectionReason: decision === 'REJECTED' ? rejectionReason : undefined,
      });

      setSuccessMsg(
        decision === 'INSPECTED'
          ? 'تم تسجيل فحص المرتجع بنجاح! يمكنك الآن تنفيذ الاسترداد المالي.'
          : 'تم رفض طلب المرتجع بنجاح.'
      );
      handleCloseInspect();
      await fetchReturns();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تسجيل قرار فحص المرتجع');
    } finally {
      setSubmittingAction(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleProcessRefund = async (returnId: string) => {
    if (!window.confirm('هل أنت متأكد من تنفيذ الاسترداد؟ سيتم تسوية الرصيد المالي تلقائياً وإعادة المخزون إن كان صالحاً.')) {
      return;
    }

    try {
      setRefundingId(returnId);
      setError(null);
      await vendorApi.processRefund(returnId);
      setSuccessMsg('تم تنفيذ الاسترداد المالي والمخزني بنجاح!');
      await fetchReturns();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في معالجة الاسترداد');
    } finally {
      setRefundingId(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const getStatusBadge = (status: ReturnStatus) => {
    switch (status) {
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم الاسترداد والتسوية
          </span>
        );
      case 'INSPECTED':
        return (
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold">
            <Boxes className="w-3.5 h-3.5" />
            تم الفحص (بانتظار الاسترداد)
          </span>
        );
      case 'APPROVED_PENDING_SHIPMENT':
        return (
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            مقبول وبانتظار الشحن
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-xs font-bold">
            <XCircle className="w-3.5 h-3.5" />
            مرتجع مرفوض
          </span>
        );
      case 'REQUESTED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            طلب جديد (بانتظار الفحص)
          </span>
        );
    }
  };

  const filteredReturns = returns.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const orderMatch =
      typeof item.orderId === 'object' && item.orderId !== null && 'orderNumber' in item.orderId && item.orderId.orderNumber
        ? item.orderId.orderNumber.toLowerCase().includes(q)
        : typeof item.orderId === 'string'
        ? item.orderId.toLowerCase().includes(q)
        : false;
    const skuMatch = item.items.some((it) => it.sku.toLowerCase().includes(q));
    const idMatch = item._id.toLowerCase().includes(q);
    return orderMatch || skuMatch || idMatch;
  });

  const tabOptions = [
    { key: 'ALL', label: 'كافة الطلبات' },
    { key: 'REQUESTED', label: 'طلبات جديدة' },
    { key: 'INSPECTED', label: 'تم الفحص' },
    { key: 'REFUNDED', label: 'مستردة بالكامل' },
    { key: 'REJECTED', label: 'مرفوضة' },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <RotateCcw className="w-6 h-6 text-blue-600" />
            إدارة طلبات المرتجعات والاسترداد
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            فحص المرتجعات المستلمة، تحديد قابلية إعادة البيع، وتسوية المبالغ والمخزون آلياً
          </p>
        </div>

        <button
          onClick={fetchReturns}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition self-start sm:self-auto cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          {tabOptions.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم الطلب، رمز SKU، أو معرف المرتجع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50/50"
          />
        </div>
      </div>

      {/* Return Requests List */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-bold">جارٍ تحميل طلبات المرتجعات...</span>
        </div>
      ) : filteredReturns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
          <RotateCcw className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700 text-sm">لا توجد طلبات مرتجعات مطابقة</h3>
          <p className="text-xs text-slate-400">
            {statusFilter === 'ALL'
              ? 'لم يقدم العملاء أي طلبات استرجاع لمنتجات متجرك حتى الآن.'
              : 'لا توجد طلبات بهذه الحالة المحددة.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReturns.map((item) => {
            const customerObj = typeof item.customerId === 'object' ? item.customerId : null;
            const orderObj = typeof item.orderId === 'object' ? item.orderId : null;

            return (
              <div
                key={item._id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4 hover:shadow-md transition-all"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-800">
                        مرتجع #{item._id.slice(-8).toUpperCase()}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-xs text-slate-500 font-medium">
                        الطلب: #{orderObj?.orderNumber || (typeof item.orderId === 'string' ? item.orderId.slice(-8).toUpperCase() : '')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>تاريخ الطلب: {new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                      {customerObj && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {customerObj.name || customerObj.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(item.status)}
                  </div>
                </div>

                {/* Items List */}
                <div className="bg-slate-50 rounded-xl p-3.5 space-y-2">
                  <span className="text-[11px] font-black text-slate-500 block">
                    المنتجات المطلوب إرجاعها:
                  </span>
                  <div className="divide-y divide-slate-100 text-xs">
                    {item.items.map((prod, idx) => (
                      <div key={idx} className="py-2 flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          <span className="font-mono font-bold text-slate-700">{prod.sku}</span>
                          <span className="text-slate-500">× {prod.quantity} قطعة</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="bg-slate-200/80 text-slate-700 px-2.5 py-0.5 rounded text-[10px] font-bold">
                            السبب: {prod.reason}
                          </span>
                          {prod.price ? (
                            <span className="font-mono font-bold text-slate-800">
                              {(prod.price * prod.quantity).toFixed(2)} ج.م
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Return Details & Inspection Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block mb-0.5">ملاحظة العميل / سبب الإرجاع:</span>
                    <p className="text-slate-700 font-medium">
                      {item.customerReason || 'لا توجد ملاحظات إضافية'}
                    </p>
                  </div>

                  {item.inspectionResult && (
                    <div>
                      <span className="text-slate-400 block mb-0.5">نتيجة الفحص الفني:</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          item.inspectionResult === 'RESALABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.inspectionResult === 'RESALABLE'
                          ? '✓ صالح لإعادة البيع (إرجاع المخزون تلقائياً)'
                          : '✗ تالف / غير قابل لإعادة البيع'}
                      </span>
                    </div>
                  )}

                  {item.vendorNote && (
                    <div className="md:col-span-2">
                      <span className="text-slate-400 block mb-0.5">ملاحظات التاجر / الفاحص:</span>
                      <p className="text-slate-700">{item.vendorNote}</p>
                    </div>
                  )}

                  {item.rejectionReason && (
                    <div className="md:col-span-2 text-rose-700">
                      <span className="text-rose-400 block mb-0.5">سبب الرفض:</span>
                      <p className="font-semibold">{item.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">قيمة الاسترداد التقديرية:</span>
                    <span className="font-black text-slate-900 text-sm">
                      {item.refundAmount ? item.refundAmount.toFixed(2) : '0.00'} ج.م
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Action 1: Inspect */}
                    {(item.status === 'REQUESTED' || item.status === 'APPROVED_PENDING_SHIPMENT') && (
                      <button
                        onClick={() => handleOpenInspect(item)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>فحص المرتجع واتخاذ قرار</span>
                      </button>
                    )}

                    {/* Action 2: Process Refund */}
                    {item.status === 'INSPECTED' && (
                      <button
                        onClick={() => handleProcessRefund(item._id)}
                        disabled={refundingId === item._id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        {refundingId === item._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <DollarSign className="w-3.5 h-3.5" />
                        )}
                        <span>تنفيذ الاسترداد المالي والمخزني</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspection Modal */}
      {inspectModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                فحص وتقييم المرتجع #{selectedReturn._id.slice(-8).toUpperCase()}
              </h3>
              <button
                onClick={handleCloseInspect}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitInspect} className="space-y-4 text-xs">
              {/* Decision Choice */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block">قرار الفحص:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecision('INSPECTED')}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition ${
                      decision === 'INSPECTED'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>قبول الفحص (الموافقة)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision('REJECTED')}
                    className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition ${
                      decision === 'REJECTED'
                        ? 'border-rose-500 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <X className="w-4 h-4 text-rose-600" />
                    <span>رفض المرتجع</span>
                  </button>
                </div>
              </div>

              {/* Inspection Result if Approved */}
              {decision === 'INSPECTED' && (
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <label className="font-bold text-slate-700 block">حالة المنتجات المستلمة:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-blue-400">
                      <input
                        type="radio"
                        name="inspectionResult"
                        value="RESALABLE"
                        checked={inspectionResult === 'RESALABLE'}
                        onChange={() => setInspectionResult('RESALABLE')}
                        className="text-blue-600"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">صالح لإعادة البيع</span>
                        <span className="text-[10px] text-slate-500">إرجاع للمخزون آلياً</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-blue-400">
                      <input
                        type="radio"
                        name="inspectionResult"
                        value="SCRAP_DAMAGED"
                        checked={inspectionResult === 'SCRAP_DAMAGED'}
                        onChange={() => setInspectionResult('SCRAP_DAMAGED')}
                        className="text-blue-600"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">تالف / خردة</span>
                        <span className="text-[10px] text-slate-500">لا يعاد للمخزون</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Rejection Reason if Rejected */}
              {decision === 'REJECTED' && (
                <div className="space-y-1.5">
                  <label className="font-bold text-rose-700 block">سبب الرفض الموجه للعميل: *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="وضح سبب رفض استرجاع المنتج (مثلاً: تم استلام المنتج مفتوحاً أو مستخدماً أو بدون ملحقاته الأصلية)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-3 border border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-rose-50/30"
                  />
                </div>
              )}

              {/* General Note */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">ملاحظات الفاحص (داخلية):</label>
                <textarea
                  rows={2}
                  placeholder="أي ملاحظات داخلية حول الفحص وحالة الشحنة..."
                  value={vendorNote}
                  onChange={(e) => setVendorNote(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseInspect}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {submittingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>حفظ القرار</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorReturnsPage;

