import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL = 30 * 60 * 1000; // 30 min cache
let cached: { data: any; ts: number } | null = null;

export async function GET(req: NextRequest) {
  try {
    // Return cached if fresh
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const apiKey = process.env.TRADER_CALENDAR_API_KEY;
    const apiHost = process.env.TRADER_CALENDAR_API_HOST;

    if (!apiKey || !apiHost) {
      return NextResponse.json({ events: [], fallback: true, message: "Calendar API keys not configured" });
    }

    // Fetch calendar for major forex currencies
    const countries = ["USA", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
    const allEvents: any[] = [];

    // Fetch in batches to avoid rate limit
    const batch1 = countries.slice(0, 4);
    const batch2 = countries.slice(4);

    const fetchBatch = async (batch: string[]) => {
      const results = await Promise.allSettled(
        batch.map(async (country) => {
          const url = `https://${apiHost}/api/calendar`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "x-rapidapi-key": apiKey,
              "x-rapidapi-host": apiHost,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ country }),
            next: { revalidate: 0 },
          });
          if (!res.ok) throw new Error(`Calendar API ${res.status}`);
          return res.json();
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          const items = Array.isArray(r.value) ? r.value : r.value?.data || r.value?.events || r.value?.results || [];
          allEvents.push(...items);
        }
      }
    };

    await fetchBatch(batch1);
    // Stagger second batch
    if (batch2.length > 0) {
      await new Promise(r => setTimeout(r, 500));
      await fetchBatch(batch2);
    }

    // Normalize events from trader-calendar API format
    const normalized = allEvents.map((e: any) => {
      // Parse ISO date from "start" field
      const startStr = e.start || "";
      let dateStr = "";
      let timeStr = "";
      if (startStr) {
        try {
          const d = new Date(startStr);
          if (!isNaN(d.getTime())) {
            dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
          }
        } catch {}
      }

      // Map importance number to level
      const imp = e.importance || e.impact || 1;
      let impactLevel: string;
      if (typeof imp === "string") {
        const i = imp.toUpperCase();
        impactLevel = (i === "HIGH" || i === "3") ? "HIGH" : (i === "MEDIUM" || i === "MODERATE" || i === "2") ? "MEDIUM" : "LOW";
      } else {
        impactLevel = imp >= 4 ? "HIGH" : imp >= 3 ? "MEDIUM" : "LOW";
      }

      return {
        date: dateStr || e.date || "",
        time: timeStr || e.time || "",
        currency: (e.country || e.currency || "").toUpperCase(),
        event: e.title || e.event || e.name || "Unknown Event",
        impact: impactLevel,
        previous: e.previous || e.prev || "\u2014",
        forecast: e.forecast || e.consensus || "\u2014",
        actual: e.actual || "\u2014",
        category: e.category || "",
        description: e.shortDesc || e.longDesc || e.description || "",
        hexColor: e.hexColor || "",
      };
    });

    // Deduplicate by event name+currency, keeping unique event types
    const seen = new Set<string>();
    const unique = normalized.filter(e => {
      const key = `${e.event}-${e.currency}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return e.event && e.event !== "Unknown Event" && e.date;
    });

    const data = {
      events: unique.slice(0, 40),
      total: unique.length,
      live: true,
    };

    cached = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Calendar API Error]", error);
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ events: [], fallback: true, message: "Failed to fetch calendar" });
  }
}