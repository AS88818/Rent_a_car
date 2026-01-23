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

// Helper function to encode string to base64url (Gmail API format)
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper function to build RFC 2822 formatted email with attachment
function buildEmailMessageWithAttachment(
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  attachmentFilename: string,
  attachmentBase64: string
): string {
  const boundary = "----=_Part_" + Date.now().toString(36);

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${boundary}_alt"`,
    ``,
    `--${boundary}_alt`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlBody.replace(/<[^>]*>/g, ''),
    ``,
    `--${boundary}_alt`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlBody,
    ``,
    `--${boundary}_alt--`,
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${attachmentFilename}"`,
    `Content-Disposition: attachment; filename="${attachmentFilename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    attachmentBase64,
    ``,
    `--${boundary}--`,
  ].join('\r\n');

  return message;
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

    // Fetch email template from Supabase
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

    // Replace variables in template
    console.log('\n=== Building Email ===');
    let emailBody = template.body;
    emailBody = emailBody.replace(/\{\{client_name\}\}/g, payload.clientName);
    emailBody = emailBody.replace(/\{\{quote_reference\}\}/g, payload.quoteReference);
    emailBody = emailBody.replace(/\{\{start_date\}\}/g, payload.startDate);
    emailBody = emailBody.replace(/\{\{end_date\}\}/g, payload.endDate);
    emailBody = emailBody.replace(/\{\{duration\}\}/g, payload.duration);
    emailBody = emailBody.replace(/\{\{pickup_location\}\}/g, payload.pickupLocation);
    emailBody = emailBody.replace(/\{\{rental_type\}\}/g, payload.rentalType);

    // Build email with attachment
    console.log('\n=== Sending via Pica Gmail ===');
    const fromEmail = "rentacarinkenya@gmail.com";
    const fromHeader = `Rentacarinkenya Team <${fromEmail}>`;
    const attachmentFilename = `Quote-${payload.quoteReference}.pdf`;

    const emailMessage = buildEmailMessageWithAttachment(
      fromHeader,
      payload.clientEmail,
      template.subject,
      emailBody,
      attachmentFilename,
      payload.pdfBase64
    );
    const encodedMessage = base64UrlEncode(emailMessage);

    // Send email via Pica Gmail API
    const gmailResponse = await fetch('https://api.picaos.com/v1/passthrough/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pica-secret': picaSecretKey,
        'x-pica-connection-key': picaConnectionKey,
      },
      body: JSON.stringify({
        raw: encodedMessage,
      }),
    });

    const gmailData = await gmailResponse.json();

    if (!gmailResponse.ok) {
      console.error('Gmail API error:', gmailData);
      throw new Error(`Gmail API error: ${gmailData.error?.message || gmailResponse.statusText}`);
    }

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