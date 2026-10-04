import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface PermissionDefinition {
  id: string;
  name: string;
  category: 'storefront' | 'catalog' | 'orders' | 'vendor' | 'admin';
  description: string;
  roles: Array<'CUSTOMER' | 'SELLER' | 'COMPANY_ADMIN' | 'SUPER_ADMIN'>;
}

const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Storefront & Customer
  {
    id: 'profile.read',
    name: 'عرض الملف الشخصي',
    category: 'storefront',
    description: 'قراءة بيانات الحساب الشخصي والعناوين المحفوظة',
    roles: ['CUSTOMER', 'SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'profile.update',
    name: 'تحديث الملف الشخصي',
    category: 'storefront',
    description: 'تعديل البيانات الأساسية، الهاتف، وكلمة المرور',
    roles: ['CUSTOMER', 'SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'cart.manage',
    name: 'إدارة السلة الشرائية',
    category: 'storefront',
    description: 'إضافة المنتجات والخيارات إلى سلة التسوق وتعديل كمياتها',
    roles: ['CUSTOMER', 'SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'orders.create',
    name: 'إنشاء طلبات الشراء',
    category: 'storefront',
    description: 'إتمام عمليات الدفع والطلب في المتجر',
    roles: ['CUSTOMER', 'SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'orders.read_own',
    name: 'عرض طلباتي الشخصية',
    category: 'storefront',
    description: 'تتبع حالات الطلبات الخاصة بالمستخدم وسجل الفواتير',
    roles: ['CUSTOMER', 'SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'orders.cancel_own',
    name: 'إلغاء الطلبات الخاصة',
    category: 'storefront',
    description: 'إلغاء الطلب قيد الانتظار واسترجاع المبالغ تلقائياً',
    roles: ['CUSTOMER', 'SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'reviews.create',
    name: 'تقييم المنتجات',
    category: 'storefront',
    description: 'إضافة تقييم ومراجعة للمنتجات المشتراة مسبقاً',
    roles: ['CUSTOMER', 'SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },

  // Products & Catalog
  {
    id: 'products.create',
    name: 'إضافة منتجات جديدة',
    category: 'catalog',
    description: 'رفع منتجات وخيارات وسعر ومخزون لمتجر البائع',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'products.read_own',
    name: 'عرض منتجات البائع',
    category: 'catalog',
    description: 'عرض قائمة المنتجات التابعة للكيان التجاري',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'products.update_own',
    name: 'تعديل منتجات البائع',
    category: 'catalog',
    description: 'تعديل السعر، الصور، الوصف، والخيارات لمنتجات المتجر',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'products.delete_own',
    name: 'حذف منتجات البائع',
    category: 'catalog',
    description: 'أرشفة أو حذف المنتجات التابعة للكيان التجاري',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'products.approve',
    name: 'اعتماد ومراجعة المنتجات',
    category: 'catalog',
    description: 'الموافقة على المنتجات الجديدة ونشرها في الكتالوج العام',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'products.read_all',
    name: 'الوصول لكتالوج المنصة بالكامل',
    category: 'catalog',
    description: 'عرض جميع منتجات المنصة لجميع البائعين والكيانات',
    roles: ['SUPER_ADMIN'],
  },

  // Orders & Inventory
  {
    id: 'inventory.manage_own',
    name: 'إدارة مخزون البائع',
    category: 'orders',
    description: 'تحديث مستويات المخزون وحالات النفاد لمنتجات الكيان',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'orders.seller_read',
    name: 'عرض الطلبات الواردة للبائع',
    category: 'orders',
    description: 'عرض ومتابعة الطلبات الجزئية الخاصة بالمتجر',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'orders.status_update',
    name: 'تحديث حالة معالجة الطلبات',
    category: 'orders',
    description: 'تغيير حالة الطلب إلى قيد التجهيز أو تم الشحن',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'coupons.manage_own',
    name: 'إدارة كوبونات المتجر',
    category: 'orders',
    description: 'إنشاء وإيقاف كوبونات الخصم على مستوى الكيان التجاري',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },

  // Vendor & Staff
  {
    id: 'analytics.read_own',
    name: 'تحليلات وإحصاءات المتجر',
    category: 'vendor',
    description: 'متابعة المبيعات والأرباح ومعدل التحويل الخاص بالكيان',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'payout.request',
    name: 'طلب تسوية وسحب أرباح',
    category: 'vendor',
    description: 'تقديم طلب لتحويل المستحقات المتاحة بعد فك الحجز المالي',
    roles: ['SELLER', 'COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'company.staff_invite',
    name: 'دعوة موظفي الشركة',
    category: 'vendor',
    description: 'إرسال دعوات وإدارة صلاحيات فريق عمل الشركة',
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'company.staff_manage',
    name: 'إدارة موظفي الشركة',
    category: 'vendor',
    description: 'تعديل أو إلغاء وصول أعضاء فريق الكيان التجاري',
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },
  {
    id: 'company.profile_update',
    name: 'تحديث بيانات المنشأة',
    category: 'vendor',
    description: 'تحديث السجل التجاري والشعار والبيانات البنكية للشركة',
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  },

  // Platform & Escrow Administration
  {
    id: 'platform.super_admin',
    name: 'صلاحيات الإدارة العليا الكاملة',
    category: 'admin',
    description: 'التحكم الإداري والتقني الشامل في كافة إعدادات المنصة',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'selling_entity.approve',
    name: 'اعتماد الكيانات التجارية',
    category: 'admin',
    description: 'مراجعة طلبات الانضمام واعتماد أو رفض وثائق الشركات والتجار',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'selling_entity.suspend',
    name: 'تعليق حساب الكيان التجاري',
    category: 'admin',
    description: 'تجميد نشاط المتجر وإيقاف ظهوره في السوق عند المخالفات',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'commissions.manage',
    name: 'إدارة نسب العمولات المالية',
    category: 'admin',
    description: 'تحديد النسب والرسوم الثابتة المقتطعة لكل تاجر أو فئة',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'escrow.manage',
    name: 'إدارة حسابات الضمان (Escrow)',
    category: 'admin',
    description: 'فك الحجز اليدوي والتحكم بالدفتر المالي المزدوج غير القابل للتعديل',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'payout.process',
    name: 'معالجة وتنفيذ الحوالات المالية',
    category: 'admin',
    description: 'تنفيذ تسوية الدفعات المالية للمتاجر المستحقة',
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'audit_logs.read',
    name: 'عرض سجلات التدقيق والأمان',
    category: 'admin',
    description: 'الاطلاع على جميع العمليات الحساسة ومحاولات الوصول والأنشطة',
    roles: ['SUPER_ADMIN'],
  },
];

export const PermissionsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredPermissions = PERMISSIONS_CATALOG.filter((perm) => {
    const matchesSearch =
      perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || perm.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900">
              إدارة الصلاحيات والتحكم في الوصول (RBAC / PBAC)
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            مصفوفة الصلاحيات المطبقة على مستوى الـ Backend Guards وواجهات المنصة
          </p>
        </div>

        <div className="flex items-center gap-2 bg-amber-50/60 border border-amber-200/80 px-3.5 py-2 rounded-xl text-amber-900 text-xs font-bold">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>حماية مشددة: التوكنات مشفرة ومحقونة بصلاحيات الخادم فقط</span>
        </div>
      </div>

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
            { id: 'all', label: 'الكل' },
            { id: 'storefront', label: 'المتجر والعملاء' },
            { id: 'catalog', label: 'المنتجات والكتالوج' },
            { id: 'orders', label: 'الطلبات والمخزون' },
            { id: 'vendor', label: 'الكيانات والشركات' },
            { id: 'admin', label: 'الإدارة العليا والضمان' },
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
                <th className="py-3.5 px-3 text-center">سوبر أدمن (SUPER_ADMIN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPermissions.map((perm) => (
                <tr key={perm.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{perm.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{perm.description}</div>
                    <div className="font-mono text-[10px] text-slate-400 mt-0.5 tracking-tight">
                      {perm.id}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {perm.roles.includes('CUSTOMER') ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {perm.roles.includes('SELLER') ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {perm.roles.includes('COMPANY_ADMIN') ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {perm.roles.includes('SUPER_ADMIN') ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PermissionsPage;
