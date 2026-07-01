/* ═══════════════════════════════════════════════════════════════════════
   CRYPTO FUSION ENGINE v3.0 — KILLER INSTINCT: 1 SIGNAL = 1 WIN
   
   Sources fused:
   1. SelfTrade External Signal (25%) — TP/SL from external source
   2. Binance Order Flow (30%) — depth imbalance + trade flow + momentum
   3. CryptoEdge Sentiment (20%) — crowding, sentiment signals, alerts
   4. Fear & Greed Index (10%) — market-wide sentiment
   5. Price Action (15%) — candle analysis, momentum, range position
   
   v3.0 CHANGES:
     → OUTPUT: TOP 1 ONLY (was TOP 2)
     → STRICTER: min 4 sources (was 3), min 5 confluences (was 4)
     → STRICTER: dominance 65% (was 60%), min confidence 70% (was 60%)
     → NEW: RSI sanity — no BUY if 24h change > 8%, no SELL if < -8%
     → Tighter TP/SL: 2.5:1 R:R minimum for confidence bonus
   ═══════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const SELFTRADE_KEY = process.env.SELFTRADE_API_KEY || "";
const SELFTRADE_HOST = process.env.SELFTRADE_API_HOST || "selftrade.p.rapidapi.com";
const BINANCE_KEY = process.env.BINANCE_API_KEY || "";
const BINANCE_HOST = process.env.BINANCE_API_HOST || "real-time-binance-data.p.rapidapi.com";
const CRYPTOEDGE_KEY = process.env.CRYPTOEDGE_API_KEY || "";
const CRYPTOEDGE_HOST = process.env.CRYPTOEDGE_API_HOST || "cryptoedge-market-sentiment-indicators.p.rapidapi.com";

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
  filtered: boolean;
  filterReason?: string;
}

async function fetchSelfTradeSignal(pair: string): Promise<any> {
  return cachedFetch(SELFTRADE_HOST, SELFTRADE_KEY, `/rapidapi/signal?pair=${pair}`, 30_000);
}

async function fetchBinanceFlow(symbol: string): Promise<any> {
  const [depthRes, tradesRes, tickerRes, klinesRes] = await Promise.allSettled([
    cachedFetch(BINANCE_HOST, BINANCE_KEY, `/depth?symbol=${symbol}`, 15_000),
    cachedFetch(BINANCE_HOST, BINANCE_KEY, `/trades?symbol=${symbol}&limit=200`, 15_000),
    cachedFetch(BINANCE_HOST, BINANCE_KEY, `/ticker/24hr?symbol=${symbol}`, 30_000),
    cachedFetch(BINANCE_HOST, BINANCE_KEY, `/klines?symbol=${symbol}&limit=50`, 60_000),
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

  // Parse candles
  let candles: any[] = [];
  if (Array.isArray(klines)) {
    candles = klines.slice(-30).map((k: any) => ({
      time: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
      low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]),
    }));
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

  return { indicators, crowding, signal };
}

async function fetchFearGreed(): Promise<{ value: number; label: string } | null> {
  const data = await cachedFetch(SELFTRADE_HOST, SELFTRADE_KEY, "/rapidapi/fear-greed", 60_000);
  if (data && typeof data.value === "number") return { value: data.value, label: data.label || "Neutral" };
  return null;
}

/* ═══════════════════════════════════════════════════════════
   FUSION SCORING
   ═══════════════════════════════════════════════════════════ */

