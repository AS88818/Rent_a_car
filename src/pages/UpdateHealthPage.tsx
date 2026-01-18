import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { vehicleService, snagService } from '../services/api';
import { Vehicle } from '../types/database';
import { showToast } from '../lib/toast';
import { getHealthColor } from '../lib/utils';
import { ArrowLeft } from 'lucide-react';

type HealthStatus = 'Excellent' | 'OK' | 'Grounded';

export function UpdateHealthPage() {
  const navigate = useNavigate();
  const { branchId } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [newHealth, setNewHealth] = useState<HealthStatus>('Excellent');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const vehiclesData = await vehicleService.getVehicles(branchId || undefined);
        setVehicles(vehiclesData);
      } catch (error) {
        showToast('Failed to fetch vehicles', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, [branchId]);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVehicle) return;

    setUpdating(true);
    try {
      await vehicleService.updateVehicle(selectedVehicleId, {
        health_flag: newHealth,
      });

      setVehicles(vehicles.map(v =>
        v.id === selectedVehicleId ? { ...v, health_flag: newHealth } : v
      ));

      showToast('Health status updated successfully', 'success');
      setSelectedVehicleId('');
      setNewHealth('Excellent');
      setNotes('');
    } catch (error: any) {
      showToast(error.message || 'Failed to update health status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Update Health Status</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Vehicle
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value);
                const vehicle = vehicles.find(v => v.id === e.target.value);
                if (vehicle) {
                  setNewHealth(vehicle.health_flag as HealthStatus);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a vehicle</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.reg_number} - {v.make} {v.model}
                </option>
              ))}
            </select>
          </div>

          {selectedVehicle && (
            <>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Current Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vehicle:</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/vehicles/${selectedVehicle.id}`)}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {selectedVehicle.reg_number}
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Make/Model:</span>
                    <span className="font-medium">{selectedVehicle.make} {selectedVehicle.model}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Current Health:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getHealthColor(selectedVehicle.health_flag)}`}>
                      {selectedVehicle.health_flag}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  New Health Status
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Excellent', 'OK', 'Grounded'] as HealthStatus[]).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setNewHealth(status)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        newHealth === status
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-full h-12 rounded mb-2 ${
                        status === 'Excellent' ? 'bg-green-500' :
                        status === 'OK' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}></div>
                      <p className="text-sm font-medium text-gray-900">{status}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Health Status Guide</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><span className="font-medium">Excellent:</span> Vehicle is in good condition, ready for use</li>
                  <li><span className="font-medium">OK:</span> Minor issues present, usable but needs attention</li>
                  <li><span className="font-medium">Grounded:</span> Serious issues, should not be used until fixed</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add any relevant notes about the health status change..."
                />
              </div>

              {selectedVehicle.health_flag !== newHealth && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <span className="font-medium">Status will change from:</span>{' '}
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getHealthColor(selectedVehicle.health_flag)}`}>
                      {selectedVehicle.health_flag}
                    </span>
                    {' → '}
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getHealthColor(newHealth)}`}>
                      {newHealth}
                    </span>
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={updating || !selectedVehicleId}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Updating...' : 'Update Health Status'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {selectedVehicleId && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <button
              onClick={() => navigate(`/vehicles/${selectedVehicleId}`)}
              className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Vehicle Details
            </button>
            <button
              onClick={() => navigate('/snags')}
              className="w-full px-4 py-2 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Report a Snag
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
