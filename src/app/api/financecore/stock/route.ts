/* ═══════════════════════════════════════════════════════════
   FinanceCore API — Stock Data
   GET /api/financecore/stock?symbol=AAPL
   GET /api/financecore/stock?symbols=AAPL,TSLA,NVDA
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const FC_HOST = process.env.FINANCECORE_API_HOST || "financecore-api.p.rapidapi.com";
const FC_KEY = process.env.FINANCECORE_API_KEY || "";

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchStock(symbol: string): Promise<any> {
  const cacheKey = `fc_stock_${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const url = `https://${FC_HOST}/api/stock/${encodeURIComponent(symbol)}?api_key=${FC_KEY}`;
  const r = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": FC_HOST,
      "x-rapidapi-key": FC_KEY,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!r.ok) throw new Error(`FinanceCore Stock ${r.status}`);
  const data = await r.json();
  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const symbols = searchParams.get("symbols");

    if (!symbol && !symbols) {
      return NextResponse.json({ error: "Provide ?symbol=AAPL or ?symbols=AAPL,TSLA" }, { status: 400 });
    }

    if (symbol) {
      const data = await fetchStock(symbol);
      return NextResponse.json({ symbol, source: "FinanceCore", data });
    }

    const symList = (symbols || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 5);
    const results = await Promise.allSettled(symList.map(async (sym) => {
      const data = await fetchStock(sym);
      return { symbol: sym, data };
    }));

    const stocks = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map(r => r.value);

    return NextResponse.json({ source: "FinanceCore", count: stocks.length, stocks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, source: "FinanceCore" }, { status: 502 });
  }
}