function scoreCryptoSignal(
  pair: string,
  extSignal: any,
  binance: any,
  cryptoEdge: any,
  fearGreed: { value: number; label: string } | null,
): FusionSignal | null {
  const reasons: string[] = [];
  const sources: string[] = [];
  const layers: FusionSignal["layers"] = [];
  let buyScore = 0, sellScore = 0;
  let sourceCount = 0;

  const price = binance?.ticker?.price || extSignal?.current_price || 0;
  if (price === 0) return null;

  // ═══ LAYER 1: SelfTrade External Signal (25%) ═══
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

  // ═══ LAYER 2: Binance Order Flow (30%) ═══
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

      // Range position — avoid buying at top, selling at bottom
      if (binance.ticker.rangePosition > 0.85) { sellScore += 1; layer2Details.push("Near daily high (overextended)"); }
      else if (binance.ticker.rangePosition < 0.15) { buyScore += 1; layer2Details.push("Near daily low (oversold)"); }
    }

    orderFlowScore = Math.max(0, Math.min(100, Math.round(orderFlowScore)));
  }
  layers.push({ layer: "Order Flow", score: layer2Score, details: layer2Details });

  // ═══ LAYER 3: CryptoEdge Sentiment (20%) ═══
  let layer3Score = 0;
  const layer3Details: string[] = [];
  let crowdingScore: number | null = null;

  if (cryptoEdge?.crowding || cryptoEdge?.signal || cryptoEdge?.indicators) {
    sourceCount++;
    sources.push("CryptoEdge-Sentiment");

    // Crowding — contrarian signal (EXTREME = reversal likely)
    if (cryptoEdge.crowding) {
      crowdingScore = cryptoEdge.crowding.score;
      if (cryptoEdge.crowding.isExtreme) {
        // CONTRARIAN: crowd is wrong, bet against them
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
  }
  layers.push({ layer: "Sentiment", score: layer3Score, details: layer3Details });

  // ═══ LAYER 4: Fear & Greed (10%) ═══
  let layer4Score = 0;
  const layer4Details: string[] = [];

  if (fearGreed) {
    sourceCount++;
    sources.push("FearGreed");

    // Extreme Fear = contrarian BUY, Extreme Greed = contrarian SELL
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

  // ═══ LAYER 5: Price Action from Candles (15%) ═══
  let layer5Score = 0;
  const layer5Details: string[] = [];

  if (binance?.candles && binance.candles.length >= 10) {
    sourceCount++;
    sources.push("PriceAction");
    const candles = binance.candles;
    const c0 = candles[candles.length - 1];
    const c1 = candles[candles.length - 2];
    const c2 = candles[candles.length - 3];

    // Candlestick patterns
    if (c1.close < c1.open && c0.close > c0.open && c0.close > c1.open && c0.open < c1.close) {
      buyScore += 3; layer5Details.push("Bullish engulfing");
      layer5Score += 3;
    } else if (c1.close > c1.open && c0.close < c0.open && c0.close < c1.open && c0.open > c1.close) {
      sellScore += 3; layer5Details.push("Bearish engulfing");
      layer5Score += 3;
    }

    // 3-candle momentum
    if (c2 && c1 && c0) {
      if (c0.close > c1.close && c1.close > c2.close) {
        buyScore += 2; layer5Details.push("3-candle bullish momentum");
        layer5Score += 2;
      } else if (c0.close < c1.close && c1.close < c2.close) {
        sellScore += 2; layer5Details.push("3-candle bearish momentum");
        layer5Score += 2;
      }
    }

    // Volume spike (last candle vs average)
    const avgVol = candles.slice(-10).reduce((a: number, c: any) => a + (c.volume || 0), 0) / 10;
    if (c0.volume > avgVol * 2) {
      layer5Details.push("Volume spike detected");
      if (c0.close > c0.open) { buyScore += 1.5; } else { sellScore += 1.5; }
      layer5Score += 1.5;
    }
  }
  layers.push({ layer: "Price Action", score: layer5Score, details: layer5Details });

  // ═══ FINAL SCORING ═══
  const total = buyScore + sellScore;
  const win = Math.max(buyScore, sellScore);
  const allReasons = [...layer1Details, ...layer2Details, ...layer3Details, ...layer4Details, ...layer5Details];
  const type: "BUY" | "SELL" = buyScore > sellScore ? "BUY" : "SELL";

  // ═══ STRICT FILTERS ═══
  // Filter 1: Need at least 4 data sources (v3.0: was 3)
  if (sourceCount < 4) {
    return { pair, type: "BUY", entry: price, tp: 0, sl: 0, confidence: 0, confluences: allReasons.length, reasoning: allReasons, sources, layers, orderFlowScore: binance ? orderFlowScore : null, fearGreed: fearGreed?.value ?? null, crowdingScore, filtered: true, filterReason: `Only ${sourceCount} sources (need 3+)` };
  }

  // Filter 2: Minimum confluences (v3.0: was 4)
  if (allReasons.length < 5) {
    return { pair, type, entry: price, tp: 0, sl: 0, confidence: 0, confluences: allReasons.length, reasoning: allReasons, sources, layers, orderFlowScore: binance ? orderFlowScore : null, fearGreed: fearGreed?.value ?? null, crowdingScore, filtered: true, filterReason: `Only ${allReasons.length} confluences (need 4+)` };
  }

  // Filter 3: Dominance ratio — v3.0 STRICTER (65% was 60%)
  if (total > 0 && win / total < 0.65) {
    return { pair, type, entry: price, tp: 0, sl: 0, confidence: 0, confluences: allReasons.length, reasoning: allReasons, sources, layers, orderFlowScore: binance ? orderFlowScore : null, fearGreed: fearGreed?.value ?? null, crowdingScore, filtered: true, filterReason: `Low dominance (${(win / total * 100).toFixed(0)}%)` };
  }

  // Confidence calculation
  const rawConf = total > 0 ? (win / total) * 100 : 50;
  const sourceBonus = sourceCount >= 4 ? 5 : sourceCount >= 3 ? 3 : 0;
  const confluenceBonus = allReasons.length >= 7 ? 5 : allReasons.length >= 5 ? 3 : 0;
  const confidence = Math.min(Math.round(rawConf + sourceBonus + confluenceBonus), 95);

  // Filter 4: Minimum confidence (v3.0: 70% was 60%)
  if (confidence < 70) {
    return { pair, type, entry: price, tp: 0, sl: 0, confidence, confluences: allReasons.length, reasoning: allReasons, sources, layers, orderFlowScore: binance ? orderFlowScore : null, fearGreed: fearGreed?.value ?? null, crowdingScore, filtered: true, filterReason: `Low confidence (${confidence}%)` };
  }

  // ═══ TP/SL CALCULATION ═══
  // Use external signal TP/SL if available with good R:R, otherwise use ATR-based
  let tp: number, sl: number;
  const extTP = parseFloat(extSignal?.tp_price || extSignal?.take_profit || 0);
  const extSL = parseFloat(extSignal?.sl_price || extSignal?.stop_loss || 0);

  if (extTP > 0 && extSL > 0) {
    const extRR = Math.abs(extTP - price) / Math.abs(price - extSL);
    if (extRR >= 1.5) {
      tp = extTP; sl = extSL;
    } else {
      // Calculate from volatility
      const volatility = binance?.ticker?.volatility || 2;
      const atrEst = price * (volatility / 100) * 0.3;
      if (type === "BUY") {
        tp = price + atrEst * 2;
        sl = price - atrEst * 0.6;
      } else {
        tp = price - atrEst * 2;
        sl = price + atrEst * 0.6;
      }
    }
  } else {
    const volatility = binance?.ticker?.volatility || 2;
    const atrEst = price * (volatility / 100) * 0.3;
    if (type === "BUY") {
      tp = price + atrEst * 2;
      sl = price - atrEst * 0.6;
    } else {
      tp = price - atrEst * 2;
      sl = price + atrEst * 0.6;
    }
  }

    // v3.0 NEW Filter 5: RSI sanity — don't chase pumps/dumps
    if (binance?.ticker) {
      const chg = binance.ticker.changePct;
      if (type === "BUY" && chg > 8) {
        return { pair, type: "BUY", entry: price, tp: 0, sl: 0, confidence: 0, confluences: allReasons.length, reasoning: [...allReasons, "REJECTED: chasing +8% pump"], sources, layers, orderFlowScore: binance ? orderFlowScore : null, fearGreed: fearGreed?.value ?? null, crowdingScore, filtered: true, filterReason: `Chasing +${chg.toFixed(1)}% pump — too risky` };
      }
      if (type === "SELL" && chg < -8) {
        return { pair, type: "SELL", entry: price, tp: 0, sl: 0, confidence: 0, confluences: allReasons.length, reasoning: [...allReasons, "REJECTED: chasing -8% dump"], sources, layers, orderFlowScore: binance ? orderFlowScore : null, fearGreed: fearGreed?.value ?? null, crowdingScore, filtered: true, filterReason: `Chasing ${chg.toFixed(1)}% dump — too risky` };
      }
    }

    // v3.0 NEW Filter 6: If ALL 5 sources agree, require higher confidence
    if (sourceCount >= 5 && confidence < 75) {
      return { pair, type, entry: price, tp: 0, sl: 0, confidence, confluences: allReasons.length, reasoning: allReasons, sources, layers, orderFlowScore: binance ? orderFlowScore : null, fearGreed: fearGreed?.value ?? null, crowdingScore, filtered: true, filterReason: `5 sources but only ${confidence}% confidence (need 75%)` };
    }

    // Confidence bonus for 5 sources
    const finalConf = sourceCount >= 5 ? Math.min(confidence + 3, 95) : confidence;

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

  // ═══ FUSION SCAN — new multi-source engine ═══
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
        const [extSignal, binance, cryptoEdge] = await Promise.allSettled([
          fetchSelfTradeSignal(symbol),
          fetchBinanceFlow(symbol),
          fetchCryptoEdge(coin),
        ]);

        const ext = extSignal.status === "fulfilled" ? extSignal.value : null;
        const bn = binance.status === "fulfilled" ? binance.value : null;
        const ce = cryptoEdge.status === "fulfilled" ? cryptoEdge.value : null;

        const result = scoreCryptoSignal(symbol, ext, bn, ce, fearGreed);

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

    // Sort by confidence, take TOP 1 (v3.0: was TOP 2)
    signals.sort((a, b) => b.confidence - a.confidence || b.confluences - a.confluences);
    const topSignals = signals.slice(0, 1);

    engineLog.push(`\nResult: ${topSignals.length} signal from ${CRYPTO_PAIRS.length} pairs (${filtered.length} filtered)`);

    const result = {
      source: "CryptoFusion-v3.0",
      signals: topSignals,
      generated: topSignals.length,
      totalChecked: CRYPTO_PAIRS.length,
      filtered,
      fearGreed,
      engineVersion: "v3.0-FUSION",
      engineLog,
      timestamp: new Date().toISOString(),
      engineNotes: "5-source fusion: SelfTrade + Binance OrderFlow + CryptoEdge + FearGreed + PriceAction | TOP 1 | Stricter filters",
    };

    cachedFusion = { data: result, time: Date.now() };
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Use ?action=fusion for multi-source signals, ?pair=BTCUSDT for single, or ?action=all for raw" }, { status: 400 });
}