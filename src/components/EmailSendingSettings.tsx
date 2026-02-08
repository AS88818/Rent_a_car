import { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, AlertTriangle, Send, Loader2, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';

interface EmailSendingSettingsProps {
  picaSecretKey: string;
  picaConnectionKey: string;
  picaActionId: string;
  onChange: (field: string, value: string) => void;
}

export function EmailSendingSettings({ picaSecretKey, picaConnectionKey, picaActionId, onChange }: EmailSendingSettingsProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const isConfigured = !!(picaSecretKey && picaConnectionKey);

  const handleSendTest = async () => {
    if (!testEmail) {
      showToast('Please enter a recipient email address', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-email-connection`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ recipientEmail: testEmail }),
        }
      );

      const result = await response.json();
      setTestResult({
        success: result.success,
        message: result.success ? result.message : result.error,
      });

      if (result.success) {
        showToast('Test email sent successfully!', 'success');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to send test email',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">What does this control?</p>
            <p className="leading-relaxed">
              These settings determine which Gmail account sends all outgoing emails -- booking confirmations,
              invoices, quotes, and reminders. Changing these values will change the sender address on all
              future emails sent by the system.
            </p>
          </div>
        </div>
      </div>

      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
        isConfigured
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-gray-50 border-gray-200'
      }`}>
        {isConfigured ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Email credentials configured</p>
              <p className="text-xs text-emerald-600 mt-0.5">The system will use these credentials for all outgoing emails</p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">No credentials configured here</p>
              <p className="text-xs text-gray-500 mt-0.5">The system is using environment variable defaults (if set)</p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <MaskedField
          label="Pica Secret Key"
          value={picaSecretKey}
          onChange={v => onChange('pica_secret_key', v)}
          visible={showSecret}
          onToggle={() => setShowSecret(!showSecret)}
          placeholder="Enter your Pica secret key"
          hint="Found in your Pica dashboard under API Keys / Settings"
        />
        <MaskedField
          label="Pica Connection Key"
          value={picaConnectionKey}
          onChange={v => onChange('pica_connection_key', v)}
          visible={showConnection}
          onToggle={() => setShowConnection(!showConnection)}
          placeholder="Enter your Pica Gmail connection key"
          hint="Created when you connect a Gmail account in Pica"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Pica Action ID</label>
          <input
            type="text"
            value={picaActionId}
            onChange={e => onChange('pica_action_id', e.target.value)}
            placeholder="conn_mod_def::..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">The action ID for Gmail send. Usually does not need to change unless you set up a new connection.</p>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Send Test Email</h3>
        <p className="text-sm text-gray-600 mb-4">
          Save your changes first, then send a test email to verify the connection is working.
        </p>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>
          <button
            onClick={handleSendTest}
            disabled={testing || !testEmail}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {testing ? 'Sending...' : 'Send Test'}
          </button>
        </div>

        {testResult && (
          <div className={`mt-3 px-4 py-3 rounded-lg text-sm ${
            testResult.success
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {testResult.success ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{testResult.message}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
        >
          <span className="text-sm font-semibold text-gray-900">How to Change Your Email Sender</span>
          {guideOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>

        {guideOpen && (
          <div className="mt-4 space-y-6 px-1">
            <p className="text-sm text-gray-600 leading-relaxed">
              Follow these steps to connect a different Gmail account as the sender for all outgoing emails.
              The recipient will see this Gmail address as the "From" address.
            </p>

            <ol className="space-y-5">
              <GuideStep
                number={1}
                title="Log in to Pica"
              >
                Go to{' '}
                <a href="https://app.picaos.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                  app.picaos.com <ExternalLink className="w-3 h-3" />
                </a>{' '}
                and sign in to your account.
              </GuideStep>

              <GuideStep
                number={2}
                title="Add a new Gmail connection"
              >
                Navigate to <strong>Connections</strong> in the left sidebar, then click <strong>"Add Connection"</strong>.
                Search for and select <strong>Gmail</strong> as the provider.
              </GuideStep>

              <GuideStep
                number={3}
                title="Authorize the Gmail account"
              >
                A Google sign-in window will appear. Sign in with the Gmail account you want emails
                to be sent from and grant the requested permissions. This is the email address
                that recipients will see in the "From" field.
              </GuideStep>

              <GuideStep
                number={4}
                title="Copy your credentials"
              >
                After connecting, you will find three values in your Pica dashboard:
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                    <span><strong>Secret Key</strong> -- found under your account/API settings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                    <span><strong>Connection Key</strong> -- shown on the Gmail connection you just created</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                    <span><strong>Action ID</strong> -- found in the connection's action details (usually starts with "conn_mod_def::")</span>
                  </li>
                </ul>
              </GuideStep>

              <GuideStep
                number={5}
                title="Paste the values here"
              >
                Enter the three values into the fields above on this page.
              </GuideStep>

              <GuideStep
                number={6}
                title='Click "Save Changes"'
              >
                Use the <strong>Save Changes</strong> button at the top of the page. The new credentials
                will take effect immediately for all future emails.
              </GuideStep>

              <GuideStep
                number={7}
                title="Send a test email"
              >
                Use the <strong>Send Test Email</strong> section above to verify that emails are
                being sent correctly from the new account. Check the test recipient's inbox
                (and spam folder) to confirm delivery.
              </GuideStep>
            </ol>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold mb-1">Important</p>
                  <p>
                    Changing these values affects all outgoing emails immediately. Always send a test
                    email after making changes to confirm the new account is working before relying on it
                    for customer communications.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MaskedField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
  hint: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
  );
}

function GuideStep({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{children}</p>
      </div>
    </li>
  );
}
