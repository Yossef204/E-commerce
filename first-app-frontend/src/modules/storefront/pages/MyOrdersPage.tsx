import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShoppingBag,
  RotateCcw,
  Boxes,
  X,
  CreditCard,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../api/client';
import returnApi from '../../../api/returnApi';
import { useAuthStore } from '../../../store/useAuthStore';
import type { ReturnRequest, ReturnStatus, ReturnReason, RefundMethod } from '../../../types/return';
import { CodVerificationModal } from '../../../components/checkout/CodVerificationModal';

interface OrderItem {
  productId?: string;
  sku: string;
  variantId?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  totalPrice?: number;
  titleSnapshot?: string;
  title?: string;
}

interface EntityOrder {
  _id: string;
  mainOrderId: string;
  sellingEntityId: string;
  status: string;
  subtotal: number;
  items: OrderItem[];
  updatedAt?: string;
}

interface CustomerOrder {
  _id: string;
  orderNumber?: string;
  totalPrice?: number;
  totalAmount?: number;
  status?: string;
  createdAt: string;
  shippingAddress?: string;
  items?: OrderItem[];
  entityOrders?: EntityOrder[];
}

export const MyOrdersPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'ORDERS' | 'RETURNS'>('ORDERS');

  // Return modal state
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [selectedEntityOrder, setSelectedEntityOrder] = useState<EntityOrder | null>(null);
  const [selectedItemSku, setSelectedItemSku] = useState<string>('');
  const [returnQuantity, setReturnQuantity] = useState<number>(1);
  const [returnReason, setReturnReason] = useState<ReturnReason>('DEFECTIVE');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('ORIGINAL_PAYMENT');
  const [customerNote, setCustomerNote] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // COD verification modal state
  const [codModalOpen, setCodModalOpen] = useState(false);
  const [selectedCodOrder, setSelectedCodOrder] = useState<CustomerOrder | null>(null);

  const handleOpenCodModal = (order: CustomerOrder) => {
    setSelectedCodOrder(order);
    setCodModalOpen(true);
  };

  const handleCodVerified = () => {
    setCodModalOpen(false);
    setSelectedCodOrder(null);
    queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    setSuccessToast('تم تأكيد طلب الدفع عند الاستلام بنجاح!');
    setTimeout(() => setSuccessToast(null), 5000);
  };

  // Fetch Customer Orders
  const { data: orders = [], isLoading: isLoadingOrders, isError: isErrorOrders } = useQuery<CustomerOrder[]>({
    queryKey: ['my-orders', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/orders/my-orders/${user?.id}`);
        return Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : [];
      } catch {
        return [];
      }
    },
  });

  // Fetch Customer Return Requests
  const { data: returns = [], isLoading: isLoadingReturns } = useQuery<ReturnRequest[]>({
    queryKey: ['my-returns', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      try {
        return await returnApi.getMyReturns();
      } catch {
        return [];
      }
    },
  });

  // Return submission mutation
  const returnMutation = useMutation({
    mutationFn: async (payload: any) => {
      return returnApi.requestReturn(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-returns'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      setReturnModalOpen(false);
      setSelectedOrder(null);
      setSelectedEntityOrder(null);
      setSuccessToast('تم تقديم طلب الإرجاع بنجاح، جاري مراجعته من قبل المتجر.');
      setTimeout(() => setSuccessToast(null), 5000);
      setActiveTab('RETURNS');
    },
    onError: (err: any) => {
      setFormError(
        err.response?.data?.message || 'فشل في تقديم طلب الإرجاع، يرجى المحاولة لاحقاً'
      );
    },
  });

  const handleOpenReturnModal = (order: CustomerOrder, entityOrder?: EntityOrder) => {
    setSelectedOrder(order);
    const targetEntityOrder =
      entityOrder ||
      order.entityOrders?.find((eo) => eo.status?.toUpperCase() === 'DELIVERED') ||
      order.entityOrders?.[0] ||
      null;

    setSelectedEntityOrder(targetEntityOrder);

    // Pick first item available
    const items = targetEntityOrder?.items || order.items || [];
    if (items.length > 0) {
      setSelectedItemSku(items[0].sku);
      setReturnQuantity(1);
    }
    setReturnReason('DEFECTIVE');
    setRefundMethod('ORIGINAL_PAYMENT');
    setCustomerNote('');
    setFormError(null);
    setReturnModalOpen(true);
  };

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedOrder || !selectedEntityOrder) {
      setFormError('بيانات الطلب غير مكتملة.');
      return;
    }

    const availableItems = selectedEntityOrder.items || selectedOrder.items || [];
    const itemToReturn = availableItems.find((it) => it.sku === selectedItemSku);

    if (!itemToReturn) {
      setFormError('يرجى تحديد المنتج المراد إرجاعه');
      return;
    }

    const itemPrice = itemToReturn.unitPrice || itemToReturn.price || (itemToReturn.totalPrice ? itemToReturn.totalPrice / (itemToReturn.quantity || 1) : 0);

    returnMutation.mutate({
      orderId: selectedOrder._id,
      entityOrderId: selectedEntityOrder._id,
      items: [
        {
          productId: itemToReturn.productId || (selectedOrder as any).productId || '000000000000000000000000',
          sku: itemToReturn.sku,
          quantity: Number(returnQuantity),
          price: itemPrice,
          reason: returnReason,
        },
      ],
      customerReason: customerNote || undefined,
      refundMethod,
    });
  };

  const getStatusBadge = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING_COD_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            بانتظار تأكيد الهاتف (COD)
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-xs font-bold px-2.5 py-1 rounded-full border border-teal-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            تم تأكيد الطلب
          </span>
        );
      case 'DELIVERED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم التوصيل بنجاح
          </span>
        );
      case 'SHIPPED':
      case 'PARTIALLY_FULFILLED':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
            <Truck className="w-3.5 h-3.5" />
            تم الشحن
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-200">
            <Clock className="w-3.5 h-3.5" />
            جارٍ التجهيز
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            ملغي
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            قيد الانتظار
          </span>
        );
    }
  };

  const getReturnStatusBadge = (status: ReturnStatus) => {
    switch (status) {
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم استرداد المبلغ بنجاح ✓
          </span>
        );
      case 'INSPECTED':
        return (
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold">
            <Boxes className="w-3.5 h-3.5" />
            تم فحص المنتج (بانتظار إيداع المبلغ)
          </span>
        );
      case 'APPROVED_PENDING_SHIPMENT':
        return (
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full text-xs font-bold">
            <Truck className="w-3.5 h-3.5" />
            مقبول (بانتظار استلام الشحنة)
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-xs font-bold">
            <XCircle className="w-3.5 h-3.5" />
            طلب استرجاع مرفوض
          </span>
        );
      case 'REQUESTED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            طلب قيد مراجعة المتجر
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2.5">
          <Package className="w-7 h-7 text-blue-600" />
          طلباتي السابقة
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          تابع حالة شحناتك وتفاصيل طلبات الشراء والمرتجعات
        </p>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`pb-3 px-4 text-sm font-black transition-all cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'ORDERS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>طلبات الشراء ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RETURNS')}
          className={`pb-3 px-4 text-sm font-black transition-all cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'RETURNS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>المرتجعات والاسترداد ({returns.length})</span>
        </button>
      </div>

      {/* TAB 1: ORDERS */}
      {activeTab === 'ORDERS' && (
        <>
          {isLoadingOrders ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-bold">جارٍ تحميل قائمة الطلبات...</span>
            </div>
          ) : isErrorOrders ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span className="text-xs font-bold">تعذر تحميل الطلبات، يرجى المحاولة لاحقاً</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-lg">لم تقم بإجراء أي طلبات بعد</h3>
                <p className="text-slate-500 text-xs max-w-sm mx-auto">
                  ابدأ التسوق الآن وتصفح آلاف المنتجات المميزة مع الشحن السريع وحماية المشتري!
                </p>
              </div>
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors shadow-md shadow-blue-500/20"
              >
                <span>تصفح المتجر</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                // Check if any entityOrder or the main order is DELIVERED or COMPLETED
                const isDelivered =
                  order.status?.toUpperCase() === 'DELIVERED' ||
                  order.status?.toUpperCase() === 'COMPLETED' ||
                  order.entityOrders?.some(
                    (eo) => eo.status?.toUpperCase() === 'DELIVERED'
                  );

                return (
                  <div
                    key={order._id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4 hover:shadow-md transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="space-y-0.5">
                        <div className="text-xs font-mono font-bold text-slate-700">
                          رقم الطلب: #{order.orderNumber || order._id.slice(-8).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-EG') : 'حديثاً'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {getStatusBadge(order.status)}
                        {order.status?.toUpperCase() === 'PENDING_COD_VERIFICATION' && (
                          <button
                            onClick={() => handleOpenCodModal(order)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>تأكيد الرمز (OTP)</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {order.shippingAddress && (
                      <div className="text-xs text-slate-500">
                        <span className="font-bold text-slate-700">عنوان التوصيل: </span>
                        {order.shippingAddress}
                      </div>
                    )}

                    {/* Order Items */}
                    {order.items && order.items.length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-3 divide-y divide-slate-100 text-xs">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="py-2 flex justify-between items-center text-slate-700">
                            <span className="font-medium">
                              {item.title || item.titleSnapshot || `منتج (${item.sku})`} × {item.quantity}
                            </span>
                            {item.price || item.totalPrice ? (
                              <span className="font-bold font-mono">
                                {((item.unitPrice || item.price || 0) * item.quantity || item.totalPrice || 0).toFixed(2)} ج.م
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sub-orders / Entity Orders if available */}
                    {order.entityOrders && order.entityOrders.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                        <span className="font-bold text-slate-600 block text-[11px]">شحنات المتاجر:</span>
                        <div className="grid grid-cols-1 gap-2">
                          {order.entityOrders.map((eo) => (
                            <div
                              key={eo._id}
                              className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/60 flex flex-wrap items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-400" />
                                <span className="font-mono text-slate-600 text-[11px]">#{eo._id.slice(-6)}</span>
                                <span className="font-bold text-slate-700">
                                  ({eo.items?.length || 0} منتجات)
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {getStatusBadge(eo.status)}
                                {eo.status?.toUpperCase() === 'DELIVERED' && (
                                  <button
                                    onClick={() => handleOpenReturnModal(order, eo)}
                                    className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>طلب إرجاع</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Total Price and Global Return Button */}
                    <div className="flex flex-wrap justify-between items-center pt-3 border-t border-slate-100 text-sm gap-3">
                      <div>
                        <span className="font-bold text-slate-600 text-xs">الإجمالي الكلي: </span>
                        <span className="font-black text-slate-900 text-base">
                          {(order.totalPrice || order.totalAmount || 0).toFixed(2)}{' '}
                          <span className="text-xs text-slate-500">ج.م</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {order.status?.toUpperCase() === 'PENDING_COD_VERIFICATION' && (
                          <button
                            onClick={() => handleOpenCodModal(order)}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>تأكيد طلب الدفع عند الاستلام (OTP)</span>
                          </button>
                        )}

                        {/* Main return button if delivered and has entityOrders */}
                        {isDelivered && (
                          <button
                            onClick={() => handleOpenReturnModal(order)}
                            className="px-4 py-2 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>طلب إرجاع منتج</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: RETURNS */}
      {activeTab === 'RETURNS' && (
        <>
          {isLoadingReturns ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-bold">جارٍ تحميل قائمة المرتجعات...</span>
            </div>
          ) : returns.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-sm">
              <RotateCcw className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-base">لا توجد طلبات إرجاع حالية</h3>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                يمكنك طلب استرجاع أي منتج تم تسليمه بنجاح خلال 14 يوماً من تاريخ الاستلام مباشرة من تبويب "طلبات الشراء".
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {returns.map((ret) => (
                <div
                  key={ret._id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-800">
                          طلب إرجاع #{ret._id.slice(-8).toUpperCase()}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-xs text-slate-500">
                          بتاريخ {new Date(ret.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    </div>
                    <div>{getReturnStatusBadge(ret.status)}</div>
                  </div>

                  {/* Return items */}
                  <div className="bg-slate-50 rounded-xl p-3 divide-y divide-slate-100 text-xs">
                    {ret.items.map((item, idx) => (
                      <div key={idx} className="py-1.5 flex justify-between items-center text-slate-700">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold font-mono">{item.sku}</span>
                          <span className="text-slate-500">× {item.quantity}</span>
                        </div>
                        <span className="bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          سبب الإرجاع: {item.reason}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Notes / Reason */}
                  {ret.customerReason && (
                    <div className="text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700">ملاحظتك: </span>
                      {ret.customerReason}
                    </div>
                  )}

                  {/* Vendor rejection reason if rejected */}
                  {ret.rejectionReason && (
                    <div className="text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
                      <span className="font-bold block mb-0.5">سبب رفض الطلب من المتجر:</span>
                      {ret.rejectionReason}
                    </div>
                  )}

                  {/* Refund summary */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500">
                      طريقة الاسترداد: {ret.refundMethod === 'WALLET_CREDIT' ? 'محفظة المتجر' : 'وسيلة الدفع الأصلية'}
                    </span>
                    {ret.refundAmount ? (
                      <span className="font-black text-slate-900 text-sm">
                        المبلغ المسترد: {ret.refundAmount.toFixed(2)} ج.م
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* RETURN REQUEST MODAL */}
      {returnModalOpen && selectedOrder && selectedEntityOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-blue-600" />
                تقديم طلب إرجاع للطلب #{selectedOrder.orderNumber || selectedOrder._id.slice(-8).toUpperCase()}
              </h3>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReturn} className="space-y-4 text-xs">
              {/* Select Item */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">حدد المنتج المراد إرجاعه: *</label>
                <select
                  value={selectedItemSku}
                  onChange={(e) => setSelectedItemSku(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  required
                >
                  {(selectedEntityOrder.items || selectedOrder.items || []).map((it) => (
                    <option key={it.sku} value={it.sku}>
                      {it.title || it.titleSnapshot || it.sku} (الكمية: {it.quantity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">الكمية المراد إرجاعها: *</label>
                <input
                  type="number"
                  min="1"
                  max={
                    (selectedEntityOrder.items || selectedOrder.items || []).find(
                      (i) => i.sku === selectedItemSku
                    )?.quantity || 1
                  }
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono"
                  required
                />
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">سبب الإرجاع: *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  required
                >
                  <option value="DEFECTIVE">منتج تالف أو به عيب صناعة</option>
                  <option value="NOT_AS_DESCRIBED">غير مطابق للمواصفات أو الصور المعروضة</option>
                  <option value="WRONG_ITEM">استلام منتج أو مقاس مختلف بالخطأ</option>
                  <option value="CHANGED_MIND">تغيير الرأي أو لم يعد مطلوباً</option>
                </select>
              </div>

              {/* Refund Method */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">طريقة استرداد المبلغ المفضلة:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethod('ORIGINAL_PAYMENT')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold cursor-pointer transition ${
                      refundMethod === 'ORIGINAL_PAYMENT'
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>وسيلة الدفع الأصلية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRefundMethod('WALLET_CREDIT')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold cursor-pointer transition ${
                      refundMethod === 'WALLET_CREDIT'
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>محفظة المتجر (فوري)</span>
                  </button>
                </div>
              </div>

              {/* Customer Explanatory Note */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">تفاصيل إضافية / توضيح العيب (اختياري):</label>
                <textarea
                  rows={3}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="يرجى كتابة أي تفاصيل إضافية تساعد في سرعة فحص وقبول طلب الإرجاع..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={returnMutation.isPending}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {returnMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>إرسال طلب الإرجاع</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {codModalOpen && selectedCodOrder && (
        <CodVerificationModal
          isOpen={codModalOpen}
          orderId={selectedCodOrder._id}
          orderNumber={selectedCodOrder.orderNumber}
          phoneMasked={
            (selectedCodOrder as any).phoneMasked ||
            (selectedCodOrder.shippingAddress?.match(/\d{9,11}/)?.[0]
              ? '010****' + selectedCodOrder.shippingAddress?.match(/\d{9,11}/)?.[0].slice(-4)
              : undefined)
          }
          onVerified={handleCodVerified}
          onCancel={() => {
            setCodModalOpen(false);
            setSelectedCodOrder(null);
          }}
        />
      )}
    </div>
  );
};

export default MyOrdersPage;
