import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Clock, Info, ShieldAlert } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import adminApi from '../api/adminApi';
import { useAuthStore } from '../store/useAuthStore';
import type { NotificationItem } from '../types/admin';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [realtimeNotifications, setRealtimeNotifications] = useState<NotificationItem[]>([]);

  // Fetch initial notifications list via TanStack Query
  const { data: fetchedNotifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: () => adminApi.getMyNotifications(),
    refetchInterval: 30000,
  });

  // Socket.IO Real-time Connection Setup (DIP architecture)
  useEffect(() => {
    if (!user?.id) return;

    const socket: Socket = io(SOCKET_URL, {
      query: { userId: user.id },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_room', user.id);
    });

    // Listen for real-time notifications sent via SocketIoNotificationProvider
    socket.on('notification', (payload: any) => {
      const newNotif: NotificationItem = {
        _id: payload.data?.orderId || payload.data?.entityOrderId || String(Date.now()),
        userId: user.id,
        title: payload.title || 'إشعار جديد',
        body: payload.message || payload.body || '',
        type: payload.type || 'INFO',
        channel: 'IN_APP',
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: payload.data,
      };

      setRealtimeNotifications((prev) => [newNotif, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('notification_broadcast', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id, queryClient]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => adminApi.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Combine fetched notifications with real-time arrivals
  const combinedNotifications = [
    ...realtimeNotifications.filter(
      (rt) => !fetchedNotifications.some((f) => f._id === rt._id)
    ),
    ...fetchedNotifications,
  ];

  const unreadCount = combinedNotifications.filter((n) => !n.isRead).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ORDER_PLACED':
      case 'PAYMENT_RECEIVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'SECURITY_ALERT':
        return <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors focus:outline-none"
        title="الإشعارات اللحظية"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop for closing */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-40 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold">مركز الإشعارات اللحظية</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-extrabold px-2 py-0.5 rounded-full border border-amber-400/30">
                    {unreadCount} جديد
                  </span>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {combinedNotifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  لا توجد إشعارات حالياً
                </div>
              ) : (
                combinedNotifications.map((notif) => (
                  <div
                    key={notif._id}
                    className={`p-3.5 flex items-start gap-3 transition-colors ${
                      notif.isRead ? 'bg-white opacity-75' : 'bg-blue-50/60 font-medium'
                    }`}
                  >
                    {getNotificationIcon(notif.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {notif.createdAt
                            ? new Date(notif.createdAt).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                        {notif.body}
                      </p>
                    </div>

                    {!notif.isRead && (
                      <button
                        onClick={() => markReadMutation.mutate(notif._id)}
                        disabled={markReadMutation.isPending}
                        title="تعليم كمقروء"
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors text-[10px] font-bold shrink-0 self-center"
                      >
                        قراءة
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
