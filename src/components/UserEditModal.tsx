import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { userService, branchService } from '../services/api';
import { UserRole, Branch, AuthUser } from '../types/database';
import { showToast } from '../lib/toast';
import { getRoleLabel, getRoleDescription } from '../lib/permissions';
import { useAuth } from '../lib/auth-context';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: AuthUser;
}

export function UserEditModal({ isOpen, onClose, onSuccess, user }: UserEditModalProps) {
  const { user: currentUser } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user.full_name,
    role: user.role,
    branchId: user.branch_id || '',
  });

  useEffect(() => {
    if (isOpen) {
      loadBranches();
      setFormData({
        fullName: user.full_name,
        role: user.role,
        branchId: user.branch_id || '',
      });
    }
  }, [isOpen, user]);

  const loadBranches = async () => {
    try {
      const data = await branchService.getBranches();
      setBranches(data);
    } catch (error) {
      console.error('Failed to load branches:', error);
      showToast('Failed to load branches', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (user.id === currentUser?.id && formData.role !== user.role && user.role === 'admin') {
      showToast('You cannot change your own admin role', 'error');
      return;
    }

    if (formData.role !== 'admin' && !formData.branchId) {
      showToast('Please select a branch', 'error');
      return;
    }

    setLoading(true);
    try {
      const updates = {
        full_name: formData.fullName,
        role: formData.role,
        branch_id: formData.role === 'admin' ? null : formData.branchId,
      };

      await userService.updateUser(user.id, updates);
      showToast('User updated successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('User update error:', error);
      showToast(error.message || 'Failed to update user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!isOpen) return null;

  const isEditingSelf = user.id === currentUser?.id;
  const canChangeRole = !isEditingSelf || user.role !== 'admin';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={!canChangeRole}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
              required
            >
              <option value="admin">{getRoleLabel('admin')}</option>
              <option value="manager">{getRoleLabel('manager')}</option>
              <option value="mechanic">{getRoleLabel('mechanic')}</option>
              <option value="driver">{getRoleLabel('driver')}</option>
            </select>
            <p className="text-xs text-gray-600 mt-1">
              {!canChangeRole
                ? 'You cannot change your own admin role'
                : getRoleDescription(formData.role)}
            </p>
          </div>

          {formData.role !== 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              <select
                name="branchId"
                value={formData.branchId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branch_name} - {branch.location}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
