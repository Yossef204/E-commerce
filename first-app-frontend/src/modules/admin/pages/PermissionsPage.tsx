import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  UserCheck,
  Users,
  Save,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import adminApi from '../../../api/adminApi';

interface PermissionDefinition {
  id: string;
  name: string;
  category: 'products' | 'orders' | 'returns' | 'company' | 'finance' | 'admin';
  description: string;
  roles: Array<'CUSTOMER' | 'SELLER' | 'COMPANY_ADMIN' | 'ADMIN' | 'SUPER_ADMIN'>;
}

const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // 1. Products & Inventory
  {
    id: 'product.read',
    name: 'قراءة واستعراض المنتجات',
    category: 'products',
    description: 'استعراض تفاصيل وبيانات وكتالوج المنتجات والمخزون',
    roles: ['CUSTOMER', 'SELLER', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'product.create',
    name: 'إضافة منتجات جديدة',
    category: 'products',
    description: 'رفع منتجات وخيارات وأسعار جديدة لمتجر البائع',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'product.update',
    name: 'تعديل منتجات الكيان التجاري',
    category: 'products',
    description: 'تعديل السعر، الصور، والبيانات لمنتجات الكيان مع عزل نطاق الموارد',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'product.delete',
    name: 'حذف منتجات الكيان التجاري',
    category: 'products',
    description: 'أرشفة وحذف المنتجات الخاصة بالكيان التجاري',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'product.approve',
    name: 'اعتماد ومراجعة المنتجات',
    category: 'products',
    description: 'الموافقة على المنتجات وتعديلاتها لنشرها في الكتالوج العام للمنصة',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'inventory.update',
    name: 'تحديث كميات المخزون',
    category: 'products',
    description: 'تعديل الأرصدة والمخزون المتاح لكل SKU مع فحص الملكية',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },

  // 2. Orders & Fulfillment
  {
    id: 'order.read',
    name: 'استعراض تفاصيل الطلبات',
    category: 'orders',
    description: 'استعلام ومتابعة الطلبات المحددة بنطاق العميل أو التاجر أو المنصة',
    roles: ['CUSTOMER', 'SELLER', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'order.update_status',
    name: 'تحديث حالة معالجة الطلبات',
    category: 'orders',
    description: 'تغيير حالة الطلب من مؤكد إلى قيد التجهيز أو تم الشحن',
    roles: ['SELLER', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'order.cancel',
    name: 'إلغاء الطلبات',
    category: 'orders',
    description: 'إلغاء الطلب قيد الانتظار واسترداد المبالغ تلقائياً',
    roles: ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'],
  },

  // 3. Returns & Refunds
  {
    id: 'return.read',
    name: 'استعراض طلبات المرتجعات',
    category: 'returns',
    description: 'متابعة سجل المرتجعات وحالات الاسترجاع للبائع أو الإدارة',
    roles: ['SELLER', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'return.inspect',
    name: 'معاينة وفحص المنتج المرتجع',
    category: 'returns',
    description: 'فحص الشحنة المرتجعة وتأكيد سلامتها أو مطابقتها للمواصفات',
    roles: ['SELLER', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'refund.approve',
    name: 'الموافقة على استرداد المبالغ',
    category: 'returns',
    description: 'اعتماد استحقاق العميل للتعويض واسترداد قيمة الطلب',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'refund.execute',
    name: 'تنفيذ الاسترداد المالي المباشر',
    category: 'returns',
    description: 'تنفيذ التحويل البنكي أو المحفظة واسترجاع العمولات في دفتر الأستاذ',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },

  // 4. Company & Sellers Management
  {
    id: 'company.read',
    name: 'استعراض بيانات الكيانات والمتاجر',
    category: 'company',
    description: 'قراءة السجلات التجارية والوثائق الرسمية للشركات والبائعين',
    roles: ['SELLER', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'company.update',
    name: 'تحديث الملف التجاري للكيان',
    category: 'company',
    description: 'تعديل بيانات المتجر، العناوين، والممثل القانوني للكيان',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'company.approve',
    name: 'اعتماد تسجيل الشركات والمتاجر',
    category: 'company',
    description: 'مراجعة طلبات الانضمام واعتماد المتجر وتنشيط حالة البيع',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'seller.manage',
    name: 'إدارة وتجميد حسابات البائعين',
    category: 'company',
    description: 'إيقاف مؤقت، تجميد الحسابات، وسحب صلاحيات البيع عبر المنصة',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },

  // 5. Finance, Escrow & Ledger
  {
    id: 'ledger.read',
    name: 'استعراض قيود دفتر الأستاذ (Ledger)',
    category: 'finance',
    description: 'تدقيق القيود المالية، العمولات، وأرصدة الضمان المعلقة (Escrow)',
    roles: ['SELLER', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'payout.read',
    name: 'استعراض طلبات السحب والمستحقات',
    category: 'finance',
    description: 'متابعة سجل طلبات التحويل وأرصدة البائعين المتاحة للسحب',
    roles: ['SELLER', 'COMPANY_ADMIN', 'ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'payout.request',
    name: 'تقديم طلب سحب الأرباح',
    category: 'finance',
    description: 'طلب تحويل رصيد المبيعات المتاح إلى الحساب البنكي أو المحفظة',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'payout.approve',
    name: 'اعتماد وتنفيذ طلبات السحب المالي',
    category: 'finance',
    description: 'الموافقة على دفعات الأرباح للشركات والتجار وتنفيذ التحويل',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'commission.manage',
    name: 'إدارة وتحديد نسب عمولات المنصة',
    category: 'finance',
    description: 'تعديل نسب العمولة للفئات المختلفة أو للشركات الخاصة',
    roles: ['SUPER_ADMIN'],
  },

  // 6. Platform Administration & Security
  {
    id: 'user.manage',
    name: 'إدارة حسابات وأدوار المستخدمين',
    category: 'admin',
    description: 'ترقية الأدوار، تجميد المستخدمين، وإدارة موظفي المنصة',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'category.manage',
    name: 'إدارة تصنيفات وأقسام المنتجات',
    category: 'admin',
    description: 'إنشاء، تعديل، وترتيب الأقسام الرئيسية والفرعية للمتجر',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'settings.manage',
    name: 'إدارة الإعدادات العامة والسياسات',
    category: 'admin',
    description: 'التحكم في بوابات الدفع والتكاملات والإعدادات العامة',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'review.moderate',
    name: 'إدارة ومراجعة تقييمات المنتجات',
    category: 'admin',
    description: 'مراجعة واعتماد أو حذف التقييمات والمراجعات المخالفة',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'audit_log.read',
    name: 'عرض سجلات التدقيق والأمان',
    category: 'admin',
    description: 'الاطلاع على السجلات الأمنية والعمليات الحساسة عبر المنصة',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
];

export const PermissionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'assign'>('matrix');

  // Matrix Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Staff & Users Assign states
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('ADMIN');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<string[]>([]);
  const [loadingUserPerms, setLoadingUserPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Load users list
  useEffect(() => {
    if (activeTab === 'assign') {
      const fetchUsers = async () => {
        try {
          setLoadingUsers(true);
          const data = await adminApi.getUsers(roleFilter);
          setUsers(data);
          if (data.length > 0 && !selectedUserId) {
            setSelectedUserId(data[0]._id || data[0].id);
          }
        } catch (err: any) {
          console.error('Error fetching users:', err);
        } finally {
          setLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, [activeTab, roleFilter]);

  // Load selected user permissions
  useEffect(() => {
    if (activeTab === 'assign' && selectedUserId) {
      const fetchPerms = async () => {
        try {
          setLoadingUserPerms(true);
          setSaveSuccessMsg(null);
          setSaveErrorMsg(null);
          const perms = await adminApi.getUserPermissions(selectedUserId);
          setSelectedUserPermissions(perms);
        } catch (err: any) {
          console.error('Error fetching user permissions:', err);
        } finally {
          setLoadingUserPerms(false);
        }
      };
      fetchPerms();
    }
  }, [activeTab, selectedUserId]);

  const togglePermission = (permId: string) => {
    setSelectedUserPermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((p) => p !== permId)
        : [...prev, permId]
    );
  };

  const selectAllPermissions = () => {
    setSelectedUserPermissions(PERMISSIONS_CATALOG.map((p) => p.id));
  };

  const deselectAllPermissions = () => {
    setSelectedUserPermissions([]);
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUserId) return;
    try {
      setSavingPerms(true);
      setSaveSuccessMsg(null);
      setSaveErrorMsg(null);

      await adminApi.updateUserPermissions(selectedUserId, selectedUserPermissions);

      setSaveSuccessMsg(
        'تم حفظ مصفوفة الصلاحيات بنجاح، وتم إبطال جلسة المستخدم في Redis (auth:token_version) لإجباره على التحديث الفوري!'
      );
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      setSaveErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء حفظ الصلاحيات');
    } finally {
      setSavingPerms(false);
    }
  };

  const filteredPermissions = PERMISSIONS_CATALOG.filter((perm) => {
    const matchesSearch =
      perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || perm.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const selectedUser = users.find((u) => (u._id || u.id) === selectedUserId);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900">
              منظومة الصلاحيات الدقيقة وإبطال الجلسات (Granular RBAC Control)
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            التحكم الشامل في صلاحيات العمليات الحساسة، عزل نطاق الموارد، وتحديث الصلاحيات الفوري عبر Redis
          </p>
        </div>

        <div className="flex items-center gap-2 bg-amber-50/70 border border-amber-200 px-3.5 py-2 rounded-xl text-amber-900 text-xs font-bold">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>تجاوز السوبر أدمن تلقائي | موظفي المنصة يخضعون للفحص الدقيق</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'matrix'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>المصفوفة العامة للصلاحيات (24 عملية)</span>
        </button>

        <button
          onClick={() => setActiveTab('assign')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'assign'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>تخصيص وإسناد الصلاحيات للمستخدمين والموظفين</span>
        </button>
      </div>

      {/* TAB 1: General RBAC Matrix */}
      {activeTab === 'matrix' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filter and Search Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="بحث باسم الصلاحية أو المعرّف البرمجي..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-800"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {[
                { id: 'all', label: 'كافة الصلاحيات' },
                { id: 'products', label: 'المنتجات والمخزون' },
                { id: 'orders', label: 'الطلبات والتجهيز' },
                { id: 'returns', label: 'المرتجعات والاسترداد' },
                { id: 'company', label: 'إدارة الكيانات والتجار' },
                { id: 'finance', label: 'المالية والتسويات' },
                { id: 'admin', label: 'إدارة المنصة والأمان' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions Table Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-bold">
                    <th className="py-3.5 px-4 font-black">الصلاحية والتوصيف البرمجي</th>
                    <th className="py-3.5 px-3 text-center">العميل (CUSTOMER)</th>
                    <th className="py-3.5 px-3 text-center">التاجر المستقل (SELLER)</th>
                    <th className="py-3.5 px-3 text-center">مدير الشركة (COMPANY_ADMIN)</th>
                    <th className="py-3.5 px-3 text-center">موظف المنصة (ADMIN)</th>
                    <th className="py-3.5 px-3 text-center">سوبر أدمن (SUPER_ADMIN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPermissions.map((perm) => (
                    <tr key={perm.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{perm.name}</div>
                        <div className="font-mono text-[11px] text-amber-700 mt-0.5">{perm.id}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{perm.description}</div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-3 text-center">
                        {perm.roles.includes('CUSTOMER') ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>

                      {/* Seller */}
                      <td className="py-3.5 px-3 text-center">
                        {perm.roles.includes('SELLER') ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>

                      {/* Company Admin */}
                      <td className="py-3.5 px-3 text-center">
                        {perm.roles.includes('COMPANY_ADMIN') ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>

                      {/* Staff Admin */}
                      <td className="py-3.5 px-3 text-center">
                        {perm.roles.includes('ADMIN') ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-50 text-blue-600 rounded-full border border-blue-200 font-bold text-[10px]" title="ممنوحة حسب مصفوفة الموظف">
                            نعم
                          </span>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>

                      {/* Super Admin */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 bg-purple-50 text-purple-700 rounded-full border border-purple-200 font-bold text-[10px]" title="تجاوز شامل (Bypass)">
                          تجاوز
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live Assign & Invalidation */}
      {activeTab === 'assign' && (
        <div className="space-y-6 animate-fade-in">
          {/* Notifications */}
          {saveSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {saveErrorMsg && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-bold animate-fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{saveErrorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Select User / Staff */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  <h2 className="font-bold text-sm text-slate-800">اختر المستخدم / الموظف</h2>
                </div>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-[11px] font-bold rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
                >
                  <option value="ADMIN">موظفي الإدارة (ADMIN)</option>
                  <option value="SELLER">التجار (SELLER)</option>
                  <option value="COMPANY_ADMIN">مديري الشركات (COMPANY_ADMIN)</option>
                  <option value="ALL">كافة المستخدمين</option>
                </select>
              </div>

              {loadingUsers ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="text-xs">جارٍ تحميل قائمة المستخدمين...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  لا يوجد مستخدمين مطابقين لهذا الدور حالياً.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {users.map((u) => {
                    const id = u._id || u.id;
                    const isSelected = selectedUserId === id;
                    return (
                      <div
                        key={id}
                        onClick={() => setSelectedUserId(id)}
                        className={`p-3 rounded-xl border text-right cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-amber-300 shadow-sm'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">{u.userName || u.email}</span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                            {u.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">{u.email}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Permissions Matrix for Selected User */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>تخصيص الصلاحيات لـ: {selectedUser?.userName || selectedUser?.email || 'اختر مستخدماً'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    الدور الحالي: <span className="font-bold text-amber-700">{selectedUser?.role || '-'}</span> | إجمالي الصلاحيات الممنوحة: {selectedUserPermissions.length} من {PERMISSIONS_CATALOG.length}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllPermissions}
                    type="button"
                    className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    تحديد الكل
                  </button>
                  <button
                    onClick={deselectAllPermissions}
                    type="button"
                    className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Square className="w-3.5 h-3.5" />
                    إلغاء الكل
                  </button>
                </div>
              </div>

              {loadingUserPerms ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <span className="text-xs">جارٍ جلب الصلاحيات المسجلة في قاعدة البيانات...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Categorized Permissions Grid */}
                  {[
                    { id: 'products', title: 'صلاحيات المنتجات والمخزون' },
                    { id: 'orders', title: 'صلاحيات الطلبات والتجهيز' },
                    { id: 'returns', title: 'صلاحيات المرتجعات والاسترداد' },
                    { id: 'company', title: 'صلاحيات الكيانات والتجار' },
                    { id: 'finance', title: 'صلاحيات المالية والتسويات والـ Escrow' },
                    { id: 'admin', title: 'صلاحيات إدارة المنصة والأمان' },
                  ].map((category) => {
                    const catPerms = PERMISSIONS_CATALOG.filter((p) => p.category === category.id);
                    return (
                      <div key={category.id} className="space-y-3">
                        <div className="text-xs font-extrabold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          {category.title}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {catPerms.map((perm) => {
                            const isChecked = selectedUserPermissions.includes(perm.id);
                            return (
                              <label
                                key={perm.id}
                                onClick={() => togglePermission(perm.id)}
                                className={`flex items-start gap-3 p-3 rounded-xl border text-right cursor-pointer transition-all select-none ${
                                  isChecked
                                    ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                />
                                <div>
                                  <div className="font-bold text-xs text-slate-900">{perm.name}</div>
                                  <div className="font-mono text-[10px] text-amber-700 mt-0.5">{perm.id}</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{perm.description}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Save Button */}
                  <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                      <span>عند الحفظ، سيتم تحديث Redis فوراً لإلغاء صلاحية التوكن القديم للعميل.</span>
                    </div>

                    <button
                      onClick={handleSaveUserPermissions}
                      disabled={savingPerms || !selectedUserId}
                      className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black px-6 py-2.5 rounded-xl shadow-md shadow-amber-500/20 text-xs transition-all disabled:opacity-50"
                    >
                      {savingPerms ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>حفظ الصلاحيات وتحديث الجلسة الفوري</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionsPage;
