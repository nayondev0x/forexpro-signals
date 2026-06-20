import { NextResponse } from "next/server";
import { getPairIndicators } from "@/lib/rapidapi";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair");

  if (!pair) {
    return NextResponse.json({ error: "pair parameter is required" }, { status: 400 });
  }

  try {
    const data = await getPairIndicators(pair);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Indicators API error:", error);
    return NextResponse.json({ error: "Failed to fetch indicators" }, { status: 500 });
  }
}