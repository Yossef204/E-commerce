import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  Eye,
  X,
  FileText,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import adminApi from '../../../api/adminApi';
import type { SellingEntityAdmin, EntityStatus } from '../../../types/admin';

export const EntityApprovalsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<SellingEntityAdmin | null>(null);

  // Rejection modal state
  const [rejectingEntityId, setRejectingEntityId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const { data: entities = [], isLoading } = useQuery<SellingEntityAdmin[]>({
    queryKey: ['sellingEntities'],
    queryFn: () => adminApi.getSellingEntities(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: EntityStatus; rejectionReason?: string }) =>
      adminApi.updateEntityStatus(id, status, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellingEntities'] });
      setSelectedEntity(null);
      setRejectingEntityId(null);
      setRejectionReason('');
    },
  });

  const handleUpdateStatus = (id: string, status: EntityStatus) => {
    if (status === 'REJECTED') {
      setRejectingEntityId(id);
      return;
    }
    updateStatusMutation.mutate({ id, status });
  };

  const submitRejection = () => {
    if (rejectingEntityId) {
      updateStatusMutation.mutate({
        id: rejectingEntityId,
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim() || 'لم يتم استيفاء المستندات الرسمية',
      });
    }
  };

  const filteredEntities = entities.filter((entity) => {
    const matchesStatus =
      filterStatus === 'ALL'
        ? true
        : entity.status === filterStatus;
    const matchesSearch =
      entity.tradeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entity.companyLegalName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entity.sellerFullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      entity._id.includes(searchQuery);

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: EntityStatus) => {
    switch (status) {
      case 'APPROVED':
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> نشط / معتمد
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> قيد المراجعة
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> مرفوض
          </span>
        );
      case 'SUSPENDED':
      case 'DEACTIVATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <AlertTriangle className="w-3.5 h-3.5" /> مجمد
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-bold text-slate-500">جاري تحميل قائمة طلبات اعتماد المتاجر والشركات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-amber-400" />
            اعتماد وحوكمة الكيانات التجارية (Entity Approvals)
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            مراجعة تراخيص الشركات والتاجر المستقل، وتحديد حالة الكيان (اعتماد، رفض، أو تجميد).
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {[
            { id: 'ALL', label: 'الكل' },
            { id: 'PENDING_APPROVAL', label: 'قيد المراجعة' },
            { id: 'APPROVED', label: 'المعتمدة' },
            { id: 'REJECTED', label: 'المرفوضة' },
            { id: 'SUSPENDED', label: 'المجمدة' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterStatus === tab.id
                  ? 'bg-slate-900 text-amber-400 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم التجاري أو السجل..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredEntities.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            لا توجد كيانات تجارية تتطابق مع معايير البحث المحددة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">الاسم التجاري / الكيان</th>
                  <th className="py-3.5 px-4">نوع الكيان</th>
                  <th className="py-3.5 px-4">المستند القانوني / الهوية</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات السريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredEntities.map((entity) => (
                  <tr key={entity._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{entity.tradeName}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID: {entity._id}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {entity.type === 'COMPANY' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          <Building2 className="w-3.5 h-3.5" /> شركة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          <UserCheck className="w-3.5 h-3.5" /> تاجر مستقل
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {entity.type === 'COMPANY' ? (
                        <div className="text-[11px] space-y-0.5">
                          <div><span className="text-slate-400">س.ت:</span> {entity.commercialRegisterNumber || 'غير محدد'}</div>
                          <div><span className="text-slate-400">ب.ض:</span> {entity.taxCardNumber || 'غير محدد'}</div>
                        </div>
                      ) : (
                        <div className="text-[11px]">
                          <span className="text-slate-400">الرقم القومي:</span> {entity.nationalIdNumber || 'غير محدد'}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(entity.status)}</td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {entity.createdAt
                        ? new Date(entity.createdAt).toLocaleDateString('ar-EG')
                        : 'غير محدد'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedEntity(entity)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="معاينة التفاصيل الكاملة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {entity.status !== 'APPROVED' && entity.status !== 'ACTIVE' && (
                          <button
                            onClick={() => handleUpdateStatus(entity._id, 'ACTIVE')}
                            disabled={updateStatusMutation.isPending}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors shadow-sm"
                          >
                            قبول
                          </button>
                        )}

                        {entity.status !== 'REJECTED' && (
                          <button
                            onClick={() => handleUpdateStatus(entity._id, 'REJECTED')}
                            disabled={updateStatusMutation.isPending}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] transition-colors shadow-sm"
                          >
                            رفض
                          </button>
                        )}

                        {entity.status === 'APPROVED' || entity.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleUpdateStatus(entity._id, 'SUSPENDED')}
                            disabled={updateStatusMutation.isPending}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] transition-colors shadow-sm"
                          >
                            تجميد
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Entity Details Inspection Modal */}
      {selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6 text-right border border-slate-200 relative">
            <button
              onClick={() => setSelectedEntity(null)}
              className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {selectedEntity.tradeName}
                </h3>
                <span className="text-xs text-slate-500 font-mono">ID: {selectedEntity._id}</span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-semibold">نوع الكيان:</span>
                  <span className="font-bold text-slate-900">
                    {selectedEntity.type === 'COMPANY' ? 'شركة تجارية' : 'تاجر مستقل'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">الحالة الحالية:</span>
                  <span className="font-bold">{getStatusBadge(selectedEntity.status)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">معرف المالك (Owner ID):</span>
                  <span className="font-mono text-slate-800">{selectedEntity.primaryOwnerId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">تاريخ التسجيل:</span>
                  <span className="font-bold text-slate-800">
                    {selectedEntity.createdAt
                      ? new Date(selectedEntity.createdAt).toLocaleString('ar-EG')
                      : 'غير محدد'}
                  </span>
                </div>
              </div>

              {selectedEntity.type === 'COMPANY' ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <h4 className="font-bold text-slate-900">بيانات التراخيص والشركة:</h4>
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                    <div><span className="font-bold text-slate-700">الاسم القانوني:</span> {selectedEntity.companyLegalName || 'غير مدخل'}</div>
                    <div><span className="font-bold text-slate-700">رقم السجل التجاري:</span> {selectedEntity.commercialRegisterNumber || 'غير مدخل'}</div>
                    <div><span className="font-bold text-slate-700">رقم البطاقة الضريبية:</span> {selectedEntity.taxCardNumber || 'غير مدخل'}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <h4 className="font-bold text-slate-900">بيانات التاجر المستقل:</h4>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <div><span className="font-bold text-slate-700">الاسم الثلاثي:</span> {selectedEntity.sellerFullName || 'غير مدخل'}</div>
                    <div><span className="font-bold text-slate-700">الرقم القومي:</span> {selectedEntity.nationalIdNumber || 'غير مدخل'}</div>
                  </div>
                </div>
              )}

              {selectedEntity.rejectionReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-0.5">
                  <div className="font-bold">سبب الرفض المسجل:</div>
                  <div>{selectedEntity.rejectionReason}</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => handleUpdateStatus(selectedEntity._id, 'ACTIVE')}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-emerald-600/20"
              >
                اعتماد وتفعيل المتجر (ACTIVE)
              </button>

              <button
                onClick={() => handleUpdateStatus(selectedEntity._id, 'REJECTED')}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-rose-600/20"
              >
                رفض (REJECTED)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Input Modal */}
      {rejectingEntityId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-right border border-slate-200 relative">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <ShieldAlert className="w-5 h-5" />
              <span>سبب رفض الاعتماد</span>
            </div>
            <p className="text-xs text-slate-500">
              يرجى كتابة توضيح أو سبب الرفض ليظهر للتاجر في بوابته:
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="مثال: المستندات مرفوقة بشكل غير واضح أو السجل التجاري منتهي الصلاحية..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingEntityId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={submitRejection}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-rose-600/20"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityApprovalsPage;
