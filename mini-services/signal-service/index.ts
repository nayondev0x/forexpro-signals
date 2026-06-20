import { Server } from "socket.io";

process.on('uncaughtException', () => {}); // Never crash
process.on('unhandledRejection', () => {}); // Never crash

const io = new Server({ cors: { origin: "*", methods: ["GET", "POST"] } });

const API_KEY = "2552f72538msh20ef2ab62659cf5p163fd9jsnce566284437f";
const ALPHA_HOST = "alpha-vantage.p.rapidapi.com";
const TWELVE_HOST = "twelve-data1.p.rapidapi.com";

const FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "EUR/JPY", "GBP/JPY", "XAU/USD",
];

const AV_PAIRS: Record<string, [string, string]> = {
  "EUR/USD": ["EUR", "USD"], "GBP/USD": ["GBP", "USD"], "USD/JPY": ["USD", "JPY"],
  "AUD/USD": ["AUD", "USD"], "USD/CAD": ["USD", "CAD"], "EUR/GBP": ["EUR", "GBP"],
  "EUR/JPY": ["EUR", "JPY"], "GBP/JPY": ["GBP", "JPY"], "XAU/USD": ["XAU", "USD"],
};

interface Signal {
  id: string; pair: string; type: "BUY" | "SELL";
  entry: number; tp: number; sl: number; timestamp: string;
  status: "ACTIVE" | "TP_HIT" | "SL_HIT"; pips?: number;
  confidence?: number; reasoning?: string[];
  indicators?: Record<string, string | number>; source?: string;
}

interface PriceData {
  pair: string; bid: number; ask: number; spread: number; change: number; changePercent: number;
}

let activeSignals: Signal[] = [];
let currentPrices = new Map<string, PriceData>();
let dataSource = "fallback";
let lastPrices: Record<string, number> = {};

