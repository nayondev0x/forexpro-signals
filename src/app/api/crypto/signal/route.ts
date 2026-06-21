/* SelfTrade Crypto Signals API */
import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.SELFTRADE_API_KEY || "";
const HOST = process.env.SELFTRADE_API_HOST || "selftrade.p.rapidapi.com";
const CACHE = new Map<string, { data: any; expires: number }>();

async function selfFetch(path: string, ttlMs = 60_000) {
  const cached = CACHE.get(path);
  if (cached && cached.expires > Date.now()) return cached.data;
  if (!KEY) return null;

  const res = await fetch(`https://${HOST}${path}`, {
    headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": HOST, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`SelfTrade ${res.status}`);
  const data = await res.json();
  CACHE.set(path, { data, expires: Date.now() + ttlMs });
  return data;
}

// GET /api/crypto/signal?pair=BTCUSDT
// GET /api/crypto/signal?action=all (fetch all 21 pairs)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get("pair");
  const action = searchParams.get("action");

  if (action === "all") {
    try {
      const pairsRes = await selfFetch("/rapidapi/pairs", 5 * 60_000);
      const pairs: string[] = pairsRes?.pairs || [];
      // Batch fetch signals 3 at a time
      const signals: any[] = [];
      for (let i = 0; i < pairs.length; i += 3) {
        const batch = pairs.slice(i, i + 3);
        const results = await Promise.allSettled(
          batch.map(p => selfFetch(`/rapidapi/signal?pair=${p}`, 30_000))
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) signals.push(r.value);
        }
        if (i + 3 < pairs.length) await new Promise(r => setTimeout(r, 200));
      }
      return NextResponse.json({ signals, count: signals.length, live: true });
    } catch (e) {
      return NextResponse.json({ signals: [], error: "Failed to fetch signals" }, { status: 500 });
    }
  }

  if (pair) {
    try {
      const data = await selfFetch(`/rapidapi/signal?pair=${pair.toUpperCase()}`, 30_000);
      if (!data) return NextResponse.json({ error: "No data" }, { status: 404 });
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json({ error: "Failed to fetch signal" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Provide ?pair=X or ?action=all" }, { status: 400 });
}