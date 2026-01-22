import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { Toast } from './components/Toast';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BookingListPage } from './pages/BookingListPage';
import { BookingCreatePage } from './pages/BookingCreatePage';
import { VehiclesPage } from './pages/VehiclesPage';
import { VehicleDetailsPage } from './pages/VehicleDetailsPage';
import { UpdateMileagePage } from './pages/UpdateMileagePage';
import { UpdateHealthPage } from './pages/UpdateHealthPage';
import { QuickActionsPage } from './pages/QuickActionsPage';
import { CalendarPage } from './pages/CalendarPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { SnagsPage } from './pages/SnagsPage';
import { MyAssignmentsPage } from './pages/MyAssignmentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { QuotationCalculatorPage } from './pages/QuotationCalculatorPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { PricingAdminPage } from './pages/PricingAdminPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { EmailsPage } from './pages/EmailsPage';
import QuotesPage from './pages/QuotesPage';
import { ReportsPage } from './pages/ReportsPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';

function AppRoutes() {
  const { user, loading } = useAuth();

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

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
          <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
            <Layout>
              <BookingListPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/bookings/create"
        element={
          <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
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
        path="/vehicles/update-mileage"
        element={
          <ProtectedRoute>
            <Layout>
              <UpdateMileagePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/vehicles/update-health"
        element={
          <ProtectedRoute>
            <Layout>
              <UpdateHealthPage />
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
          <ProtectedRoute requiredRoles={['admin', 'manager', 'staff']}>
            <Layout>
              <QuotationCalculatorPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/quotes"
        element={
          <ProtectedRoute requiredRoles={['admin', 'manager']}>
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
          <ProtectedRoute requiredRoles={['admin', 'manager']}>
            <Layout>
              <InvoicesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/emails"
        element={
          <ProtectedRoute requiredRoles={['admin', 'manager']}>
            <Layout>
              <EmailsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute requiredRoles={['admin', 'manager']}>
            <Layout>
              <ReportsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toast />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
