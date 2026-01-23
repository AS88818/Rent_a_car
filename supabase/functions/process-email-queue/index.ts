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

// Build MIME email and encode to base64url
function buildMimeEmail(to: string, subject: string, body: string): string {
  const mime = `To: ${to}\nSubject: ${subject}\nContent-Type: text/plain; charset=UTF-8\n\n${body}`;
  // Base64url encode
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
        // Build MIME email and encode to base64url
        const raw = buildMimeEmail(email.recipient_email, email.subject, email.body);

        // Send email via Pica Gmail API
        console.log("Sending email to:", email.recipient_email);

        const gmailResponse = await fetch("https://api.picaos.com/v1/passthrough/users/me/messages/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-pica-secret": picaSecretKey,
            "x-pica-connection-key": picaConnectionKey,
            "x-pica-action-id": "conn_mod_def::F_JeJ_A_TKg::cc2kvVQQTiiIiLEDauy6zQ",
          },
          body: JSON.stringify({ raw }),
        });

        console.log("Pica response status:", gmailResponse.status);
        const responseText = await gmailResponse.text();
        console.log("Pica response body:", responseText);

        if (!gmailResponse.ok) {
          throw new Error(`Pica API error (${gmailResponse.status}): ${responseText}`);
        }

        const gmailData = JSON.parse(responseText);
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
