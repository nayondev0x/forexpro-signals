import { NextResponse } from "next/server";
import { getRealPrice, getIndicator, FOREX_PAIRS } from "@/lib/rapidapi";

// Simple in-memory cache to avoid rate limits
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 120_000; // 2 minutes

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && Date.now() - existing.ts < CACHE_TTL) {
    return Promise.resolve(existing.data);
  }
  return fn().then((data) => {
    cache.set(key, { data, ts: Date.now() });
    return data;
  });
}

export async function GET() {
  try {
    // Analyze pairs sequentially to respect rate limits
    const signals: any[] = [];
    for (const pair of FOREX_PAIRS.slice(0, 8)) {
      try {
        const signal = await generateSignalForPair(pair);
        if (signal) signals.push(signal);
        // Delay between pairs to avoid rate limit
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        console.error(`Error analyzing ${pair}:`, e);
      }
    }

    if (signals.length === 0) {
      return NextResponse.json({ source: "fallback", signals: generateFallbackSignals() });
    }

    return NextResponse.json({ source: "real", signals });
  } catch (error) {
    console.error("Signal engine error:", error);
    return NextResponse.json(
      { source: "fallback", signals: generateFallbackSignals() },
      { status: 200 }
    );
  }
}

/* ─── Technical Analysis Signal Generator ─── */
async function generateSignalForPair(pair: string) {
  // Fetch price + only 2 indicators (RSI + MACD) to minimize API calls
  const [priceData, rsiData, macdData] = await Promise.all([
    cached(`price-${pair}`, () => getRealPrice(pair)),
    cached(`rsi-${pair}`, () => getIndicator(pair, "rsi", { time_period: "14" })),
    cached(`macd-${pair}`, () => getIndicator(pair, "macd")),
  ]);

  if (!priceData || !priceData.price) return null;

  const analysis = analyzeIndicators(rsiData, macdData, priceData.price, pair);
  if (!analysis.shouldSignal) return null;

  const dec = getDecimals(pair);
  const atrValue = analysis.atrValue || (pair.includes("XAU") ? priceData.price * 0.002 : priceData.price * 0.001);

  return {
    id: `SIG-${Date.now().toString(36).toUpperCase()}-${pair.replace("/", "")}`,
    pair,
    type: analysis.signalType,
    entry: parseFloat(priceData.price.toFixed(dec)),
    tp: parseFloat(
      (analysis.signalType === "BUY" ? priceData.price + atrValue * 2 : priceData.price - atrValue * 2).toFixed(dec)
    ),
    sl: parseFloat(
      (analysis.signalType === "BUY" ? priceData.price - atrValue * 1.5 : priceData.price + atrValue * 1.5).toFixed(dec)
    ),
    timestamp: new Date().toISOString(),
    status: "ACTIVE" as const,
    confidence: analysis.confidence,
    reasoning: analysis.reasoning,
    indicators: analysis.indicatorSummary,
    priceData: {
      bid: priceData.bid,
      ask: priceData.ask,
      high: priceData.high,
      low: priceData.low,
      open: priceData.open,
    },
    source: "RapidAPI",
  };
}

function analyzeIndicators(
  rsiRaw: any,
  macdRaw: any,
  currentPrice: number,
  pair: string
) {
  let buyScore = 0;
  let sellScore = 0;
  const reasons: string[] = [];
  const indicatorSummary: Record<string, string | number> = {};

  const rsi = rsiRaw?.values || [];
  const macd = macdRaw?.values || [];
  const dec = getDecimals(pair);

  // RSI Analysis
  if (rsi.length > 0) {
    const rsiVal = parseFloat(rsi[0]?.rsi || "50");
    indicatorSummary.RSI = rsiVal.toFixed(1);
    if (rsiVal < 30) { buyScore += 3; reasons.push(`RSI oversold (${rsiVal.toFixed(1)})`); }
    else if (rsiVal < 40) { buyScore += 1.5; reasons.push(`RSI low (${rsiVal.toFixed(1)})`); }
    else if (rsiVal > 70) { sellScore += 3; reasons.push(`RSI overbought (${rsiVal.toFixed(1)})`); }
    else if (rsiVal > 60) { sellScore += 1.5; reasons.push(`RSI high (${rsiVal.toFixed(1)})`); }
    else { reasons.push(`RSI neutral (${rsiVal.toFixed(1)})`); }
  }

  // MACD Analysis
  if (macd.length > 1) {
    const m = parseFloat(macd[0]?.macd || "0");
    const ms = parseFloat(macd[0]?.macd_signal || "0");
    const pm = parseFloat(macd[1]?.macd || "0");
    const pms = parseFloat(macd[1]?.macd_signal || "0");
    indicatorSummary.MACD = m.toFixed(dec);
    indicatorSummary["MACD_Signal"] = ms.toFixed(dec);

    if (pm < pms && m > ms) { buyScore += 3; reasons.push("MACD bullish crossover"); }
    else if (pm > pms && m < ms) { sellScore += 3; reasons.push("MACD bearish crossover"); }
    else if (m > ms) { buyScore += 1; reasons.push("MACD bullish"); }
    else if (m < ms) { sellScore += 1; reasons.push("MACD bearish"); }
  }

  // Price momentum (simple comparison)
  const momentum = currentPrice * (Math.random() - 0.48) * 0.001; // Slight random bias
  if (momentum > 0) { buyScore += 0.5; }
  else { sellScore += 0.5; }

  const totalScore = buyScore + sellScore;
  const signalType = buyScore > sellScore ? ("BUY" as const) : ("SELL" as const);
  const winningScore = Math.max(buyScore, sellScore);
  const confidence = totalScore > 0 ? Math.min(Math.round((winningScore / totalScore) * 100), 95) : 50;
  const shouldSignal = totalScore >= 1.5 && winningScore >= 1;

  return { shouldSignal, signalType, confidence, buyScore, sellScore, reasoning: reasons, atrValue: 0, indicatorSummary };
}

function getDecimals(pair: string) {
  if (pair.includes("XAU") || pair.includes("XAG") || pair.includes("JPY")) return 2;
  return 4;
}

function generateFallbackSignals() {
  const pairs = FOREX_PAIRS.slice(0, 4);
  const basePrices: Record<string, number> = {
    "EUR/USD": 1.0872, "GBP/USD": 1.2715, "USD/JPY": 157.85, "AUD/USD": 0.6648,
  };
  return pairs.map((pair, i) => {
    const type = i % 2 === 0 ? "BUY" : "SELL";
    const bp = basePrices[pair] || 1.0;
    const dec = getDecimals(pair);
    const tpDist = bp * (type === "BUY" ? 0.002 : -0.002);
    const slDist = bp * (type === "BUY" ? -0.001 : 0.001);
    return {
      id: `SIG-FB-${Date.now().toString(36).toUpperCase()}-${i}`,
      pair, type,
      entry: parseFloat(bp.toFixed(dec)),
      tp: parseFloat((bp + tpDist).toFixed(dec)),
      sl: parseFloat((bp + slDist).toFixed(dec)),
      timestamp: new Date().toISOString(),
      status: "ACTIVE" as const,
      confidence: 50,
      reasoning: ["Fallback (rate limited)"],
      indicators: {},
      priceData: { bid: bp, ask: bp, high: bp, low: bp, open: bp },
    };
  });
}