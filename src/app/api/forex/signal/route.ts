import { NextResponse } from "next/server";

const ALPHA_KEY = process.env.ALPHA_VANTAGE_API_KEY!;
const ALPHA_HOST = process.env.ALPHA_VANTAGE_API_HOST!;

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

// Cache: store last generated signals, refresh every 60s
let cachedSignals: any[] = [];
let lastSignalTime = 0;
const SIGNAL_TTL = 60000; // 60 seconds

async function avRate(from: string, to: string) {
  try {
    const r = await fetch(
      `https://${ALPHA_HOST}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}`,
      { headers: { "x-rapidapi-key": ALPHA_KEY, "x-rapidapi-host": ALPHA_HOST }, signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    const ex = d?.["Realtime Currency Exchange Rate"];
    if (!ex) return null;
    const price = parseFloat(ex["5. Exchange Rate"]);
    return isNaN(price) ? null : { price, bid: parseFloat(ex["8. Bid Price"]) || price, ask: parseFloat(ex["9. Ask Price"]) || price };
  } catch { return null; }
}

async function avCandles(from: string, to: string) {
  try {
    const r = await fetch(
      `https://${ALPHA_HOST}/query?function=FX_INTRADAY&from_symbol=${from}&to_symbol=${to}&interval=5min&outputsize=20`,
      { headers: { "x-rapidapi-key": ALPHA_KEY, "x-rapidapi-host": ALPHA_HOST }, signal: AbortSignal.timeout(10000) }
    );
    const d = await r.json();
    const key = Object.keys(d).find((k) => k.includes("Time Series"));
    if (!key) return [];
    return Object.values(d[key]).map((v: any) => ({
      o: parseFloat(v?.["1. open"]) || 0, h: parseFloat(v?.["2. high"]) || 0,
      l: parseFloat(v?.["3. low"]) || 0, c: parseFloat(v?.["4. close"]) || 0,
    })).filter((x) => x.c > 0);
  } catch { return []; }
}

function getDec(p: string) { return p.includes("XAU") || p.includes("JPY") ? 2 : 4; }

function analyze(pair: string, price: number, candles: any[]) {
  const dec = getDec(pair);
  if (candles.length < 3) return null;

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

  if (c0.c > c1.c && c1.c > c2.c) { buy += 1.5; reasons.push("Bullish momentum"); }
  else if (c0.c < c1.c && c1.c < c2.c) { sell += 1.5; reasons.push("Bearish momentum"); }

  const hs = candles.slice(0, 10).map((x) => x.h), ls = candles.slice(0, 10).map((x) => x.l);
  const res = Math.max(...hs), sup = Math.min(...ls);
  ind.Resist = res.toFixed(dec); ind.Support = sup.toFixed(dec);
  if (c0.c <= sup * 1.0005) { buy += 2; reasons.push("At support"); }
  else if (c0.c >= res * 0.9995) { sell += 2; reasons.push("At resistance"); }

  const total = buy + sell, win = Math.max(buy, sell);
  if (total < 2 || win < 2) return null;

  const type = buy > sell ? "BUY" : "SELL";
  const conf = Math.min(Math.round((win / total) * 100), 95);
  const atr = price * (pair.includes("XAU") ? 0.0015 : pair.includes("JPY") ? 0.0008 : 0.0008);

  return {
    id: `SIG-${Date.now().toString(36).toUpperCase()}-${pair.replace("/", "")}`,
    pair, type,
    entry: +price.toFixed(dec),
    tp: +(type === "BUY" ? price + atr * 2.5 : price - atr * 2.5).toFixed(dec),
    sl: +(type === "BUY" ? price - atr * 1.5 : price + atr * 1.5).toFixed(dec),
    timestamp: new Date().toISOString(), status: "ACTIVE", confidence: conf,
    reasoning: reasons, indicators: ind, source: "RapidAPI",
  };
}

export async function GET() {
  // Return cached signals if still fresh
  if (cachedSignals.length > 0 && Date.now() - lastSignalTime < SIGNAL_TTL) {
    return NextResponse.json({ source: "cached", signals: cachedSignals, cached: true });
  }

  try {
    const signals: any[] = [];
    // Pick 4 random pairs to analyze
    const shuffled = [...PAIRS].sort(() => Math.random() - 0.5).slice(0, 4);

    for (const { pair, from, to } of shuffled) {
      try {
        const [rateData, candleData] = await Promise.all([avRate(from, to), avCandles(from, to)]);
        if (rateData) {
          const sig = analyze(pair, rateData.price, candleData);
          if (sig) signals.push(sig);
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 400));
    }

    if (signals.length > 0) {
      cachedSignals = signals;
      lastSignalTime = Date.now();
    }

    return NextResponse.json({
      source: signals.length > 0 ? "alpha-vantage" : "empty",
      signals: signals.length > 0 ? signals : cachedSignals,
    });
  } catch {
    return NextResponse.json({ source: "error", signals: cachedSignals });
  }
}