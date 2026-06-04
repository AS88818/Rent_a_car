import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MaintenanceLog, AuthUser } from '../types/database';
import { MAINTENANCE_WORK_CATEGORIES } from '../lib/maintenance';

interface MaintenanceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (updates: Partial<MaintenanceLog>) => Promise<void>;
  log: MaintenanceLog | null;
  allUsers: AuthUser[];
  submitting?: boolean;
}

export function MaintenanceEditModal({
  isOpen,
  onClose,
  onSubmit,
  log,
  allUsers,
  submitting = false,
}: MaintenanceEditModalProps) {
  const [serviceDate, setServiceDate] = useState('');
  const [mileage, setMileage] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [notes, setNotes] = useState('');
  const [workCategory, setWorkCategory] = useState('');
  const [checkedByUserId, setCheckedByUserId] = useState('');

  useEffect(() => {
    if (log) {
      setServiceDate(log.service_date || '');
      setMileage(log.mileage ? String(log.mileage) : '');
      setWorkDone(log.work_done || '');
      setNotes(log.notes || '');
      setWorkCategory(log.work_category || '');
      setCheckedByUserId(log.checked_by_user_id || '');
    }
  }, [log]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) handleClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, submitting]);

  const handleClose = () => {
    if (!log) return;
    setServiceDate(log.service_date || '');
    setMileage(log.mileage ? String(log.mileage) : '');
    setWorkDone(log.work_done || '');
    setNotes(log.notes || '');
    setWorkCategory(log.work_category || '');
    setCheckedByUserId(log.checked_by_user_id || '');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<MaintenanceLog> = {
      service_date: serviceDate,
      mileage: mileage ? parseFloat(mileage) : log!.mileage,
      work_done: workDone,
      notes: notes || undefined,
      work_category: (workCategory || undefined) as MaintenanceLog['work_category'],
      checked_by_user_id: checkedByUserId || undefined,
    };
    await onSubmit(updates);
    handleClose();
  };

  const activeUsers = allUsers.filter(u => u.status === 'active' || !u.status);

  if (!isOpen || !log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!submitting ? handleClose : undefined}
      />
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit Maintenance Log</h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={serviceDate}
                onChange={e => setServiceDate(e.target.value)}
                required
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mileage at Service <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                required
                disabled={submitting}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Performed <span className="text-red-500">*</span>
              </label>
              <textarea
                value={workDone}
                onChange={e => setWorkDone(e.target.value)}
                required
                disabled={submitting}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={workCategory}
                onChange={e => setWorkCategory(e.target.value)}
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                <option value="">No Category</option>
                {MAINTENANCE_WORK_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Checked By <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <select
                value={checkedByUserId}
                onChange={e => setCheckedByUserId(e.target.value)}
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                <option value="">No quality check</option>
                {activeUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={submitting}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none text-base"
              />
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
