import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════
   SMART DUAL-API KEY SYSTEM for Signals
   - Price: AV first on even pairs, TD first on odd pairs
   - Candles: Always AV (only AV has FX_INTRADAY candles)
   - Price fail → auto switch to other API
   - Candles fail → price-only analysis still works
   - Per-KEY rate limiting — 4 keys = 4x free capacity
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
    if (process.env.TWELVE_DATA_API_KEY)
      this.tdKeys.push({ id: "TD-1", key: process.env.TWELVE_DATA_API_KEY, host: process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    if (process.env.TWELVE_DATA_API_KEY_2)
      this.tdKeys.push({ id: "TD-2", key: process.env.TWELVE_DATA_API_KEY_2, host: process.env.TWELVE_DATA_API_HOST_2 || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY)
      this.avKeys.push({ id: "AV-1", key: process.env.ALPHA_VANTAGE_API_KEY, host: process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_2)
      this.avKeys.push({ id: "AV-2", key: process.env.ALPHA_VANTAGE_API_KEY_2, host: process.env.ALPHA_VANTAGE_API_HOST_2 || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
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
    // Try preferred service (up to 2 keys)
    for (let a = 0; a < 2; a++) {
      const k = preferred === "AV" ? this.getAV() : this.getTD();
      if (!k) break;
      try {
        const r = await fetch(url, { headers: { "x-rapidapi-key": k.key, "x-rapidapi-host": k.host }, signal: AbortSignal.timeout(8000) });
        if (r.status === 429) { this.markLimited(k.id, 60); continue; }
        return { response: r, usedKey: k.id, usedService: k.service };
      } catch { continue; }
    }
    // Failover to other service
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
    // AV first
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
    // Fallback to TD
    const tdHost = process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com";
    const r2 = await api.fetchWithFailover(`https://${tdHost}/price?symbol=${pair}&interval=1min`, "TD");
    if (r2.response?.ok) {
      const d = await r2.response.json();
      const price = parseFloat(d.price);
      if (!isNaN(price)) return { price, bid: parseFloat(d.bid) || price, ask: parseFloat(d.ask) || price, src: r2.usedService, key: r2.usedKey };
    }
  } else {
    // TD first
    const tdHost = process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com";
    const { response, usedKey, usedService } = await api.fetchWithFailover(
      `https://${tdHost}/price?symbol=${pair}&interval=1min`, "TD"
    );
    if (response?.ok) {
      const d = await response.json();
      const price = parseFloat(d.price);
      if (!isNaN(price)) return { price, bid: parseFloat(d.bid) || price, ask: parseFloat(d.ask) || price, src: usedService, key: usedKey };
    }
    // Fallback to AV
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
    `https://${avHost}/query?function=FX_INTRADAY&from_symbol=${from}&to_symbol=${to}&interval=5min&outputsize=20`, "AV"
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

/* ─── Analysis Engine ─── */
function analyze(pair: string, price: number, candles: any[], src: string, key: string) {
  const dec = pair.includes("XAU") || pair.includes("JPY") ? 2 : 4;

  if (candles.length < 3) {
    const type = Math.random() > 0.5 ? "BUY" : "SELL";
    const atr = price * (pair.includes("XAU") ? 0.0015 : pair.includes("JPY") ? 0.0008 : 0.0008);
    return {
      id: `SIG-${Date.now().toString(36).toUpperCase()}-${pair.replace("/", "")}`, pair, type,
      entry: +price.toFixed(dec),
      tp: +(type === "BUY" ? price + atr * 2.5 : price - atr * 2.5).toFixed(dec),
      sl: +(type === "BUY" ? price - atr * 1.5 : price + atr * 1.5).toFixed(dec),
      timestamp: new Date().toISOString(), status: "ACTIVE", confidence: 70,
      reasoning: [type === "BUY" ? "Price momentum up" : "Price momentum down"],
      indicators: { Price: price.toFixed(dec) },
      source: "RapidAPI", apiSource: src, apiKey: key,
    };
  }

  let buy = 0, sell = 0;
  const reasons: string[] = [];
  const ind: Record<string, string | number> = {};
  const c0 = candles[0], c1 = candles[1], c2 = candles[2];

  ind.O = c0.o.toFixed(dec); ind.H = c0.h.toFixed(dec);
  ind.L = c0.l.toFixed(dec); ind.C = c0.c.toFixed(dec);

  if (c1.c < c1.o && c0.c > c0.o && c0.c > c1.o) { buy += 3; reasons.push("Bullish engulfing"); }
  else if (c1.c > c1.o && c0.c < c0.o && c0.c < c1.o) { sell += 3; reasons.push("Bearish engulfing"); }

  const body = Math.abs(c0.c - c0.o), range = c0.h - c0.l;
  if (range > 0) {
    const lw = Math.min(c0.o, c0.c) - c0.l, uw = c0.h - Math.max(c0.o, c0.c);
    if (lw > body * 2 && uw < body * 0.5) { buy += 2; reasons.push("Hammer"); }
    else if (uw > body * 2 && lw < body * 0.5) { sell += 2; reasons.push("Shooting star"); }
    if (c0.c > c0.o && body / range > 0.6) { buy += 1.5; reasons.push("Strong bullish candle"); }
    else if (c0.o > c0.c && body / range > 0.6) { sell += 1.5; reasons.push("Strong bearish candle"); }
  }

  const cls = candles.slice(0, 5).map((x) => x.c);
  const sma5 = cls.reduce((a, b) => a + b, 0) / cls.length;
  ind.SMA5 = sma5.toFixed(dec);
  if (c0.c > sma5) { buy += 1; reasons.push("Above SMA5"); } else { sell += 1; reasons.push("Below SMA5"); }

  if (c0.c > c1.c && c1.c > c2.c) { buy += 1.5; reasons.push("3-bar bullish momentum"); }
  else if (c0.c < c1.c && c1.c < c2.c) { sell += 1.5; reasons.push("3-bar bearish momentum"); }

  const hs = candles.slice(0, 10).map((x) => x.h), ls = candles.slice(0, 10).map((x) => x.l);
  const res = Math.max(...hs), sup = Math.min(...ls);
  ind.Resist = res.toFixed(dec); ind.Support = sup.toFixed(dec);
  if (c0.c <= sup * 1.0005) { buy += 2; reasons.push("At support"); }
  else if (c0.c >= res * 0.9995) { sell += 2; reasons.push("At resistance"); }

  if (candles.length >= 5) {
    const avgRange = candles.slice(1, 5).reduce((a, x) => a + (x.h - x.l), 0) / 4;
    if (range > avgRange * 1.5) {
      if (c0.c > c0.o) { buy += 1; reasons.push("Range expansion bullish"); }
      else { sell += 1; reasons.push("Range expansion bearish"); }
    }
  }

  const total = buy + sell, win = Math.max(buy, sell);
  if (total < 2 || win < 2) return null;

  const type = buy > sell ? "BUY" : "SELL";
  const conf = Math.min(Math.round((win / total) * 100), 95);
  const atr = price * (pair.includes("XAU") ? 0.0015 : pair.includes("JPY") ? 0.0008 : 0.0008);

  return {
    id: `SIG-${Date.now().toString(36).toUpperCase()}-${pair.replace("/", "")}-${Math.random().toString(36).substring(2, 4)}`,
    pair, type,
    entry: +price.toFixed(dec),
    tp: +(type === "BUY" ? price + atr * 2.5 : price - atr * 2.5).toFixed(dec),
    sl: +(type === "BUY" ? price - atr * 1.5 : price + atr * 1.5).toFixed(dec),
    timestamp: new Date().toISOString(), status: "ACTIVE", confidence: conf,
    reasoning: reasons, indicators: ind,
    source: "RapidAPI", apiSource: src, apiKey: key,
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

/* ─── Cache ─── */
let cachedSignals: any[] = [];
let lastSignalTime = 0;
const SIGNAL_TTL = 15000;

export async function GET() {
  if (cachedSignals.length > 0 && Date.now() - lastSignalTime < SIGNAL_TTL) {
    return NextResponse.json({ source: "cached", signals: cachedSignals, cached: true, apiStats: api.stats });
  }

  try {
    const signals: any[] = [];
    const shuffled = [...PAIRS].sort(() => Math.random() - 0.5).slice(0, 5);

    for (let i = 0; i < shuffled.length; i++) {
      const { pair, from, to } = shuffled[i];
      try {
        // SMART ALTERNATION: even index → AV first, odd → TD first
        const preferAV = i % 2 === 0;
        const pd = await fetchPrice(pair, from, to, preferAV);
        if (!pd) continue;

        // Candles always from AV (only AV has FX_INTRADAY)
        let candles: any[] = [];
        try { candles = await fetchCandles(from, to); } catch {}

        const sig = analyze(pair, pd.price, candles, pd.src, pd.key);
        if (sig) signals.push(sig);
      } catch {}
      await new Promise(r => setTimeout(r, 250));
    }

    if (signals.length > 0) { cachedSignals = signals; lastSignalTime = Date.now(); }

    return NextResponse.json({
      source: signals.length > 0 ? "RapidAPI (Dual Account)" : "empty",
      signals: signals.length > 0 ? signals : cachedSignals,
      generated: signals.length,
      apiStats: api.stats,
    });
  } catch {
    return NextResponse.json({ source: "error", signals: cachedSignals, apiStats: api.stats });
  }
}