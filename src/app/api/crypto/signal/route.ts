/* ═══════════════════════════════════════════════════════════════════════
   CRYPTO FUSION ENGINE v5.0 — SHARPSHOOTER: 1 SIGNAL = 1 WIN
   
   Sources fused (8-LAYER):
   1. SelfTrade External Signal (20%) — TP/SL from external source
   2. Binance Order Flow (25%) — depth imbalance + trade flow + momentum
   3. CryptoEdge Sentiment (15%) — crowding, sentiment signals, alerts
   4. Fear & Greed Index (5%) — market-wide sentiment
   5. Price Action (10%) — candle patterns, momentum
   6. Local Technical Analysis (25%) — RSI, MACD, EMA, BB, Stoch, ATR, SR, Divergence
   7. TradingView Technical Analysis (v5.0 NEW) — buy/sell/neutral consensus + MA/Oscillator alignment
   8. TV Conflict Filter (v5.0 NEW) — reject if TradingView strongly against signal
   
   v5.0 CHANGES:
     → NEW: LAYER 7 — TradingView Technical Analysis (buy/sell counts, MA+Oscillator alignment)
     → NEW: Filter 9 — TradingView strong counter-signal rejection
     → STRICTER: min 10 confluences (was 8), improved confidence bonus scaling
     → v4.0 carried: LAYER 6 Full local TA, CryptoEdge TA, ATR TP/SL, divergences
   ═══════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const SELFTRADE_KEY = process.env.SELFTRADE_API_KEY || "";
const SELFTRADE_HOST = process.env.SELFTRADE_API_HOST || "selftrade.p.rapidapi.com";
const BINANCE_KEY = process.env.BINANCE_API_KEY || "";
const BINANCE_HOST = process.env.BINANCE_API_HOST || "real-time-binance-data.p.rapidapi.com";
const CRYPTOEDGE_KEY = process.env.CRYPTOEDGE_API_KEY || "";
const CRYPTOEDGE_HOST = process.env.CRYPTOEDGE_API_HOST || "cryptoedge-market-sentiment-indicators.p.rapidapi.com";

// v5.0 NEW: TradingView Technical Analysis
const TV_HOST = process.env.TRADINGVIEW_API_HOST || "tradingview-data1.p.rapidapi.com";
const TV_KEY = process.env.TRADINGVIEW_API_KEY || "";

// Cache
const CACHE = new Map<string, { data: any; expires: number }>();

async function cachedFetch(host: string, key: string, path: string, ttlMs: number): Promise<any> {
  const cacheKey = `${host}${path}`;
  const cached = CACHE.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;
  if (!key) return null;

  try {
    const res = await fetch(`https://${host}${path}`, {
      headers: { "x-rapidapi-key": key, "x-rapidapi-host": host, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    CACHE.set(cacheKey, { data, expires: Date.now() + ttlMs });
    return data;
  } catch {
    return null;
  }
}

// ── Primary crypto pairs to scan ──
const CRYPTO_PAIRS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT",
];

interface FusionSignal {
  pair: string;
  type: "BUY" | "SELL";
  entry: number;
  tp: number;
  sl: number;
  confidence: number;
  confluences: number;
  reasoning: string[];
  sources: string[];
  layers: { layer: string; score: number; details: string[] }[];
  orderFlowScore: number | null;
  fearGreed: number | null;
  crowdingScore: number | null;
  taIndicators: Record<string, string | number>;
  filtered: boolean;
  filterReason?: string;
}

/* ═══════════════════════════════════════════════════════════
   LOCAL TA CALCULATIONS (from Binance candles)
   ═══════════════════════════════════════════════════════════ */

function calcEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = data[data.length - 1];
  for (let i = data.length - 2; i >= Math.max(0, data.length - period * 2); i--) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcSMA(data: number[], period: number): number {
  if (data.length < period) return 0;
  const slice = data.slice(0, period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(candles: any[], period = 14): number {
  if (candles.length < period + 1) return 50;
  let gains = 0, losses = 0;
  const n = Math.min(candles.length - 1, period);
  for (let i = 0; i < n; i++) {
    const d = candles[i].close - candles[i + 1].close;
    if (d > 0) gains += d; else losses -= d;
  }
  if (losses === 0) return 100;
  return +(100 - 100 / (1 + (gains / n) / (losses / n))).toFixed(1);
}

function calcMACD(candles: any[]): { macd: number; signal: number; histogram: number } | null {
  if (candles.length < 35) return null;
  const closes = candles.map(c => c.close).reverse();
  const e12 = calcEMA(closes, 12), e26 = calcEMA(closes, 26);
  const macdLine = e12 - e26;
  const macdHistory: number[] = [];
  for (let off = 1; off <= Math.min(closes.length - 26, 35); off++) {
    const sub = closes.slice(0, Math.max(26 + off, 27));
    const e12h = calcEMA(sub, 12), e26h = calcEMA(sub, 26);
    macdHistory.unshift(e12h - e26h);
  }
  if (macdHistory.length >= 9) {
    const sig = calcEMA(macdHistory, 9);
    return { macd: macdLine, signal: sig, histogram: macdLine - sig };
  }
  return { macd: macdLine, signal: 0, histogram: macdLine };
}

function calcStochastic(candles: any[], kPeriod = 14, dPeriod = 3): { k: number; d: number } | null {
  if (candles.length < kPeriod) return null;
  const recent = candles.slice(0, kPeriod);
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);
  const highest = Math.max(...highs);
  const lowest = Math.min(...lows);
  const range = highest - lowest;
  if (range === 0) return null;
  const k = ((recent[0].close - lowest) / range) * 100;

  // Calculate %D as SMA of last %K values
  const kValues: number[] = [k];
  for (let i = 1; i < dPeriod && i + kPeriod <= candles.length; i++) {
    const sub = candles.slice(i, i + kPeriod);
    const h = Math.max(...sub.map(c => c.high));
    const l = Math.min(...sub.map(c => c.low));
    const r = h - l;
    if (r > 0) kValues.push(((sub[0].close - l) / r) * 100);
  }
  const d = kValues.length > 0 ? kValues.reduce((a, b) => a + b, 0) / kValues.length : k;
  return { k: +k.toFixed(1), d: +d.toFixed(1) };
}

function calcBollinger(candles: any[], period = 20, stdDevMult = 2): { upper: number; middle: number; lower: number; width: number } | null {
  if (candles.length < period) return null;
  const closes = candles.slice(0, period).map(c => c.close);
  const middle = closes.reduce((a, b) => a + b, 0) / period;
  const variance = closes.reduce((sum, c) => sum + Math.pow(c - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const upper = middle + stdDevMult * stdDev;
  const lower = middle - stdDevMult * stdDev;
  const width = middle > 0 ? (upper - lower) / middle : 0;
  return { upper, middle, lower, width };
}

function calcATR(candles: any[], period = 14): number {
  if (candles.length < period + 1) return 0;
  let sum = 0;
  const n = Math.min(candles.length - 1, period);
  for (let i = 0; i < n; i++) {
    const c = candles[i], p = candles[i + 1];
    sum += Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  }
  return sum / n;
}

function findSR(candles: any[], price: number): { support: number; resistance: number; near: "support" | "resistance" | "none" } {
  if (candles.length < 15) return { support: price * 0.99, resistance: price * 1.01, near: "none" };
  const lows = candles.slice(0, 30).map(c => c.low).sort((a, b) => a - b);
  const highs = candles.slice(0, 30).map(c => c.high).sort((a, b) => b - a);
  const support = lows.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const resistance = highs.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const atr = (resistance - support) / 4;
  let near: "support" | "resistance" | "none" = "none";
  if (price - support < atr) near = "support";
  else if (resistance - price < atr) near = "resistance";
  return { support, resistance, near };
}

// RSI divergence detection
function detectRSIDivergence(candles: any[], rsiVal: number): { type: string | null; reason: string } {
  if (candles.length < 25) return { type: null, reason: "" };
  const lookback = Math.min(25, candles.length);
  const recent = candles.slice(0, lookback);

  // Find price highs and lows
  let priceHighs: { idx: number; val: number }[] = [];
  let priceLows: { idx: number; val: number }[] = [];
  for (let i = 0; i < recent.length - 2; i++) {
    if (recent[i].high > recent[i + 1].high && recent[i].high > recent[i + 2]?.high) {
      priceHighs.push({ idx: i, val: recent[i].high });
    }
    if (recent[i].low < recent[i + 1].low && recent[i].low < recent[i + 2]?.low) {
      priceLows.push({ idx: i, val: recent[i].low });
    }
  }

  // Bearish divergence: higher price high + RSI weakening
  if (priceHighs.length >= 2) {
    const h1 = priceHighs[0], h2 = priceHighs[1];
    if (h1.val > h2.val && rsiVal < 60) {
      return { type: "bearish", reason: `RSI bearish divergence: price higher high but RSI ${rsiVal} weakening` };
    }
  }

  // Bullish divergence: lower price low + RSI strengthening
  if (priceLows.length >= 2) {
    const l1 = priceLows[0], l2 = priceLows[1];
    if (l1.val < l2.val && rsiVal > 40) {
      return { type: "bullish", reason: `RSI bullish divergence: price lower low but RSI ${rsiVal} strengthening` };
    }
  }

  return { type: null, reason: "" };
}

// MACD histogram divergence
function detectMACDDivergence(candles: any[], histVal: number): { type: string | null; reason: string } {
  if (candles.length < 25) return { type: null, reason: "" };
  const recent = candles.slice(0, 25);

  let priceHighs: { idx: number; val: number }[] = [];
  let priceLows: { idx: number; val: number }[] = [];
  for (let i = 0; i < recent.length - 2; i++) {
    if (recent[i].high > recent[i + 1].high && recent[i].high > recent[i + 2]?.high) {
      priceHighs.push({ idx: i, val: recent[i].high });
    }
    if (recent[i].low < recent[i + 1].low && recent[i].low < recent[i + 2]?.low) {
      priceLows.push({ idx: i, val: recent[i].low });
    }
  }

  if (priceHighs.length >= 2 && histVal < 0) {
    const h1 = priceHighs[0], h2 = priceHighs[1];
    if (h1.val > h2.val) {
      return { type: "bearish", reason: "MACD bearish divergence: price higher high but histogram negative" };
    }
  }

  if (priceLows.length >= 2 && histVal > 0) {
    const l1 = priceLows[0], l2 = priceLows[1];
    if (l1.val < l2.val) {
      return { type: "bullish", reason: "MACD bullish divergence: price lower low but histogram positive" };
    }
  }

  return { type: null, reason: "" };
}

/* ═══════════════════════════════════════════════════════════
   DATA FETCHERS
   ═══════════════════════════════════════════════════════════ */

async function fetchSelfTradeSignal(pair: string): Promise<any> {
  return cachedFetch(SELFTRADE_HOST, SELFTRADE_KEY, `/rapidapi/signal?pair=${pair}`, 30_000);
}

async function fetchBinanceFlow(symbol: string): Promise<any> {
  const [depthRes, tradesRes, tickerRes, klinesRes] = await Promise.allSettled([
    cachedFetch(BINANCE_HOST, BINANCE_KEY, `/depth?symbol=${symbol}`, 15_000),
    cachedFetch(BINANCE_HOST, BINANCE_KEY, `/trades?symbol=${symbol}&limit=200`, 15_000),
    cachedFetch(BINANCE_HOST, BINANCE_KEY, `/ticker/24hr?symbol=${symbol}`, 30_000),
    cachedFetch(BINANCE_HOST, BINANCE_KEY, `/klines?symbol=${symbol}&limit=100`, 60_000), // v4.0: 100 (was 50)
  ]);

  const depth = depthRes.status === "fulfilled" ? depthRes.value : null;
  const trades = tradesRes.status === "fulfilled" ? tradesRes.value : null;
  const ticker = tickerRes.status === "fulfilled" ? (Array.isArray(tickerRes.value) ? tickerRes.value[0] : tickerRes.value) : null;
  const klines = klinesRes.status === "fulfilled" ? klinesRes.value : null;

  // Analyze depth
  let depthAnalysis = null;
  if (depth) {
    const bids = depth?.bids || [];
    const asks = depth?.asks || [];
    if (Array.isArray(bids) && Array.isArray(asks) && bids.length > 0 && asks.length > 0) {
      let totalBidVol = 0, totalAskVol = 0;
      for (const [p, q] of bids.slice(0, 20)) totalBidVol += parseFloat(q);
      for (const [p, q] of asks.slice(0, 20)) totalAskVol += parseFloat(q);
      const totalVol = totalBidVol + totalAskVol;
      const imbalance = totalVol > 0 ? ((totalBidVol / totalVol) * 100) - 50 : 0;
      depthAnalysis = { bidRatio: totalVol > 0 ? (totalBidVol / totalVol) * 100 : 50, imbalance };
    }
  }

  // Analyze trade flow
  let tradeFlow = null;
  if (Array.isArray(trades) && trades.length > 0) {
    let buyVol = 0, sellVol = 0;
    for (const t of trades.slice(0, 200)) {
      const qty = parseFloat(t.qty || t[1] || 0);
      if (t.isBuyerMaker === false || t.isBuyer === true) buyVol += qty;
      else sellVol += qty;
    }
    const totalVol = buyVol + sellVol;
    tradeFlow = { buyRatio: totalVol > 0 ? (buyVol / totalVol) * 100 : 50, buyVol, sellVol };
  }

  // Analyze ticker
  let tickerAnalysis = null;
  if (ticker) {
    const price = parseFloat(ticker.lastPrice || ticker.price || 0);
    const changePct = parseFloat(ticker.priceChangePercent || 0);
    const high = parseFloat(ticker.highPrice || 0);
    const low = parseFloat(ticker.lowPrice || 0);
    const range = high - low;
    const rangePosition = range > 0 ? (price - low) / range : 0.5;
    tickerAnalysis = { price, changePct, volatility: price > 0 ? (range / price) * 100 : 0, rangePosition };
  }

  // Parse candles — v4.0: reversed so index 0 = most recent
  let candles: any[] = [];
  if (Array.isArray(klines)) {
    const raw = klines.slice(-100).map((k: any) => ({
      time: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
      low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]),
    }));
    // Reverse so candles[0] = most recent
    candles = raw.reverse();
  }

  return { depth: depthAnalysis, tradeFlow, ticker: tickerAnalysis, candles };
}

async function fetchCryptoEdge(symbol: string): Promise<any> {
  const [indicatorsRes, crowdingRes, signalsRes] = await Promise.allSettled([
    cachedFetch(CRYPTOEDGE_HOST, CRYPTOEDGE_KEY, `/v1/indicators/${symbol}`, 60_000),
    cachedFetch(CRYPTOEDGE_HOST, CRYPTOEDGE_KEY, `/v1/indicators/${symbol}/crowding_score?hours=24`, 60_000),
    cachedFetch(CRYPTOEDGE_HOST, CRYPTOEDGE_KEY, `/v1/signals/${symbol}`, 30_000),
  ]);

  const indicators = indicatorsRes.status === "fulfilled" ? indicatorsRes.value : null;
  const crowdingRaw = crowdingRes.status === "fulfilled" ? crowdingRes.value : null;
  const signals = signalsRes.status === "fulfilled" ? signalsRes.value : null;

  // Parse crowding
  let crowding = null;
  if (crowdingRaw) {
    const score = crowdingRaw.crowding_score ?? crowdingRaw.score ?? crowdingRaw.value ?? null;
    const direction = crowdingRaw.direction || crowdingRaw.side || "neutral";
    if (score !== null) {
      crowding = { score, direction, isExtreme: score >= 70, contrarian: score >= 70 ? (direction.toString().toLowerCase().includes("long") ? "SELL" : "BUY") : null };
    }
  }

  // Parse signals
  let signal = null;
  if (signals) {
    const arr = Array.isArray(signals) ? signals : [signals];
    if (arr.length > 0) {
      const latest = arr[0];
      signal = {
        direction: (latest.signal || latest.action || latest.type || "UNKNOWN").toString().toUpperCase().includes("BUY") ? "BUY" : "SELL",
        confidence: latest.confidence || latest.score || null,
        reasoning: latest.reasoning || latest.reason || "",
      };
    }
  }

  // v4.0 NEW: Parse CryptoEdge TA indicators
  let taIndicators: { rsi?: number; macd?: number; macdSignal?: number; macdHist?: number; ema20?: number; sma50?: number } | null = null;
  if (indicators) {
    const i = indicators;
    taIndicators = {};
    if (typeof i.rsi === "number") taIndicators.rsi = i.rsi;
    else if (i.rsi?.value) taIndicators.rsi = i.rsi.value;
    if (i.macd) {
      if (typeof i.macd === "number") taIndicators.macd = i.macd;
      else if (i.macd.macdLine || i.macd.value) taIndicators.macd = i.macd.macdLine || i.macd.value;
      if (i.macd.signalLine || i.macd.signal) taIndicators.macdSignal = i.macd.signalLine || i.macd.signal;
      if (i.macd.histogram || i.macd.macdHistogram) taIndicators.macdHist = i.macd.histogram || i.macd.macdHistogram;
    }
    if (typeof i.ema20 === "number" || i.ema20?.value) taIndicators.ema20 = typeof i.ema20 === "number" ? i.ema20 : i.ema20.value;
    if (typeof i.sma50 === "number" || i.sma50?.value) taIndicators.sma50 = typeof i.sma50 === "number" ? i.sma50 : i.sma50.value;
    if (Object.keys(taIndicators).length === 0) taIndicators = null;
  }

  return { indicators, crowding, signal, taIndicators };
}

async function fetchFearGreed(): Promise<{ value: number; label: string } | null> {
  const data = await cachedFetch(SELFTRADE_HOST, SELFTRADE_KEY, "/rapidapi/fear-greed", 60_000);
  if (data && typeof data.value === "number") return { value: data.value, label: data.label || "Neutral" };
  return null;
}

// v5.0 NEW: TradingView Technical Analysis for crypto
async function fetchTradingViewTA(symbol: string): Promise<{buy?: number; sell?: number; neutral?: number; signal?: string; ma?: any; oscillators?: any} | null> {
  if (!TV_KEY) return null;
  try {
    const tvSymbol = `BINANCE:${symbol}`;
    const res = await fetch(`https://${TV_HOST}/technicals?symbol=${encodeURIComponent(tvSymbol)}&interval=15min`, {
      headers: { "x-rapidapi-key": TV_KEY, "x-rapidapi-host": TV_HOST },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.detail?.error || data?.messages) return null;
    const tech: any = {};
    if (data.summary) {
      tech.buy = data.summary.buy || 0;
      tech.sell = data.summary.sell || 0;
      tech.neutral = data.summary.neutral || 0;
      tech.signal = data.summary.recommendation || "";
    }
    if (data.technicals?.oscillators || data.oscillators) tech.oscillators = data.technicals?.oscillators || data.oscillators;
    if (data.technicals?.ma || data.ma) tech.ma = data.technicals?.ma || data.ma;
    if (tech.buy !== undefined || tech.signal) return tech;
    return null;
  } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════
   FUSION SCORING — 8-LAYER ENGINE v5.0
   ═══════════════════════════════════════════════════════════ */

function scoreCryptoSignal(
  pair: string,
  extSignal: any,
  binance: any,
  cryptoEdge: any,
  fearGreed: { value: number; label: string } | null,
  tvData: {buy?: number; sell?: number; neutral?: number; signal?: string; ma?: any; oscillators?: any} | null,
): FusionSignal | null {
  const reasons: string[] = [];
  const sources: string[] = [];
  const layers: FusionSignal["layers"] = [];
  let buyScore = 0, sellScore = 0;
  let sourceCount = 0;
  const taInd: Record<string, string | number> = {}; // TA indicator values for output

  const price = binance?.ticker?.price || extSignal?.current_price || 0;
  if (price === 0) return null;

  const candles = binance?.candles || [];
  const hasCandles = candles.length >= 20;

  // ═══ LAYER 1: SelfTrade External Signal (20%) ═══
  let layer1Score = 0;
  const layer1Details: string[] = [];

  if (extSignal) {
    sourceCount++;
    sources.push("SelfTrade-Signal");

    const extDir = (extSignal.action || extSignal.signal_type || extSignal.type || "").toString().toUpperCase();
    const isBuy = extDir.includes("BUY") || extDir.includes("LONG");

    if (isBuy) buyScore += 5; else sellScore += 5;
    layer1Score = 5;

    if (extSignal.confidence || extSignal.signal_score) {
      const conf = extSignal.confidence || extSignal.signal_score;
      if (conf > 70) { layer1Score += 3; layer1Details.push(`High confidence (${conf})`); }
      else if (conf > 50) { layer1Score += 1.5; }
    }
    layer1Details.push(`External: ${isBuy ? "BUY" : "SELL"}`);
  }
  layers.push({ layer: "External Signal", score: layer1Score, details: layer1Details });

  // ═══ LAYER 2: Binance Order Flow (25%) ═══
  let layer2Score = 0;
  const layer2Details: string[] = [];
  let orderFlowScore = 50;

  if (binance?.depth || binance?.tradeFlow || binance?.ticker) {
    sourceCount++;
    sources.push("Binance-OrderFlow");

    // Depth imbalance
    if (binance.depth) {
      const imb = binance.depth.imbalance;
      orderFlowScore += imb * 0.3;
      if (Math.abs(imb) > 10) {
        if (imb > 0) { buyScore += 3; layer2Details.push(`Depth buy wall (${binance.depth.bidRatio.toFixed(0)}% bid)`); }
        else { sellScore += 3; layer2Details.push(`Depth sell wall (${(100 - binance.depth.bidRatio).toFixed(0)}% ask)`); }
        layer2Score += 3;
      }
    }

    // Trade flow
    if (binance.tradeFlow) {
      const flowBias = binance.tradeFlow.buyRatio - 50;
      orderFlowScore += flowBias * 0.3;
      if (Math.abs(flowBias) > 15) {
        if (flowBias > 0) { buyScore += 3; layer2Details.push(`Bullish trade flow (${binance.tradeFlow.buyRatio.toFixed(0)}% buys)`); }
        else { sellScore += 3; layer2Details.push(`Bearish trade flow (${binance.tradeFlow.buyRatio.toFixed(0)}% sells)`); }
        layer2Score += 3;
      }
    }

    // Price momentum
    if (binance.ticker) {
      const mom = Math.max(-25, Math.min(25, binance.ticker.changePct * 2));
      orderFlowScore += mom * 0.2;
      if (Math.abs(binance.ticker.changePct) > 1) {
        if (binance.ticker.changePct > 0) { buyScore += 2; layer2Details.push(`Price up ${binance.ticker.changePct.toFixed(2)}%`); }
        else { sellScore += 2; layer2Details.push(`Price down ${Math.abs(binance.ticker.changePct).toFixed(2)}%`); }
        layer2Score += 2;
      }

      // Range position
      if (binance.ticker.rangePosition > 0.85) { sellScore += 1; layer2Details.push("Near daily high (overextended)"); }
      else if (binance.ticker.rangePosition < 0.15) { buyScore += 1; layer2Details.push("Near daily low (oversold)"); }
    }

    orderFlowScore = Math.max(0, Math.min(100, Math.round(orderFlowScore)));
  }
  layers.push({ layer: "Order Flow", score: layer2Score, details: layer2Details });

  // ═══ LAYER 3: CryptoEdge Sentiment + Indicators (15%) ═══
  let layer3Score = 0;
  const layer3Details: string[] = [];
  let crowdingScore: number | null = null;

  if (cryptoEdge?.crowding || cryptoEdge?.signal || cryptoEdge?.indicators || cryptoEdge?.taIndicators) {
    sourceCount++;
    sources.push("CryptoEdge");

    // Crowding — contrarian signal
    if (cryptoEdge.crowding) {
      crowdingScore = cryptoEdge.crowding.score;
      if (cryptoEdge.crowding.isExtreme) {
        if (cryptoEdge.crowding.contrarian === "SELL") {
          sellScore += 4; layer3Details.push(`EXTREME long crowding (${crowdingScore}) — contrarian SELL`);
        } else {
          buyScore += 4; layer3Details.push(`EXTREME short crowding (${crowdingScore}) — contrarian BUY`);
        }
        layer3Score += 4;
      }
    }

    // CryptoEdge signal
    if (cryptoEdge.signal) {
      if (cryptoEdge.signal.direction === "BUY") { buyScore += 2; layer3Details.push("CryptoEdge signal: BUY"); }
      else { sellScore += 2; layer3Details.push("CryptoEdge signal: SELL"); }
      layer3Score += 2;
    }

    // v4.0 NEW: CryptoEdge TA indicators
    const ceTA = cryptoEdge.taIndicators;
    if (ceTA) {
      if (ceTA.rsi !== undefined) {
        if (ceTA.rsi < 30) { buyScore += 2; layer3Details.push(`CryptoEdge RSI oversold (${ceTA.rsi})`); layer3Score += 2; }
        else if (ceTA.rsi > 70) { sellScore += 2; layer3Details.push(`CryptoEdge RSI overbought (${ceTA.rsi})`); layer3Score += 2; }
      }
      if (ceTA.macd !== undefined && ceTA.macdSignal !== undefined) {
        if (ceTA.macd > ceTA.macdSignal) { buyScore += 1.5; layer3Details.push("CryptoEdge MACD bullish"); }
        else { sellScore += 1.5; layer3Details.push("CryptoEdge MACD bearish"); }
        layer3Score += 1.5;
      }
    }
  }
  layers.push({ layer: "Sentiment+CE-TA", score: layer3Score, details: layer3Details });

  // ═══ LAYER 4: Fear & Greed (5%) ═══
  let layer4Score = 0;
  const layer4Details: string[] = [];

  if (fearGreed) {
    sourceCount++;
    sources.push("FearGreed");

    if (fearGreed.value <= 20) {
      buyScore += 3; layer4Details.push(`Extreme Fear (${fearGreed.value}) — contrarian BUY`);
      layer4Score += 3;
    } else if (fearGreed.value <= 35) {
      buyScore += 1.5; layer4Details.push(`Fear (${fearGreed.value}) — slight BUY bias`);
      layer4Score += 1.5;
    } else if (fearGreed.value >= 80) {
      sellScore += 3; layer4Details.push(`Extreme Greed (${fearGreed.value}) — contrarian SELL`);
      layer4Score += 3;
    } else if (fearGreed.value >= 65) {
      sellScore += 1.5; layer4Details.push(`Greed (${fearGreed.value}) — slight SELL bias`);
      layer4Score += 1.5;
    }
  }
  layers.push({ layer: "Fear & Greed", score: layer4Score, details: layer4Details });

  // ═══ LAYER 5: Price Action from Candles (10%) ═══
  let layer5Score = 0;
  const layer5Details: string[] = [];

  if (hasCandles) {
    sourceCount++;
    sources.push("PriceAction");
    const c0 = candles[0], c1 = candles[1], c2 = candles[2];

    // Candlestick patterns
    if (c1.close < c1.open && c0.close > c0.open && c0.close > c1.open && c0.open < c1.close) {
      buyScore += 3; layer5Details.push("Bullish engulfing"); layer5Score += 3;
    } else if (c1.close > c1.open && c0.close < c0.open && c0.close < c1.open && c0.open > c1.close) {
      sellScore += 3; layer5Details.push("Bearish engulfing"); layer5Score += 3;
    }

    // Hammer / Shooting star
    const body = Math.abs(c0.close - c0.open), range = c0.high - c0.low;
    if (range > 0) {
      const lw = Math.min(c0.open, c0.close) - c0.low;
      const uw = c0.high - Math.max(c0.open, c0.close);
      if (lw > body * 2.5 && uw < body * 0.3) { buyScore += 2.5; layer5Details.push("Hammer"); layer5Score += 2.5; }
      else if (uw > body * 2.5 && lw < body * 0.3) { sellScore += 2.5; layer5Details.push("Shooting star"); layer5Score += 2.5; }
      // Strong body candles
      if (c0.close > c0.open && body / range > 0.65) { buyScore += 1.5; layer5Details.push("Strong bullish candle"); layer5Score += 1.5; }
      else if (c0.open > c0.close && body / range > 0.65) { sellScore += 1.5; layer5Details.push("Strong bearish candle"); layer5Score += 1.5; }
      if (body / range < 0.1) layer5Details.push("Doji (indecision)");
    }

    // 3-candle momentum
    if (c2 && c1 && c0) {
      if (c0.close > c1.close && c1.close > c2.close) {
        buyScore += 2; layer5Details.push("3-candle bullish momentum"); layer5Score += 2;
      } else if (c0.close < c1.close && c1.close < c2.close) {
        sellScore += 2; layer5Details.push("3-candle bearish momentum"); layer5Score += 2;
      }
      // Morning/evening star
      if (c2.close < c2.open && c1.close < c1.open && c0.close > c0.open && c0.close > c1.open) {
        buyScore += 2.5; layer5Details.push("Morning star pattern"); layer5Score += 2.5;
      } else if (c2.close > c2.open && c1.close > c1.open && c0.close < c0.open && c0.close < c1.open) {
        sellScore += 2.5; layer5Details.push("Evening star pattern"); layer5Score += 2.5;
      }
    }

    // Volume spike + volume trend
    const avgVol = candles.slice(0, 20).reduce((a: number, c: any) => a + (c.volume || 0), 0) / 20;
    if (c0.volume > avgVol * 2) {
      layer5Details.push("Volume spike detected");
      if (c0.close > c0.open) { buyScore += 1.5; } else { sellScore += 1.5; }
      layer5Score += 1.5;
    }

    // v4.0: Volume trend — rising volume with price = confirmation
    const volShort = candles.slice(0, 5).reduce((a: number, c: any) => a + (c.volume || 0), 0) / 5;
    const volLong = candles.slice(5, 20).reduce((a: number, c: any) => a + (c.volume || 0), 0) / 15;
    if (volLong > 0) {
      const volTrend = volShort / volLong;
      if (volTrend > 1.3 && c0.close > c1.close) { buyScore += 1.5; layer5Details.push("Rising volume + price up (bullish vol trend)"); layer5Score += 1.5; }
      else if (volTrend > 1.3 && c0.close < c1.close) { sellScore += 1.5; layer5Details.push("Rising volume + price down (bearish vol trend)"); layer5Score += 1.5; }
    }
  }
  layers.push({ layer: "Price Action", score: layer5Score, details: layer5Details });

  // ═══════════════════════════════════════════════════════
  // LAYER 6: LOCAL TECHNICAL ANALYSIS (25%) — v4.0 NEW
  // RSI, MACD, EMA, Bollinger, Stochastic, ATR, S/R, Divergence
  // ═══════════════════════════════════════════════════════
  let layer6Score = 0;
  const layer6Details: string[] = [];
  let localATR = 0;
  let taBuyCount = 0, taSellCount = 0;

  if (hasCandles) {
    sourceCount++;
    sources.push("Local-TA");
    const closes = candles.map(c => c.close);

    // ── RSI ──
    const localRSI = calcRSI(candles, 14);
    taInd.RSI = localRSI;
    if (localRSI < 30) { buyScore += 3; taBuyCount++; layer6Details.push(`RSI oversold (${localRSI})`); }
    else if (localRSI < 40) { buyScore += 1; taBuyCount++; }
    else if (localRSI > 70) { sellScore += 3; taSellCount++; layer6Details.push(`RSI overbought (${localRSI})`); }
    else if (localRSI > 60) { sellScore += 1; taSellCount++; }

    // ── MACD ──
    const localMACD = calcMACD(candles);
    if (localMACD) {
      taInd.MACD = localMACD.macd.toFixed(price > 100 ? 2 : 6);
      taInd.MACD_Hist = localMACD.histogram.toFixed(price > 100 ? 2 : 6);
      if (localMACD.histogram > 0 && localMACD.macd > localMACD.signal) {
        buyScore += 2.5; taBuyCount++; layer6Details.push("MACD bullish crossover");
      } else if (localMACD.histogram < 0 && localMACD.macd < localMACD.signal) {
        sellScore += 2.5; taSellCount++; layer6Details.push("MACD bearish crossover");
      }
      // Zero line cross
      if (localMACD.macd > 0 && localMACD.signal < 0) { buyScore += 2; taBuyCount++; layer6Details.push("MACD bullish zero cross"); }
      else if (localMACD.macd < 0 && localMACD.signal > 0) { sellScore += 2; taSellCount++; layer6Details.push("MACD bearish zero cross"); }
    }

    // ── EMA Alignment ──
    const ema9 = calcEMA(closes, 9), ema20 = calcEMA(closes, 20);
    const ema50 = closes.length >= 50 ? calcEMA(closes, 50) : calcEMA(closes, Math.min(50, closes.length));
    taInd.EMA9 = ema9.toFixed(price > 100 ? 2 : 6);
    taInd.EMA20 = ema20.toFixed(price > 100 ? 2 : 6);

    if (ema9 > ema20 && ema20 > ema50) {
      buyScore += 3; taBuyCount++; layer6Details.push("EMA 9>20>50 bullish alignment");
    } else if (ema9 < ema20 && ema20 < ema50) {
      sellScore += 3; taSellCount++; layer6Details.push("EMA 9<20<50 bearish alignment");
    }
    // EMA crossover
    const prevEma9 = calcEMA(closes.slice(1), 9), prevEma20 = calcEMA(closes.slice(1), 20);
    if (prevEma9 <= prevEma20 && ema9 > ema20) { buyScore += 2.5; taBuyCount++; layer6Details.push("EMA 9/20 bullish cross"); }
    else if (prevEma9 >= prevEma20 && ema9 < ema20) { sellScore += 2.5; taSellCount++; layer6Details.push("EMA 9/20 bearish cross"); }
    // Price vs EMA
    if (price > ema9 && price > ema20) { buyScore += 1; taBuyCount++; }
    else if (price < ema9 && price < ema20) { sellScore += 1; taSellCount++; }

    // ── Bollinger Bands ──
    const bb = calcBollinger(candles, 20, 2);
    if (bb) {
      taInd.BB_Upper = bb.upper.toFixed(price > 100 ? 2 : 6);
      taInd.BB_Lower = bb.lower.toFixed(price > 100 ? 2 : 6);
      taInd.BB_Width = bb.width.toFixed(4);
      if (price <= bb.lower * 1.002) { buyScore += 2.5; taBuyCount++; layer6Details.push("Price at BB lower (bounce zone)"); }
      else if (price >= bb.upper * 0.998) { sellScore += 2.5; taSellCount++; layer6Details.push("Price at BB upper (rejection zone)"); }
      // BB squeeze
      if (bb.width < 0.015) layer6Details.push("BB SQUEEZE — breakout coming");
    }

    // ── Stochastic ──
    const stoch = calcStochastic(candles, 14, 3);
    if (stoch) {
      taInd.StochK = stoch.k;
      taInd.StochD = stoch.d;
      if (stoch.k < 20 && stoch.d < 20) { buyScore += 2; taBuyCount++; layer6Details.push(`Stoch oversold (K:${stoch.k.toFixed(0)})`); }
      else if (stoch.k > 80 && stoch.d > 80) { sellScore += 2; taSellCount++; layer6Details.push(`Stoch overbought (K:${stoch.k.toFixed(0)})`); }
      // Stoch crossover
      if (stoch.k > stoch.d && stoch.k < 30) { buyScore += 1.5; taBuyCount++; layer6Details.push("Stoch bullish cross in oversold"); }
      else if (stoch.k < stoch.d && stoch.k > 70) { sellScore += 1.5; taSellCount++; layer6Details.push("Stoch bearish cross in overbought"); }
    }

    // ── ATR ──
    localATR = calcATR(candles, 14);
    if (localATR > 0) taInd.ATR = localATR.toFixed(price > 100 ? 2 : 6);

    // ── Support / Resistance ──
    const sr = findSR(candles, price);
    taInd.Support = sr.support.toFixed(price > 100 ? 2 : 6);
    taInd.Resistance = sr.resistance.toFixed(price > 100 ? 2 : 6);
    if (sr.near === "support") { buyScore += 2; taBuyCount++; layer6Details.push("Price near support (bounce zone)"); }
    else if (sr.near === "resistance") { sellScore += 2; taSellCount++; layer6Details.push("Price near resistance (rejection zone)"); }

    // ── RSI Divergence ──
    const rsiDiv = detectRSIDivergence(candles, localRSI);
    if (rsiDiv.type) {
      layer6Details.push(rsiDiv.reason);
      if (rsiDiv.type === "bullish") { buyScore += 4; taBuyCount++; }
      else { sellScore += 4; taSellCount++; }
    }

    // ── MACD Divergence ──
    if (localMACD) {
      const macdDiv = detectMACDDivergence(candles, localMACD.histogram);
      if (macdDiv.type) {
        layer6Details.push(macdDiv.reason);
        if (macdDiv.type === "bullish") { buyScore += 3; taBuyCount++; }
        else { sellScore += 3; taSellCount++; }
      }
    }

    // ── Super confluence bonus ──
    if (taBuyCount >= 7) { buyScore += 4; layer6Details.push(`SUPER TA confluence ${taBuyCount}+ bullish`); }
    else if (taBuyCount >= 5) { buyScore += 2; layer6Details.push(`Strong TA confluence ${taBuyCount} bullish`); }
    if (taSellCount >= 7) { sellScore += 4; layer6Details.push(`SUPER TA confluence ${taSellCount}+ bearish`); }
    else if (taSellCount >= 5) { sellScore += 2; layer6Details.push(`Strong TA confluence ${taSellCount} bearish`); }

    layer6Score = Math.max(buyScore, sellScore) - 5;
  }
  layers.push({ layer: "Local TA", score: layer6Score, details: layer6Details });

  // ═══════════════════════════════════════════
  // LAYER 7: TRADINGVIEW TECHNICAL ANALYSIS (v5.0 NEW)
  // ═══════════════════════════════════════════
  let layer7Score = 0;
  const layer7Details: string[] = [];

  if (tvData) {
    sourceCount++;
    sources.push("TradingView-TA");

    const tvRec = (tvData.signal || "").toString().toLowerCase();
    if (tvRec.includes("strong_buy") || tvRec.includes("strong buy")) {
      buyScore += 5; layer7Score += 5; layer7Details.push("TradingView: STRONG BUY");
    } else if (tvRec.includes("buy")) {
      buyScore += 3; layer7Score += 3; layer7Details.push("TradingView: BUY");
    } else if (tvRec.includes("strong_sell") || tvRec.includes("strong sell")) {
      sellScore += 5; layer7Score += 5; layer7Details.push("TradingView: STRONG SELL");
    } else if (tvRec.includes("sell")) {
      sellScore += 3; layer7Score += 3; layer7Details.push("TradingView: SELL");
    } else {
      layer7Details.push(`TradingView: ${tvRec || "neutral"}`);
    }

    if (tvData.buy !== undefined && tvData.sell !== undefined) {
      const tvTotal = (tvData.buy || 0) + (tvData.sell || 0) + (tvData.neutral || 0);
      const buyPct = tvTotal > 0 ? (tvData.buy / tvTotal) * 100 : 50;
      const sellPct = tvTotal > 0 ? (tvData.sell / tvTotal) * 100 : 50;
      if (buyPct > 70) { buyScore += 2; layer7Score += 2; layer7Details.push(`TV ${buyPct.toFixed(0)}% indicators bullish`); }
      else if (sellPct > 70) { sellScore += 2; layer7Score += 2; layer7Details.push(`TV ${sellPct.toFixed(0)}% indicators bearish`); }
    }

    const maRec = tvData.ma?.recommendation?.toString().toLowerCase() || "";
    const oscRec = tvData.oscillators?.recommendation?.toString().toLowerCase() || "";
    if (maRec.includes("buy") && oscRec.includes("buy")) { buyScore += 1.5; layer7Score += 1.5; layer7Details.push("TV MA+Oscillators both BUY"); }
    else if (maRec.includes("sell") && oscRec.includes("sell")) { sellScore += 1.5; layer7Score += 1.5; layer7Details.push("TV MA+Oscillators both SELL"); }
    else if ((maRec.includes("buy") && oscRec.includes("sell")) || (maRec.includes("sell") && oscRec.includes("buy"))) {
      layer7Details.push("TV MA/Oscillators CONFLICT (reduced weight)");
    }
  }
  layers.push({ layer: "TradingView TA", score: layer7Score, details: layer7Details });

  // ═══ FINAL SCORING ═══
  const total = buyScore + sellScore;
  const win = Math.max(buyScore, sellScore);
  const allReasons = [...layer1Details, ...layer2Details, ...layer3Details, ...layer4Details, ...layer5Details, ...layer6Details, ...layer7Details];
  const type: "BUY" | "SELL" = buyScore > sellScore ? "BUY" : "SELL";

  // ═══ STRICT FILTERS ═══
  // Filter 1: Need at least 6 data sources (v5.0: was 5)
  const makeFiltered = (reason: string): FusionSignal =>
    ({ pair, type: "BUY" as const, entry: price, tp: 0, sl: 0, confidence: 0, confluences: allReasons.length, reasoning: allReasons, sources, layers, orderFlowScore: binance ? orderFlowScore : null, fearGreed: fearGreed?.value ?? null, crowdingScore, taIndicators: taInd, filtered: true, filterReason: reason });

  if (sourceCount < 5) return makeFiltered(`Only ${sourceCount} sources (need 5+)`);

  // Filter 2: Minimum confluences (v5.0: 10 was 8)
  if (allReasons.length < 10) return makeFiltered(`Only ${allReasons.length} confluences (need 10+)`);

  // Filter 3: Dominance ratio — v4.0 STRICTER (70% was 65%)
  if (total > 0 && win / total < 0.70) return makeFiltered(`Low dominance (${(win / total * 100).toFixed(0)}%)`);

  // Confidence calculation — v4.0 improved
  const rawConf = total > 0 ? (win / total) * 100 : 50;
  const sourceBonus = sourceCount >= 6 ? 7 : sourceCount >= 5 ? 5 : sourceCount >= 4 ? 3 : 0;
  const confluenceBonus = allReasons.length >= 10 ? 7 : allReasons.length >= 8 ? 5 : allReasons.length >= 5 ? 3 : 0;
  const taBonus = hasCandles && (taBuyCount + taSellCount) >= 5 ? 4 : hasCandles ? 2 : 0;
  const divBonus = layer6Details.some(d => d.includes("divergence")) ? 3 : 0;
  const confidence = Math.min(Math.round(rawConf + sourceBonus + confluenceBonus + taBonus + divBonus), 97);

  // Filter 4: Minimum confidence (v4.0: 78% was 70%)
  if (confidence < 78) return makeFiltered(`Low confidence (${confidence}%)`);

  // Filter 5: RSI sanity — don't trade against extreme RSI
  const rsiVal = taInd.RSI as number | undefined;
  if (rsiVal !== undefined) {
    if (type === "BUY" && rsiVal > 75) return makeFiltered(`RSI ${rsiVal} overbought — no BUY`);
    if (type === "SELL" && rsiVal < 25) return makeFiltered(`RSI ${rsiVal} oversold — no SELL`);
  }

  // Filter 6: Don't chase pumps/dumps
  if (binance?.ticker) {
    const chg = binance.ticker.changePct;
    if (type === "BUY" && chg > 8) return makeFiltered(`Chasing +${chg.toFixed(1)}% pump`);
    if (type === "SELL" && chg < -8) return makeFiltered(`Chasing ${chg.toFixed(1)}% dump`);
  }

  // Filter 7: Divergence kills counter-signal
  if (rsiVal !== undefined && type === "BUY" && layer6Details.some(d => d.includes("bearish divergence"))) {
    return makeFiltered("RSI bearish divergence against BUY");
  }
  if (rsiVal !== undefined && type === "SELL" && layer6Details.some(d => d.includes("bullish divergence"))) {
    return makeFiltered("RSI bullish divergence against SELL");
  }

  // Filter 8: All sources agree → need even higher confidence
  if (sourceCount >= 7 && confidence < 82) return makeFiltered(`7+ sources but only ${confidence}% (need 82%)`);

  // v5.0 NEW Filter 9: TradingView strongly against signal
  if (tvData) {
    const tvRec = (tvData.signal || "").toString().toLowerCase();
    if (type === "BUY" && (tvRec.includes("strong_sell") || tvRec.includes("strong sell"))) {
      return makeFiltered(`TradingView STRONG SELL against BUY signal`);
    }
    if (type === "SELL" && (tvRec.includes("strong_buy") || tvRec.includes("strong buy"))) {
      return makeFiltered(`TradingView STRONG BUY against SELL signal`);
    }
  }

  // ═══ TP/SL CALCULATION — v4.0: ATR-based ═══
  let tp: number, sl: number;
  const extTP = parseFloat(extSignal?.tp_price || extSignal?.take_profit || 0);
  const extSL = parseFloat(extSignal?.sl_price || extSignal?.stop_loss || 0);

  // Use real ATR if available, otherwise estimate from volatility
  const atr = localATR > 0 ? localATR : price * ((binance?.ticker?.volatility || 2) / 100) * 0.15;

  if (extTP > 0 && extSL > 0) {
    const extRR = Math.abs(extTP - price) / Math.abs(price - extSL);
    if (extRR >= 2.0) {
      tp = extTP; sl = extSL;
    } else {
      // v4.0: ATR-based TP/SL with 2.5:1 minimum R:R
      if (type === "BUY") { tp = price + atr * 2.5; sl = price - atr * 0.5; }
      else { tp = price - atr * 2.5; sl = price + atr * 0.5; }
    }
  } else {
    // v4.0: ATR-based (proper calculation, not rough estimate)
    if (type === "BUY") { tp = price + atr * 2.5; sl = price - atr * 0.5; }
    else { tp = price - atr * 2.5; sl = price + atr * 0.5; }
  }

  // Confidence bonus for strong setups (v5.0: 7+ sources)
  const finalConf = sourceCount >= 7 ? Math.min(confidence + 4, 97) : sourceCount >= 6 ? Math.min(confidence + 2, 97) : confidence;

  return {
    pair, type,
    entry: +price.toFixed(price > 100 ? 2 : 8),
    tp: +tp.toFixed(price > 100 ? 2 : 8),
    sl: +sl.toFixed(price > 100 ? 2 : 8),
    confidence: finalConf,
    confluences: allReasons.length,
    reasoning: allReasons,
    sources,
    layers,
    orderFlowScore: binance ? orderFlowScore : null,
    fearGreed: fearGreed?.value ?? null,
    crowdingScore,
    taIndicators: taInd,
    filtered: false,
  };
}

/* ═══════════════════════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════════════════════ */

// Cache for fusion results
let cachedFusion: { data: any; time: number } | null = null;
const FUSION_TTL = 30_000; // 30s cache

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const pair = searchParams.get("pair");

  // Single pair request (original behavior for backward compat)
  if (pair && !action) {
    try {
      const data = await cachedFetch(SELFTRADE_HOST, SELFTRADE_KEY, `/rapidapi/signal?pair=${pair.toUpperCase()}`, 30_000);
      if (!data) return NextResponse.json({ error: "No data" }, { status: 404 });
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json({ error: "Failed to fetch signal" }, { status: 500 });
    }
  }

  // Legacy: all raw SelfTrade signals
  if (action === "all") {
    try {
      const pairsRes = await cachedFetch(SELFTRADE_HOST, SELFTRADE_KEY, "/rapidapi/pairs", 5 * 60_000);
      const pairs: string[] = pairsRes?.pairs || [];
      const signals: any[] = [];
      for (let i = 0; i < pairs.length; i += 3) {
        const batch = pairs.slice(i, i + 3);
        const results = await Promise.allSettled(
          batch.map(p => cachedFetch(SELFTRADE_HOST, SELFTRADE_KEY, `/rapidapi/signal?pair=${p}`, 30_000))
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

  // ═══ FUSION SCAN — 8-layer engine v5.0 ═══
  if (action === "fusion" || action === "scan") {
    // Return cached if fresh
    if (cachedFusion && Date.now() - cachedFusion.time < FUSION_TTL) {
      return NextResponse.json({ ...cachedFusion.data, cached: true });
    }

    const engineLog: string[] = [];
    const signals: FusionSignal[] = [];
    const filtered: { pair: string; reason: string }[] = [];

    // Fetch Fear & Greed once (shared across all pairs)
    engineLog.push("Fetching Fear & Greed Index...");
    const fearGreed = await fetchFearGreed();
    if (fearGreed) engineLog.push(`  Fear & Greed: ${fearGreed.value} (${fearGreed.label})`);

    // Scan each pair
    for (let i = 0; i < CRYPTO_PAIRS.length; i++) {
      const symbol = CRYPTO_PAIRS[i];
      const coin = symbol.replace("USDT", "");

      engineLog.push(`Scanning ${symbol}...`);

      try {
        const [extSignal, binance, cryptoEdge, tvData] = await Promise.allSettled([
          fetchSelfTradeSignal(symbol),
          fetchBinanceFlow(symbol),
          fetchCryptoEdge(coin),
          fetchTradingViewTA(symbol),
        ]);

        const ext = extSignal.status === "fulfilled" ? extSignal.value : null;
        const bn = binance.status === "fulfilled" ? binance.value : null;
        const ce = cryptoEdge.status === "fulfilled" ? cryptoEdge.value : null;
        const tv = tvData.status === "fulfilled" ? tvData.value : null;

        const result = scoreCryptoSignal(symbol, ext, bn, ce, fearGreed, tv);

        if (result) {
          if (result.filtered) {
            filtered.push({ pair: symbol, reason: result.filterReason || "Unknown" });
            engineLog.push(`  ${symbol}: FILTERED — ${result.filterReason}`);
          } else {
            signals.push(result);
            engineLog.push(`  ${symbol}: ${result.type} @ ${result.confidence}% (${result.confluences} confluences, ${result.sources.length} sources)`);
          }
        } else {
          filtered.push({ pair: symbol, reason: "No price data" });
          engineLog.push(`  ${symbol}: SKIP (no price data)`);
        }
      } catch (err: any) {
        filtered.push({ pair: symbol, reason: err.message });
        engineLog.push(`  ${symbol}: ERROR ${err.message}`);
      }

      // Small delay to avoid rate limits
      if (i < CRYPTO_PAIRS.length - 1) await new Promise(r => setTimeout(r, 200));
    }

    // Sort by confidence, take TOP 1
    signals.sort((a, b) => b.confidence - a.confidence || b.confluences - a.confluences);
    const topSignals = signals.slice(0, 1);

    engineLog.push(`\nResult: ${topSignals.length} signal from ${CRYPTO_PAIRS.length} pairs (${filtered.length} filtered)`);

    const result = {
      source: "CryptoFusion-v5.0",
      signals: topSignals,
      generated: topSignals.length,
      totalChecked: CRYPTO_PAIRS.length,
      filtered,
      fearGreed,
      engineVersion: "v5.0-SHARPSHOOTER",
      engineLog,
      timestamp: new Date().toISOString(),
      engineNotes: "8-layer fusion: SelfTrade + Binance OrderFlow + CryptoEdge(TA) + FearGreed + PriceAction + Local-TA(RSI/MACD/EMA/BB/Stoch/ATR/SR/Div) + TradingView-TA + TV-Conflict-Filter | TOP 1 | Stricter filters",
    };

    cachedFusion = { data: result, time: Date.now() };
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Use ?action=fusion for multi-source signals, ?pair=BTCUSDT for single, or ?action=all for raw" }, { status: 400 });
}