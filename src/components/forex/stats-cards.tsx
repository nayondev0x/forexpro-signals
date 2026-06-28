"use client";

import {
  Signal,
  Activity,
  Trophy,
  Target,
  BarChart3,
  Brain,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForexStore } from "@/stores/forex-store";
import type { ForexSignal } from "@/lib/forex-types";

export function StatsCards({
  signals,
  dataSource,
}: {
  signals: ForexSignal[];
  dataSource: string;
}) {
  const { wins, losses } = useForexStore();
  const totalSession = signals.length;
  const active = signals.filter((s) => s.status === "ACTIVE").length;
  const totalPips = signals.reduce((a, s) => a + (s.pips || 0), 0);
  const avgConf =
    signals.length > 0
      ? Math.round(
          signals.reduce((a, s) => a + (s.confidence || 0), 0) /
            signals.length
        )
      : 0;

  // Use persistent store for win/loss if available, fallback to session
  const totalWins = wins || signals.filter((s) => s.status === "TP_HIT").length;
  const totalLosses = losses || signals.filter((s) => s.status === "SL_HIT" || s.status === "EXPIRED").length;
  const totalResults = totalWins + totalLosses;
  const winRate = totalResults > 0 ? ((totalWins / totalResults) * 100).toFixed(1) : "--";

  const stats = [
    { label: "All-Time Wins", value: totalWins, icon: Trophy, color: "text-emerald-500" },
    { label: "All-Time Losses", value: totalLosses, icon: Target, color: "text-rose-500" },
    { label: "Win Rate", value: `${winRate}%`, icon: Zap, color: parseFloat(winRate) >= 60 ? "text-emerald-500" : "text-amber-500" },
    { label: "Session Signals", value: totalSession, icon: Signal, color: "text-sky-500" },
    {
      label: "Session Pips",
      value: `${totalPips > 0 ? "+" : ""}${totalPips.toFixed(1)}`,
      icon: BarChart3,
      color: totalPips >= 0 ? "text-emerald-500" : "text-rose-500",
    },
    { label: "Avg Confidence", value: `${avgConf}%`, icon: Brain, color: "text-violet-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((s) => (
        <Card
          key={s.label}
          className="border-border/30 bg-card/80 backdrop-blur"
        >
          <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
            <s.icon className={`h-4 w-4 ${s.color}`} />
            <span className="text-xl font-bold text-foreground">{s.value}</span>
            <span className="text-[10px] text-muted-foreground">
              {s.label}
            </span>
          </CardContent>
        </Card>
      ))}
      <Card
        className={`col-span-2 sm:col-span-3 lg:col-span-6 border ${
          dataSource === "live"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-amber-500/30 bg-amber-500/5"
        }`}
      >
        <CardContent className="flex items-center justify-center gap-2 p-2.5">
          {dataSource === "live" ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-500">
                LIVE DATA
              </span>
              <Badge
                variant="outline"
                className="ml-2 border-emerald-500/30 text-[10px] text-emerald-500"
              >
                Power Engine v5.0 — Multi-Source Fusion + 12 Pairs
              </Badge>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-500">
                FALLBACK
              </span>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}