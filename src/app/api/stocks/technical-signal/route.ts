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

// v3.0 NEW: TradingView Analyst Recommendations
const TV_HOST = process.env.TRADINGVIEW_API_HOST || "tradingview-data1.p.rapidapi.com";
const TV_KEY = process.env.TRADINGVIEW_API_KEY || "";

async function getAnalyst(ticker: string): Promise<AnalystData | null> {
  if (!TV_KEY) return null;
  try {
    const res = await fetchWithTimeout(
      `https://${TV_HOST}/analyst?symbol=${encodeURIComponent(ticker)}&exchange=NASDAQ`,
      TV_HOST,
      10000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.detail?.error || data.messages) return null;
    return data as AnalystData;
  } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════
   STOCK FUSION v3.0 — 5-SOURCE ULTRA-STRICT
   Sources:
     1. 35-Agent Signal (25%) — primary voting signal
     2. Technical Indicators (25%) — RSI, MACD, EMA/SMA, BB, Stoch, ATR
     3. News Sentiment (15%) — headline sentiment
     4. Multi-timeframe (20%) — daily/weekly/monthly trend alignment
     5. TradingView Analyst (15%) — wall street analyst recommendations (NEW v3.0)
   
   v3.0 CHANGES:
     → NEW: TradingView analyst recommendations as 5th source
     → Stricter: min score ±2.5 (was ±1.5), min 3 sources (was 2)
     → NEW: All-timeframe alignment bonus (+3)
     → NEW: Contrarian filter — if RSI>75 and all sources bullish, reject
     → TOP 3 output (was TOP 2)
     → Confidence formula improved with source count weighting
   ═══════════════════════════════════════════════════════════ */

interface AnalystData {
  ticker?: string;
  consensus?: string;  // "strong_buy", "buy", "hold", "sell", "strong_sell"
  buy?: number;
  hold?: number;
  sell?: number;
  strongBuy?: number;
  strongSell?: number;
  totalAnalysts?: number;
  targetPrice?: number;
  [key: string]: any;
}

interface CombinedSignal {
  ticker: string;
  agentSignal: SignalData | null;
  indicators: IndicatorData | null;
  sentiment: SentimentData | null;
  multiframe: MultiframeData | null;
  analyst: AnalystData | null;       // NEW v3.0
  fusionScore: number;
  fusionVerdict: string;
  confidence: number;
  confluences: number;
  reasoning: string[];
  sourceCount: number;
  filtered: boolean;
  filterReason?: string;
}

function computeFusion(s: CombinedSignal): void {
  let score = 0;
  let totalWeight = 0;
  const reasons: string[] = [];
  let sourceCount = 0;

  // ═══ SOURCE 1: 35-Agent Signal (weight: 25%) ═══
  if (s.agentSignal) {
    sourceCount++;
    const agentScore = s.agentSignal.bias_score || 0;
    const normalized = ((agentScore - 50) / 50) * 10;
    score += normalized * 0.25;
    totalWeight += 0.25;
    if (Math.abs(agentScore) > 60) {
      reasons.push(`35-Agents strong ${agentScore > 0 ? "bullish" : "bearish"} consensus (${agentScore})`);
    }
  }

  // ═══ SOURCE 2: TECHNICAL INDICATORS (weight: 25%) ═══
  if (s.indicators) {
    sourceCount++;
    const ind = s.indicators.indicators;
    const price = s.indicators.price?.close || 0;
    let indScore = 0;
    let indCount = 0;

    // RSI (strong signal)
    if (ind.rsi14 !== undefined) {
      if (ind.rsi14 < 30) { indScore += 3; indCount++; reasons.push(`RSI oversold (${ind.rsi14.toFixed(1)})`); }
      else if (ind.rsi14 < 40) { indScore += 1.5; indCount++; }
      else if (ind.rsi14 > 70) { indScore -= 3; indCount++; reasons.push(`RSI overbought (${ind.rsi14.toFixed(1)})`); }
      else if (ind.rsi14 > 60) { indScore -= 1.5; indCount++; }
    }

    // MACD
    if (ind.macd) {
      if (ind.macd.histogram > 0 && ind.macd.macd > ind.macd.signal) {
        indScore += 2.5; indCount++; reasons.push("MACD bullish crossover");
      } else if (ind.macd.histogram < 0 && ind.macd.macd < ind.macd.signal) {
        indScore -= 2.5; indCount++; reasons.push("MACD bearish crossover");
      }
    }

    // EMA Alignment — 9 > 20 > 50 = bullish, reverse = bearish
    if (ind.ema9 && ind.ema20 && ind.ema50) {
      if (ind.ema9 > ind.ema20 && ind.ema20 > ind.ema50) {
        indScore += 3; indCount++; reasons.push("EMA 9>20>50 bullish alignment");
      } else if (ind.ema9 < ind.ema20 && ind.ema20 < ind.ema50) {
        indScore -= 3; indCount++; reasons.push("EMA 9<20<50 bearish alignment");
      }
      // EMA 9/20 crossover detection
      if (price > 0 && ind.ema9 && ind.ema20) {
        // Price above both EMAs = bullish
        if (price > ind.ema9 && price > ind.ema20) { indScore += 1; indCount++; }
        else if (price < ind.ema9 && price < ind.ema20) { indScore -= 1; indCount++; }
      }
    }

    // SMA Alignment — price vs SMA200 (major trend)
    if (ind.sma200 && price > 0) {
      if (price > ind.sma200) { indScore += 2; indCount++; reasons.push("Price above SMA200 (bullish)"); }
      else { indScore -= 2; indCount++; reasons.push("Price below SMA200 (bearish)"); }
    }

    // Bollinger Bands
    if (ind.bollinger && price > 0) {
      const { upper, lower, middle } = ind.bollinger;
      if (price <= lower * 1.005) { indScore += 2.5; indCount++; reasons.push("Price at BB lower (bounce zone)"); }
      else if (price >= upper * 0.995) { indScore -= 2.5; indCount++; reasons.push("Price at BB upper (rejection zone)"); }
      // BB width — squeeze detection
      const bbWidth = (upper - lower) / middle;
      if (bbWidth < 0.05) reasons.push("BB squeeze — breakout coming");
    }

    // Stochastic
    if (ind.stochastic) {
      if (ind.stochastic.k < 20 && ind.stochastic.d < 20) {
        indScore += 2; indCount++; reasons.push(`Stoch oversold (K:${ind.stochastic.k.toFixed(0)})`);
      } else if (ind.stochastic.k > 80 && ind.stochastic.d > 80) {
        indScore -= 2; indCount++; reasons.push(`Stoch overbought (K:${ind.stochastic.k.toFixed(0)})`);
      }
    }

    // 52-week range position
    if (ind.week52_high > 0 && ind.week52_low > 0 && price > 0) {
      const rangePos = (price - ind.week52_low) / (ind.week52_high - ind.week52_low);
      if (rangePos < 0.15) { indScore += 2; indCount++; reasons.push("Near 52-week low (value zone)"); }
      else if (rangePos > 0.85) { indScore -= 2; indCount++; reasons.push("Near 52-week high (overextended)"); }
    }

    // Super confluence bonus
    if (indCount >= 5) {
      reasons.push(`STRONG indicator confluence (${indCount}/7 agreeing)`);
    }

    score += (indScore / 10) * 0.25;
    totalWeight += 0.25;
  }

  // ═══ SOURCE 3: News Sentiment (weight: 15%) ═══ (unchanged)
  // ═══ SOURCE 4: Multi-timeframe (weight: 20%) ═══
  if (s.multiframe) {
    sourceCount++;
    const mf = s.multiframe;
    let mfScore = 0;

    if (mf.timeframes.weekly?.trend === "uptrend") { mfScore += 4; reasons.push("Weekly uptrend"); }
    else if (mf.timeframes.weekly?.trend === "downtrend") { mfScore -= 4; reasons.push("Weekly downtrend"); }
    if (mf.timeframes.monthly?.trend === "uptrend") { mfScore += 3; reasons.push("Monthly uptrend"); }
    else if (mf.timeframes.monthly?.trend === "downtrend") { mfScore -= 3; reasons.push("Monthly downtrend"); }
    if (mf.timeframes.daily?.trend === "uptrend") mfScore += 2;
    else if (mf.timeframes.daily?.trend === "downtrend") mfScore -= 2;

    // Multi-timeframe ALL agree = super bonus
    const allUp = mf.timeframes.weekly?.trend === "uptrend" && mf.timeframes.monthly?.trend === "uptrend" && mf.timeframes.daily?.trend === "uptrend";
    const allDown = mf.timeframes.weekly?.trend === "downtrend" && mf.timeframes.monthly?.trend === "downtrend" && mf.timeframes.daily?.trend === "downtrend";
    if (allUp) { mfScore += 3; reasons.push("ALL timeframes aligned UP"); }
    else if (allDown) { mfScore -= 3; reasons.push("ALL timeframes aligned DOWN"); }

    const confFactor = (mf.confidence || 50) / 100;
    score += (mfScore / 10) * 0.20;
    totalWeight += 0.20;
  }

  // ═══ SOURCE 5: TradingView Analyst (weight: 15%) — NEW v3.0 ═══
  if (s.analyst) {
    sourceCount++;
    const a = s.analyst;
    const consensus = (a.consensus || "").toString().toLowerCase();
    const buyCount = (a.buy || 0) + (a.strongBuy || 0);
    const sellCount = (a.sell || 0) + (a.strongSell || 0);
    const total = a.totalAnalysts || buyCount + sellCount + (a.hold || 0);

    let analystScore = 0;
    if (consensus.includes("strong_buy")) { analystScore = 10; reasons.push(`Analysts: STRONG BUY (${buyCount}/${total})`); }
    else if (consensus.includes("buy")) { analystScore = 6; reasons.push(`Analysts: BUY (${buyCount}/${total})`); }
    else if (consensus.includes("strong_sell")) { analystScore = -10; reasons.push(`Analysts: STRONG SELL (${sellCount}/${total})`); }
    else if (consensus.includes("sell")) { analystScore = -6; reasons.push(`Analysts: SELL (${sellCount}/${total})`); }
    else { analystScore = 0; reasons.push(`Analysts: HOLD (${a.hold || 0}/${total})`); }

    // Target price vs current price
    if (a.targetPrice && s.indicators?.price?.close) {
      const diff = (a.targetPrice - s.indicators.price.close) / s.indicators.price.close;
      if (diff > 0.10) { analystScore += 2; reasons.push(`Target +${(diff * 100).toFixed(1)}% above price`); }
      else if (diff < -0.10) { analystScore -= 2; reasons.push(`Target ${(diff * 100).toFixed(1)}% below price`); }
    }

    score += (analystScore / 10) * 0.15;
    totalWeight += 0.15;
  }
  if (s.sentiment) {
    sourceCount++;
    const sentScore = ((s.sentiment.score - 50) / 50) * 10; // -10 to +10
    score += sentScore * 0.15;
    totalWeight += 0.15;
    if (Math.abs(s.sentiment.score - 50) > 20) {
      reasons.push(`News ${s.sentiment.score > 50 ? "bullish" : "bearish"} (${s.sentiment.bullish_count}B/${s.sentiment.bearish_count}S headlines)`);
    }
  }

  // (Source 3 + Source 4 handled above)

  // ═══ STRICT FILTERS ═══
  s.filtered = false;
  s.filterReason = undefined;

  // Filter 1: Minimum source count — need at least 3 sources (v3.0 stricter)
  if (sourceCount < 3) {
    s.filtered = true;
    s.filterReason = `Only ${sourceCount} data source(s) — need at least 3`;
  }

  // Filter 2: RSI sanity — tighter (73/27)
  const rsi = s.indicators?.indicators?.rsi14;
  if (rsi !== undefined) {
    if (score > 0 && rsi > 73) {
      s.filtered = true;
      s.filterReason = `RSI overbought (${rsi.toFixed(1)}) conflicts with BUY signal`;
    } else if (score < 0 && rsi < 27) {
      s.filtered = true;
      s.filterReason = `RSI oversold (${rsi.toFixed(1)}) conflicts with SELL signal`;
    }
  }

  // Filter 3: Weak signal — score too close to zero (v3.0: ±2.5 was ±1.5)
  if (Math.abs(score) < 2.5 && !s.filtered) {
    s.filtered = true;
    s.filterReason = `Score too weak (${score.toFixed(1)}) — no clear edge`;
  }

  // v3.0 NEW Filter 4: Contrarian — if everything bullish but RSI extremely overbought, reject
  if (!s.filtered && rsi !== undefined && rsi > 78 && score > 4 && s.fusionVerdict.includes("BUY")) {
    s.filtered = true;
    s.filterReason = `Contrarian reject: RSI ${rsi.toFixed(1)} overbought with strong BUY — reversal risk`;
  }
  if (!s.filtered && rsi !== undefined && rsi < 22 && score < -4 && s.fusionVerdict.includes("SELL")) {
    s.filtered = true;
    s.filterReason = `Contrarian reject: RSI ${rsi.toFixed(1)} oversold with strong SELL — reversal risk`;
  }

  // ═══ FINAL SCORING ═══
  s.fusionScore = Math.round(score * 100) / 100;
  s.sourceCount = sourceCount;
  s.reasoning = reasons;
  s.confluences = reasons.length;

  // Confidence = how many sources agree + how strong they agree
  // Base: source agreement ratio * 60 + score strength * 40
  const sourceAgreement = sourceCount >= 3 ? 1.0 : sourceCount === 2 ? 0.75 : 0.5;
  const scoreStrength = Math.min(Math.abs(score) / 5, 1.0);
  let confidence = Math.round((sourceAgreement * 60 + scoreStrength * 40));

  // Bonus for strong confluence
  if (s.confluences >= 5) confidence = Math.min(confidence + 5, 95);
  if (s.confluences >= 7) confidence = Math.min(confidence + 5, 97);

  s.confidence = confidence;

  // Verdict
  // Verdict thresholds — v3.0: slightly tighter
  if (s.fusionScore >= 5) s.fusionVerdict = "STRONG_BUY";
  else if (s.fusionScore >= 2.5) s.fusionVerdict = "BUY";
  else if (s.fusionScore <= -5) s.fusionVerdict = "STRONG_SELL";
  else if (s.fusionScore <= -2.5) s.fusionVerdict = "SELL";
  else s.fusionVerdict = "NEUTRAL";

  // Apply filter to verdict too
  if (s.filtered) {
    s.fusionVerdict = "NEUTRAL";
    s.confidence = Math.min(s.confidence, 40);
  }
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
        const [agentSignal, indicators, sentiment, multiframe, analyst] = await Promise.all([
          getAgentSignal(ticker),
          getIndicators(ticker),
          getSentiment(ticker),
          getMultiframe(ticker),
          getAnalyst(ticker),  // v3.0 NEW
        ]);

        if (!agentSignal && !sentiment && !multiframe && !indicators && !analyst) {
          throw new Error(`${ticker}: No data from any source`);
        }

        const combined: CombinedSignal = {
          ticker,
          agentSignal: agentSignal || null,
          indicators: indicators || null,
          sentiment: sentiment || null,
          multiframe: multiframe || null,
          analyst: analyst || null,  // v3.0
          fusionScore: 0,
          fusionVerdict: "NEUTRAL",
          confidence: 0,
          confluences: 0,
          reasoning: [],
          sourceCount: 0,
          filtered: false,
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
    // Single stock — all 5 data sources (v3.0)
    if (ticker && action === "single") {
      const [agentSignal, indicators, sentiment, multiframe, analyst] = await Promise.all([
        getAgentSignal(ticker),
        getIndicators(ticker),
        getSentiment(ticker),
        getMultiframe(ticker),
        getAnalyst(ticker),  // v3.0
      ]);

      if (!agentSignal && !sentiment && !multiframe && !indicators && !analyst) {
        return NextResponse.json({ error: `No data for ${ticker}` }, { status: 404 });
      }

      const combined: CombinedSignal = {
        ticker,
        agentSignal: agentSignal || null,
        indicators: indicators || null,
        sentiment: sentiment || null,
        multiframe: multiframe || null,
        analyst: analyst || null,  // v3.0
        fusionScore: 0,
        fusionVerdict: "NEUTRAL",
        confidence: 0,
        confluences: 0,
        reasoning: [],
        sourceCount: 0,
        filtered: false,
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
            indicators ? "Indicators" : null,
            sentiment ? "Sentiment" : null,
            multiframe ? "Multiframe" : null,
            analyst ? "TV-Analyst" : null,  // v3.0
          ].filter(Boolean),
          fusionVersion: "v3.0-5Source",
        },
      });
    }

    // Batch scan
    if (action === "scan" || !action) {
      const { signals, errors } = await scanStocks(POPULAR_STOCKS);

      // Filter out NEUTRAL and filtered signals, keep only actionable
      const actionable = signals.filter(
        s => !s.filtered && s.fusionVerdict !== "NEUTRAL"
      );

      // Sort by fusion score strength (strongest conviction first)
      actionable.sort((a, b) => Math.abs(b.fusionScore) - Math.abs(a.fusionScore));

      // Return TOP 3 only (v3.0: was TOP 2)
      const topSignals = actionable.slice(0, 3);

      return NextResponse.json({
        signals: topSignals,
        allSignals: actionable,
        scanned: POPULAR_STOCKS.length,
        filtered: signals.filter(s => s.filtered).length,
        success: actionable.length,
        errors,
        timestamp: new Date().toISOString(),
        fusionVersion: "v3.0-5Source",
        engineNotes: "5-source fusion: 35-Agents + Indicators + Sentiment + MultiTF + TV-Analyst | Stricter filters",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Stock signal error:", error);
    return NextResponse.json({ error: "Failed to fetch stock signals" }, { status: 500 });
  }
}