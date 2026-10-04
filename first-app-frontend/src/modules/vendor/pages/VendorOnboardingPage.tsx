import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Store,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  MapPin,
  Phone,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Home,
} from 'lucide-react';
import apiClient from '../../../api/client';
import { useAuthStore } from '../../../store/useAuthStore';
import vendorApi from '../../../api/vendorApi';
import type { SellingEntity } from '../../../types/vendor';

export const VendorOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useAuthStore();

  const isCompany =
    user?.role === 'COMPANY_ADMIN' || user?.role === 'company_admin';

  // Common Form Fields
  const [tradeName, setTradeName] = useState('');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [address, setAddress] = useState('');

  // Seller specific fields
  const [nationalId, setNationalId] = useState('');

  // Company specific fields
  const [companyLegalName, setCompanyLegalName] = useState('');
  const [commercialRegisterNumber, setCommercialRegisterNumber] = useState('');
  const [taxCardNumber, setTaxCardNumber] = useState('');
  const [brandName, setBrandName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission state & Existing Entity state
  const [existingEntity, setExistingEntity] = useState<SellingEntity | null>(null);

  // Check if user already submitted an entity
  const checkExistingEntity = async () => {
    // 1. Instant check from current user state
    const storeStatus = (user?.entityStatus || '').toUpperCase();
    if (user?.sellingEntityId) {
      if (storeStatus === 'APPROVED' || storeStatus === 'ACTIVE') {
        navigate('/vendor/dashboard', { replace: true });
        return;
      }
      if (storeStatus === 'PENDING_APPROVAL' && location.pathname === '/vendor/onboarding') {
        navigate('/vendor/pending-approval', { replace: true });
        return;
      }
    }

    if (!user?.id) {
      setIsChecking(false);
      return;
    }

    try {
      setIsChecking(true);
      const profile = await vendorApi.getProfile(user.id);
      if (profile) {
        setExistingEntity(profile);
        const status = (profile.status || '').toUpperCase();
        if (
          profile._id &&
          (!user.sellingEntityId ||
            user.sellingEntityId !== profile._id ||
            user.entityStatus !== status)
        ) {
          updateUser({
            sellingEntityId: profile._id,
            entityStatus: status,
          });
        }
        if (status === 'APPROVED' || status === 'ACTIVE') {
          navigate('/vendor/dashboard', { replace: true });
          return;
        }
        if (status === 'PENDING_APPROVAL' && location.pathname === '/vendor/onboarding') {
          navigate('/vendor/pending-approval', { replace: true });
          return;
        }
      }
    } catch {
      // 404 means no entity yet, proceed to onboarding form
      setExistingEntity(null);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkExistingEntity();
  }, [user?.id, user?.sellingEntityId, user?.entityStatus, location.pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let response;
      if (isCompany) {
        // Company Registration Payload
        response = await apiClient.post('/selling-entities/company', {
          legalName: companyLegalName.trim(),
          companyLegalName: companyLegalName.trim(),
          tradeName: tradeName.trim(),
          commercialRegister: commercialRegisterNumber.trim(),
          commercialRegisterNumber: commercialRegisterNumber.trim(),
          taxNumber: taxCardNumber.trim(),
          taxCardNumber: taxCardNumber.trim(),
          brandName: brandName.trim() || tradeName.trim(),
          phone: phone.trim(),
          address: address.trim(),
        });
      } else {
        // Independent Seller Registration Payload
        response = await apiClient.post('/selling-entities/independent-seller', {
          legalName: tradeName.trim(),
          tradeName: tradeName.trim(),
          nationalId: nationalId.trim(),
          phone: phone.trim(),
          address: address.trim(),
        });
      }

      const createdEntity: SellingEntity = response.data?.data || response.data;
      setExistingEntity(createdEntity);

      if (createdEntity?._id) {
        updateUser({
          sellingEntityId: createdEntity._id,
          entityStatus: createdEntity.status,
        });

        if (createdEntity.status === 'APPROVED' || createdEntity.status === 'ACTIVE') {
          navigate('/vendor/dashboard');
        } else if (createdEntity.status === 'PENDING_APPROVAL') {
          navigate('/vendor/pending-approval');
        }
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'حدث خطأ أثناء حفظ بيانات الكيان التجاري. يرجى مراجعة المدخلات.';
      setError(Array.isArray(msg) ? msg.join(' | ') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-bold">جاري فحص حالة الكيان التجاري...</p>
        </div>
      </div>
    );
  }

  // 1. PENDING APPROVAL SCREEN (Requirement 5)
  const displayEntity =
    existingEntity ||
    (user?.sellingEntityId
      ? ({
          _id: user.sellingEntityId,
          legalName: user.userName || 'الكيان التجاري',
          tradeName: user.userName || 'الكيان التجاري',
          type: isCompany ? 'COMPANY' : 'INDEPENDENT_SELLER',
          status: (user.entityStatus as any) || 'PENDING_APPROVAL',
          primaryOwnerId: user.id,
        } as any)
      : null);

  if (
    displayEntity &&
    (location.pathname === '/vendor/pending-approval' ||
      displayEntity.status === 'PENDING_APPROVAL')
  ) {
    const isApproved =
      displayEntity.status === 'APPROVED' || displayEntity.status === 'ACTIVE';

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden text-center p-8 sm:p-12 space-y-6">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner ${
              isApproved
                ? 'bg-emerald-50 text-emerald-600 animate-bounce'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            {isApproved ? (
              <CheckCircle2 className="w-12 h-12" />
            ) : (
              <Clock className="w-12 h-12" />
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              {isApproved
                ? 'تهانينا! تم اعتماد كيانك التجاري'
                : 'تم استلام بياناتك بنجاح!'}
            </h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              {isApproved
                ? 'تمت الموافقة وتفعيل حسابك التجاري بنجاح. يمكنك الآن الدخول لبوابة التاجر وإضافة المنتجات.'
                : 'حسابك قيد المراجعة والاعتماد من قبل إدارة المنصة (Super Admin). سنقوم بمراجعة وتدقيق المستندات المسجلة وتفعيل متجرك في أسرع وقت.'}
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-right space-y-3.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">الاسم التجاري:</span>
              <span className="font-bold text-slate-900">{displayEntity.tradeName || displayEntity.legalName}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">نوع الكيان:</span>
              <span className="font-semibold text-slate-800">
                {displayEntity.type === 'COMPANY' ? 'شركة / علامة تجارية' : 'تاجر مستقل / فرد'}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">حالة الاعتماد:</span>
              <span
                className={`font-mono font-bold text-xs px-2.5 py-1 rounded-full ${
                  isApproved
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {displayEntity.status}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-200/60 flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                {isApproved
                  ? 'بوابتك كاملة الصلاحيات لإدارة المنتجات والمبيعات.'
                  : 'تظل لوحة إضافة المنتجات مقفلة لحين تغيير الحالة إلى ACTIVE/APPROVED.'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {isApproved ? (
              <button
                onClick={() => navigate('/vendor')}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Store className="w-4 h-4" />
                <span>دخول بوابة التاجر</span>
              </button>
            ) : (
              <button
                onClick={checkExistingEntity}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تحديث حالة الطلب</span>
              </button>
            )}

            <Link
              to="/"
              className="py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Home className="w-4 h-4" />
              <span>المتجر كزائر</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. ONBOARDING REGISTRATION FORM (Requirement 3)
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-8 text-white text-center relative overflow-hidden">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            {isCompany ? (
              <Building2 className="w-9 h-9 text-purple-200" />
            ) : (
              <Store className="w-9 h-9 text-emerald-200" />
            )}
          </div>
          <h2 className="text-2xl font-black">
            {isCompany ? 'تسجيل بيانات الشركة / العلامة التجارية' : 'تسجيل بيانات التاجر المستقل'}
          </h2>
          <p className="text-blue-100 text-xs sm:text-sm mt-1">
            {isCompany
              ? 'يرجى استكمال البيانات القانونية والرسمية لاعتماد الشركة وعلامتك التجارية'
              : 'يرجى إدخال بياناتك الشخصية والتجارية للبدء في عرض منتجاتك'}
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl flex items-start gap-3 border border-red-200 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Trade Name (Common) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                الاسم التجاري للمتجر (Trade Name) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="مثال: متجر النخبة للملابس"
                  className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <Store className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {/* SELLER: National ID */}
            {!isCompany && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  الرقم القومي (National ID) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={14}
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="14 رقماً للتحقق من هوية التاجر"
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <CreditCard className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>
            )}

            {/* COMPANY: Legal Name */}
            {isCompany && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  اسم الشركة القانوني (Company Legal Name) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={companyLegalName}
                    onChange={(e) => setCompanyLegalName(e.target.value)}
                    placeholder="اسم الشركة كما هو مسجل بالسجل التجاري"
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <Building2 className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>
            )}

            {/* COMPANY: Commercial Register Number */}
            {isCompany && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  رقم السجل التجاري *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={commercialRegisterNumber}
                    onChange={(e) => setCommercialRegisterNumber(e.target.value)}
                    placeholder="CR-123456"
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <FileText className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>
            )}

            {/* COMPANY: Tax Card Number */}
            {isCompany && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  رقم البطاقة الضريبية *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={taxCardNumber}
                    onChange={(e) => setTaxCardNumber(e.target.value)}
                    placeholder="TAX-987654"
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <CreditCard className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>
            )}

            {/* COMPANY: Brand Name */}
            {isCompany && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  اسم العلامة التجارية المقترحة (Brand Name) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="مثال: Apple, Nike, إلخ"
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <FileText className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  سيتم إنشاء توثيق البراند تلقائياً بحالة غير نشطة حتى اعتماده من الإدارة.
                </p>
              </div>
            )}

            {/* Phone (Common) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                رقم هاتف التواصل *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <Phone className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {/* Address (Common) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                العنوان والمحافظة *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="القاهرة، مدينة نصر"
                  className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <MapPin className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>إرسال البيانات للمراجعة والاعتماد</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorOnboardingPage;

