import { NextRequest, NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════
   CRYPTOEDGE MARKET SENTIMENT API
   - Crowding Score (contrarian reversal detector)
   - Sentiment Signals (buy/sell based on crowd positioning)
   - Alerts (anomaly detection, extreme sentiment)
   - Market Context (macro backdrop for each coin)
   - Market Overview (all coins summary)
   ═══════════════════════════════════════════════════════════ */

const KEY = process.env.CRYPTOEDGE_API_KEY || "";
const HOST = process.env.CRYPTOEDGE_API_HOST || "cryptoedge-market-sentiment-indicators.p.rapidapi.com";

const CACHE = new Map<string, { data: any; expires: number }>();

async function ceFetch(path: string, ttlMs = 60_000) {
  const cached = CACHE.get(path);
  if (cached && cached.expires > Date.now()) return cached.data;
  if (!KEY) return null;

  try {
    const res = await fetch(`https://${HOST}${path}`, {
      headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": HOST, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    CACHE.set(path, { data, expires: Date.now() + ttlMs });
    return data;
  } catch {
    return null;
  }
}

/* ─── Crowding Score Analysis ─── */
function analyzeCrowding(crowdData: any) {
  if (!crowdData) return null;

  // Extract crowding score — different possible response shapes
  const score = typeof crowdData.crowding_score === "number" ? crowdData.crowding_score
    : typeof crowdData.score === "number" ? crowdData.score
    : typeof crowdData.value === "number" ? crowdData.value
    : typeof crowdData.crowdingScore === "number" ? crowdData.crowdingScore
    : null;

  const direction = crowdData.direction || crowdData.side || crowdData.bias || "neutral";
  const percentile = typeof crowdData.percentile === "number" ? crowdData.percentile
    : typeof crowdData.positioning_percentile === "number" ? crowdData.positioning_percentile : null;

  if (score === null) return null;

  // Crowding logic: HIGH crowding = contrarian signal (reversal likely)
  // LOW crowding = no extreme positioning (no contrarian signal)
  const isExtreme = score >= 70;
  const isHigh = score >= 50;

  return {
    score: +score.toFixed(2),
    direction: typeof direction === "string" ? direction.toLowerCase() : "neutral",
    percentile: percentile !== null ? +percentile.toFixed(2) : null,
    level: isExtreme ? "EXTREME" : isHigh ? "HIGH" : score >= 30 ? "MODERATE" : "LOW",
    // Contrarian signal: when crowd is extremely long, look to short (and vice versa)
    contrarianSignal: isExtreme
      ? (direction.toString().toLowerCase().includes("long") || direction.toString().toLowerCase().includes("buy")
          ? "CONTRARIAN_SELL" : "CONTRARIAN_BUY")
      : "NONE",
    warning: isExtreme ? `Extreme crowding detected! Crowd is ${direction}. Reversal risk HIGH.`
      : isHigh ? `High crowding (${direction}). Monitor for reversal.` : null,
  };
}

/* ─── Signals Analysis ─── */
function analyzeSignals(signalData: any) {
  if (!signalData) return null;

  // Could be an array or single object
  const signals = Array.isArray(signalData) ? signalData : [signalData];
  if (signals.length === 0) return null;

  const latest = signals[0];
  return {
    signal: typeof latest.signal === "string" ? latest.signal
      : typeof latest.action === "string" ? latest.action
      : typeof latest.type === "string" ? latest.type : "UNKNOWN",
    confidence: typeof latest.confidence === "number" ? latest.confidence
      : typeof latest.score === "number" ? latest.score
      : typeof latest.strength === "number" ? latest.strength : null,
    reasoning: latest.reasoning || latest.reason || latest.message || latest.description || "",
    timeframe: latest.timeframe || latest.period || "24h",
    rawSignals: signals.slice(0, 5),
  };
}

/* ─── Alerts Analysis ─── */
function analyzeAlerts(alertData: any) {
  if (!alertData) return null;

  const alerts = Array.isArray(alertData) ? alertData
    : alertData.alerts ? alertData.alerts
    : alertData.data ? (Array.isArray(alertData.data) ? alertData.data : [alertData.data])
    : [alertData];

  return alerts.slice(0, 10).map((a: any) => ({
    type: a.type || a.alert_type || a.category || "INFO",
    message: a.message || a.description || a.text || a.title || "",
    severity: a.severity || a.level || a.priority || "medium",
    timestamp: a.timestamp || a.created_at || a.time || null,
    symbol: a.symbol || a.coin || a.asset || "",
  }));
}

/* ─── Context Analysis ─── */
function analyzeContext(contextData: any) {
  if (!contextData) return null;

  const ctx = typeof contextData === "object" && !Array.isArray(contextData) ? contextData
    : Array.isArray(contextData) ? contextData[0] : null;

  if (!ctx) return null;

  return {
    sentiment: ctx.sentiment || ctx.market_sentiment || ctx.outlook || "neutral",
    trend: ctx.trend || ctx.market_trend || ctx.direction || "neutral",
    volatility: ctx.volatility || ctx.vol_level || "moderate",
    riskLevel: ctx.risk_level || ctx.risk || "medium",
    summary: ctx.summary || ctx.description || ctx.insight || "",
    factors: ctx.factors || ctx.drivers || ctx.key_points || [],
  };
}

/* ─── GET Handler ─── */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "BTC").toUpperCase();
  const action = searchParams.get("action");
  const hours = searchParams.get("hours") || "24";

  // ─── ALL: Everything for a symbol ───
  if (action === "all" || !action) {
    const [indicatorsRes, crowdingRes, signalsRes, alertsRes, contextRes] = await Promise.allSettled([
      ceFetch(`/v1/indicators/${symbol}`, 60_000),
      ceFetch(`/v1/indicators/${symbol}/crowding_score?hours=${hours}`, 60_000),
      ceFetch(`/v1/signals/${symbol}`, 30_000),
      ceFetch(`/v1/alerts/${symbol}`, 30_000),
      ceFetch(`/v1/context/${symbol}`, 60_000),
    ]);

    const indicators = indicatorsRes.status === "fulfilled" ? indicatorsRes.value : null;
    const crowding = analyzeCrowding(crowdingRes.status === "fulfilled" ? crowdingRes.value : null);
    const signals = analyzeSignals(signalsRes.status === "fulfilled" ? signalsRes.value : null);
    const alerts = analyzeAlerts(alertsRes.status === "fulfilled" ? alertsRes.value : null);
    const context = analyzeContext(contextRes.status === "fulfilled" ? contextRes.value : null);

    return NextResponse.json({
      symbol,
      timestamp: new Date().toISOString(),
      indicators,
      crowding,
      signals,
      alerts,
      context,
      source: "CryptoEdge Sentiment",
    });
  }

  // ─── INDICATORS ───
  if (action === "indicators") {
    const data = await ceFetch(`/v1/indicators/${symbol}`, 60_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch indicators" }, { status: 500 });
    return NextResponse.json({ symbol, data });
  }

  // ─── CROWDING SCORE ───
  if (action === "crowding") {
    const data = await ceFetch(`/v1/indicators/${symbol}/crowding_score?hours=${hours}`, 60_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch crowding score" }, { status: 500 });
    return NextResponse.json({ symbol, hours: +hours, ...analyzeCrowding(data) });
  }

  // ─── SIGNALS ───
  if (action === "signals") {
    const data = await ceFetch(`/v1/signals/${symbol}`, 30_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch signals" }, { status: 500 });
    return NextResponse.json({ symbol, ...analyzeSignals(data) });
  }

  // ─── ALERTS ───
  if (action === "alerts") {
    const data = await ceFetch(`/v1/alerts/${symbol}`, 30_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    return NextResponse.json({ symbol, alerts: analyzeAlerts(data) });
  }

  // ─── CONTEXT ───
  if (action === "context") {
    const data = await ceFetch(`/v1/context/${symbol}`, 60_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch context" }, { status: 500 });
    return NextResponse.json({ symbol, ...analyzeContext(data) });
  }

  // ─── OVERVIEW ───
  if (action === "overview") {
    const data = await ceFetch("/v1/overview", 60_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch overview" }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ─── HEALTH ───
  if (action === "health") {
    const data = await ceFetch("/v1/health", 10_000);
    return NextResponse.json({ health: data });
  }

  return NextResponse.json({
    error: "Unknown action. Use: all, indicators, crowding, signals, alerts, context, overview, health",
  }, { status: 400 });
}
