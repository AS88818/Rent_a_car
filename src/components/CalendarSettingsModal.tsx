import { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Unlink, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { showToast } from '../lib/toast';
import { useAuth } from '../lib/auth-context';
import { calendarSettingsService, bookingSyncService } from '../services/calendar-service';
import { initiateGoogleOAuth, exchangeCodeForTokens } from '../lib/google-oauth';

interface CalendarSettingsModalProps {
  onClose: () => void;
}

interface CalendarSettings {
  sync_enabled: boolean;
  google_calendar_id?: string;
  last_sync_at?: string;
}

export function CalendarSettingsModal({ onClose }: CalendarSettingsModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setIsSyncing] = useState(false);
  const [settings, setSettings] = useState<CalendarSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  // Listen for OAuth callback messages from popup window
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-oauth-callback') {
        if (event.data.success && event.data.code) {
          // Popup sent us the authorization code - exchange it for tokens
          try {
            if (!user?.id) {
              throw new Error('Not logged in');
            }

            const tokens = await exchangeCodeForTokens(event.data.code);

            await calendarSettingsService.saveGoogleTokens(
              user.id,
              tokens.access_token,
              tokens.refresh_token || '',
              tokens.expires_in
            );

            // Notify popup of success
            if (event.source && 'postMessage' in event.source) {
              (event.source as Window).postMessage({ type: 'google-oauth-complete', success: true }, '*');
            }

            showToast('Google Calendar connected successfully!', 'success');
            fetchSettings();
          } catch (err: any) {
            console.error('Token exchange error:', err);
            // Notify popup of failure
            if (event.source && 'postMessage' in event.source) {
              (event.source as Window).postMessage({ type: 'google-oauth-complete', success: false, error: err.message }, '*');
            }
            showToast(err.message || 'Failed to connect Google Calendar', 'error');
          }
        } else if (event.data.error) {
          showToast(event.data.error || 'Failed to connect Google Calendar', 'error');
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [user]);

  const fetchSettings = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await calendarSettingsService.getSettings(user.id);
      if (data && data.google_access_token) {
        setSettings({
          sync_enabled: data.sync_enabled,
          google_calendar_id: data.google_calendar_id,
          last_sync_at: data.last_sync_at
        });
      } else {
        setSettings({
          sync_enabled: false,
          google_calendar_id: undefined,
          last_sync_at: undefined
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showToast('Failed to load calendar settings', 'error');
      setSettings({
        sync_enabled: false,
        google_calendar_id: undefined,
        last_sync_at: undefined
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      initiateGoogleOAuth();
    } catch (error: any) {
      console.error('Failed to initiate OAuth:', error);
      showToast(error.message || 'Failed to connect to Google Calendar', 'error');
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;

    if (!window.confirm('Are you sure you want to disconnect Google Calendar? This will stop syncing bookings.')) {
      return;
    }

    try {
      await calendarSettingsService.disconnect(user.id);
      setSettings({
        sync_enabled: false,
        google_calendar_id: undefined,
        last_sync_at: undefined
      });
      showToast('Google Calendar disconnected', 'success');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      showToast('Failed to disconnect Google Calendar', 'error');
    }
  };

  const handleSyncNow = async () => {
    if (!user?.id) return;

    setIsSyncing(true);
    try {
      await bookingSyncService.syncAllBookings(user.id);
      await fetchSettings();
      showToast('Calendar synced successfully', 'success');
    } catch (error: any) {
      console.error('Failed to sync:', error);
      showToast(error.message || 'Failed to sync calendar', 'error');
    } finally {
      setIsSyncing(false);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Calendar Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Google Calendar Integration</p>
                    <p>
                      Connect your Google Calendar to automatically sync bookings as calendar events.
                      Each booking will create a separate event with all details including client information,
                      vehicle details, and booking notes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Status</h3>

                {settings?.sync_enabled ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-green-600">
                      <CheckCircle className="w-6 h-6" />
                      <span className="font-medium">Connected to Google Calendar</span>
                    </div>

                    {settings.google_calendar_id && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Calendar ID:</span>{' '}
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                          {settings.google_calendar_id}
                        </span>
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Last synced:</span>{' '}
                      {formatLastSync(settings.last_sync_at)}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSyncNow}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                      </button>

                      <button
                        onClick={handleDisconnect}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Unlink className="w-4 h-4" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-gray-600">
                      <p className="mb-4">
                        Connect your Google Calendar to enable automatic syncing of bookings.
                        This feature is currently in development.
                      </p>
                    </div>

                    <button
                      onClick={handleConnect}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <LinkIcon className="w-5 h-5" />
                      Connect Google Calendar
                    </button>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Each booking creates a separate Google Calendar event</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Event title includes vehicle registration and client name</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Event description contains full booking details, contact info, and notes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Events are automatically updated when bookings change</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Cancelled bookings are removed from your calendar</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
