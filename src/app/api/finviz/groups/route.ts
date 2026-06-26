/* ═══════════════════════════════════════════════════════════
   Finviz Data API — Sector/Group Overview
   GET /api/finviz/groups?group=sector&view=overview
   group: sector, industry, country, basic_materials, etc.
   view: overview, performance, valuation
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const FV_HOST = process.env.FINVIZ_API_HOST || "finviz-data-api.p.rapidapi.com";
const FV_KEY = process.env.FINVIZ_API_KEY || "";

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const group = searchParams.get("group") || "sector";
    const view = searchParams.get("view") || "overview";

    const cacheKey = `fv_groups_${group}_${view}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    const r = await fetch(`https://${FV_HOST}/groups?group=${encodeURIComponent(group)}&view=${encodeURIComponent(view)}`, {
      headers: { "Content-Type": "application/json", "x-rapidapi-host": FV_HOST, "x-rapidapi-key": FV_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Finviz Groups ${r.status}`);
    const data = await r.json();
    const result = { source: "Finviz", group, view, timestamp: new Date().toISOString(), data };
    cache.set(cacheKey, { data: result, ts: Date.now() });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message, source: "Finviz" }, { status: 502 });
  }
}