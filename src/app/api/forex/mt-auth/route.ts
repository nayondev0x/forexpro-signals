import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════
   FOREX SIGNALS API — MT Account Authentication & Signals
   Host: forex-signals-api.p.rapidapi.com
   Endpoints:
     - index-auth.php  → MT4/MT5 account auth
     - forex-signals.php → Get trading signals
     - market-trends.php  → Market trends data
   ═══════════════════════════════════════════════════════════ */

const API_KEY = process.env.FOREX_SIGNALS_API_KEY || "";
const API_HOST = process.env.FOREX_SIGNALS_API_HOST || "forex-signals-api.p.rapidapi.com";

// Cache for MT auth tokens
let mtAuthCache: Record<string, { data: any; time: number }> = {};
const MT_AUTH_TTL = 3600000; // 1 hour

// Cache for forex signals from this API
let forexApiSignalCache: { data: any; time: number } | null = null;
const FOREX_API_SIGNAL_TTL = 60000; // 1 min

// Cache for market trends
let marketTrendsCache: { data: any; time: number } | null = null;
const MARKET_TRENDS_TTL = 120000; // 2 min

// Client instance ID for this session
const CLIENT_INSTANCE_ID = crypto.randomUUID();

async function apiCall(endpoint: string, body?: Record<string, any>): Promise<any> {
  if (!API_KEY) return { error: "FOREX_SIGNALS_API_KEY not configured" };
  try {
    const options: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": API_HOST,
        "x-rapidapi-key": API_KEY,
      },
      signal: AbortSignal.timeout(10000),
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`https://${API_HOST}/${endpoint}`, options);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { error: `API ${res.status}: ${errText}` };
    }
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { error: err.message || "Request failed" };
  }
}

/* ─── POST /api/forex/mt-auth ───
   Authenticate with MT4/MT5 account
   Body: { mt_account_number, broker_server }
*/
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { mt_account_number, broker_server, action } = body;

  // If action specified, route to sub-handlers
  if (action === "signals") {
    return handleSignals();
  }
  if (action === "trends") {
    return handleTrends();
  }

  // Default: MT account authentication
  if (!mt_account_number || !broker_server) {
    return NextResponse.json({
      success: false,
      error: "mt_account_number and broker_server are required",
      hint: { mt_account_number: "12345678", broker_server: "Broker-Demo" },
    }, { status: 400 });
  }

  // Check cache
  const cacheKey = `${mt_account_number}-${broker_server}`;
  const cached = mtAuthCache[cacheKey];
  if (cached && Date.now() - cached.time < MT_AUTH_TTL) {
    return NextResponse.json({ success: true, cached: true, ...cached.data });
  }

  const result = await apiCall("index-auth.php", {
    mt_account_number,
    broker_server,
    client_instance_id: CLIENT_INSTANCE_ID,
  });

  if (result.error) {
    return NextResponse.json({ success: false, ...result }, { status: 502 });
  }

  // Cache successful auth
  mtAuthCache[cacheKey] = { data: result, time: Date.now() };

  return NextResponse.json({ success: true, ...result });
}

/* ─── GET /api/forex/mt-auth ───
   Get forex signals or market trends
   Query: ?action=signals | ?action=trends
*/
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "trends") return handleTrends();
  return handleSignals();
}

/* ─── Handler: Get Forex Signals ─── */
async function handleSignals() {
  const cached = forexApiSignalCache;
  if (cached && Date.now() - cached.time < FOREX_API_SIGNAL_TTL) {
    return NextResponse.json({ source: "cached", ...cached.data });
  }

  const result = await apiCall("forex-signals.php", {
    client_instance_id: CLIENT_INSTANCE_ID,
  });

  if (result.error) {
    return NextResponse.json({ source: "forex-signals-api", error: result.error, signals: [] }, { status: 502 });
  }

  forexApiSignalCache = { data: result, time: Date.now() };
  return NextResponse.json({ source: "forex-signals-api", ...result });
}

/* ─── Handler: Get Market Trends ─── */
async function handleTrends() {
  const cached = marketTrendsCache;
  if (cached && Date.now() - cached.time < MARKET_TRENDS_TTL) {
    return NextResponse.json({ source: "cached", ...cached.data });
  }

  const result = await apiCall("market-trends.php", {
    client_instance_id: CLIENT_INSTANCE_ID,
  });

  if (result.error) {
    return NextResponse.json({ source: "forex-signals-api", error: result.error }, { status: 502 });
  }

  marketTrendsCache = { data: result, time: Date.now() };
  return NextResponse.json({ source: "forex-signals-api", ...result });
}