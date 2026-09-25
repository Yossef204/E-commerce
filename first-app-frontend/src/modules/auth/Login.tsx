import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import apiClient from '../../api/client';
import { useAuthStore, parseJwt } from '../../store/useAuthStore';
import type { UserRole } from '../../types/auth';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleRedirect = (role: UserRole) => {
    switch (role) {
      case 'SELLER':
      case 'COMPANY_ADMIN':
      case 'seller':
        navigate('/vendor');
        break;
      case 'SUPER_ADMIN':
      case 'admin':
        navigate('/admin');
        break;
      case 'CUSTOMER':
      case 'user':
      default:
        navigate('/');
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim(),
        password,
      });

      const { accessToken, refreshToken, sessionId } = response.data.data;
      const parsedPayload = parseJwt(accessToken);

      const userRole: UserRole = parsedPayload?.role || 'CUSTOMER';
      const userObj = {
        id: parsedPayload?.sub || '',
        email: parsedPayload?.email || email.trim(),
        userName: email.split('@')[0],
        role: userRole,
      };

      setAuth({
        token: accessToken,
        refreshToken,
        sessionId,
        user: userObj,
      });

      handleRoleRedirect(userRole);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات والتحقق من تفعيل الحساب.';
      setError(msg);
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
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">تسجيل الدخول</h2>
          <p className="text-blue-100 text-sm mt-1">مرحباً بك مجدداً! يسعدنا رؤيتك مرة أخرى</p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5" dir="rtl">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-start gap-3 border border-red-200 shadow-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              البريد الإلكتروني
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

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-slate-800"
              />
              <Lock className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>تسجيل الدخول</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </>
            )}
          </button>

          <div className="pt-4 border-t border-slate-100 text-center text-sm text-slate-600">
            ليس لديك حساب بعد؟{' '}
            <Link to="/register" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
              إنشاء حساب جديد
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
