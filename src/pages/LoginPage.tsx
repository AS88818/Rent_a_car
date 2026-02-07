import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { useCompanySettings } from '../lib/company-settings-context';
import { showToast } from '../lib/toast';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { settings } = useCompanySettings();
  const [loading, setLoading] = useState(false);
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');
  const [formData, setFormData] = useState({ identifier: '', password: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(formData.identifier, formData.password, contactType);
      showToast('Login successful', 'success');
      navigate('/dashboard');
    } catch (error: any) {
      showToast(error.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img
              src={settings.logo_url}
              alt={`${settings.company_name} Logo`}
              className="h-24 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">{settings.company_name}</h1>
          <p className="text-gray-600 mt-2 font-medium">Fleet Hub</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-3">Login with</label>
            <div className="flex gap-2 mb-4">
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
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="you@example.com"
              />
            ) : (
              <input
                type="tel"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="+254 700 000 000"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Welcome to the Fleet Management System
        </p>
      </div>
    </div>
  );
}
