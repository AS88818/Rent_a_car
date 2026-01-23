import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailQueueItem {
  id: string;
  booking_id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body: string;
  scheduled_for: string;
  attempts: number;
}

// Helper function to encode string to base64url (Gmail API format)
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper function to build RFC 2822 formatted email
function buildEmailMessage(from: string, to: string, subject: string, textBody: string): string {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    textBody,
  ].join('\r\n');

  return message;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const picaSecretKey = Deno.env.get("PICA_SECRET_KEY");
    const picaConnectionKey = Deno.env.get("PICA_GMAIL_CONNECTION_KEY");

    if (!picaSecretKey || !picaConnectionKey) {
      throw new Error("Pica environment variables are not set (PICA_SECRET_KEY, PICA_GMAIL_CONNECTION_KEY)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables are not set");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending emails that are due to be sent
    const { data: pendingEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .lt("attempts", 3)
      .order("scheduled_for", { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error("Error fetching pending emails:", fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending emails to process",
          processed: 0
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each email
    for (const email of pendingEmails as EmailQueueItem[]) {
      results.processed++;

      try {
        // Build email in RFC 2822 format
        const fromEmail = "rentacarinkenya@gmail.com";
        const fromHeader = `Rentacarinkenya Team <${fromEmail}>`;
        const emailMessage = buildEmailMessage(fromHeader, email.recipient_email, email.subject, email.body);
        const encodedMessage = base64UrlEncode(emailMessage);

        // Send email via Pica Gmail API
        const gmailResponse = await fetch("https://api.picaos.com/v1/passthrough/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${picaSecretKey}`,
            "x-pica-connection-key": picaConnectionKey,
          },
          body: JSON.stringify({
            raw: encodedMessage,
          }),
        });

        if (!gmailResponse.ok) {
          const errorData = await gmailResponse.json();
          throw new Error(errorData.error?.message || "Failed to send email via Gmail");
        }

        const gmailData = await gmailResponse.json();
        console.log(`Email sent successfully. Gmail ID: ${gmailData.id}`);

        // Update email queue status to sent
        const { error: updateError } = await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: email.attempts + 1,
            error_message: null,
          })
          .eq("id", email.id);

        if (updateError) {
          console.error(`Error updating email queue for ${email.id}:`, updateError);
        } else {
          results.sent++;
        }
      } catch (error) {
        console.error(`Error sending email ${email.id}:`, error);
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`${email.id}: ${errorMessage}`);
        results.failed++;

        // Update email queue with error
        const { error: updateError } = await supabase
          .from("email_queue")
          .update({
            status: email.attempts + 1 >= 3 ? "failed" : "pending",
            attempts: email.attempts + 1,
            error_message: errorMessage,
          })
          .eq("id", email.id);

        if (updateError) {
          console.error(`Error updating failed email ${email.id}:`, updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} emails`,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in process-email-queue:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});