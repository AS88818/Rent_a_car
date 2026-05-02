import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getAdminClient(req: Request, supabaseUrl: string, serviceKey: string) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Response(JSON.stringify({ success: false, error: "Missing authorization token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
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

  return { supabase, user: data.user };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase environment variables are not configured");

    const { supabase, user } = await getAdminClient(req, supabaseUrl, serviceKey);
    const { data: settings, error } = await supabase
      .from("company_settings")
      .select("id, google_client_id, google_client_secret, google_redirect_uri, gmail_refresh_token")
      .limit(1)
      .maybeSingle();

    if (error || !settings) throw new Error(error?.message || "Company settings not found");

    if (req.method === "GET") {
      return new Response(
        JSON.stringify({
          success: true,
          google_client_id: settings.google_client_id || "",
          google_redirect_uri: settings.google_redirect_uri || "",
          has_google_client_secret: Boolean(settings.google_client_secret),
          has_gmail_refresh_token: Boolean(settings.gmail_refresh_token),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const updates: Record<string, unknown> = {
        google_client_id: body.google_client_id || null,
        google_redirect_uri: body.google_redirect_uri || null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      if (typeof body.google_client_secret === "string" && body.google_client_secret.trim()) {
        updates.google_client_secret = body.google_client_secret.trim();
      }

      if (body.clear_gmail_refresh_token === true) {
        updates.gmail_refresh_token = null;
      }

      if (body.clear_google_oauth === true) {
        updates.google_access_token = null;
        updates.google_refresh_token = null;
        updates.google_token_expiry = null;
        updates.google_sync_enabled = false;
      }

      const { error: updateError } = await supabase
        .from("company_settings")
        .update(updates)
        .eq("id", settings.id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("company-settings-secrets error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
