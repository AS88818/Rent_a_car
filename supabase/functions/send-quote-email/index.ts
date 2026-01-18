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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('RESEND_API_KEY:', resendApiKey ? 'SET' : 'MISSING');
    console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured. Please add it to Supabase Edge Function secrets in your project settings.');
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

    // Send email via Resend API
    console.log('\n=== Sending via Resend ===');
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Rentacarinkenya Team <info@autoflow-solutions.com>',
        to: [payload.clientEmail],
        subject: template.subject,
        html: emailBody,
        attachments: [
          {
            filename: `Quote-${payload.quoteReference}.pdf`,
            content: payload.pdfBase64,
          },
        ],
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData);
      throw new Error(`Resend API error: ${resendData.message || resendResponse.statusText}`);
    }

    console.log('\n=== Success ===');
    console.log('Email ID:', resendData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quote email sent successfully',
        emailId: resendData.id,
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