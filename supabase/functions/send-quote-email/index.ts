import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  rentalType: string;
  pdfBase64: string;
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
  let base64 = btoa(String.fromCharCode(...data));
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
    const picaSecretKey = Deno.env.get('PICA_SECRET_KEY');
    const picaConnectionKey = Deno.env.get('PICA_GMAIL_CONNECTION_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('PICA_SECRET_KEY:', picaSecretKey ? 'SET' : 'MISSING');
    console.log('PICA_GMAIL_CONNECTION_KEY:', picaConnectionKey ? 'SET' : 'MISSING');
    console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');

    if (!picaSecretKey || !picaConnectionKey) {
      throw new Error('Pica environment variables are not configured. Please add PICA_SECRET_KEY and PICA_GMAIL_CONNECTION_KEY to Supabase Edge Function secrets.');
    }

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables are not configured properly');
    }

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
    const allVars: Record<string, string> = {
      ...companyVars,
      client_name: payload.clientName,
      quote_reference: payload.quoteReference,
      start_date: payload.startDate,
      end_date: payload.endDate,
      duration: payload.duration,
      pickup_location: payload.pickupLocation,
      rental_type: payload.rentalType,
    };

    let emailBody = template.body;
    let emailSubject = template.subject;
    Object.entries(allVars).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      emailBody = emailBody.replace(regex, value);
      emailSubject = emailSubject.replace(regex, value);
    });

    // Build MIME email with attachment
    console.log('\n=== Sending via Pica Gmail ===');
    const attachmentFilename = `Quote-${payload.quoteReference}.pdf`;
    const raw = buildMimeEmailWithAttachment(
      payload.clientEmail,
      emailSubject,
      emailBody,
      attachmentFilename,
      payload.pdfBase64
    );

    // Send email via Pica Gmail API
    const gmailResponse = await fetch('https://api.picaos.com/v1/passthrough/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pica-secret': picaSecretKey,
        'x-pica-connection-key': picaConnectionKey,
        'x-pica-action-id': 'conn_mod_def::F_JeJ_A_TKg::cc2kvVQQTiiIiLEDauy6zQ',
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
