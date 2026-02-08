import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeCodeForTokens } from '../lib/google-oauth';
import { companyCalendarService } from '../services/calendar-service';
import { useAuth } from '../lib/auth-context';
import { showToast } from '../lib/toast';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'processing' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [processed, setProcessed] = useState(false);

  // Check if this page was opened as a popup
  const isPopup = window.opener !== null;

  const notifyOpenerAndClose = (success: boolean, message?: string) => {
    if (isPopup && window.opener) {
      // Send message to parent window
      try {
        window.opener.postMessage(
          { type: 'google-oauth-callback', success, message },
          window.location.origin
        );
      } catch (e) {
        console.error('Failed to post message to opener:', e);
      }
      // Close the popup after a brief delay
      setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          console.error('Failed to close window:', e);
        }
      }, 2000);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      setStatus('loading');
      return;
    }

    // Don't process more than once
    if (processed) return;

    const handleCallback = async () => {
      setProcessed(true);
      setStatus('processing');

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
        const errorMsg = 'You must be logged in to connect Google Calendar. Please log in and try again.';
        setStatus('error');
        setErrorMessage(errorMsg);
        notifyOpenerAndClose(false, errorMsg);
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens(code);

        await companyCalendarService.saveGoogleTokens(
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
            navigate('/company-settings', { replace: true });
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
  }, [authLoading, user, searchParams, navigate, processed]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {(status === 'loading' || status === 'processing') && (
          <>
            <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Connecting Google Calendar</h1>
            <p className="text-gray-600">
              {status === 'loading' ? 'Loading your session...' : 'Please wait while we complete the connection...'}
            </p>
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
                  onClick={() => navigate('/company-settings', { replace: true })}
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
