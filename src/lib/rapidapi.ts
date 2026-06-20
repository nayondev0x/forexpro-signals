// Server-side only — never import this in client components

/* ─── Key Pool with Auto-Rotation ─── */
interface ApiCredential {
  key: string;
  host: string;
  rateLimitedUntil: number; // timestamp when this key becomes available again
}

class KeyPool {
  private credentials: ApiCredential[] = [];
  private currentIdx = 0;

  constructor() {
    // Twelve Data keys
    if (process.env.TWELVE_DATA_API_KEY) {
      this.credentials.push({
        key: process.env.TWELVE_DATA_API_KEY,
        host: process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com",
        rateLimitedUntil: 0,
      });
    }
    if (process.env.TWELVE_DATA_API_KEY_2) {
      this.credentials.push({
        key: process.env.TWELVE_DATA_API_KEY_2,
        host: process.env.TWELVE_DATA_API_HOST_2 || "twelve-data1.p.rapidapi.com",
        rateLimitedUntil: 0,
      });
    }

    // Alpha Vantage keys (separate pool)
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      this.credentials.push({
        key: process.env.ALPHA_VANTAGE_API_KEY,
        host: process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com",
        rateLimitedUntil: 0,
      });
    }
    if (process.env.ALPHA_VANTAGE_API_KEY_2) {
      this.credentials.push({
        key: process.env.ALPHA_VANTAGE_API_KEY_2,
        host: process.env.ALPHA_VANTAGE_API_HOST_2 || "alpha-vantage.p.rapidapi.com",
        rateLimitedUntil: 0,
      });
    }
  }

  /** Get next available credential, skipping rate-limited ones */
  get(preferredHost?: string): ApiCredential {
    const now = Date.now();
    // Try preferred host first
    if (preferredHost) {
      const pref = this.credentials.find(
        (c) => c.host === preferredHost && c.rateLimitedUntil <= now
      );
      if (pref) return pref;
    }
    // Round-robin through available keys
    for (let i = 0; i < this.credentials.length; i++) {
      const idx = (this.currentIdx + i) % this.credentials.length;
      const cred = this.credentials[idx];
      if (cred.rateLimitedUntil <= now) {
        this.currentIdx = (idx + 1) % this.credentials.length;
        return cred;
      }
    }
    // All rate limited — pick the one that recovers soonest
    const sorted = [...this.credentials].sort((a, b) => a.rateLimitedUntil - b.rateLimitedUntil);
    return sorted[0];
  }

  /** Mark a credential as rate-limited for `seconds` duration */
  markRateLimited(host: string, seconds: number = 60) {
    const cred = this.credentials.find((c) => c.host === host);
    if (cred) {
      cred.rateLimitedUntil = Date.now() + seconds * 1000;
      console.log(`[KeyPool] Rate limited ${host} for ${seconds}s`);
    }
  }

  get keyCount() {
    return this.credentials.length;
  }
}

const keyPool = new KeyPool();
console.log(`[KeyPool] Initialized with ${keyPool.keyCount} API credentials`);

/* ─── Twelve Data Client (with key rotation) ─── */
async function twelveData(endpoint: string, params: Record<string, string> = {}) {
  const cred = keyPool.get(process.env.TWELVE_DATA_API_HOST);
  const url = new URL(`https://${cred.host}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "x-rapidapi-key": cred.key, "x-rapidapi-host": cred.host },
    next: { revalidate: 0 },
  });

  if (res.status === 429) {
    // Rate limited — try with another key
    keyPool.markRateLimited(cred.host, 60);
    const cred2 = keyPool.get();
    if (cred2.host === cred.host) {
      // All keys rate limited
      throw new Error(`TwelveData 429: All keys rate limited`);
    }
    console.log(`[TwelveData] Retrying with alternate key...`);
    const res2 = await fetch(url.toString(), {
      headers: { "x-rapidapi-key": cred2.key, "x-rapidapi-host": cred2.host },
      next: { revalidate: 0 },
    });
    if (!res2.ok) {
      if (res2.status === 429) keyPool.markRateLimited(cred2.host, 60);
      throw new Error(`TwelveData ${res2.status}: ${res2.statusText}`);
    }
    return res2.json();
  }

  if (!res.ok) throw new Error(`TwelveData ${res.status}: ${res.statusText}`);
  return res.json();
}

/* ─── Alpha Vantage Client (with key rotation) ─── */
async function alphaVantage(params: Record<string, string>) {
  const cred = keyPool.get(process.env.ALPHA_VANTAGE_API_HOST);
  const url = new URL(`https://${cred.host}/query`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "x-rapidapi-key": cred.key, "x-rapidapi-host": cred.host },
    next: { revalidate: 0 },
  });

  if (res.status === 429) {
    keyPool.markRateLimited(cred.host, 60);
    const cred2 = keyPool.get();
    if (cred2.host === cred.host) {
      throw new Error(`AlphaVantage 429: All keys rate limited`);
    }
    console.log(`[AlphaVantage] Retrying with alternate key...`);
    const res2 = await fetch(url.toString(), {
      headers: { "x-rapidapi-key": cred2.key, "x-rapidapi-host": cred2.host },
      next: { revalidate: 0 },
    });
    if (!res2.ok) {
      if (res2.status === 429) keyPool.markRateLimited(cred2.host, 60);
      throw new Error(`AlphaVantage ${res2.status}: ${res2.statusText}`);
    }
    return res2.json();
  }

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