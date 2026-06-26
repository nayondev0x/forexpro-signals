import { NextRequest, NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════
   BINANCE REAL-TIME DATA API
   - Order Book Depth (buy/sell wall analysis)
   - Recent Trades (trade flow direction)
   - Klines (candlestick data)
   - 24hr Ticker (volume, price change)
   - Book Ticker (best bid/ask spread)
   - Order Flow Analysis (buy pressure vs sell pressure)
   ═══════════════════════════════════════════════════════════ */

const KEY = process.env.BINANCE_API_KEY || "";
const HOST = process.env.BINANCE_API_HOST || "real-time-binance-data.p.rapidapi.com";

// Cache — 15s for real-time data, 60s for less volatile
const CACHE = new Map<string, { data: any; expires: number }>();

async function binanceFetch(path: string, ttlMs = 15_000) {
  const cached = CACHE.get(path);
  if (cached && cached.expires > Date.now()) return cached.data;
  if (!KEY) return null;

  try {
    const res = await fetch(`https://${HOST}${path}`, {
      headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": HOST, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    CACHE.set(path, { data, expires: Date.now() + ttlMs });
    return data;
  } catch {
    return null;
  }
}

/* ─── Order Book Depth Analysis ─── */
function analyzeDepth(depth: any) {
  const bids = depth?.bids || depth?.bid || [];
  const asks = depth?.asks || depth?.ask || [];
  if (!Array.isArray(bids) || !Array.isArray(asks)) return null;

  // Calculate total bid and ask volume
  const bidLevels = bids.slice(0, 20);
  const askLevels = asks.slice(0, 20);

  let totalBidVol = 0, totalAskVol = 0;
  let bidWallPrice = 0, bidWallVol = 0;
  let askWallPrice = 0, askWallVol = 0;

  for (const [price, qty] of bidLevels) {
    const p = parseFloat(price);
    const q = parseFloat(qty);
    totalBidVol += q;
    if (q > bidWallVol) { bidWallVol = q; bidWallPrice = p; }
  }

  for (const [price, qty] of askLevels) {
    const p = parseFloat(price);
    const q = parseFloat(qty);
    totalAskVol += q;
    if (q > askWallVol) { askWallVol = q; askWallPrice = p; }
  }

  const totalVol = totalBidVol + totalAskVol;
  const bidRatio = totalVol > 0 ? (totalBidVol / totalVol) * 100 : 50;
  const imbalance = bidRatio - 50; // positive = buy pressure, negative = sell pressure

  // Spread calculation
  const bestBid = bidLevels.length > 0 ? parseFloat(bidLevels[0][0]) : 0;
  const bestAsk = askLevels.length > 0 ? parseFloat(asks[0][0]) : 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const spreadPct = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

  return {
    bidRatio: +bidRatio.toFixed(2),
    askRatio: +(100 - bidRatio).toFixed(2),
    imbalance: +imbalance.toFixed(2),
    totalBidVol: +totalBidVol.toFixed(4),
    totalAskVol: +totalAskVol.toFixed(4),
    bidWall: { price: bidWallPrice, volume: +bidWallVol.toFixed(4) },
    askWall: { price: askWallPrice, volume: +askWallVol.toFixed(4) },
    bestBid, bestAsk,
    spread: +spread.toFixed(8),
    spreadPct: +spreadPct.toFixed(4),
    bidLevels: bidLevels.length,
    askLevels: askLevels.length,
    signal: imbalance > 10 ? "STRONG_BUY_PRESSURE" : imbalance > 3 ? "BUY_PRESSURE" : imbalance < -10 ? "STRONG_SELL_PRESSURE" : imbalance < -3 ? "SELL_PRESSURE" : "NEUTRAL",
  };
}

/* ─── Trade Flow Analysis ─── */
function analyzeTradeFlow(trades: any[]) {
  if (!Array.isArray(trades) || trades.length === 0) return null;

  let buyVol = 0, sellVol = 0, buyCount = 0, sellCount = 0;
  let recentBuyVol = 0, recentSellVol = 0;

  const len = Math.min(trades.length, 200);

  for (let i = 0; i < len; i++) {
    const t = trades[i];
    const qty = parseFloat(t.qty || t[1] || 0);
    const isBuyer = t.isBuyerMaker === false || t.isBuyer === true;

    if (isBuyer) {
      buyVol += qty;
      buyCount++;
      if (i < 20) recentBuyVol += qty;
    } else {
      sellVol += qty;
      sellCount++;
      if (i < 20) recentSellVol += qty;
    }
  }

  const totalVol = buyVol + sellVol;
  const buyRatio = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;
  const recentBuyRatio = (recentBuyVol + recentSellVol) > 0
    ? (recentBuyVol / (recentBuyVol + recentSellVol)) * 100 : 50;

  return {
    totalTrades: buyCount + sellCount,
    buyTrades: buyCount,
    sellTrades: sellCount,
    buyVolume: +buyVol.toFixed(4),
    sellVolume: +sellVol.toFixed(4),
    buyRatio: +buyRatio.toFixed(2),
    sellRatio: +(100 - buyRatio).toFixed(2),
    recentBuyRatio: +recentBuyRatio.toFixed(2),
    avgTradeSize: totalVol > 0 ? +(totalVol / (buyCount + sellCount)).toFixed(6) : 0,
    signal: buyRatio > 60 ? "BULLISH_FLOW" : buyRatio < 40 ? "BEARISH_FLOW" : "NEUTRAL_FLOW",
  };
}

/* ─── 24hr Ticker Analysis ─── */
function analyzeTicker(ticker: any) {
  if (!ticker || typeof ticker !== "object") return null;

  const price = parseFloat(ticker.lastPrice || ticker.price || ticker.c || 0);
  const change = parseFloat(ticker.priceChange || ticker.change || ticker.p || 0);
  const changePct = parseFloat(ticker.priceChangePercent || ticker.changePercent || ticker.P || 0);
  const high = parseFloat(ticker.highPrice || ticker.high || ticker.h || 0);
  const low = parseFloat(ticker.lowPrice || ticker.low || ticker.l || 0);
  const volume = parseFloat(ticker.volume || ticker.v || 0);
  const quoteVolume = parseFloat(ticker.quoteVolume || ticker.q || 0);
  const trades = parseInt(ticker.count || ticker.n || 0);

  // Volatility from daily range
  const range = high - low;
  const volatility = price > 0 ? (range / price) * 100 : 0;

  // Price position in daily range (0=low, 1=high)
  const rangePosition = range > 0 ? (price - low) / range : 0.5;

  return {
    price, change, changePercent: +changePct.toFixed(2),
    high, low, range: +range.toFixed(8),
    volume: +volume.toFixed(4),
    quoteVolume: +quoteVolume.toFixed(2),
    trades,
    volatility: +volatility.toFixed(4),
    rangePosition: +rangePosition.toFixed(4),
    signal: changePct > 2 ? "STRONG_BULLISH" : changePct > 0.5 ? "BULLISH" : changePct < -2 ? "STRONG_BEARISH" : changePct < -0.5 ? "BEARISH" : "NEUTRAL",
  };
}

/* ─── GET Handler ─── */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase() || "BTCUSDT";
  const action = searchParams.get("action"); // depth, trades, ticker, klines, flow, all

  if (action === "all" || !action) {
    // Fetch all key data in parallel for a symbol
    const [depthData, tradesData, tickerData, klinesData, bookTickerData] = await Promise.allSettled([
      binanceFetch(`/depth?symbol=${symbol}`, 15_000),
      binanceFetch(`/trades?symbol=${symbol}&limit=200`, 15_000),
      binanceFetch(`/ticker/24hr?symbol=${symbol}`, 30_000),
      binanceFetch(`/klines?symbol=${symbol}&limit=100`, 60_000),
      binanceFetch(`/ticker/bookTicker?symbol=${symbol}`, 15_000),
    ]);

    const depth = depthData.status === "fulfilled" ? depthData.value : null;
    const trades = tradesData.status === "fulfilled" ? tradesData.value : null;
    const ticker = tickerData.status === "fulfilled" ? (Array.isArray(tickerData.value) ? tickerData.value[0] : tickerData.value) : null;
    const klines = klinesData.status === "fulfilled" ? klinesData.value : null;
    const bookTicker = bookTickerData.status === "fulfilled" ? (Array.isArray(bookTickerData.value) ? bookTickerData.value[0] : bookTickerData.value) : null;

    const depthAnalysis = analyzeDepth(depth);
    const tradeFlow = analyzeTradeFlow(trades);
    const tickerAnalysis = analyzeTicker(ticker);

    // Parse klines into usable candle format
    let candles: any[] = [];
    if (Array.isArray(klines)) {
      candles = klines.slice(-30).map((k: any) => ({
        time: k[0] || k.t,
        open: parseFloat(k[1] || k.o),
        high: parseFloat(k[2] || k.h),
        low: parseFloat(k[3] || k.l),
        close: parseFloat(k[4] || k.c),
        volume: parseFloat(k[5] || k.v),
      }));
    }

    // Parse book ticker
    let bookTickerParsed: any = null;
    if (bookTicker && typeof bookTicker === "object") {
      bookTickerParsed = {
        bidPrice: parseFloat(bookTicker.bidPrice || bookTicker.bid || 0),
        bidQty: parseFloat(bookTicker.bidQty || 0),
        askPrice: parseFloat(bookTicker.askPrice || bookTicker.ask || 0),
        askQty: parseFloat(bookTicker.askQty || 0),
        spread: 0,
        spreadPct: 0,
      };
      if (bookTickerParsed.askPrice > 0) {
        bookTickerParsed.spread = +(bookTickerParsed.askPrice - bookTickerParsed.bidPrice).toFixed(8);
        bookTickerParsed.spreadPct = +((bookTickerParsed.spread / bookTickerParsed.askPrice) * 100).toFixed(4);
      }
    }

    // ─── COMPOSITE ORDER FLOW SCORE ───
    // Combines: depth imbalance + trade flow + price momentum + volume
    let flowScore = 50; // neutral = 50
    const reasons: string[] = [];

    // Depth signal (weight: 30%)
    if (depthAnalysis) {
      flowScore += depthAnalysis.imbalance * 0.3;
      if (Math.abs(depthAnalysis.imbalance) > 10) {
        reasons.push(`Depth ${depthAnalysis.imbalance > 0 ? "buy" : "sell"} wall (${depthAnalysis.bidRatio}/${depthAnalysis.askRatio})`);
      }
    }

    // Trade flow signal (weight: 30%)
    if (tradeFlow) {
      const flowBias = tradeFlow.buyRatio - 50;
      flowScore += flowBias * 0.3;
      if (Math.abs(flowBias) > 15) {
        reasons.push(`Trade flow ${flowBias > 0 ? "bullish" : "bearish"} (${tradeFlow.buyRatio}%)`);
      }
    }

    // Ticker momentum (weight: 20%)
    if (tickerAnalysis) {
      const momBias = Math.max(-25, Math.min(25, tickerAnalysis.changePercent * 2));
      flowScore += momBias * 0.2;
      if (Math.abs(tickerAnalysis.changePercent) > 1) {
        reasons.push(`Price ${tickerAnalysis.changePercent > 0 ? "up" : "down"} ${Math.abs(tickerAnalysis.changePercent).toFixed(2)}%`);
      }
    }

    // Volume spike (weight: 10%)
    if (tradeFlow && tradeFlow.avgTradeSize > 0) {
      const recentPressure = tradeFlow.recentBuyRatio - 50;
      if (Math.abs(recentPressure) > 20) {
        flowScore += recentPressure * 0.1;
        reasons.push("Recent large trade pressure");
      }
    }

    // Range position (weight: 10%)
    if (tickerAnalysis) {
      const rangeBias = (tickerAnalysis.rangePosition - 0.5) * 10;
      flowScore += rangeBias * 0.1;
    }

    flowScore = Math.max(0, Math.min(100, Math.round(flowScore)));

    // Final signal
    const finalSignal = flowScore > 70 ? "STRONG_BUY" : flowScore > 55 ? "BUY" : flowScore < 30 ? "STRONG_SELL" : flowScore < 45 ? "SELL" : "NEUTRAL";

    return NextResponse.json({
      symbol,
      timestamp: new Date().toISOString(),
      orderFlowScore: flowScore,
      signal: finalSignal,
      reasons,
      depth: depthAnalysis,
      tradeFlow,
      ticker: tickerAnalysis,
      candles: candles.slice(-20),
      bookTicker: bookTickerParsed,
      klineCount: candles.length,
    });
  }

  if (action === "depth") {
    const data = await binanceFetch(`/depth?symbol=${symbol}`, 15_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch depth" }, { status: 500 });
    return NextResponse.json({ symbol, ...analyzeDepth(data) });
  }

  if (action === "trades") {
    const limit = searchParams.get("limit") || "200";
    const data = await binanceFetch(`/trades?symbol=${symbol}&limit=${limit}`, 15_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
    return NextResponse.json({ symbol, ...analyzeTradeFlow(data), rawCount: data.length });
  }

  if (action === "ticker") {
    const data = await binanceFetch(`/ticker/24hr?symbol=${symbol}`, 30_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch ticker" }, { status: 500 });
    const ticker = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ symbol, ...analyzeTicker(ticker) });
  }

  if (action === "klines") {
    const limit = searchParams.get("limit") || "100";
    const data = await binanceFetch(`/klines?symbol=${symbol}&limit=${limit}`, 60_000);
    if (!data || !Array.isArray(data)) return NextResponse.json({ error: "Failed to fetch klines" }, { status: 500 });
    const candles = data.map((k: any) => ({
      time: k[0] || k.t, open: parseFloat(k[1] || k.o),
      high: parseFloat(k[2] || k.h), low: parseFloat(k[3] || k.l),
      close: parseFloat(k[4] || k.c), volume: parseFloat(k[5] || k.v),
    }));
    return NextResponse.json({ symbol, candles, count: candles.length });
  }

  if (action === "bookTicker") {
    const data = await binanceFetch(`/ticker/bookTicker?symbol=${symbol}`, 15_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch book ticker" }, { status: 500 });
    const bt = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      symbol,
      bidPrice: parseFloat(bt.bidPrice || bt.bid || 0),
      bidQty: parseFloat(bt.bidQty || 0),
      askPrice: parseFloat(bt.askPrice || bt.ask || 0),
      askQty: parseFloat(bt.askQty || 0),
    });
  }

  if (action === "prices") {
    const data = await binanceFetch(`/ticker/price`, 30_000);
    if (!data) return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
    return NextResponse.json({ prices: Array.isArray(data) ? data.slice(0, 50) : [data] });
  }

  if (action === "flow") {
    // Quick order flow score (depth + trades only, fastest)
    const [depthData, tradesData] = await Promise.allSettled([
      binanceFetch(`/depth?symbol=${symbol}`, 15_000),
      binanceFetch(`/trades?symbol=${symbol}&limit=200`, 15_000),
    ]);

    const depthAnalysis = analyzeDepth(depthData.status === "fulfilled" ? depthData.value : null);
    const tradeFlow = analyzeTradeFlow(tradesData.status === "fulfilled" ? tradesData.value : null);

    let score = 50;
    if (depthAnalysis) score += depthAnalysis.imbalance * 0.5;
    if (tradeFlow) score += (tradeFlow.buyRatio - 50) * 0.5;
    score = Math.max(0, Math.min(100, Math.round(score)));

    return NextResponse.json({
      symbol, orderFlowScore: score,
      signal: score > 65 ? "BUY_PRESSURE" : score < 35 ? "SELL_PRESSURE" : "NEUTRAL",
      depth: depthAnalysis,
      tradeFlow,
    });
  }

  if (action === "avgPrice") {
    const data = await binanceFetch(`/avgPrice?symbol=${symbol}`, 15_000);
    return NextResponse.json({ symbol, avgPrice: data });
  }

  if (action === "exchangeInfo") {
    const data = await binanceFetch(`/exchangeInfo?symbol=${symbol}`, 300_000);
    return NextResponse.json({ symbol, info: data });
  }

  return NextResponse.json({
    error: "Unknown action. Use: all, depth, trades, ticker, klines, bookTicker, prices, flow, avgPrice, exchangeInfo",
  }, { status: 400 });
}