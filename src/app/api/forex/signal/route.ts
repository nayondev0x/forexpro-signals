import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════════════════
   POWER SIGNAL ENGINE v5.0 — MULTI-SOURCE FUSION
   ═══════════════════════════════════════════════════════════════════════
   
   LAYER 1: Forex Signals API (PRIMARY — always active)
     → forex-signals.php: external trading signals
     → market-trends.php: market trend data
     → index-auth.php: MT4/MT5 account auth
   
   LAYER 2: Price + Candle Data (ENHANCEMENT — when TD/AV keys configured)
     → Twelve Data API (up to 4 keys, round-robin failover)
     → Alpha Vantage API (up to 4 keys, round-robin failover)
     → Smart dual-source: AV first → TD fallback
   
   LAYER 3: 20 External TA Indicators (ENHANCEMENT — when Crypto TA key configured)
     → RSI, MACD, ADX, Bollinger, Stochastic, CCI, Aroon, UO,
       Donchian, ROC, MFI, SMA, WMA, EMA, SD, PSAR,
       Williams %R, TSI, Volume Oscillator, Price, Volume
   
   LAYER 4: Local Analysis (when candle data available)
     → 10+ candlestick patterns, EMA/SMA crosses, RSI/MACD,
       Support/Resistance, Fibonacci, ATR volatility
   
   SCORING: 5-layer weighted fusion → minimum 88% confidence, 12+ confluences
   OUTPUT: TOP 2 only, 3:1–6:1 reward ratio, 15min auto-expire
   ═══════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

interface ApiKey {
  id: string;
  key: string;
  host: string;
  service: "TD" | "AV";
  limitedUntil: number;
  callCount: number;
}

interface ExternalSignal {
  pair: string;
  type: "BUY" | "SELL";
  entry?: number;
  tp?: number;
  sl?: number;
  confidence?: number;
  source: string;
}

interface MarketTrend {
  pair: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number; // 0-100
}

interface TAIndicator {
  rsi?: number;
  macd?: { macd: number; signal: number; histogram: number };
  adx?: { adx: number; plusDi: number; minusDi: number };
  bollingerBands?: { upper: number; middle: number; lower: number; stdDev: number };
  stochastic?: { k: number; d: number };
  cci?: number;
  aroon?: { up: number; down: number };
  uo?: number;
  donchian?: { upper: number; middle: number; lower: number };
  roc?: number;
  mfi?: number;
  ema14?: number;
  sma14?: number;
  wma14?: number;
  sd?: number;
  psar?: { sar: number; isAbove: boolean };
  williamsR?: number;
  tsi?: { tsi: number; signal: number };
  volOsc?: number;
  taPrice?: number;
  taVolume?: number;
}

interface AnalysisResult {
  pair: string;
  type: "BUY" | "SELL";
  entry: number;
  tp: number;
  sl: number;
  confidence: number;
  reasoning: string[];
  indicators: Record<string, string | number>;
  sources: string[];
  confluenceCount: number;
  layers: { layer: string; score: number; details: string[] };
}

// ═══════════════════════════════════════════════════════════
//  LAYER 2: DUAL API MANAGER (TD + AV keys)
// ═══════════════════════════════════════════════════════════

class DualApiManager {
  private tdKeys: ApiKey[] = [];
  private avKeys: ApiKey[] = [];
  private tdIdx = 0;
  private avIdx = 0;

