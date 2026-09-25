import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Package,
  PlusCircle,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
  Tag,
} from 'lucide-react';
import vendorApi from '../../../api/vendorApi';
import type { SellingEntity, VendorProduct } from '../../../types/vendor';

export const VendorProductsPage: React.FC = () => {
  const { entity } = useOutletContext<{ entity: SellingEntity | null }>();
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    const fetchProducts = async () => {
      if (!entity?._id) return;
      try {
        setLoading(true);
        const data = await vendorApi.getEntityProducts(entity._id);
        setProducts(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'فشل في تحميل قائمة المنتجات الخاصة بك');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [entity]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || p.approvalStatus === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string, rejectionReason?: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> معتمد للمتجر
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5" /> قيد المراجعة
          </span>
        );
      case 'REJECTED':
        return (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-xs font-bold self-start">
              <XCircle className="w-3.5 h-3.5" /> مرفوض
            </span>
            {rejectionReason && (
              <span className="text-[10px] text-rose-600 font-semibold bg-rose-50/50 p-1 rounded border border-rose-100">
                السبب: {rejectionReason}
              </span>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Create CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            إدارة كتالوج المنتجات
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            عرض وتتبع جميع المنتجات الخاصة بـ {entity?.tradeName} وحالة الاعتماد من الإدارة.
          </p>
        </div>

        <Link
          to="/vendor/products/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>إضافة منتج جديد</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المنتج..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'الكل' },
            { id: 'APPROVED', label: 'معتمدة' },
            { id: 'PENDING_APPROVAL', label: 'قيد المراجعة' },
            { id: 'REJECTED', label: 'مرفوضة' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product List Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <p className="text-xs text-slate-500 font-semibold">جاري تحضير كتالوج المنتجات...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-800">{error}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center shadow-sm">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">لا توجد منتجات تطابق البحث</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            {products.length === 0 ? 'قم بإضافة منتجك الأول لبدء البيع على المنصة.' : 'جرب تغيير كلمة البحث أو الفلتر.'}
          </p>
          {products.length === 0 && (
            <Link
              to="/vendor/products/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20"
            >
              <PlusCircle className="w-4 h-4" /> إضافة منتج جديد
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">اسم المنتج والوصف</th>
                  <th className="p-4">عدد المتغيرات (SKUs)</th>
                  <th className="p-4">نطاق السعر</th>
                  <th className="p-4">حالة الاعتماد</th>
                  <th className="p-4">تاريخ الإضافة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const prices = p.variants?.map((v) => v.price) || [0];
                  const minPrice = Math.min(...prices);
                  const maxPrice = Math.max(...prices);
                  const priceDisplay =
                    minPrice === maxPrice
                      ? `${minPrice.toLocaleString()} ج.م`
                      : `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()} ج.م`;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{p.title}</span>
                          <span className="text-slate-400 text-[11px] line-clamp-1 mt-0.5">
                            {p.description}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {p.variants?.length || 0} SKU
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-900">{priceDisplay}</td>
                      <td className="p-4">{getStatusBadge(p.approvalStatus, p.rejectionReason)}</td>
                      <td className="p-4 text-slate-400">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-EG') : 'الآن'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorProductsPage;
