/* ═══════════════════════════════════════════════════════════
   Stock Prices API — stock-prices2 RapidAPI
   Endpoints: 1d, 5d, 1mo, ytd, max
   Caching: 2min per ticker+range
   ═══════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const STOCK_API_KEY = process.env.STOCK_PRICES_API_KEY || "";
const STOCK_API_HOST = process.env.STOCK_PRICES_API_HOST || "stock-prices2.p.rapidapi.com";

// In-memory cache
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const VALID_RANGES = ["1d", "5d", "1mo", "ytd", "max"] as const;
type Range = (typeof VALID_RANGES)[number];

// Popular stock tickers
const POPULAR_TICKERS = [
  "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA",
  "META", "NFLX", "AMD", "INTC", "BA", "DIS",
  "JPM", "V", "WMT", "PFE", "COIN",
];

// Batch size for parallel requests (free plan has limits)
const BATCH_SIZE = 3;

interface StockPricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockSummary {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  prices?: StockPricePoint[];
}

interface StockData {
  ticker: string;
  range: Range;
  prices: StockPricePoint[];
  lastPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
}

function normalizePriceData(raw: any, ticker: string, range: Range): StockData | null {
  try {
    // The API returns an object where keys are datetime strings
    // e.g. { "2026-06-18 09:30:00-04:00": { Close: 298.01, Open: 298.10, High: 300.57, Low: 295.62, Volume: 85962200 } }
    let priceData: any[];

    if (Array.isArray(raw)) {
      priceData = raw;
    } else if (raw?.data && Array.isArray(raw.data)) {
      priceData = raw.data;
    } else if (raw?.results && Array.isArray(raw.results)) {
      priceData = raw.results;
    } else if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      // Object with datetime keys → convert to array
      priceData = Object.entries(raw).map(([date, val]: [string, any]) => ({
        date,
        open: val.Open || val.open || val.o || 0,
        high: val.High || val.high || val.h || 0,
        low: val.Low || val.low || val.l || 0,
        close: val.Close || val.close || val.c || val.price || 0,
        volume: val.Volume || val.volume || val.v || 0,
      }));
    } else {
      return null;
    }

    if (!Array.isArray(priceData) || priceData.length === 0) return null;

    // Ensure all fields are numbers
    const prices: StockPricePoint[] = priceData.map((item: any) => ({
      date: item.date || item.datetime || item.t || item.timestamp || "",
      open: parseFloat(item.open || item.o || 0),
      high: parseFloat(item.high || item.h || 0),
      low: parseFloat(item.low || item.l || 0),
      close: parseFloat(item.close || item.c || item.price || 0),
      volume: parseInt(String(item.volume || item.v || 0)),
    })).filter((p: StockPricePoint) => p.close > 0);

    if (prices.length === 0) return null;

    const lastPrice = prices[prices.length - 1].close;
    const firstPrice = prices[0].open;
    const change = lastPrice - firstPrice;
    const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;
    const high = Math.max(...prices.map((p: StockPricePoint) => p.high));
    const low = Math.min(...prices.map((p: StockPricePoint) => p.low));
    const totalVolume = prices.reduce((sum: number, p: StockPricePoint) => sum + p.volume, 0);

    return {
      ticker,
      range,
      prices,
      lastPrice,
      change,
      changePercent,
      high,
      low,
      volume: totalVolume,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`[StockAPI] Parse error for ${ticker}:`, e);
    return null;
  }
}

async function fetchStockPrice(ticker: string, range: Range): Promise<StockData | null> {
  const cacheKey = `${ticker}:${range}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  if (!STOCK_API_KEY) {
    console.warn("[StockAPI] No API key configured");
    return null;
  }

  const url = `https://${STOCK_API_HOST}/api/v1/resources/stock-prices/${range}?ticker=${encodeURIComponent(ticker)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": STOCK_API_KEY,
        "x-rapidapi-host": STOCK_API_HOST,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 429) {
      console.warn(`[StockAPI] Rate limited for ${ticker}`);
      return null;
    }
    if (!res.ok) {
      console.error(`[StockAPI] Error ${res.status} for ${ticker}`);
      return null;
    }

    const raw = await res.json();
    const data = normalizePriceData(raw, ticker, range);

    if (data) {
      cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL });
    }

    return data;
  } catch (e) {
    console.error(`[StockAPI] Fetch error for ${ticker}:`, e);
    return null;
  }
}

// GET /api/stocks/prices?ticker=AAPL&range=1d
// GET /api/stocks/prices?tickers=AAPL,GOOGL,MSFT&range=5d
// GET /api/stocks/prices?action=popular&range=1d
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") || "1d") as Range;

  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: `Invalid range. Use: ${VALID_RANGES.join(", ")}` }, { status: 400 });
  }

  const action = searchParams.get("action");

  // Popular stocks summary
  if (action === "popular") {
    const ticker = searchParams.get("ticker");
    const tickers = ticker ? ticker.split(",").map(t => t.trim().toUpperCase()) : POPULAR_TICKERS.slice(0, 8);

    // Batch requests to avoid rate limiting
    const results: StockSummary[] = [];
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (t) => {
          const data = await fetchStockPrice(t, "1d");
          return data ? { ticker: t, price: data.lastPrice, change: data.change, changePercent: data.changePercent, high: data.high, low: data.low, volume: data.volume, prices: data.prices } as StockSummary : null;
        })
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled" && r.value) results.push(r.value);
      }
    }
    return NextResponse.json({ stocks: results, range: "1d", cached: false });
  }

  // Single ticker
  const ticker = searchParams.get("ticker");
  if (ticker) {
    const data = await fetchStockPrice(ticker.toUpperCase(), range);
    if (!data) {
      return NextResponse.json({ error: `No data for ${ticker}` }, { status: 404 });
    }
    return NextResponse.json(data);
  }

  // Multiple tickers
  const tickersQuery = searchParams.get("tickers");
  if (tickersQuery) {
    const tickerList = tickersQuery.split(",").map(t => t.trim().toUpperCase());
    const results = await Promise.allSettled(
      tickerList.map(async (t) => {
        const d = await fetchStockPrice(t, range);
        if (!d) return null;
        const { ticker: _, ...rest } = d;
        return { ticker: t, ...rest };
      })
    );
    const stocks = results
      .filter((r): r is PromiseFulfilledResult<StockData> => r.status === "fulfilled" && r.value !== null)
      .map(r => r.value);
    return NextResponse.json({ stocks, range, cached: false });
  }

  return NextResponse.json({ error: "Provide ?ticker=X, ?tickers=A,B or ?action=popular" }, { status: 400 });
}