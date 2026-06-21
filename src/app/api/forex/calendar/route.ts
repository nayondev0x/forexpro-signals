/* ═══════════════════════════════════════════════════════════════
   DUAL-SOURCE ECONOMIC CALENDAR API
   Source 1: trader-calendar (original, POST method)
   Source 2: TradingEconomics (GET, richer data with descriptions)
   Auto failover: TE primary → trader-calendar fallback
   Caching: 15min server-side
   ═══════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL = 15 * 60 * 1000; // 15 min
let cached: { data: any; ts: number } | null = null;

// ─── Config ───
const TE_KEY = process.env.TRADEDECONOMICS_API_KEY || "";
const TE_HOST = process.env.TRADEDECONOMICS_API_HOST || "economic-calendar-api-tradingeconomics.p.rapidapi.com";
const TC_KEY = process.env.TRADER_CALENDAR_API_KEY || "";
const TC_HOST = process.env.TRADER_CALENDAR_API_HOST || "trader-calendar.p.rapidapi.com";

// Country mapping: currency code → TradingEconomics country name
const COUNTRY_MAP: Record<string, string> = {
  USD: "United States",
  EUR: "Euro Area",
  GBP: "United Kingdom",
  JPY: "Japan",
  AUD: "Australia",
  CAD: "Canada",
  CHF: "Switzerland",
  NZD: "New Zealand",
};

const CURRENCIES = Object.keys(COUNTRY_MAP);

// Reverse map: country name → currency code
const COUNTRY_TO_CCY: Record<string, string> = {};
for (const [ccy, country] of Object.entries(COUNTRY_MAP)) {
  COUNTRY_TO_CCY[country] = ccy;
}

/* ═══ TradingEconomics Source ═══ */
async function fetchTECalendar(country: string, from: string, to: string): Promise<any[]> {
  const url = `https://${TE_HOST}/calendar?country=${encodeURIComponent(country)}&from=${from}&to=${to}&limit=50&sort=asc&fields=id%2Cdate%2CeventName%2CimpactLabel%2Cactual%2Cforecast%2Cprevious%2Ccountry%2Ccategory`;
  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": TE_KEY,
      "x-rapidapi-host": TE_HOST,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`TE API ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`TE API: ${data.error}`);
  return data.events || [];
}

async function fetchTEAllCountries(): Promise<any[]> {
  const now = new Date();
  const from = now.toISOString().split("T")[0];
  const weekLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const to = weekLater.toISOString().split("T")[0];

  const allEvents: any[] = [];
  const countries = Object.values(COUNTRY_MAP);

  // Fetch in batches of 2 to avoid rate limits
  for (let i = 0; i < countries.length; i += 2) {
    const batch = countries.slice(i, i + 2);
    const results = await Promise.allSettled(
      batch.map(c => fetchTECalendar(c, from, to))
    );
    for (const r of results) {
      if (r.status === "fulfilled") allEvents.push(...r.value);
    }
    if (i + 2 < countries.length) await new Promise(r => setTimeout(r, 300));
  }

  return allEvents;
}

function normalizeTEEvent(e: any): any {
  const dateStr = e.date || "";
  let date = "";
  let time = "";
  if (dateStr) {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      }
    } catch {}
  }

  // Map country to currency
  const country = e.country || "";
  const currency = COUNTRY_TO_CCY[country] || country.substring(0, 3).toUpperCase();

  const impactLabel = (e.impactLabel || "LOW").toUpperCase();
  const impact = impactLabel === "HIGH" ? "HIGH" : impactLabel === "MEDIUM" ? "MEDIUM" : "LOW";

  return {
    date,
    time,
    currency,
    event: e.eventName || e.event || "Unknown",
    impact,
    previous: e.previous || "\u2014",
    forecast: e.forecast || "\u2014",
    actual: e.actual || "\u2014",
    category: e.category || "",
    country,
    source: "TradingEconomics",
  };
}

/* ═══ Trader-Calendar Source (Fallback) ═══ */
async function fetchTCCalendar(): Promise<any[]> {
  const countries = ["USA", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
  const allEvents: any[] = [];

  for (let i = 0; i < countries.length; i += 3) {
    const batch = countries.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(async (country) => {
        const res = await fetch(`https://${TC_HOST}/api/calendar`, {
          method: "POST",
          headers: {
            "x-rapidapi-key": TC_KEY,
            "x-rapidapi-host": TC_HOST,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ country }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`TC API ${res.status}`);
        return res.json();
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        const items = Array.isArray(r.value) ? r.value : r.value?.data || r.value?.events || [];
        allEvents.push(...items);
      }
    }
    if (i + 3 < countries.length) await new Promise(r => setTimeout(r, 400));
  }

  return allEvents;
}

