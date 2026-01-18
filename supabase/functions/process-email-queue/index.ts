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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
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
        // Send email via Resend
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "FleetHub <info@autoflow-solutions.com>",
            to: [email.recipient_email],
            subject: email.subject,
            text: email.body,
          }),
        });

        if (!resendResponse.ok) {
          const errorData = await resendResponse.json();
          throw new Error(errorData.message || "Failed to send email via Resend");
        }

        const resendData = await resendResponse.json();
        console.log(`Email sent successfully. Resend ID: ${resendData.id}`);

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