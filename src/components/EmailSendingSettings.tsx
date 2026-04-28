import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Send, Loader2, Info, Link as LinkIcon, Unlink, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import { initiateGmailOAuth, exchangeCodeForTokens } from '../lib/google-oauth';
import { companyCalendarService } from '../services/calendar-service';

interface EmailSendingSettingsProps {
  googleClientId: string;
  googleClientSecret: string;
  isConfigured: boolean; // true when client_id + client_secret are set
}

export function EmailSendingSettings({
  isConfigured,
}: EmailSendingSettingsProps) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    const handleOAuthData = async (data: any, replyFn?: (payload: any) => void) => {
      if (data?.type !== 'gmail-oauth-callback') return;

      if (data.success && data.code) {
        try {
          const tokens = await exchangeCodeForTokens(data.code);
          const { data: existing } = await supabase
            .from('company_settings')
            .select('id')
            .limit(1)
            .maybeSingle();
          if (existing) {
            await supabase
              .from('company_settings')
              .update({ gmail_refresh_token: tokens.refresh_token || '' })
              .eq('id', existing.id);
          }
          replyFn?.({ type: 'gmail-oauth-complete', success: true });
          showToast('Gmail connected successfully!', 'success');
          await loadStatus();
        } catch (err: any) {
          console.error('Gmail token exchange error:', err);
          replyFn?.({ type: 'gmail-oauth-complete', success: false, error: err.message });
          showToast(err.message || 'Failed to connect Gmail', 'error');
        } finally {
          setConnecting(false);
        }
      } else if (data.success && !data.code) {
        setConnecting(false);
        showToast('Gmail connected successfully!', 'success');
        await loadStatus();
      } else {
        setConnecting(false);
        showToast(data.error || data.message || 'Failed to connect Gmail', 'error');
      }
    };

    // BroadcastChannel — works when window.opener is null (Bolt sandbox)
    const bc = new BroadcastChannel('google-oauth-channel');
    bc.onmessage = (event) => {
      const reply = (payload: any) => {
        const replyBc = new BroadcastChannel('google-oauth-channel');
        replyBc.postMessage(payload);
        replyBc.close();
      };
      handleOAuthData(event.data, reply);
    };

    // window.message — works for direct (non-sandboxed) access
    const handleWindowMessage = (event: MessageEvent) => {
      const reply = (payload: any) => {
        if (event.source && 'postMessage' in event.source) {
          (event.source as Window).postMessage(payload, '*');
        }
      };
      handleOAuthData(event.data, reply);
    };
    window.addEventListener('message', handleWindowMessage);

    return () => {
      bc.close();
      window.removeEventListener('message', handleWindowMessage);
    };
  }, []);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const connected = await companyCalendarService.getGmailConnected();
      setGmailConnected(connected);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleConnect = async () => {
    if (!isConfigured) {
      showToast('Save your Google Client ID and Secret in the Calendar Sync section first', 'error');
      return;
    }
    setConnecting(true);
    try {
      await initiateGmailOAuth();
    } catch (err: any) {
      setConnecting(false);
      showToast(err.message || 'Failed to start Gmail connection', 'error');
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await companyCalendarService.disconnectGmail();
      setGmailConnected(false);
      showToast('Gmail disconnected', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to disconnect Gmail', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

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
      if (result.success) showToast('Test email sent successfully!', 'success');
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Failed to send test email' });
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
              This determines which Gmail account sends all outgoing emails — booking confirmations,
              invoices, quotes, and reminders. Connect the account you want recipients to see as the sender
              (e.g. info@rentacarinkenya.com).
            </p>
          </div>
        </div>
      </div>

      {/* Connection status card */}
      {loadingStatus ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-gray-50 border-gray-200">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          <p className="text-sm text-gray-500">Checking connection status...</p>
        </div>
      ) : gmailConnected ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border bg-emerald-50 border-emerald-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Gmail account connected</p>
              <p className="text-xs text-emerald-600 mt-0.5">All outgoing emails will be sent from this account</p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border bg-gray-50 border-gray-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">No Gmail account connected</p>
              <p className="text-xs text-gray-500 mt-0.5">Connect a Gmail account to enable outgoing emails</p>
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
            {connecting ? 'Connecting...' : 'Connect Gmail'}
          </button>
        </div>
      )}

      {!isConfigured && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            To connect Gmail, first enter your Google Client ID and Client Secret in the
            <strong> Calendar Sync</strong> section above and save — they share the same Google Cloud credentials.
          </p>
        </div>
      )}

      {/* Setup instructions */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-500" />
          <p className="text-sm font-semibold text-gray-900">How to connect info@rentacarinkenya.com</p>
        </div>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Make sure your Google Cloud project has the <strong>Gmail API</strong> enabled (same project as Calendar).</li>
          <li>In your OAuth consent screen, add the scope <code className="bg-gray-100 px-1 rounded text-xs">gmail.send</code>.</li>
          <li>Click <strong>Connect Gmail</strong> above and sign in with <strong>info@rentacarinkenya.com</strong>.</li>
          <li>Grant permission to send email on your behalf.</li>
          <li>Send a test email below to confirm it's working.</li>
        </ol>
      </div>

      {/* Test email */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Send Test Email</h3>
        <p className="text-sm text-gray-600 mb-4">
          Verify the connected Gmail account can send emails correctly.
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
            disabled={testing || !testEmail || !gmailConnected}
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
    </div>
  );
}
