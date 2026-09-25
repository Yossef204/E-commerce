import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User as UserIcon, Phone, AlertCircle, ArrowRight, Store, ShoppingBag } from 'lucide-react';
import apiClient from '../../api/client';

export const Register: React.FC = () => {
  const navigate = useNavigate();

  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [accountType, setAccountType] = useState<'CUSTOMER' | 'SELLER'>('CUSTOMER');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // دالة فحص كلمة المرور المطابقة لسلوك validator.js / IsStrongPassword في NestJS
  const isStrongPassword = (pass: string): boolean => {
    // تشترط: حرف صغير، حرف كبير، رقم، وأي رمز غير الحروف والأرقام (مثل @, #, $, _, !, %, -, إلخ)، بطول 8 أحرف فأكثر
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;
    return strongPasswordRegex.test(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // التحقق من قوة كلمة المرور قبل إرسال الطلب
    if (!isStrongPassword(password)) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل، وتحتوي على حرف كبير (A-Z)، وحرف صغير (a-z)، ورقم (0-9)، ورمز خاص (مثل: @, #, $, _, !).');
      return;
    }

    setIsLoading(true);

    try {
      // Backend validates phoneNumber as Egyptian number e.g. +2010... or 010...
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+2' + formattedPhone;
        } else if (!formattedPhone.startsWith('20')) {
          formattedPhone = '+20' + formattedPhone;
        } else {
          formattedPhone = '+' + formattedPhone;
        }
      }

      const response = await apiClient.post('/auth/register', {
        userName: userName.trim(),
        email: email.trim(),
        password,
        phoneNumber: formattedPhone,
        role: accountType,
      });

      if (response.data?.success || response.status === 201 || response.status === 200) {
        navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
      }
    } catch (err: any) {
      const responseData = err.response?.data;
      const msg = responseData?.message || 'حدث خطأ أثناء إنشاء الحساب. تأكد من صحة البيانات المعطاة.';
      setError(Array.isArray(msg) ? msg.join(' | ') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            <UserPlus className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">إنشاء حساب جديد</h2>
          <p className="text-blue-100 text-sm mt-1">انضم إلينا واستمتع بتجربة تسوق وإدارة متطورة</p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5" dir="rtl">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-start gap-3 border border-red-200 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {/* Account Type Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">نوع الحساب</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType('CUSTOMER')}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                  accountType === 'CUSTOMER'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>مشتري (مستهلك)</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('SELLER')}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                  accountType === 'SELLER'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>بائع / تاجر</span>
              </button>
            </div>
          </div>

          {/* User Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">اسم المستخدم</label>
            <div className="relative">
              <input
                type="text"
                required
                minLength={3}
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="YossefMohamed"
                className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-slate-800"
              />
              <UserIcon className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
          </div>

          {/* Email */}
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

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">رقم الهاتف (مصر)</label>
            <div className="relative">
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="01159139182"
                className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm text-slate-800"
              />
              <Phone className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">كلمة المرور القوية</label>
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
            <p className="text-xs text-slate-500 mt-1">يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص (مثل: @, #, $, _).</p>
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
                <span>تسجيل الحساب</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </>
            )}
          </button>

          <div className="pt-4 border-t border-slate-100 text-center text-sm text-slate-600">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
              تسجيل الدخول
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};