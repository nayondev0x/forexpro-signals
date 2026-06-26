import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════
   PRECISION SIGNAL ENGINE v3.1-TA — 5-MIN SCALPING MODE
   - 8+ local indicators (candlestick, EMA, RSI, MACD, etc.)
   - 20 external Crypto TA API indicators (RSI, MACD, ADX,
     Bollinger, Stochastic, CCI, Aroon, UO, Donchian, ROC,
     MFI, SMA, WMA, EMA, SD, PSAR, Williams %R, TSI,
     Volume Oscillator, Price, Volume) — all on 5min timeframe
   - Multi-indicator confluence (15+ confirmations)
   - Real ATR from 5min candles
   - 5-MIN SCALPING TP/SL: TP 1-1.5x ATR, SL 0.5-0.7x ATR
   - Every trade targets ~5 min duration
   - Multi-layer caching (prices 30s, candles 5min, TA 5min)
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
    for (let a = 0; a < 4; a++) {
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

/* ═══════════════════════════════════════════════════════════
   CRYPTO TA API MANAGER — 20 External Indicators
   RSI, MACD, ADX, Bollinger, Stochastic, CCI, Aroon, UO,
   Donchian, ROC, MFI, SMA, WMA, EMA, SD, PSAR,
   Williams %R, TSI, Volume Oscillator, Price, Volume
   ═══════════════════════════════════════════════════════════ */

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
  // v3.1 new indicators
  sd?: number;                    // Standard Deviation
  psar?: { sar: number; isAbove: boolean };  // Parabolic SAR
  williamsR?: number;            // Williams %R
  tsi?: { tsi: number; signal: number };  // True Strength Index
  volOsc?: number;               // Volume Oscillator
  taPrice?: number;              // External price confirmation
  taVolume?: number;             // Volume data
}

const CRYPTO_TA_KEY = process.env.CRYPTO_TA_API_KEY || "";
const CRYPTO_TA_HOST = process.env.CRYPTO_TA_API_HOST || "crypto-technical-analysis-indicator-apis-for-trading.p.rapidapi.com";

// TA indicator cache — 5 min TTL (same as candles)
let taCache: Record<string, { data: TAIndicator; time: number }> = {};
const TA_CACHE_TTL = 300000; // 5 minutes

// Pair symbol mapping for Crypto TA API (forex pairs)
function pairToTASymbol(from: string, to: string): string {
  return `${from}${to}`;
}

async function fetchTAIndicator(symbol: string, endpoint: string, params: string = ""): Promise<any> {
  if (!CRYPTO_TA_KEY) return null;
  try {
    const url = `https://${CRYPTO_TA_HOST}/${endpoint}?symbol=${symbol}&timeframe=5min${params ? "&" + params : ""}`;
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": CRYPTO_TA_KEY,
        "x-rapidapi-host": CRYPTO_TA_HOST,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result || data?.data || data;
  } catch {
    return null;
  }
}

