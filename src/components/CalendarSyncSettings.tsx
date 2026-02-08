import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, CheckCircle2, AlertTriangle, RefreshCw, Loader2,
  ChevronDown, ChevronUp, ExternalLink, Info, Link as LinkIcon, Unlink, Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import { companyCalendarService, bookingSyncService } from '../services/calendar-service';
import { initiateGoogleOAuth, exchangeCodeForTokens } from '../lib/google-oauth';

interface CalendarSyncSettingsProps {
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  onChange: (field: string, value: string) => void;
}

export function CalendarSyncSettings({
  googleClientId,
  googleClientSecret,
  googleRedirectUri,
  onChange,
}: CalendarSyncSettingsProps) {
  const [showSecret, setShowSecret] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    calendarId?: string;
    lastSyncAt?: string;
    syncEnabled?: boolean;
  }>({ connected: false });
  const [loadingStatus, setLoadingStatus] = useState(true);

  const isConfigured = !!(googleClientId && googleClientSecret);

  useEffect(() => {
    loadConnectionStatus();
  }, []);

  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-oauth-callback') {
        if (event.data.success && event.data.code) {
          setConnecting(true);
          try {
            const tokens = await exchangeCodeForTokens(event.data.code);

            await companyCalendarService.saveGoogleTokens(
              tokens.access_token,
              tokens.refresh_token || '',
              tokens.expires_in
            );

            if (event.source && 'postMessage' in event.source) {
              (event.source as Window).postMessage({ type: 'google-oauth-complete', success: true }, '*');
            }

            showToast('Google Calendar connected successfully!', 'success');
            await loadConnectionStatus();
          } catch (err: any) {
            console.error('Token exchange error:', err);
            if (event.source && 'postMessage' in event.source) {
              (event.source as Window).postMessage({ type: 'google-oauth-complete', success: false, error: err.message }, '*');
            }
            showToast(err.message || 'Failed to connect Google Calendar', 'error');
          } finally {
            setConnecting(false);
          }
        } else if (event.data.error) {
          showToast(event.data.error || 'Failed to connect Google Calendar', 'error');
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const loadConnectionStatus = async () => {
    setLoadingStatus(true);
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('google_access_token, google_calendar_id, google_last_sync_at, google_sync_enabled')
        .limit(1)
        .maybeSingle();

      if (data && data.google_access_token) {
        setConnectionStatus({
          connected: true,
          calendarId: data.google_calendar_id || undefined,
          lastSyncAt: data.google_last_sync_at || undefined,
          syncEnabled: data.google_sync_enabled,
        });
      } else {
        setConnectionStatus({ connected: false });
      }
    } catch {
      setConnectionStatus({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleConnect = async () => {
    if (!isConfigured) {
      showToast('Please save your Google OAuth credentials first', 'error');
      return;
    }
    try {
      setConnecting(true);
      await initiateGoogleOAuth();
    } catch (error: any) {
      showToast(error.message || 'Failed to initiate Google Calendar connection', 'error');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? This will stop automatic syncing of bookings.')) {
      return;
    }
    try {
      await companyCalendarService.disconnect();
      setConnectionStatus({ connected: false });
      showToast('Google Calendar disconnected', 'success');
    } catch {
      showToast('Failed to disconnect Google Calendar', 'error');
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await bookingSyncService.syncAllBookings();
      await loadConnectionStatus();
      showToast('All bookings synced to Google Calendar', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to sync bookings', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAutoSync = async () => {
    const newValue = !connectionStatus.syncEnabled;
    try {
      await companyCalendarService.updateConfig({
        google_sync_enabled: newValue,
      } as any);
      setConnectionStatus(prev => ({ ...prev, syncEnabled: newValue }));
      showToast(newValue ? 'Automatic sync enabled' : 'Automatic sync disabled', 'success');
    } catch {
      showToast('Failed to update sync setting', 'error');
    }
  };

  const formatLastSync = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">What does this control?</p>
            <p className="leading-relaxed">
              Connect a Google Calendar to automatically sync all bookings as calendar events.
              When enabled, every new booking, update, or cancellation will be reflected in the
              connected calendar automatically -- regardless of which team member makes the change.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <h3 className="text-sm font-semibold text-gray-900">Google OAuth Credentials</h3>

        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
          isConfigured
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          {isConfigured ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">OAuth credentials configured</p>
                <p className="text-xs text-emerald-600 mt-0.5">You can now connect a Google Calendar below</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700">No credentials configured</p>
                <p className="text-xs text-gray-500 mt-0.5">Enter your Google OAuth credentials below, then save</p>
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Google Client ID</label>
          <input
            type="text"
            value={googleClientId}
            onChange={e => onChange('google_client_id', e.target.value)}
            placeholder="123456789.apps.googleusercontent.com"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">Found in your Google Cloud Console under OAuth 2.0 Client IDs</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Google Client Secret</label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={googleClientSecret}
              onChange={e => onChange('google_client_secret', e.target.value)}
              placeholder="Enter your client secret"
              className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              title={showSecret ? 'Hide' : 'Show'}
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Found alongside your Client ID in the Google Cloud Console</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Redirect URI</label>
          <input
            type="text"
            value={googleRedirectUri}
            onChange={e => onChange('google_redirect_uri', e.target.value)}
            placeholder="https://your-domain.com/oauth/callback.html"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">Must match the authorized redirect URI in your Google Cloud Console. Leave blank for default.</p>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Google Calendar Connection</h3>

        {loadingStatus ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : connectionStatus.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">Connected to Google Calendar</p>
                {connectionStatus.calendarId && (
                  <p className="text-xs text-emerald-600 mt-0.5 font-mono">{connectionStatus.calendarId}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Automatic Sync</p>
                <p className="text-xs text-gray-500 mt-0.5">Sync bookings to calendar on create, update, and cancel</p>
              </div>
              <button
                onClick={handleToggleAutoSync}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  connectionStatus.syncEnabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    connectionStatus.syncEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="text-sm text-gray-600 px-1">
              <span className="font-medium">Last synced:</span>{' '}
              {formatLastSync(connectionStatus.lastSyncAt)}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSyncAll}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync All Bookings'}
              </button>

              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <Unlink className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {isConfigured
                ? 'Save your credentials above, then click the button below to connect a Google Calendar account.'
                : 'Enter and save your Google OAuth credentials above first, then connect your calendar.'}
            </p>
            <button
              onClick={handleConnect}
              disabled={!isConfigured || connecting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LinkIcon className="w-4 h-4" />
              )}
              {connecting ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">How It Works</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span>Each booking creates a separate Google Calendar event automatically</span>
          </li>
          <li className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span>Event title includes vehicle registration and client name</span>
          </li>
          <li className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span>Events are automatically updated when bookings are modified</span>
          </li>
          <li className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span>Cancelled bookings are removed from the calendar</span>
          </li>
          <li className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span>All team members' booking changes sync to the same company calendar</span>
          </li>
        </ul>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
        >
          <span className="text-sm font-semibold text-gray-900">Setup Guide: Create Google OAuth Credentials</span>
          {guideOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>

        {guideOpen && (
          <div className="mt-4 space-y-6 px-1">
            <p className="text-sm text-gray-600 leading-relaxed">
              Follow these steps to create the Google OAuth credentials needed for calendar integration.
            </p>

            <ol className="space-y-5">
              <GuideStep number={1} title="Go to Google Cloud Console">
                Visit{' '}
                <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                  console.cloud.google.com <ExternalLink className="w-3 h-3" />
                </a>{' '}
                and sign in. Create a new project or select an existing one.
              </GuideStep>

              <GuideStep number={2} title="Enable the Google Calendar API">
                Go to <strong>APIs & Services</strong> then <strong>Library</strong>. Search for
                "Google Calendar API" and click <strong>Enable</strong>.
              </GuideStep>

              <GuideStep number={3} title="Configure OAuth Consent Screen">
                Go to <strong>APIs & Services</strong> then <strong>OAuth consent screen</strong>.
                Select <strong>External</strong> user type, fill in the required fields
                (app name, support email), and add the scope
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono mx-1">
                  https://www.googleapis.com/auth/calendar
                </code>.
              </GuideStep>

              <GuideStep number={4} title="Create OAuth 2.0 Credentials">
                Go to <strong>APIs & Services</strong> then <strong>Credentials</strong>.
                Click <strong>Create Credentials</strong> and select <strong>OAuth client ID</strong>.
                Choose <strong>Web application</strong> as the type.
              </GuideStep>

              <GuideStep number={5} title="Set the Redirect URI">
                Under "Authorized redirect URIs", add your callback URL. The default is:
                <code className="block mt-1 bg-gray-100 px-2 py-1 rounded text-xs font-mono break-all">
                  https://rent-a-car-in-kenya-g64w.bolt.host/oauth/callback.html
                </code>
                If you use a custom domain, update this to match and enter it in the Redirect URI field above.
              </GuideStep>

              <GuideStep number={6} title="Copy the Client ID and Secret">
                After creating, copy the <strong>Client ID</strong> and <strong>Client Secret</strong> values
                and paste them into the fields above.
              </GuideStep>

              <GuideStep number={7} title="Save and Connect">
                Click <strong>Save Changes</strong> at the top of this page, then use the
                <strong> Connect Google Calendar</strong> button to authorize access. Sign in with
                the Google account whose calendar you want bookings synced to.
              </GuideStep>
            </ol>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Important</p>
                  <p>
                    The connected Google Calendar will be shared across all team members.
                    Any booking created, updated, or cancelled by any user will automatically
                    appear on this calendar.
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
