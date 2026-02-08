import { useState, useEffect } from 'react';
import { Building2, Mail, Phone, CreditCard, FileText, Save, Loader2, AlertCircle, RefreshCw, Send, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompanySettings } from '../lib/company-settings-context';
import { useAuth } from '../lib/auth-context';
import { CompanySettings } from '../types/database';
import { showToast } from '../lib/toast';
import { EmailSendingSettings } from '../components/EmailSendingSettings';
import { CalendarSyncSettings } from '../components/CalendarSyncSettings';

type FormSection = 'branding' | 'contact' | 'payment' | 'email' | 'email_sending' | 'calendar_sync';

export function CompanySettingsPage() {
  const { settings, refresh } = useCompanySettings();
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<CompanySettings>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeSection, setActiveSection] = useState<FormSection>('branding');

  useEffect(() => {
    if (settings.id) {
      setFormData(prev => ({ ...settings, pica_secret_key: prev.pica_secret_key, pica_connection_key: prev.pica_connection_key, pica_action_id: prev.pica_action_id, google_client_id: prev.google_client_id, google_client_secret: prev.google_client_secret, google_redirect_uri: prev.google_redirect_uri }));
      setLoading(false);
      setLoadError(false);
    } else {
      const timeout = setTimeout(() => {
        if (!settings.id) {
          setLoading(false);
          setLoadError(true);
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [settings]);

  useEffect(() => {
    async function loadCredentials() {
      const { data } = await supabase
        .from('company_settings')
        .select('pica_secret_key, pica_connection_key, pica_action_id, google_client_id, google_client_secret, google_redirect_uri')
        .limit(1)
        .maybeSingle();
      if (data) {
        setFormData(prev => ({
          ...prev,
          pica_secret_key: data.pica_secret_key || '',
          pica_connection_key: data.pica_connection_key || '',
          pica_action_id: data.pica_action_id || '',
          google_client_id: data.google_client_id || '',
          google_client_secret: data.google_client_secret || '',
          google_redirect_uri: data.google_redirect_uri || '',
        }));
      }
    }
    loadCredentials();
  }, []);

  const handleRetry = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      await refresh();
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!settings.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          company_name: formData.company_name,
          tagline: formData.tagline,
          email: formData.email,
          phone_nanyuki: formData.phone_nanyuki,
          phone_nairobi: formData.phone_nairobi,
          website_url: formData.website_url,
          address: formData.address,
          bank_name: formData.bank_name,
          bank_account: formData.bank_account,
          mpesa_till: formData.mpesa_till,
          logo_url: formData.logo_url,
          email_signature: formData.email_signature,
          currency_code: formData.currency_code,
          currency_locale: formData.currency_locale,
          pica_secret_key: formData.pica_secret_key || null,
          pica_connection_key: formData.pica_connection_key || null,
          pica_action_id: formData.pica_action_id || null,
          google_client_id: formData.google_client_id || null,
          google_client_secret: formData.google_client_secret || null,
          google_redirect_uri: formData.google_redirect_uri || null,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null,
        })
        .eq('id', settings.id);

      if (error) throw error;

      await refresh();
      showToast('Company settings saved successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sections: { key: FormSection; label: string; icon: typeof Building2 }[] = [
    { key: 'branding', label: 'Branding', icon: Building2 },
    { key: 'contact', label: 'Contact Info', icon: Phone },
    { key: 'payment', label: 'Payment Details', icon: CreditCard },
    { key: 'email', label: 'Email Signature', icon: Mail },
    { key: 'email_sending', label: 'Email Sending', icon: Send },
    { key: 'calendar_sync', label: 'Calendar Sync', icon: Calendar },
  ];

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(settings);

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <div className="h-9 w-64 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-5 w-96 bg-gray-100 rounded mt-2 animate-pulse" />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-56 flex-shrink-0 space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load settings</h2>
          <p className="text-gray-600 mb-6">Could not retrieve company settings from the database.</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
          <p className="text-gray-600 mt-1">Manage your company information used across PDFs, emails, and the app</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-56 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {sections.map(section => {
              const Icon = section.icon;
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    activeSection === section.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          {activeSection === 'branding' && (
            <SettingsCard title="Branding" description="Company name, tagline, and logo displayed throughout the application">
              <FieldGroup>
                <Field
                  label="Company Name"
                  value={formData.company_name || ''}
                  onChange={v => handleChange('company_name', v)}
                  placeholder="Your Company Name"
                />
                <Field
                  label="Tagline"
                  value={formData.tagline || ''}
                  onChange={v => handleChange('tagline', v)}
                  placeholder="Premium Vehicle Rentals"
                />
              </FieldGroup>
              <FieldGroup>
                <Field
                  label="Logo Path/URL"
                  value={formData.logo_url || ''}
                  onChange={v => handleChange('logo_url', v)}
                  placeholder="/logo.png"
                  hint="Path to your logo file in the public folder, or a full URL"
                />
              </FieldGroup>
              {formData.logo_url && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Preview</p>
                  <img
                    src={formData.logo_url}
                    alt="Logo preview"
                    className="h-16 w-auto object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              <FieldGroup>
                <Field
                  label="Currency Code"
                  value={formData.currency_code || ''}
                  onChange={v => handleChange('currency_code', v)}
                  placeholder="KES"
                />
                <Field
                  label="Currency Locale"
                  value={formData.currency_locale || ''}
                  onChange={v => handleChange('currency_locale', v)}
                  placeholder="en-KE"
                  hint="Used for number formatting (e.g. en-KE, en-US)"
                />
              </FieldGroup>
            </SettingsCard>
          )}

          {activeSection === 'contact' && (
            <SettingsCard title="Contact Information" description="Phone numbers, email, and address shown on invoices, quotes, and emails">
              <FieldGroup>
                <Field
                  label="Email Address"
                  value={formData.email || ''}
                  onChange={v => handleChange('email', v)}
                  placeholder="info@example.com"
                  type="email"
                />
                <Field
                  label="Website"
                  value={formData.website_url || ''}
                  onChange={v => handleChange('website_url', v)}
                  placeholder="https://example.com"
                />
              </FieldGroup>
              <FieldGroup>
                <Field
                  label="Nanyuki Branch Phone"
                  value={formData.phone_nanyuki || ''}
                  onChange={v => handleChange('phone_nanyuki', v)}
                  placeholder="+254 700 000 000"
                />
                <Field
                  label="Nairobi Branch Phone"
                  value={formData.phone_nairobi || ''}
                  onChange={v => handleChange('phone_nairobi', v)}
                  placeholder="+254 700 000 000"
                />
              </FieldGroup>
              <Field
                label="Address"
                value={formData.address || ''}
                onChange={v => handleChange('address', v)}
                placeholder="Your company address"
                multiline
              />
            </SettingsCard>
          )}

          {activeSection === 'payment' && (
            <SettingsCard title="Payment Details" description="Bank and mobile money information shown on invoices and quotes">
              <Field
                label="Bank Name"
                value={formData.bank_name || ''}
                onChange={v => handleChange('bank_name', v)}
                placeholder="Bank Name"
              />
              <Field
                label="Bank Account Number"
                value={formData.bank_account || ''}
                onChange={v => handleChange('bank_account', v)}
                placeholder="Account number"
              />
              <Field
                label="M-Pesa Till Number"
                value={formData.mpesa_till || ''}
                onChange={v => handleChange('mpesa_till', v)}
                placeholder="Till number"
              />
            </SettingsCard>
          )}

          {activeSection === 'email' && (
            <SettingsCard title="Email Signature" description="Shared signature block appended to email templates via the {{email_signature}} variable">
              <Field
                label="Email Signature"
                value={formData.email_signature || ''}
                onChange={v => handleChange('email_signature', v)}
                placeholder={'Company Name\nTagline\nEmail: info@example.com\nPhone: +254 700 000 000'}
                multiline
                rows={8}
              />
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Available in Email Templates</p>
                    <p>
                      Use <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">{'{{email_signature}}'}</code> in
                      your email template body to insert this signature. Other available variables include{' '}
                      <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">{'{{company_name}}'}</code>,{' '}
                      <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">{'{{company_email}}'}</code>,{' '}
                      <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">{'{{company_phone_nanyuki}}'}</code>, and{' '}
                      <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">{'{{company_phone_nairobi}}'}</code>.
                    </p>
                  </div>
                </div>
              </div>
              {formData.email_signature && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Preview</p>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 whitespace-pre-wrap text-sm text-gray-700 font-mono">
                    {formData.email_signature}
                  </div>
                </div>
              )}
            </SettingsCard>
          )}

          {activeSection === 'email_sending' && (
            <SettingsCard title="Email Sending Account" description="Configure which Gmail account sends all outgoing emails (confirmations, invoices, quotes)">
              <EmailSendingSettings
                picaSecretKey={formData.pica_secret_key || ''}
                picaConnectionKey={formData.pica_connection_key || ''}
                picaActionId={formData.pica_action_id || ''}
                onChange={(field, value) => handleChange(field as keyof CompanySettings, value)}
              />
            </SettingsCard>
          )}

          {activeSection === 'calendar_sync' && (
            <SettingsCard title="Google Calendar Sync" description="Automatically sync all bookings to a shared Google Calendar">
              <CalendarSyncSettings
                googleClientId={formData.google_client_id || ''}
                googleClientSecret={formData.google_client_secret || ''}
                googleRedirectUri={formData.google_redirect_uri || ''}
                onChange={(field, value) => handleChange(field as keyof CompanySettings, value)}
              />
            </SettingsCard>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
}

function Field({ label, value, onChange, placeholder, type = 'text', hint, multiline, rows = 3 }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-y"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
      )}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
