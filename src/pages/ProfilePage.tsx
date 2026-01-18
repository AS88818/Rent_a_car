import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { FileText, Gauge, Activity, Wrench, MapPin, Settings as SettingsIcon } from 'lucide-react';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();

  const quickActions = [
    { label: 'Update Mileage', icon: Gauge, path: '/vehicles/update-mileage', color: 'blue' },
    { label: 'Update Health', icon: Activity, path: '/vehicles/update-health', color: 'green' },
    { label: 'Create Maintenance Log', icon: Wrench, path: '/maintenance', color: 'yellow' },
    { label: 'Calendar View', icon: MapPin, path: '/calendar', color: 'red' },
  ];

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile & Menu</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <p className="text-gray-900">{user?.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <p className="text-gray-900 capitalize">{userRole?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickActions.map(action => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`flex items-center gap-3 p-4 border-2 border-${action.color}-200 rounded-lg hover:bg-${action.color}-50 transition-colors text-left`}
              >
                <div className={`p-2 bg-${action.color}-100 rounded-lg`}>
                  <Icon className={`w-5 h-5 text-${action.color}-600`} />
                </div>
                <span className="font-medium text-gray-900">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Pages</h2>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <p className="font-medium text-gray-900">Dashboard</p>
            <p className="text-sm text-gray-600">Overview and quick stats</p>
          </button>

          <button
            onClick={() => navigate('/bookings')}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <p className="font-medium text-gray-900">Bookings</p>
            <p className="text-sm text-gray-600">View and manage bookings</p>
          </button>

          <button
            onClick={() => navigate('/vehicles')}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <p className="font-medium text-gray-900">Vehicle Directory</p>
            <p className="text-sm text-gray-600">Browse all vehicles</p>
          </button>

          <button
            onClick={() => navigate('/maintenance')}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <p className="font-medium text-gray-900">Maintenance History</p>
            <p className="text-sm text-gray-600">View service logs</p>
          </button>

          <button
            onClick={() => navigate('/snags')}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <p className="font-medium text-gray-900">Snags</p>
            <p className="text-sm text-gray-600">Report and track issues</p>
          </button>

          <button
            onClick={() => navigate('/calendar')}
            className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <p className="font-medium text-gray-900">Calendar View</p>
            <p className="text-sm text-gray-600">Category-based bookings</p>
          </button>

          {userRole === 'admin' && (
            <button
              onClick={() => navigate('/settings')}
              className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <p className="font-medium text-gray-900">Admin Settings</p>
              <p className="text-sm text-gray-600">System configuration</p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
