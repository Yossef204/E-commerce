import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Store,
  MapPin,
  Phone,
  Tag,
  ShoppingBag,
} from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { apiClient } from '../api/client';

export const CheckoutPage: React.FC = () => {
  const {
    items,
    getTotalPrice,
    getItemsByVendor,
    clearCart,
  } = useCartStore();

  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH_ON_DELIVERY' | 'CARD'>('CASH_ON_DELIVERY');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);

  const totalPrice = getTotalPrice();
  const shippingFee = totalPrice >= 500 ? 0 : 50;
  const finalTotal = totalPrice + shippingFee;
  const vendorGroups = getItemsByVendor();
  const vendorIds = Object.keys(vendorGroups);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!street.trim() || !city.trim() || !phone.trim()) {
      setErrorMsg('يرجى ملء جميع حقول العنوان ورقم الهاتف للتوصيل');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('سلة المشتريات فارغة');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const fullAddress = `${city} - ${street}${notes ? ` (ملاحظات: ${notes})` : ''} - هاتف: ${phone}`;
    const idempotencyKey = `chk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        items: items.map((i) => ({
          sku: i.variantSku,
          quantity: i.quantity,
        })),
        shippingAddress: fullAddress,
        idempotencyKey,
        couponCode: couponCode.trim() ? couponCode.trim().toUpperCase() : undefined,
      };

      const res = await apiClient.post('/orders/checkout', payload);
      setOrderSuccess(res.data);
      clearCart();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.message)
          ? err.response?.data?.message.join(', ')
          : null) ||
        'حدث خطأ أثناء إتمام الطلب، يرجى المحاولة مرة أخرى';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Success view
  if (orderSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6" dir="rtl">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900">
            تم تأكيد طلبك بنجاح!
          </h2>
          <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
            شكراً لثقتك بنا. تم استلام طلبك وجارٍ معالجته وتقسيمه على المتاجر المختارة.
          </p>
          {orderSuccess.masterOrder?._id && (
            <div className="inline-block bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-mono text-xs font-bold mt-2">
              رقم الطلب الرئيسي: {orderSuccess.masterOrder._id}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-right space-y-3">
          <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2">
            تفاصيل الشحن
          </h3>
          <p className="text-xs text-slate-600">
            <span className="font-bold text-slate-800">العنوان: </span>
            {city} - {street}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-bold text-slate-800">الهاتف: </span>
            {phone}
          </p>
          <p className="text-xs text-slate-600">
            <span className="font-bold text-slate-800">طريقة الدفع: </span>
            {paymentMethod === 'CASH_ON_DELIVERY' ? 'الدفع عند الاستلام' : 'بطاقة بنكية'}
          </p>
        </div>

        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <Link
            to="/"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-500/20 text-sm transition-all"
          >
            متابعة التسوق
          </Link>
        </div>
      </div>
    );
  }

  // Empty cart guard
  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4" dir="rtl">
        <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">لا توجد منتجات لإتمام الطلب</h2>
        <p className="text-xs text-slate-500">يرجى إضافة منتجات إلى سلتك أولاً</p>
        <Link
          to="/"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-colors"
        >
          العودة للمتجر
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2.5">
          <Truck className="w-7 h-7 text-blue-600" />
          إتمام الطلب والدفع
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          أدخل بيانات الشحن والتوصيل لتأكيد طلبك
        </p>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Shipping Form & Vendor Split Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping Address Box */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-5 h-5 text-blue-600" />
              عنوان الشحن والتوصيل
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المحافظة / المدينة *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: القاهرة"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهاتف للتواصل *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="010XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  العنوان بالتفصيل (الشارع، رقم المبنى، الشقة) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="شارع التحرير، عمارة 12، الدور الرابع"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات إضافية للتوصيل (اختياري)
                </label>
                <textarea
                  rows={2}
                  placeholder="أي تعليمات لمندوب الشحن..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="w-5 h-5 text-blue-600" />
              طريقة الدفع
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === 'CASH_ON_DELIVERY'
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'CASH_ON_DELIVERY'}
                  onChange={() => setPaymentMethod('CASH_ON_DELIVERY')}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    الدفع عند الاستلام (COD)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    ادفع نقداً عند استلام الشحنة
                  </span>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === 'CARD'
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'CARD'}
                  onChange={() => setPaymentMethod('CARD')}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <span className="font-bold text-xs text-slate-900 block">
                    بطاقة بنكية / إلكتروني
                  </span>
                  <span className="text-[11px] text-slate-500">
                    دفع إلكتروني آمن ومحمي بالكامل
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Vendor Split Breakdown Preview */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-600" />
                تقسيم الشحنات حسب المتاجر ({vendorIds.length} متاجر)
              </h2>
              <span className="text-[11px] font-semibold text-slate-500">
                يتم إرسال كل شحنة مباشرة من المتجر المختص
              </span>
            </div>

            <div className="space-y-4">
              {vendorIds.map((vendorId, idx) => {
                const vendorItems = vendorGroups[vendorId];
                const vendorSubtotal = vendorItems.reduce(
                  (sum, it) => sum + (Number(it.price) || 0) * it.quantity,
                  0
                );
                const vendorTitle =
                  vendorItems[0]?.vendorName || `المتجر #${vendorId.slice(-6)}`;

                return (
                  <div
                    key={vendorId}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                        <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-md inline-flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        {vendorTitle}
                      </span>
                      <span className="font-black text-xs text-slate-700">
                        {vendorSubtotal.toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {vendorItems.map((vItem) => (
                        <div
                          key={`${vItem.productId}-${vItem.variantSku}`}
                          className="py-2 flex items-center justify-between text-xs text-slate-600"
                        >
                          <span className="truncate max-w-[260px]">
                            {vItem.title} × {vItem.quantity}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {((Number(vItem.price) || 0) * vItem.quantity).toFixed(2)} ج.م
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5 sticky top-24">
            <h2 className="font-extrabold text-slate-900 text-lg border-b border-slate-100 pb-3">
              ملخص الحساب
            </h2>

            {/* Coupon Code Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                كوبون الخصم
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="أدخل رمز الكوبون"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="w-full pr-8 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm border-t border-slate-100 pt-4">
              <div className="flex justify-between text-slate-600">
                <span>إجمالي المنتجات ({items.length})</span>
                <span className="font-bold text-slate-900">
                  {totalPrice.toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>مصاريف الشحن</span>
                <span className="font-bold text-emerald-600">
                  {shippingFee === 0 ? 'مجاناً' : `${shippingFee.toFixed(2)} ج.م`}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                <span className="font-bold text-slate-900">المجموع المطلوب</span>
                <span className="font-black text-2xl text-blue-600">
                  {finalTotal.toFixed(2)}{' '}
                  <span className="text-xs font-bold text-slate-600">ج.م</span>
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white font-extrabold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ تأكيد الطلب...</span>
                </>
              ) : (
                <span>تأكيد الطلب الآن</span>
              )}
            </button>

            <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>المعاملة محمية بحساب الضمان المالي Escrow</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CheckoutPage;
