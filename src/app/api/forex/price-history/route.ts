import { NextRequest, NextResponse } from "next/server";
import { getAVFxIntraday } from "@/lib/rapidapi";

const CACHE: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pair = searchParams.get("pair") || "EUR/USD";
    const interval = searchParams.get("interval") || "5min";
    const outputsize = searchParams.get("outputsize") || "100";

    const cacheKey = `${pair}_${interval}`;
    if (CACHE[cacheKey] && Date.now() - CACHE[cacheKey].ts < CACHE_TTL) {
      return NextResponse.json(CACHE[cacheKey].data);
    }

    const [from, to] = pair.split("/");
    if (!from || !to) {
      return NextResponse.json({ error: "Invalid pair format" }, { status: 400 });
    }

    // Try Alpha Vantage FX_INTRADAY for historical data
    const timeSeries = await getAVFxIntraday(from, to);

    if (timeSeries) {
      // AV returns data in descending time order, reverse it
      const entries = Object.entries(timeSeries)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, vals]: [string, any]) => ({
          time,
          open: parseFloat(vals["1. open"] || vals.open || 0),
          high: parseFloat(vals["2. high"] || vals.high || 0),
          low: parseFloat(vals["3. low"] || vals.low || 0),
          close: parseFloat(vals["4. close"] || vals.close || 0),
        }))
        .filter((d) => d.open > 0 && d.close > 0);

      const data = {
        pair,
        interval,
        entries,
        count: entries.length,
        source: "AV",
      };

      CACHE[cacheKey] = { data, ts: Date.now() };
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "No price history available", pair }, { status: 503 });
  } catch (error) {
    console.error("[Price History Error]", error);
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}