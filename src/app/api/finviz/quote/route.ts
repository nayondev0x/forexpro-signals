/* ═══════════════════════════════════════════════════════════
   Finviz Data API — Stock Quote
   GET /api/finviz/quote?ticker=AAPL
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const FV_HOST = process.env.FINVIZ_API_HOST || "finviz-data-api.p.rapidapi.com";
const FV_KEY = process.env.FINVIZ_API_KEY || "";

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 2 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker");
    if (!ticker) return NextResponse.json({ error: "Provide ?ticker=AAPL" }, { status: 400 });

    const cacheKey = `fv_quote_${ticker}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    const r = await fetch(`https://${FV_HOST}/quote?ticker=${encodeURIComponent(ticker)}`, {
      headers: { "Content-Type": "application/json", "x-rapidapi-host": FV_HOST, "x-rapidapi-key": FV_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Finviz Quote ${r.status}`);
    const data = await r.json();
    const result = { source: "Finviz", ticker, timestamp: new Date().toISOString(), data };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Finviz Quote]", err.message);
    return NextResponse.json({ error: err.message, source: "Finviz" }, { status: 502 });
  }
}