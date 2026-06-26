import { NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════
   SMART DUAL-API KEY SYSTEM
   - 2 RapidAPI accounts × 2 APIs (Twelve Data + Alpha Vantage) = 4x capacity
   - Pair 0,2,4... → Alpha Vantage first, Twelve Data fallback
   - Pair 1,3,5... → Twelve Data first, Alpha Vantage fallback
   - Per-KEY rate limiting (not per-host)
   - When one key hits 429, auto-switch to next available key
   ═══════════════════════════════════════════════════════════ */

interface ApiKey {
  id: string;          // unique id for tracking
  key: string;
  host: string;
  service: "TD" | "AV";  // Twelve Data or Alpha Vantage
  limitedUntil: number;
  callCount: number;
}

class DualApiManager {
  private tdKeys: ApiKey[] = [];
  private avKeys: ApiKey[] = [];
  private tdIdx = 0;
  private avIdx = 0;

  constructor() {
    // Twelve Data keys — up to 4
    if (process.env.TWELVE_DATA_API_KEY)
      this.tdKeys.push({ id: "TD-1", key: process.env.TWELVE_DATA_API_KEY, host: process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    if (process.env.TWELVE_DATA_API_KEY_2)
      this.tdKeys.push({ id: "TD-2", key: process.env.TWELVE_DATA_API_KEY_2, host: process.env.TWELVE_DATA_API_HOST_2 || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    if (process.env.TWELVE_DATA_API_KEY_3)
      this.tdKeys.push({ id: "TD-3", key: process.env.TWELVE_DATA_API_KEY_3, host: process.env.TWELVE_DATA_API_HOST_3 || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });
    if (process.env.TWELVE_DATA_API_KEY_4)
      this.tdKeys.push({ id: "TD-4", key: process.env.TWELVE_DATA_API_KEY_4, host: process.env.TWELVE_DATA_API_HOST_4 || "twelve-data1.p.rapidapi.com", service: "TD", limitedUntil: 0, callCount: 0 });

    // Alpha Vantage keys — up to 4
    if (process.env.ALPHA_VANTAGE_API_KEY)
      this.avKeys.push({ id: "AV-1", key: process.env.ALPHA_VANTAGE_API_KEY, host: process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_2)
      this.avKeys.push({ id: "AV-2", key: process.env.ALPHA_VANTAGE_API_KEY_2, host: process.env.ALPHA_VANTAGE_API_HOST_2 || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_3)
      this.avKeys.push({ id: "AV-3", key: process.env.ALPHA_VANTAGE_API_KEY_3, host: process.env.ALPHA_VANTAGE_API_HOST_3 || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_4)
      this.avKeys.push({ id: "AV-4", key: process.env.ALPHA_VANTAGE_API_KEY_4, host: process.env.ALPHA_VANTAGE_API_HOST_4 || "alpha-vantage.p.rapidapi.com", service: "AV", limitedUntil: 0, callCount: 0 });
  }

  /** Get next available key from a specific service pool */
  private getNextKey(pool: ApiKey[], idxRef: { value: number }): ApiKey | null {
    const now = Date.now();
    const available = pool.filter(k => k.limitedUntil <= now);
    if (available.length === 0) return null; // All keys rate limited

    // Round-robin within available keys
    const start = idxRef.value % pool.length;
    for (let i = 0; i < pool.length; i++) {
      const j = (start + i) % pool.length;
      if (pool[j].limitedUntil <= now) {
        idxRef.value = j + 1;
        pool[j].callCount++;
        return pool[j];
      }
    }
    return available[0];
  }

  /** Get a Twelve Data key */
  getTD(): ApiKey | null {
    return this.getNextKey(this.tdKeys, { value: this.tdIdx });
  }

  /** Get an Alpha Vantage key */
  getAV(): ApiKey | null {
    return this.getNextKey(this.avKeys, { value: this.avIdx });
  }

  /** Mark a specific key as rate limited */
  markLimited(keyId: string, secs = 60) {
    const allKeys = [...this.tdKeys, ...this.avKeys];
    const k = allKeys.find(x => x.id === keyId);
    if (k) {
      k.limitedUntil = Date.now() + secs * 1000;
      console.log(`[API] ${keyId} rate limited for ${secs}s`);
    }
  }

  /** Fetch with smart retry across keys and services */
  async fetchWithFailover(url: string, preferredService: "AV" | "TD"): Promise<{ response: Response | null; usedKey: string; usedService: string }> {
    const isAV = preferredService === "AV";

    // Try preferred service first (both keys if needed)
    for (let attempt = 0; attempt < 2; attempt++) {
      const key = isAV ? this.getAV() : this.getTD();
      if (!key) break;

      try {
        const r = await fetch(url, {
          headers: { "x-rapidapi-key": key.key, "x-rapidapi-host": key.host },
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(8000),
        });
        if (r.status === 429) {
          this.markLimited(key.id, 60);
          continue; // Try next key in same service
        }
        return { response: r, usedKey: key.id, usedService: key.service };
      } catch { continue; }
    }

    // Preferred service exhausted — try the OTHER service (failover!)
    const fallbackService: "AV" | "TD" = isAV ? "TD" : "AV";
    const fbKey = fallbackService === "AV" ? this.getAV() : this.getTD();
    if (fbKey) {
      try {
        const r = await fetch(url, {
          headers: { "x-rapidapi-key": fbKey.key, "x-rapidapi-host": fbKey.host },
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(8000),
        });
        if (r.status === 429) this.markLimited(fbKey.id, 60);
        else return { response: r, usedKey: fbKey.id, usedService: fbKey.service };
      } catch {}
    }

    return { response: null, usedKey: "none", usedService: "none" };
  }

  get stats() {
    return {
      tdKeys: this.tdKeys.length,
      avKeys: this.avKeys.length,
      totalKeys: this.tdKeys.length + this.avKeys.length,
      tdCalls: this.tdKeys.reduce((a, k) => a + k.callCount, 0),
      avCalls: this.avKeys.reduce((a, k) => a + k.callCount, 0),
      tdLimited: this.tdKeys.filter(k => k.limitedUntil > Date.now()).length,
      avLimited: this.avKeys.filter(k => k.limitedUntil > Date.now()).length,
    };
  }
}

const api = new DualApiManager();
console.log(`[Prices API] TD keys: ${api.stats.tdKeys}, AV keys: ${api.stats.avKeys}`);

/* ─── Data Fetchers ─── */

// Alpha Vantage exchange rate
async function fetchAVRate(from: string, to: string) {
  const host = process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com";
  const url = `https://${host}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}`;
  const { response, usedKey, usedService } = await api.fetchWithFailover(url, "AV");
  if (!response?.ok) return null;
  const d = await response.json();
  const ex = d?.["Realtime Currency Exchange Rate"];
  if (!ex) return null;
  const price = parseFloat(ex["5. Exchange Rate"]);
  if (isNaN(price)) return null;
  return {
    price, bid: parseFloat(ex["8. Bid Price"]) || price, ask: parseFloat(ex["9. Ask Price"]) || price,
    src: usedService, key: usedKey,
  };
}

// Twelve Data price
async function fetchTDPrice(pair: string) {
  const host = process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com";
  const url = `https://${host}/price?symbol=${pair}&interval=1min`;
  const { response, usedKey, usedService } = await api.fetchWithFailover(url, "TD");
  if (!response?.ok) return null;
  const d = await response.json();
  const price = parseFloat(d.price);
  if (isNaN(price)) return null;
  return {
    price, bid: parseFloat(d.bid) || price, ask: parseFloat(d.ask) || price,
    src: usedService, key: usedKey,
  };
}

/* ─── Pairs ─── */
const PAIRS = [
  { pair: "EUR/USD", from: "EUR", to: "USD" },
  { pair: "GBP/USD", from: "GBP", to: "USD" },
  { pair: "USD/JPY", from: "USD", to: "JPY" },
  { pair: "USD/CHF", from: "USD", to: "CHF" },
  { pair: "AUD/USD", from: "AUD", to: "USD" },
  { pair: "NZD/USD", from: "NZD", to: "USD" },
  { pair: "USD/CAD", from: "USD", to: "CAD" },
  { pair: "EUR/GBP", from: "EUR", to: "GBP" },
  { pair: "EUR/JPY", from: "EUR", to: "JPY" },
  { pair: "GBP/JPY", from: "GBP", to: "JPY" },
  { pair: "XAU/USD", from: "XAU", to: "USD" },
  { pair: "XAG/USD", from: "XAG", to: "USD" },
];

const priceCache = new Map<string, number>();

function getSpread(p: string) { return p.includes("XAU") ? 0.30 : p.includes("XAG") ? 0.03 : p.includes("JPY") ? 0.03 : 0.00015; }
function getDec(p: string) { return (p.includes("XAU") || p.includes("XAG") || p.includes("JPY")) ? 2 : 5; }

export async function GET() {
  try {
    const prices: any[] = [];
    let liveCount = 0;
    let avCount = 0, tdCount = 0;
    const sources: string[] = [];

    for (let i = 0; i < PAIRS.length; i++) {
      const { pair, from, to } = PAIRS[i];
      try {
        // SMART ALTERNATION: even index → AV first, odd index → TD first
        // This spreads the load equally across both APIs
        const preferAV = i % 2 === 0;
        let data = preferAV ? await fetchAVRate(from, to) : await fetchTDPrice(pair);

        // If preferred API failed, try the other one
        if (!data) {
          data = preferAV ? await fetchTDPrice(pair) : await fetchAVRate(from, to);
        }

        if (!data) continue;

        const spread = getSpread(pair);
        const dec = getDec(pair);
        const prev = priceCache.get(pair) || data.bid;
        const chg = data.bid - prev;
        const chgPct = prev > 0 ? (chg / prev) * 100 : 0;
        priceCache.set(pair, data.bid);

        if (data.src === "AV") avCount++; else tdCount++;
        sources.push(`${pair}→${data.src}`);

        prices.push({
          pair,
          bid: +data.bid.toFixed(dec),
          ask: +data.ask.toFixed(dec),
          spread: +spread.toFixed(dec),
          change: +chg.toFixed(dec),
          changePercent: +chgPct.toFixed(3),
          source: data.src,
          key: data.key,
        });
        liveCount++;

        // Small delay between pairs to avoid burst rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch { /* skip */ }
    }

    const st = api.stats;
    return NextResponse.json({
      source: "RapidAPI (Dual Account)",
      liveCount,
      total: PAIRS.length,
      prices,
      apiStats: {
        tdKeys: st.tdKeys, avKeys: st.avKeys, totalKeys: st.totalKeys,
        avUsed: avCount, tdUsed: tdCount,
        tdCalls: st.tdCalls, avCalls: st.avCalls,
        tdLimited: st.tdLimited, avLimited: st.avLimited,
        sources,
      },
    });
  } catch (error) {
    console.error("[Prices] Error:", error);
    return NextResponse.json({ source: "error", liveCount: 0, total: PAIRS.length, prices: [] }, { status: 500 });
  }
}