import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.RAPIDAPI_KEY || "";
const HOST = "technical-signals-api.p.rapidapi.com";

// Popular stocks to scan
const POPULAR_STOCKS = [
  "NVDA", "AAPL", "GOOGL", "MSFT", "TSLA", "AMZN",
  "META", "AMD", "NFLX", "SPY", "QQQ", "COIN"
];

interface Agent {
  agent: string;
  vote: number;
  read: string;
}

interface SignalData {
  ticker: string;
  date: string;
  last_close: number;
  bias_score: number;
  verdict: string;
  agents: Agent[];
}

interface IndicatorData {
  ticker: string;
  date: string;
  price: {
    open: number; high: number; low: number; close: number; volume: number;
  };
  indicators: {
    sma20: number; sma50: number; sma200: number;
    ema9: number; ema20: number; ema50: number;
    rsi14: number;
    macd: { macd: number; signal: number; histogram: number };
    bollinger: { upper: number; middle: number; lower: number };
    atr14: number;
    stochastic: { k: number; d: number };
    week52_high: number;
    week52_low: number;
  };
}

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch {
    clearTimeout(id);
    throw new Error("Timeout");
  }
}

async function getSignal(ticker: string): Promise<SignalData | null> {
  try {
    const res = await fetchWithTimeout(
      `https://${HOST}/signal?ticker=${ticker}`,
      12000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.messages) return null; // API error
    return data as SignalData;
  } catch {
    return null;
  }
}

async function getIndicators(ticker: string): Promise<IndicatorData | null> {
  try {
    const res = await fetchWithTimeout(
      `https://${HOST}/indicators?ticker=${ticker}`,
      12000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.messages) return null;
    return data as IndicatorData;
  } catch {
    return null;
  }
}

// Batch scan multiple stocks (max 4 concurrent)
async function scanStocks(tickers: string[]): Promise<{
  signals: (SignalData & { indicators?: IndicatorData })[];
  errors: string[];
}> {
  const signals: (SignalData & { indicators?: IndicatorData })[] = [];
  const errors: string[] = [];
  const batchSize = 4;

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (ticker) => {
        const [signal, indicators] = await Promise.all([
          getSignal(ticker),
          getIndicators(ticker),
        ]);
        if (!signal) throw new Error(`${ticker}: No data`);
        return { ...signal, indicators: indicators || undefined };
      })
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        signals.push(r.value);
      } else {
        errors.push(batch[j]);
      }
    }
  }

  return { signals, errors };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ticker = searchParams.get("ticker");
  const action = searchParams.get("action"); // "scan" | "popular" | "single"

  if (!API_KEY) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Single stock signal
    if (ticker && action === "single") {
      const [signal, indicators] = await Promise.all([
        getSignal(ticker),
        getIndicators(ticker),
      ]);

      if (!signal) {
        return NextResponse.json(
          { error: `No data for ${ticker}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        signal,
        indicators,
        meta: {
          totalAgents: signal.agents?.length || 0,
          bullish: signal.agents?.filter((a) => a.vote > 0).length || 0,
          bearish: signal.agents?.filter((a) => a.vote < 0).length || 0,
          neutral: signal.agents?.filter((a) => a.vote === 0).length || 0,
        },
      });
    }

    // Scan popular stocks
    if (action === "scan" || !action) {
      const { signals, errors } = await scanStocks(POPULAR_STOCKS);

      // Sort by |bias_score| descending (strongest signals first)
      signals.sort(
        (a, b) => Math.abs(b.bias_score) - Math.abs(a.bias_score)
      );

      return NextResponse.json({
        signals,
        scanned: POPULAR_STOCKS.length,
        success: signals.length,
        errors,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Stock signal error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock signals" },
      { status: 500 }
    );
  }
}