function normalizeTCEvent(e: any): any {
  const startStr = e.start || "";
  let date = "";
  let time = "";
  if (startStr) {
    try {
      const d = new Date(startStr);
      if (!isNaN(d.getTime())) {
        date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      }
    } catch {}
  }

  const imp = e.importance || e.impact || 1;
  let impact: string;
  if (typeof imp === "string") {
    const i = imp.toUpperCase();
    impact = i === "HIGH" ? "HIGH" : (i === "MEDIUM" || i === "MODERATE") ? "MEDIUM" : "LOW";
  } else {
    impact = imp >= 4 ? "HIGH" : imp >= 3 ? "MEDIUM" : "LOW";
  }

  return {
    date,
    time,
    currency: (e.country || e.currency || "").toUpperCase(),
    event: e.title || e.event || e.name || "Unknown",
    impact,
    previous: e.previous || e.prev || "\u2014",
    forecast: e.forecast || e.consensus || "\u2014",
    actual: e.actual || "\u2014",
    category: e.category || "",
    source: "TraderCalendar",
  };
}

/* ═══ GET Handler ═══ */
export async function GET(req: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const filterCountry = searchParams.get("country"); // e.g. "USD", "EUR"
    const filterImpact = searchParams.get("impact");   // e.g. "HIGH", "HIGH,MEDIUM"

    // Return cached if fresh
    if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL) {
      let events = cached.data.events;
      events = applyFilters(events, filterCountry, filterImpact);
      return NextResponse.json({ ...cached.data, events });
    }

    let events: any[] = [];
    let source = "none";
    let teFailed = false;
    let tcFailed = false;

    // ─── Source 1: TradingEconomics (primary, richer data) ───
    if (TE_KEY) {
      try {
        console.log("[Calendar] Fetching from TradingEconomics...");
        const rawEvents = await fetchTEAllCountries();
        events = rawEvents.map(normalizeTEEvent).filter(e => e.event && e.event !== "Unknown" && e.date);
        source = "TradingEconomics";
        console.log(`[Calendar] TE returned ${events.length} events`);
      } catch (e) {
        console.error("[Calendar] TradingEconomics failed:", e);
        teFailed = true;
      }
    }

    // ─── Source 2: Trader-Calendar (fallback) ───
    if (events.length === 0 && TC_KEY) {
      try {
        console.log("[Calendar] Falling back to TraderCalendar...");
        const rawEvents = await fetchTCCalendar();
        events = rawEvents.map(normalizeTCEvent);
        // Deduplicate by event name+currency
        const seen = new Set<string>();
        events = events.filter(e => {
          const key = `${e.event}-${e.currency}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return e.event && e.event !== "Unknown" && e.date;
        });
        source = "TraderCalendar";
        console.log(`[Calendar] TC returned ${events.length} events`);
      } catch (e) {
        console.error("[Calendar] TraderCalendar failed:", e);
        tcFailed = true;
      }
    }

    // Sort by date+time
    events.sort((a, b) => {
      const da = new Date(a.date + "T" + a.time).getTime();
      const db = new Date(b.date + "T" + b.time).getTime();
      return da - db;
    });

    const data = {
      events: events.slice(0, 80),
      total: events.length,
      live: events.length > 0,
      source,
      teFailed,
      tcFailed,
      teConfigured: !!TE_KEY,
      tcConfigured: !!TC_KEY,
    };

    cached = { data, ts: Date.now() };

    // Apply filters
    let filteredEvents = data.events;
    filteredEvents = applyFilters(filteredEvents, filterCountry, filterImpact);
    return NextResponse.json({ ...data, events: filteredEvents });
  } catch (error) {
    console.error("[Calendar API Error]", error);
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ events: [], fallback: true, message: "Failed to fetch calendar" });
  }
}

function applyFilters(events: any[], country?: string | null, impact?: string | null): any[] {
  let filtered = events;
  if (country && country !== "ALL") {
    filtered = filtered.filter(e => e.currency === country.toUpperCase());
  }
  if (impact) {
    const levels = impact.toUpperCase().split(",").map(s => s.trim());
    filtered = filtered.filter(e => levels.includes(e.impact));
  }
  return filtered;
}