import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Bell,
  CheckCheck,
  Wrench,
  Car,
  Calendar,
  Shield,
  FileCheck,
  AlertTriangle,
  Filter,
  Trash2,
} from 'lucide-react';
import { Notification, NotificationType } from '../types/database';
import { notificationService } from '../services/api';
import { formatDate } from '../lib/utils';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onNotificationCountChange: (count: number) => void;
}

type FilterCategory = 'all' | 'vehicle' | 'booking' | 'snag';

const NOTIFICATION_CATEGORIES: Record<FilterCategory, NotificationType[]> = {
  all: [],
  vehicle: ['service_due', 'mot_expiring', 'insurance_expiring', 'vehicle_grounded'],
  booking: ['booking_assigned', 'booking_updated', 'booking_reminder'],
  snag: ['snag_assigned', 'deadline_approaching', 'snag_completed', 'snag_overdue', 'assignment_updated'],
};

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'snag_assigned':
    case 'snag_completed':
    case 'snag_overdue':
    case 'deadline_approaching':
    case 'assignment_updated':
      return <Wrench className="w-5 h-5 text-orange-600" />;
    case 'service_due':
      return <Wrench className="w-5 h-5 text-amber-600" />;
    case 'mot_expiring':
      return <FileCheck className="w-5 h-5 text-blue-600" />;
    case 'insurance_expiring':
      return <Shield className="w-5 h-5 text-red-600" />;
    case 'vehicle_grounded':
      return <Car className="w-5 h-5 text-red-600" />;
    case 'booking_assigned':
    case 'booking_updated':
    case 'booking_reminder':
      return <Calendar className="w-5 h-5 text-green-600" />;
    default:
      return <Bell className="w-5 h-5 text-gray-600" />;
  }
};

const getPriorityBadge = (priority?: string) => {
  switch (priority) {
    case 'urgent':
      return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700">Urgent</span>;
    case 'warning':
      return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">Warning</span>;
    default:
      return null;
  }
};

const getCategoryLabel = (type: NotificationType): string => {
  if (NOTIFICATION_CATEGORIES.vehicle.includes(type)) return 'Vehicle Alert';
  if (NOTIFICATION_CATEGORIES.booking.includes(type)) return 'Booking';
  if (NOTIFICATION_CATEGORIES.snag.includes(type)) return 'Maintenance';
  return 'Notification';
};

export function NotificationsModal({ isOpen, onClose, userId, onNotificationCountChange }: NotificationsModalProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchNotifications();
    }
  }, [isOpen, userId]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications(userId);
      setNotifications(data);
      const unreadCount = data.filter(n => !n.read).length;
      onNotificationCountChange(unreadCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    try {
      if (!notification.read) {
        await notificationService.markAsRead(notification.id);
        setNotifications(notifications.map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        ));
        const newUnreadCount = notifications.filter(n => !n.read && n.id !== notification.id).length;
        onNotificationCountChange(newUnreadCount);
      }

      if (notification.link) {
        onClose();
        navigate(notification.link);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      await notificationService.markAllAsRead(userId);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      onNotificationCountChange(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(notificationId);
      const updatedNotifications = notifications.filter(n => n.id !== notificationId);
      setNotifications(updatedNotifications);
      const newUnreadCount = updatedNotifications.filter(n => !n.read).length;
      onNotificationCountChange(newUnreadCount);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return formatDate(dateString);
  };

  const filteredNotifications = filter === 'all'
    ? notifications
    : notifications.filter(n => NOTIFICATION_CATEGORIES[filter].includes(n.type));

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-gray-700" />
            <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-white overflow-x-auto">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
          {(['all', 'vehicle', 'booking', 'snag'] as FilterCategory[]).map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                filter === category
                  ? 'bg-lime-500 text-neutral-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category === 'all' && 'All'}
              {category === 'vehicle' && 'Vehicle Alerts'}
              {category === 'booking' && 'Bookings'}
              {category === 'snag' && 'Maintenance'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-lime-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-3 text-gray-600">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-1">No notifications</p>
              <p className="text-gray-500">
                {filter === 'all'
                  ? "You're all caught up!"
                  : `No ${filter === 'vehicle' ? 'vehicle alerts' : filter === 'booking' ? 'booking notifications' : 'maintenance notifications'} at the moment.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleMarkAsRead(notification)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors group ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </p>
                          {getPriorityBadge(notification.priority)}
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDeleteNotification(notification.id, e)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete notification"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className={`text-sm mb-2 ${!notification.read ? 'text-gray-700' : 'text-gray-600'}`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{formatRelativeTime(notification.created_at)}</span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                          {getCategoryLabel(notification.type)}
                        </span>
                        {notification.metadata?.vehicle_reg && (
                          <span className="flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {notification.metadata.vehicle_reg}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {filteredNotifications.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
            <p className="text-xs text-gray-500">
              Showing {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
              {filter !== 'all' && ` (filtered)`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