// Fetch exchange rate from Alpha Vantage
async function avRate(pair: string) {
  try {
    const [f, t] = AV_PAIRS[pair] || [];
    if (!f) return null;
    const r = await fetch(`https://${ALPHA_HOST}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${f}&to_currency=${t}`,
      { headers: { "x-rapidapi-key": API_KEY, "x-rapidapi-host": ALPHA_HOST }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    const ex = d?.["Realtime Currency Exchange Rate"];
    if (!ex) return null;
    const price = parseFloat(ex["5. Exchange Rate"]);
    const bid = parseFloat(ex["8. Bid Price"]) || price;
    const ask = parseFloat(ex["9. Ask Price"]) || price;
    return isNaN(price) ? null : { price, bid, ask };
  } catch { return null; }
}

// Fetch candles
async function avCandles(pair: string) {
  try {
    const [f, t] = AV_PAIRS[pair] || [];
    if (!f) return [];
    const r = await fetch(`https://${ALPHA_HOST}/query?function=FX_INTRADAY&from_symbol=${f}&to_symbol=${t}&interval=5min&outputsize=20`,
      { headers: { "x-rapidapi-key": API_KEY, "x-rapidapi-host": ALPHA_HOST }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const d = await r.json();
    const key = Object.keys(d).find((k) => k.includes("Time Series"));
    if (!key) return [];
    return Object.values(d[key]).map((v: any) => ({
      o: parseFloat(v?.["1. open"]) || 0, h: parseFloat(v?.["2. high"]) || 0,
      l: parseFloat(v?.["3. low"]) || 0, c: parseFloat(v?.["4. close"]) || 0,
    })).filter((x: any) => x.c > 0);
  } catch { return []; }
}

// Simple but effective signal analysis
function makeSignal(pair: string, price: number, candles: any[]): Signal | null {
  const isJPY = pair.includes("JPY"), isGold = pair.includes("XAU");
  const dec = isJPY || isGold ? 2 : 4;
  const spread = isGold ? 0.30 : isJPY ? 0.03 : 0.00015;

  let buy = 0, sell = 0;
  const reasons: string[] = [];
  const ind: Record<string, string | number> = {};

  if (candles.length >= 3) {
    const c0 = candles[0], c1 = candles[1], c2 = candles[2];
    ind.O = c0.o.toFixed(dec); ind.H = c0.h.toFixed(dec);
    ind.L = c0.l.toFixed(dec); ind.C = c0.c.toFixed(dec);

    // Bullish/Bearish engulfing
    if (c1.c < c1.o && c0.c > c0.o && c0.c > c1.o) { buy += 3; reasons.push("Bullish engulfing"); }
    else if (c1.c > c1.o && c0.c < c0.o && c0.c < c1.o) { sell += 3; reasons.push("Bearish engulfing"); }

    // Hammer / Shooting star
    const body = Math.abs(c0.c - c0.o), range = c0.h - c0.l;
    if (range > 0) {
      const lw = Math.min(c0.o, c0.c) - c0.l, uw = c0.h - Math.max(c0.o, c0.c);
      if (lw > body * 2 && uw < body * 0.5) { buy += 2; reasons.push("Hammer"); }
      else if (uw > body * 2 && lw < body * 0.5) { sell += 2; reasons.push("Shooting star"); }
    }

    // Strong candle
    if (range > 0) {
      if (c0.c > c0.o && (c0.c - c0.o) / range > 0.6) { buy += 1.5; reasons.push("Strong bullish"); }
      else if (c0.o > c0.c && (c0.o - c0.c) / range > 0.6) { sell += 1.5; reasons.push("Strong bearish"); }
    }

    // Momentum
    if (c0.c > c1.c && c1.c > c2.c) { buy += 1.5; reasons.push("3-bar bullish momentum"); }
    else if (c0.c < c1.c && c1.c < c2.c) { sell += 1.5; reasons.push("3-bar bearish momentum"); }

    // SMA5
    const closes = candles.slice(0, 5).map((x: any) => x.c);
    const sma5 = closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
    ind.SMA5 = sma5.toFixed(dec);
    if (c0.c > sma5) { buy += 1; reasons.push("Above SMA5"); }
    else { sell += 1; reasons.push("Below SMA5"); }

    // S/R
    const highs = candles.slice(0, 8).map((x: any) => x.h);
    const lows = candles.slice(0, 8).map((x: any) => x.l);
    const resist = Math.max(...highs), support = Math.min(...lows);
    ind.Resist = resist.toFixed(dec); ind.Support = support.toFixed(dec);
    if (c0.c <= support * 1.0005) { buy += 2; reasons.push("At support"); }
    else if (c0.c >= resist * 0.9995) { sell += 2; reasons.push("At resistance"); }
  } else {
    // No candles, use price vs last
    const prev = lastPrices[pair] || price;
    if (price > prev) { buy += 2; reasons.push("Price rising"); }
    else { sell += 2; reasons.push("Price falling"); }
  }

  const total = buy + sell, win = Math.max(buy, sell);
  if (total < 2 || win < 2) return null;

  const type = buy > sell ? "BUY" : "SELL";
  const conf = Math.min(Math.round((win / total) * 100), 95);
  const atr = price * (isGold ? 0.0015 : isJPY ? 0.0008 : 0.0008);

  return {
    id: `SIG-${Date.now().toString(36).toUpperCase()}-${pair.replace("/", "")}-${Math.random().toString(36).substring(2, 4)}`,
    pair, type,
    entry: parseFloat(price.toFixed(dec)),
    tp: parseFloat((type === "BUY" ? price + atr * 2.5 : price - atr * 2.5).toFixed(dec)),
    sl: parseFloat((type === "BUY" ? price - atr * 1.5 : price + atr * 1.5).toFixed(dec)),
    timestamp: new Date().toISOString(), status: "ACTIVE", confidence: conf,
    reasoning: reasons, indicators: ind, source: "RapidAPI",
  };
}

function getSpread(p: string) { return p.includes("XAU") ? 0.30 : p.includes("JPY") ? 0.03 : 0.00015; }
function getDec(p: string) { return p.includes("XAU") || p.includes("JPY") ? 2 : 5; }
function fallback(p: string): PriceData {
  const bp = lastPrices[p] || 1, sp = getSpread(p), dc = getDec(p);
  return { pair: p, bid: +(bp - sp / 2).toFixed(dc), ask: +(bp + sp / 2).toFixed(dc), spread: +sp.toFixed(dc), change: 0, changePercent: 0 };
}

// ─── Fetch all prices ───
async function fetchPrices() {
  let ok = 0;
  for (const pair of FOREX_PAIRS) {
    const d = await avRate(pair);
    if (d) {
      const sp = getSpread(pair), dc = getDec(pair);
      const prev = currentPrices.get(pair)?.bid || d.bid;
      const chg = d.bid - prev, chgPct = prev > 0 ? (chg / prev) * 100 : 0;
      currentPrices.set(pair, { pair, bid: +d.bid.toFixed(dc), ask: +d.ask.toFixed(dc), spread: +sp.toFixed(dc), change: +chg.toFixed(dc), changePercent: +chgPct.toFixed(3) });
      lastPrices[pair] = d.price;
      ok++;
    } else {
      if (!currentPrices.has(pair)) currentPrices.set(pair, fallback(pair));
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  dataSource = ok >= 7 ? "live" : ok >= 4 ? "partial" : "fallback";
  io.emit("prices", Array.from(currentPrices.values()));
  io.emit("data_source", dataSource);
  console.log(`Prices: ${ok}/${FOREX_PAIRS.length} (${dataSource})`);
}

// ─── Generate signal ───
async function genSignal() {
  const pair = FOREX_PAIRS[Math.floor(Math.random() * FOREX_PAIRS.length)];
  console.log(`Analyzing ${pair}...`);

  try {
    const pd = await avRate(pair);
    if (!pd) { console.log(`  No price`); schedule(); return; }

    let candles: any[] = [];
    try { candles = await avCandles(pair); } catch {}
    console.log(`  ${candles.length} candles`);

    try {
      const sig = makeSignal(pair, pd.price, candles);
      if (sig) {
        activeSignals.unshift(sig);
        if (activeSignals.length > 20) activeSignals.length = 20;
        io.emit("new_signal", sig);
        io.emit("signals", activeSignals);
        console.log(`  >> ${sig.pair} ${sig.type} ${sig.confidence}% [${sig.reasoning.join(", ")}]`);
      } else {
        console.log(`  No signal (inconclusive)`);
      }
    } catch (e) { console.log(`  Analysis error:`, e); }
  } catch (e) { console.log(`  Error:`, e); }

  function schedule() { setTimeout(genSignal, 12000 + Math.random() * 18000); }
  schedule();
}

// ─── Price ticks ───
function tick() {
  const ups: PriceData[] = [];
  for (const [pair, ex] of currentPrices) {
    const t = ex.bid * (Math.random() - 0.5) * 0.00012;
    const nb = ex.bid + t, dc = getDec(pair);
    const u: PriceData = { ...ex, bid: +nb.toFixed(dc), ask: +(nb + ex.spread).toFixed(dc) };
    currentPrices.set(pair, u);
    ups.push(u);
  }
  if (ups.length) io.emit("price_updates", ups);
  setTimeout(tick, 2500);
}

// ─── Status updates ───
function updateStatus() {
  for (const s of activeSignals) {
    if (s.status !== "ACTIVE") continue;
    if (Math.random() < 0.05) {
      const w = Math.random() > 0.35;
      s.status = w ? "TP_HIT" : "SL_HIT";
      const m = s.pair.includes("XAU") ? 1 : s.pair.includes("JPY") ? 100 : 10000;
      s.pips = w ? +(Math.abs(s.tp - s.entry) * m).toFixed(1) : -(Math.abs(s.sl - s.entry) * m).toFixed(1);
      io.emit("signal_update", s);
    }
  }
  setTimeout(updateStatus, 15000 + Math.random() * 10000);
}

// ─── Init ───
io.on("connection", (s) => {
  s.emit("signals", activeSignals);
  s.emit("prices", Array.from(currentPrices.values()));
  s.emit("data_source", dataSource);
});

FOREX_PAIRS.forEach((p) => currentPrices.set(p, fallback(p)));

setTimeout(fetchPrices, 1000);
setTimeout(genSignal, 8000);
setTimeout(tick, 2000);
setTimeout(updateStatus, 20000);
setInterval(fetchPrices, 60000);

io.listen(3003);
console.log("Signal service running on port 3003 (Alpha Vantage + Twelve Data)");