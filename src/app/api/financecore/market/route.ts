/* ═══════════════════════════════════════════════════════════
   FinanceCore API — Market Overview
   GET /api/financecore/market
   ═══════════════════════════════════════════════════════════ */

import { NextResponse } from "next/server";

const FC_HOST = process.env.FINANCECORE_API_HOST || "financecore-api.p.rapidapi.com";
const FC_KEY = process.env.FINANCECORE_API_KEY || "";

let cachedMarket: { data: any; ts: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 min

export async function GET() {
  try {
    if (cachedMarket && Date.now() - cachedMarket.ts < CACHE_TTL) {
      return NextResponse.json({ ...cachedMarket.data, cached: true });
    }

    const url = `https://${FC_HOST}/api/market/overview?api_key=${FC_KEY}`;
    const r = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": FC_HOST,
        "x-rapidapi-key": FC_KEY,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) throw new Error(`FinanceCore Market ${r.status}`);
    const data = await r.json();

    const result = { source: "FinanceCore", timestamp: new Date().toISOString(), ...data };
    cachedMarket = { data: result, ts: Date.now() };

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message, source: "FinanceCore" }, { status: 502 });
  }
}