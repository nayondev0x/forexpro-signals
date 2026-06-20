import { NextResponse } from "next/server";

const ALPHA_KEY = process.env.ALPHA_VANTAGE_API_KEY!;
const ALPHA_HOST = process.env.ALPHA_VANTAGE_API_HOST!;
const TWELVE_KEY = process.env.TWELVE_DATA_API_KEY!;
const TWELVE_HOST = process.env.TWELVE_DATA_API_HOST!;

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
        const url = `https://${ALPHA_HOST}/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}`;
        const res = await fetch(url, {
          headers: { "x-rapidapi-key": ALPHA_KEY, "x-rapidapi-host": ALPHA_HOST },
          next: { revalidate: 0 },
        });
        const data = await res.json();
        const rate = data["Realtime Currency Exchange Rate"];
        if (!rate) continue;

        const price = parseFloat(rate["5. Exchange Rate"]);
        const bid = parseFloat(rate["8. Bid Price"]) || price;
        const ask = parseFloat(rate["9. Ask Price"]) || price;
        const spread = getSpread(pair);
        const dec = getDec(pair);

        prices.push({
          pair,
          bid: parseFloat(bid.toFixed(dec)),
          ask: parseFloat(ask.toFixed(dec)),
          spread: parseFloat(spread.toFixed(dec)),
          price: parseFloat(price.toFixed(dec)),
          change: 0,
          changePercent: 0,
        });
        liveCount++;
      } catch {
        // fallback
      }
    }

    return NextResponse.json({ source: "alpha-vantage", liveCount, total: PAIRS.length, prices });
  } catch (error) {
    console.error("Prices error:", error);
    return NextResponse.json({ source: "error", liveCount: 0, total: PAIRS.length, prices: [] }, { status: 500 });
  }
}