"use client";

import { useMemo } from "react";
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
import { Calendar } from "lucide-react";

interface CalendarEvent {
  date: string;
  time: string;
  currency: string;
  event: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  previous: string;
  forecast: string;
}

const EVENTS: CalendarEvent[] = [
  { date: "Jun 23", time: "08:30", currency: "EUR", event: "ECB Press Conference", impact: "HIGH", previous: "—", forecast: "—" },
  { date: "Jun 23", time: "09:00", currency: "EUR", event: "Flash Manufacturing PMI", impact: "MEDIUM", previous: "52.8", forecast: "52.5" },
  { date: "Jun 23", time: "09:00", currency: "EUR", event: "Flash Services PMI", impact: "MEDIUM", previous: "53.2", forecast: "53.0" },
  { date: "Jun 24", time: "02:00", currency: "JPY", event: "BOJ Interest Rate Decision", impact: "HIGH", previous: "0.50%", forecast: "0.50%" },
  { date: "Jun 24", time: "02:00", currency: "JPY", event: "BOJ Monetary Policy Statement", impact: "HIGH", previous: "—", forecast: "—" },
  { date: "Jun 24", time: "04:30", currency: "JPY", event: "Core CPI (YoY)", impact: "MEDIUM", previous: "2.5%", forecast: "2.4%" },
  { date: "Jun 24", time: "14:00", currency: "USD", event: "FOMC Meeting Minutes", impact: "HIGH", previous: "—", forecast: "—" },
  { date: "Jun 25", time: "08:30", currency: "USD", event: "Durable Goods Orders", impact: "MEDIUM", previous: "0.8%", forecast: "0.5%" },
  { date: "Jun 25", time: "10:00", currency: "USD", event: "New Home Sales", impact: "MEDIUM", previous: "610K", forecast: "595K" },
  { date: "Jun 25", time: "10:00", currency: "USD", event: "Consumer Confidence", impact: "HIGH", previous: "102.0", forecast: "100.5" },
  { date: "Jun 26", time: "02:00", currency: "GBP", event: "BoE Interest Rate Decision", impact: "HIGH", previous: "4.25%", forecast: "4.25%" },
  { date: "Jun 26", time: "04:30", currency: "GBP", event: "GDP (QoQ) Preliminary", impact: "HIGH", previous: "0.4%", forecast: "0.3%" },
  { date: "Jun 26", time: "08:30", currency: "USD", event: "Jobless Claims", impact: "MEDIUM", previous: "238K", forecast: "235K" },
  { date: "Jun 26", time: "08:30", currency: "USD", event: "Trade Balance", impact: "LOW", previous: "-$71.1B", forecast: "-$68.5B" },
  { date: "Jun 27", time: "08:30", currency: "USD", event: "GDP (QoQ) Final", impact: "HIGH", previous: "1.3%", forecast: "1.3%" },
  { date: "Jun 27", time: "08:30", currency: "USD", event: "Core PCE Price Index (YoY)", impact: "HIGH", previous: "2.8%", forecast: "2.7%" },
  { date: "Jun 27", time: "09:45", currency: "USD", event: "Flash Manufacturing PMI", impact: "MEDIUM", previous: "51.3", forecast: "51.0" },
  { date: "Jun 27", time: "09:45", currency: "USD", event: "Flash Services PMI", impact: "MEDIUM", previous: "53.5", forecast: "53.2" },
  { date: "Jun 28", time: "07:00", currency: "EUR", event: "German Import Prices (MoM)", impact: "LOW", previous: "-0.2%", forecast: "-0.1%" },
  { date: "Jun 28", time: "08:30", currency: "USD", event: "Personal Income", impact: "MEDIUM", previous: "0.4%", forecast: "0.3%" },
  { date: "Jun 28", time: "08:30", currency: "USD", event: "Personal Spending", impact: "MEDIUM", previous: "0.2%", forecast: "0.3%" },
  { date: "Jun 29", time: "01:30", currency: "JPY", event: "Unemployment Rate", impact: "LOW", previous: "2.6%", forecast: "2.6%" },
  { date: "Jun 29", time: "04:00", currency: "EUR", event: "M3 Money Supply (YoY)", impact: "LOW", previous: "3.7%", forecast: "3.5%" },
  { date: "Jul 01", time: "08:30", currency: "USD", event: "Non-Farm Payrolls (NFP)", impact: "HIGH", previous: "175K", forecast: "180K" },
  { date: "Jul 01", time: "08:30", currency: "USD", event: "Average Hourly Earnings (MoM)", impact: "MEDIUM", previous: "0.2%", forecast: "0.3%" },
  { date: "Jul 01", time: "08:30", currency: "USD", event: "Unemployment Rate", impact: "HIGH", previous: "4.0%", forecast: "4.0%" },
  { date: "Jul 01", time: "08:30", currency: "USD", event: "ISM Manufacturing PMI", impact: "HIGH", previous: "48.7", forecast: "49.5" },
  { date: "Jul 02", time: "04:30", currency: "GBP", event: "Manufacturing PMI", impact: "MEDIUM", previous: "51.2", forecast: "51.0" },
  { date: "Jul 03", time: "08:30", currency: "USD", event: "ADP Non-Farm Employment", impact: "MEDIUM", previous: "152K", forecast: "160K" },
  { date: "Jul 03", time: "08:30", currency: "USD", event: "CPI (MoM)", impact: "HIGH", previous: "0.3%", forecast: "0.2%" },
  { date: "Jul 03", time: "08:30", currency: "USD", event: "Core CPI (MoM)", impact: "HIGH", previous: "0.2%", forecast: "0.2%" },
  { date: "Jul 04", time: "08:30", currency: "USD", event: "Trade Balance", impact: "LOW", previous: "-$71.1B", forecast: "-$69.0B" },
  { date: "Jul 04", time: "14:00", currency: "USD", event: "ISM Services PMI", impact: "HIGH", previous: "53.8", forecast: "53.5" },
  { date: "Jul 04", time: "14:00", currency: "USD", event: "Retail Sales (MoM)", impact: "HIGH", previous: "0.1%", forecast: "0.3%" },
];

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
};

const IMPACT_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  LOW: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
};

export function EconomicCalendar() {
  const sortedEvents = useMemo(() => {
    return [...EVENTS].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="size-5 text-primary" />
          Economic Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[70px]">Date</TableHead>
                <TableHead className="w-[55px]">Time</TableHead>
                <TableHead className="w-[55px]">Currency</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="w-[65px]">Impact</TableHead>
                <TableHead className="w-[65px] text-right">Previous</TableHead>
                <TableHead className="w-[65px] text-right">Forecast</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEvents.map((event, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-muted-foreground text-xs">
                    {event.date}
                  </TableCell>
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
                      className={`text-[10px] px-1.5 py-0 ${IMPACT_STYLES[event.impact]}`}
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
      </CardContent>
    </Card>
  );
}