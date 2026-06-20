import { NextResponse } from "next/server";
import { getAllLivePrices } from "@/lib/rapidapi";

export async function GET() {
  try {
    const prices = await getAllLivePrices();

    if (prices.length === 0) {
      // Fallback to Alpha Vantage if Twelve Data fails
      return NextResponse.json({ source: "fallback", prices: generateFallbackPrices() });
    }

    return NextResponse.json({ source: "twelve-data", prices });
  } catch (error) {
    console.error("Prices API error:", error);
    return NextResponse.json(
      { source: "fallback", prices: generateFallbackPrices() },
      { status: 200 }
    );
  }
}

function generateFallbackPrices() {
  const pairs = [
    "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
    "AUD/USD", "NZD/USD", "USD/CAD", "EUR/GBP",
    "EUR/JPY", "GBP/JPY", "XAU/USD", "XAG/USD",
  ];
  const basePrices: Record<string, number> = {
    "EUR/USD": 1.0872, "GBP/USD": 1.2715, "USD/JPY": 157.85,
    "USD/CHF": 0.8935, "AUD/USD": 0.6648, "NZD/USD": 0.6115,
    "USD/CAD": 1.3675, "EUR/GBP": 0.8552, "EUR/JPY": 171.65,
    "GBP/JPY": 200.72, "XAU/USD": 2345.50, "XAG/USD": 29.45,
  };

  return pairs.map((pair) => {
    const bp = basePrices[pair];
    const isJPY = pair.includes("JPY");
    const isGold = pair.includes("XAU");
    const isSilver = pair.includes("XAG");
    const decimals = isJPY || isGold || isSilver ? 2 : 5;
    const spread = isGold ? 0.30 : isSilver ? 0.03 : isJPY ? 0.03 : 0.00015;
    const change = bp * (Math.random() - 0.5) * 0.001;

    return {
      pair,
      price: parseFloat(bp.toFixed(decimals)),
      bid: parseFloat((bp - spread / 2).toFixed(decimals)),
      ask: parseFloat((bp + spread / 2).toFixed(decimals)),
      spread: parseFloat(spread.toFixed(decimals)),
      change: parseFloat(change.toFixed(decimals)),
      changePercent: parseFloat(((change / bp) * 100).toFixed(3)),
    };
  });
}