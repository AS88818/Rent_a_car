import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const KENYA_OFFSET_MS = 3 * 60 * 60 * 1000;

type SupabaseClient = ReturnType<typeof createClient>;

interface RequestBody {
  action?: "queue" | "preview" | "test";
}

interface AuthContext {
  isServiceRole: boolean;
  user: { id: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } | null;
  role: string | null;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function eatDate(offsetDays = 0) {
  const eat = new Date(Date.now() + KENYA_OFFSET_MS + offsetDays * 86400000);
  return `${eat.getUTCFullYear()}-${pad(eat.getUTCMonth() + 1)}-${pad(eat.getUTCDate())}`;
}

function eatDayUtcRange(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - KENYA_OFFSET_MS);
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function naiveRange(dateString: string) {
  return {
    start: `${dateString}T00:00:00+00:00`,
    end: `${dateString}T23:59:59.999+00:00`,
  };
}

function nowNaiveIso() {
  return new Date(Date.now() + KENYA_OFFSET_MS).toISOString();
}

function formatCurrency(amount: number) {
  return `KES ${Math.round(amount || 0).toLocaleString("en-KE")}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";
  const cleaned = String(value).replace(/(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)$/, "").replace(" ", "T");
  const date = new Date(cleaned);
  return `${date.toLocaleDateString("en-KE", { month: "short", day: "numeric" })} ${date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}`;
}

function daysUntil(dateString?: string | null) {
  if (!dateString) return null;
  const today = new Date(eatDate());
  const target = new Date(dateString);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function getQuoteValue(quote: any) {
  const data = quote?.quote_data || {};
  return Object.values(data).reduce((max: number, option: any) => {
    const value = Number(option?.grandTotal || option?.total || 0);
    return Math.max(max, Number.isFinite(value) ? value : 0);
  }, 0);
}

function table(headers: string[], rows: string[][]) {
  if (rows.length === 0) return `<p class="muted">None</p>`;
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function unavailable(label: string) {
  return `<p class="muted">${label}: not available until landing page/customer CRM is live.</p>`;
}

async function getAuthContext(req: Request, supabase: SupabaseClient): Promise<AuthContext> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { isServiceRole: false, user: null, role: null };
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return { isServiceRole: true, user: null, role: "service_role" };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { isServiceRole: false, user: null, role: null };

  return {
    isServiceRole: false,
    user: data.user,
    role: String(data.user.app_metadata?.role || data.user.user_metadata?.role || ""),
  };
}

async function requireAdminForInteractive(action: string, auth: AuthContext) {
  if (action === "queue" && auth.isServiceRole) return;
  if (auth.role !== "admin") {
    throw new Response(JSON.stringify({ success: false, error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function buildDailyReport(supabase: SupabaseClient) {
  const today = eatDate();
  const yesterday = eatDate(-1);
  const todayNaive = naiveRange(today);
  const yesterdayCreated = eatDayUtcRange(yesterday);
  const now = nowNaiveIso();

  const [
    pickupsRes,
    returnsRes,
    activeRes,
    overdueRes,
    yesterdayBookingsRes,
    quotesRes,
    invoicesRes,
    vehiclesRes,
  ] = await Promise.all([
    supabase.from("bookings").select("*, vehicle:vehicles(reg_number, branch:branches(branch_name))").gte("start_datetime", todayNaive.start).lte("start_datetime", todayNaive.end).not("status", "in", '("Cancelled","Draft")').order("start_datetime"),
    supabase.from("bookings").select("*, vehicle:vehicles(reg_number, branch:branches(branch_name))").gte("end_datetime", todayNaive.start).lte("end_datetime", todayNaive.end).not("status", "in", '("Cancelled","Draft")').order("end_datetime"),
    supabase.from("bookings").select("id").eq("status", "Active").lte("start_datetime", now).gte("end_datetime", now),
    supabase.from("bookings").select("*, vehicle:vehicles(reg_number, branch:branches(branch_name))").eq("status", "Active").lt("end_datetime", now).order("end_datetime"),
    supabase.from("bookings").select("id, booking_reference, client_name, created_at").gte("created_at", yesterdayCreated.start).lt("created_at", yesterdayCreated.end),
    supabase.from("quotes").select("id, quote_reference, client_name, quote_data, status, created_at").gte("created_at", yesterdayCreated.start).lt("created_at", yesterdayCreated.end),
    supabase.from("invoices").select("id, invoice_reference, total_amount, amount_paid, payment_status, payment_method, payment_date").eq("payment_date", yesterday),
    supabase.from("vehicles").select("id, reg_number, status, health_flag, current_mileage, next_service_mileage, mot_expiry, mot_not_applicable, insurance_expiry").is("deleted_at", null),
  ]);

  for (const result of [pickupsRes, returnsRes, activeRes, overdueRes, yesterdayBookingsRes, quotesRes, invoicesRes, vehiclesRes]) {
    if (result.error) throw result.error;
  }

  const pickups = pickupsRes.data || [];
  const returns = returnsRes.data || [];
  const activeCount = activeRes.data?.length || 0;
  const overdueReturns = overdueRes.data || [];
  const yesterdayBookings = yesterdayBookingsRes.data || [];
  const quotes = quotesRes.data || [];
  const invoices = invoicesRes.data || [];
  const vehicles = vehiclesRes.data || [];

  const quoteValue = quotes.reduce((sum: number, quote: any) => sum + getQuoteValue(quote), 0);
  const paymentTotals = invoices.reduce((acc: Record<string, number>, invoice: any) => {
    const method = invoice.payment_method || "Unknown";
    const amount = Number(invoice.amount_paid || (invoice.payment_status === "Paid" ? invoice.total_amount : 0) || 0);
    acc[method] = (acc[method] || 0) + amount;
    return acc;
  }, {});
  const paymentTotal = Object.values(paymentTotals).reduce((sum, value) => sum + value, 0);

  const serviceVehicles = vehicles.filter((vehicle: any) =>
    vehicle.next_service_mileage && vehicle.current_mileage != null &&
    Number(vehicle.next_service_mileage) - Number(vehicle.current_mileage) <= 1000
  );
  const expiringVehicles = vehicles.filter((vehicle: any) => {
    const motDays = vehicle.mot_not_applicable ? null : daysUntil(vehicle.mot_expiry);
    const insuranceDays = daysUntil(vehicle.insurance_expiry);
    return (motDays !== null && motDays <= 30) || (insuranceDays !== null && insuranceDays <= 30);
  });
  const groundedVehicles = vehicles.filter((vehicle: any) => vehicle.status === "Grounded" || vehicle.health_flag === "Grounded");

  const subject = `Daily Ops Digest - ${today}`;
  const generatedAt = new Date().toISOString();
  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111827; line-height: 1.45; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 16px; margin-top: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { text-align: left; border-bottom: 1px solid #e5e7eb; padding: 8px; font-size: 13px; vertical-align: top; }
    th { background: #f9fafb; color: #374151; }
    .muted { color: #6b7280; }
    .danger { color: #b91c1c; font-weight: 700; }
    .metric { display: inline-block; margin: 6px 12px 6px 0; padding: 8px 10px; background: #f3f4f6; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Daily Ops Digest</h1>
  <p class="muted">Generated ${formatDateTime(generatedAt)} EAT</p>

  <h2>Today</h2>
  <div class="metric">Pickups: <strong>${pickups.length}</strong></div>
  <div class="metric">Returns: <strong>${returns.length}</strong></div>
  <div class="metric">Active rentals: <strong>${activeCount}</strong></div>
  <h3>Pickups scheduled today</h3>
  ${table(["Customer", "Vehicle", "Branch", "Time"], pickups.map((b: any) => [
    b.client_name || "N/A",
    b.vehicle?.reg_number || "N/A",
    b.vehicle?.branch?.branch_name || b.start_location || "N/A",
    formatDateTime(b.start_datetime),
  ]))}
  <h3>Returns scheduled today</h3>
  ${table(["Customer", "Vehicle", "Branch", "Time", "Mileage Out"], returns.map((b: any) => [
    b.client_name || "N/A",
    b.vehicle?.reg_number || "N/A",
    b.vehicle?.branch?.branch_name || b.end_location || "N/A",
    formatDateTime(b.end_datetime),
    b.handover_mileage != null ? `${Number(b.handover_mileage).toLocaleString("en-KE")} km` : "Not recorded",
  ]))}

  <h2>Yesterday</h2>
  <div class="metric">New staff-created bookings: <strong>${yesterdayBookings.length}</strong></div>
  <div class="metric">Quotes sent: <strong>${quotes.length}</strong> (${formatCurrency(quoteValue)})</div>
  <div class="metric">Payments received: <strong>${formatCurrency(paymentTotal)}</strong></div>
  ${table(["Payment Method", "Amount"], Object.entries(paymentTotals).map(([method, amount]) => [method, formatCurrency(amount as number)]))}

  <h2>Needs Attention</h2>
  ${unavailable("Booking requests awaiting triage")}
  ${unavailable("Approved requests awaiting deposit")}
  <p class="${overdueReturns.length > 0 ? "danger" : "muted"}">Returns overdue: ${overdueReturns.length}</p>
  ${table(["Customer", "Vehicle", "Due"], overdueReturns.map((b: any) => [
    b.client_name || "N/A",
    b.vehicle?.reg_number || "N/A",
    formatDateTime(b.end_datetime),
  ]))}

  <h2>Fleet Health</h2>
  <p>Service due/overdue within threshold: <strong>${serviceVehicles.length}</strong></p>
  ${table(["Vehicle", "Current KM", "Service Due At"], serviceVehicles.map((v: any) => [
    v.reg_number,
    Number(v.current_mileage || 0).toLocaleString("en-KE"),
    Number(v.next_service_mileage || 0).toLocaleString("en-KE"),
  ]))}
  <p>Insurance / MOT expiring within 30 days: <strong>${expiringVehicles.length}</strong></p>
  ${table(["Vehicle", "MOT", "Insurance"], expiringVehicles.map((v: any) => [
    v.reg_number,
    v.mot_not_applicable ? "N/A" : `${v.mot_expiry || "N/A"} (${daysUntil(v.mot_expiry) ?? "?"}d)`,
    `${v.insurance_expiry || "N/A"} (${daysUntil(v.insurance_expiry) ?? "?"}d)`,
  ]))}
  <p>Vehicles grounded: <strong>${groundedVehicles.length}</strong></p>
  ${table(["Vehicle", "Status", "Health"], groundedVehicles.map((v: any) => [v.reg_number, v.status, v.health_flag]))}
</body>
</html>`;

  return {
    subject,
    html,
    generatedAt,
    metrics: {
      pickups: pickups.length,
      returns: returns.length,
      activeRentals: activeCount,
      overdueReturns: overdueReturns.length,
      quotesSent: quotes.length,
      quoteValue,
      paymentTotal,
      serviceVehicles: serviceVehicles.length,
      expiringVehicles: expiringVehicles.length,
      groundedVehicles: groundedVehicles.length,
    },
  };
}

async function getSubscribers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("report_subscriptions")
    .select("user:users(id, email, full_name, role, status, deleted_at)")
    .eq("report_type", "daily_ops_digest")
    .eq("enabled", true);

