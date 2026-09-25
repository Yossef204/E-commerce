import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Boxes,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
} from 'lucide-react';
import vendorApi from '../../../api/vendorApi';
import type { SellingEntity, VendorProduct, Variant } from '../../../types/vendor';

interface InventoryRow {
  productId: string;
  productTitle: string;
  variant: Variant;
}

export const VendorInventoryPage: React.FC = () => {
  const { entity } = useOutletContext<{ entity: SellingEntity | null }>();
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Stock update action states
  const [updatingSku, setUpdatingSku] = useState<string | null>(null);
  const [updateOperation, setUpdateOperation] = useState<'ADD' | 'SET'>('ADD');
  const [updateQuantity, setUpdateQuantity] = useState<Record<string, number>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchProducts = async () => {
    if (!entity?._id) return;
    try {
      setLoading(true);
      const data = await vendorApi.getEntityProducts(entity._id);
      setProducts(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في تحميل منتجاتك للتحكم بالمخزون');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [entity]);

  // Flatten products to inventory rows (1 row per SKU)
  const inventoryRows: InventoryRow[] = [];
  products.forEach((p) => {
    p.variants?.forEach((v) => {
      inventoryRows.push({
        productId: p._id,
        productTitle: p.title,
        variant: v,
      });
    });
  });

  const filteredRows = inventoryRows.filter(
    (row) =>
      row.productTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.variant.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStockUpdate = async (sku: string) => {
    const qty = updateQuantity[sku] || 0;
    if (qty <= 0 && updateOperation === 'ADD') {
      setError('يرجى كتابة كمية أكبر من صفر للإضافة');
      return;
    }

    try {
      setUpdatingSku(sku);
      setError(null);
      await vendorApi.updateInventoryStock({
        sku,
        quantity: qty,
        operation: updateOperation,
      });

      setSuccessMsg(`تم تحديث مخزون SKU (${sku}) بنجاح!`);
      // Refresh products list
      await fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في تحديث كمية المخزون');
    } finally {
      setUpdatingSku(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-blue-600" />
            إدارة المخزون والتخزين
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            إعادة تعبئة أو ضبط كميات المتغيرات (SKUs) لمواجهة الطلبات المتزايدة.
          </p>
        </div>

        <button
          onClick={fetchProducts}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" /> تحديث البيانات
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter and Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالـ SKU أو اسم المنتج..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <span>وضع التحديث الافتراضي:</span>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setUpdateOperation('ADD')}
              className={`px-3 py-1 rounded-lg transition-all ${
                updateOperation === 'ADD'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              إضافة كمية (+ADD)
            </button>
            <button
              onClick={() => setUpdateOperation('SET')}
              className={`px-3 py-1 rounded-lg transition-all ${
                updateOperation === 'SET'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تعيين رقم ثابت (=SET)
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <p className="text-xs text-slate-500 font-semibold">جاري جلب بيانات المخزون الأحدث...</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center shadow-sm">
          <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">لا توجد أكواد SKUs للمخزون</h3>
          <p className="text-xs text-slate-400 mt-1">تأكد من إضافة منتجات أولاً من صفحة "إضافة منتج".</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">اسم المنتج</th>
                  <th className="p-4">كود المتغير (SKU)</th>
                  <th className="p-4">السعر</th>
                  <th className="p-4">تحديث الكمية</th>
                  <th className="p-4 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const sku = row.variant.sku;
                  const isUpdating = updatingSku === sku;
                  return (
                    <tr key={sku} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-900">{row.productTitle}</td>
                      <td className="p-4 font-mono font-semibold text-blue-600">{sku}</td>
                      <td className="p-4 font-bold text-slate-900">
                        {row.variant.price?.toLocaleString()} ج.م
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            placeholder="الكمية"
                            value={updateQuantity[sku] ?? 10}
                            onChange={(e) =>
                              setUpdateQuantity({
                                ...updateQuantity,
                                [sku]: Number(e.target.value),
                              })
                            }
                            className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white"
                          />
                          <span className="text-[10px] font-bold text-slate-400">
                            {updateOperation === 'ADD' ? '+ إضافة للموجود' : '= الكمية الإجمالية'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          disabled={isUpdating}
                          onClick={() => handleStockUpdate(sku)}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50 transition-all inline-flex items-center gap-1"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>تحديث</span>
                          )}
                        </button>
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

export default VendorInventoryPage;
