// Server-side only — never import this in client components

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY!;
const TWELVE_DATA_HOST = process.env.TWELVE_DATA_API_HOST!;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY!;
const ALPHA_VANTAGE_HOST = process.env.ALPHA_VANTAGE_API_HOST!;

/* ─── Twelve Data Client ─── */
async function twelveData(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`https://${TWELVE_DATA_HOST}${endpoint}`);
  // Do NOT pass apikey as query param — RapidAPI handles auth via header
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "x-rapidapi-key": TWELVE_DATA_KEY, "x-rapidapi-host": TWELVE_DATA_HOST },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`TwelveData ${res.status}: ${res.statusText}`);
  return res.json();
}

/* ─── Alpha Vantage Client ─── */
async function alphaVantage(params: Record<string, string>) {
  const url = new URL(`https://${ALPHA_VANTAGE_HOST}/query`);
  // Do NOT pass apikey as query param — RapidAPI handles auth via header
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "x-rapidapi-key": ALPHA_VANTAGE_KEY, "x-rapidapi-host": ALPHA_VANTAGE_HOST },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`AlphaVantage ${res.status}: ${res.statusText}`);
  return res.json();
}

/* ─── Forex Pairs we track ─── */
export const FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "AUD/USD", "NZD/USD", "USD/CAD", "EUR/GBP",
  "EUR/JPY", "GBP/JPY", "XAU/USD", "XAG/USD",
];

// Twelve Data expects symbols with slash: EUR/USD, GBP/JPY
function pairToSymbol(pair: string) {
  return pair; // Already in correct format: EUR/USD
}

/* ─── Get real-time price for a single pair ─── */
export async function getRealPrice(pair: string) {
  try {
    const data = await twelveData("/price", {
      symbol: pairToSymbol(pair),
      interval: "1min",
    });
    return {
      pair,
      price: parseFloat(data.price) || 0,
      bid: parseFloat(data.bid) || parseFloat(data.price) * 0.99995,
      ask: parseFloat(data.ask) || parseFloat(data.price) * 1.00005,
      spread: parseFloat(data.spread) || 0,
      change: parseFloat(data.change) || 0,
      changePercent: parseFloat(data.percent_change) || 0,
      high: parseFloat(data.high) || 0,
      low: parseFloat(data.low) || 0,
      open: parseFloat(data.open) || 0,
    };
  } catch {
    return null;
  }
}

/* ─── Get real-time quote for a pair ─── */
export async function getQuote(pair: string) {
  try {
    const data = await twelveData("/quote", {
      symbol: pairToSymbol(pair),
      interval: "1min",
    });
    return data;
  } catch {
    return null;
  }
}

/* ─── Get exchange rate ─── */
export async function getExchangeRate(from: string, to: string) {
  try {
    const data = await twelveData("/exchange_rate", {
      symbol: `${from}/${to}`,
    });
    return data;
  } catch {
    return null;
  }
}

/* ─── Get all live prices ─── */
export async function getAllLivePrices() {
  const results = await Promise.allSettled(
    FOREX_PAIRS.map((pair) => getRealPrice(pair))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof getRealPrice>>>> =>
      r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}

/* ─── Get technical indicator (Twelve Data) ─── */
export async function getIndicator(
  pair: string,
  indicator: string,
  params: Record<string, string> = {}
) {
  try {
    const data = await twelveData(`/${indicator}`, {
      symbol: pairToSymbol(pair),
      interval: "1min",
      outputsize: "30",
      ...params,
    });
    return data;
  } catch {
    return null;
  }
}

/* ─── Get multiple indicators for a pair ─── */
export async function getPairIndicators(pair: string) {
  const [rsi, macd, ema, sma, bbands, atr] = await Promise.allSettled([
    getIndicator(pair, "rsi", { time_period: "14" }),
    getIndicator(pair, "macd"),
    getIndicator(pair, "ema", { time_period: "9" }),
    getIndicator(pair, "sma", { time_period: "20" }),
    getIndicator(pair, "bbands", { time_period: "20" }),
    getIndicator(pair, "atr", { time_period: "14" }),
  ]);

  const extractValues = (result: PromiseSettledResult<any>) => {
    if (result.status !== "fulfilled" || !result.value?.values) return [];
    return result.value.values;
  };

  return {
    pair,
    rsi: extractValues(rsi),
    macd: extractValues(macd),
    ema: extractValues(ema),
    sma: extractValues(sma),
    bbands: extractValues(bbands),
    atr: extractValues(atr),
  };
}

/* ─── Get forex market movers ─── */
export async function getForexMarketMovers() {
  try {
    const data = await twelveData("/market_movers/forex", {});
    return data;
  } catch {
    return null;
  }
}

/* ─── Alpha Vantage: Currency Exchange Rate ─── */
export async function getAVExchangeRate(from: string, to: string) {
  try {
    const data = await alphaVantage({
      function: "CURRENCY_EXCHANGE_RATE",
      from_currency: from,
      to_currency: to,
    });
    return data["Realtime Currency Exchange Rate"];
  } catch {
    return null;
  }
}

/* ─── Alpha Vantage: FX Intraday ─── */
export async function getAVFxIntraday(from: string, to: string) {
  try {
    const data = await alphaVantage({
      function: "FX_INTRADAY",
      from_symbol: from,
      to_symbol: to,
      interval: "5min",
      outputsize: "100",
    });
    const timeSeriesKey = Object.keys(data).find((k) => k.includes("Time Series"));
    return timeSeriesKey ? data[timeSeriesKey] : null;
  } catch {
    return null;
  }
}