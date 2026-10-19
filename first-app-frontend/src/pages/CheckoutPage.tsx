 import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Lock,
  Smartphone,
  Zap,
} from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { apiClient } from '../api/client';
import { getImageUrl, handleImageError } from '../utils/imageHelper';
import { CodVerificationModal } from '../components/checkout/CodVerificationModal';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
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
  const [paymentMethod, setPaymentMethod] = useState<
    'CARD' | 'WALLET' | 'INSTAPAY' | 'COD'
  >('CARD');
  const [walletNumber, setWalletNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [instapayRef, setInstapayRef] = useState('');

  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);
  const [isCodModalOpen, setIsCodModalOpen] = useState(false);
  const [codModalData, setCodModalData] = useState<{
    orderId: string;
    orderNumber?: string;
    phoneMasked?: string;
  } | null>(null);

  const handleCardNumberChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    const parts = raw.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join(' ') : raw);
  };

  const handleExpiryChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setCardExpiry(raw);
    }
  };

  const handleCvcChange = (val: string) => {
    setCardCvc(val.replace(/\D/g, '').slice(0, 4));
  };

  const handleWalletChange = (val: string) => {
    setWalletNumber(val.replace(/\D/g, '').slice(0, 11));
  };

  useEffect(() => {
    // Load user profile to prefill phone and saved addresses
    const loadProfile = async () => {
      try {
        const res = await apiClient.get('/users/profile');
        const data = res.data?.data || res.data;
        const user = data.user || {};
        if (user.phoneNumber && !phone) {
          setPhone(user.phoneNumber);
        }
        const addrs = user.addresses || (user.address ? [user.address] : []);
        if (addrs && addrs.length > 0) {
          setSavedAddresses(addrs);
        }
      } catch (err) {
        // Ignored if user not logged in or endpoint unavailable
      }
    };
    loadProfile();
  }, []);

  const handleSelectSavedAddress = (addr: string) => {
    setSelectedSavedAddress(addr);
    setStreet(addr);
    if (!city) setCity('مصر');
  };

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

    // Method-specific validations
    if (paymentMethod === 'WALLET') {
      const cleanWallet = walletNumber.trim();
      if (!cleanWallet) {
        setErrorMsg('يرجى إدخال رقم المحفظة الإلكترونية لإتمام عملية الدفع');
        return;
      }
      if (!/^01[0125][0-9]{8}$/.test(cleanWallet)) {
        setErrorMsg('رقم المحفظة الإلكترونية غير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ (010، 011، 012، 015)');
        return;
      }
    } else if (paymentMethod === 'CARD') {
      const cleanCard = cardNumber.replace(/\s+/g, '');
      if (cleanCard.length < 16) {
        setErrorMsg('يرجى إدخال رقم بطاقة ائتمان صحيح مكون من 16 رقماً');
        return;
      }
      if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        setErrorMsg('يرجى إدخال تاريخ انتهاء صلاحية البطاقة بالشكل (MM/YY)');
        return;
      }
      if (cardCvc.trim().length < 3) {
        setErrorMsg('يرجى إدخال رمز الأمان CVC (3 أو 4 أرقام)');
        return;
      }
      if (!cardHolder.trim()) {
        setErrorMsg('يرجى إدخال اسم صاحب البطاقة كما هو مدون عليها');
        return;
      }
    } else if (paymentMethod === 'INSTAPAY') {
      if (!instapayRef.trim()) {
        setErrorMsg('يرجى إدخال رقم مرجع المعاملة أو إشعار التحويل من تطبيق InstaPay');
        return;
      }
    }

    setLoading(true);
    setErrorMsg(null);

    const fullAddress = `${city} - ${street}${notes ? ` (ملاحظات: ${notes})` : ''} - هاتف: ${phone}`;
    const idempotencyKey = `chk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      items: items.map((i) => ({
        sku: i.variantSku,
        quantity: i.quantity,
        productId: i.productId,
      })),
      shippingAddress: fullAddress,
      idempotencyKey,
      couponCode: couponCode.trim() ? couponCode.trim().toUpperCase() : undefined,
      paymentMethod,
      walletNumber: paymentMethod === 'WALLET' ? walletNumber.trim() : undefined,
      transferReference:
        paymentMethod === 'WALLET'
          ? `WAL-${Date.now().toString().slice(-6)}`
          : paymentMethod === 'INSTAPAY'
          ? instapayRef.trim()
          : undefined,
    };

    console.log('Sending Checkout Request:', {
      endpoint: '/orders/checkout',
      payload,
      headers: { 'Idempotency-Key': idempotencyKey },
    });

    try {
      const res = await apiClient.post('/orders/checkout', payload, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });

      console.log('Checkout Success Response:', res.data);
      const data = res.data?.data || res.data;

      if (data?.requiresCodVerification) {
        setCodModalData({
          orderId: data.orderId || data.mainOrder?._id,
          orderNumber: data.orderNumber || data.mainOrder?.orderNumber,
          phoneMasked: data.phoneMasked,
        });
        setIsCodModalOpen(true);
        return;
      }

      clearCart();
      const confirmedOrder =
        data.mainOrder || data.masterOrder || data.order || data;
      const orderId =
        confirmedOrder?._id || confirmedOrder?.id || data.orderId;
      if (orderId) {
        navigate(`/order-success/${orderId}`, {
          state: { order: confirmedOrder },
        });
      } else {
        setOrderSuccess(data);
      }
    } catch (err: any) {
      console.error('Checkout Error Response:', err.response?.data || err);
      const rawMsg = err.response?.data?.message;
      const serverMsg = Array.isArray(rawMsg)
        ? rawMsg.join(' - ')
        : (typeof rawMsg === 'string' ? rawMsg : null) ||
          err.response?.data?.error ||
          err.message ||
          'حدث خطأ أثناء إتمام الطلب، يرجى المحاولة مرة أخرى';
      setErrorMsg(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCodVerified = (resData: any) => {
    setIsCodModalOpen(false);
    clearCart();
    const confirmedOrder = resData.mainOrder || resData.order || resData;
    const orderId =
      confirmedOrder?._id ||
      confirmedOrder?.id ||
      resData.orderId ||
      codModalData?.orderId;
    if (orderId) {
      navigate(`/order-success/${orderId}`, {
        state: { order: confirmedOrder },
      });
    } else {
      setOrderSuccess(confirmedOrder);
    }
  };

  // Success view
  if (orderSuccess) {
    const order =
      orderSuccess.mainOrder ||
      orderSuccess.masterOrder ||
      orderSuccess.order ||
      orderSuccess.data?.mainOrder ||
      orderSuccess;
    const orderNumber =
      order.orderNumber || order._id || 'ORD-COMPLETED';
    const totalAmount =
      order.totalAmount ?? orderSuccess.totalAmount ?? finalTotal;
    const payment = orderSuccess.payment || {};

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
          <div className="inline-block bg-slate-100 text-slate-800 px-4 py-2 rounded-xl font-mono text-xs font-bold mt-2 border border-slate-200">
            رقم الطلب الرئيسي: {orderNumber}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-right space-y-3 shadow-sm">
          <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2">
            تفاصيل الطلب والدفع
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <p className="text-slate-600">
              <span className="font-bold text-slate-800">العنوان: </span>
              {city} - {street}
            </p>
            <p className="text-slate-600">
              <span className="font-bold text-slate-800">الهاتف: </span>
              {phone}
            </p>
            <p className="text-slate-600">
              <span className="font-bold text-slate-800">طريقة الدفع: </span>
              {paymentMethod === 'COD'
                ? 'الدفع عند الاستلام (Cash on Delivery)'
                : paymentMethod === 'CARD'
                ? 'بطاقة بنكية (فيزا / ماستركارد / ميزة)'
                : paymentMethod === 'WALLET'
                ? `محفظة إلكترونية (${walletNumber})`
                : paymentMethod === 'INSTAPAY'
                ? `إنستاباي - InstaPay (${instapayRef})`
                : 'دفع إلكتروني'}
            </p>
            <p className="text-slate-600">
              <span className="font-bold text-slate-800">المبلغ الإجمالي: </span>
              <span className="font-black text-blue-600">{Number(totalAmount).toFixed(2)} ج.م</span>
            </p>
            {payment.transactionId && (
              <p className="text-slate-600 sm:col-span-2">
                <span className="font-bold text-slate-800">رقم المعاملة: </span>
                <span className="font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {payment.transactionId}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <Link
            to="/my-orders"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-500/20 text-sm transition-all"
          >
            عرض ومتابعة طلباتي
          </Link>
          <Link
            to="/"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3 rounded-xl text-sm transition-all"
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

            {savedAddresses.length > 0 && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-blue-800 block">
                  عناوينك المحفوظة (اضغط للتعبئة التلقائية):
                </span>
                <div className="flex flex-wrap gap-2">
                  {savedAddresses.map((addr, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => handleSelectSavedAddress(addr)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all text-right flex items-center gap-1.5 ${
                        selectedSavedAddress === addr
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      <span>{addr}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
              {/* Option 1: Card */}
              <label
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'CARD'
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'CARD'}
                  onChange={() => setPaymentMethod('CARD')}
                  className="w-4 h-4 text-blue-600 mt-0.5"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>بطاقة بنكية (فيزا / ماستركارد / ميزة)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    دفع إلكتروني فوري وآمن بالبطاقات البنكية
                  </span>
                </div>
              </label>

              {/* Option 2: Mobile Wallet */}
              <label
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'WALLET'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'WALLET'}
                  onChange={() => setPaymentMethod('WALLET')}
                  className="w-4 h-4 text-emerald-600 mt-0.5"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>محفظة إلكترونية (فودافون كاش، أورنج، اتصالات، وي)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    تحويل ذكي وسريع عبر محافظ الهاتف المحمول
                  </span>
                </div>
              </label>

              {/* Option 3: InstaPay */}
              <label
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'INSTAPAY'
                    ? 'border-purple-600 bg-purple-50/50 shadow-sm ring-1 ring-purple-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'INSTAPAY'}
                  onChange={() => setPaymentMethod('INSTAPAY')}
                  className="w-4 h-4 text-purple-600 mt-0.5"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Zap className="w-4 h-4 text-purple-600" />
                    <span>إنستاباي (InstaPay)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    تحويل لحظي مباشر عبر الحسابات البنكية أو (IPA)
                  </span>
                </div>
              </label>

              {/* Option 4: COD */}
              <label
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'COD'
                    ? 'border-amber-600 bg-amber-50/50 shadow-sm ring-1 ring-amber-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'COD'}
                  onChange={() => setPaymentMethod('COD')}
                  className="w-4 h-4 text-amber-600 mt-0.5"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span>الدفع عند الاستلام (Cash on Delivery)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    ادفع نقداً لمندوب الشحن عند استلام الشحنة
                  </span>
                </div>
              </label>
            </div>

            {/* Dynamic Payment Method Fields */}
            {paymentMethod === 'CARD' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-in mt-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    بيانات البطاقة البنكية
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> مشفر 256-bit SSL
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رقم البطاقة (16 رقماً) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="4242 4242 4242 4242"
                      value={cardNumber}
                      onChange={(e) => handleCardNumberChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      dir="ltr"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        تاريخ الانتهاء (MM/YY) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="12/26"
                        value={cardExpiry}
                        onChange={(e) => handleExpiryChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        رمز الأمان (CVC) *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="123"
                        value={cardCvc}
                        onChange={(e) => handleCvcChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      اسم حامل البطاقة (بالحروف الإنجليزية) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="AHMED MOHAMED"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 uppercase"
                      dir="ltr"
                    />
                  </div>

                  <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>دفع آمن وفوري يدعم بطاقات فيزا، ماستركارد، وبطاقات ميزة الوطنية. بياناتك محمية بالكامل.</span>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'WALLET' && (
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-in mt-3">
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                  <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    الدفع عبر المحافظ الإلكترونية
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full font-bold">
                    سداد وتأكيد فوري
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg border border-red-200">فودافون كاش</span>
                  <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-lg border border-orange-200">أورنج كاش</span>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200">اتصالات كاش</span>
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-lg border border-purple-200">وي باي (WE Pay)</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    رقم المحفظة الإلكترونية للمطابقة والتأكيد *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="01XXXXXXXXX (11 رقماً)"
                    value={walletNumber}
                    onChange={(e) => handleWalletChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    dir="ltr"
                  />
                  {walletNumber.length > 0 && !/^01[0125][0-9]{8}$/.test(walletNumber) && (
                    <p className="text-[10px] text-rose-600 mt-1 font-semibold">
                      يجب أن يتكون الرقم من 11 رقماً ويبدأ بـ (010، 011، 012، 015).
                    </p>
                  )}
                </div>

                <div className="text-[11px] text-emerald-900 bg-white/80 border border-emerald-100 rounded-xl p-3 space-y-1">
                  <p className="font-bold">تعليمات التأكيد:</p>
                  <p className="text-emerald-800 leading-relaxed">
                    أدخل رقم المحفظة المستخدم في التحويل، وسيتم التحقق الآلي من العملية ومطابقتها وتأكيد حجز الطلب فورياً في النظام.
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'INSTAPAY' && (
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 sm:p-5 space-y-4 animate-fade-in mt-3">
                <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                  <span className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-purple-600" />
                    التحويل اللحظي عبر إنستاباي (InstaPay)
                  </span>
                  <span className="text-[10px] text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-full font-bold">
                    شبكة المدفوعات اللحظية IPN
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    رقم مرجع التحويل أو إشعار المعاملة من InstaPay *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: IPN-202410-XXXXXX أو رقم المرجع"
                    value={instapayRef}
                    onChange={(e) => setInstapayRef(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-purple-300 rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-purple-600 mt-1 font-semibold">
                    يمكنك الحصول على رقم المرجع فوراً من إشعار التحويل الناجح داخل تطبيق InstaPay.
                  </p>
                </div>

                <div className="text-[11px] text-purple-900 bg-white/80 border border-purple-100 rounded-xl p-3 space-y-1">
                  <p className="font-bold">طريقة الدفع عبر InstaPay:</p>
                  <p className="text-purple-800 leading-relaxed">
                    1. افتح تطبيق InstaPay على هاتفك المحمول وقم بإجراء التحويل بقيمة الطلب.
                  </p>
                  <p className="text-purple-800 leading-relaxed">
                    2. الصق رقم مرجع العملية (Reference Number) في الحقل أعلاه لتأكيد طلبك مباشرة.
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'COD' && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-2 mt-3 animate-fade-in">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>الدفع نقداً عند الاستلام (Cash on Delivery)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  الدفع سيكون نقداً لمندوب شركة الشحن عند استلام الطلب وفحص المنتجات على باب منزلك. يُرجى توفير المبلغ المحدد نقداً لتسهيل وسرعة عملية التسليم.
                </p>
              </div>
            )}
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
                          className="py-2.5 flex items-center justify-between gap-3 text-xs text-slate-600"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                              <img
                                src={getImageUrl(vItem.image)}
                                alt={vItem.title}
                                onError={handleImageError}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <span className="truncate max-w-[200px] sm:max-w-[260px] font-medium text-slate-800">
                              {vItem.title} × {vItem.quantity}
                            </span>
                          </div>
                          <span className="font-bold text-slate-900 shrink-0">
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

      {isCodModalOpen && codModalData && (
        <CodVerificationModal
          isOpen={isCodModalOpen}
          orderId={codModalData.orderId}
          orderNumber={codModalData.orderNumber}
          phoneMasked={codModalData.phoneMasked}
          onVerified={handleCodVerified}
          onCancel={() => setIsCodModalOpen(false)}
        />
      )}
    </div>
  );
};

export default CheckoutPage;
