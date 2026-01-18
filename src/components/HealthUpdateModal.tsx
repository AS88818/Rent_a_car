import { useState } from 'react';
import { X, Heart, AlertTriangle } from 'lucide-react';
import { Vehicle } from '../types/database';

interface HealthUpdateModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onConfirm: (healthFlag: Vehicle['health_flag'], notes: string) => Promise<void>;
}

export function HealthUpdateModal({ vehicle, onClose, onConfirm }: HealthUpdateModalProps) {
  const [selectedHealth, setSelectedHealth] = useState<Vehicle['health_flag']>(vehicle.health_flag);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const healthOptions: Vehicle['health_flag'][] = ['Excellent', 'OK', 'Grounded'];

  const getHealthColor = (health: Vehicle['health_flag']) => {
    switch (health) {
      case 'Excellent':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'OK':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Grounded':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (notes.trim().length < 10) {
      setError('Please provide at least 10 characters of notes');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(selectedHealth, notes.trim());
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to update health status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Update Health Status</h2>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Health Status <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {healthOptions.map((health) => (
                <button
                  key={health}
                  type="button"
                  onClick={() => setSelectedHealth(health)}
                  className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                    selectedHealth === health
                      ? getHealthColor(health) + ' border-current'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{health}</span>
                    {selectedHealth === health && (
                      <div className="w-4 h-4 bg-current rounded-full" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Current: <span className="font-medium">{vehicle.health_flag}</span>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              required
              minLength={10}
              placeholder="Describe the reason for this health status change (minimum 10 characters)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="mt-1 text-sm text-gray-500">
              {notes.length}/10 characters minimum
            </div>
          </div>

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
              disabled={isSubmitting || notes.trim().length < 10}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating...' : 'Update Health Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
