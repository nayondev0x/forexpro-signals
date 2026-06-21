"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, RefreshCw, Globe, Filter, Loader2, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface CalendarEvent {
  date: string;
  time: string;
  currency: string;
  event: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  previous: string;
  forecast: string;
  actual?: string;
  category?: string;
  country?: string;
  source?: string;
}

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "\u{1F1FA}\u{1F1F8}",
  EUR: "\u{1F1EA}\u{1F1FA}",
  GBP: "\u{1F1EC}\u{1F1E7}",
  JPY: "\u{1F1EF}\u{1F1F5}",
  AUD: "\u{1F1E6}\u{1F1FA}",
  CAD: "\u{1F1E8}\u{1F1E6}",
  CHF: "\u{1F1E8}\u{1F1ED}",
  NZD: "\u{1F1F3}\u{1F1FF}",
};

const CURRENCY_NAMES: Record<string, string> = {
  USD: "US Dollar", EUR: "Euro", GBP: "British Pound", JPY: "Japanese Yen",
  AUD: "Australian Dollar", CAD: "Canadian Dollar", CHF: "Swiss Franc", NZD: "New Zealand Dollar",
};

const IMPACT_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  LOW: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
};

const IMPACT_DOT: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-emerald-500",
};

function normalizeImpact(impact: string): "HIGH" | "MEDIUM" | "LOW" {
  const i = impact?.toUpperCase();
  if (i === "HIGH" || i === "3") return "HIGH";
  if (i === "MEDIUM" || i === "MODERATE" || i === "2") return "MEDIUM";
  return "LOW";
}

// Fallback static events if API fails
const FALLBACK_EVENTS: CalendarEvent[] = [
  { date: "2025-06-23", time: "08:30", currency: "EUR", event: "ECB Press Conference", impact: "HIGH", previous: "\u2014", forecast: "\u2014" },
  { date: "2025-06-23", time: "09:00", currency: "EUR", event: "Flash Manufacturing PMI", impact: "MEDIUM", previous: "52.8", forecast: "52.5" },
  { date: "2025-06-24", time: "02:00", currency: "JPY", event: "BOJ Interest Rate Decision", impact: "HIGH", previous: "0.50%", forecast: "0.50%" },
  { date: "2025-06-24", time: "14:00", currency: "USD", event: "FOMC Meeting Minutes", impact: "HIGH", previous: "\u2014", forecast: "\u2014" },
  { date: "2025-06-25", time: "10:00", currency: "USD", event: "Consumer Confidence", impact: "HIGH", previous: "102.0", forecast: "100.5" },
  { date: "2025-06-26", time: "02:00", currency: "GBP", event: "BoE Interest Rate Decision", impact: "HIGH", previous: "4.25%", forecast: "4.25%" },
  { date: "2025-06-27", time: "08:30", currency: "USD", event: "Core PCE Price Index (YoY)", impact: "HIGH", previous: "2.8%", forecast: "2.7%" },
  { date: "2025-07-01", time: "08:30", currency: "USD", event: "Non-Farm Payrolls (NFP)", impact: "HIGH", previous: "175K", forecast: "180K" },
  { date: "2025-07-01", time: "08:30", currency: "USD", event: "ISM Manufacturing PMI", impact: "HIGH", previous: "48.7", forecast: "49.5" },
  { date: "2025-07-04", time: "14:00", currency: "USD", event: "ISM Services PMI", impact: "HIGH", previous: "53.8", forecast: "53.5" },
];

