import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { branchService } from '../services/api';
import { UserRole, Branch } from '../types/database';
import { showToast } from '../lib/toast';
import { getRoleLabel, getRoleDescription } from '../lib/permissions';

interface UserCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserCreateModal({ isOpen, onClose, onSuccess }: UserCreateModalProps) {
  const { createUser } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    fullName: '',
    role: 'mechanic' as UserRole,
    branchId: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadBranches();
    }
  }, [isOpen]);

  const loadBranches = async () => {
    try {
      const data = await branchService.getBranches();
      setBranches(data);
      if (data.length > 0 && !formData.branchId) {
        setFormData(prev => ({ ...prev, branchId: data[0].id }));
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
      showToast('Failed to load branches', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (contactType === 'email' && !formData.email) {
      showToast('Please enter an email address', 'error');
      return;
    }

    if (contactType === 'phone' && !formData.phone) {
      showToast('Please enter a phone number', 'error');
      return;
    }

    if (formData.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    if (formData.role !== 'admin' && !formData.branchId) {
      showToast('Please select a branch', 'error');
      return;
    }

    setLoading(true);
    try {
      const branchId = formData.role === 'admin' ? undefined : formData.branchId;
      await createUser(
        contactType === 'email' ? formData.email : formData.phone,
        formData.password,
        formData.fullName,
        formData.role,
        branchId,
        contactType
      );
      showToast('User created successfully', 'success');
      setFormData({
        email: '',
        phone: '',
        password: '',
        fullName: '',
        role: 'mechanic',
        branchId: branches[0]?.id || '',
      });
      setContactType('email');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('User creation error:', error);
      showToast(error.message || 'Failed to create user', 'error');
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Method
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setContactType('email')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  contactType === 'email'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setContactType('phone')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  contactType === 'phone'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Phone
              </button>
            </div>

            {contactType === 'email' ? (
              <input
                type="email"
                name="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            ) : (
              <input
                type="tel"
                name="phone"
                placeholder="+254 700 000 000"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              {contactType === 'email'
                ? 'User will login with this email address'
                : 'User will login with this phone number'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              minLength={6}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="admin">{getRoleLabel('admin')}</option>
              <option value="manager">{getRoleLabel('manager')}</option>
              <option value="mechanic">{getRoleLabel('mechanic')}</option>
              <option value="driver">{getRoleLabel('driver')}</option>
            </select>
            <p className="text-xs text-gray-600 mt-1">{getRoleDescription(formData.role)}</p>
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
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
