import { X, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Snag, AuthUser } from '../types/database';
import { useAuth } from '../lib/auth-context';

interface AssignSnagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (assignment: {
    snagId: string;
    assignedTo: string;
    deadline?: string;
    notes?: string;
  }) => Promise<void>;
  snag: Snag | null;
  users: AuthUser[];
  submitting?: boolean;
}

export function AssignSnagModal({
  isOpen,
  onClose,
  onSubmit,
  snag,
  users,
  submitting = false,
}: AssignSnagModalProps) {
  const { user } = useAuth();
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (snag && snag.assigned_to) {
      setAssignedTo(snag.assigned_to);
      setDeadline(snag.assignment_deadline || '');
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
    setAssignedTo('');
    setDeadline('');
    setNotes('');
    onClose();
  };

  const handleSelfAssign = () => {
    if (user?.id) {
      setAssignedTo(user.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snag || !assignedTo) return;

    await onSubmit({
      snagId: snag.id,
      assignedTo,
      deadline: deadline || undefined,
      notes: notes || undefined,
    });
    handleClose();
  };

  if (!isOpen || !snag) return null;

  const availableUsers = users.filter(u => u.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!submitting ? handleClose : undefined}
      ></div>

      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {snag.assigned_to ? 'Reassign' : 'Assign'} Snag
          </h2>
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
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Snag:</p>
              <p className="text-sm text-gray-900 font-medium">{snag.description}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To <span className="text-red-500">*</span>
              </label>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                required
                disabled={submitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select User</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSelfAssign}
                disabled={submitting}
                className="mt-2 flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <User className="w-4 h-4" />
                Assign to Me
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deadline (Optional)
              </label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                disabled={submitting}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignment Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={submitting}
                rows={3}
                placeholder="Any special instructions or notes..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none"
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
              disabled={submitting || !assignedTo}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Assigning...' : snag.assigned_to ? 'Reassign' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
