import { NextRequest, NextResponse } from "next/server";
import { getTimeSeries } from "@/lib/rapidapi";

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

    // Use Twelve Data time_series (more reliable than AV for intraday)
    const data = await getTimeSeries(pair, interval, outputsize);

    if (data && data.values && data.values.length > 0) {
      // TD returns values in descending order, reverse for chart
      const entries = [...data.values]
        .reverse()
        .map((v: any) => ({
          time: v.datetime || v.time || "",
          open: parseFloat(v.open || 0),
          high: parseFloat(v.high || 0),
          low: parseFloat(v.low || 0),
          close: parseFloat(v.close || 0),
        }))
        .filter((d) => d.open > 0 && d.close > 0);

      const result = {
        pair,
        interval,
        entries,
        count: entries.length,
        source: "TD",
        meta: data.meta || null,
      };

      CACHE[cacheKey] = { data: result, ts: Date.now() };
      return NextResponse.json(result);
    }

    // Fallback: try Alpha Vantage
    const { getAVFxIntraday } = await import("@/lib/rapidapi");
    const [from, to] = pair.split("/");
    if (from && to) {
      const timeSeries = await getAVFxIntraday(from, to);
      if (timeSeries) {
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

        const result = {
          pair,
          interval,
          entries,
          count: entries.length,
          source: "AV",
        };

        CACHE[cacheKey] = { data: result, ts: Date.now() };
        return NextResponse.json(result);
      }
    }

    return NextResponse.json({ error: "No price history available", pair }, { status: 503 });
  } catch (error) {
    console.error("[Price History Error]", error);
    // Return cached if available even if stale
    const { searchParams } = new URL(req.url);
    const pair = searchParams.get("pair") || "EUR/USD";
    const interval = searchParams.get("interval") || "5min";
    const cacheKey = `${pair}_${interval}`;
    if (CACHE[cacheKey]) return NextResponse.json(CACHE[cacheKey].data);
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}