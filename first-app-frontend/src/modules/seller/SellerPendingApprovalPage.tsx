import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Clock,
  RefreshCw,
  LogOut,
  Home,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import apiClient from '../../api/client';

export const SellerPendingApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const checkStatus = async () => {
    setIsRefreshing(true);
    setStatusMessage(null);
    try {
      // Re-fetch current user profile to see if approved
      const response = await apiClient.get('/user/profile');
      const profileData = response.data?.user || response.data?.data || response.data;
      if (profileData) {
        updateUser(profileData);
        const currentStatus = (profileData.entityStatus || '').toUpperCase();
        if (currentStatus === 'APPROVED' || currentStatus === 'ACTIVE') {
          navigate('/vendor/dashboard', { replace: true });
          return;
        }
      }
      setStatusMessage('تم التحقق: طلب متجرك لا يزال قيد المراجعة الإدارية من قبل فريق العمل.');
    } catch {
      setStatusMessage('لم نتمكن من جلب الحالة المحدثة في الوقت الحالي.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12" dir="rtl">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden text-center">
        {/* Banner with animated hourglass / clock */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 p-10 text-white relative">
          <div className="w-20 h-20 bg-white/15 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            <Clock className="w-10 h-10 text-white animate-pulse" />
          </div>
          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm border border-white/30 text-white mb-2">
            حالة الطلب: قيد المراجعة والتدقيق
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            طلب انضمام متجرك قيد المراجعة الإدارية
          </h1>
          <p className="text-amber-100 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
            شكراً لاهتمامك بالانضمام لمنصتنا! يقوم فريق الإدارة حالياً بمراجعة وتدقيق بيانات متجرك ومستنداتك
          </p>
        </div>

        {/* Content Details */}
        <div className="p-8 space-y-6">
          {statusMessage && (
            <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-2xl border border-blue-200 shadow-sm animate-fade-in font-medium">
              {statusMessage}
            </div>
          )}

          {/* Verification steps status */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-right space-y-3.5">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              مراحل تفعيل حساب البائع:
            </h2>
            <div className="flex items-center gap-3 text-slate-700 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>تم استلام بيانات الحساب والمتجر بنجاح</span>
            </div>
            <div className="flex items-center gap-3 text-slate-700 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>تم تأكيد البريد الإلكتروني ورقم الهاتف</span>
            </div>
            <div className="flex items-center gap-3 text-amber-700 font-semibold text-sm">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 animate-spin" />
              <span>مراجعة النشاط التجاري وتفعيل لوحة التحكم (جارية الآن)</span>
            </div>
          </div>

          {/* User info card */}
          {user && (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-600 text-right">
              <div>
                <span className="block font-bold text-slate-800 text-sm">{user.userName}</span>
                <span className="text-slate-500">{user.email}</span>
              </div>
              <div className="text-left">
                <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-800 font-semibold rounded-lg">
                  PENDING_APPROVAL
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            تستغرق عملية المراجعة في العادة من 24 إلى 48 ساعة عمل. ستصلك رسالة عبر بريدك الإلكتروني فور اعتماد متجرك ليصبح بإمكانك إضافة المنتجات فوراً.
          </p>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={checkStatus}
              disabled={isRefreshing}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'جارٍ التحقق...' : 'تحديث والتحقق من حالة الاعتماد'}</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/"
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Home className="w-4 h-4" />
                <span>الرئيسية</span>
              </Link>

              <button
                onClick={handleLogout}
                className="py-2.5 px-4 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-xs border border-transparent hover:border-red-200"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerPendingApprovalPage;
