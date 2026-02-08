import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function buildMimeEmail(to: string, subject: string, body: string): string {
  const boundary = "----=_Part_" + Date.now().toString(36);
  const plainText = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  const mime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    plainText,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    body,
    ``,
    `--${boundary}--`,
  ].join('\r\n');

  const encoder = new TextEncoder();
  const data = encoder.encode(mime);
  let base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { recipientEmail }: { recipientEmail: string } = await req.json();

    if (!recipientEmail) {
      throw new Error("Missing required field: recipientEmail");
    }

    const { data: companyRow } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const picaSecretKey = companyRow?.pica_secret_key || Deno.env.get("PICA_SECRET_KEY");
    const picaConnectionKey = companyRow?.pica_connection_key || Deno.env.get("PICA_GMAIL_CONNECTION_KEY");
    const picaActionId = companyRow?.pica_action_id || "conn_mod_def::F_JeJ_A_TKg::cc2kvVQQTiiIiLEDauy6zQ";

    if (!picaSecretKey || !picaConnectionKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Pica credentials are not configured. Please enter your Pica Secret Key and Connection Key in the fields above and save before testing.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const companyName = companyRow?.company_name || "Rent A Car In Kenya";
    const subject = `Test Email from ${companyName}`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af; margin-bottom: 16px;">Email Connection Test Successful</h2>
        <p style="color: #374151; line-height: 1.6;">
          This is a test email sent from <strong>${companyName}</strong> to verify that the email sending integration is working correctly.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #166534; margin: 0; font-weight: 600;">All systems operational</p>
          <p style="color: #166534; margin: 4px 0 0 0; font-size: 14px;">Your Pica/Gmail integration is configured and sending emails successfully.</p>
        </div>
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          Sent at: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })}
        </p>
      </div>
    `;

    const raw = buildMimeEmail(recipientEmail, subject, body);

    const gmailResponse = await fetch("https://api.picaos.com/v1/passthrough/users/me/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pica-secret": picaSecretKey,
        "x-pica-connection-key": picaConnectionKey,
        "x-pica-action-id": picaActionId,
      },
      body: JSON.stringify({ raw }),
    });

    if (!gmailResponse.ok) {
      const errorData = await gmailResponse.text();
      throw new Error(`Gmail API error (${gmailResponse.status}): ${errorData}`);
    }

    const gmailData = await gmailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Test email sent successfully to ${recipientEmail}`,
        emailId: gmailData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending test email:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
