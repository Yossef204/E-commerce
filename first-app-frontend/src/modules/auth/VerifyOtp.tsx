import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { KeyRound, Mail, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import apiClient from '../../api/client';

export const VerifyOtp: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otp, setOtp] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/verify-otp', {
        email: email.trim(),
        otp: otp.trim(),
      });

      const msg = response.data?.message || 'تم تأكيد البريد الإلكتروني بنجاح!';
      setSuccessMsg(msg);

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'فشل تأكيد الرمز. يرجى التأكد من ادخال الرمز المكون من 6 أرقام بشكل صحيح.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            <KeyRound className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">تأكيد البريد الإلكتروني</h2>
          <p className="text-blue-100 text-sm mt-1">أدخل رمز التحقق (OTP) المكون من 6 أرقام</p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5" dir="rtl">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-start gap-3 border border-red-200 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-700 text-sm p-4 rounded-xl flex items-start gap-3 border border-emerald-200 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                {successMsg}
                <div className="text-xs text-emerald-600 mt-1">سيتم توجيهك لصفحة تسجيل الدخول...</div>
              </div>
            </div>
          )}

          {/* Email input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">البريد الإلكتروني</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-slate-800"
              />
              <Mail className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
          </div>

          {/* OTP Code Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">رمز التحقق (OTP)</label>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full text-center tracking-[0.5em] text-lg font-mono py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || otp.length !== 6}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>تأكيد الرمز</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </>
            )}
          </button>

          <div className="pt-4 border-t border-slate-100 text-center text-sm text-slate-600">
            العودة إلى{' '}
            <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
              تسجيل الدخول
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

