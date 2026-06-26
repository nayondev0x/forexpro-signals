/* ═══════════════════════════════════════════════════════════
   Finviz Data API — Ticker Autocomplete
   GET /api/finviz/autocomplete?query=AAPL
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const FV_HOST = process.env.FINVIZ_API_HOST || "finviz-data-api.p.rapidapi.com";
const FV_KEY = process.env.FINVIZ_API_KEY || "";

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");
    if (!query) return NextResponse.json({ error: "Provide ?query=AAPL" }, { status: 400 });

    const cacheKey = `fv_auto_${query.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const r = await fetch(`https://${FV_HOST}/autocomplete?query=${encodeURIComponent(query)}`, {
      headers: { "Content-Type": "application/json", "x-rapidapi-host": FV_HOST, "x-rapidapi-key": FV_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`Finviz Autocomplete ${r.status}`);
    const data = await r.json();
    const result = { source: "Finviz", query, data };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message, source: "Finviz" }, { status: 502 });
  }
}