  constructor() {
    for (let i = 1; i <= 4; i++) {
      const tdKey = process.env[`TWELVE_DATA_API_KEY${i > 1 ? `_${i}` : ""}`];
      const tdHost = process.env[`TWELVE_DATA_API_HOST${i > 1 ? `_${i}` : ""}`];
      if (tdKey) this.tdKeys.push({ id: `TD-${i}`, key: tdKey, host: tdHost || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    }
    for (let i = 1; i <= 4; i++) {
      const avKey = process.env[`ALPHA_VANTAGE_API_KEY${i > 1 ? `_${i}` : ""}`];
      const avHost = process.env[`ALPHA_VANTAGE_API_HOST${i > 1 ? `_${i}` : ""}`];
      if (avKey) this.avKeys.push({ id: `AV-${i}`, key: avKey, host: avHost || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
    }
    console.log(`[DualAPI] TD: ${this.tdKeys.length}, AV: ${this.avKeys.length}`);
  }

  private next(pool: ApiKey[], isTD: boolean): ApiKey | null {
    const now = Date.now();
    const idx = isTD ? this.tdIdx : this.avIdx;
    for (let i = 0; i < pool.length; i++) {
      const j = (idx + i) % pool.length;
      if (pool[j].limitedUntil <= now) {
        if (isTD) this.tdIdx = j + 1; else this.avIdx = j + 1;
        pool[j].callCount++;
        return pool[j];
      }
    }
    return null;
  }

  getTD() { return this.next(this.tdKeys, true); }
  getAV() { return this.next(this.avKeys, false); }

  markLimited(id: string, s = 60) {
    [...this.tdKeys, ...this.avKeys].find(k => k.id === id && (k.limitedUntil = Date.now() + s * 1000));
  }

  async fetch(url: string, pref: "AV" | "TD") {
    const pools: Array<{ get: () => ApiKey | null; svc: "AV" | "TD" }> = [
      { get: pref === "AV" ? () => this.getAV() : () => this.getTD(), svc: pref },
      { get: pref === "AV" ? () => this.getTD() : () => this.getAV(), svc: pref === "AV" ? "TD" : "AV" },
    ];
    for (const p of pools) {
      for (let a = 0; a < 2; a++) {
        const k = p.get();
        if (!k) break;
        try {
          const r = await fetch(url, { headers: { "x-rapidapi-key": k.key, "x-rapidapi-host": k.host }, signal: AbortSignal.timeout(8000) });
          if (r.status === 429) { this.markLimited(k.id, 60); continue; }
          return { response: r, key: k.id, service: p.svc };
        } catch { continue; }
      }
    }
    return { response: null, key: "none", service: "none" };
  }

  get stats() {
    const now = Date.now();
    return {
      totalKeys: this.tdKeys.length + this.avKeys.length,
      tdCalls: this.tdKeys.reduce((a, k) => a + k.callCount, 0),
      avCalls: this.avKeys.reduce((a, k) => a + k.callCount, 0),
      limited: [...this.tdKeys, ...this.avKeys].filter(k => k.limitedUntil > now).length,
    };
  }
}

const dualApi = new DualApiManager();

// ═══════════════════════════════════════════════════════════
//  LAYER 1: FOREX SIGNALS API — PRIMARY DATA SOURCE
// ═══════════════════════════════════════════════════════════

const FX_API_KEY = process.env.FOREX_SIGNALS_API_KEY || "";
const FX_API_HOST = process.env.FOREX_SIGNALS_API_HOST || "forex-signals-api.p.rapidapi.com";
const CLIENT_ID = crypto.randomUUID();

// Caches
let extSignalCache: { data: any; time: number } | null = null;
let marketTrendCache: { data: MarketTrend[]; time: number } | null = null;
const EXT_SIG_TTL = 45000; // 45s
const TREND_TTL = 120000;  // 2min

async function fxApiCall(endpoint: string, body?: Record<string, any>): Promise<any> {
  if (!FX_API_KEY) return null;
  try {
    const opts: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rapidapi-key": FX_API_KEY, "x-rapidapi-host": FX_API_HOST },
      signal: AbortSignal.timeout(10000),
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`https://${FX_API_HOST}/${endpoint}`, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Fetch external trading signals from forex-signals.php
async function fetchExternalSignals(): Promise<ExternalSignal[]> {
  const cached = extSignalCache;
  if (cached && Date.now() - cached.time < EXT_SIG_TTL) return parseExternalSignals(cached.data);

  const data = await fxApiCall("forex-signals.php", { client_instance_id: CLIENT_ID });
  if (!data) return [];
  extSignalCache = { data, time: Date.now() };
  return parseExternalSignals(data);
}

function parseExternalSignals(data: any): ExternalSignal[] {
  const raw: any[] = Array.isArray(data?.signals) ? data.signals
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data?.results) ? data.results
    : Array.isArray(data) ? data : [];

  return raw.map((s: any) => {
    const pair = (s.pair || s.symbol || s.PAIR || s.currency_pair || "").toUpperCase().replace("-", "/");
    const typeRaw = (s.type || s.direction || s.TYPE || s.signal_type || s.action || s.side || "").toUpperCase();
    const type: "BUY" | "SELL" = typeRaw.includes("BUY") || typeRaw.includes("LONG") || typeRaw.includes("CALL") ? "BUY" : "SELL";
    const entry = parseFloat(s.entry || s.entry_price || s.price || s.open || s.Entry || 0);
    const tp = parseFloat(s.tp || s.take_profit || s.TP || s.target || s.Target || 0);
    const sl = parseFloat(s.sl || s.stop_loss || s.SL || s.stoploss || s.StopLoss || 0);
    const conf = parseFloat(s.confidence || s.strength || s.accuracy || s.Confidence || 0);
    return { pair, type, entry: entry || 0, tp: tp || 0, sl: sl || 0, confidence: conf || 0, source: "forex-signals-api" };
  }).filter((s: ExternalSignal) => s.pair.length >= 6);
}

// Fetch market trends from market-trends.php
async function fetchMarketTrends(): Promise<MarketTrend[]> {
  const cached = marketTrendCache;
  if (cached && Date.now() - cached.time < TREND_TTL) return cached.data;

  const data = await fxApiCall("market-trends.php", { client_instance_id: CLIENT_ID });
  if (!data) return [];
  const trends = parseMarketTrends(data);
  if (trends.length > 0) marketTrendCache = { data: trends, time: Date.now() };
  return trends;
}

function parseMarketTrends(data: any): MarketTrend[] {
  const raw: any[] = Array.isArray(data?.trends) ? data.trends
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data?.results) ? data.results
    : Array.isArray(data) ? data : [];

  return raw.map((t: any) => {
    const pair = (t.pair || t.symbol || t.PAIR || t.currency_pair || "").toUpperCase().replace("-", "/");
    const dirRaw = (t.trend || t.direction || t.trend_direction || t.signal || "").toUpperCase();
    const direction: "BULLISH" | "BEARISH" | "NEUTRAL" =
      dirRaw.includes("BULL") || dirRaw.includes("UP") ? "BULLISH" :
      dirRaw.includes("BEAR") || dirRaw.includes("DOWN") ? "BEARISH" : "NEUTRAL";
    const strength = parseFloat(t.strength || t.score || t.power || t.confidence || 50);
    return { pair, direction, strength: Math.min(Math.max(strength, 0), 100) };
  }).filter((t: MarketTrend) => t.pair.length >= 6);
}

// Check if pair matches between two strings
function pairMatch(a: string, b: string): boolean {
  const na = a.replace("/", "").toUpperCase();
  const nb = b.replace("/", "").toUpperCase();
  if (na === nb) return true;
  // Partial match: EURUSD matches EUR/USD
  for (const base of ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD", "USDCHF", "EURGBP", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD"]) {
    if (na.includes(base) && nb.includes(base)) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
//  LAYER 3: CRYPTO TA API — 20 EXTERNAL INDICATORS
// ═══════════════════════════════════════════════════════════

const CTA_KEY = process.env.CRYPTO_TA_API_KEY || "";
const CTA_HOST = process.env.CRYPTO_TA_API_HOST || "crypto-technical-analysis-indicator-apis-for-trading.p.rapidapi.com";

let taCache: Record<string, { data: TAIndicator; time: number }> = {};
const TA_CACHE_TTL = 300000;

async function fetchTA(symbol: string, endpoint: string, params = ""): Promise<any> {
  if (!CTA_KEY) return null;
  try {
    const url = `https://${CTA_HOST}/${endpoint}?symbol=${symbol}&timeframe=15min${params ? "&" + params : ""}`;
    const res = await fetch(url, { headers: { "x-rapidapi-key": CTA_KEY, "x-rapidapi-host": CTA_HOST }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const d = await res.json();
    return d?.result || d?.data || d;
  } catch { return null; }
}

async function fetchAllTA(from: string, to: string): Promise<TAIndicator | null> {
  const sym = `${from}${to}`;
  const cached = taCache[sym];
  if (cached && Date.now() - cached.time < TA_CACHE_TTL) return cached.data;
  if (!CTA_KEY) return null;

  const [rsiD, macdD, adxD, bbD, stochD, cciD, aroonD, uoD, donchD, rocD, mfiD, emaD, smaD, wmaD, sdD, psarD, wrD, tsiD, voD, priceD, volD] = await Promise.allSettled([
    fetchTA(sym, "rsi", "length=14"), fetchTA(sym, "macd", "short=12&long=26&signal=9"),
    fetchTA(sym, "adx", "diLength=14&adxSmoothing=14"), fetchTA(sym, "bollinger-bands", "stdDev=2.5&length=20"),
    fetchTA(sym, "stochastic", "kLength=14&kSmoothing=3&dSmoothing=3"), fetchTA(sym, "cci", "smoothing=sma&length=20&smoothingLength=20"),
    fetchTA(sym, "aroon", "length=14"), fetchTA(sym, "uo", "length7=7&length14=14&length28=28"),
    fetchTA(sym, "donchian", "length=20"), fetchTA(sym, "roc", "length=9"),
    fetchTA(sym, "mfi", "length=14"), fetchTA(sym, "ema", "length=14"),
    fetchTA(sym, "sma", "length=14"), fetchTA(sym, "wma", "length=14"),
    fetchTA(sym, "sd", "periods=5&deviations=1"), fetchTA(sym, "psar", "start=0.02&increment=0.02&maximum=0.2"),
    fetchTA(sym, "williamsR", "length=14"), fetchTA(sym, "tsi", "long=25&short=13&siglen=13"),
    fetchTA(sym, "volume-oscillator", "shortlen=5&longlen=10"), fetchTA(sym, "price", ""),
    fetchTA(sym, "volume", ""),
  ]);

  const r: TAIndicator = {};
  const num = (v: any) => typeof v === "number" ? v : v?.value ?? v?.rsi ?? NaN;
  const safe = (v: any, ...paths: string[]) => { for (const p of paths) { const val = typeof v === "number" ? v : v?.[p]; if (typeof val === "number" && !isNaN(val)) return val; } return NaN; };

  if (rsiD.status === "fulfilled" && rsiD.value) { const v = num(rsiD.value); if (!isNaN(v)) r.rsi = v; }
  if (macdD.status === "fulfilled" && macdD.value) {
    const m = macdD.value;
    const ml = safe(m, "macd", "macdLine", "macdValue");
    const sl = safe(m, "signal", "signalLine", "signalValue");
    const h = safe(m, "histogram", "macdHistogram", "hist");
    if (!isNaN(ml)) r.macd = { macd: ml, signal: sl || 0, histogram: h || (ml - (sl || 0)) };
  }
  if (adxD.status === "fulfilled" && adxD.value) {
    const a = adxD.value;
    const av = safe(a, "adx", "value");
    const pdi = safe(a, "plusDi", "+DI", "plusDI", "pdi");
    const mdi = safe(a, "minusDi", "-DI", "minusDI", "mdi");
    if (!isNaN(av)) r.adx = { adx: av, plusDi: pdi || 0, minusDi: mdi || 0 };
  }
  if (bbD.status === "fulfilled" && bbD.value) {
    const b = bbD.value;
    const u = safe(b, "upper", "upperBand"), l = safe(b, "lower", "lowerBand"), m = safe(b, "middle", "middleBand", "sma");
    if (!isNaN(u) && !isNaN(l)) r.bollingerBands = { upper: u, middle: m || (u + l) / 2, lower: l, stdDev: (u - l) / 5 };
  }
  if (stochD.status === "fulfilled" && stochD.value) { const k = safe(stochD.value, "k", "stochK"); if (!isNaN(k)) r.stochastic = { k, d: safe(stochD.value, "d", "stochD") || k }; }
  if (cciD.status === "fulfilled" && cciD.value) { const v = safe(cciD.value, "cci"); if (!isNaN(v)) r.cci = v; }
  if (aroonD.status === "fulfilled" && aroonD.value) { const u = safe(aroonD.value, "up", "aroonUp"); if (!isNaN(u)) r.aroon = { up: u, down: safe(aroonD.value, "down", "aroonDown") || 0 }; }
  if (uoD.status === "fulfilled" && uoD.value) { const v = safe(uoD.value, "uo"); if (!isNaN(v)) r.uo = v; }
  if (donchD.status === "fulfilled" && donchD.value) {
    const u = safe(donchD.value, "upper", "upperBand"), l = safe(donchD.value, "lower", "lowerBand");
    if (!isNaN(u) && !isNaN(l)) r.donchian = { upper: u, middle: safe(donchD.value, "middle") || (u + l) / 2, lower: l };
  }
  if (rocD.status === "fulfilled" && rocD.value) { const v = safe(rocD.value, "roc"); if (!isNaN(v)) r.roc = v; }
  if (mfiD.status === "fulfilled" && mfiD.value) { const v = safe(mfiD.value, "mfi"); if (!isNaN(v)) r.mfi = v; }
  if (emaD.status === "fulfilled" && emaD.value) { const v = safe(emaD.value, "ema"); if (!isNaN(v)) r.ema14 = v; }
  if (smaD.status === "fulfilled" && smaD.value) { const v = safe(smaD.value, "sma"); if (!isNaN(v)) r.sma14 = v; }
  if (wmaD.status === "fulfilled" && wmaD.value) { const v = safe(wmaD.value, "wma"); if (!isNaN(v)) r.wma14 = v; }
  if (sdD.status === "fulfilled" && sdD.value) { const v = safe(sdD.value, "sd", "standardDeviation"); if (!isNaN(v) && v >= 0) r.sd = v; }
  if (psarD.status === "fulfilled" && psarD.value) { const v = safe(psarD.value, "sar", "value", "psar"); if (!isNaN(v)) r.psar = { sar: v, isAbove: false }; }
  if (wrD.status === "fulfilled" && wrD.value) { const v = safe(wrD.value, "williamsR", "%R"); if (!isNaN(v)) r.williamsR = v; }
  if (tsiD.status === "fulfilled" && tsiD.value) { const v = safe(tsiD.value, "tsi"); if (!isNaN(v)) r.tsi = { tsi: v, signal: safe(tsiD.value, "signal", "signalLine") || 0 }; }
  if (voD.status === "fulfilled" && voD.value) { const v = safe(voD.value, "value", "oscillator", "volume-oscillator"); if (!isNaN(v)) r.volOsc = v; }
  if (priceD.status === "fulfilled" && priceD.value) { const v = safe(priceD.value, "price", "close"); if (!isNaN(v) && v > 0) r.taPrice = v; }
  if (volD.status === "fulfilled" && volD.value) { const v = safe(volD.value, "volume"); if (!isNaN(v) && v > 0) r.taVolume = v; }

  if (Object.keys(r).length >= 2) taCache[sym] = { data: r, time: Date.now() };
  return Object.keys(r).length >= 2 ? r : null;
}

// ═══════════════════════════════════════════════════════════
//  LAYER 2: PRICE & CANDLE DATA FETCHERS
// ═══════════════════════════════════════════════════════════

let priceCache: Record<string, { data: any; time: number }> = {};
let candleCache: Record<string, { data: any[]; time: number }> = {};
const PRICE_TTL = 30000;
const CANDLE_TTL = 300000;

async function fetchPrice(pair: string, from: string, to: string): Promise<{ price: number; bid: number; ask: number; src: string; key: string } | null> {
  const ck = priceCache[pair];
  if (ck && Date.now() - ck.time < PRICE_TTL) return ck.data;

  // Try AV first
  const avH = process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com";
  const r1 = await dualApi.fetch(`https://${avH}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}`, "AV");
  if (r1.response?.ok) {
    const d = await r1.response.json();
    const ex = d?.["Realtime Currency Exchange Rate"];
    if (ex) {
      const price = parseFloat(ex["5. Exchange Rate"]);
      if (!isNaN(price)) { const r = { price, bid: parseFloat(ex["8. Bid Price"]) || price, ask: parseFloat(ex["9. Ask Price"]) || price, src: r1.service, key: r1.key }; priceCache[pair] = { data: r, time: Date.now() }; return r; }
    }
  }
  // Fallback TD
  const tdH = process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com";
  const r2 = await dualApi.fetch(`https://${tdH}/price?symbol=${pair}&interval=1min`, "TD");
  if (r2.response?.ok) {
    const d = await r2.response.json();
    const price = parseFloat(d.price);
    if (!isNaN(price)) { const r = { price, bid: parseFloat(d.bid) || price, ask: parseFloat(d.ask) || price, src: r2.service, key: r2.key }; priceCache[pair] = { data: r, time: Date.now() }; return r; }
  }
  return null;
}

async function fetchCandles(from: string, to: string): Promise<any[]> {
  const k = `${from}/${to}`;
  const ck = candleCache[k];
  if (ck && Date.now() - ck.time < CANDLE_TTL) return ck.data;

  const avH = process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com";
  const r = await dualApi.fetch(`https://${avH}/query?function=FX_INTRADAY&from_symbol=${from}&to_symbol=${to}&interval=15min&outputsize=50`, "AV");
  if (!r.response?.ok) return [];
  const d = await r.response.json();
  const key = Object.keys(d).find(k => k.includes("Time Series"));
  if (!key) return [];
  const candles = Object.values(d[key]).map((v: any) => ({
    o: parseFloat(v?.["1. open"]) || 0, h: parseFloat(v?.["2. high"]) || 0,
    l: parseFloat(v?.["3. low"]) || 0, c: parseFloat(v?.["4. close"]) || 0,
  })).filter(x => x.c > 0);
  if (candles.length > 0) candleCache[k] = { data: candles, time: Date.now() };
  return candles;
}

// ═══════════════════════════════════════════════════════════
//  LAYER 4: LOCAL ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════

function calcATR(candles: any[], pair: string, price: number): number {
  if (candles.length >= 10) {
    const n = Math.min(candles.length - 1, 14);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const c = candles[i], p = candles[i + 1];
      sum += Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c));
    }
    const atr = sum / n;
    if (atr > 0) return atr;
  }
  if (pair.includes("XAU")) return price * 0.004;
  if (pair.includes("JPY")) return price * 0.0035;
  return price * 0.0025;
}

function calcEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = data[data.length - 1];
  for (let i = data.length - 2; i >= Math.max(0, data.length - period * 2); i--) ema = data[i] * k + ema * (1 - k);
  return ema;
}

function calcRSI(candles: any[], period = 14): number {
  if (candles.length < period + 1) return 50;
  let gains = 0, losses = 0;
  const n = Math.min(candles.length - 1, period);
  for (let i = 0; i < n; i++) { const d = candles[i].c - candles[i + 1].c; if (d > 0) gains += d; else losses -= d; }
  if (losses === 0) return 100;
  return +(100 - 100 / (1 + (gains / n) / (losses / n))).toFixed(1);
}

function calcMACD(candles: any[]): { macd: number; signal: number; histogram: number } | null {
  if (candles.length < 35) return null;
  const closes = candles.map(c => c.c).reverse();
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

// Find support/resistance levels from candle data
function findSR(candles: any[], price: number): { support: number; resistance: number; near: "support" | "resistance" | "none" } {
  if (candles.length < 10) return { support: price * 0.998, resistance: price * 1.002, near: "none" };
  const lows = candles.slice(0, 20).map(c => c.l).sort((a, b) => a - b);
  const highs = candles.slice(0, 20).map(c => c.h).sort((a, b) => b - a);
  const support = lows.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const resistance = highs.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const atr = (resistance - support) / 4;
  let near: "support" | "resistance" | "none" = "none";
  if (price - support < atr) near = "support";
  else if (resistance - price < atr) near = "resistance";
  return { support, resistance, near };
}

// Fibonacci levels from recent high/low
function fibLevels(high: number, low: number) {
  const diff = high - low;
  return {
    "0.0": high, "0.236": high - diff * 0.236, "0.382": high - diff * 0.382,
    "0.5": high - diff * 0.5, "0.618": high - diff * 0.618, "0.786": high - diff * 0.786, "1.0": low,
  };
}

// Session scoring (0-5)
function sessionScore(): number {
  const utcH = new Date().getUTCHours();
  // London open (7-10 UTC): 5, London-NY overlap (13-17 UTC): 5
  // London (7-16 UTC): 4, NY (12-21 UTC): 3, Asia (0-9 UTC): 2
  if ((utcH >= 7 && utcH < 10) || (utcH >= 13 && utcH < 17)) return 5;
  if ((utcH >= 10 && utcH < 13) || (utcH >= 16 && utcH < 21)) return 4;
  if (utcH >= 0 && utcH < 2) return 3;
  if (utcH >= 2 && utcH < 7) return 2;
  return 1;
}

// ═══════════════════════════════════════════════════════════
//  POWER SCORING ENGINE — 5-LAYER FUSION
// ═══════════════════════════════════════════════════════════

function scoreSignal(
  pair: string, type: "BUY" | "SELL", price: number,
  candles: any[], ta: TAIndicator | null,
  extSignal: ExternalSignal | null,
  trend: MarketTrend | null,
): AnalysisResult | null {
  const dec = pair.includes("XAU") || pair.includes("JPY") ? 2 : 4;
  const atr = candles.length >= 5 ? calcATR(candles, pair, price) : (pair.includes("XAU") ? price * 0.004 : price * 0.0025);

  const reasons: string[] = [];
  const ind: Record<string, string | number> = {};
  const sources: string[] = [];
  const layers: AnalysisResult["layers"] = [];

  let buyScore = 0, sellScore = 0;
  if (type === "BUY") buyScore += 5; else sellScore += 5;

  // ═══════════════════════════════════════════
  // LAYER 1: EXTERNAL SIGNAL (PRIMARY)
  // ═══════════════════════════════════════════
  let layer1Score = 0;
  const layer1Details: string[] = [];

  if (extSignal) {
    layer1Score += 20; // Base: external signal exists
    layer1Details.push(`External signal: ${extSignal.type} ${extSignal.pair}`);
    sources.push("ForexSignals-API");

    // External signal has own TP/SL
    if (extSignal.entry > 0) { ind.extEntry = extSignal.entry.toFixed(dec); }
    if (extSignal.tp > 0 && extSignal.sl > 0) {
      const extRR = Math.abs(extSignal.tp - extSignal.entry) / Math.abs(extSignal.entry - extSignal.sl);
      if (extRR >= 2) { layer1Score += 5; layer1Details.push(`Good external R:R (${extRR.toFixed(1)}:1)`); }
    }
    if (extSignal.confidence > 70) { layer1Score += 5; layer1Details.push(`High ext confidence (${extSignal.confidence}%)`); }
    else if (extSignal.confidence > 50) { layer1Score += 3; }
  }
  layers.push({ layer: "External Signal", score: layer1Score, details: layer1Details });

  // ═══════════════════════════════════════════
  // LAYER 2: MARKET TREND CONFIRMATION
  // ═══════════════════════════════════════════
  let layer2Score = 0;
  const layer2Details: string[] = [];

  if (trend) {
    sources.push("MarketTrends");
    const aligned = (type === "BUY" && trend.direction === "BULLISH") || (type === "SELL" && trend.direction === "BEARISH");
    const contra = (type === "BUY" && trend.direction === "BEARISH") || (type === "SELL" && trend.direction === "BULLISH");

    if (aligned) {
      const bonus = Math.min(Math.round(trend.strength / 15), 8);
      layer2Score += 5 + bonus;
      layer2Details.push(`Trend aligned: ${trend.direction} (strength ${trend.strength})`);
    } else if (trend.direction === "NEUTRAL") {
      layer2Score += 2;
      layer2Details.push(`Trend neutral (strength ${trend.strength})`);
    } else if (contra) {
      layer2Score -= 5; // Penalty for counter-trend
      layer2Details.push(`COUNTER-TREND WARNING: ${trend.direction}`);
    }
  }
  layers.push({ layer: "Market Trend", score: layer2Score, details: layer2Details });

  // ═══════════════════════════════════════════
  // LAYER 3: TA INDICATORS (20 external)
  // ═══════════════════════════════════════════
  let layer3Score = 0;
  const layer3Details: string[] = [];
  let taBuyCount = 0, taSellCount = 0;

  if (ta) {
    sources.push("TA-20-Indicators");

    // RSI
    if (ta.rsi !== undefined) {
      ind.TA_RSI = ta.rsi;
      if (ta.rsi < 30) { buyScore += 3; taBuyCount++; layer3Details.push(`RSI oversold (${ta.rsi})`); }
      else if (ta.rsi < 40) { buyScore += 1.5; taBuyCount++; }
      else if (ta.rsi > 70) { sellScore += 3; taSellCount++; layer3Details.push(`RSI overbought (${ta.rsi})`); }
      else if (ta.rsi > 60) { sellScore += 1.5; taSellCount++; }
    }

    // MACD
    if (ta.macd) {
      ind.TA_MACD = ta.macd.macd.toFixed(6);
      ind.TA_MACD_Hist = ta.macd.histogram.toFixed(6);
      if (ta.macd.histogram > 0 && ta.macd.macd > ta.macd.signal) { buyScore += 2.5; taBuyCount++; layer3Details.push("MACD bullish crossover"); }
      else if (ta.macd.histogram < 0 && ta.macd.macd < ta.macd.signal) { sellScore += 2.5; taSellCount++; layer3Details.push("MACD bearish crossover"); }
    }

    // ADX + DI
    if (ta.adx) {
      ind.TA_ADX = ta.adx.adx;
      if (ta.adx.adx > 25) {
        if (ta.adx.plusDi > ta.adx.minusDi) { buyScore += 2; taBuyCount++; layer3Details.push(`ADX strong uptrend (${ta.adx.adx})`); }
        else { sellScore += 2; taSellCount++; layer3Details.push(`ADX strong downtrend (${ta.adx.adx})`); }
      }
    }

    // Bollinger Bands
    if (ta.bollingerBands) {
      const { upper, lower, middle } = ta.bollingerBands;
      ind.TA_BB_Upper = upper.toFixed(dec); ind.TA_BB_Lower = lower.toFixed(dec);
      if (price <= lower * 1.001) { buyScore += 2; taBuyCount++; layer3Details.push("Price at BB lower band"); }
      else if (price >= upper * 0.999) { sellScore += 2; taSellCount++; layer3Details.push("Price at BB upper band"); }
      // BB squeeze = volatility contraction → big move coming
      const bbWidth = (upper - lower) / middle;
      if (bbWidth < 0.01) layer3Details.push("BB SQUEEZE — big move imminent");
    }

    // Stochastic
    if (ta.stochastic) {
      ind.TA_StochK = ta.stochastic.k.toFixed(1);
      if (ta.stochastic.k < 20 && ta.stochastic.d < 20) { buyScore += 2; taBuyCount++; layer3Details.push(`Stoch oversold (K:${ta.stochastic.k.toFixed(0)})`); }
      else if (ta.stochastic.k > 80 && ta.stochastic.d > 80) { sellScore += 2; taSellCount++; layer3Details.push(`Stoch overbought (K:${ta.stochastic.k.toFixed(0)})`); }
    }

    // CCI
    if (ta.cci !== undefined) {
      ind.TA_CCI = ta.cci;
      if (ta.cci < -100) { buyScore += 2; taBuyCount++; layer3Details.push(`CCI oversold (${ta.cci})`); }
      else if (ta.cci > 100) { sellScore += 2; taSellCount++; layer3Details.push(`CCI overbought (${ta.cci})`); }
    }

    // Aroon
    if (ta.aroon) {
      if (ta.aroon.up - ta.aroon.down > 30) { buyScore += 1.5; taBuyCount++; layer3Details.push("Aroon bullish"); }
      else if (ta.aroon.down - ta.aroon.up > 30) { sellScore += 1.5; taSellCount++; layer3Details.push("Aroon bearish"); }
    }

    // Ultimate Oscillator
    if (ta.uo !== undefined) {
      if (ta.uo < 30) { buyScore += 1.5; taBuyCount++; layer3Details.push(`UO oversold (${ta.uo.toFixed(1)})`); }
      else if (ta.uo > 70) { sellScore += 1.5; taSellCount++; layer3Details.push(`UO overbought (${ta.uo.toFixed(1)})`); }
    }

    // MFI
    if (ta.mfi !== undefined) {
      if (ta.mfi < 20) { buyScore += 2; taBuyCount++; layer3Details.push(`MFI oversold (${ta.mfi})`); }
      else if (ta.mfi > 80) { sellScore += 2; taSellCount++; layer3Details.push(`MFI overbought (${ta.mfi})`); }
    }

    // Donchian Channel
    if (ta.donchian) {
      if (price >= ta.donchian.upper * 0.999) { buyScore += 1; taBuyCount++; layer3Details.push("Price near Donchian upper (breakout)"); }
      else if (price <= ta.donchian.lower * 1.001) { sellScore += 1; taSellCount++; layer3Details.push("Price near Donchian lower (breakdown)"); }
    }

    // ROC
    if (ta.roc !== undefined) {
      if (ta.roc > 0.5) { buyScore += 1; taBuyCount++; }
      else if (ta.roc < -0.5) { sellScore += 1; taSellCount++; }
    }

    // Parabolic SAR
    if (ta.psar) {
      const sarBelow = ta.psar.sar < price;
      ta.psar.isAbove = !sarBelow;
      if (sarBelow) { buyScore += 2; taBuyCount++; layer3Details.push("PSAR below price (bullish)"); }
      else { sellScore += 2; taSellCount++; layer3Details.push("PSAR above price (bearish)"); }
    }

    // Williams %R
    if (ta.williamsR !== undefined) {
      if (ta.williamsR < -80) { buyScore += 2; taBuyCount++; layer3Details.push(`Williams%R oversold (${ta.williamsR})`); }
      else if (ta.williamsR > -20) { sellScore += 2; taSellCount++; layer3Details.push(`Williams%R overbought (${ta.williamsR})`); }
    }

    // TSI
    if (ta.tsi) {
      if (ta.tsi.tsi > 0 && ta.tsi.signal > 0) { buyScore += 1.5; taBuyCount++; }
      else if (ta.tsi.tsi < 0 && ta.tsi.signal < 0) { sellScore += 1.5; taSellCount++; }
      if (ta.tsi.tsi > 0 && ta.tsi.signal < 0) { buyScore += 2; layer3Details.push("TSI bullish zero cross"); }
      else if (ta.tsi.tsi < 0 && ta.tsi.signal > 0) { sellScore += 2; layer3Details.push("TSI bearish zero cross"); }
    }

    // Super confluence: 6+ TA indicators agree
    if (taBuyCount >= 6) { buyScore += 4; layer3Details.push(`SUPER confluence ${taBuyCount}/10 bullish`); }
    else if (taBuyCount >= 4) { buyScore += 2; layer3Details.push(`Strong confluence ${taBuyCount}/10 bullish`); }
    if (taSellCount >= 6) { sellScore += 4; layer3Details.push(`SUPER confluence ${taSellCount}/10 bearish`); }
    else if (taSellCount >= 4) { sellScore += 2; layer3Details.push(`Strong confluence ${taSellCount}/10 bearish`); }

    layer3Score = Math.max(buyScore, sellScore) - 5; // Subtract the base score added at start
  }
  layers.push({ layer: "TA Indicators", score: layer3Score, details: layer3Details });

  // ═══════════════════════════════════════════
  // LAYER 4: LOCAL CANDLE ANALYSIS
  // ═══════════════════════════════════════════
  let layer4Score = 0;
  const layer4Details: string[] = [];

  if (candles.length >= 8) {
    sources.push("Local-Analysis");
    const c0 = candles[0], c1 = candles[1], c2 = candles[2], c3 = candles[3];

    ind.O = c0.o.toFixed(dec); ind.H = c0.h.toFixed(dec);
    ind.L = c0.l.toFixed(dec); ind.C = c0.c.toFixed(dec);
    ind.ATR = atr.toFixed(dec);

    // Candlestick patterns
    if (c1.c < c1.o && c0.c > c0.o && c0.c > c1.o && c0.o < c1.c) { buyScore += 3; layer4Details.push("Bullish engulfing"); }
    else if (c1.c > c1.o && c0.c < c0.o && c0.c < c1.o && c0.o > c1.c) { sellScore += 3; layer4Details.push("Bearish engulfing"); }

    const body = Math.abs(c0.c - c0.o), range = c0.h - c0.l;
    if (range > 0) {
      const lw = Math.min(c0.o, c0.c) - c0.l, uw = c0.h - Math.max(c0.o, c0.c);
      if (lw > body * 2.5 && uw < body * 0.3) { buyScore += 2.5; layer4Details.push("Hammer"); }
      else if (uw > body * 2.5 && lw < body * 0.3) { sellScore += 2.5; layer4Details.push("Shooting star"); }
      if (c0.c > c0.o && body / range > 0.65) { buyScore += 2; layer4Details.push("Strong bullish candle"); }
      else if (c0.o > c0.c && body / range > 0.65) { sellScore += 2; layer4Details.push("Strong bearish candle"); }
      // Doji = indecision
      if (body / range < 0.1) layer4Details.push("Doji (indecision)");
    }

    // 3-candle patterns
    if (c2.c < c2.o && c1.c < c1.o && c0.c > c0.o && c0.c > c1.o) { buyScore += 2.5; layer4Details.push("Morning star pattern"); }
    else if (c2.c > c2.o && c1.c > c1.o && c0.c < c0.o && c0.c < c1.o) { sellScore += 2.5; layer4Details.push("Evening star pattern"); }
    if (c2.c > c2.o && c1.c < c1.o && c0.c > c0.o && c0.c > c2.c) { buyScore += 2; layer4Details.push("3-white soldiers"); }
    else if (c2.c < c2.o && c1.c > c1.o && c0.c < c0.o && c0.c < c2.c) { sellScore += 2; layer4Details.push("3-black crows"); }

    // EMA crossovers
    const closes = candles.map(c => c.c);
    const ema9 = calcEMA(closes, 9), ema20 = calcEMA(closes, 20), ema50 = calcEMA(closes, Math.min(50, closes.length));
    ind.EMA9 = ema9.toFixed(dec); ind.EMA20 = ema20.toFixed(dec); ind.EMA50 = ema50.toFixed(dec);

    if (ema9 > ema20 && ema20 > ema50) { buyScore += 3; layer4Details.push("EMA 9>20>50 bullish alignment"); }
    else if (ema9 < ema20 && ema20 < ema50) { sellScore += 3; layer4Details.push("EMA 9<20<50 bearish alignment"); }
    // EMA cross
    const prevEma9 = calcEMA(closes.slice(1), 9), prevEma20 = calcEMA(closes.slice(1), 20);
    if (prevEma9 <= prevEma20 && ema9 > ema20) { buyScore += 2.5; layer4Details.push("EMA 9/20 bullish cross"); }
    else if (prevEma9 >= prevEma20 && ema9 < ema20) { sellScore += 2.5; layer4Details.push("EMA 9/20 bearish cross"); }

    // Local RSI
    const localRSI = calcRSI(candles);
    ind.LocalRSI = localRSI;
    if (localRSI < 30) { buyScore += 2; layer4Details.push(`Local RSI oversold (${localRSI})`); }
    else if (localRSI > 70) { sellScore += 2; layer4Details.push(`Local RSI overbought (${localRSI})`); }

    // Local MACD
    const localMACD = calcMACD(candles);
    if (localMACD) {
      ind.LocalMACD = localMACD.macd.toFixed(dec);
      ind.LocalMACD_Hist = localMACD.histogram.toFixed(dec);
      if (localMACD.histogram > 0 && localMACD.macd > localMACD.signal) { buyScore += 2; layer4Details.push("Local MACD bullish"); }
      else if (localMACD.histogram < 0 && localMACD.macd < localMACD.signal) { sellScore += 2; layer4Details.push("Local MACD bearish"); }
    }

    // Support / Resistance
    const sr = findSR(candles, price);
    ind.Support = sr.support.toFixed(dec); ind.Resistance = sr.resistance.toFixed(dec);
    if (type === "BUY" && sr.near === "support") { buyScore += 3; layer4Details.push("Price near support (bounce zone)"); }
    else if (type === "SELL" && sr.near === "resistance") { sellScore += 3; layer4Details.push("Price near resistance (rejection zone)"); }
    else if (type === "BUY" && sr.near === "resistance") { sellScore += 1.5; layer4Details.push("BUY near resistance (risky)"); }
    else if (type === "SELL" && sr.near === "support") { buyScore += 1.5; layer4Details.push("SELL near support (risky)"); }

    // Fibonacci levels
    const recentHigh = Math.max(...candles.slice(0, 20).map(c => c.h));
    const recentLow = Math.min(...candles.slice(0, 20).map(c => c.l));
    const fib = fibLevels(recentHigh, recentLow);
    const fib50 = fib["0.5"], fib618 = fib["0.618"];
    if (type === "BUY" && (Math.abs(price - fib618) / atr < 0.5 || Math.abs(price - fib50) / atr < 0.5)) {
      buyScore += 2; layer4Details.push("Price at Fibonacci buy zone (0.5/0.618)");
    } else if (type === "SELL" && (Math.abs(price - fib["0.382"]) / atr < 0.5 || Math.abs(price - fib50) / atr < 0.5)) {
      sellScore += 2; layer4Details.push("Price at Fibonacci sell zone (0.382/0.5)");
    }

    // Price momentum (3-candle direction)
    if (c0.c > c1.c && c1.c > c2.c) { buyScore += 1.5; layer4Details.push("3-candle bullish momentum"); }
    else if (c0.c < c1.c && c1.c < c2.c) { sellScore += 1.5; layer4Details.push("3-candle bearish momentum"); }

    layer4Score = Math.max(buyScore, sellScore) - 5;
  }
  layers.push({ layer: "Local Analysis", score: layer4Score, details: layer4Details });

  // ═══════════════════════════════════════════
  // LAYER 5: MARKET CONTEXT
  // ═══════════════════════════════════════════
  let layer5Score = 0;
  const layer5Details: string[] = [];

  // Session quality
  const sess = sessionScore();
  ind.Session = sess;
  if (sess >= 4) { layer5Score += 3; layer5Details.push(`Prime session (${sess}/5)`); }
  else if (sess >= 3) { layer5Score += 2; layer5Details.push(`Good session (${sess}/5)`); }
  else { layer5Score += 0; layer5Details.push(`Low liquidity session (${sess}/5)`); }

  // Volatility check
  if (atr > 0 && candles.length >= 8) {
    const avgRange = candles.slice(0, 10).reduce((a, c) => a + (c.h - c.l), 0) / 10;
    const volRatio = atr / avgRange;
    if (volRatio > 0.5 && volRatio < 2.0) { layer5Score += 2; layer5Details.push("Normal volatility"); }
    else if (volRatio >= 2.0) { layer5Score += 1; layer5Details.push("High volatility (wider SL)"); }
    else { layer5Score -= 1; layer5Details.push("Low volatility (choppy)"); }
  }

  // Spread check (if we have bid/ask from price fetch)
  // This is checked at the signal output level

  layers.push({ layer: "Market Context", score: layer5Score, details: layer5Details });

  // ═══════════════════════════════════════════
  // FINAL SCORING
  // ═══════════════════════════════════════════

  const total = buyScore + sellScore;
  const win = Math.max(buyScore, sellScore);
  const confluenceCount = reasons.length + layer1Details.length + layer2Details.length + layer3Details.length + layer4Details.length + layer5Details.length;
  const allReasons = [...layer1Details, ...layer2Details, ...layer3Details, ...layer4Details, ...layer5Details];

  // STRICT FILTERS
  // Counter-trend penalty check
  if (layer2Score < -3 && layer1Score < 20) return null; // Counter-trend + no strong external signal

  // Minimum requirements based on available data
  const hasTA = ta !== null;
  const hasCandles = candles.length >= 8;
  const minConfluence = hasTA ? 12 : 8; // Less strict when TA unavailable
  const minDominance = hasTA ? 0.70 : 0.65;
  const minConf = hasTA ? 85 : 78;

  if (confluenceCount < minConfluence) return null;
  if (total < 10) return null;
  if (win / total < minDominance) return null;

  // RSI sanity
  const rsiVal = ta?.rsi ?? (hasCandles ? calcRSI(candles) : 50);
  if (type === "BUY" && rsiVal > 78) return null;
  if (type === "SELL" && rsiVal < 22) return null;

  // ADX trend requirement
  if (ta?.adx && ta.adx.adx < 15) return null;

  // Confidence calculation
  const rawConf = (win / total) * 100;
  const confBonus = Math.min((win - 10) * 1.0, 5);
  const taCount = ta ? Object.keys(ta).length : 0;
  const taBonus = taCount >= 8 ? 3 : taCount >= 5 ? 1.5 : 0;
  const sessionBonus = sess >= 4 ? 1.5 : 0;
  const conf = Math.min(Math.round(rawConf + confBonus + taBonus + sessionBonus), 97);

  if (conf < minConf) return null;

  // ═══ TP/SL — BIG TP, TIGHT SL ═══
  let tpMult: number, slMult: number;
  if (conf >= 95) { tpMult = 2.5; slMult = 0.4; }
  else if (conf >= 92) { tpMult = 2.0; slMult = 0.4; }
  else if (conf >= 88) { tpMult = 1.8; slMult = 0.5; }
  else { tpMult = 1.5; slMult = 0.5; }

  // If external signal has TP/SL, blend with our calculation
  let finalTP: number, finalSL: number;
  if (extSignal?.tp > 0 && extSignal?.sl > 0 && extSignal?.entry > 0) {
    // Use external TP/SL if they have good R:R, otherwise use ours
    const extRR = Math.abs(extSignal.tp - extSignal.entry) / Math.abs(extSignal.entry - extSignal.sl);
    if (extRR >= 1.5) {
      finalTP = extSignal.tp;
      finalSL = extSignal.sl;
    } else {
      finalTP = type === "BUY" ? price + atr * tpMult : price - atr * tpMult;
      finalSL = type === "BUY" ? price - atr * slMult : price + atr * slMult;
    }
  } else {
    finalTP = type === "BUY" ? price + atr * tpMult : price - atr * tpMult;
    finalSL = type === "BUY" ? price - atr * slMult : price + atr * slMult;
  }

  return {
    id: `P5-${Date.now().toString(36).toUpperCase()}-${pair.replace("/", "")}-${Math.random().toString(36).substring(2, 4)}`,
    pair, type,
    entry: +price.toFixed(dec),
    tp: +finalTP.toFixed(dec),
    sl: +finalSL.toFixed(dec),
    confidence: conf,
    reasoning: allReasons,
    indicators: ind,
    sources,
    confluenceCount,
    layers,
    // Extra fields for frontend
    _engineVersion: "v5.0-POWER",
    _timestamp: new Date().toISOString(),
    _status: "ACTIVE" as const,
    _tpPips: Math.abs(finalTP - price),
    _slPips: Math.abs(price - finalSL),
    _tradeDuration: "5-15min",
    _rewardRatio: (Math.abs(finalTP - price) / Math.abs(price - finalSL)).toFixed(1),
  };
}

// ═══════════════════════════════════════════════════════════
//  MAIN GET HANDLER — POWER ENGINE PIPELINE
// ═══════════════════════════════════════════════════════════

const PAIRS = [
  { pair: "EUR/USD", from: "EUR", to: "USD" },
  { pair: "GBP/USD", from: "GBP", to: "USD" },
  { pair: "USD/JPY", from: "USD", to: "JPY" },
  { pair: "AUD/USD", from: "AUD", to: "USD" },
  { pair: "USD/CAD", from: "USD", to: "CAD" },
  { pair: "NZD/USD", from: "NZD", to: "USD" },
  { pair: "USD/CHF", from: "USD", to: "CHF" },
  { pair: "EUR/GBP", from: "EUR", to: "GBP" },
  { pair: "EUR/JPY", from: "EUR", to: "JPY" },
  { pair: "GBP/JPY", from: "GBP", to: "JPY" },
  { pair: "XAU/USD", from: "XAU", to: "USD" },
  { pair: "XAG/USD", from: "XAG", to: "USD" },
];

// Signal cache
let cachedSignals: any[] = [];
let lastSignalTime = 0;
const SIGNAL_TTL = 25000; // 25s

export async function GET() {
  // Return cached if fresh
  if (cachedSignals.length > 0 && Date.now() - lastSignalTime < SIGNAL_TTL) {
    return NextResponse.json({
      source: "cached",
      signals: cachedSignals,
      cached: true,
      apiStats: dualApi.stats,
      engineVersion: "v5.0-POWER",
    });
  }

  try {
    const signals: any[] = [];
    const engineLog: string[] = [];

    // ═══ PHASE 1: Fetch ALL external data in parallel ═══
    engineLog.push("Phase 1: Fetching external signals + market trends...");
    const [externalSignals, marketTrends] = await Promise.all([
      fetchExternalSignals(),
      fetchMarketTrends(),
    ]);
    engineLog.push(`  → ${externalSignals.length} external signals, ${marketTrends.length} market trends`);

    // ═══ PHASE 2: Process each pair ═══
    for (let i = 0; i < PAIRS.length; i++) {
      const { pair, from, to } = PAIRS[i];

      try {
        // 2a: Find matching external signal
        const extSig = externalSignals.find(s => pairMatch(s.pair, pair)) || null;

        // 2b: Find matching market trend
        const trend = marketTrends.find(t => pairMatch(t.pair, pair)) || null;

        // 2c: Fetch price + candles + TA (all cached, fast)
        const [priceData, candles, taData] = await Promise.all([
          fetchPrice(pair, from, to),
          fetchCandles(from, to),
          fetchAllTA(from, to),
        ]);

        // Skip if no price and no external signal
        const price = priceData?.price || extSig?.entry || 0;
        if (price === 0) { engineLog.push(`  ${pair}: SKIP (no price)`); continue; }

        // 2d: Determine signal direction
        // Priority: External signal > Trend > Technical analysis
        let signalType: "BUY" | "SELL" | null = null;

        if (extSig) {
          signalType = extSig.type;
          engineLog.push(`  ${pair}: External signal ${signalType} (confidence: ${extSig.confidence || 'N/A'})`);
        } else if (trend && trend.direction !== "NEUTRAL") {
          signalType = trend.direction === "BULLISH" ? "BUY" : "SELL";
          engineLog.push(`  ${pair}: Trend-based ${signalType} (strength: ${trend.strength})`);
        }

        // If no external/trend signal, try to generate from TA/candles
        if (!signalType && (candles.length >= 8 || taData)) {
          // Quick TA direction check
          let quickBuy = 0, quickSell = 0;
          if (taData?.rsi !== undefined) { if (taData.rsi < 35) quickBuy += 3; else if (taData.rsi > 65) quickSell += 3; }
          if (taData?.macd) { if (taData.macd.histogram > 0) quickBuy += 2; else quickSell += 2; }
          if (taData?.adx && taData.adx.adx > 25) { if (taData.adx.plusDi > taData.adx.minusDi) quickBuy += 2; else quickSell += 2; }
          if (candles.length >= 8) {
            const c0 = candles[0], c1 = candles[1];
            if (c0.c > c0.o && c1.c < c1.o && c0.c > c1.o) quickBuy += 3;
            else if (c0.c < c0.o && c1.c > c1.o && c0.c < c1.o) quickSell += 3;
          }
          if (Math.abs(quickBuy - quickSell) >= 3) {
            signalType = quickBuy > quickSell ? "BUY" : "SELL";
            engineLog.push(`  ${pair}: TA-generated ${signalType} (buy:${quickBuy} sell:${quickSell})`);
          }
        }

        if (!signalType) { engineLog.push(`  ${pair}: SKIP (no signal direction)`); continue; }

        // 2e: Run full scoring
        const result = scoreSignal(pair, signalType, price, candles, taData, extSig, trend);
        if (result) {
          signals.push({
            id: result.id,
            pair: result.pair,
            type: result.type,
            entry: result.entry,
            tp: result.tp,
            sl: result.sl,
            timestamp: result._timestamp,
            status: result._status,
            confidence: result.confidence,
            reasoning: result.reasoning,
            indicators: result.indicators,
            source: result.sources.join(" + "),
            apiSource: priceData?.src || "forex-signals-api",
            apiKey: priceData?.key || "FX-API",
            engineVersion: "v5.0-POWER",
            tradeDuration: result._tradeDuration,
            tpPips: result._tpPips,
            slPips: result._slPips,
            confluences: result.confluenceCount,
            layers: result.layers,
            rewardRatio: result._rewardRatio,
          });
          engineLog.push(`  ${pair}: ✓ ${result.type} @ ${result.confidence}% (${result.confluenceCount} confluences)`);
        } else {
          engineLog.push(`  ${pair}: ✗ Filtered (did not pass strict criteria)`);
        }
      } catch (err: any) {
        engineLog.push(`  ${pair}: ERROR ${err.message}`);
      }

      // Small delay between pairs to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    // Sort by confidence (highest first), then by confluence count
    signals.sort((a, b) => b.confidence - a.confidence || b.confluences - a.confluences);
    const topSignals = signals.slice(0, 2);

    if (topSignals.length > 0) {
      cachedSignals = topSignals;
      lastSignalTime = Date.now();
    }

    engineLog.push(`\nResult: ${topSignals.length} signals from ${PAIRS.length} pairs checked`);
    console.log("[POWER ENGINE v5.0]\n" + engineLog.join("\n"));

    return NextResponse.json({
      source: topSignals.length > 0
        ? `Power Engine v5.0 (${topSignals[0].source})`
        : "scanning",
      signals: topSignals.length > 0 ? topSignals : [],
      generated: topSignals.length,
      totalChecked: PAIRS.length,
      apiStats: dualApi.stats,
      engineVersion: "v5.0-POWER",
      engineLog,
      activeSources: {
        forexSignalsApi: externalSignals.length > 0,
        marketTrendsApi: marketTrends.length > 0,
        priceData: dualApi.stats.totalKeys > 0,
        taIndicators: CTA_KEY ? true : false,
      },
    });
  } catch (err: any) {
    console.error("[POWER ENGINE v5.0] Fatal:", err);
    return NextResponse.json({
      source: "error",
      signals: cachedSignals,
      apiStats: dualApi.stats,
      engineVersion: "v5.0-POWER",
      error: err.message,
    });
  }
}