import { ReactNode, useState } from 'react';
import {
  Menu, X, LogOut, Settings, LayoutDashboard, Calendar, PlusCircle,
  Car, CalendarDays, Wrench, AlertTriangle,
  ClipboardList, FileText, Users, DollarSign, Mail, Receipt, Zap, BarChart3, Building2
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { useCompanySettings } from '../lib/company-settings-context';
import { Link, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { NotificationBell } from './NotificationBell';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, userRole, signOut } = useAuth();
  const { settings } = useCompanySettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Assignments', href: '/my-assignments', icon: ClipboardList },
    { label: 'Vehicles', href: '/vehicles', icon: Car },
    { label: 'Quick Actions', href: '/quick-actions', icon: Zap },
    { label: 'Snags', href: '/snags', icon: AlertTriangle },
    { label: 'Maintenance', href: '/maintenance', icon: Wrench },
    { label: 'Calendar', href: '/calendar', icon: CalendarDays },
    ...(userRole !== 'mechanic' ? [
      { label: 'Create Quotation', href: '/quotation', icon: FileText }
    ] : []),
    ...(userRole === 'admin' || userRole === 'manager' ? [
      { label: 'Quotes', href: '/quotes', icon: Receipt }
    ] : []),
    ...(userRole !== 'mechanic' ? [
      { label: 'Bookings', href: '/bookings', icon: Calendar },
      { label: 'Create Booking', href: '/bookings/create', icon: PlusCircle }
    ] : []),
    ...(userRole === 'admin' || userRole === 'manager' ? [
      { label: 'Create Invoice', href: '/invoices', icon: FileText },
      { label: 'Emails', href: '/emails', icon: Mail }
    ] : []),
    ...(userRole === 'admin' || userRole === 'manager' ? [
      { label: 'Reports', href: '/reports', icon: BarChart3 }
    ] : []),
    ...(userRole === 'admin' ? [
      { label: 'User Management', href: '/users', icon: Users },
      { label: 'Pricing Admin', href: '/pricing', icon: DollarSign },
      { label: 'Company Settings', href: '/company-settings', icon: Building2 },
      { label: 'Settings', href: '/settings', icon: Settings }
    ] : []),
  ];

  return (
    <div className="flex h-screen bg-cream-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative w-64 h-full bg-white border-r border-gray-200 transition-transform duration-300 z-50 flex flex-col`}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={settings.logo_url}
              alt={`${settings.company_name} Logo`}
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-sm font-bold leading-tight text-neutral-900 line-clamp-2">{settings.company_name}</h1>
            </div>
          </div>
          <p className="text-xs text-gray-600 font-medium">{userRole?.replace('_', ' ').toUpperCase()}</p>
        </div>

        <nav className="flex-1 mt-6 px-3 space-y-1 overflow-y-auto pb-4">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-lime-500 text-neutral-900 font-medium shadow-soft'
                    : 'text-gray-700 hover:bg-cream-100 hover:text-neutral-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-red-50 transition-all duration-200 text-red-600 font-medium text-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Nav */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-soft">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-cream-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-6 h-6 text-neutral-900" /> : <Menu className="w-6 h-6 text-neutral-900" />}
          </button>

          <h2 className="text-lg font-semibold text-neutral-900 flex-1 md:flex-none">{settings.company_name}</h2>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 hidden md:inline font-medium">{user?.email}</span>
            <NotificationBell />
            <Link
              to="/profile"
              className="p-2 hover:bg-cream-100 rounded-lg transition-all duration-200"
            >
              <Settings className="w-5 h-5 text-gray-700" />
            </Link>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto pb-20 md:pb-0">{children}</div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
