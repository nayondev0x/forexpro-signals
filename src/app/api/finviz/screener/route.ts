/* ═══════════════════════════════════════════════════════════
   Finviz Data API — Stock Screener
   GET /api/finviz/screener?tickers=AAPL,MSFT&signal=ta_topgainers&sort=marketcap&filters=cap_largeover,sec_technology&view=overview
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const FV_HOST = process.env.FINVIZ_API_HOST || "finviz-data-api.p.rapidapi.com";
const FV_KEY = process.env.FINVIZ_API_KEY || "";

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tickers = searchParams.get("tickers") || "";
    const signal = searchParams.get("signal") || "";
    const sort = searchParams.get("sort") || "marketcap";
    const filters = searchParams.get("filters") || "";
    const view = searchParams.get("view") || "overview";
    const offset = searchParams.get("offset") || "1";

    const cacheKey = `fv_screener_${tickers}_${signal}_${sort}_${filters}_${offset}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    const params = new URLSearchParams();
    params.set("offset", offset);
    params.set("view", view);
    if (tickers) params.set("tickers", tickers);
    if (signal) params.set("signal", signal);
    if (sort) params.set("sort", sort);
    if (filters) params.set("filters", filters);

    const r = await fetch(`https://${FV_HOST}/screener?${params.toString()}`, {
      headers: { "Content-Type": "application/json", "x-rapidapi-host": FV_HOST, "x-rapidapi-key": FV_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Finviz Screener ${r.status}`);
    const data = await r.json();
    const result = { source: "Finviz", timestamp: new Date().toISOString(), data };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message, source: "Finviz" }, { status: 502 });
  }
}