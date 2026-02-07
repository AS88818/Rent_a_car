import { useState, useEffect } from 'react';
import { X, MapPin, AlertTriangle } from 'lucide-react';
import { Vehicle, Branch } from '../types/database';
import { branchService } from '../services/api';

interface LocationUpdateModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onConfirm: (branchId: string) => Promise<void>;
}

export function LocationUpdateModal({ vehicle, onClose, onConfirm }: LocationUpdateModalProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(vehicle.branch_id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const data = await branchService.getBranches();
      setBranches(data);
    } catch (error) {
      console.error('Failed to load branches:', error);
      setError('Failed to load branch list');
    } finally {
      setLoading(false);
    }
  };

  const currentBranch = branches.find(b => b.id === vehicle.branch_id);
  const newBranch = branches.find(b => b.id === selectedBranchId);
  const currentLocationText = currentBranch?.branch_name || 'Not assigned';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedBranchId === vehicle.branch_id) {
      setError('Please select a different location');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(selectedBranchId);
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to update location');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Move Vehicle</h2>
              <p className="text-sm text-gray-600">{vehicle.reg_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading branches...</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Location
                </label>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900">
                      {currentLocationText}
                    </span>
                    {vehicle.status === 'On Hire' && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        On Hire
                      </span>
                    )}
                  </div>
                  {currentBranch?.location && (
                    <p className="mt-1 text-sm text-gray-600 ml-6">
                      {currentBranch.location}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-2">
                  New Location <span className="text-red-500">*</span>
                </label>
                <select
                  id="branch"
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a branch...</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branch_name} {branch.location && `- ${branch.location}`}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBranchId && selectedBranchId !== vehicle.branch_id && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Confirm:</strong> Move vehicle from{' '}
                    <strong>{currentLocationText}</strong> to{' '}
                    <strong>{newBranch?.branch_name}</strong>?
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedBranchId || selectedBranchId === vehicle.branch_id}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Moving...' : 'Move Vehicle'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
