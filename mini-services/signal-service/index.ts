import { Server } from "socket.io";

const io = new Server({
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const API_KEY = "2552f72538msh20ef2ab62659cf5p163fd9jsnce566284437f";
const API_HOST = "twelve-data1.p.rapidapi.com";

const FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "AUD/USD", "NZD/USD", "USD/CAD", "EUR/GBP",
  "EUR/JPY", "GBP/JPY", "XAU/USD", "XAG/USD",
];

interface Signal {
  id: string;
  pair: string;
  type: "BUY" | "SELL";
  entry: number;
  tp: number;
  sl: number;
  timestamp: string;
  status: "ACTIVE" | "TP_HIT" | "SL_HIT" | "CLOSED";
  pips?: number;
  confidence?: number;
  reasoning?: string[];
  indicators?: Record<string, string | number>;
  source?: string;
}

interface PriceData {
  pair: string;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
}

/* ─── Price fetching (rate-limit friendly: 1 call per pair) ─── */
async function fetchPrice(pair: string): Promise<{ price: number; change: number; pct: number } | null> {
  try {
    const url = `https://${API_HOST}/price?symbol=${encodeURIComponent(pair)}&interval=1min`;
    const res = await fetch(url, {
      headers: { "x-rapidapi-key": API_KEY, "x-rapidapi-host": API_HOST },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const price = parseFloat(data.price);
    if (!price || isNaN(price)) return null;
    return {
      price,
      change: parseFloat(data.change) || 0,
      pct: parseFloat(data.percent_change) || 0,
    };
  } catch {
    return null;
  }
}

/* ─── Fetch quote (more data: high, low, open, close) ─── */
async function fetchQuote(pair: string): Promise<any | null> {
  try {
    const url = `https://${API_HOST}/quote?symbol=${encodeURIComponent(pair)}&interval=1min`;
    const res = await fetch(url, {
      headers: { "x-rapidapi-key": API_KEY, "x-rapidapi-host": API_HOST },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ─── Fetch indicator (used sparingly) ─── */
async function fetchIndicator(pair: string, indicator: string, extra: string = ""): Promise<any[]> {
  try {
    const url = `https://${API_HOST}/${indicator}?symbol=${encodeURIComponent(pair)}&interval=1min&outputsize=5&${extra}`;
    const res = await fetch(url, {
      headers: { "x-rapidapi-key": API_KEY, "x-rapidapi-host": API_HOST },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.values || [];
  } catch {
    return [];
  }
}

/* ─── Price-based signal generation ─── */
function generateSignalFromPrice(pair: string, price: number, change: number, pct: number, quote?: any): Signal | null {
  const isJPY = pair.includes("JPY");
  const isGold = pair.includes("XAU");
  const isSilver = pair.includes("XAG");
  const dec = isJPY || isGold || isSilver ? 2 : 4;

  // Multi-factor scoring
  let buyScore = 0;
  let sellScore = 0;
  const reasons: string[] = [];
  const indicators: Record<string, string | number> = {};

  // Factor 1: Price change direction
  if (pct < -0.05) { buyScore += 2; reasons.push(`Price dipped ${pct.toFixed(3)}%`); }
  else if (pct > 0.05) { sellScore += 2; reasons.push(`Price rose ${pct.toFixed(3)}%`); }

  // Factor 2: Mean reversion logic
  const basePrices: Record<string, number> = {
    "EUR/USD": 1.087, "GBP/USD": 1.271, "USD/JPY": 157.85, "USD/CHF": 0.894,
    "AUD/USD": 0.665, "NZD/USD": 0.612, "USD/CAD": 1.368, "EUR/GBP": 0.855,
    "EUR/JPY": 171.65, "GBP/JPY": 200.72, "XAU/USD": 2345, "XAG/USD": 29.45,
  };
  const base = basePrices[pair] || price;
  const deviation = ((price - base) / base) * 100;

  if (deviation < -0.15) { buyScore += 2; reasons.push("Below average (mean reversion)"); }
  else if (deviation > 0.15) { sellScore += 2; reasons.push("Above average (mean reversion)"); }

  // Factor 3: Quote-based analysis (if available)
  if (quote) {
    const high = parseFloat(quote.high) || 0;
    const low = parseFloat(quote.low) || 0;
    const open = parseFloat(quote.open) || 0;
    const close = parseFloat(quote.close) || price;

    indicators.High = parseFloat(high.toFixed(dec));
    indicators.Low = parseFloat(low.toFixed(dec));
    indicators.Open = parseFloat(open.toFixed(dec));

    if (high > 0 && low > 0) {
      const range = high - low;
      const position = (close - low) / range; // 0 = at low, 1 = at high

      if (position < 0.3) { buyScore += 1.5; reasons.push("Price near daily low"); }
      else if (position > 0.7) { sellScore += 1.5; reasons.push("Price near daily high"); }

      // Candlestick pattern
      if (close > open && (close - open) > range * 0.6) {
        buyScore += 1; reasons.push("Strong bullish candle");
      } else if (open > close && (open - close) > range * 0.6) {
        sellScore += 1; reasons.push("Strong bearish candle");
      }
    }

    // Volume change
    if (quote.percent_change) {
      indicators.Change = parseFloat(quote.percent_change).toFixed(3) + "%";
    }
  }

  const totalScore = buyScore + sellScore;
  const winningScore = Math.max(buyScore, sellScore);

  if (totalScore < 1.5 || winningScore < 1.5) return null;

  const signalType = buyScore > sellScore ? "BUY" : "SELL";
  const confidence = Math.min(Math.round((winningScore / totalScore) * 100), 95);

  // TP/SL calculation
  const atrMultiplier = isGold ? price * 0.0015 : isSilver ? price * 0.002 : isJPY ? price * 0.0008 : price * 0.0008;
  const tp = signalType === "BUY" ? price + atrMultiplier * 2.5 : price - atrMultiplier * 2.5;
  const sl = signalType === "BUY" ? price - atrMultiplier * 1.5 : price + atrMultiplier * 1.5;

  return {
    id: `SIG-${Date.now().toString(36).toUpperCase()}-${pair.replace("/", "")}-${Math.random().toString(36).substring(2, 4)}`,
    pair,
    type: signalType,
    entry: parseFloat(price.toFixed(dec)),
    tp: parseFloat(tp.toFixed(dec)),
    sl: parseFloat(sl.toFixed(dec)),
    timestamp: new Date().toISOString(),
    status: "ACTIVE",
    confidence,
    reasoning: reasons,
    indicators,
    source: "RapidAPI",
  };
}

/* ─── State ─── */
let activeSignals: Signal[] = [];
let currentPrices: Map<string, PriceData> = new Map();
let dataSource = "fallback";

const basePrices: Record<string, number> = {
  "EUR/USD": 1.0872, "GBP/USD": 1.2715, "USD/JPY": 157.85, "USD/CHF": 0.8935,
  "AUD/USD": 0.6648, "NZD/USD": 0.6115, "USD/CAD": 1.3675, "EUR/GBP": 0.8552,
  "EUR/JPY": 171.65, "GBP/JPY": 200.72, "XAU/USD": 2345.50, "XAG/USD": 29.45,
};

function fallbackPrice(pair: string): PriceData {
  const bp = basePrices[pair] || 1.0;
  const isJPY = pair.includes("JPY");
  const isGold = pair.includes("XAU");
  const dec = isJPY || isGold || pair.includes("XAG") ? 2 : 5;
  const spread = isGold ? 0.30 : pair.includes("XAG") ? 0.03 : isJPY ? 0.03 : 0.00015;
  return {
    pair, bid: parseFloat((bp - spread / 2).toFixed(dec)),
    ask: parseFloat((bp + spread / 2).toFixed(dec)),
    spread: parseFloat(spread.toFixed(dec)), change: 0, changePercent: 0,
  };
}

/* ─── Socket ─── */
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.emit("signals", activeSignals);
  socket.emit("prices", Array.from(currentPrices.values()));
  socket.emit("data_source", dataSource);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

/* ─── Fetch all real prices (batches of 3) ─── */
async function fetchAllPrices() {
  console.log("Fetching real prices...");
  let successCount = 0;

  for (let i = 0; i < FOREX_PAIRS.length; i += 3) {
    const batch = FOREX_PAIRS.slice(i, i + 3);
    const results = await Promise.allSettled(batch.map((p) => fetchPrice(p)));

    results.forEach((result, idx) => {
      const pair = batch[idx];
      if (result.status === "fulfilled" && result.value) {
        const { price, change, pct } = result.value;
        const isJPY = pair.includes("JPY");
        const isGold = pair.includes("XAU");
        const dec = isJPY || isGold || pair.includes("XAG") ? 2 : 5;
        const spread = isGold ? 0.30 : pair.includes("XAG") ? 0.03 : isJPY ? 0.03 : 0.00015;

        currentPrices.set(pair, {
          pair, bid: parseFloat((price - spread / 2).toFixed(dec)),
          ask: parseFloat((price + spread / 2).toFixed(dec)),
          spread: parseFloat(spread.toFixed(dec)),
          change: parseFloat(change.toFixed(dec)),
          changePercent: parseFloat(pct.toFixed(3)),
        });
        successCount++;
      } else {
        currentPrices.set(pair, fallbackPrice(pair));
      }
    });

    if (i + 3 < FOREX_PAIRS.length) await new Promise((r) => setTimeout(r, 250));
  }

  dataSource = successCount >= 6 ? "live" : "fallback";
  io.emit("prices", Array.from(currentPrices.values()));
  io.emit("data_source", dataSource);
  console.log(`Prices: ${successCount}/${FOREX_PAIRS.length} live, source=${dataSource}`);
}

/* ─── Generate signal for a random pair ─── */
async function generateNewSignal() {
  const pair = FOREX_PAIRS[Math.floor(Math.random() * FOREX_PAIRS.length)];
  console.log(`Analyzing ${pair}...`);

  try {
    // Fetch price only (1 API call - most reliable)
    const priceData = await fetchPrice(pair);

    if (priceData) {
      const signal = generateSignalFromPrice(pair, priceData.price, priceData.change, priceData.pct);
      if (signal) {
        activeSignals.unshift(signal);
        if (activeSignals.length > 20) activeSignals = activeSignals.slice(0, 20);
        io.emit("new_signal", signal);
        io.emit("signals", activeSignals);
        console.log(`Signal: ${signal.pair} ${signal.type} (conf: ${signal.confidence}%) [${signal.reasoning.join(", ")}]`);
      } else {
        console.log(`No signal for ${pair} (indicators inconclusive)`);
      }
    }

    // Try to enhance with RSI data (1 extra call, every other signal)
    if (Math.random() > 0.5) {
      const rsiData = await fetchIndicator(pair, "rsi", "time_period=14");
      if (rsiData.length > 0) {
        const rsiVal = parseFloat(rsiData[0].rsi);
        console.log(`  RSI(${pair}): ${rsiVal.toFixed(1)}`);
        // Update latest signal if same pair
        const latest = activeSignals.find((s) => s.pair === pair && s.status === "ACTIVE");
        if (latest && latest.indicators) {
          latest.indicators.RSI = rsiVal.toFixed(1);
          io.emit("signal_update", latest);
        }
      }
    }
  } catch (err) {
    console.error(`Signal error for ${pair}:`, err);
  }

  // Next signal in 20-40 seconds
  setTimeout(generateNewSignal, 20000 + Math.random() * 20000);
}

/* ─── Price tick simulation for visual movement ─── */
function priceTick() {
  const updates: PriceData[] = [];
  FOREX_PAIRS.forEach((pair) => {
    const existing = currentPrices.get(pair);
    if (!existing) return;
    const bp = existing.bid + existing.bid * (Math.random() - 0.5) * 0.0002;
    const updated: PriceData = { ...existing, bid: bp, ask: bp + existing.spread, change: existing.change + (bp - existing.bid) };
    currentPrices.set(pair, updated);
    updates.push(updated);
  });
  if (updates.length > 0) io.emit("price_updates", updates);
  setTimeout(priceTick, 3000);
}

/* ─── Signal status simulation ─── */
function updateStatuses() {
  activeSignals.forEach((signal) => {
    if (signal.status !== "ACTIVE") return;
    if (Math.random() < 0.06) {
      const win = Math.random() > 0.35;
      signal.status = win ? "TP_HIT" : "SL_HIT";
      const isGold = signal.pair.includes("XAU");
      const isJPY = signal.pair.includes("JPY");
      signal.pips = win
        ? parseFloat(Math.abs(signal.tp - signal.entry) * (isGold ? 1 : isJPY ? 100 : 10000).toFixed(1))
        : -parseFloat(Math.abs(signal.sl - signal.entry) * (isGold ? 1 : isJPY ? 100 : 10000).toFixed(1));
      io.emit("signal_update", signal);
    }
  });
  setTimeout(updateStatuses, 12000 + Math.random() * 10000);
}

/* ─── Initialize ─── */
console.log("Signal service starting...");
FOREX_PAIRS.forEach((pair) => currentPrices.set(pair, fallbackPrice(pair)));

setTimeout(fetchAllPrices, 1000);
setTimeout(generateNewSignal, 10000);
setTimeout(priceTick, 3000);
setTimeout(updateStatuses, 20000);

io.listen(3003);
console.log("Signal service running on port 3003 (RapidAPI: " + API_HOST + ")");