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
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function requireAdmin(req: Request, supabase: ReturnType<typeof createClient>) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Response(JSON.stringify({ success: false, error: "Missing authorization token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new Response(JSON.stringify({ success: false, error: "Invalid authorization token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (data.user.app_metadata?.role !== "admin") {
    throw new Response(JSON.stringify({ success: false, error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await requireAdmin(req, supabase);

    const { recipientEmail }: { recipientEmail: string } = await req.json();

    if (!recipientEmail) {
      throw new Error("Missing required field: recipientEmail");
    }

    const { data: companyRow } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const googleClientId = companyRow?.google_client_id || Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = companyRow?.google_client_secret || Deno.env.get("GOOGLE_CLIENT_SECRET");
    const gmailRefreshToken = companyRow?.gmail_refresh_token || Deno.env.get("GMAIL_REFRESH_TOKEN");

    if (!googleClientId || !googleClientSecret || !gmailRefreshToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Gmail is not connected. Go to Company Settings > Email Sending and connect your Gmail account.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get fresh access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: gmailRefreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(`Failed to refresh Gmail token: ${err}`);
    }
    const { access_token } = await tokenResponse.json();

    const companyName = companyRow?.company_name || "Rent A Car In Kenya";
    const subject = `Test Email from ${companyName}`;
    const body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af; margin-bottom: 16px;">Email Connection Test Successful</h2>
        <p style="color: #374151; line-height: 1.6;">
          This is a test email from <strong>${companyName}</strong> confirming the Gmail integration is working correctly.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #166534; margin: 0; font-weight: 600;">All systems operational</p>
          <p style="color: #166534; margin: 4px 0 0 0; font-size: 14px;">Your Gmail account is connected and sending emails successfully.</p>
        </div>
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          Sent at: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })}
        </p>
      </div>
    `;

    const raw = buildMimeEmail(recipientEmail, subject, body);

    const gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`,
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error sending test email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
