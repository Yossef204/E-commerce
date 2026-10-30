import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Store,
  Building2,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  FileText,
  FileCheck,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { registerSeller } from '../../services/auth.service';

export const SellerRegisterPage: React.FC = () => {
  const navigate = useNavigate();

  // Personal Account Info
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Commercial Entity Info
  const [role, setRole] = useState<'SELLER' | 'COMPANY_ADMIN'>('SELLER');
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [taxOrCommercialNumber, setTaxOrCommercialNumber] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStrongPassword = (pass: string): boolean => {
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;
    return strongPasswordRegex.test(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isStrongPassword(password)) {
      setError(
        'كلمة المرور يجب أن تكون 8 أحرف على الأقل، وتحتوي على حرف كبير (A-Z)، وحرف صغير (a-z)، ورقم (0-9)، ورمز خاص (مثل: @, #, $, !, _).',
      );
      return;
    }

    if (!taxOrCommercialNumber.trim()) {
      setError('يرجى إدخال الرقم الضريبي أو رقم السجل التجاري.');
      return;
    }

    setIsLoading(true);

    try {
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

      await registerSeller({
        userName: userName.trim(),
        email: email.trim(),
        password,
        phoneNumber: formattedPhone,
        role,
        storeName: storeName.trim(),
        description: description.trim() || undefined,
        businessType: role === 'COMPANY_ADMIN' ? 'COMPANY' : 'INDEPENDENT_SELLER',
        taxOrCommercialNumber: taxOrCommercialNumber.trim(),
        documentUrl: documentUrl.trim() || undefined,
      });

      // عند النجاح: التوجيه فوراً إلى صفحة التحقق مع تمرير البريد الإلكتروني
      navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      const responseData = err.response?.data;
      const msg =
        responseData?.message ||
        'حدث خطأ أثناء تسجيل المتجر. يرجى التأكد من عدم تكرار البريد أو اسم المتجر.';
      setError(Array.isArray(msg) ? msg.join(' | ') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-10" dir="rtl">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            <Store className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            انضم كبائع أو شريك أعمال
          </h1>
          <p className="text-blue-100 text-sm mt-2 max-w-md mx-auto leading-relaxed">
            أنشئ حسابك التجاري وابدأ في عرض منتجاتك والوصول إلى آلاف العملاء عبر منصتنا
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-4 rounded-2xl flex items-start gap-3 border border-red-200 shadow-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {/* Role Selection Tabs */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-3">
              نوع النشاط التجاري المطلوب <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('SELLER')}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all text-center ${
                  role === 'SELLER'
                    ? 'border-blue-600 bg-blue-50/60 text-blue-900 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 ${
                    role === 'SELLER'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Store className="w-6 h-6" />
                </div>
                <span className="font-bold text-base">بائع مستقل (Seller)</span>
                <span className="text-xs text-slate-500 mt-1">
                  للأفراد وأصحاب المتاجر والمشاريع الناشئة
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRole('COMPANY_ADMIN')}
                className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all text-center ${
                  role === 'COMPANY_ADMIN'
                    ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 shadow-sm'
                    : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 ${
                    role === 'COMPANY_ADMIN'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="font-bold text-base">شركة / كيان مسجل (Company)</span>
                <span className="text-xs text-slate-500 mt-1">
                  للشركات والموزعين ذوي السجل التجاري الرسمي
                </span>
              </button>
            </div>
          </div>

          {/* Section 1: Personal Account Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
              <UserIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold">1. بيانات المسؤول عن الحساب</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  اسم المسؤول بالكامل <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                  />
                  <UserIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  رقم الهاتف للتواصل <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="01012345678"
                    dir="ltr"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm text-right"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  البريد الإلكتروني للعمل <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seller@domain.com"
                    dir="ltr"
                    className="w-full pr-3 pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm text-right"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  كلمة المرور <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-sm"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Business & Store Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
              <Store className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold">2. بيانات الكيان التجاري والمتجر</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  اسم المتجر / العلامة التجارية <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="مثال: إلكترونيات المستقبل"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm"
                  />
                  <Store className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {role === 'COMPANY_ADMIN'
                    ? 'رقم السجل التجاري / الرقم الضريبي'
                    : 'الرقم الضريبي أو الرقم القومي'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={taxOrCommercialNumber}
                    onChange={(e) => setTaxOrCommercialNumber(e.target.value)}
                    placeholder="مثال: 123-456-789"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm"
                  />
                  <FileText className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                نبذة عن نشاط المتجر والمنتجات
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="صف بإيجاز نوعية المنتجات أو الخدمات التي ستقدمها..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                رابط المستندات الثبوتية (سجل تجاري / بطاقة ضريبية / هوية)
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  placeholder="https://example.com/document.pdf"
                  dir="ltr"
                  className="w-full pr-3 pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-sm text-right"
                />
                <FileCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                اختياري: يمكنك تزويدنا برابط مستنداتك لتسريع وتيرة تدقيق واعتماد المتجر
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>إتمام تسجيل المتجر والمتابعة</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </>
            )}
          </button>

          {/* Mutual Navigation Links */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              لديك حساب بالفعل؟{' '}
              <Link
                to="/login"
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                تسجيل الدخول
              </Link>
            </div>
            <div>
              ترغب في التسوق فقط كعميل؟{' '}
              <Link
                to="/register"
                className="font-bold text-slate-700 hover:text-blue-600 hover:underline"
              >
                إنشاء حساب عميل عادي
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SellerRegisterPage;
