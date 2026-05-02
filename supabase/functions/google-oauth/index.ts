import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type OAuthAction = "exchange" | "refresh-calendar";
type ConnectionType = "calendar" | "gmail";

async function getAuthedUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Response(JSON.stringify({ success: false, error: "Missing authorization token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    throw new Response(JSON.stringify({ success: false, error: "Invalid authorization token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const role = authData.user.app_metadata?.role || authData.user.user_metadata?.role;
  if (!["admin", "user"].includes(String(role))) {
    throw new Response(JSON.stringify({ success: false, error: "Insufficient permissions" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { supabase, user: authData.user };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const { supabase } = await getAuthedUser(req, supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body.action as OAuthAction;

    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      throw new Error(settingsError?.message || "Company settings not found");
    }

    const clientId = settings.google_client_id || Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = settings.google_client_secret || Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = settings.google_redirect_uri || "https://rent-a-car-in-kenya-g64w.bolt.host/oauth/callback.html";

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials are not configured");
    }

    if (action === "exchange") {
      const code = String(body.code || "");
      const connectionType = (body.connectionType || "calendar") as ConnectionType;
      if (!code) throw new Error("Missing authorization code");

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json().catch(() => ({}));
        throw new Error(error.error_description || "Failed to exchange code for tokens");
      }

      const tokens = await tokenResponse.json();
      const updates: Record<string, unknown> = {};

      if (connectionType === "gmail") {
        if (tokens.refresh_token) {
          updates.gmail_refresh_token = tokens.refresh_token;
        }
      } else {
        updates.google_access_token = tokens.access_token;
        if (tokens.refresh_token) {
          updates.google_refresh_token = tokens.refresh_token;
        }
        updates.google_token_expiry = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
        updates.google_sync_enabled = true;
      }

      const { error: updateError } = await supabase
        .from("company_settings")
        .update(updates)
        .eq("id", settings.id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          access_token: tokens.access_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          scope: tokens.scope,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refresh-calendar") {
      const refreshToken = settings.google_refresh_token || Deno.env.get("GOOGLE_REFRESH_TOKEN");
      if (!refreshToken) throw new Error("Google Calendar is not connected");

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json().catch(() => ({}));
        throw new Error(error.error_description || "Failed to refresh access token");
      }

      const tokens = await tokenResponse.json();
      const { error: updateError } = await supabase
        .from("company_settings")
        .update({
          google_access_token: tokens.access_token,
          google_token_expiry: new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString(),
        })
        .eq("id", settings.id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, ...tokens }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unsupported OAuth action");
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("google-oauth error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
