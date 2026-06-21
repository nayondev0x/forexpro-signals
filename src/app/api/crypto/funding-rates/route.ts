/* SelfTrade Funding Rates API */
import { NextResponse } from "next/server";

const KEY = process.env.SELFTRADE_API_KEY || "";
const HOST = process.env.SELFTRADE_API_HOST || "selftrade.p.rapidapi.com";

let cached: { data: any; ts: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.ts < 60_000) return NextResponse.json(cached.data);
  if (!KEY) return NextResponse.json({ top_rates: [], error: "SelfTrade API key not configured" });

  try {
    const res = await fetch(`https://${HOST}/rapidapi/funding-rates`, {
      headers: { "x-rapidapi-key": KEY, "x-rapidapi-host": HOST, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`SelfTrade ${res.status}`);
    const data = await res.json();
    cached = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (e) {
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ top_rates: [], error: "Failed" }, { status: 500 });
  }
}