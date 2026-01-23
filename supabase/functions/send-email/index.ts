import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  bookingId?: string;
  invoiceId?: string;
  emailType: 'confirmation' | 'pickup_reminder' | 'dropoff_reminder' | 'invoice_receipt';
}

// Helper function to encode string to base64url (Gmail API format)
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let base64 = btoa(String.fromCharCode(...data));
  // Convert to base64url format
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper function to build RFC 2822 formatted email
function buildEmailMessage(from: string, to: string, subject: string, htmlBody: string): string {
  const boundary = "----=_Part_" + Date.now().toString(36);

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlBody.replace(/<[^>]*>/g, ''), // Plain text version
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlBody,
    ``,
    `--${boundary}--`,
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const picaSecretKey = Deno.env.get("PICA_SECRET_KEY");
    const picaConnectionKey = Deno.env.get("PICA_GMAIL_CONNECTION_KEY");

    if (!picaSecretKey || !picaConnectionKey) {
      throw new Error("Pica environment variables are not set (PICA_SECRET_KEY, PICA_GMAIL_CONNECTION_KEY)");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { bookingId, invoiceId, emailType }: EmailRequest = await req.json();

    if ((!bookingId && !invoiceId) || !emailType) {
      throw new Error("Missing required fields: (bookingId or invoiceId) and emailType");
    }

    let recipientEmail: string;
    let recipientName: string;
    let subject: string;
    let body: string;

    // Handle invoice receipt emails
    if (invoiceId && emailType === 'invoice_receipt') {
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invoiceError || !invoice) {
        throw new Error(`Invoice not found: ${invoiceError?.message}`);
      }

      if (!invoice.client_email) {
        throw new Error("No email address for this invoice");
      }

      recipientEmail = invoice.client_email;
      recipientName = invoice.client_name;

      const { data: template, error: templateError } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_key", "invoice_receipt")
        .eq("is_active", true)
        .single();

      if (templateError || !template) {
        throw new Error(`Email template not found: ${templateError?.message}`);
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
          style: 'currency',
          currency: 'KES',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount);
      };

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      };

      const variables: Record<string, string> = {
        client_name: invoice.client_name,
        invoice_reference: invoice.invoice_reference,
        total_amount: formatCurrency(invoice.total_amount),
        payment_date: formatDate(invoice.payment_date || invoice.updated_at),
        payment_method: invoice.payment_method || 'N/A',
      };

      subject = template.subject;
      body = template.body;

      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
      });
    }
    // Handle booking emails
    else if (bookingId) {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select(`
          *,
          vehicle:vehicles(
            reg_number,
            branch:branches(branch_name)
          )
        `)
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error(`Booking not found: ${bookingError?.message}`);
      }

      if (!booking.client_email) {
        throw new Error("No email address for this booking");
      }

      recipientEmail = booking.client_email;
      recipientName = booking.client_name;

      const templateKey = emailType === 'confirmation' ? 'booking_confirmation' 
        : emailType === 'pickup_reminder' ? 'pickup_reminder'
        : 'dropoff_reminder';

      const { data: template, error: templateError } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_key", templateKey)
        .eq("is_active", true)
        .single();

      if (templateError || !template) {
        throw new Error(`Email template not found: ${templateError?.message}`);
      }

      const startDate = new Date(booking.start_datetime);
      const endDate = new Date(booking.end_datetime);
      const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));

      const variables: Record<string, string> = {
        client_name: booking.client_name,
        vehicle_reg: booking.vehicle.reg_number,
        start_date: startDate.toLocaleDateString(),
        start_time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        end_date: endDate.toLocaleDateString(),
        end_time: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        start_location: booking.start_location,
        end_location: booking.end_location,
        duration: `${duration}h`,
        contact_number: booking.contact || 'N/A',
      };

      subject = template.subject;
      body = template.body;

      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
      });
    } else {
      throw new Error("Invalid email type for the provided ID");
    }

    // Build the email message in RFC 2822 format
    const fromEmail = "rentacarinkenya@gmail.com";
    const fromHeader = `Rentacarinkenya Team <${fromEmail}>`;
    const emailMessage = buildEmailMessage(fromHeader, recipientEmail, subject, body);
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
      const errorData = await gmailResponse.text();
      throw new Error(`Gmail API error: ${errorData}`);
    }

    const gmailData = await gmailResponse.json();

    if (invoiceId) {
      await supabase
        .from("email_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: 1,
        })
        .eq("invoice_id", invoiceId)
        .eq("email_type", emailType)
        .eq("status", "pending");
    } else if (bookingId) {
      await supabase
        .from("email_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: 1,
        })
        .eq("booking_id", bookingId)
        .eq("email_type", emailType)
        .eq("status", "pending");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        emailId: gmailData.id,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);

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