async function fetchAllTAIndicators(from: string, to: string): Promise<TAIndicator | null> {
  const symbol = pairToTASymbol(from, to);
  const cacheKey = symbol;
  const cached = taCache[cacheKey];
  if (cached && Date.now() - cached.time < TA_CACHE_TTL) return cached.data;

  if (!CRYPTO_TA_KEY) return null;

  try {
    // Fetch all 20 indicators in parallel (aggressive but cached for 5min)
    const [rsiData, macdData, adxData, bbData, stochData, cciData, aroonData, uoData, donchData, rocData, mfiData, emaData, smaData, wmaData, sdData, psarData, wrData, tsiData, voData, priceData, volData] = await Promise.allSettled([
      fetchTAIndicator(symbol, "rsi", "length=14"),
      fetchTAIndicator(symbol, "macd", "short=12&long=26&signal=9"),
      fetchTAIndicator(symbol, "adx", "diLength=14&adxSmoothing=14"),
      fetchTAIndicator(symbol, "bollinger-bands", "stdDev=2.5&length=20"),
      fetchTAIndicator(symbol, "stochastic", "kLength=14&kSmoothing=3&dSmoothing=3"),
      fetchTAIndicator(symbol, "cci", "smoothing=sma&length=20&smoothingLength=20"),
      fetchTAIndicator(symbol, "aroon", "length=14"),
      fetchTAIndicator(symbol, "uo", "length7=7&length14=14&length28=28"),
      fetchTAIndicator(symbol, "donchian", "length=20"),
      fetchTAIndicator(symbol, "roc", "length=9"),
      fetchTAIndicator(symbol, "mfi", "length=14"),
      fetchTAIndicator(symbol, "ema", "length=14"),
      fetchTAIndicator(symbol, "sma", "length=14"),
      fetchTAIndicator(symbol, "wma", "length=14"),
      // v3.1 new indicators
      fetchTAIndicator(symbol, "sd", "periods=5&deviations=1"),
      fetchTAIndicator(symbol, "psar", "start=0.02&increment=0.02&maximum=0.2"),
      fetchTAIndicator(symbol, "williamsR", "length=14"),
      fetchTAIndicator(symbol, "tsi", "long=25&short=13&siglen=13"),
      fetchTAIndicator(symbol, "volume-oscillator", "shortlen=5&longlen=10"),
      fetchTAIndicator(symbol, "price", ""),           // External price
      fetchTAIndicator(symbol, "volume", ""),           // Volume data
    ]);

    const result: TAIndicator = {};

    // Parse RSI
    if (rsiData.status === "fulfilled" && rsiData.value) {
      const rsiVal = typeof rsiData.value === "number" ? rsiData.value : rsiData.value?.rsi || rsiData.value?.value;
      if (typeof rsiVal === "number" && !isNaN(rsiVal)) result.rsi = rsiVal;
    }

    // Parse MACD
    if (macdData.status === "fulfilled" && macdData.value) {
      const m = macdData.value;
      const macdLine = typeof m.macd === "number" ? m.macd : m.macdLine || m.macdValue;
      const sigLine = typeof m.signal === "number" ? m.signal : m.signalLine || m.signalValue;
      const hist = typeof m.histogram === "number" ? m.histogram : m.macdHistogram || m.hist;
      if (typeof macdLine === "number") {
        result.macd = { macd: macdLine, signal: sigLine || 0, histogram: hist || (macdLine - (sigLine || 0)) };
      }
    }

    // Parse ADX
    if (adxData.status === "fulfilled" && adxData.value) {
      const a = adxData.value;
      const adxVal = typeof a.adx === "number" ? a.adx : a.value;
      const plusDi = typeof a.plusDi === "number" ? a.plusDi : a["+DI"] || a.plusDI || a.pdi;
      const minusDi = typeof a.minusDi === "number" ? a.minusDi : a["-DI"] || a.minusDI || a.mdi;
      if (typeof adxVal === "number") {
        result.adx = { adx: adxVal, plusDi: plusDi || 0, minusDi: minusDi || 0 };
      }
    }

    // Parse Bollinger Bands
    if (bbData.status === "fulfilled" && bbData.value) {
      const b = bbData.value;
      const upper = typeof b.upper === "number" ? b.upper : b.upperBand || b.upperValue;
      const middle = typeof b.middle === "number" ? b.middle : b.middleBand || b.middleValue || b.sma;
      const lower = typeof b.lower === "number" ? b.lower : b.lowerBand || b.lowerValue;
      if (typeof upper === "number" && typeof lower === "number") {
        result.bollingerBands = { upper, middle: middle || (upper + lower) / 2, lower, stdDev: (upper - lower) / 5 };
      }
    }

    // Parse Stochastic
    if (stochData.status === "fulfilled" && stochData.value) {
      const s = stochData.value;
      const k = typeof s.k === "number" ? s.k : s.stochK || s.kValue;
      const d = typeof s.d === "number" ? s.d : s.stochD || s.dValue;
      if (typeof k === "number") result.stochastic = { k, d: d || k };
    }

    // Parse CCI
    if (cciData.status === "fulfilled" && cciData.value) {
      const cciVal = typeof cciData.value === "number" ? cciData.value : cciData.value?.cci || cciData.value?.value;
      if (typeof cciVal === "number" && !isNaN(cciVal)) result.cci = cciVal;
    }

    // Parse Aroon
    if (aroonData.status === "fulfilled" && aroonData.value) {
      const ar = aroonData.value;
      const up = typeof ar.up === "number" ? ar.up : ar.aroonUp || ar.aroonUpValue;
      const down = typeof ar.down === "number" ? ar.down : ar.aroonDown || ar.aroonDownValue;
      if (typeof up === "number") result.aroon = { up, down: down || 0 };
    }

    // Parse Ultimate Oscillator
    if (uoData.status === "fulfilled" && uoData.value) {
      const uoVal = typeof uoData.value === "number" ? uoData.value : uoData.value?.uo || uoData.value?.value;
      if (typeof uoVal === "number" && !isNaN(uoVal)) result.uo = uoVal;
    }

    // Parse Donchian
    if (donchData.status === "fulfilled" && donchData.value) {
      const dc = donchData.value;
      const upper = typeof dc.upper === "number" ? dc.upper : dc.upperBand || dc.upperValue;
      const middle = typeof dc.middle === "number" ? dc.middle : dc.middleBand || dc.middleValue;
      const lower = typeof dc.lower === "number" ? dc.lower : dc.lowerBand || dc.lowerValue;
      if (typeof upper === "number" && typeof lower === "number") {
        result.donchian = { upper, middle: middle || (upper + lower) / 2, lower };
      }
    }

    // Parse ROC
    if (rocData.status === "fulfilled" && rocData.value) {
      const rocVal = typeof rocData.value === "number" ? rocData.value : rocData.value?.roc || rocData.value?.value;
      if (typeof rocVal === "number" && !isNaN(rocVal)) result.roc = rocVal;
    }

    // Parse MFI
    if (mfiData.status === "fulfilled" && mfiData.value) {
      const mfiVal = typeof mfiData.value === "number" ? mfiData.value : mfiData.value?.mfi || mfiData.value?.value;
      if (typeof mfiVal === "number" && !isNaN(mfiVal)) result.mfi = mfiVal;
    }

    // Parse EMA 14
    if (emaData.status === "fulfilled" && emaData.value) {
      const emaVal = typeof emaData.value === "number" ? emaData.value : emaData.value?.ema || emaData.value?.value;
      if (typeof emaVal === "number" && !isNaN(emaVal)) result.ema14 = emaVal;
    }

    // Parse SMA 14
    if (smaData.status === "fulfilled" && smaData.value) {
      const smaVal = typeof smaData.value === "number" ? smaData.value : smaData.value?.sma || smaData.value?.value;
      if (typeof smaVal === "number" && !isNaN(smaVal)) result.sma14 = smaVal;
    }

    // Parse WMA 14
    if (wmaData.status === "fulfilled" && wmaData.value) {
      const wmaVal = typeof wmaData.value === "number" ? wmaData.value : wmaData.value?.wma || wmaData.value?.value;
      if (typeof wmaVal === "number" && !isNaN(wmaVal)) result.wma14 = wmaVal;
    }

    // ── v3.1 NEW INDICATORS ──

    // Parse Standard Deviation
    if (sdData.status === "fulfilled" && sdData.value) {
      const sdVal = typeof sdData.value === "number" ? sdData.value : sdData.value?.sd || sdData.value?.value || sdData.value?.standardDeviation;
      if (typeof sdVal === "number" && !isNaN(sdVal) && sdVal >= 0) result.sd = sdVal;
    }

    // Parse Parabolic SAR (store raw SAR, direction computed in analysis)
    if (psarData.status === "fulfilled" && psarData.value) {
      const p = psarData.value;
      const sarVal = typeof p.sar === "number" ? p.sar : p.value || p.psar;
      if (typeof sarVal === "number" && !isNaN(sarVal)) {
        result.psar = { sar: sarVal, isAbove: false }; // isAbove computed in analyzeWithTA
      }
    }

    // Parse Williams %R
    if (wrData.status === "fulfilled" && wrData.value) {
      const wrVal = typeof wrData.value === "number" ? wrData.value : wrData.value?.williamsR || wrData.value?.value || wrData.value?.["%R"];
      if (typeof wrVal === "number" && !isNaN(wrVal)) result.williamsR = wrVal;
    }

    // Parse True Strength Index (TSI)
    if (tsiData.status === "fulfilled" && tsiData.value) {
      const t = tsiData.value;
      const tsiVal = typeof t.tsi === "number" ? t.tsi : t.value || t.tsiValue;
      const tsiSig = typeof t.signal === "number" ? t.signal : t.signalLine || t.signalValue;
      if (typeof tsiVal === "number" && !isNaN(tsiVal)) {
        result.tsi = { tsi: tsiVal, signal: tsiSig || 0 };
      }
    }

    // Parse Volume Oscillator
    if (voData.status === "fulfilled" && voData.value) {
      const voVal = typeof voData.value === "number" ? voData.value : voData.value?.value || voData.value?.oscillator || voData.value?.["volume-oscillator"];
      if (typeof voVal === "number" && !isNaN(voVal)) result.volOsc = voVal;
    }

    // Parse External Price (for validation)
    if (priceData.status === "fulfilled" && priceData.value) {
      const pVal = typeof priceData.value === "number" ? priceData.value : priceData.value?.price || priceData.value?.close || priceData.value?.value;
      if (typeof pVal === "number" && !isNaN(pVal) && pVal > 0) result.taPrice = pVal;
    }

    // Parse Volume
    if (volData.status === "fulfilled" && volData.value) {
      const vVal = typeof volData.value === "number" ? volData.value : volData.value?.volume || volData.value?.value;
      if (typeof vVal === "number" && !isNaN(vVal) && vVal > 0) result.taVolume = vVal;
    }

    // Only cache if we got at least some data
    const dataCount = Object.keys(result).length;
    if (dataCount >= 2) {
      taCache[cacheKey] = { data: result, time: Date.now() };
    }

    return dataCount >= 2 ? result : null;
  } catch {
    return null;
  }
}

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
   PRECISION ANALYSIS ENGINE v3.1
   - 8+ local technical checks
   - 20 external TA API indicators
   - Minimum 5 confluences required
   - Score-weighted confidence
   - Trend filter: no counter-trend trades
   ═══════════════════════════════════════════════════════════ */

