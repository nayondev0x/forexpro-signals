/* ═══════════════════════════════════════════════════════════
   Finviz Data API — Crypto Overview
   GET /api/finviz/crypto
   ═══════════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";

const FV_HOST = process.env.FINVIZ_API_HOST || "finviz-data-api.p.rapidapi.com";
const FV_KEY = process.env.FINVIZ_API_KEY || "";

let cached: { data: any; ts: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000;

export async function GET() {
  try {
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    const r = await fetch(`https://${FV_HOST}/crypto`, {
      headers: { "Content-Type": "application/json", "x-rapidapi-host": FV_HOST, "x-rapidapi-key": FV_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error(`Finviz Crypto ${r.status}`);
    const data = await r.json();
    const result = { source: "Finviz", timestamp: new Date().toISOString(), data };
    cached = { data: result, ts: Date.now() };
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Finviz Crypto]", err.message);
    return NextResponse.json({ error: err.message, source: "Finviz" }, { status: 502 });
  }
}