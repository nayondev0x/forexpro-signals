import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.RAPIDAPI_KEY || "";

// ── API Hosts ──
const TECH_SIGNAL_HOST = "technical-signals-api.p.rapidapi.com";
const TRADERS_HUB_HOST = "traders-hub-trading-signals5.p.rapidapi.com";

const POPULAR_STOCKS = [
  "NVDA", "AAPL", "GOOGL", "MSFT", "TSLA", "AMZN",
  "META", "AMD", "NFLX", "SPY", "QQQ", "COIN"
];

/* ─ Types ─ */
interface Agent { agent: string; vote: number; read: string; }

interface SignalData {
  ticker: string; date: string; last_close: number;
  bias_score: number; verdict: string; agents: Agent[];
}

interface IndicatorData {
  ticker: string; date: string;
  price: { open: number; high: number; low: number; close: number; volume: number; };
  indicators: {
    sma20: number; sma50: number; sma200: number;
    ema9: number; ema20: number; ema50: number;
    rsi14: number;
    macd: { macd: number; signal: number; histogram: number };
    bollinger: { upper: number; middle: number; lower: number };
    atr14: number;
    stochastic: { k: number; d: number };
    week52_high: number; week52_low: number;
  };
}

interface SentimentData {
  ticker: string; asset_class: string; asset_label: string;
  sentiment: string; score: number; headlines_analyzed: number;
  bullish_count: number; bearish_count: number; neutral_count: number;
  sample_headlines: { title: string; publisher: string; link: string; score: number }[];
  as_of: string;
}

interface MultiframeData {
  ticker: string; asset_class: string; asset_label: string;
  verdict: string; confidence: number; last_price: number; currency: string;
  timeframes: {
    daily:   { trend: string; rsi: number };
    weekly:  { trend: string; rsi: number };
    monthly: { trend: string; rsi: number };
  };
  as_of: string;
}

/* ─ Fetch helpers ─ */
async function fetchWithTimeout(url: string, host: string, timeout = 12000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": host,
      },
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// 35-Agent Technical Signal
async function getAgentSignal(ticker: string): Promise<SignalData | null> {
  try {
    const res = await fetchWithTimeout(
      `https://${TECH_SIGNAL_HOST}/signal?ticker=${encodeURIComponent(ticker)}`,
      TECH_SIGNAL_HOST,
      15000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.messages) return null;
    return data as SignalData;
  } catch { return null; }
}

// Indicators
async function getIndicators(ticker: string): Promise<IndicatorData | null> {
  try {
    const res = await fetchWithTimeout(
      `https://${TECH_SIGNAL_HOST}/indicators?ticker=${encodeURIComponent(ticker)}`,
      TECH_SIGNAL_HOST,
      15000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.messages) return null;
    return data as IndicatorData;
  } catch { return null; }
}

// Traders Hub — News Sentiment
async function getSentiment(ticker: string): Promise<SentimentData | null> {
  try {
    const res = await fetchWithTimeout(
      `https://${TRADERS_HUB_HOST}/v1/sentiment?headlines=20&ticker=${encodeURIComponent(ticker)}`,
      TRADERS_HUB_HOST,
      12000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.detail?.error) return null;
    return data as SentimentData;
  } catch { return null; }
}

// Traders Hub — Multi-timeframe
async function getMultiframe(ticker: string): Promise<MultiframeData | null> {
  try {
    const res = await fetchWithTimeout(
      `https://${TRADERS_HUB_HOST}/v1/multiframe?ticker=${encodeURIComponent(ticker)}`,
      TRADERS_HUB_HOST,
      12000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.detail?.error) return null;
    return data as MultiframeData;
  } catch { return null; }
}

/* ─ Combined scan ─ */
interface CombinedSignal {
  ticker: string;
  agentSignal: SignalData | null;
  indicators: IndicatorData | null;
  sentiment: SentimentData | null;
  multiframe: MultiframeData | null;
  // Computed fusion score
  fusionScore: number;
  fusionVerdict: string;
}

