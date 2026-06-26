import { NextResponse } from "next/server";

const CACHE_TTL = 10 * 60 * 1000; // 10 min
let cached: { data: any; ts: number } | null = null;

export async function GET() {
  try {
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const apiKey = process.env.BREAKING_NEWS_API_KEY;
    const apiHost = process.env.BREAKING_NEWS_API_HOST;

    if (!apiKey || !apiHost) {
      return NextResponse.json({ news: [], mood: null, fallback: true });
    }

    // Fetch market mood and top news in parallel
    const [moodRes, topRes] = await Promise.allSettled([
      fetch(`https://${apiHost}/v1/news/market-mood`, {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": apiHost,
          "Content-Type": "application/json",
        },
        next: { revalidate: 0 },
      }),
      fetch(`https://${apiHost}/v1/news/top?count=15`, {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": apiHost,
          "Content-Type": "application/json",
        },
        next: { revalidate: 0 },
      }),
    ]);

    let mood = null;
    let news: any[] = [];

    if (moodRes.status === "fulfilled" && moodRes.value.ok) {
      mood = await moodRes.value.json();
    }

    if (topRes.status === "fulfilled" && topRes.value.ok) {
      const topData = await topRes.value.json();
      news = Array.isArray(topData) ? topData : topData?.news || topData?.data || topData?.results || [];
    }

    const data = { mood, news, live: true };
    cached = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ news: [], mood: null, fallback: true });
  }
}