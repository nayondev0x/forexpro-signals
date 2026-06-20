import { NextResponse } from "next/server";

const FOREX_PAIRS = [
  { pair: "EUR/USD", price: 1.0872, change: 0.0003, changePercent: 0.028 },
  { pair: "GBP/USD", price: 1.2715, change: -0.0012, changePercent: -0.094 },
  { pair: "USD/JPY", price: 157.85, change: 0.15, changePercent: 0.095 },
  { pair: "USD/CHF", price: 0.8935, change: -0.0008, changePercent: -0.089 },
  { pair: "AUD/USD", price: 0.6648, change: 0.0005, changePercent: 0.075 },
  { pair: "NZD/USD", price: 0.6115, change: -0.0003, changePercent: -0.049 },
  { pair: "USD/CAD", price: 1.3675, change: 0.0010, changePercent: 0.073 },
  { pair: "EUR/GBP", price: 0.8552, change: 0.0002, changePercent: 0.023 },
  { pair: "EUR/JPY", price: 171.65, change: 0.25, changePercent: 0.146 },
  { pair: "GBP/JPY", price: 200.72, change: -0.35, changePercent: -0.174 },
  { pair: "XAU/USD", price: 2345.50, change: 8.50, changePercent: 0.364 },
  { pair: "XAG/USD", price: 29.45, change: 0.12, changePercent: 0.408 },
];

export async function GET() {
  // Add slight randomization to simulate live prices
  const prices = FOREX_PAIRS.map((p) => {
    const isJPY = p.pair.includes("JPY");
    const isGold = p.pair.includes("XAU");
    const isSilver = p.pair.includes("XAG");
    const decimals = isJPY || isGold || isSilver ? 2 : 5;
    const fluctuation = p.price * (Math.random() - 0.5) * 0.001;
    const newPrice = p.price + fluctuation;
    const spreadPoints = isGold ? 0.30 : isSilver ? 0.03 : isJPY ? 0.03 : 0.00015;

    return {
      pair: p.pair,
      bid: parseFloat((newPrice - spreadPoints / 2).toFixed(decimals)),
      ask: parseFloat((newPrice + spreadPoints / 2).toFixed(decimals)),
      spread: parseFloat(spreadPoints.toFixed(isJPY || isGold || isSilver ? 2 : 5)),
      change: parseFloat(((newPrice - p.price) + p.change).toFixed(decimals)),
      changePercent: parseFloat((((newPrice - p.price) + p.change) / p.price * 100).toFixed(3)),
    };
  });

  return NextResponse.json(prices);
}