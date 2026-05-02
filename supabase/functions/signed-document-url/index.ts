import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type DocumentKind = "booking" | "vehicle";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) throw new Error("Supabase environment variables are not configured");

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const userSupabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentId, kind }: { documentId: string; kind: DocumentKind } = await req.json();
    if (!documentId || !["booking", "vehicle"].includes(kind)) {
      throw new Error("Missing or invalid document request");
    }

    const table = kind === "booking" ? "booking_documents" : "vehicle_documents";
    const { data: doc, error: docError } = await userSupabase
      .from(table)
      .select("document_url, storage_path")
      .eq("id", documentId)
      .single();

    if (docError || !doc) throw new Error("Document not found");

    const fallbackUrl = doc.document_url as string | null;
    const storagePath = (doc.storage_path as string | null) || extractStoragePath(fallbackUrl, kind);

    if (!storagePath) {
      return new Response(JSON.stringify({ success: true, url: fallbackUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 60 * 5);

    if (signedError) throw signedError;

    return new Response(JSON.stringify({ success: true, url: signedData.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("signed-document-url error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractStoragePath(url: string | null, kind: DocumentKind): string | null {
  if (!url) return null;
  const prefix = kind === "booking" ? "booking-documents/" : "vehicle-documents/";
  const index = url.indexOf(prefix);
  return index >= 0 ? url.slice(index) : null;
}
