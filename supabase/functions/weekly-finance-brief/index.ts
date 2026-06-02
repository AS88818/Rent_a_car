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

function dateString(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function previousWeekWindow() {
  const eatNow = new Date(Date.now() + KENYA_OFFSET_MS);
  const day = eatNow.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const thisMonday = new Date(Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth(), eatNow.getUTCDate() - daysSinceMonday));
  const start = new Date(thisMonday.getTime() - 7 * 86400000);
  const end = new Date(thisMonday.getTime() - 86400000);
  const previousStart = new Date(start.getTime() - 7 * 86400000);
  const previousEnd = new Date(end.getTime() - 7 * 86400000);
  return {
    startDate: dateString(start),
    endDate: dateString(end),
    previousStartDate: dateString(previousStart),
    previousEndDate: dateString(previousEnd),
    startNaive: `${dateString(start)}T00:00:00+00:00`,
    endNaive: `${dateString(end)}T23:59:59.999+00:00`,
  };
}

function eatDayUtcRange(dateStringValue: string) {
  const [year, month, day] = dateStringValue.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - KENYA_OFFSET_MS);
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatCurrency(amount: number) {
  return `KES ${Math.round(amount || 0).toLocaleString("en-KE")}`;
}

function percentChange(current: number, previous: number) {
  if (!previous && !current) return "0%";
  if (!previous) return "+100%";
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function table(headers: string[], rows: string[][]) {
  if (rows.length === 0) return `<div class="empty-state">No rows to show.</div>`;
  return `
    <table class="data-table">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function unavailable(label: string) {
  return `
    <div class="notice">
      <strong>${label}</strong>
      <span>Not available until landing page/customer CRM is live.</span>
    </div>
  `;
}

function metric(label: string, value: string | number, tone = "default") {
  return `
    <div class="metric metric-${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function section(title: string, content: string) {
  return `
    <section class="section-card">
      <h2>${title}</h2>
      ${content}
    </section>
  `;
}

function reportStyles() {
  return `
  <style>
    html, body { margin: 0; padding: 0; background: #fbfaf7; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .report-bg { background: #fbfaf7; padding: 24px; }
    .report-shell { max-width: 1040px; margin: 0 auto; }
    .brand-row {
      margin: 0 0 14px;
      color: #111827;
      font-size: 13px;
      font-weight: 700;
    }
    .brand-row > div { display: inline-block; vertical-align: middle; }
    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 999px;
      background: #b6ff00;
      border: 1px solid #9be000;
      color: #020617;
      line-height: 38px;
      text-align: center;
      font-weight: 800;
      letter-spacing: 0;
      margin-right: 10px;
    }
    .hero-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
      margin-bottom: 16px;
    }
    .hero-accent { height: 8px; background: #b6ff00; }
    .hero-body { padding: 24px; }
    .eyebrow {
      margin: 0 0 6px;
      color: #64748b;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 { margin: 0; font-size: 30px; line-height: 1.15; letter-spacing: 0; color: #020617; }
    h2 { margin: 0 0 16px; font-size: 18px; line-height: 1.2; color: #020617; }
    h3 { margin: 18px 0 8px; font-size: 15px; line-height: 1.3; color: #111827; }
    p { margin: 0 0 12px; }
    .muted { color: #64748b; }
    .hero-meta { margin-top: 8px; color: #64748b; font-size: 14px; }
    .metric-row { margin: 0 -6px 14px; }
    .metric {
      display: inline-block;
      vertical-align: top;
      min-width: 170px;
      margin: 6px;
      padding: 14px 16px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
    }
    .metric span {
      display: block;
      color: #334155;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .metric strong {
      display: block;
      color: #020617;
      font-size: 24px;
      line-height: 1.1;
      font-weight: 800;
    }
    .metric-lime { background: #b6ff00; border-color: #9be000; }
    .metric-blue strong { color: #0284c7; }
    .metric-green strong { color: #16a34a; }
    .metric-red strong { color: #dc2626; }
    .section-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 14px;
      border: 1px solid #dbe3ef;
      border-radius: 10px;
      overflow: hidden;
      background: #ffffff;
    }
    th, td {
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
      padding: 10px 12px;
      font-size: 13px;
      vertical-align: top;
    }
    th {
      background: #eef6ff;
      color: #1f2937;
      font-weight: 800;
    }
    tr:last-child td { border-bottom: 0; }
    .empty-state {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      color: #64748b;
      padding: 14px;
      margin: 8px 0 14px;
      font-size: 13px;
    }
    .notice {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #b6ff00;
      border-radius: 10px;
      padding: 12px 14px;
      margin: 8px 0;
      color: #475569;
      font-size: 13px;
    }
    .notice strong { display: block; color: #111827; margin-bottom: 2px; }
    .footer {
      color: #64748b;
      font-size: 12px;
      padding: 8px 4px 0;
    }
    @media (max-width: 640px) {
      .report-bg { padding: 12px; }
      .hero-body, .section-card { padding: 16px; }
      h1 { font-size: 24px; }
      .metric { display: block; min-width: 0; }
    }
  </style>
  `;
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

function invoiceAmount(invoice: any) {
  return Number(invoice.total_amount || 0);
}

function collectedAmount(invoice: any) {
  return Number(invoice.amount_paid || (invoice.payment_status === "Paid" ? invoice.total_amount : 0) || 0);
}

function categoryTotals(invoices: any[]) {
  const totals: Record<string, number> = {};
  for (const invoice of invoices) {
    for (const item of invoice.selected_categories || []) {
      const name = item.categoryName || item.category_name || "Unknown";
      totals[name] = (totals[name] || 0) + Number(item.total || item.subtotal || 0);
    }
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function overlapDays(start: string, end: string, windowStart: string, windowEnd: string) {
  const bookingStart = new Date(start).getTime();
  const bookingEnd = new Date(end).getTime();
  const rangeStart = new Date(windowStart).getTime();
  const rangeEnd = new Date(windowEnd).getTime();
  const overlap = Math.max(0, Math.min(bookingEnd, rangeEnd) - Math.max(bookingStart, rangeStart));
  return overlap / 86400000;
}

async function buildWeeklyReport(supabase: SupabaseClient) {
  const window = previousWeekWindow();
  const previousStart = window.previousStartDate;
  const previousEnd = window.previousEndDate;

  const [
    invoicesRes,
    priorInvoicesRes,
    collectedRes,
    quotesRes,
    vehiclesRes,
    bookingsRes,
    openInvoicesRes,
  ] = await Promise.all([
    supabase.from("invoices").select("id, invoice_reference, invoice_date, due_date, total_amount, amount_paid, balance_due, payment_status, payment_method, payment_date, selected_categories").gte("invoice_date", window.startDate).lte("invoice_date", window.endDate),
    supabase.from("invoices").select("id, total_amount").gte("invoice_date", previousStart).lte("invoice_date", previousEnd),
    supabase.from("invoices").select("id, total_amount, amount_paid, payment_status, payment_method, payment_date").gte("payment_date", window.startDate).lte("payment_date", window.endDate),
    supabase.from("quotes").select("id, status, booking_id, created_at, converted_at").gte("created_at", eatDayUtcRange(window.startDate).start).lt("created_at", eatDayUtcRange(window.endDate).end),
    supabase.from("vehicles").select("id, reg_number, category:vehicle_categories(category_name)").is("deleted_at", null),
    supabase.from("bookings").select("id, vehicle_id, status, start_datetime, end_datetime").not("status", "in", '("Cancelled","Draft")').lte("start_datetime", window.endNaive).gte("end_datetime", window.startNaive),
    supabase.from("invoices").select("id, invoice_reference, due_date, total_amount, amount_paid, balance_due, payment_status").neq("payment_status", "Paid"),
  ]);

  for (const result of [invoicesRes, priorInvoicesRes, collectedRes, quotesRes, vehiclesRes, bookingsRes, openInvoicesRes]) {
    if (result.error) throw result.error;
  }

  const invoices = invoicesRes.data || [];
  const priorInvoices = priorInvoicesRes.data || [];
  const collectedInvoices = collectedRes.data || [];
  const quotes = quotesRes.data || [];
  const vehicles = vehiclesRes.data || [];
  const bookings = bookingsRes.data || [];
  const openInvoices = openInvoicesRes.data || [];

  const totalInvoiced = invoices.reduce((sum: number, invoice: any) => sum + invoiceAmount(invoice), 0);
  const priorInvoiced = priorInvoices.reduce((sum: number, invoice: any) => sum + invoiceAmount(invoice), 0);
  const totalCollected = collectedInvoices.reduce((sum: number, invoice: any) => sum + collectedAmount(invoice), 0);
  const collectionBreakdown = collectedInvoices.reduce((acc: Record<string, number>, invoice: any) => {
    const method = invoice.payment_method || "Unknown";
    acc[method] = (acc[method] || 0) + collectedAmount(invoice);
    return acc;
  }, {});

  const topCategory = categoryTotals(invoices)[0];
  const convertedQuotes = quotes.filter((quote: any) => quote.status === "Converted" || quote.booking_id || quote.converted_at);
  const quoteConversion = quotes.length ? `${convertedQuotes.length}/${quotes.length} (${((convertedQuotes.length / quotes.length) * 100).toFixed(1)}%)` : "0/0 (0%)";

  const vehiclesByCategory = vehicles.reduce((acc: Record<string, any[]>, vehicle: any) => {
    const categoryName = vehicle.category?.category_name || "Uncategorized";
    if (!acc[categoryName]) acc[categoryName] = [];
    acc[categoryName].push(vehicle);
    return acc;
  }, {});

  const bookedDaysByCategory: Record<string, number> = {};
  for (const booking of bookings as any[]) {
    const vehicle = vehicles.find((v: any) => v.id === booking.vehicle_id);
    const categoryName = vehicle?.category?.category_name || "Uncategorized";
    bookedDaysByCategory[categoryName] = (bookedDaysByCategory[categoryName] || 0) +
      overlapDays(booking.start_datetime, booking.end_datetime, window.startNaive, window.endNaive);
  }

  const utilizationRows = Object.entries(vehiclesByCategory).map(([category, categoryVehicles]) => {
    const availableDays = categoryVehicles.length * 7;
    const bookedDays = bookedDaysByCategory[category] || 0;
    const utilization = availableDays > 0 ? (bookedDays / availableDays) * 100 : 0;
    return [category, bookedDays.toFixed(1), String(availableDays), `${utilization.toFixed(1)}%`];
  });

  const today = new Date(eatDayUtcRange(new Date(Date.now() + KENYA_OFFSET_MS).toISOString().slice(0, 10)).start);
  const aging = { "0-7d": 0, "8-30d": 0, "31-60d": 0, "60+d": 0 };
  let outstanding = 0;
  for (const invoice of openInvoices as any[]) {
    const amount = Number(invoice.balance_due ?? (invoice.total_amount - (invoice.amount_paid || 0)) ?? 0);
    outstanding += Math.max(0, amount);
    const due = new Date(`${invoice.due_date}T00:00:00Z`);
    const age = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
    if (age <= 7) aging["0-7d"] += amount;
    else if (age <= 30) aging["8-30d"] += amount;
    else if (age <= 60) aging["31-60d"] += amount;
    else aging["60+d"] += amount;
  }

  const subject = `Weekly Finance Brief - ${window.startDate} to ${window.endDate}`;
  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  ${reportStyles()}
</head>
<body>
  <div class="report-bg">
    <div class="report-shell">
      <div class="brand-row">
        <div class="brand-mark">RC</div>
        <div>Rent A Car In Kenya</div>
      </div>

      <header class="hero-card">
        <div class="hero-accent"></div>
        <div class="hero-body">
          <p class="eyebrow">Finance summary</p>
          <h1>Weekly Finance Brief</h1>
          <p class="hero-meta">Prior week: ${window.startDate} to ${window.endDate}</p>
        </div>
      </header>

      ${section("Revenue Last Week", `
        <div class="metric-row">
          ${metric("Total invoiced", formatCurrency(totalInvoiced), "lime")}
          ${metric("Vs prior week", percentChange(totalInvoiced, priorInvoiced), totalInvoiced >= priorInvoiced ? "green" : "red")}
          ${metric("Total collected", formatCurrency(totalCollected), totalCollected > 0 ? "green" : "default")}
          ${metric("Top revenue category", topCategory ? `${topCategory[0]}: ${formatCurrency(topCategory[1])}` : "Not enough data", "blue")}
        </div>
        <h3>Collection breakdown</h3>
        ${table(["Payment Method", "Collected"], Object.entries(collectionBreakdown).map(([method, amount]) => [method, formatCurrency(amount as number)]))}
      `)}

      ${section("Pipeline & Conversion", `
        ${unavailable("Landing page requests received")}
        ${unavailable("Approved to deposit paid to booking conversion")}
        <div class="metric-row">
          ${metric("Quotes sent to bookings", quoteConversion, "blue")}
        </div>
        ${unavailable("Lost reasons summary")}
      `)}

      ${section("Fleet Utilization", `
        ${table(["Category", "Booked Days", "Available Days", "Utilization"], utilizationRows)}
        ${unavailable("Most-requested vehicle units")}
        ${unavailable("Least-requested vehicle units")}
      `)}

      ${section("Customers", `
        ${unavailable("New customers added")}
        ${unavailable("Returning customers")}
        ${unavailable("Total active customers in CRM")}
      `)}

      ${section("Receivables", `
        <div class="metric-row">
          ${metric("Outstanding balance", formatCurrency(outstanding), outstanding > 0 ? "red" : "green")}
          ${metric("Open invoices", openInvoices.length)}
          ${metric("Overdue follow-ups", openInvoices.filter((invoice: any) => invoice.payment_status === "Overdue").length, "red")}
        </div>
        ${table(["Age", "Amount"], Object.entries(aging).map(([bucket, amount]) => [bucket, formatCurrency(amount)]))}
      `)}

      <p class="footer">Queued by the automated Reports section.</p>
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    html,
    generatedAt: new Date().toISOString(),
    metrics: {
      totalInvoiced,
      priorInvoiced,
      totalCollected,
      quotesSent: quotes.length,
      quoteConversions: convertedQuotes.length,
      outstanding,
      openInvoices: openInvoices.length,
    },
  };
}

async function getSubscribers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("report_subscriptions")
    .select("user:users(id, email, full_name, role, status, deleted_at)")
    .eq("report_type", "weekly_finance_brief")
    .eq("enabled", true);

  if (error) throw error;

  return (data || [])
    .map((row: any) => row.user)
    .filter((user: any) => user && user.role === "admin" && user.status !== "inactive" && !user.deleted_at && user.email);
}

async function queueReportEmail(supabase: SupabaseClient, user: any, report: Awaited<ReturnType<typeof buildWeeklyReport>>, force = false) {
  if (!force) {
    const today = new Date(Date.now() + KENYA_OFFSET_MS).toISOString().slice(0, 10);
    const todayRange = eatDayUtcRange(today);
    const { data: existing } = await supabase
      .from("email_queue")
      .select("id")
      .eq("context_type", "report")
      .eq("email_type", "weekly_finance_brief")
      .eq("recipient_email", user.email)
      .gte("created_at", todayRange.start)
      .lt("created_at", todayRange.end)
      .maybeSingle();

    if (existing) return false;
  }

  const { error } = await supabase.from("email_queue").insert({
    context_type: "report",
    email_type: "weekly_finance_brief",
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
    const report = await buildWeeklyReport(supabase);

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
    console.error("weekly-finance-brief error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
