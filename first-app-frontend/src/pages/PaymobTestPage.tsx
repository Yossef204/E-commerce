import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { PaymobIframeModal } from '../components/payment/PaymobIframeModal';

export const PaymobTestPage: React.FC = () => {
  const [amount, setAmount] = useState<number>(100);
  const [customOrderId, setCustomOrderId] = useState<string>(
    `TEST_${Date.now().toString().slice(-6)}`,
  );
  const [customerName, setCustomerName] = useState<string>('أحمد محمد');
  const [customerEmail, setCustomerEmail] = useState<string>('ahmed.test@example.com');
  const [customerPhone, setCustomerPhone] = useState<string>('+201012345678');
  const [customerCity, setCustomerCity] = useState<string>('القاهرة');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(true);
  const [logs, setLogs] = useState<Array<{ time: string; text: string; type: 'info' | 'success' | 'error' }>>([]);
  const [lastPayment, setLastPayment] = useState<any>(null);

  const addLog = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('ar-EG');
    setLogs((prev) => [{ time, text, type }, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    const fetchConfig = async () => {
      setConfigLoading(true);
      try {
        addLog('جلب الإعدادات العامة لـ Paymob من الخادم...', 'info');
        const res = await apiClient.get('/payments/paymob/config');
        setConfig(res.data);
        addLog(`تم جلب الإعدادات بنجاح (Iframe ID: ${res.data?.iframeId}, العملة: ${res.data?.currency})`, 'success');
      } catch (err: any) {
        addLog(`فشل جلب إعدادات Paymob: ${err.message}`, 'error');
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleLaunchPayment = () => {
    addLog(`بدء جلسة دفع جديدة بمبلغ ${amount} ج.م للطلب #${customOrderId}`, 'info');
    setIsModalOpen(true);
  };

  const handleSuccess = (result: any) => {
    addLog(`✓ نجحت المعاملة! رقم المعاملة: ${result?.transactionId || 'N/A'}`, 'success');
    setLastPayment(result);
  };

  const handleError = (error: any) => {
    addLog(`✗ فشل في عملية الدفع: ${error?.message || 'خطأ غير معروف'}`, 'error');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <CreditCard className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900">
                    لوحة اختبار بوابة الدفع Paymob
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live Sandbox
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  اختبار تكامل بطاقات الدفع البنكية عبر الخطوات الثلاث (Auth &gt; Order &gt; Payment Key) ونافذة الـ iFrame
                </p>
              </div>
            </div>

            {/* Gateway Status Badge */}
            <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl text-xs font-medium text-slate-700 border border-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {configLoading ? (
                <span>جاري فحص الاتصال...</span>
              ) : config ? (
                <span>Paymob Iframe ID: {config.iframeId || '1094250'}</span>
              ) : (
                <span className="text-red-600">تعذر الاتصال بالخادم</span>
              )}
            </div>
          </div>
        </div>

        {/* Grid: Payment Controls & Activity Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                تجهيز بيانات العملية التجريبية
              </h2>

              {/* Amount Quick Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  المبلغ المطلوب (جنيه مصري - EGP)
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[50, 100, 250, 500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className={`py-2 text-xs font-bold rounded-xl border transition ${
                        amount === val
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {val} ج.م
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-slate-900"
                    placeholder="مبلغ مخصص..."
                  />
                  <span className="absolute left-4 top-2.5 text-xs font-bold text-slate-400">
                    EGP
                  </span>
                </div>
              </div>

              {/* Order ID & Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    رقم الطلب (Order ID)
                  </label>
                  <input
                    type="text"
                    value={customOrderId}
                    onChange={(e) => setCustomOrderId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    اسم العميل (Billing)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    المدينة
                  </label>
                  <input
                    type="text"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-800"
                  />
                </div>
              </div>

              {/* Launch Button */}
              <button
                type="button"
                onClick={handleLaunchPayment}
                disabled={amount <= 0}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CreditCard className="w-5 h-5" />
                فتح نافذة الدفع المباشر (Paymob Modal)
              </button>
            </div>

            {/* Test Cards Reference Card */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 text-amber-900">
              <h3 className="font-bold text-sm flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                بيانات بطاقات الاختبار المعتمدة من Paymob:
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                  <span className="text-gray-500 block text-[10px]">رقم البطاقة</span>
                  <span className="font-mono font-bold">4111 1111 1111 1111</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                  <span className="text-gray-500 block text-[10px]">تاريخ الانتهاء</span>
                  <span className="font-mono font-bold">12/28</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                  <span className="text-gray-500 block text-[10px]">CVV</span>
                  <span className="font-mono font-bold">123</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                  <span className="text-gray-500 block text-[10px]">3DS OTP</span>
                  <span className="font-mono font-bold">123456</span>
                </div>
              </div>
            </div>
          </div>

          {/* Logs & Result Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Last Transaction Status */}
            {lastPayment && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 animate-in fade-in">
                <div className="flex items-center gap-3 text-emerald-800 font-bold mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  آخر عملية دفع تمت بنجاح
                </div>
                <div className="text-xs space-y-1 text-emerald-900 font-mono">
                  <div>معرف المعاملة: {lastPayment.transactionId}</div>
                  <div>معرف الطلب: {lastPayment.orderIdentifier}</div>
                </div>
              </div>
            )}

            {/* Live Event Terminal */}
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-sm border border-slate-800 flex flex-col h-[400px]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2 font-mono text-slate-400">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  سجل الأحداث المباشر (Gateway Logs)
                </div>
                <button
                  onClick={() => setLogs([])}
                  className="text-slate-400 hover:text-slate-200 text-[10px] underline"
                >
                  مسح السجل
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-1">
                {logs.length === 0 ? (
                  <div className="text-slate-500 text-center py-10">
                    لا توجد أحداث بعد. ابدأ عملية دفع لعرض السجلات.
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 text-[11px] ${
                        log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'error'
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      <span className="text-slate-500 text-[10px]">[{log.time}]</span>
                      <span>{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Paymob Iframe Modal */}
      <PaymobIframeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        amount={amount}
        orderId={customOrderId}
        billingData={{
          firstName: customerName.split(' ')[0] || 'Customer',
          lastName: customerName.split(' ')[1] || 'Shopper',
          email: customerEmail,
          phoneNumber: customerPhone,
          city: customerCity,
          street: 'El Tahrir St',
        }}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </div>
  );
};
