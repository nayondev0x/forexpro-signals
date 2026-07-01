import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.RAPIDAPI_KEY || "";
const HOST = "tradingview-data1.p.rapidapi.com";

async function tvFetch(path: string, options?: RequestInit) {
  try {
    const res = await fetch(`https://${HOST}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": HOST,
        ...(options?.headers || {}),
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const symbol = searchParams.get("symbol");

  if (!API_KEY) return NextResponse.json({ error: "API key missing" }, { status: 500 });

  try {
    switch (type) {
      // ── Multi-timeframe Technical Analysis Rating ──
      case "ta": {
        if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
        const data = await tvFetch(`/api/ta/${encodeURIComponent(symbol)}`);
        return NextResponse.json(data?.data || {});
      }

      // ── Full Technical Indicators (Pivot Points, Ichimoku, MACD, ADX, RSI, EMA...) ──
      case "indicators": {
        if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
        const data = await tvFetch(`/api/ta/${encodeURIComponent(symbol)}/indicators`);
        return NextResponse.json(data?.data || {});
      }

      // ── Fundamental Indicators (PE, EPS, Beta, Market Cap, Margins...) ──
      case "fundamentals": {
        if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
        const data = await tvFetch(`/api/market-data/${encodeURIComponent(symbol)}/indicators`);
        return NextResponse.json(data?.data || {});
      }

      // ── Analyst Recommendations + Price Targets ──
      case "analyst": {
        if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
        const data = await tvFetch(`/api/market-data/${encodeURIComponent(symbol)}/analyst-recommendations`);
        return NextResponse.json(data?.data || {});
      }

      // ── Market Data (Company info, price, CEO...) ──
      case "quote": {
        if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
        const data = await tvFetch(`/api/market-data/${encodeURIComponent(symbol)}`);
        return NextResponse.json(data?.data || {});
      }

      // ── Crypto Screener (Buy/StrongBuy with TA filters) ──
      case "crypto-screener": {
        const body = {
          lang: "us",
          range: [0, 20] as [number, number],
          preset_fields: ["overview", "sentiment"],
          fields: ["Perf.1W", "Perf.1M"],
          extra_fields: ["RSI", "MACD.macd"],
          filters: {
            market_cap_calc: { operation: "greater_or_equal", value: 500000000 },
            technical_rating: ["Buy", "StrongBuy"],
          },
          sort: { sortBy: "crypto_total_rank", sortOrder: "asc" },
        };
        const data = await tvFetch("/api/screener/crypto/scan", {
          method: "POST",
          body: JSON.stringify(body),
        });
        return NextResponse.json(data?.data || { totalCount: 0, data: [] });
      }

      // ── Stock Screener (Top volume movers) ──
      case "stock-screener": {
        const exchange = searchParams.get("exchange") || "NASDAQ";
        const sortBy = searchParams.get("sort") || "volume";
        const sortOrder = searchParams.get("order") || "desc";
        const body = {
          market: "america",
          range: [0, 20] as [number, number],
          preset_fields: ["overview"],
          filters: { exchange: [exchange] },
          sort: { sortBy, sortOrder },
        };
        const data = await tvFetch("/api/screener/scan", {
          method: "POST",
          body: JSON.stringify(body),
        });
        return NextResponse.json(data?.data || { totalCount: 0, data: [] });
      }

      // ── Forex TA Indicators + Pivot Points (for signal page) ──
      case "forex-pivots": {
        if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
        const data = await tvFetch(`/api/ta/${encodeURIComponent(symbol)}/indicators`);
        if (!data?.data) return NextResponse.json({ pivots: null, indicators: {} });

        const d = data.data;
        const pivots = {
          classic: {
            middle: d["Pivot.M.Classic.Middle"],
            r1: d["Pivot.M.Classic.R1"], r2: d["Pivot.M.Classic.R2"], r3: d["Pivot.M.Classic.R3"],
            s1: d["Pivot.M.Classic.S1"], s2: d["Pivot.M.Classic.S2"], s3: d["Pivot.M.Classic.S3"],
          },
          fibonacci: {
            middle: d["Pivot.M.Fibonacci.Middle"],
            r1: d["Pivot.M.Fibonacci.R1"], r2: d["Pivot.M.Fibonacci.R2"], r3: d["Pivot.M.Fibonacci.R3"],
            s1: d["Pivot.M.Fibonacci.S1"], s2: d["Pivot.M.Fibonacci.S2"], s3: d["Pivot.M.Fibonacci.S3"],
          },
          camarilla: {
            middle: d["Pivot.M.Camarilla.Middle"],
            r1: d["Pivot.M.Camarilla.R1"], r2: d["Pivot.M.Camarilla.R2"], r3: d["Pivot.M.Camarilla.R3"],
            s1: d["Pivot.M.Camarilla.S1"], s2: d["Pivot.M.Camarilla.S2"], s3: d["Pivot.M.Camarilla.S3"],
          },
          demark: {
            middle: d["Pivot.M.Demark.Middle"],
            r1: d["Pivot.M.Demark.R1"],
            s1: d["Pivot.M.Demark.S1"],
          },
        };
        const indicators = {
          rsi: d.RSI, macd: d.MACD?.macd, macdSignal: d.MACD?.signal, macdHist: d.MACD?.histogram,
          adx: d.ADX, cci20: d.CCI20, ema10: d.EMA10, ema20: d.EMA20, ema50: d.EMA50, ema100: d.EMA100, ema200: d.EMA200,
          ao: d.AO, momentum: d.Mom, bbPower: d.BBPower, hullMA9: d.HullMA9,
          ichimokuBase: d["Ichimoku.BLine"], adxPlusDI: d["ADX+DI"], adxMinusDI: d["ADX-DI"],
          stochK: d.Stoch?.K, stochD: d.Stoch?.D,
          bbUpper: d.BB?.upper, bbMiddle: d.BB?.middle, bbLower: d.BB?.lower,
        };
        return NextResponse.json({ pivots, indicators, symbol });
      }

      default:
        return NextResponse.json({ error: "Invalid type. Use: ta|indicators|fundamentals|analyst|quote|crypto-screener|stock-screener|forex-pivots" }, { status: 400 });
    }
  } catch (err) {
    console.error("TradingView API error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}