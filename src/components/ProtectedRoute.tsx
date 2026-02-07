import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { UserRole } from '../types/database';
import { ShieldX } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const redirectPath = location.pathname + location.search;
    const loginUrl = redirectPath && redirectPath !== '/'
      ? `/login?redirect=${encodeURIComponent(redirectPath)}`
      : '/login';
    return <Navigate to={loginUrl} replace />;
  }

  if (requiredRoles && !requiredRoles.includes(userRole!)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-sm">
          <ShieldX className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-1">This page requires {requiredRoles.join(' or ')} access.</p>
          <p className="text-sm text-gray-500">Your current role: <span className="font-medium">{userRole}</span></p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
