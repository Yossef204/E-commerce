import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  Loader2,
  AlertCircle,
  History,
  Lock,
  DollarSign,
} from 'lucide-react';
import vendorApi from '../../../api/vendorApi';
import type { SellingEntity, VendorOrder, EntityOrderStatus } from '../../../types/vendor';

export const VendorOrdersPage: React.FC = () => {
  const { entity } = useOutletContext<{ entity: SellingEntity | null }>();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update state
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<Record<string, EntityOrderStatus>>({});
  const [statusNote, setStatusNote] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!entity?._id) return;
    try {
      setLoading(true);
      const data = await vendorApi.getEntityOrders(entity._id);
      setOrders(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في تحميل الطلبات الواردة لمتجرك');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [entity]);

  const handleUpdateStatus = async (orderId: string) => {
    const status = selectedStatus[orderId];
    if (!status) return;
    const note = statusNote[orderId] || '';

    try {
      setUpdatingOrderId(orderId);
      setError(null);
      await vendorApi.updateOrderStatus(orderId, status, note);

      setSuccessMsg(`تم تحديث حالة الطلب إلى (${status}) بنجاح!`);
      await fetchOrders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تحديث حالة الطلب');
    } finally {
      setUpdatingOrderId(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const getOrderStatusBadge = (status: EntityOrderStatus) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> تم التوصيل (Escrow Released)
          </span>
        );
      case 'SHIPPED':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-bold">
            <Truck className="w-3.5 h-3.5" /> تم الشحن
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold">
            <Package className="w-3.5 h-3.5" /> قيد التجهيز
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> مؤكد
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold">
            ملغى
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5" /> معلق
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
            إدارة الطلبات الشحن والـ Escrow
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            متابعة وتحديث حالة الشحن للطلبات الواردة وتحرير مبالغ الضمان (Escrow) تلقائياً عند التوصيل.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors self-start sm:self-auto"
        >
          تحديث القائمة
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <p className="text-xs text-slate-500 font-semibold">جاري جلب الطلبات الواردة...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center shadow-sm">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">لا توجد طلبات حية لمتجرك حتى الآن</h3>
          <p className="text-xs text-slate-400 mt-1">عند قيام العملاء بالشراء ستظهر طلباتك هنا بشكل مباشر.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isUpdating = updatingOrderId === order._id;
            const currentSelectedStatus = selectedStatus[order._id] || order.status;

            return (
              <div
                key={order._id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 hover:border-slate-300 transition-all"
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-slate-900">
                        طلب فرعي #{order._id.substring(0, 10)}
                      </span>
                      {getOrderStatusBadge(order.status)}
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      الطلب الرئيسي: #{order.mainOrderId?.toString().substring(0, 12)}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-sm font-extrabold text-slate-900">
                      {order.subtotal?.toLocaleString()} ج.م
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString('ar-EG') : 'الآن'}
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                  <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" /> عناصر الطلب:
                  </div>

                  <div className="divide-y divide-slate-200">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{item.titleSnapshot}</span>
                          <span className="text-slate-400 font-mono text-[11px] block">
                            SKU: {item.sku} | الكمية: {item.quantity}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900">
                          {item.totalPrice?.toLocaleString()} ج.م
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Escrow Status Banner */}
                <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-purple-900 font-bold">
                    <Lock className="w-4 h-4 text-purple-600" />
                    <span>حالة حساب الضمان (Escrow):</span>
                  </div>
                  <div className="font-bold">
                    {order.status === 'DELIVERED' ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        تم إطلاق المبلغ (RELEASED) لحساب المحفظة
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        محتجز في الضمان (HELD) لحين تأكيد التسليم
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Update Controls */}
                <div className="bg-slate-100/80 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <label className="text-xs font-bold text-slate-700 shrink-0">
                      تحديث حالة الشحن:
                    </label>
                    <select
                      value={currentSelectedStatus}
                      onChange={(e) =>
                        setSelectedStatus({
                          ...selectedStatus,
                          [order._id]: e.target.value as EntityOrderStatus,
                        })
                      }
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold w-full sm:w-44 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PENDING">معلق (PENDING)</option>
                      <option value="CONFIRMED">مؤكد (CONFIRMED)</option>
                      <option value="PROCESSING">قيد التجهيز (PROCESSING)</option>
                      <option value="SHIPPED">تم الشحن (SHIPPED)</option>
                      <option value="DELIVERED">تم التوصيل (DELIVERED)</option>
                      <option value="CANCELLED">إلغاء الطلب (CANCELLED)</option>
                    </select>

                    <input
                      type="text"
                      placeholder="إضافة ملاحظة للشحن..."
                      value={statusNote[order._id] || ''}
                      onChange={(e) =>
                        setStatusNote({
                          ...statusNote,
                          [order._id]: e.target.value,
                        })
                      }
                      className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs w-full sm:w-64 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    disabled={isUpdating || currentSelectedStatus === order.status}
                    onClick={() => handleUpdateStatus(order._id)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-40 transition-all w-full md:w-auto flex items-center justify-center gap-1.5"
                  >
                    {isUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>حفظ الحالة الجديدة</span>
                    )}
                  </button>
                </div>

                {/* Status History Log */}
                {order.statusHistory && order.statusHistory.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <details className="group">
                      <summary className="text-[11px] font-bold text-slate-500 cursor-pointer hover:text-slate-800 flex items-center gap-1">
                        <History className="w-3.5 h-3.5 text-slate-400" />
                        سجل التغييرات والسجل الشمني ({order.statusHistory.length})
                      </summary>
                      <div className="mt-2 space-y-1 pl-4 border-r-2 border-slate-200 pr-2">
                        {order.statusHistory.map((h, i) => (
                          <div key={i} className="text-[11px] text-slate-500 flex justify-between">
                            <span>
                              <strong>{h.status}</strong> - {h.note || 'بدون ملاحظات'}
                            </span>
                            <span className="text-slate-400">
                              {new Date(h.updatedAt).toLocaleString('ar-EG')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VendorOrdersPage;
