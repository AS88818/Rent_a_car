import { Bell, Check, CheckCheck, Wrench, Car, Calendar, Shield, FileCheck } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Notification, NotificationType } from '../types/database';
import { notificationService } from '../services/api';
import { useAuth } from '../lib/auth-context';
import { formatDate } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { NotificationsModal } from './NotificationsModal';

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const fetchNotifications = async () => {
    if (!user?.id) return;

    try {
      const [allNotifications, count] = await Promise.all([
        notificationService.getNotifications(user.id),
        notificationService.getUnreadCount(user.id),
      ]);
      setNotifications(allNotifications);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string, link?: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(notifications.map(n => (n.id === notificationId ? { ...n, read: true } : n)));
      setUnreadCount(prev => Math.max(0, prev - 1));

      if (link) {
        setShowDropdown(false);
        navigate(link);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      await notificationService.markAllAsRead(user.id);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'snag_assigned':
      case 'snag_completed':
      case 'snag_overdue':
      case 'deadline_approaching':
      case 'assignment_updated':
      case 'service_due':
        return <Wrench className="w-4 h-4 text-orange-600" />;
      case 'mot_expiring':
        return <FileCheck className="w-4 h-4 text-blue-600" />;
      case 'insurance_expiring':
        return <Shield className="w-4 h-4 text-red-600" />;
      case 'vehicle_grounded':
        return <Car className="w-4 h-4 text-red-600" />;
      case 'booking_assigned':
      case 'booking_updated':
      case 'booking_reminder':
        return <Calendar className="w-4 h-4 text-green-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPriorityIndicator = (priority?: string) => {
    if (priority === 'urgent') {
      return <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>;
    }
    if (priority === 'warning') {
      return <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>;
    }
    return null;
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

  const handleViewAllClick = () => {
    setShowDropdown(false);
    setShowModal(true);
  };

  const handleModalNotificationCountChange = (count: number) => {
    setUnreadCount(count);
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={loading}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 flex items-center gap-1"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentNotifications.map(notification => (
                    <div
                      key={notification.id}
                      onClick={() => handleMarkAsRead(notification.id, notification.link)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <span className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                {notification.title}
                              </p>
                              {getPriorityIndicator(notification.priority)}
                            </div>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5"></span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatRelativeTime(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleViewAllClick}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All Notifications
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {user?.id && (
        <NotificationsModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            fetchNotifications();
          }}
          userId={user.id}
          onNotificationCountChange={handleModalNotificationCountChange}
        />
      )}
    </>
  );
}
