import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  X,
  Clock,
  Mail,
} from 'lucide-react';
import orderApi from '../../api/orderApi';

interface CodVerificationModalProps {
  isOpen: boolean;
  orderId: string;
  orderNumber?: string;
  phoneMasked?: string;
  onVerified: (data: any) => void;
  onCancel: () => void;
}

export const CodVerificationModal: React.FC<CodVerificationModalProps> = ({
  isOpen,
  orderId,
  orderNumber,
  phoneMasked = '010****1234',
  onVerified,
  onCancel,
}) => {
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes in seconds
  const [resendCooldown, setResendCooldown] = useState<number>(60); // 60 seconds cooldown
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount / open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Expiration countdown (5 minutes)
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  // Resend cooldown countdown (60 seconds)
  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;
    const cooldownTimer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(cooldownTimer);
  }, [isOpen, resendCooldown]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (index: number, value: string) => {
    setErrorMsg(null);
    const char = value.slice(-1).replace(/\D/g, ''); // keep only last typed digit

    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    // Auto-advance to next input
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits entered
    if (char && index === 5 && newOtp.every((digit) => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (pasteData.length >= 6) {
      const digits = pasteData.slice(0, 6).split('');
      setOtp(digits);
      inputRefs.current[5]?.focus();
      handleVerify(digits.join(''));
    } else if (pasteData.length > 0) {
      const digits = [...otp];
      for (let i = 0; i < pasteData.length && i < 6; i++) {
        digits[i] = pasteData[i];
      }
      setOtp(digits);
      const nextFocus = Math.min(5, pasteData.length);
      inputRefs.current[nextFocus]?.focus();
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || otp.join('');
    if (code.length !== 6) {
      setErrorMsg('يرجى إدخال رمز التحقق كاملاً المكون من 6 أرقام');
      return;
    }

    if (timeLeft <= 0) {
      setErrorMsg('انتهت صلاحية رمز التحقق، يرجى النقر على إعادة إرسال الرمز');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await orderApi.verifyCodOtp(orderId, code);
      setSuccessMsg('تم التحقق وتأكيد الطلب بنجاح!');
      setTimeout(() => {
        onVerified(res);
      }, 800);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'رمز التحقق غير صحيح، يرجى التأكد وإعادة المحاولة';
      setErrorMsg(msg);
      // Clear OTP inputs on failure
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;

    setResending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await orderApi.resendCodOtp(orderId);
      setSuccessMsg('تم إرسال رمز تحقق جديد إلى هاتفك بنجاح');
      setTimeLeft(300); // Reset 5-minute timer
      setResendCooldown(60); // Reset 60s cooldown
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.message || 'تعذر إعادة إرسال الرمز، يرجى الانتظار قليلاً'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                تأكيد طلب الدفع عند الاستلام
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {orderNumber ? `الطلب #${orderNumber}` : 'التحقق من رقم الهاتف'}
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
            title="إلغاء"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 space-y-1.5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-black text-blue-900">
            <Mail className="w-4 h-4 text-blue-600" />
            <span>تم إرسال رمز التحقق إلى بريدك الإلكتروني</span>
          </div>
          {phoneMasked && (
            <div className="text-[11px] text-slate-500 font-mono">
              ورقم هاتفك المسجل: <span className="font-bold text-slate-800">{phoneMasked}</span>
            </div>
          )}
          <p className="text-[11px] text-slate-500 pt-1">
            لضمان جدية طلب الدفع عند الاستلام وحجز المنتجات من المتاجر، يرجى إدخال الرمز المكون من 6 أرقام.
          </p>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* OTP Inputs Grid (Left-to-Right layout for digits) */}
        <div className="space-y-4">
          <div className="flex justify-center gap-2 sm:gap-3" dir="ltr">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={loading}
                className={`w-11 h-14 sm:w-12 sm:h-14 text-center font-mono text-xl font-black text-slate-900 border-2 rounded-xl bg-white transition-all outline-none shadow-sm ${
                  errorMsg
                    ? 'border-rose-400 focus:border-rose-600 focus:ring-4 focus:ring-rose-500/10'
                    : 'border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10'
                }`}
              />
            ))}
          </div>

          {/* Error Message Displayed Directly Under OTP Inputs in Red */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 animate-shake text-center">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Countdown Timer */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>تنتهي صلاحية الرمز خلال:</span>
            <span
              className={`font-mono font-bold ${
                timeLeft < 60 ? 'text-rose-600 animate-pulse' : 'text-slate-800'
              }`}
            >
              {formatTimer(timeLeft)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => handleVerify()}
            disabled={loading || otp.join('').length !== 6 || timeLeft <= 0}
            className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>تأكيد الطلب الآن</span>
          </button>

          {/* Resend Button with Cooldown */}
          <div className="text-center pt-1">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending || loading}
              className={`text-xs font-bold transition inline-flex items-center gap-1.5 ${
                resendCooldown > 0
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-blue-600 hover:text-blue-700 cursor-pointer underline'
              }`}
            >
              {resending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>
                {resendCooldown > 0
                  ? `إعادة إرسال الرمز بعد (${resendCooldown} ثانية)`
                  : 'لم يصلك الرمز؟ إعادة الإرسال الآن'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodVerificationModal;