function computeFusion(s: CombinedSignal): void {
  let score = 0;
  let weight = 0;

  // 35-Agent (weight: 40)
  if (s.agentSignal) {
    score += s.agentSignal.bias_score * 0.4;
    weight += 0.4;
  }

  // Sentiment (weight: 25)
  if (s.sentiment) {
    const sentScore = ((s.sentiment.score - 50) / 50) * 15; // -15 to +15
    score += sentScore * 0.25;
    weight += 0.25;
  }

  // Multiframe (weight: 35)
  if (s.multiframe) {
    const mf = s.multiframe;
    let mfScore = 0;
    // Weekly & Monthly trend matter more
    if (mf.timeframes.weekly?.trend === "uptrend") mfScore += 5;
    else if (mf.timeframes.weekly?.trend === "downtrend") mfScore -= 5;
    if (mf.timeframes.monthly?.trend === "uptrend") mfScore += 4;
    else if (mf.timeframes.monthly?.trend === "downtrend") mfScore -= 4;
    if (mf.timeframes.daily?.trend === "uptrend") mfScore += 2;
    else if (mf.timeframes.daily?.trend === "downtrend") mfScore -= 2;
    // Confidence factor
    const confFactor = (mf.confidence || 50) / 100;
    score += mfScore * confFactor * 0.35;
    weight += 0.35;
  }

  s.fusionScore = Math.round(score * 10) / 10;

  if (s.fusionScore >= 5) s.fusionVerdict = "STRONG_BUY";
  else if (s.fusionScore >= 2) s.fusionVerdict = "BUY";
  else if (s.fusionScore <= -5) s.fusionVerdict = "STRONG_SELL";
  else if (s.fusionScore <= -2) s.fusionVerdict = "SELL";
  else s.fusionVerdict = "NEUTRAL";
}

async function scanStocks(tickers: string[]): Promise<{
  signals: CombinedSignal[];
  errors: string[];
}> {
  const signals: CombinedSignal[] = [];
  const errors: string[] = [];
  const batchSize = 3; // 3 stocks at a time (each needs 4 API calls)

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (ticker) => {
        const [agentSignal, indicators, sentiment, multiframe] = await Promise.all([
          getAgentSignal(ticker),
          getIndicators(ticker),
          getSentiment(ticker),
          getMultiframe(ticker),
        ]);

        if (!agentSignal && !sentiment && !multiframe) {
          throw new Error(`${ticker}: No data from any source`);
        }

        const combined: CombinedSignal = {
          ticker,
          agentSignal: agentSignal || null,
          indicators: indicators || null,
          sentiment: sentiment || null,
          multiframe: multiframe || null,
          fusionScore: 0,
          fusionVerdict: "NEUTRAL",
        };

        computeFusion(combined);
        return combined;
      })
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === "fulfilled") {
        signals.push(results[j].value);
      } else {
        errors.push(batch[j]);
      }
    }
  }

  return { signals, errors };
}

/* ─ Route Handler ─ */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ticker = searchParams.get("ticker");
  const action = searchParams.get("action");

  if (!API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    // Single stock — all 4 data sources
    if (ticker && action === "single") {
      const [agentSignal, indicators, sentiment, multiframe] = await Promise.all([
        getAgentSignal(ticker),
        getIndicators(ticker),
        getSentiment(ticker),
        getMultiframe(ticker),
      ]);

      if (!agentSignal && !sentiment && !multiframe) {
        return NextResponse.json({ error: `No data for ${ticker}` }, { status: 404 });
      }

      const combined: CombinedSignal = {
        ticker,
        agentSignal: agentSignal || null,
        indicators: indicators || null,
        sentiment: sentiment || null,
        multiframe: multiframe || null,
        fusionScore: 0,
        fusionVerdict: "NEUTRAL",
      };
      computeFusion(combined);

      return NextResponse.json({
        ...combined,
        meta: {
          totalAgents: agentSignal?.agents?.length || 0,
          bullish: agentSignal?.agents?.filter(a => a.vote > 0).length || 0,
          bearish: agentSignal?.agents?.filter(a => a.vote < 0).length || 0,
          neutral: agentSignal?.agents?.filter(a => a.vote === 0).length || 0,
          dataSources: [
            agentSignal ? "35-Agents" : null,
            sentiment ? "Sentiment" : null,
            multiframe ? "Multiframe" : null,
            indicators ? "Indicators" : null,
          ].filter(Boolean),
        },
      });
    }

    // Batch scan
    if (action === "scan" || !action) {
      const { signals, errors } = await scanStocks(POPULAR_STOCKS);

      // Sort by fusion score strength
      signals.sort((a, b) => Math.abs(b.fusionScore) - Math.abs(a.fusionScore));

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
    return NextResponse.json({ error: "Failed to fetch stock signals" }, { status: 500 });
  }
}