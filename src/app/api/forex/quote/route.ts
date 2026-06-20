import { NextResponse } from "next/server";
import { getQuote } from "@/lib/rapidapi";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pair = searchParams.get("pair");

  if (!pair) {
    return NextResponse.json({ error: "pair parameter is required" }, { status: 400 });
  }

  try {
    const data = await getQuote(pair);
    if (!data) {
      return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Quote API error:", error);
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 });
  }
}