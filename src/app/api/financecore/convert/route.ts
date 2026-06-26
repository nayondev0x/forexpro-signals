/* ═══════════════════════════════════════════════════════════
   FinanceCore API — Currency Converter
   GET /api/financecore/convert?from=USD&to=EUR&amount=1000
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const FC_HOST = process.env.FINANCECORE_API_HOST || "financecore-api.p.rapidapi.com";
const FC_KEY = process.env.FINANCECORE_API_KEY || "";

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60 * 1000; // 1 min cache for conversion rates

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const amount = parseFloat(searchParams.get("amount") || "1");

    if (!from || !to) {
      return NextResponse.json({ error: "Provide ?from=USD&to=EUR&amount=1000" }, { status: 400 });
    }

    const cacheKey = `fc_convert_${from}_${to}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({
        ...cached.data,
        amount,
        converted: amount * (cached.data.rate || 0),
        source: "FinanceCore (cached)",
      });
    }

    const url = `https://${FC_HOST}/api/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=1&api_key=${FC_KEY}`;
    const r = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": FC_HOST,
        "x-rapidapi-key": FC_KEY,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) throw new Error(`FinanceCore Convert ${r.status}`);
    const data = await r.json();
    const rate = data?.rate || data?.result || data?.converted_amount || 0;

    const result = { from, to, rate, source: "FinanceCore" };
    cache.set(cacheKey, { data: result, ts: Date.now() });

    return NextResponse.json({
      ...result,
      amount,
      converted: amount * rate,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, source: "FinanceCore" }, { status: 502 });
  }
}