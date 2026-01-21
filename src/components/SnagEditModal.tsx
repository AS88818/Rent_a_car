import { X, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Snag } from '../types/database';
import { showToast } from '../lib/toast';

interface SnagEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (updates: Partial<Snag>) => Promise<void>;
  snag: Snag | null;
  submitting?: boolean;
}

export function SnagEditModal({
  isOpen,
  onClose,
  onSubmit,
  snag,
  submitting = false,
}: SnagEditModalProps) {
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('Open');
  const [mileage, setMileage] = useState<string>('');

  useEffect(() => {
    if (snag) {
      setDescription(snag.description);
      setPriority(snag.priority || '');
      setStatus(snag.status);
      setMileage(snag.mileage_reported ? String(snag.mileage_reported) : '');
    }
  }, [snag]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        handleClose();
      }
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
    if (!snag) return;
    setDescription(snag.description);
    setPriority(snag.priority || '');
    setStatus(snag.status);
    setMileage(snag.mileage_reported ? String(snag.mileage_reported) : '');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if trying to save a closed snag without an assignee
    if (status === 'Closed' && !snag?.assigned_to) {
      showToast('Cannot edit: closed snags must have an assignee. Please assign someone first.', 'error');
      return;
    }

    const updates: Partial<Snag> = {
      description,
      priority: priority || null,
      status,
      mileage_reported: mileage ? parseInt(mileage, 10) : undefined,
    };

    await onSubmit(updates);
    handleClose();
  };

  if (!isOpen || !snag) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!submitting ? handleClose : undefined}
      ></div>

      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit Snag</h2>
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
            {snag?.status === 'Closed' && !snag?.assigned_to && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">Cannot save changes</p>
                  <p className="text-amber-700">This closed snag has no assignee. Please use the "Assign" button first.</p>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
                disabled={submitting}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">No Priority</option>
                <option value="Dangerous">Dangerous</option>
                <option value="Important">Important</option>
                <option value="Nice to Fix">Nice to Fix</option>
                <option value="Aesthetic">Aesthetic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mileage Reported (Optional)
              </label>
              <input
                type="number"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                disabled={submitting}
                placeholder="Vehicle mileage when snag was reported"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                min="0"
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
