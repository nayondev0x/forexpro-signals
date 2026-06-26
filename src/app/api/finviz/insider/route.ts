/* ═══════════════════════════════════════════════════════════
   Finviz Data API — Insider Trading
   GET /api/finviz/insider?page=1&type=1
   type: 1=All, 2=Buy, 3=Sale, 4=Option Exercise
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const FV_HOST = process.env.FINVIZ_API_HOST || "finviz-data-api.p.rapidapi.com";
const FV_KEY = process.env.FINVIZ_API_KEY || "";

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") || "1";
    const type = searchParams.get("type") || "1";

    const cacheKey = `fv_insider_p${page}_t${type}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    const r = await fetch(`https://${FV_HOST}/insider?page=${page}&type=${type}`, {
      headers: { "Content-Type": "application/json", "x-rapidapi-host": FV_HOST, "x-rapidapi-key": FV_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Finviz Insider ${r.status}`);
    const data = await r.json();
    const result = { source: "Finviz", page, type, timestamp: new Date().toISOString(), data };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Finviz Insider]", err.message);
    return NextResponse.json({ error: err.message, source: "Finviz" }, { status: 502 });
  }
}