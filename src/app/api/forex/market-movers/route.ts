import { NextResponse } from "next/server";
import { getForexMarketMovers } from "@/lib/rapidapi";

export async function GET() {
  try {
    const data = await getForexMarketMovers();
    return NextResponse.json(data || { movers: [] });
  } catch (error) {
    return NextResponse.json({ movers: [] }, { status: 200 });
  }
}