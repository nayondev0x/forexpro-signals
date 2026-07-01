// Server-side only — never import this in client components

/* ═══════════════════════════════════════════════════════════
   DUAL-API SMART KEY SYSTEM (Shared Library)
   - 2 RapidAPI accounts × 2 services = 4x free capacity
   - Per-KEY rate limiting (unique id per key, not per host)
   - Each API (TD/AV) has its own key pool with round-robin
   - Failover: if preferred API exhausted → auto switch to other
   ═══════════════════════════════════════════════════════════ */

interface ApiKey {
  id: string;
  key: string;
  host: string;
  service: "TD" | "AV";
  limitedUntil: number;
}

class DualApiManager {
  private tdKeys: ApiKey[] = [];
  private avKeys: ApiKey[] = [];
  private tdIdx = 0;
  private avIdx = 0;

  constructor() {
    if (process.env.TWELVE_DATA_API_KEY)
      this.tdKeys.push({ id: "TD-1", key: process.env.TWELVE_DATA_API_KEY, host: process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0 });
    if (process.env.TWELVE_DATA_API_KEY_2)
      this.tdKeys.push({ id: "TD-2", key: process.env.TWELVE_DATA_API_KEY_2, host: process.env.TWELVE_DATA_API_HOST_2 || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY)
      this.avKeys.push({ id: "AV-1", key: process.env.ALPHA_VANTAGE_API_KEY, host: process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_2)
      this.avKeys.push({ id: "AV-2", key: process.env.ALPHA_VANTAGE_API_KEY_2, host: process.env.ALPHA_VANTAGE_API_HOST_2 || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0 });

    console.log(`[DualAPI] TD keys: ${this.tdKeys.length}, AV keys: ${this.avKeys.length} (total: ${this.tdKeys.length + this.avKeys.length})`);
  }

  private getNext(pool: ApiKey[], isTD: boolean): ApiKey | null {
    const now = Date.now();
    const idx = isTD ? this.tdIdx : this.avIdx;
    for (let i = 0; i < pool.length; i++) {
      const j = (idx + i) % pool.length;
      if (pool[j].limitedUntil <= now) {
        if (isTD) this.tdIdx = j + 1; else this.avIdx = j + 1;
        return pool[j];
      }
    }
    return null;
  }

  getTD() { return this.getNext(this.tdKeys, true); }
  getAV() { return this.getNext(this.avKeys, false); }

  markLimited(keyId: string, secs = 60) {
    const k = [...this.tdKeys, ...this.avKeys].find(x => x.id === keyId);
    if (k) { k.limitedUntil = Date.now() + secs * 1000; }
  }

  async fetchTD(endpoint: string, params: Record<string, string> = {}) {
    // Try up to 2 TD keys
    for (let i = 0; i < 2; i++) {
      const k = this.getTD();
      if (!k) break;
      const url = new URL(`https://${k.host}${endpoint}`);
      Object.entries(params).forEach(([pk, v]) => url.searchParams.set(pk, v));
      try {
        const r = await fetch(url.toString(), { headers: { "x-rapidapi-key": k.key, "x-rapidapi-host": k.host }, signal: AbortSignal.timeout(10000) });
        if (r.status === 429) { this.markLimited(k.id, 60); continue; }
        if (!r.ok) throw new Error(`TD ${r.status}`);
        return await r.json();
      } catch (e) { if ((e as Error).message?.includes("429")) { this.markLimited(k.id, 60); continue; } throw e; }
    }
    throw new Error("TwelveData: All keys rate limited");
  }

  async fetchAV(params: Record<string, string>) {
    for (let i = 0; i < 2; i++) {
      const k = this.getAV();
      if (!k) break;
      const url = new URL(`https://${k.host}/query`);
      Object.entries(params).forEach(([pk, v]) => url.searchParams.set(pk, v));
      try {
        const r = await fetch(url.toString(), { headers: { "x-rapidapi-key": k.key, "x-rapidapi-host": k.host }, signal: AbortSignal.timeout(10000) });
        if (r.status === 429) { this.markLimited(k.id, 60); continue; }
        if (!r.ok) throw new Error(`AV ${r.status}`);
        return await r.json();
      } catch (e) { if ((e as Error).message?.includes("429")) { this.markLimited(k.id, 60); continue; } throw e; }
    }
    throw new Error("AlphaVantage: All keys rate limited");
  }

  get stats() {
    const now = Date.now();
    return {
      tdKeys: this.tdKeys.length, avKeys: this.avKeys.length,
      totalKeys: this.tdKeys.length + this.avKeys.length,
      tdLimited: this.tdKeys.filter(k => k.limitedUntil > now).length,
      avLimited: this.avKeys.filter(k => k.limitedUntil > now).length,
    };
  }
}

const api = new DualApiManager();

/* ─── Forex Pairs ─── */
export const FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
  "AUD/USD", "NZD/USD", "USD/CAD", "EUR/GBP",
  "EUR/JPY", "GBP/JPY", "XAU/USD", "XAG/USD",
];

function pairToSymbol(pair: string) { return pair; }

/* ─── Get real-time price (TD) ─── */
export async function getRealPrice(pair: string) {
  try {
    const data = await api.fetchTD("/price", { symbol: pairToSymbol(pair), interval: "1min" });
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
  } catch { return null; }
}

/* ─── Get quote (TD) ─── */
export async function getQuote(pair: string) {
  try { return await api.fetchTD("/quote", { symbol: pairToSymbol(pair), interval: "1min" }); } catch { return null; }
}

/* ─── Exchange rate (TD) ─── */
export async function getExchangeRate(from: string, to: string) {
  try { return await api.fetchTD("/exchange_rate", { symbol: `${from}/${to}` }); } catch { return null; }
}

/* ─── All live prices (TD) ─── */
export async function getAllLivePrices() {
  const results = await Promise.allSettled(FOREX_PAIRS.map((pair) => getRealPrice(pair)));
  return results
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof getRealPrice>>>> =>
      r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}

/* ─── Technical indicator (TD) ─── */
export async function getIndicator(pair: string, indicator: string, params: Record<string, string> = {}) {
  try { return await api.fetchTD(`/${indicator}`, { symbol: pairToSymbol(pair), interval: "1min", outputsize: "30", ...params }); } catch { return null; }
}

/* ─── Time Series (TD) for charts ─── */
export async function getTimeSeries(pair: string, interval = "5min", outputsize = "100") {
  try { return await api.fetchTD("/time_series", { symbol: pairToSymbol(pair), interval, outputsize }); } catch { return null; }
}

/* ─── Multiple indicators (TD) ─── */
export async function getPairIndicators(pair: string) {
  const [rsi, macd, ema, sma, bbands, atr] = await Promise.allSettled([
    getIndicator(pair, "rsi", { time_period: "14" }),
    getIndicator(pair, "macd"),
    getIndicator(pair, "ema", { time_period: "9" }),
    getIndicator(pair, "sma", { time_period: "20" }),
    getIndicator(pair, "bbands", { time_period: "20" }),
    getIndicator(pair, "atr", { time_period: "14" }),
  ]);
  const extract = (r: PromiseSettledResult<any>) => r.status === "fulfilled" && r.value?.values ? r.value.values : [];
  return { pair, rsi: extract(rsi), macd: extract(macd), ema: extract(ema), sma: extract(sma), bbands: extract(bbands), atr: extract(atr) };
}

/* ─── Market movers (TD) ─── */
export async function getForexMarketMovers() {
  try { return await api.fetchTD("/market_movers/forex", {}); } catch { return null; }
}

/* ─── AV: Exchange Rate ─── */
export async function getAVExchangeRate(from: string, to: string) {
  try { const d = await api.fetchAV({ function: "CURRENCY_EXCHANGE_RATE", from_currency: from, to_currency: to }); return d["Realtime Currency Exchange Rate"]; } catch { return null; }
}

/* ─── AV: FX Intraday ─── */
export async function getAVFxIntraday(from: string, to: string) {
  try {
    const d = await api.fetchAV({ function: "FX_INTRADAY", from_symbol: from, to_symbol: to, interval: "5min", outputsize: "100" });
    const k = Object.keys(d).find((k) => k.includes("Time Series"));
    return k ? d[k] : null;
  } catch { return null; }
}

/* ─── Smart dual-source price: AV first, TD fallback ─── */
export async function getSmartPrice(pair: string, from: string, to: string, preferAV = true) {
  // Try preferred source first
  if (preferAV) {
    try {
      const d = await api.fetchAV({ function: "CURRENCY_EXCHANGE_RATE", from_currency: from, to_currency: to });
      const ex = d?.["Realtime Currency Exchange Rate"];
      if (ex) {
        const price = parseFloat(ex["5. Exchange Rate"]);
        if (!isNaN(price)) return { price, bid: parseFloat(ex["8. Bid Price"]) || price, ask: parseFloat(ex["9. Ask Price"]) || price, src: "AV" as const };
      }
    } catch {}
    // Fallback to TD
    try {
      const d = await api.fetchTD("/price", { symbol: pair, interval: "1min" });
      const price = parseFloat(d.price);
      if (!isNaN(price)) return { price, bid: parseFloat(d.bid) || price, ask: parseFloat(d.ask) || price, src: "TD" as const };
    } catch {}
  } else {
    try {
      const d = await api.fetchTD("/price", { symbol: pair, interval: "1min" });
      const price = parseFloat(d.price);
      if (!isNaN(price)) return { price, bid: parseFloat(d.bid) || price, ask: parseFloat(d.ask) || price, src: "TD" as const };
    } catch {}
    try {
      const d = await api.fetchAV({ function: "CURRENCY_EXCHANGE_RATE", from_currency: from, to_currency: to });
      const ex = d?.["Realtime Currency Exchange Rate"];
      if (ex) {
        const price = parseFloat(ex["5. Exchange Rate"]);
        if (!isNaN(price)) return { price, bid: parseFloat(ex["8. Bid Price"]) || price, ask: parseFloat(ex["9. Ask Price"]) || price, src: "AV" as const };
      }
    } catch {}
  }
  return null;
}

export { api as dualApi };
