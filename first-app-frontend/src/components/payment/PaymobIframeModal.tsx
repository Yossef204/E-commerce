import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  CreditCard,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiClient } from '../../api/client';

export interface PaymobBillingData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  city?: string;
  street?: string;
  building?: string;
  apartment?: string;
  floor?: string;
  postalCode?: string;
  country?: string;
  state?: string;
}

export interface PaymobIframeModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  orderId?: string;
  billingData?: PaymobBillingData;
  onSuccess?: (result: { transactionId?: string; orderIdentifier?: string; raw?: any }) => void;
  onError?: (error: any) => void;
}

export const PaymobIframeModal: React.FC<PaymobIframeModalProps> = ({
  isOpen,
  onClose,
  amount,
  orderId,
  billingData,
  onSuccess,
  onError,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [iframeLoading, setIframeLoading] = useState<boolean>(true);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentOutcome, setPaymentOutcome] = useState<'SUCCESS' | 'FAILED' | null>(null);
  const [outcomeData, setOutcomeData] = useState<any>(null);
  const [showTestCards, setShowTestCards] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Test Card Details for Sandbox / Evaluation
  const testCard = {
    cardNumber: '4111 1111 1111 1111',
    expiry: '12/28',
    cvv: '123',
    otp: '123456',
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  /**
   * Initiate Paymob Card Payment Session via backend
   */
  const initiateSession = useCallback(async () => {
    if (!amount || amount <= 0) {
      setErrorMsg('قيمة الطلب غير صالحة لإتمام الدفع');
      return;
    }

    setLoading(true);
    setIframeLoading(true);
    setErrorMsg(null);
    setPaymentOutcome(null);

    try {
      const payload = {
        amount,
        orderId: orderId || `ORD_${Date.now()}`,
        billingData: {
          firstName: billingData?.firstName || 'Customer',
          lastName: billingData?.lastName || 'Shopper',
          email: billingData?.email || 'customer@example.com',
          phoneNumber: billingData?.phoneNumber || '+201000000000',
          city: billingData?.city || 'Cairo',
          street: billingData?.street || 'El Tahrir',
          country: billingData?.country || 'EGY',
          state: billingData?.state || 'Cairo',
          ...billingData,
        },
      };

      const res = await apiClient.post('/payments/paymob/initiate', payload);
      const data = res.data?.data || res.data;

      if (!data?.iframeUrl) {
        throw new Error('لم يتم استلام رابط إطار الدفع من الخادم');
      }

      setIframeUrl(data.iframeUrl);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'فشل الاتصال ببوابة الدفع Paymob، يرجى المحاولة لاحقاً';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [amount, orderId, billingData, onError]);

  // Initiate when modal opens
  useEffect(() => {
    if (isOpen) {
      initiateSession();
    } else {
      setIframeUrl(null);
      setErrorMsg(null);
      setPaymentOutcome(null);
      setIframeLoading(true);
    }
  }, [isOpen, initiateSession]);

  /**
   * Listen for postMessage from Paymob redirect/callback inside the iframe
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Paymob postMessage handling
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'PAYMOB_PAYMENT_COMPLETED') {
        const { success, transactionId, orderIdentifier } = event.data;
        if (success) {
          setPaymentOutcome('SUCCESS');
          setOutcomeData(event.data);
          onSuccess?.({
            transactionId,
            orderIdentifier: orderIdentifier || orderId,
            raw: event.data,
          });
        } else {
          setPaymentOutcome('FAILED');
          setOutcomeData(event.data);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess, orderId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-gray-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600 font-bold shadow-sm">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                بوابة الدفع الآمن Paymob
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  PCI-DSS مشفر
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                المبلغ المطلوب سداده:{' '}
                <span className="font-bold text-blue-700 text-sm">
                  {amount.toLocaleString('ar-EG')} ج.م
                </span>{' '}
                {orderId && (
                  <span className="text-gray-400 mr-2">• طلب #{orderId}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {iframeUrl && (
              <a
                href={iframeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="فتح في نافذة مستقلة"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col space-y-4">
          {/* Test Card Quick Helper (Sandbox Drawer) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:p-4 text-amber-900 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setShowTestCards(!showTestCards)}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                بيانات بطاقة اختبارية (Paymob Sandbox Card) لتجربة الدفع الفوري:
              </div>
              <button
                type="button"
                className="text-xs text-amber-700 font-medium flex items-center gap-1 hover:underline"
              >
                {showTestCards ? 'إخفاء' : 'عرض البيانات'}
                {showTestCards ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>

            {showTestCards && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-200/60 text-xs">
                {/* Card Number */}
                <div className="bg-white/80 p-2 rounded-lg border border-amber-200 flex items-center justify-between">
                  <div>
                    <div className="text-gray-500 text-[10px]">رقم البطاقة</div>
                    <div className="font-mono font-semibold text-gray-800">
                      {testCard.cardNumber}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(testCard.cardNumber.replace(/\s/g, ''), 'card')
                    }
                    className="p-1 text-gray-400 hover:text-blue-600 transition"
                    title="نسخ رقم البطاقة"
                  >
                    {copiedKey === 'card' ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Expiry */}
                <div className="bg-white/80 p-2 rounded-lg border border-amber-200 flex items-center justify-between">
                  <div>
                    <div className="text-gray-500 text-[10px]">تاريخ الانتهاء</div>
                    <div className="font-mono font-semibold text-gray-800">
                      {testCard.expiry}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(testCard.expiry, 'exp')}
                    className="p-1 text-gray-400 hover:text-blue-600 transition"
                    title="نسخ تاريخ الانتهاء"
                  >
                    {copiedKey === 'exp' ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* CVV */}
                <div className="bg-white/80 p-2 rounded-lg border border-amber-200 flex items-center justify-between">
                  <div>
                    <div className="text-gray-500 text-[10px]">رمز الأمان (CVV)</div>
                    <div className="font-mono font-semibold text-gray-800">
                      {testCard.cvv}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(testCard.cvv, 'cvv')}
                    className="p-1 text-gray-400 hover:text-blue-600 transition"
                    title="نسخ CVV"
                  >
                    {copiedKey === 'cvv' ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* OTP */}
                <div className="bg-white/80 p-2 rounded-lg border border-amber-200 flex items-center justify-between">
                  <div>
                    <div className="text-gray-500 text-[10px]">كود التحقق (OTP)</div>
                    <div className="font-mono font-semibold text-gray-800">
                      {testCard.otp}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(testCard.otp, 'otp')}
                    className="p-1 text-gray-400 hover:text-blue-600 transition"
                    title="نسخ OTP"
                  >
                    {copiedKey === 'otp' ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="relative min-h-[580px] w-full flex-1 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
            {/* 1. Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center space-y-3 p-8 text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <h4 className="text-base font-semibold text-gray-800">
                  جاري تهيئة جلسة الدفع المشفرة مع Paymob...
                </h4>
                <p className="text-xs text-gray-500 max-w-sm">
                  يتم الآن تسجيل الطلب وتوليد مفتاح الدفع الرقمي، يرجى الانتظار بضع ثوانٍ.
                </p>
              </div>
            )}

            {/* 2. Error State */}
            {errorMsg && !loading && (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md">
                <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">تعذر تحميل بوابة الدفع</h4>
                  <p className="text-sm text-gray-600 mt-1">{errorMsg}</p>
                </div>
                <button
                  onClick={initiateSession}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  إعادة المحاولة
                </button>
              </div>
            )}

            {/* 3. Successful Outcome Overlay */}
            {paymentOutcome === 'SUCCESS' && (
              <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  تمت عملية الدفع بنجاح!
                </h3>
                <p className="text-sm text-gray-500 max-w-sm mb-4">
                  تم استلام المبلغ وتأكيد المعاملة من خلال Paymob وتحديث حالة الطلب إلى مدفوع.
                </p>
                {outcomeData?.transactionId && (
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-xs text-gray-700 mb-6">
                    رقم المعاملة: {outcomeData.transactionId}
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition shadow-sm"
                >
                  إتمام ومتابعة الطلب
                </button>
              </div>
            )}

            {/* 4. Failed Outcome Overlay */}
            {paymentOutcome === 'FAILED' && (
              <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  فشلت عملية الدفع
                </h3>
                <p className="text-sm text-gray-500 max-w-sm mb-6">
                  تم رفض المعاملة من قِبل البنك المصدر أو لم يتم إكمال خطوة التحقق الثلاثي (3DS). يمكنك إعادة المحاولة مجدداً.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={initiateSession}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition"
                  >
                    إعادة المحاولة
                  </button>
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* 5. Live Paymob iFrame */}
            {iframeUrl && !loading && !errorMsg && (
              <div className="relative w-full h-full min-h-[580px]">
                {iframeLoading && (
                  <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-xs text-gray-500 font-medium">
                      جاري تحميل نموذج بطاقة الدفع من Paymob...
                    </span>
                  </div>
                )}
                <iframe
                  src={iframeUrl}
                  title="Paymob Payment Gateway"
                  className="w-full h-full min-h-[580px] border-0 rounded-xl bg-white"
                  allow="payment; encrypted-media"
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-gray-400" />
            <span>بيانات بطاقتك البنكية محمية بالكامل ولا يتم حفظها على خوادمنا</span>
          </div>
          <div className="font-semibold text-gray-700">
            Powered by <span className="text-blue-600">Paymob</span>
          </div>
        </div>
      </div>
    </div>
  );
};