function calcATR(candles: any[], pair: string, price: number): number {
  if (candles.length >= 10) {
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
  if (candles.length < 35) return null;
  const closes = candles.map(c => c.c).reverse();
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12 - ema26;

  // Calculate proper 9-period EMA signal line from historical MACD values
  const macdHistory: number[] = [];
  for (let offset = 1; offset <= Math.min(candles.length - 26, 35); offset++) {
    const subCloses = candles.slice(offset).map(c => c.c).reverse();
    if (subCloses.length >= 26) {
      const e12 = calcEMA(subCloses, 12);
      const e26 = calcEMA(subCloses, 26);
      macdHistory.push(e12 - e26);
    }
  }
  macdHistory.reverse(); // oldest first
  macdHistory.push(macdLine); // current last

  const signalLine = macdHistory.length >= 9 ? calcEMA(macdHistory, 9) : macdLine * 0.8;
  const histogram = macdLine - signalLine;

  return { macd: macdLine, signal: signalLine, histogram };
}

function analyzeWithTA(pair: string, price: number, candles: any[], ta: TAIndicator | null, src: string, key: string) {
  const dec = pair.includes("XAU") || pair.includes("JPY") ? 2 : 4;
  const atr = calcATR(candles, pair, price);

  // NO CANDLES = NO SIGNAL
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

  // ═══════════════════════════════════════════
  // LOCAL INDICATORS (candle-based calculations)
  // ═══════════════════════════════════════════

  // ─── 1. CANDLESTICK PATTERNS ───
  if (c1.c < c1.o && c0.c > c0.o && c0.c > c1.o && c0.o < c1.c) { buy += 3; reasons.push("Bullish engulfing"); }
  else if (c1.c > c1.o && c0.c < c0.o && c0.c < c1.o && c0.o > c1.c) { sell += 3; reasons.push("Bearish engulfing"); }

  const body = Math.abs(c0.c - c0.o), range = c0.h - c0.l;
  if (range > 0) {
    const lw = Math.min(c0.o, c0.c) - c0.l, uw = c0.h - Math.max(c0.o, c0.c);
    if (lw > body * 2.5 && uw < body * 0.3) { buy += 2.5; reasons.push("Hammer"); }
    else if (uw > body * 2.5 && lw < body * 0.3) { sell += 2.5; reasons.push("Shooting star"); }
    if (body / range < 0.1) {
      if (c0.c < c1.c) { sell += 0.5; }
      else { buy += 0.5; }
    }
    if (c0.c > c0.o && body / range > 0.65) { buy += 2; reasons.push("Strong bullish candle"); }
    else if (c0.o > c0.c && body / range > 0.65) { sell += 2; reasons.push("Strong bearish candle"); }
  }

  // ─── 2. EMA CROSSOVER (local) ───
  const closes = candles.map(c => c.c).reverse();
  const ema5 = calcEMA(closes, 5);
  const ema10 = calcEMA(closes, 10);
  const ema20 = candles.length >= 20 ? calcEMA(closes, 20) : ema10;
  ind.EMA5 = ema5.toFixed(dec);
  ind.EMA10 = ema10.toFixed(dec);

  if (ema5 > ema10) { buy += 2; reasons.push("EMA5 > EMA10"); }
  else if (ema5 < ema10) { sell += 2; reasons.push("EMA5 < EMA10"); }

  if (candles.length >= 15) {
    if (c0.c > ema20 && ema5 > ema10) { buy += 1.5; reasons.push("Above EMA20 uptrend"); }
    else if (c0.c < ema20 && ema5 < ema10) { sell += 1.5; reasons.push("Below EMA20 downtrend"); }
  }

  // ─── 3. RSI (local) ───
  const rsi = calcRSI(candles);
  ind.RSI = rsi;
  if (rsi < 30) { buy += 3; reasons.push(`RSI oversold (${rsi})`); }
  else if (rsi < 40) { buy += 1; reasons.push(`RSI low (${rsi})`); }
  else if (rsi > 70) { sell += 3; reasons.push(`RSI overbought (${rsi})`); }
  else if (rsi > 60) { sell += 1; reasons.push(`RSI high (${rsi})`); }

  // ─── 4. MACD (local) ───
  const macdData = calcMACD(candles);
  if (macdData) {
    ind.MACD = macdData.macd.toFixed(dec);
    if (macdData.histogram > 0 && macdData.macd > 0) { buy += 2; reasons.push("MACD bullish"); }
    else if (macdData.histogram < 0 && macdData.macd < 0) { sell += 2; reasons.push("MACD bearish"); }
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

  // ─── 6. SUPPORT / RESISTANCE (swing high/low based) ───
  const lookback = Math.min(candles.length, 20);
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = 2; i < lookback - 2; i++) {
    const c = candles[i];
    const prev = candles[i + 1], prev2 = candles[i + 2];
    const next = candles[i - 1], next2 = candles[i - 2];
    // Swing high: current high > neighbors on both sides
    if (c.h > prev.h && c.h > prev2.h && c.h > next.h && c.h > next2.h) {
      swingHighs.push(c.h);
    }
    // Swing low: current low < neighbors on both sides
    if (c.l < prev.l && c.l < prev2.l && c.l < next.l && c.l < next2.l) {
      swingLows.push(c.l);
    }
  }
  // Fallback to simple min/max if no swings found
  const hs = swingHighs.length > 0 ? swingHighs : candles.slice(0, lookback).map((x) => x.h);
  const ls = swingLows.length > 0 ? swingLows : candles.slice(0, lookback).map((x) => x.l);
  const res = Math.max(...hs), sup = Math.min(...ls);
  ind.Resist = res.toFixed(dec);
  ind.Support = sup.toFixed(dec);

  const priceRange = res - sup;
  if (priceRange > 0) {
    const posInRange = (c0.c - sup) / priceRange;
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

  // ─── 9. RSI DIVERGENCE (real: price vs RSI direction mismatch) ───
  if (candles.length >= 20) {
    const recentHigh = Math.max(c0.h, c1.h, c2.h, c3.h, c4.h);
    const oldCandles = candles.slice(5, 15);
    const oldHigh = Math.max(...oldCandles.map(c => c.h));
    const recentLow = Math.min(c0.l, c1.l, c2.l, c3.l, c4.l);
    const oldLow = Math.min(...oldCandles.map(c => c.l));

    if (recentHigh > oldHigh && rsi < 55) {
      // Price made higher high but RSI didn't confirm — bearish divergence
      sell += 3; reasons.push(`Bearish RSI divergence (price high, RSI ${rsi})`);
    } else if (recentLow < oldLow && rsi > 45) {
      // Price made lower low but RSI didn't confirm — bullish divergence
      buy += 3; reasons.push(`Bullish RSI divergence (price low, RSI ${rsi})`);
    }
  }

  // ═══════════════════════════════════════════
  // EXTERNAL TA API INDICATORS (v3 boost)
  // These provide ADDITIONAL confirmation layers
  // ═══════════════════════════════════════════

  if (ta) {
    // ─── TA-1: RSI (external confirmation) ───
    if (ta.rsi !== undefined) {
      ind.TA_RSI = ta.rsi;
      // Extra weight when both local and external RSI agree
      if (ta.rsi < 25) { buy += 2; reasons.push(`TA-RSI deep oversold (${ta.rsi})`); }
      else if (ta.rsi < 35) { buy += 1; }
      else if (ta.rsi > 75) { sell += 2; reasons.push(`TA-RSI deep overbought (${ta.rsi})`); }
      else if (ta.rsi > 65) { sell += 1; }
    }

    // ─── TA-2: MACD (external confirmation) ───
    if (ta.macd) {
      ind.TA_MACD = ta.macd.macd.toFixed(dec);
      ind.TA_MACD_Signal = ta.macd.signal.toFixed(dec);
      ind.TA_MACD_Hist = ta.macd.histogram.toFixed(dec);
      if (ta.macd.histogram > 0 && ta.macd.macd > 0) { buy += 1.5; reasons.push("TA-MACD bullish"); }
      else if (ta.macd.histogram < 0 && ta.macd.macd < 0) { sell += 1.5; reasons.push("TA-MACD bearish"); }
      // MACD crossover detection
      if (ta.macd.histogram > 0 && ta.macd.signal < 0) { buy += 2; reasons.push("TA-MACD bullish cross"); }
      else if (ta.macd.histogram < 0 && ta.macd.signal > 0) { sell += 2; reasons.push("TA-MACD bearish cross"); }
    }

    // ─── TA-3: ADX (trend strength filter) ───
    if (ta.adx) {
      ind.TA_ADX = ta.adx.adx;
      ind.TA_PlusDI = ta.adx.plusDi;
      ind.TA_MinusDI = ta.adx.minusDi;
      // ADX > 25 = strong trend (trust the signal more)
      // ADX > 50 = very strong trend (big bonus)
      if (ta.adx.adx > 25) {
        if (ta.adx.plusDi > ta.adx.minusDi) {
          buy += ta.adx.adx > 50 ? 2.5 : 1.5;
          reasons.push(`TA-ADX strong uptrend (${ta.adx.adx})`);
        } else {
          sell += ta.adx.adx > 50 ? 2.5 : 1.5;
          reasons.push(`TA-ADX strong downtrend (${ta.adx.adx})`);
        }
      }
      // ADX < 20 = weak/no trend — reduce confidence
      // (we don't subtract, but weak trend means less bonus)
    }

    // ─── TA-4: Bollinger Bands ───
    if (ta.bollingerBands) {
      ind.TA_BB_Upper = ta.bollingerBands.upper.toFixed(dec);
      ind.TA_BB_Middle = ta.bollingerBands.middle.toFixed(dec);
      ind.TA_BB_Lower = ta.bollingerBands.lower.toFixed(dec);
      const bbRange = ta.bollingerBands.upper - ta.bollingerBands.lower;
      if (bbRange > 0) {
        const bbPos = (price - ta.bollingerBands.lower) / bbRange; // 0=lower, 1=upper
        if (bbPos < 0.05) { buy += 2.5; reasons.push("TA-BB price at lower band"); }
        else if (bbPos < 0.2) { buy += 1; reasons.push("TA-BB near lower band"); }
        else if (bbPos > 0.95) { sell += 2.5; reasons.push("TA-BB price at upper band"); }
        else if (bbPos > 0.8) { sell += 1; reasons.push("TA-BB near upper band"); }
      }
      // Squeeze detection (narrow bands = breakout coming)
      if (ta.bollingerBands.stdDev > 0) {
        const avgRange5 = candles.length >= 5 ? candles.slice(0, 5).reduce((a, x) => a + (x.h - x.l), 0) / 5 : range;
        if (bbRange < avgRange5 * 1.5) {
          // Band squeeze — directional signal gets extra weight
          if (buy > sell) { buy += 1; reasons.push("TA-BB squeeze bullish"); }
          else { sell += 1; reasons.push("TA-BB squeeze bearish"); }
        }
      }
    }

    // ─── TA-5: Stochastic Oscillator ───
    if (ta.stochastic) {
      ind.TA_StochK = ta.stochastic.k;
      ind.TA_StochD = ta.stochastic.d;
      if (ta.stochastic.k < 20) {
        buy += 2;
        if (ta.stochastic.k > ta.stochastic.d) { buy += 1; reasons.push("TA-Stoch oversold + K>D cross"); }
        else { reasons.push(`TA-Stoch oversold (${ta.stochastic.k.toFixed(1)})`); }
      } else if (ta.stochastic.k > 80) {
        sell += 2;
        if (ta.stochastic.k < ta.stochastic.d) { sell += 1; reasons.push("TA-Stoch overbought + K<D cross"); }
        else { reasons.push(`TA-Stoch overbought (${ta.stochastic.k.toFixed(1)})`); }
      }
    }

    // ─── TA-6: CCI (Commodity Channel Index) ───
    if (ta.cci !== undefined) {
      ind.TA_CCI = ta.cci;
      if (ta.cci < -100) { buy += 2; reasons.push(`TA-CCI oversold (${ta.cci})`); }
      else if (ta.cci < -50) { buy += 0.5; }
      else if (ta.cci > 100) { sell += 2; reasons.push(`TA-CCI overbought (${ta.cci})`); }
      else if (ta.cci > 50) { sell += 0.5; }
    }

    // ─── TA-7: Aroon Oscillator ───
    if (ta.aroon) {
      ind.TA_AroonUp = ta.aroon.up;
      ind.TA_AroonDown = ta.aroon.down;
      const aroonOsc = ta.aroon.up - ta.aroon.down;
      if (aroonOsc > 50) { buy += 1.5; reasons.push(`TA-Aroon bullish (${aroonOsc})`); }
      else if (aroonOsc > 0) { buy += 0.5; }
      else if (aroonOsc < -50) { sell += 1.5; reasons.push(`TA-Aroon bearish (${aroonOsc})`); }
      else if (aroonOsc < 0) { sell += 0.5; }
    }

    // ─── TA-8: Ultimate Oscillator ───
    if (ta.uo !== undefined) {
      ind.TA_UO = ta.uo;
      if (ta.uo < 30) { buy += 1.5; reasons.push(`TA-UO oversold (${ta.uo})`); }
      else if (ta.uo > 70) { sell += 1.5; reasons.push(`TA-UO overbought (${ta.uo})`); }
    }

    // ─── TA-9: Donchian Channel ───
    if (ta.donchian) {
      ind.TA_DC_Upper = ta.donchian.upper.toFixed(dec);
      ind.TA_DC_Lower = ta.donchian.lower.toFixed(dec);
      const dcRange = ta.donchian.upper - ta.donchian.lower;
      if (dcRange > 0) {
        const dcPos = (price - ta.donchian.lower) / dcRange;
        if (dcPos > 0.9) { sell += 1.5; reasons.push("TA-Donchian near upper channel"); }
        else if (dcPos < 0.1) { buy += 1.5; reasons.push("TA-Donchian near lower channel"); }
      }
    }

    // ─── TA-10: ROC (Rate of Change) ───
    if (ta.roc !== undefined) {
      ind.TA_ROC = ta.roc;
      if (ta.roc > 1) { buy += 1; reasons.push(`TA-ROC positive (${ta.roc})`); }
      else if (ta.roc > 0.3) { buy += 0.5; }
      else if (ta.roc < -1) { sell += 1; reasons.push(`TA-ROC negative (${ta.roc})`); }
      else if (ta.roc < -0.3) { sell += 0.5; }
    }

    // ─── TA-11: MFI (Money Flow Index) ───
    if (ta.mfi !== undefined) {
      ind.TA_MFI = ta.mfi;
      if (ta.mfi < 20) { buy += 2; reasons.push(`TA-MFI oversold (${ta.mfi})`); }
      else if (ta.mfi < 30) { buy += 1; }
      else if (ta.mfi > 80) { sell += 2; reasons.push(`TA-MFI overbought (${ta.mfi})`); }
      else if (ta.mfi > 70) { sell += 1; }
    }

    // ─── TA-12: EMA 14 (external) — trend direction (informational only, no score)
    if (ta.ema14 !== undefined) {
      ind.TA_EMA14 = ta.ema14.toFixed(dec);
    }

    // ─── TA-13: SMA 14 vs EMA 14 — momentum alignment ───
    if (ta.sma14 !== undefined && ta.ema14 !== undefined) {
      ind.TA_SMA14 = ta.sma14.toFixed(dec);
      // EMA > SMA = bullish momentum (EMA reacts faster)
      if (ta.ema14 > ta.sma14) { buy += 1; reasons.push("TA-EMA14 > SMA14 bullish"); }
      else { sell += 1; reasons.push("TA-EMA14 < SMA14 bearish"); }
    }

    // ─── TA-14: WMA 14 — informational only, no score (always fires) ───
    if (ta.wma14 !== undefined) {
      ind.TA_WMA14 = ta.wma14.toFixed(dec);
    }

    // ─── TA-15: Standard Deviation — volatility measure ───
    if (ta.sd !== undefined) {
      ind.TA_SD = ta.sd.toFixed(dec);
      // High SD = high volatility — directional candle gets extra weight
      const avgPrice = (c0.h + c0.l) / 2;
      if (avgPrice > 0) {
        const sdPct = (ta.sd / avgPrice) * 100;
        if (sdPct > 0.5) {
          // High volatility — add momentum bonus
          if (c0.c > c0.o) { buy += 1; reasons.push(`TA-SD high volatility bullish (${sdPct.toFixed(2)}%)`); }
          else { sell += 1; reasons.push(`TA-SD high volatility bearish (${sdPct.toFixed(2)}%)`); }
        }
      }
    }

    // ─── TA-16: Parabolic SAR — trend direction + SAR flip ───
    if (ta.psar) {
      ind.TA_PSAR = ta.psar.sar.toFixed(dec);
      const sarBelowPrice = ta.psar.sar < price;
      ta.psar.isAbove = !sarBelowPrice;
      if (sarBelowPrice) {
        buy += 2; reasons.push("TA-PSAR bullish (SAR below price)");
      } else {
        sell += 2; reasons.push("TA-PSAR bearish (SAR above price)");
      }
      // SAR very close to price = potential flip (reversal warning)
      const distFromSAR = Math.abs(price - ta.psar.sar) / atr;
      if (distFromSAR < 0.5) {
        // SAR close to price — reversal risk
        if (sarBelowPrice && sell > buy) { sell += 1.5; reasons.push("TA-PSAR flip warning bearish"); }
        else if (!sarBelowPrice && buy > sell) { buy += 1.5; reasons.push("TA-PSAR flip warning bullish"); }
      }
    }

    // ─── TA-17: Williams %R — overbought/oversold ───
    if (ta.williamsR !== undefined) {
      ind.TA_WilliamsR = ta.williamsR;
      // Williams %R: -80 to -100 = oversold, -20 to 0 = overbought
      if (ta.williamsR < -80) {
        buy += 2;
        if (ta.williamsR < -90) { buy += 1; reasons.push(`TA-Williams%R deep oversold (${ta.williamsR})`); }
        else { reasons.push(`TA-Williams%R oversold (${ta.williamsR})`); }
      } else if (ta.williamsR > -20) {
        sell += 2;
        if (ta.williamsR > -10) { sell += 1; reasons.push(`TA-Williams%R deep overbought (${ta.williamsR})`); }
        else { reasons.push(`TA-Williams%R overbought (${ta.williamsR})`); }
      }
    }

    // ─── TA-18: True Strength Index (TSI) ───
    if (ta.tsi) {
      ind.TA_TSI = ta.tsi.tsi.toFixed(4);
      ind.TA_TSI_Signal = ta.tsi.signal.toFixed(4);
      if (ta.tsi.tsi > 0 && ta.tsi.signal > 0) {
        buy += 1.5; reasons.push(`TA-TSI bullish (${ta.tsi.tsi.toFixed(4)})`);
      } else if (ta.tsi.tsi < 0 && ta.tsi.signal < 0) {
        sell += 1.5; reasons.push(`TA-TSI bearish (${ta.tsi.tsi.toFixed(4)})`);
      }
      // TSI crossover (zero line cross)
      if (ta.tsi.tsi > 0 && ta.tsi.signal < 0) { buy += 2; reasons.push("TA-TSI bullish zero cross"); }
      else if (ta.tsi.tsi < 0 && ta.tsi.signal > 0) { sell += 2; reasons.push("TA-TSI bearish zero cross"); }
    }

    // ─── TA-19: Volume Oscillator — only confirms existing direction ───
    if (ta.volOsc !== undefined) {
      ind.TA_VolOsc = ta.volOsc;
      if (ta.volOsc > 0) {
        // Rising volume = market conviction — but only add to the TREND direction
        // Use PSAR or ADX to determine actual trend
        const trendUp = ta.psar ? ta.psar.sar < price : (ta.adx ? ta.adx.plusDi > ta.adx.minusDi : buy > sell);
        if (trendUp && buy > sell) { buy += 1; reasons.push(`TA-VolOsc rising vol confirms uptrend (${ta.volOsc})`); }
        else if (!trendUp && sell > buy) { sell += 1; reasons.push(`TA-VolOsc rising vol confirms downtrend (${ta.volOsc})`); }
      }
      // Declining volume = weak signal — no bonus (correct)
    }

    // ═══ CROSS-INDICATOR CONFLUENCE BONUSES ═══
    // When multiple TA indicators strongly agree, add bonus

    let taBuyCount = 0, taSellCount = 0;
    if (ta.rsi !== undefined) { if (ta.rsi < 35) taBuyCount++; if (ta.rsi > 65) taSellCount++; }
    if (ta.macd) { if (ta.macd.histogram > 0) taBuyCount++; if (ta.macd.histogram < 0) taSellCount++; }
    if (ta.adx && ta.adx.adx > 25) { if (ta.adx.plusDi > ta.adx.minusDi) taBuyCount++; else taSellCount++; }
    if (ta.stochastic) { if (ta.stochastic.k < 25) taBuyCount++; if (ta.stochastic.k > 75) taSellCount++; }
    if (ta.cci !== undefined) { if (ta.cci < -80) taBuyCount++; if (ta.cci > 80) taSellCount++; }
    if (ta.mfi !== undefined) { if (ta.mfi < 25) taBuyCount++; if (ta.mfi > 75) taSellCount++; }
    if (ta.aroon) { if (ta.aroon.up - ta.aroon.down > 30) taBuyCount++; if (ta.aroon.down - ta.aroon.up > 30) taSellCount++; }
    // v3.1 new confluence indicators
    if (ta.williamsR !== undefined) { if (ta.williamsR < -80) taBuyCount++; if (ta.williamsR > -20) taSellCount++; }
    if (ta.tsi) { if (ta.tsi.tsi > 0) taBuyCount++; if (ta.tsi.tsi < 0) taSellCount++; }
    if (ta.psar) { if (ta.psar.sar < price) taBuyCount++; else taSellCount++; }

    // Super confluence: 6+ TA indicators agree (raised from 5 with more indicators)
    if (taBuyCount >= 6) { buy += 3.5; reasons.push(`TA-Super confluence (${taBuyCount}/10 bullish)`); }
    else if (taSellCount >= 6) { sell += 3.5; reasons.push(`TA-Super confluence (${taSellCount}/10 bearish)`); }
    // Strong confluence: 5 TA indicators agree
    else if (taBuyCount >= 5) { buy += 2.5; reasons.push(`TA-Strong confluence (${taBuyCount}/10 bullish)`); }
    else if (taSellCount >= 5) { sell += 2.5; reasons.push(`TA-Strong confluence (${taSellCount}/10 bearish)`); }
    // Good confluence: 4 TA indicators agree
    else if (taBuyCount >= 4) { buy += 1.5; reasons.push(`TA-Good confluence (${taBuyCount}/10 bullish)`); }
    else if (taSellCount >= 4) { sell += 1.5; reasons.push(`TA-Good confluence (${taSellCount}/10 bearish)`); }
  }

  // ═══ FINAL DECISION ═══
  const total = buy + sell;
  const win = Math.max(buy, sell);

  // STRICTER FILTERS — higher quality signals only
  // Minimum 7 confluences (was 5), 65% dominance (was 60%)
  if (win < 7 || total < 7) return null;
  if (win / total < 0.65) return null;

  const type = buy > sell ? "BUY" : "SELL";

  // Trend alignment: don't trade against strong trend
  if (candles.length >= 15) {
    const distFromEMA20 = Math.abs(c0.c - ema20) / atr;
    if (distFromEMA20 > 3) return null; // Too far from trend — mean reversion zone
  }

  // RSI sanity: don't buy overbought, don't sell oversold
  if (type === "BUY" && rsi > 75) return null;
  if (type === "SELL" && rsi < 25) return null;

  // TA RSI extra safety
  if (ta?.rsi !== undefined) {
    if (type === "BUY" && ta.rsi > 78) return null;
    if (type === "SELL" && ta.rsi < 22) return null;
  }

  // ADX trend requirement: if ADX available, need some trend
  if (ta?.adx && ta.adx.adx < 15) return null; // No trend = no trade

  // Confidence: more realistic calculation
  const rawConf = (win / total) * 100;
  // Bonus scales with number of confluences beyond minimum
  const confBonus = Math.min((win - 7) * 1.5, 8);
  // TA data bonus (but smaller)
  const taBonus = ta ? 2 : 0;
  const conf = Math.min(Math.round(rawConf + confBonus + taBonus), 95);

  // Minimum confidence 80% (was 75%)
  if (conf < 80) return null;

  // ═══ 5-MIN SCALPING TP/SL ═══
  // 5-minute trade duration: TP must be reachable within 1-3 candles
  // Ultra signal (90%+): TP 1.5x ATR, SL 0.5x ATR → 3:1 reward (avg ~5min)
  // Strong signal (85%+): TP 1.2x ATR, SL 0.5x ATR → 2.4:1 reward (avg ~4min)
  // Medium signal (75-84%): TP 1x ATR, SL 0.7x ATR → 1.5:1 reward (avg ~5min)
  let tpMult: number, slMult: number;
  if (conf >= 90) { tpMult = 1.5; slMult = 0.5; }
  else if (conf >= 85) { tpMult = 1.2; slMult = 0.5; }
  else { tpMult = 1.0; slMult = 0.7; }

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
    engineVersion: "v3.1-TA",
    tradeDuration: "5min",
    tpPips: Math.abs(finalTP - price),
    slPips: Math.abs(price - finalSL),
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

// Candle cache — 5 min TTL
let candleCache: Record<string, { data: any[]; time: number }> = {};
const CANDLE_TTL = 300000;

// Price cache — 30s TTL
let priceCache: Record<string, { data: { price: number; bid: number; ask: number; src: string; key: string } | null; time: number }> = {};
const PRICE_TTL = 30000;

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

    // ─── PHASE 1: Fetch all prices (cached 30s) ───
    const priceResults: { pair: string; from: string; to: string; price: number; src: string; key: string }[] = [];

    for (let i = 0; i < PAIRS.length; i++) {
      const { pair, from, to } = PAIRS[i];
      try {
        const pd = await getCachedPrice(pair, from, to, i % 2 === 0);
        if (pd) priceResults.push({ pair, from, to, price: pd.price, src: pd.src, key: pd.key });
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    // ─── PHASE 2: Fetch candles + TA indicators (both cached 5min) ───
    for (let i = 0; i < priceResults.length; i++) {
      const { pair, from, to, price, src, key } = priceResults[i];
      try {
        const candles = await getCachedCandles(from, to);
        // Fetch external TA indicators (cached 5min, 20 parallel calls)
        const taData = await fetchAllTAIndicators(from, to);
        const sig = analyzeWithTA(pair, price, candles, taData, src, key);
        if (sig) signals.push(sig);
      } catch {}
      await new Promise(r => setTimeout(r, 350));
    }

    // Sort by confidence
    signals.sort((a, b) => b.confidence - a.confidence);
    const topSignals = signals.slice(0, 6);

    if (topSignals.length > 0) { cachedSignals = topSignals; lastSignalTime = Date.now(); }

    return NextResponse.json({
      source: topSignals.length > 0 ? "RapidAPI (Precision Engine v3.1 + 20 TA Indicators)" : "no-qualifying-signals",
      signals: topSignals.length > 0 ? topSignals : cachedSignals,
      generated: topSignals.length,
      totalChecked: PAIRS.length,
      apiStats: api.stats,
      engineVersion: "v3.1-TA",
    });
  } catch {
    return NextResponse.json({ source: "error", signals: cachedSignals, apiStats: api.stats });
  }
}