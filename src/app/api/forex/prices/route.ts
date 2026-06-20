import { NextResponse } from "next/server";

/* ─── Key Pool ─── */
interface Cred { key: string; host: string; limitedUntil: number; }

class KeyPool {
  creds: Cred[] = [];
  private idx = 0;
  constructor() {
    if (process.env.TWELVE_DATA_API_KEY)
      this.creds.push({ key: process.env.TWELVE_DATA_API_KEY, host: process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com", limitedUntil: 0 });
    if (process.env.TWELVE_DATA_API_KEY_2)
      this.creds.push({ key: process.env.TWELVE_DATA_API_KEY_2, host: process.env.TWELVE_DATA_API_HOST_2 || "twelve-data1.p.rapidapi.com", limitedUntil: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY)
      this.creds.push({ key: process.env.ALPHA_VANTAGE_API_KEY, host: process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com", limitedUntil: 0 });
    if (process.env.ALPHA_VANTAGE_API_KEY_2)
      this.creds.push({ key: process.env.ALPHA_VANTAGE_API_KEY_2, host: process.env.ALPHA_VANTAGE_API_HOST_2 || "alpha-vantage.p.rapidapi.com", limitedUntil: 0 });
  }
  get(preferredHost?: string): Cred {
    const now = Date.now();
    if (preferredHost) {
      const p = this.creds.find(c => c.host === preferredHost && c.limitedUntil <= now);
      if (p) return p;
    }
    for (let i = 0; i < this.creds.length; i++) {
      const j = (this.idx + i) % this.creds.length;
      if (this.creds[j].limitedUntil <= now) { this.idx = (j + 1) % this.creds.length; return this.creds[j]; }
    }
    return [...this.creds].sort((a, b) => a.limitedUntil - b.limitedUntil)[0];
  }
  markLimited(host: string, secs = 60) {
    const c = this.creds.find(x => x.host === host);
    if (c) c.limitedUntil = Date.now() + secs * 1000;
  }
}

const keys = new KeyPool();

async function fetchRotated(url: string, preferredHost: string, timeout = 8000) {
  const cred = keys.get(preferredHost);
  try {
    const r = await fetch(url, {
      headers: { "x-rapidapi-key": cred.key, "x-rapidapi-host": cred.host },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(timeout),
    });
    if (r.status === 429) {
      keys.markLimited(cred.host, 60);
      const c2 = keys.get();
      if (c2.host === cred.host) return r;
      const r2 = await fetch(url, {
        headers: { "x-rapidapi-key": c2.key, "x-rapidapi-host": c2.host },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(timeout),
      });
      if (r2.status === 429) keys.markLimited(c2.host, 60);
      return r2;
    }
    return r;
  } catch { return null as any; }
}

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

// In-memory price cache for change calculation
const priceCache = new Map<string, number>();

function getSpread(pair: string) {
  if (pair.includes("XAU")) return 0.30;
  if (pair.includes("XAG")) return 0.03;
  if (pair.includes("JPY")) return 0.03;
  return 0.00015;
}
function getDec(pair: string) {
  if (pair.includes("XAU") || pair.includes("XAG") || pair.includes("JPY")) return 2;
  return 5;
}

export async function GET() {
  try {
    const prices = [];
    let liveCount = 0;

    for (const { pair, from, to } of PAIRS) {
      try {
        // Try Alpha Vantage first
        const avHost = process.env.ALPHA_VANTAGE_API_HOST || "alpha-vantage.p.rapidapi.com";
        let url = `https://${avHost}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}`;
        let res = await fetchRotated(url, avHost);
        let rate = res?.ok ? (await res.json())?.["Realtime Currency Exchange Rate"] : null;

        // Fallback to Twelve Data
        if (!rate) {
          const tdHost = process.env.TWELVE_DATA_API_HOST || "twelve-data1.p.rapidapi.com";
          url = `https://${tdHost}/price?symbol=${pair}&interval=1min`;
          res = await fetchRotated(url, tdHost);
          if (res?.ok) {
            const d = await res.json();
            const price = parseFloat(d.price);
            if (!isNaN(price)) {
              const bid = parseFloat(d.bid) || price;
              const ask = parseFloat(d.ask) || price;
              const spread = getSpread(pair);
              const dec = getDec(pair);
              const prev = priceCache.get(pair) || bid;
              const chg = bid - prev;
              const chgPct = prev > 0 ? (chg / prev) * 100 : 0;
              priceCache.set(pair, bid);
              prices.push({ pair, bid: +bid.toFixed(dec), ask: +ask.toFixed(dec), spread: +spread.toFixed(dec), change: +chg.toFixed(dec), changePercent: +chgPct.toFixed(3) });
              liveCount++;
              continue;
            }
          }
          continue;
        }

        const price = parseFloat(rate["5. Exchange Rate"]);
        const bid = parseFloat(rate["8. Bid Price"]) || price;
        const ask = parseFloat(rate["9. Ask Price"]) || price;
        const spread = getSpread(pair);
        const dec = getDec(pair);
        const prev = priceCache.get(pair) || bid;
        const chg = bid - prev;
        const chgPct = prev > 0 ? (chg / prev) * 100 : 0;
        priceCache.set(pair, bid);

        prices.push({
          pair,
          bid: +bid.toFixed(dec),
          ask: +ask.toFixed(dec),
          spread: +spread.toFixed(dec),
          change: +chg.toFixed(dec),
          changePercent: +chgPct.toFixed(3),
        });
        liveCount++;
      } catch {
        // skip failed pair
      }
    }

    return NextResponse.json({ source: "RapidAPI (Dual Key)", liveCount, total: PAIRS.length, prices, keys: keys.creds.length });
  } catch (error) {
    console.error("Prices error:", error);
    return NextResponse.json({ source: "error", liveCount: 0, total: PAIRS.length, prices: [], keys: keys.creds.length }, { status: 500 });
  }
}