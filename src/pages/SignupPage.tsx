import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { branchService } from '../services/api';
import { UserRole, Branch } from '../types/database';
import { showToast } from '../lib/toast';
import { getRoleLabel, getRoleDescription } from '../lib/permissions';

export function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: 'staff' as UserRole,
    branchId: '',
  });

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const data = await branchService.getBranches();
      setBranches(data);
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, branchId: data[0].id }));
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
      showToast('Failed to load branches', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      showToast('Passwords do not match', 'error');
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
      await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        formData.role,
        branchId
      );
      showToast('Account created successfully', 'success');
      navigate('/login');
    } catch (error: any) {
      console.error('Signup error:', error);
      showToast(error.message || 'Failed to create account', 'error');
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

  const selectedRoleDescription = getRoleDescription(formData.role);

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card w-full max-w-md p-10">
        <div className="flex justify-center mb-6">
          <img
            src="/rent-a-car-in-kenya-logo-hd2-135x134.png"
            alt="Rent A Car In Kenya Logo"
            className="h-20 w-auto"
          />
        </div>

        <h1 className="text-2xl font-bold text-center text-neutral-900 mb-2">Create Account</h1>
        <p className="text-center text-gray-600 mb-6 font-medium">Join Rent A Car In Kenya Fleet Hub</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-1.5">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-1.5">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input-field"
              minLength={6}
              required
            />
            <p className="text-xs text-gray-600 mt-1.5">Minimum 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-1.5">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="input-field"
              required
            >
              <option value="staff">{getRoleLabel('staff')}</option>
              <option value="manager">{getRoleLabel('manager')}</option>
              <option value="admin">{getRoleLabel('admin')}</option>
            </select>
            {selectedRoleDescription && (
              <p className="text-xs text-gray-600 mt-1.5">{selectedRoleDescription}</p>
            )}
          </div>

          {formData.role !== 'admin' && (
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-1.5">
                Branch
              </label>
              <select
                name="branchId"
                value={formData.branchId}
                onChange={handleChange}
                className="input-field"
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-700">
            Already have an account?{' '}
            <Link to="/login" className="text-lime-600 hover:text-lime-700 font-semibold transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
