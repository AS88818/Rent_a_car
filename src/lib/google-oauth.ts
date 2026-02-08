import { supabase } from './supabase';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

const DEFAULT_REDIRECT_URI = 'https://rent-a-car-in-kenya-g64w.bolt.host/oauth/callback.html';

export async function getCompanyGoogleConfig(): Promise<GoogleOAuthConfig> {
  const { data } = await supabase
    .from('company_settings')
    .select('google_client_id, google_client_secret, google_redirect_uri')
    .limit(1)
    .maybeSingle();

  const clientId = data?.google_client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const clientSecret = data?.google_client_secret || import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';
  const redirectUri = data?.google_redirect_uri || DEFAULT_REDIRECT_URI;

  if (!clientId) {
    throw new Error('Google OAuth Client ID is not configured. Set it in Company Settings or VITE_GOOGLE_CLIENT_ID.');
  }

  return { clientId, clientSecret, redirectUri };
}

export async function initiateGoogleOAuth(): Promise<void> {
  const config = await getCompanyGoogleConfig();

  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${config.clientId}&` +
    `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
    `response_type=code&` +
    `scope=${scope}&` +
    `access_type=offline&` +
    `prompt=consent`;

  const isInIframe = window.self !== window.top;

  if (isInIframe) {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      authUrl,
      'google-oauth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
  } else {
    window.location.href = authUrl;
  }
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const config = await getCompanyGoogleConfig();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange code for tokens');
  }

  return await response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const config = await getCompanyGoogleConfig();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to refresh access token');
  }

  return await response.json();
}

export function getAuthorizationHeader(accessToken: string): string {
  return `Bearer ${accessToken}`;
}

export function isTokenExpired(tokenExpiry: string): boolean {
  const expiryDate = new Date(tokenExpiry);
  const now = new Date();
  const bufferMinutes = 5;
  const bufferMs = bufferMinutes * 60 * 1000;
  return expiryDate.getTime() - bufferMs <= now.getTime();
}
