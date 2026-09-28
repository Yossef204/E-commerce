import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  Filter,
  Eye,
  X,
  User,
  Loader2,
  FileCode,
} from 'lucide-react';
import adminApi from '../../../api/adminApi';
import type { AuditLogItem } from '../../../types/admin';

export const AuditLogsPage: React.FC = () => {
  const [targetEntityFilter, setTargetEntityFilter] = useState<string>('');
  const [actorIdFilter, setActorIdFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const { data: auditLogs = [], isLoading } = useQuery<AuditLogItem[]>({
    queryKey: ['auditLogs', targetEntityFilter, actorIdFilter],
    queryFn: () => adminApi.getAuditLogs(targetEntityFilter || undefined, actorIdFilter || undefined),
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'STATUS_CHANGE':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            تغيير حالة (STATUS_CHANGE)
          </span>
        );
      case 'CREATE':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
            إنشاء (CREATE)
          </span>
        );
      case 'UPDATE':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-amber-50 text-amber-700 rounded-full border border-amber-200">
            تحديث (UPDATE)
          </span>
        );
      case 'DELETE':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-rose-50 text-rose-700 rounded-full border border-rose-200">
            حذف (DELETE)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
            {action}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
        <p className="text-xs font-bold text-slate-500">جاري استدعاء سجلات النشاط والتأمين (Audit Logs)...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            سجل التدقيق والأمان والأحداث (Audit Trail)
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            سجل كتل غير قابل للتعديل يوثق كافة إجراءات المستخدمين، المشرفين، والتغييرات البرمجية الحساسة.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 w-full sm:w-auto relative">
          <input
            type="text"
            value={targetEntityFilter}
            onChange={(e) => setTargetEntityFilter(e.target.value)}
            placeholder="تصفية حسب الكيان المستهدف (Target Entity)..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <Filter className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
        </div>

        <div className="flex-1 w-full sm:w-auto relative">
          <input
            type="text"
            value={actorIdFilter}
            onChange={(e) => setActorIdFilter(e.target.value)}
            placeholder="تصفية حسب معرف الفاعل (Actor ID)..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {auditLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            لا توجد سجلات تدقيق مطابقة لمعايير البحث الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">الفاعل (Actor ID)</th>
                  <th className="py-3.5 px-4">نوع الإجراء (Action)</th>
                  <th className="py-3.5 px-4">الكيان المستهدف</th>
                  <th className="py-3.5 px-4">معرف المستهدف (Target ID)</th>
                  <th className="py-3.5 px-4">عنوان IP</th>
                  <th className="py-3.5 px-4">التوقيت الدقيق</th>
                  <th className="py-3.5 px-4 text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {log.actorId ? log.actorId.toString() : 'مجهول'}
                    </td>
                    <td className="py-3.5 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{log.targetEntity}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {log.targetId || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString('ar-EG')
                        : 'غير محدد'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        title="معاينة التغييرات"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log State Changes Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-6 text-right border border-slate-200 relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-slate-900 text-amber-400 rounded-xl flex items-center justify-center font-bold">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  تفاصيل سجل النشاط #{selectedLog._id.substring(0, 10)}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString('ar-EG') : ''}
                </span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-semibold">الفاعل (Actor):</span>
                  <span className="font-mono font-bold text-slate-900">{selectedLog.actorId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">نوع الإجراء:</span>
                  <span className="font-bold">{getActionBadge(selectedLog.action)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">الكيان المستهدف:</span>
                  <span className="font-bold text-slate-900">{selectedLog.targetEntity}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">معرف المستهدف:</span>
                  <span className="font-mono text-slate-800">{selectedLog.targetId || 'غير محدد'}</span>
                </div>
              </div>

              <div className="space-y-3">
                {selectedLog.previousState && (
                  <div>
                    <h4 className="font-bold text-slate-700 text-xs mb-1">الحالة السابقة (Previous State):</h4>
                    <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto dir-ltr">
                      {JSON.stringify(selectedLog.previousState, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.newState && (
                  <div>
                    <h4 className="font-bold text-slate-700 text-xs mb-1">الحالة الجديدة (New State):</h4>
                    <pre className="p-3 bg-slate-900 text-amber-300 rounded-xl text-[11px] font-mono overflow-x-auto dir-ltr">
                      {JSON.stringify(selectedLog.newState, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-100 pt-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