export function EconomicCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(false);
  const [source, setSource] = useState("");
  const [filterCountry, setFilterCountry] = useState("ALL");
  const [filterImpact, setFilterImpact] = useState("ALL");
  const [showHighOnly, setShowHighOnly] = useState(false);

  const fetchCalendar = useCallback(async (force = false) => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (force) params.set("refresh", "true");
      if (filterCountry !== "ALL") params.set("country", filterCountry);
      if (filterImpact !== "ALL") params.set("impact", filterImpact);

      const r = await fetch(`/api/forex/calendar?${params.toString()}`);
      const data = await r.json();
      if (data.events && data.events.length > 0 && !data.fallback) {
        const normalized = data.events.map((e: any) => ({
          ...e,
          impact: normalizeImpact(String(e.impact)),
        }));
        setEvents(normalized);
        setAllEvents(normalized);
        setIsLive(true);
        setSource(data.source || "");
      } else {
        setEvents(FALLBACK_EVENTS);
        setAllEvents(FALLBACK_EVENTS);
        setIsLive(false);
        setSource("");
      }
    } catch {
      setEvents(FALLBACK_EVENTS);
      setAllEvents(FALLBACK_EVENTS);
      setIsLive(false);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filterCountry, filterImpact]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Client-side filter (for instant response)
  const filteredEvents = useMemo(() => {
    let result = allEvents;
    if (filterCountry !== "ALL") {
      result = result.filter(e => e.currency === filterCountry);
    }
    if (filterImpact !== "ALL") {
      const levels = filterImpact.split(",").map(s => s.trim());
      result = result.filter(e => levels.includes(e.impact));
    }
    if (showHighOnly) {
      result = result.filter(e => e.impact === "HIGH");
    }
    return result;
  }, [allEvents, filterCountry, filterImpact, showHighOnly]);

  // Stats
  const impactCounts = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    allEvents.forEach(e => { if (counts[e.impact as keyof typeof counts] !== undefined) counts[e.impact as keyof typeof counts]++; });
    return counts;
  }, [allEvents]);

  const highPct = allEvents.length > 0 ? (impactCounts.HIGH / allEvents.length) * 100 : 0;

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    for (const e of filteredEvents) {
      let dateLabel: string;
      try {
        dateLabel = new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        });
      } catch {
        dateLabel = e.date || "Unknown";
      }
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(e);
    }
    return groups;
  }, [filteredEvents]);

  const handleRefresh = () => fetchCalendar(true);

  return (
    <Card className="w-full border-border/30 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="size-5 text-primary" />
            Economic Calendar
            {isLive && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-500">
                <Globe className="mr-1 size-3" /> LIVE
              </Badge>
            )}
            {source && (
              <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-500">
                <Zap className="mr-1 size-3" /> {source}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-7" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Filter className="size-3.5 text-muted-foreground" />
          <Select value={filterCountry} onValueChange={setFilterCountry}>
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Currencies</SelectItem>
              {Object.entries(CURRENCY_FLAGS).map(([ccy, flag]) => (
                <SelectItem key={ccy} value={ccy}>{flag} {ccy} — {CURRENCY_NAMES[ccy]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterImpact} onValueChange={setFilterImpact}>
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue placeholder="Impact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Impact</SelectItem>
              <SelectItem value="HIGH">High Only</SelectItem>
              <SelectItem value="HIGH,MEDIUM">High + Medium</SelectItem>
              <SelectItem value="MEDIUM">Medium Only</SelectItem>
            </SelectContent>
          </Select>

          {/* Quick toggle */}
          <Button
            variant={showHighOnly ? "default" : "outline"}
            size="sm"
            className="h-7 text-[10px] px-2"
            onClick={() => setShowHighOnly(!showHighOnly)}
          >
            {showHighOnly ? <ChevronUp className="mr-1 size-3" /> : <ChevronDown className="mr-1 size-3" />}
            High Only
          </Button>

          {/* Stats pills */}
          {isLive && (
            <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${IMPACT_DOT.HIGH}`} />{impactCounts.HIGH} High</span>
              <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${IMPACT_DOT.MEDIUM}`} />{impactCounts.MEDIUM} Med</span>
              <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${IMPACT_DOT.LOW}`} />{impactCounts.LOW} Low</span>
              <span className="font-mono font-bold">{filteredEvents.length} events</span>
            </div>
          )}
        </div>

        {/* High impact progress bar */}
        {isLive && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${highPct}%` }} />
            </div>
            <span className="text-[9px] text-muted-foreground">{highPct.toFixed(0)}% high impact</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mb-3 size-6 animate-spin" />
            <span className="text-sm">Loading calendar from {source || "API"}...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
            <Calendar className="mb-3 size-10" />
            <span className="text-sm">No events match your filters</span>
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setFilterCountry("ALL"); setFilterImpact("ALL"); setShowHighOnly(false); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {Object.entries(groupedEvents).map(([dateLabel, dayEvents]) => (
              <div key={dateLabel}>
                <div className="sticky top-0 z-10 flex items-center justify-between bg-muted/80 backdrop-blur px-4 py-1.5 border-b border-border/30">
                  <span className="text-xs font-semibold text-muted-foreground">{dateLabel}</span>
                  <span className="text-[10px] text-muted-foreground/60">{dayEvents.length} events</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[52px] text-[10px]">Time</TableHead>
                      <TableHead className="w-[48px] text-[10px]">CCY</TableHead>
                      <TableHead className="text-[10px]">Event</TableHead>
                      <TableHead className="w-[58px] text-[10px]">Impact</TableHead>
                      <TableHead className="w-[62px] text-right text-[10px]">Previous</TableHead>
                      <TableHead className="w-[62px] text-right text-[10px]">Forecast</TableHead>
                      <TableHead className="w-[62px] text-right text-[10px]">Actual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayEvents.map((event, idx) => {
                      const hasActual = event.actual && event.actual !== "\u2014";
                      return (
                        <TableRow key={`${event.date}-${event.time}-${event.event}-${idx}`}
                          className={`transition-colors ${event.impact === "HIGH" ? "hover:bg-red-500/5" : "hover:bg-muted/50"}`}>
                          <TableCell className="font-mono text-xs">{event.time}</TableCell>
                          <TableCell>
                            <span className="text-sm" title={event.currency}>{CURRENCY_FLAGS[event.currency] ?? event.currency}</span>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {event.event}
                            {event.category && event.category !== event.event && (
                              <span className="ml-1.5 text-[9px] text-muted-foreground/60">{event.category}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${IMPACT_STYLES[event.impact] || IMPACT_STYLES.LOW}`}>
                              {event.impact}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-[11px] text-muted-foreground">{event.previous}</TableCell>
                          <TableCell className="text-right font-mono text-[11px] font-medium">{event.forecast}</TableCell>
                          <TableCell className={`text-right font-mono text-[11px] font-bold ${hasActual ? "text-foreground" : "text-muted-foreground/40"}`}>
                            {hasActual ? event.actual : "\u2014"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}