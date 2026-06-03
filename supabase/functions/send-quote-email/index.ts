import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Requested-With',
};

interface QuoteEmailRequest {
  clientEmail: string;
  clientName: string;
  quoteReference: string;
  startDate: string;
  endDate: string;
  duration: string;
  pickupLocation: string;
  dropoffLocation?: string;
  rentalType: string;
  mileageAllowance?: string;
  pdfBase64: string;
  vehicleOptions?: Array<{ name: string; price: number; deposit: number }>;
}

async function requireAllowedUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Response(JSON.stringify({ success: false, error: 'Missing authorization token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.auth.getUser(token);
  const role = data.user?.app_metadata?.role || data.user?.user_metadata?.role;
  if (error || !data.user) {
    throw new Response(JSON.stringify({ success: false, error: 'Invalid authorization token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!['admin', 'user', 'member'].includes(String(role))) {
    throw new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Build MIME email with attachment and encode to base64url
function buildMimeEmailWithAttachment(
  to: string,
  subject: string,
  htmlBody: string,
  attachmentFilename: string,
  attachmentBase64: string
): string {
  const mixedBoundary = "----=_Mixed_" + Date.now().toString(36);
  const altBoundary = "----=_Alt_" + (Date.now() + 1).toString(36);
  const plainText = htmlBody.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  const mime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    ``,
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    plainText,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
    ``,
    `--${altBoundary}--`,
    ``,
    `--${mixedBoundary}`,
    `Content-Type: application/pdf; name="${attachmentFilename}"`,
    `Content-Disposition: attachment; filename="${attachmentFilename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    attachmentBase64,
    ``,
    `--${mixedBoundary}--`,
  ].join('\r\n');

  // Base64url encode
  const encoder = new TextEncoder();
  const data = encoder.encode(mime);
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req: Request) => {
  console.log('\n=== Edge Function Invoked ===');
  console.log('Method:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    console.log('\n=== Environment Check ===');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables are not configured properly');
    }

    await requireAllowedUser(req, supabaseUrl, supabaseKey);

    console.log('\n=== Parsing Request ===');
    const payload: QuoteEmailRequest = await req.json();
    console.log('Client:', payload.clientName);
    console.log('Email:', payload.clientEmail);
    console.log('Quote:', payload.quoteReference);

    console.log('\n=== Fetching Company Settings ===');
    const settingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/company_settings?select=*&limit=1`,
      {
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    const settingsRows = settingsResponse.ok ? await settingsResponse.json() : [];
    const companyData = settingsRows?.[0] || {};

    const googleClientId = companyData.google_client_id || Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = companyData.google_client_secret || Deno.env.get('GOOGLE_CLIENT_SECRET');
    const gmailRefreshToken = companyData.gmail_refresh_token || Deno.env.get('GMAIL_REFRESH_TOKEN');

    console.log('GOOGLE_CLIENT_ID:', googleClientId ? 'SET' : 'MISSING');
    console.log('GMAIL_REFRESH_TOKEN:', gmailRefreshToken ? 'SET' : 'MISSING');

    if (!googleClientId || !googleClientSecret || !gmailRefreshToken) {
      throw new Error('Gmail credentials are not configured. Connect a Gmail account in Company Settings > Email Sending.');
    }

    const companyVars: Record<string, string> = {
      company_name: companyData.company_name || '',
      company_tagline: companyData.tagline || '',
      company_email: companyData.email || '',
      company_phone_nanyuki: companyData.phone_nanyuki || '',
      company_phone_nairobi: companyData.phone_nairobi || '',
      company_website: companyData.website_url || '',
      company_address: companyData.address || '',
      email_signature: companyData.email_signature || '',
    };

    console.log('\n=== Fetching Template ===');
    const templateResponse = await fetch(
      `${supabaseUrl}/rest/v1/email_templates?template_key=eq.quote_submission&is_active=eq.true&select=*`,
      {
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch template: ${templateResponse.statusText}`);
    }

    const templates = await templateResponse.json();
    if (!templates || templates.length === 0) {
      throw new Error('Quote email template not found');
    }

    const template = templates[0];
    console.log('Template found:', template.template_name);

    console.log('\n=== Building Email ===');
    const fmtNum = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const vehicleOptionsList = (payload.vehicleOptions || [])
      .map((v, i) => `${i + 1}. ${v.name} at KES ${fmtNum(v.price)}/- PLUS a refundable security deposit of KES ${fmtNum(v.deposit)}/-`)
      .join('\n\n');

    const allVars: Record<string, string> = {
      ...companyVars,
      client_name: payload.clientName,
      quote_reference: payload.quoteReference,
      start_date: payload.startDate,
      end_date: payload.endDate,
      duration: payload.duration,
      pickup_location: payload.pickupLocation,
      dropoff_location: payload.dropoffLocation || payload.pickupLocation,
      rental_type: payload.rentalType,
      mileage_allowance: payload.mileageAllowance || '',
      vehicle_options: vehicleOptionsList,
    };

    let emailBody = template.body;
    let emailSubject = template.subject;
    Object.entries(allVars).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      emailBody = emailBody.replace(regex, value);
      emailSubject = emailSubject.replace(regex, value);
    });

    // If body is plain text (not HTML), convert to HTML for email rendering
    if (!emailBody.trimStart().startsWith('<')) {
      emailBody = '<html><body><pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.6">' +
        emailBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
        '</pre></body></html>';
    }

    // Get a fresh Gmail access token
    console.log('\n=== Refreshing Gmail Access Token ===');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: gmailRefreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(`Failed to refresh Gmail token: ${err}`);
    }
    const { access_token } = await tokenResponse.json();

    // Build MIME email with attachment
    console.log('\n=== Sending via Gmail API ===');
    const attachmentFilename = `Quote-${payload.quoteReference}.pdf`;
    const raw = buildMimeEmailWithAttachment(
      payload.clientEmail,
      emailSubject,
      emailBody,
      attachmentFilename,
      payload.pdfBase64
    );

    // Send email via direct Gmail API
    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify({ raw }),
    });

    const responseText = await gmailResponse.text();

    if (!gmailResponse.ok) {
      console.error('Gmail API error:', responseText);
      throw new Error(`Gmail API error: ${responseText}`);
    }

    const gmailData = JSON.parse(responseText);

    console.log('\n=== Success ===');
    console.log('Email ID:', gmailData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quote email sent successfully',
        emailId: gmailData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('\n=== Error ===');
    console.error('Type:', error.constructor?.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send quote email',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
