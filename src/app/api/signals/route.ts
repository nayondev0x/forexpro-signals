import { NextResponse } from "next/server";

export async function GET() {
  const signals = generateSignals();
  return NextResponse.json(signals);
}

function generateSignals() {
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

  const statuses: Array<"ACTIVE" | "TP_HIT" | "SL_HIT"> = ["ACTIVE", "ACTIVE", "ACTIVE", "TP_HIT", "SL_HIT", "ACTIVE"];

  return Array.from({ length: 8 }, (_, i) => {
    const pair = pairs[i % pairs.length];
    const type: "BUY" | "SELL" = i % 2 === 0 ? "BUY" : "SELL";
    const basePrice = basePrices[pair];
    const isJPY = pair.includes("JPY");
    const isGold = pair.includes("XAU");
    const isSilver = pair.includes("XAG");
    const decimals = isJPY || isGold || isSilver ? 2 : 4;

    let tpDist: number, slDist: number;
    if (isGold) {
      tpDist = (Math.random() * 30 + 15) * 0.01;
      slDist = (Math.random() * 15 + 8) * 0.01;
    } else if (isJPY) {
      tpDist = (Math.random() * 40 + 20) * 0.01;
      slDist = (Math.random() * 20 + 10) * 0.01;
    } else {
      tpDist = (Math.random() * 40 + 15) * 0.0001;
      slDist = (Math.random() * 20 + 8) * 0.0001;
    }

    const entry = basePrice + (Math.random() - 0.5) * tpDist * 5;
    const status = statuses[i % statuses.length];

    let pips: number | undefined;
    if (status !== "ACTIVE") {
      if (isGold) {
        pips = status === "TP_HIT" ? Math.random() * 25 + 10 : -(Math.random() * 12 + 5);
      } else if (isJPY) {
        pips = status === "TP_HIT" ? Math.random() * 35 + 15 : -(Math.random() * 18 + 8);
      } else {
        pips = status === "TP_HIT" ? Math.random() * 35 + 15 : -(Math.random() * 18 + 8);
      }
      pips = parseFloat(pips.toFixed(1));
    }

    return {
      id: `SIG-${String(i + 1001).padStart(4, "0")}`,
      pair,
      type,
      entry: parseFloat(entry.toFixed(decimals)),
      tp: parseFloat((type === "BUY" ? entry + tpDist : entry - tpDist).toFixed(decimals)),
      sl: parseFloat((type === "BUY" ? entry - slDist : entry + slDist).toFixed(decimals)),
      timestamp: new Date(Date.now() - i * 1800000 - Math.random() * 600000).toISOString(),
      status,
      pips,
    };
  });
}