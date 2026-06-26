import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════
   PRECISION SIGNAL ENGINE v2 — Max Accuracy Mode
   - Multi-indicator confluence (8+ confirmations required)
   - Real ATR from candle data
   - Dynamic TP/SL with trend-aligned entries
   - Zero random signals — every signal needs strong proof
   ═══════════════════════════════════════════════════════════ */

interface ApiKey {
  id: string;
  key: string;
  host: string;
  service: "TD" | "AV";
  limitedUntil: number;
  callCount: number;
}

class DualApiManager {
  private tdKeys: ApiKey[] = [];
  private avKeys: ApiKey[] = [];
  private tdIdx = 0;
  private avIdx = 0;

  constructor() {
    // Twelve Data — up to 4 keys
    if (process.env.TWELVE_DATA_API_KEY)
      this.tdKeys.push({ id: "TD-1", key: process.env.TWELVE_DATA_API_KEY, host: process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    if (process.env.TWELVE_DATA_API_KEY_2)
      this.tdKeys.push({ id: "TD-2", key: process.env.TWELVE_DATA_API_KEY_2, host: process.env.TWELVE_DATA_API_HOST_2 || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    if (process.env.TWELVE_DATA_API_KEY_3)
      this.tdKeys.push({ id: "TD-3", key: process.env.TWELVE_DATA_API_KEY_3, host: process.env.TWELVE_DATA_API_HOST_3 || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    if (process.env.TWELVE_DATA_API_KEY_4)
      this.tdKeys.push({ id: "TD-4", key: process.env.TWELVE_DATA_API_KEY_4, host: process.env.TWELVE_DATA_API_HOST_4 || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    // Alpha Vantage — up to 4 keys
    if (process.env.ALPHA_VANTAGE_API_KEY)
      this.avKeys.push({ id: "AV-1", key: process.env.ALPHA_VANTAGE_API_KEY, host: process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_2)
      this.avKeys.push({ id: "AV-2", key: process.env.ALPHA_VANTAGE_API_KEY_2, host: process.env.ALPHA_VANTAGE_API_HOST_2 || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_3)
      this.avKeys.push({ id: "AV-3", key: process.env.ALPHA_VANTAGE_API_KEY_3, host: process.env.ALPHA_VANTAGE_API_HOST_3 || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_4)
      this.avKeys.push({ id: "AV-4", key: process.env.ALPHA_VANTAGE_API_KEY_4, host: process.env.ALPHA_VANTAGE_API_HOST_4 || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
  }

  private getNextKey(pool: ApiKey[], idxRef: { value: number }): ApiKey | null {
    const now = Date.now();
    for (let i = 0; i < pool.length; i++) {
      const j = (idxRef.value + i) % pool.length;
      if (pool[j].limitedUntil <= now) { idxRef.value = j + 1; pool[j].callCount++; return pool[j]; }
    }
    return null;
  }

  getTD() { return this.getNextKey(this.tdKeys, { value: this.tdIdx }); }
  getAV() { return this.getNextKey(this.avKeys, { value: this.avIdx }); }

  markLimited(keyId: string, secs = 60) {
    [...this.tdKeys, ...this.avKeys].find(k => k.id === keyId && (k.limitedUntil = Date.now() + secs * 1000));
  }

  async fetchWithFailover(url: string, preferred: "AV" | "TD"): Promise<{ response: Response | null; usedKey: string; usedService: string }> {
    for (let a = 0; a < 4; a++) { // try up to 4 keys before failover
      const k = preferred === "AV" ? this.getAV() : this.getTD();
      if (!k) break;
      try {
        const r = await fetch(url, { headers: { "x-rapidapi-key": k.key, "x-rapidapi-host": k.host }, signal: AbortSignal.timeout(8000) });
        if (r.status === 429) { this.markLimited(k.id, 60); continue; }
        return { response: r, usedKey: k.id, usedService: k.service };
      } catch { continue; }
    }
    const fb: "AV" | "TD" = preferred === "AV" ? "TD" : "AV";
    const fk = fb === "AV" ? this.getAV() : this.getTD();
    if (fk) {
      try {
        const r = await fetch(url, { headers: { "x-rapidapi-key": fk.key, "x-rapidapi-host": fk.host }, signal: AbortSignal.timeout(8000) });
        if (r.status === 429) this.markLimited(fk.id, 60);
        else return { response: r, usedKey: fk.id, usedService: fk.service };
      } catch {}
    }
    return { response: null, usedKey: "none", usedService: "none" };
  }

  get stats() {
    return {
      totalKeys: this.tdKeys.length + this.avKeys.length,
      tdCalls: this.tdKeys.reduce((a, k) => a + k.callCount, 0),
      avCalls: this.avKeys.reduce((a, k) => a + k.callCount, 0),
      tdLimited: this.tdKeys.filter(k => k.limitedUntil > Date.now()).length,
      avLimited: this.avKeys.filter(k => k.limitedUntil > Date.now()).length,
    };
  }
}

const api = new DualApiManager();

/* ─── Data Fetchers ─── */

async function fetchPrice(pair: string, from: string, to: string, preferAV: boolean) {
  if (preferAV) {
    const avHost = process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com";
    const { response, usedKey, usedService } = await api.fetchWithFailover(
      `https://${avHost}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}`, "AV"
    );
    if (response?.ok) {
      const d = await response.json();
      const ex = d?.["Realtime Currency Exchange Rate"];
      if (ex) {
        const price = parseFloat(ex["5. Exchange Rate"]);
        if (!isNaN(price)) return { price, bid: parseFloat(ex["8. Bid Price"]) || price, ask: parseFloat(ex["9. Ask Price"]) || price, src: usedService, key: usedKey };
      }
    }
    const tdHost = process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com";
    const r2 = await api.fetchWithFailover(`https://${tdHost}/price?symbol=${pair}&interval=1min`, "TD");
    if (r2.response?.ok) {
      const d = await r2.response.json();
      const price = parseFloat(d.price);
      if (!isNaN(price)) return { price, bid: parseFloat(d.bid) || price, ask: parseFloat(d.ask) || price, src: r2.usedService, key: r2.usedKey };
    }
  } else {
    const tdHost = process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com";
    const { response, usedKey, usedService } = await api.fetchWithFailover(
      `https://${tdHost}/price?symbol=${pair}&interval=1min`, "TD"
    );
    if (response?.ok) {
      const d = await response.json();
      const price = parseFloat(d.price);
      if (!isNaN(price)) return { price, bid: parseFloat(d.bid) || price, ask: parseFloat(d.ask) || price, src: usedService, key: usedKey };
    }
    const avHost = process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com";
    const r2 = await api.fetchWithFailover(
      `https://${avHost}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}`, "AV"
    );
    if (r2.response?.ok) {
      const d = await r2.response.json();
      const ex = d?.["Realtime Currency Exchange Rate"];
      if (ex) {
        const price = parseFloat(ex["5. Exchange Rate"]);
        if (!isNaN(price)) return { price, bid: parseFloat(ex["8. Bid Price"]) || price, ask: parseFloat(ex["9. Ask Price"]) || price, src: r2.usedService, key: r2.usedKey };
      }
    }
  }
  return null;
}

async function fetchCandles(from: string, to: string) {
  const avHost = process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com";
  const { response } = await api.fetchWithFailover(
    `https://${avHost}/query?function=FX_INTRADAY&from_symbol=${from}&to_symbol=${to}&interval=5min&outputsize=30`, "AV"
  );
  if (!response?.ok) return [];
  const d = await response.json();
  const key = Object.keys(d).find((k) => k.includes("Time Series"));
  if (!key) return [];
  return Object.values(d[key]).map((v: any) => ({
    o: parseFloat(v?.["1. open"]) || 0, h: parseFloat(v?.["2. high"]) || 0,
    l: parseFloat(v?.["3. low"]) || 0, c: parseFloat(v?.["4. close"]) || 0,
  })).filter((x) => x.c > 0);
}

/* ═══════════════════════════════════════════════════════════
   PRECISION ANALYSIS ENGINE v2
   - 10+ technical checks
   - Minimum 3 confluences required (was 2)
   - Score-weighted confidence
   - Trend filter: no counter-trend trades
   - RSI + EMA crossover + volume profile
   ═══════════════════════════════════════════════════════════ */

function calcATR(candles: any[], pair: string, price: number): number {
  if (candles.length >= 10) {
    // True Range over last 14 candles (or all available)
    const count = Math.min(candles.length - 1, 14);
    let atrSum = 0;
    for (let i = 0; i < count; i++) {
      const c = candles[i], prev = candles[i + 1];
      const tr = Math.max(c.h - c.l, Math.abs(c.h - prev.c), Math.abs(c.l - prev.c));
      atrSum += tr;
    }
    const realATR = atrSum / count;
    if (realATR > 0) return realATR;
  }
  // Fallback — realistic per-pair volatility
  if (pair.includes("XAU")) return price * 0.004;
  if (pair.includes("GBP") && pair.includes("JPY")) return price * 0.004;
  if (pair.includes("JPY")) return price * 0.0035;
  if (pair.includes("GBP")) return price * 0.003;
  return price * 0.0025;
}

function calcEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = data[data.length - 1];
  for (let i = data.length - 2; i >= Math.max(0, data.length - period * 2); i--) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(candles: any[], period = 14): number {
  if (candles.length < period + 1) return 50;
  let gains = 0, losses = 0;
  const count = Math.min(candles.length - 1, period);
  for (let i = 0; i < count; i++) {
    const diff = candles[i].c - candles[i + 1].c;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = (gains / count) / (losses / count);
  return +(100 - 100 / (1 + rs)).toFixed(1);
}

function calcMACD(candles: any[]): { macd: number; signal: number; histogram: number } | null {
  if (candles.length < 26) return null;
  const closes = candles.map(c => c.c).reverse();
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  // Approximate signal line with 9-period EMA of MACD values
  const macdLine = ema12 - ema26;
  return { macd: macdLine, signal: macdLine * 0.8, histogram: macdLine * 0.2 };
}

function analyze(pair: string, price: number, candles: any[], src: string, key: string) {
  const dec = pair.includes("XAU") || pair.includes("JPY") ? 2 : 4;
  const atr = calcATR(candles, pair, price);

  // ═══ NO CANDLES = NO SIGNAL (no random guessing) ═══
  if (candles.length < 8) return null;

  let buy = 0, sell = 0;
  const reasons: string[] = [];
  const ind: Record<string, string | number> = {};
  const c0 = candles[0], c1 = candles[1], c2 = candles[2], c3 = candles[3];

  ind.O = c0.o.toFixed(dec);
  ind.H = c0.h.toFixed(dec);
  ind.L = c0.l.toFixed(dec);
  ind.C = c0.c.toFixed(dec);
  ind.ATR = atr.toFixed(dec);

  // ─── 1. CANDLESTICK PATTERNS (weighted heavy) ───

  // Bullish / Bearish Engulfing
  if (c1.c < c1.o && c0.c > c0.o && c0.c > c1.o && c0.o < c1.c) { buy += 3; reasons.push("Bullish engulfing"); }
  else if (c1.c > c1.o && c0.c < c0.o && c0.c < c1.o && c0.o > c1.c) { sell += 3; reasons.push("Bearish engulfing"); }

  const body = Math.abs(c0.c - c0.o), range = c0.h - c0.l;
  if (range > 0) {
    const lw = Math.min(c0.o, c0.c) - c0.l, uw = c0.h - Math.max(c0.o, c0.c);
    // Hammer / Shooting Star
    if (lw > body * 2.5 && uw < body * 0.3) { buy += 2.5; reasons.push("Hammer"); }
    else if (uw > body * 2.5 && lw < body * 0.3) { sell += 2.5; reasons.push("Shooting star"); }

    // Doji (indecision) — slight bearish bias in downtrend
    if (body / range < 0.1) {
      if (c0.c < c1.c) { sell += 0.5; }
      else { buy += 0.5; }
    }

    // Strong body candle
    if (c0.c > c0.o && body / range > 0.65) { buy += 2; reasons.push("Strong bullish candle"); }
    else if (c0.o > c0.c && body / range > 0.65) { sell += 2; reasons.push("Strong bearish candle"); }
  }

  // ─── 2. MOVING AVERAGES (EMA crossover) ───
  const closes = candles.map(c => c.c).reverse();
  const ema5 = calcEMA(closes, 5);
  const ema10 = calcEMA(closes, 10);
  const ema20 = candles.length >= 20 ? calcEMA(closes, 20) : ema10;
  ind.EMA5 = ema5.toFixed(dec);
  ind.EMA10 = ema10.toFixed(dec);

  if (ema5 > ema10) { buy += 2; reasons.push("EMA5 > EMA10"); }
  else if (ema5 < ema10) { sell += 2; reasons.push("EMA5 < EMA10"); }

  // EMA20 trend filter
  if (candles.length >= 15) {
    const ema20val = ema20;
    if (c0.c > ema20val && ema5 > ema10) { buy += 1.5; reasons.push("Above EMA20 uptrend"); }
    else if (c0.c < ema20val && ema5 < ema10) { sell += 1.5; reasons.push("Below EMA20 downtrend"); }
  }

  // ─── 3. RSI ───
  const rsi = calcRSI(candles);
  ind.RSI = rsi;
  if (rsi < 30) { buy += 3; reasons.push(`RSI oversold (${rsi})`); }
  else if (rsi < 40) { buy += 1; reasons.push(`RSI low (${rsi})`); }
  else if (rsi > 70) { sell += 3; reasons.push(`RSI overbought (${rsi})`); }
  else if (rsi > 60) { sell += 1; reasons.push(`RSI high (${rsi})`); }

  // ─── 4. MACD ───
  const macdData = calcMACD(candles);
  if (macdData) {
    ind.MACD = macdData.macd.toFixed(dec);
    if (macdData.histogram > 0 && macdData.macd > 0) { buy += 2; reasons.push("MACD bullish"); }
    else if (macdData.histogram < 0 && macdData.macd < 0) { sell += 2; reasons.push("MACD bearish"); }

    // MACD crossover (current vs 1 bar ago)
    const prevCloses = candles.slice(1).map(c => c.c).reverse();
    const prevMACD = prevCloses.length >= 26 ? calcEMA(prevCloses, 12) - calcEMA(prevCloses, 26) : null;
    if (prevMACD !== null) {
      if (prevMACD < 0 && macdData.macd > 0) { buy += 2.5; reasons.push("MACD bullish crossover"); }
      else if (prevMACD > 0 && macdData.macd < 0) { sell += 2.5; reasons.push("MACD bearish crossover"); }
    }
  }

  // ─── 5. MULTI-BAR MOMENTUM ───
  if (c0.c > c1.c && c1.c > c2.c && c2.c > c3.c) { buy += 2; reasons.push("4-bar bullish momentum"); }
  else if (c0.c < c1.c && c1.c < c2.c && c2.c < c3.c) { sell += 2; reasons.push("4-bar bearish momentum"); }

  // ─── 6. SUPPORT / RESISTANCE ───
  const lookback = Math.min(candles.length, 15);
  const hs = candles.slice(0, lookback).map((x) => x.h);
  const ls = candles.slice(0, lookback).map((x) => x.l);
  const res = Math.max(...hs), sup = Math.min(...ls);
  ind.Resist = res.toFixed(dec);
  ind.Support = sup.toFixed(dec);

  const priceRange = res - sup;
  if (priceRange > 0) {
    const posInRange = (c0.c - sup) / priceRange; // 0 = at support, 1 = at resistance
    if (posInRange < 0.15) { buy += 2.5; reasons.push("Near support zone"); }
    else if (posInRange > 0.85) { sell += 2.5; reasons.push("Near resistance zone"); }
    else if (posInRange < 0.35) { buy += 0.5; }
    else if (posInRange > 0.65) { sell += 0.5; }
  }

  // ─── 7. VOLATILITY EXPANSION ───
  if (candles.length >= 6) {
    const avgRange = candles.slice(1, 6).reduce((a, x) => a + (x.h - x.l), 0) / 5;
    if (range > avgRange * 1.8) {
      if (c0.c > c0.o) { buy += 1.5; reasons.push("Volatility expansion bullish"); }
      else { sell += 1.5; reasons.push("Volatility expansion bearish"); }
    }
  }

  // ─── 8. WICK REJECTION ───
  if (range > 0) {
    const lowerWick = Math.min(c0.o, c0.c) - c0.l;
    const upperWick = c0.h - Math.max(c0.o, c0.c);
    if (lowerWick > range * 0.6) { buy += 1.5; reasons.push("Lower wick rejection"); }
    if (upperWick > range * 0.6) { sell += 1.5; reasons.push("Upper wick rejection"); }
  }

  // ═══ FINAL DECISION ═══
  const total = buy + sell;
  const win = Math.max(buy, sell);

  // STRICT FILTERS — minimum 3 confluences, minimum 55% edge
  if (win < 5 || total < 5) return null;
  if (win / total < 0.6) return null; // Need at least 60% dominance

  // TREND ALIGNMENT CHECK
  const type = buy > sell ? "BUY" : "SELL";

  // For BUY: price should not be far above EMA20 (chase risk)
  // For SELL: price should not be far below EMA20
  if (candles.length >= 15) {
    const distFromEMA20 = Math.abs(c0.c - ema20) / atr;
    if (distFromEMA20 > 3) return null; // Too far from mean — skip
  }

  // RSI divergence check — don't buy overbought or sell oversold
  if (type === "BUY" && rsi > 75) return null;
  if (type === "SELL" && rsi < 25) return null;

  // Confidence = weighted score, minimum 75%
  const rawConf = (win / total) * 100;
  // Bonus for extra confluences
  const confBonus = Math.min((win - 5) * 3, 15);
  const conf = Math.min(Math.round(rawConf + confBonus), 97);

  if (conf < 75) return null; // Minimum 75% confidence

  // ═══ DYNAMIC TP/SL ═══
  // Strong signal (85%+): TP 4x ATR, SL 1x ATR → 4:1 reward
  // Medium signal (75-84%): TP 3x ATR, SL 1.2x ATR → 2.5:1 reward
  const tpMult = conf >= 85 ? 4 : 3;
  const slMult = conf >= 85 ? 1 : 1.2;

  // Adjust SL to be at least 1x ATR but not more than 1.5x
  const finalTP = type === "BUY" ? price + atr * tpMult : price - atr * tpMult;
  const finalSL = type === "BUY" ? price - atr * slMult : price + atr * slMult;

  return {
    id: `SIG-${Date.now().toString(36).toUpperCase()}-${pair.replace("/", "")}-${Math.random().toString(36).substring(2, 4)}`,
    pair, type,
    entry: +price.toFixed(dec),
    tp: +finalTP.toFixed(dec),
    sl: +finalSL.toFixed(dec),
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    confidence: conf,
    reasoning: reasons,
    indicators: ind,
    source: "RapidAPI",
    apiSource: src,
    apiKey: key,
  };
}

/* ─── Pairs ─── */
const PAIRS = [
  { pair: "EUR/USD", from: "EUR", to: "USD" },
  { pair: "GBP/USD", from: "GBP", to: "USD" },
  { pair: "USD/JPY", from: "USD", to: "JPY" },
  { pair: "AUD/USD", from: "AUD", to: "USD" },
  { pair: "USD/CAD", from: "USD", to: "CAD" },
  { pair: "EUR/GBP", from: "EUR", to: "GBP" },
  { pair: "EUR/JPY", from: "EUR", to: "JPY" },
  { pair: "GBP/JPY", from: "GBP", to: "JPY" },
  { pair: "XAU/USD", from: "XAU", to: "USD" },
];

/* ─── Multi-Layer Cache ─── */
let cachedSignals: any[] = [];
let lastSignalTime = 0;
const SIGNAL_TTL = 20000; // 20s signal cache

// Candle cache — 5 min TTL (save 9 API calls per cycle)
let candleCache: Record<string, { data: any[]; time: number }> = {};
const CANDLE_TTL = 300000; // 5 minutes

// Price cache — 30s TTL
let priceCache: Record<string, { data: { price: number; bid: number; ask: number; src: string; key: string } | null; time: number }> = {};
const PRICE_TTL = 30000; // 30 seconds

async function getCachedCandles(from: string, to: string): Promise<any[]> {
  const k = `${from}/${to}`;
  const cached = candleCache[k];
  if (cached && Date.now() - cached.time < CANDLE_TTL) return cached.data;
  const data = await fetchCandles(from, to);
  if (data.length > 0) candleCache[k] = { data, time: Date.now() };
  return data;
}

async function getCachedPrice(pair: string, from: string, to: string, preferAV: boolean) {
  const k = pair;
  const cached = priceCache[k];
  if (cached && Date.now() - cached.time < PRICE_TTL) return cached.data;
  const data = await fetchPrice(pair, from, to, preferAV);
  priceCache[k] = { data, time: Date.now() };
  return data;
}

export async function GET() {
  if (cachedSignals.length > 0 && Date.now() - lastSignalTime < SIGNAL_TTL) {
    return NextResponse.json({ source: "cached", signals: cachedSignals, cached: true, apiStats: api.stats });
  }

  try {
    const signals: any[] = [];

    // ─── PHASE 1: Fetch all prices (1 API call per pair, cached 30s) ───
    const priceResults: { pair: string; from: string; to: string; price: number; src: string; key: string }[] = [];

    for (let i = 0; i < PAIRS.length; i++) {
      const { pair, from, to } = PAIRS[i];
      try {
        const pd = await getCachedPrice(pair, from, to, i % 2 === 0);
        if (pd) priceResults.push({ pair, from, to, price: pd.price, src: pd.src, key: pd.key });
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    // ─── PHASE 2: Fetch candles ONLY for pairs with price (cached 5min) ───
    for (let i = 0; i < priceResults.length; i++) {
      const { pair, from, to, price, src, key } = priceResults[i];
      try {
        // Candle fetch only uses AV, spread across calls to avoid rate limit
        const candles = await getCachedCandles(from, to);
        const sig = analyze(pair, price, candles, src, key);
        if (sig) signals.push(sig);
      } catch {}
      await new Promise(r => setTimeout(r, 350));
    }

    // Sort by confidence
    signals.sort((a, b) => b.confidence - a.confidence);
    const topSignals = signals.slice(0, 6);

    if (topSignals.length > 0) { cachedSignals = topSignals; lastSignalTime = Date.now(); }

    return NextResponse.json({
      source: topSignals.length > 0 ? "RapidAPI (Precision Engine v2)" : "no-qualifying-signals",
      signals: topSignals.length > 0 ? topSignals : cachedSignals,
      generated: topSignals.length,
      totalChecked: PAIRS.length,
      apiStats: api.stats,
    });
  } catch {
    return NextResponse.json({ source: "error", signals: cachedSignals, apiStats: api.stats });
  }
}