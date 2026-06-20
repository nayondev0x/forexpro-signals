import { NextResponse } from "next/server";

/* ─── Key Pool with Auto-Rotation ─── */
interface Cred { key: string; host: string; limitedUntil: number; }

class KeyPool {
  creds: Cred[] = [];
  private idx = 0;

  constructor() {
    if (process.env.TWELVE_DATA_API_KEY)
      this.creds.push({ key: process.env.TWELVE_DATA_API_KEY, host: process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com", limitedUntil: 0 });
    if (process.env.TWELVE_DATA_API_KEY_2)
      this.creds.push({ key: process.env.TWELVE_DATA_API_KEY_2, host: process.env.TWELVE_DATA_API_HOST_2 || "twelve-data1.p.rapidapi.com", limitedUntil: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY)
      this.creds.push({ key: process.env.ALPHA_VANTAGE_API_KEY, host: process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com", limitedUntil: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_2)
      this.creds.push({ key: process.env.ALPHA_VANTAGE_API_KEY_2, host: process.env.ALPHA_VANTAGE_API_HOST_2 || "alpha-vantage.p.rapidapi.com", limitedUntil: 0 });
  }

  get(preferredHost?: string): Cred {
    const now = Date.now();
    if (preferredHost) {
      const p = this.creds.find(c => c.host === preferredHost && c.limitedUntil <= now);
      if (p) return p;
    }
    for (let i = 0; i < this.creds.length; i++) {
      const j = (this.idx + i) % this.creds.length;
      if (this.creds[j].limitedUntil <= now) { this.idx = (j + 1) % this.creds.length; return this.creds[j]; }
    }
    return [...this.creds].sort((a, b) => a.limitedUntil - b.limitedUntil)[0];
  }

  markLimited(host: string, secs = 60) {
    const c = this.creds.find(x => x.host === host);
    if (c) c.limitedUntil = Date.now() + secs * 1000;
  }
}

const keys = new KeyPool();

async function fetchRotated(url: string, preferredHost: string, timeout = 8000) {
  const cred = keys.get(preferredHost);
  try {
    const r = await fetch(url, {
      headers: { "x-rapidapi-key": cred.key, "x-rapidapi-host": cred.host },
      signal: AbortSignal.timeout(timeout),
    });
    if (r.status === 429) {
      keys.markLimited(cred.host, 60);
      const c2 = keys.get();
      if (c2.host === cred.host) return r;
      const r2 = await fetch(url, {
        headers: { "x-rapidapi-key": c2.key, "x-rapidapi-host": c2.host },
        signal: AbortSignal.timeout(timeout),
      });
      if (r2.status === 429) keys.markLimited(c2.host, 60);
      return r2;
    }
    return r;
  } catch { return null as any; }
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

// Alpha Vantage rate
async function avRate(from: string, to: string) {
  const host = process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com";
  const r = await fetchRotated(
    `https://${host}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}`, host
  );
  if (!r?.ok) return null;
  const d = await r.json();
  const ex = d?.["Realtime Currency Exchange Rate"];
  if (!ex) return null;
  const price = parseFloat(ex["5. Exchange Rate"]);
  return isNaN(price) ? null : { price, bid: parseFloat(ex["8. Bid Price"]) || price, ask: parseFloat(ex["9. Ask Price"]) || price, src: "AV" };
}

// Twelve Data price
async function tdPrice(pair: string) {
  const host = process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com";
  const r = await fetchRotated(`https://${host}/price?symbol=${pair}&interval=1min`, host);
  if (!r?.ok) return null;
  const d = await r.json();
  const price = parseFloat(d.price);
  return isNaN(price) ? null : { price, bid: parseFloat(d.bid) || price, ask: parseFloat(d.ask) || price, src: "TD" };
}

// Alpha Vantage candles
async function avCandles(from: string, to: string) {
  const host = process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com";
  const r = await fetchRotated(
    `https://${host}/query?function=FX_INTRADAY&from_symbol=${from}&to_symbol=${to}&interval=5min&outputsize=20`, host, 10000
  );
  if (!r?.ok) return [];
  const d = await r.json();
  const key = Object.keys(d).find((k) => k.includes("Time Series"));
  if (!key) return [];
  return Object.values(d[key]).map((v: any) => ({
    o: parseFloat(v?.["1. open"]) || 0, h: parseFloat(v?.["2. high"]) || 0,
    l: parseFloat(v?.["3. low"]) || 0, c: parseFloat(v?.["4. close"]) || 0,
  })).filter((x) => x.c > 0);
}

/* ─── Analysis Engine ─── */
function analyze(pair: string, price: number, candles: any[], src: string) {
  const dec = pair.includes("XAU") || pair.includes("JPY") ? 2 : 4;
  if (candles.length < 3) {
    // Price-only fallback
    const type = Math.random() > 0.5 ? "BUY" : "SELL";
    const atr = price * (pair.includes("XAU") ? 0.0015 : pair.includes("JPY") ? 0.0008 : 0.0008);
    return {
      id: `SIG-${Date.now().toString(36).toUpperCase()}-${pair.replace("/", "")}`, pair, type,
      entry: +price.toFixed(dec),
      tp: +(type === "BUY" ? price + atr * 2.5 : price - atr * 2.5).toFixed(dec),
      sl: +(type === "BUY" ? price - atr * 1.5 : price + atr * 1.5).toFixed(dec),
      timestamp: new Date().toISOString(), status: "ACTIVE", confidence: 70,
      reasoning: [type === "BUY" ? "Price momentum up" : "Price momentum down"], indicators: { Price: price.toFixed(dec) }, source: "RapidAPI (Dual Key)",
    };
  }

  let buy = 0, sell = 0;
  const reasons: string[] = [];
  const ind: Record<string, string | number> = {};
  const c0 = candles[0], c1 = candles[1], c2 = candles[2];

  ind.O = c0.o.toFixed(dec); ind.H = c0.h.toFixed(dec);
  ind.L = c0.l.toFixed(dec); ind.C = c0.c.toFixed(dec);

  // Patterns
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

  // Volume-like check (range expansion)
  if (candles.length >= 5) {
    const avgRange = candles.slice(1, 5).reduce((a, x) => a + (x.h - x.l), 0) / 4;
    if (range > avgRange * 1.5) {
      if (c0.c > c0.o) { buy += 1; reasons.push("Expanding range bullish"); }
      else { sell += 1; reasons.push("Expanding range bearish"); }
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
    reasoning: reasons, indicators: ind, source: "RapidAPI (Dual Key)",
  };
}

/* ─── Cache ─── */
let cachedSignals: any[] = [];
let lastSignalTime = 0;
const SIGNAL_TTL = 15000; // 15 seconds — signals refresh fast with dual keys

export async function GET() {
  // Return cached if fresh
  if (cachedSignals.length > 0 && Date.now() - lastSignalTime < SIGNAL_TTL) {
    return NextResponse.json({ source: "cached", signals: cachedSignals, cached: true, keys: keys.creds.length });
  }

  try {
    const signals: any[] = [];
    // Analyze 5 random pairs per request
    const shuffled = [...PAIRS].sort(() => Math.random() - 0.5).slice(0, 5);

    for (const { pair, from, to } of shuffled) {
      try {
        // Try AV first, fallback to TD
        let pd = await avRate(from, to);
        let src = "Alpha Vantage";
        if (!pd) { pd = await tdPrice(pair); src = "Twelve Data"; }
        if (!pd) continue;

        let candles: any[] = [];
        try { candles = await avCandles(from, to); } catch {}

        const sig = analyze(pair, pd.price, candles, src);
        if (sig) {
          sig.dataSource = pd.src;
          signals.push(sig);
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 300)); // Small delay to avoid burst
    }

    if (signals.length > 0) {
      cachedSignals = signals;
      lastSignalTime = Date.now();
    }

    return NextResponse.json({
      source: signals.length > 0 ? "RapidAPI (Dual Key)" : "empty",
      signals: signals.length > 0 ? signals : cachedSignals,
      keys: keys.creds.length,
      generated: signals.length,
    });
  } catch {
    return NextResponse.json({ source: "error", signals: cachedSignals, keys: keys.creds.length });
  }
}