import React, { useState, useEffect } from 'react';
import {
  User,
  MapPin,
  Package,
  Lock,
  Mail,
  Phone,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import apiClient from '../../../api/client';
import { useAuthStore } from '../../../store/useAuthStore';

interface OrderItem {
  sku?: string;
  titleSnapshot?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

interface OrderRecord {
  _id: string;
  totalAmount: number;
  status?: string;
  shippingAddress?: string;
  createdAt?: string;
  items?: OrderItem[];
}

export const ProfilePage: React.FC = () => {
  const { user: authUser, setAuth, token, refreshToken, sessionId } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'personal' | 'addresses' | 'orders' | 'password'>('personal');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Profile data
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addresses, setAddresses] = useState<string[]>([]);
  const [newAddressInput, setNewAddressInput] = useState('');

  // Orders
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  // Password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/users/profile');
      const data = res.data?.data || res.data;
      const user = data.user || {};

      setUserName(user.userName || '');
      setEmail(user.email || '');
      setPhoneNumber(user.phoneNumber || '');
      setAddresses(user.addresses || (user.address ? [user.address] : []));
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await apiClient.patch('/users/profile', {
        userName: userName.trim(),
        phoneNumber: phoneNumber.trim(),
      });

      const updatedUser = res.data?.data?.user || res.data?.user;
      if (updatedUser && authUser) {
        setAuth({
          token: token || '',
          refreshToken: refreshToken || undefined,
          sessionId: sessionId || undefined,
          user: {
            ...authUser,
            userName: updatedUser.userName || userName,
          },
        });
      }

      setFeedback({ type: 'success', message: 'تم تحديث البيانات الشخصية بنجاح' });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'فشل تحديث البيانات الشخصية';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async () => {
    if (!newAddressInput.trim()) return;
    const updatedList = [...addresses, newAddressInput.trim()];
    setAddresses(updatedList);
    setNewAddressInput('');

    try {
      setSaving(true);
      await apiClient.patch('/users/profile', {
        addresses: updatedList,
        address: updatedList[0] || '',
      });
      setFeedback({ type: 'success', message: 'تمت إضافة العنوان بنجاح' });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'فشل حفظ العنوان';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAddress = async (indexToRemove: number) => {
    const updatedList = addresses.filter((_, i) => i !== indexToRemove);
    setAddresses(updatedList);

    try {
      setSaving(true);
      await apiClient.patch('/users/profile', {
        addresses: updatedList,
        address: updatedList[0] || '',
      });
      setFeedback({ type: 'success', message: 'تم حذف العنوان' });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'فشل حذف العنوان';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'كلمة المرور الجديدة وتأكيدها غير متطابقين' });
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch('/users/change-password', {
        oldPassword,
        newPassword,
      });

      setFeedback({ type: 'success', message: 'تم تغيير كلمة المرور بنجاح' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'فشل تغيير كلمة المرور. تأكد من صحة كلمة المرور الحالية';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" dir="rtl">
      {/* Header Profile Title */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-2xl">
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">{userName || 'الملف الشخصي'}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{email}</p>
            <span className="inline-block mt-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {authUser?.role || 'عميل'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar Tabs & Content */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex flex-col gap-1.5 h-fit">
          <button
            onClick={() => { setActiveTab('personal'); setFeedback(null); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-right ${
              activeTab === 'personal'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>المعلومات الشخصية</span>
          </button>

          <button
            onClick={() => { setActiveTab('addresses'); setFeedback(null); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-right ${
              activeTab === 'addresses'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>دفتر العناوين ({addresses.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('orders'); setFeedback(null); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-right ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>سجل الطلبات ({orders.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('password'); setFeedback(null); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-right ${
              activeTab === 'password'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>الأمان وتغيير كلمة المرور</span>
          </button>
        </div>

        {/* Tab Content Panel */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`mb-6 p-4 rounded-xl flex items-start gap-3 border text-xs font-bold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* TAB 1: Personal Info */}
          {activeTab === 'personal' && (
            <form onSubmit={handleUpdatePersonalInfo} className="space-y-5">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                المعلومات الشخصية
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    الاسم بالكامل
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs text-slate-800"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      disabled
                      value={email}
                      className="w-full pr-10 pl-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    رقم الهاتف
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs text-slate-800"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-colors disabled:opacity-60"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Addresses */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                دفتر العناوين المحفوظة
              </h2>

              {/* Add New Address */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAddressInput}
                  onChange={(e) => setNewAddressInput(e.target.value)}
                  placeholder="أدخل عنواناً جديداً (مثال: القاهرة، المعادي، شارع 9)"
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleAddAddress}
                  disabled={saving || !newAddressInput.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة</span>
                </button>
              </div>

              {/* Saved Addresses List */}
              <div className="space-y-3">
                {addresses.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    لا توجد عناوين مسجلة حتى الآن. أضف عنوان الشحن الخاص بك بالأعلى.
                  </p>
                ) : (
                  addresses.map((addr, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{addr}</span>
                          {idx === 0 && (
                            <span className="text-[10px] text-blue-600 font-semibold mt-0.5 inline-block">
                              العنوان الافتراضي
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAddress(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                        title="حذف العنوان"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Order History */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                سجل الطلبات السابقة
              </h2>

              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
                  <p className="text-xs font-bold text-slate-700">لم تقم بإجراء أي طلبات بعد</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    عند إتمام أي عملية شراء، ستظهر تفاصيل وحالة طلبك هنا مباشرة.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order._id}
                      className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-xs font-bold text-slate-900">
                            رقم الطلب: #{order._id.substring(order._id.length - 8).toUpperCase()}
                          </span>
                          {order.createdAt && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(order.createdAt).toLocaleDateString('ar-EG')}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-blue-600">
                            {(order.totalAmount || 0).toLocaleString()} ج.م
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                            {order.status || 'مكتمل'}
                          </span>
                        </div>
                      </div>

                      {order.shippingAddress && (
                        <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>عنوان الشحن: {order.shippingAddress}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Change Password */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                تغيير كلمة المرور
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  كلمة المرور الحالية
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs text-slate-800"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs text-slate-800"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs text-slate-800"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-colors disabled:opacity-60"
                >
                  {saving ? 'جاري الحفظ...' : 'تحديث كلمة المرور'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