  if (error) throw error;

  return (data || [])
    .map((row: any) => row.user)
    .filter((user: any) => user && user.role === "admin" && user.status !== "inactive" && !user.deleted_at && user.email);
}

async function queueReportEmail(supabase: SupabaseClient, user: any, report: Awaited<ReturnType<typeof buildDailyReport>>, force = false) {
  if (!force) {
    const todayRange = eatDayUtcRange(eatDate());
    const { data: existing } = await supabase
      .from("email_queue")
      .select("id")
      .eq("context_type", "report")
      .eq("email_type", "daily_ops_digest")
      .eq("recipient_email", user.email)
      .gte("created_at", todayRange.start)
      .lt("created_at", todayRange.end)
      .maybeSingle();

    if (existing) return false;
  }

  const { error } = await supabase.from("email_queue").insert({
    context_type: "report",
    email_type: "daily_ops_digest",
    recipient_email: user.email,
    recipient_name: user.full_name || user.email,
    subject: report.subject,
    body: report.html,
    status: "pending",
    scheduled_for: new Date().toISOString(),
    attempts: 0,
  });

  if (error) throw error;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const auth = await getAuthContext(req, supabase);
    const body = (req.method === "POST" ? await req.json().catch(() => ({})) : {}) as RequestBody;
    const action = body.action || "queue";

    await requireAdminForInteractive(action, auth);
    const report = await buildDailyReport(supabase);

    if (action === "preview") {
      return new Response(JSON.stringify({ success: true, report }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test") {
      if (!auth.user?.email) throw new Error("Current user has no email address");
      const queued = await queueReportEmail(supabase, {
        email: auth.user.email,
        full_name: auth.user.user_metadata?.full_name || auth.user.email,
      }, report, true);
      return new Response(JSON.stringify({ success: true, queued: queued ? 1 : 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscribers = await getSubscribers(supabase);
    let queued = 0;
    for (const user of subscribers) {
      if (await queueReportEmail(supabase, user, report)) queued++;
    }

    return new Response(JSON.stringify({ success: true, queued, subscribers: subscribers.length, metrics: report.metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("daily-ops-digest error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
