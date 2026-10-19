import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, KeyRound, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import apiClient from '../../api/client';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/forgot-password', {
        email: email.trim(),
      });

      const msg =
        response.data?.message ||
        'تم إرسال رمز التحقق (OTP) بنجاح إلى بريدك الإلكتروني.';
      setSuccessMsg(msg);

      // Auto redirect to reset password page after 1.5s
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
      }, 1500);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'تعذر إرسال رمز التحقق. يرجى التأكد من صحة البريد الإلكتروني والمحاولة مرة أخرى.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">نسيت كلمة المرور؟</h2>
          <p className="text-blue-100 text-xs mt-1 leading-relaxed">
            أدخل عنوان بريدك الإلكتروني وسنرسل لك رمز OTP مكون من 6 أرقام لاستعادة حسابك
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-start gap-3 border border-red-200 shadow-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-700 text-sm p-4 rounded-xl flex items-start gap-3 border border-emerald-200 shadow-sm animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{successMsg}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              البريد الإلكتروني المسجل
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-slate-800"
              />
              <Mail className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !!successMsg}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>إرسال رمز التحقق</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </>
            )}
          </button>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <Link
              to="/login"
              className="font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              العودة لتسجيل الدخول
            </Link>
            <Link
              to="/reset-password"
              className="text-slate-500 hover:text-slate-800 underline"
            >
              لدي رمز تحقق بالفعل
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

