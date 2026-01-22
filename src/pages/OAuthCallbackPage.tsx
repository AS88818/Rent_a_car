import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeCodeForTokens } from '../lib/google-oauth';
import { calendarSettingsService } from '../services/calendar-service';
import { useAuth } from '../lib/auth-context';
import { showToast } from '../lib/toast';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  // Check if this page was opened as a popup
  const isPopup = window.opener !== null;

  const notifyOpenerAndClose = (success: boolean, message?: string) => {
    if (isPopup && window.opener) {
      // Send message to parent window
      window.opener.postMessage(
        { type: 'google-oauth-callback', success, message },
        window.location.origin
      );
      // Close the popup after a brief delay
      setTimeout(() => window.close(), 1500);
    }
  };

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        const errorMsg = error === 'access_denied'
          ? 'You denied access to Google Calendar. Please try again if you want to enable calendar sync.'
          : `Google OAuth error: ${error}`;
        setStatus('error');
        setErrorMessage(errorMsg);
        notifyOpenerAndClose(false, errorMsg);
        return;
      }

      if (!code) {
        const errorMsg = 'No authorization code received from Google';
        setStatus('error');
        setErrorMessage(errorMsg);
        notifyOpenerAndClose(false, errorMsg);
        return;
      }

      if (!user?.id) {
        const errorMsg = 'You must be logged in to connect Google Calendar';
        setStatus('error');
        setErrorMessage(errorMsg);
        notifyOpenerAndClose(false, errorMsg);
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens(code);

        await calendarSettingsService.saveGoogleTokens(
          user.id,
          tokens.access_token,
          tokens.refresh_token || '',
          tokens.expires_in
        );

        setStatus('success');

        if (isPopup) {
          notifyOpenerAndClose(true, 'Google Calendar connected successfully!');
        } else {
          showToast('Google Calendar connected successfully!', 'success');
          setTimeout(() => {
            navigate('/calendar', { replace: true });
          }, 2000);
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        const errorMsg = err.message || 'Failed to complete Google Calendar connection';
        setStatus('error');
        setErrorMessage(errorMsg);
        notifyOpenerAndClose(false, errorMsg);
      }
    };

    handleCallback();
  }, [searchParams, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Connecting Google Calendar</h1>
            <p className="text-gray-600">Please wait while we complete the connection...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Connected!</h1>
            <p className="text-gray-600 mb-4">Your Google Calendar has been connected successfully.</p>
            <p className="text-sm text-gray-500">
              {isPopup ? 'This window will close automatically...' : 'Redirecting to calendar...'}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Connection Failed</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <div className="space-y-3">
              {isPopup ? (
                <button
                  onClick={() => window.close()}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close Window
                </button>
              ) : (
                <button
                  onClick={() => navigate('/calendar', { replace: true })}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Back to Calendar
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
