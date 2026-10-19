import React, { useEffect, useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  FolderTree,
  AlertTriangle,
  FileText,
  Calendar,
} from 'lucide-react';
import adminApi from '../../api/adminApi';
import type { CategoryAdmin } from '../../types/admin';

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast notification
  const [toast, setToast] = useState<ToastState | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryAdmin | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch categories from GET /category
  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getCategories();
      setCategories(data);
    } catch (err: any) {
      console.error('Failed to load categories', err);
      setError(err.response?.data?.message || 'فشل في تحميل قائمة الأقسام والتصنيفات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.slug && c.slug.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  // Handle open Create Modal
  const handleOpenCreateModal = () => {
    setName('');
    setDescription('');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Handle open Edit Modal
  const handleOpenEditModal = (cat: CategoryAdmin) => {
    setSelectedCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Handle open Delete Modal
  const handleOpenDeleteModal = (cat: CategoryAdmin) => {
    setSelectedCategory(cat);
    setIsDeleteModalOpen(true);
  };

  // Submit Create Category: POST /category
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('اسم القسم مطلوب');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await adminApi.createCategory({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      setIsCreateModalOpen(false);
      showToast('تمت إضافة القسم الجديد بنجاح!');
      await fetchCategories();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'فشل إنشاء القسم، يرجى المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Category: PATCH /category/:id
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory?._id) return;
    if (!name.trim()) {
      setFormError('اسم القسم مطلوب');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await adminApi.updateCategory(selectedCategory._id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      setIsEditModalOpen(false);
      setSelectedCategory(null);
      showToast('تم تحديث بيانات القسم بنجاح!');
      await fetchCategories();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'فشل تعديل القسم');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Delete Category: DELETE /category/:id
  const handleDeleteConfirm = async () => {
    if (!selectedCategory?._id) return;

    try {
      setSubmitting(true);
      await adminApi.deleteCategory(selectedCategory._id);
      setIsDeleteModalOpen(false);
      setSelectedCategory(null);
      showToast('تم حذف القسم بنجاح!');
      await fetchCategories();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'فشل حذف القسم', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-6 z-50 animate-bounce">
          <div
            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-xs font-bold border transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-900/95 text-emerald-100 border-emerald-700/60'
                : 'bg-rose-900/95 text-rose-100 border-rose-700/60'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="mr-2 text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-amber-500" />
            إدارة الأقسام والتصنيفات
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الكتالوج العام، إضافة أقسام جديدة، وتعديل أو حذف التصنيفات الخاصة بالمنتجات.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={fetchCategories}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة قسم جديد +</span>
          </button>
        </div>
      </div>

      {/* Search and Stats Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الكود (Slug)..."
            className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs font-bold text-slate-600 self-end sm:self-auto">
          <span className="bg-slate-100 px-3 py-1 rounded-lg">
            إجمالي الأقسام: <strong className="text-slate-900">{categories.length}</strong>
          </span>
          {searchQuery && (
            <span className="bg-amber-50 text-amber-800 px-3 py-1 rounded-lg">
              نتائج البحث: <strong className="text-amber-900">{filteredCategories.length}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchCategories}
            className="underline hover:text-rose-900 text-xs cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Table / Cards Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-xs text-slate-500 font-semibold">جاري تحميل الأقسام...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1">
              <FolderTree className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد أقسام مسجلة حالياً'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchQuery
                ? 'تأكد من كتابة اسم القسم بشكل صحيح أو قم بمسح عبارة البحث.'
                : 'ابدأ بإضافة أول قسم رئيسي لتمكين التجار والمشترين من تصنيف المنتجات.'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة قسم الآن</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12">#</th>
                  <th className="py-3.5 px-4">اسم القسم</th>
                  <th className="py-3.5 px-4">المعرف البرمجي (Slug)</th>
                  <th className="py-3.5 px-4">الوصف</th>
                  <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                  <th className="py-3.5 px-4 text-center w-28">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCategories.map((cat, idx) => (
                  <tr
                    key={cat._id}
                    className="hover:bg-slate-50/60 transition-colors group"
                  >
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0 border border-amber-200/60">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {cat.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                        {cat.slug || '—'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {cat.description || (
                        <span className="text-slate-400 italic">لا يوجد وصف</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {cat.createdAt ? (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{new Date(cat.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(cat)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="تعديل القسم"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(cat)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف القسم"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Category */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                إضافة قسم جديد
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم القسم *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: إلكترونيات، ملابس، أدوات منزلية..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  وصف القسم (اختياري)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اكتب نبذة أو وصفاً مختصراً عن تصنيف هذا القسم..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ القسم</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Category */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                تعديل بيانات القسم
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم القسم *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم القسم"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  وصف القسم
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف القسم"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري التحديث...</span>
                    </>
                  ) : (
                    <span>تحديث القسم</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {isDeleteModalOpen && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                تأكيد حذف القسم
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف القسم{' '}
                <strong className="text-slate-800 font-bold">"{selectedCategory.name}"</strong>؟
                قد تتأثر المنتجات المرتبطة بهذا القسم.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex-1 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeleteConfirm}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all flex-1 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>نعم، حذف القسم</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategoriesPage;
