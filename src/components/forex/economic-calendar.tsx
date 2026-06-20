"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalendarEvent {
  date: string;
  time: string;
  currency: string;
  event: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  previous: string;
  forecast: string;
  actual?: string;
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

const IMPACT_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  LOW: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
  3: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900",
  2: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
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
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(false);

  const fetchCalendar = async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch("/api/forex/calendar");
      const data = await r.json();
      if (data.events && data.events.length > 0 && !data.fallback) {
        const normalized = data.events.map((e: any) => ({
          ...e,
          impact: normalizeImpact(String(e.impact)),
        }));
        setEvents(normalized);
        setIsLive(true);
      } else {
        setEvents(FALLBACK_EVENTS);
        setIsLive(false);
      }
    } catch {
      setEvents(FALLBACK_EVENTS);
      setIsLive(false);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  }, [events]);

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};
    for (const e of sortedEvents) {
      const dateLabel = e.date
        ? new Date(e.date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : "Unknown";
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(e);
    }
    return groups;
  }, [sortedEvents]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="size-5 text-primary" />
            Economic Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            {isLive && (
              <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-500">
                <Globe className="mr-1 size-3" /> LIVE
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={fetchCalendar}
              disabled={loading}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <RefreshCw className="mr-2 size-4 animate-spin" /> Loading calendar...
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {Object.entries(groupedEvents).map(([dateLabel, dayEvents]) => (
              <div key={dateLabel}>
                <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur px-4 py-1.5 border-b border-border/30">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {dateLabel}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[55px]">Time</TableHead>
                      <TableHead className="w-[55px]">CCY</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead className="w-[65px]">Impact</TableHead>
                      <TableHead className="w-[65px] text-right">Prev</TableHead>
                      <TableHead className="w-[65px] text-right">Forecast</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayEvents.map((event, idx) => (
                      <TableRow key={`${event.date}-${event.time}-${idx}`}>
                        <TableCell className="font-mono text-xs">
                          {event.time}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm" title={event.currency}>
                            {CURRENCY_FLAGS[event.currency] ?? event.currency}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {event.event}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${IMPACT_STYLES[event.impact] || IMPACT_STYLES["LOW"]}`}
                          >
                            {event.impact}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {event.previous}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium">
                          {event.forecast}
                        </TableCell>
                      </TableRow>
                    ))}
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