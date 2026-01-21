import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Car, Menu, Wrench } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

export function BottomNav() {
  const location = useLocation();
  const { userRole } = useAuth();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ...(userRole !== 'mechanic' ? [
      { label: 'Bookings', href: '/bookings', icon: Calendar }
    ] : [
      { label: 'Snags', href: '/snags', icon: Wrench }
    ]),
    { label: 'Vehicles', href: '/vehicles', icon: Car },
    { label: 'More', href: '/profile', icon: Menu },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ${
                active
                  ? 'text-neutral-900'
                  : 'text-gray-600 hover:text-neutral-900'
              }`}
            >
              <Icon className={`w-6 h-6 mb-1 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className={`text-xs ${active ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-lime-500 rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
