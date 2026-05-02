import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { CompanySettingsProvider } from './lib/company-settings-context';
import { Toast } from './components/Toast';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K
) => lazy(() => loader().then(module => ({ default: module[exportName] as ComponentType })));

const LoginPage = lazyNamed(() => import('./pages/LoginPage'), 'LoginPage');
const DashboardPage = lazyNamed(() => import('./pages/DashboardPage'), 'DashboardPage');
const BookingListPage = lazyNamed(() => import('./pages/BookingListPage'), 'BookingListPage');
const BookingCreatePage = lazyNamed(() => import('./pages/BookingCreatePage'), 'BookingCreatePage');
const VehiclesPage = lazyNamed(() => import('./pages/VehiclesPage'), 'VehiclesPage');
const VehicleDetailsPage = lazyNamed(() => import('./pages/VehicleDetailsPage'), 'VehicleDetailsPage');
const QuickActionsPage = lazyNamed(() => import('./pages/QuickActionsPage'), 'QuickActionsPage');
const CalendarPage = lazyNamed(() => import('./pages/CalendarPage'), 'CalendarPage');
const MaintenancePage = lazyNamed(() => import('./pages/MaintenancePage'), 'MaintenancePage');
const SnagsPage = lazyNamed(() => import('./pages/SnagsPage'), 'SnagsPage');
const MyAssignmentsPage = lazyNamed(() => import('./pages/MyAssignmentsPage'), 'MyAssignmentsPage');
const SettingsPage = lazyNamed(() => import('./pages/SettingsPage'), 'SettingsPage');
const CompanySettingsPage = lazyNamed(() => import('./pages/CompanySettingsPage'), 'CompanySettingsPage');
const ProfilePage = lazyNamed(() => import('./pages/ProfilePage'), 'ProfilePage');
const QuotationCalculatorPage = lazyNamed(() => import('./pages/QuotationCalculatorPage'), 'QuotationCalculatorPage');
const UserManagementPage = lazyNamed(() => import('./pages/UserManagementPage'), 'UserManagementPage');
const PricingAdminPage = lazyNamed(() => import('./pages/PricingAdminPage'), 'PricingAdminPage');
const InvoicesPage = lazyNamed(() => import('./pages/InvoicesPage'), 'InvoicesPage');
const EmailsPage = lazyNamed(() => import('./pages/EmailsPage'), 'EmailsPage');
const QuotesPage = lazy(() => import('./pages/QuotesPage'));
const ReportsPage = lazyNamed(() => import('./pages/ReportsPage'), 'ReportsPage');
const OAuthCallbackPage = lazyNamed(() => import('./pages/OAuthCallbackPage'), 'OAuthCallbackPage');
const ForgotPasswordPage = lazyNamed(() => import('./pages/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyNamed(() => import('./pages/ResetPasswordPage'), 'ResetPasswordPage');

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/bookings"
        element={
          <ProtectedRoute requiredRoles={['admin', 'user', 'member']}>
            <Layout>
              <BookingListPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/bookings/create"
        element={
          <ProtectedRoute requiredRoles={['admin', 'user', 'member']}>
            <Layout>
              <BookingCreatePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/vehicles"
        element={
          <ProtectedRoute>
            <Layout>
              <VehiclesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/vehicles/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <VehicleDetailsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/quick-actions"
        element={
          <ProtectedRoute>
            <Layout>
              <QuickActionsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <Layout>
              <CalendarPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/maintenance"
        element={
          <ProtectedRoute>
            <Layout>
              <MaintenancePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/snags"
        element={
          <ProtectedRoute>
            <Layout>
              <SnagsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-assignments"
        element={
          <ProtectedRoute>
            <Layout>
              <MyAssignmentsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/quotation"
        element={
          <ProtectedRoute requiredRoles={['admin', 'user', 'member']}>
            <Layout>
              <QuotationCalculatorPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/quotes"
        element={
          <ProtectedRoute requiredRoles={['admin', 'user', 'member']}>
            <Layout>
              <QuotesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <Layout>
              <UserManagementPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pricing"
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <Layout>
              <PricingAdminPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/invoices"
        element={
          <ProtectedRoute requiredRoles={['admin', 'user']}>
            <Layout>
              <InvoicesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/emails"
        element={
          <ProtectedRoute requiredRoles={['admin', 'user']}>
            <Layout>
              <EmailsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute requiredRoles={['admin', 'user']}>
            <Layout>
              <ReportsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/company-settings"
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <Layout>
              <CompanySettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanySettingsProvider>
          <AppRoutes />
          <Toast />
        </CompanySettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
