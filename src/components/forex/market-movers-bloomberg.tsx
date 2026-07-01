"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  RefreshCw, Activity, Zap, BarChart3, Flame, Loader2
} from "lucide-react";

interface Mover {
  symbol: string; name: string; last: number;
  netChange: number; pctChange: number; volume: number;
  dayHigh: number; dayLow: number; yearHigh: number; yearLow: number;
}

function formatVol(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function MoverRow({ m, rank }: { m: Mover; rank: number }) {
  const up = m.pctChange >= 0;
  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs font-mono text-muted-foreground w-5 text-right">{rank}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{m.symbol}</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{m.name}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm font-bold text-foreground">${m.last.toFixed(2)}</span>
        <div className="flex items-center gap-1">
          {up ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" /> : <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />}
          <span className={`text-xs font-mono font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
            {up ? "+" : ""}{m.pctChange.toFixed(2)}%
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono w-14 text-right">{formatVol(m.volume)}</span>
      </div>
    </div>
  );
}

export function MarketMovers() {
  const [active, setActive] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bloomberg?type=movers");
      const data = await res.json();
      if (data.active) setActive(data.active);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMovers(); }, [fetchMovers]);

  const gainers = [...active].sort((a, b) => b.pctChange - a.pctChange).slice(0, 5);
  const losers = [...active].sort((a, b) => a.pctChange - b.pctChange).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-bold text-foreground">DOW JONES Market Movers</h2>
          <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">BLOOMBERG</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMovers} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : active.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">No mover data available</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Top Gainers */}
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <Flame className="h-4 w-4" /> Top Gainers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/10">
                {gainers.map((m, i) => <MoverRow key={m.symbol} m={m} rank={i + 1} />)}
              </div>
            </CardContent>
          </Card>

          {/* Top Losers */}
          <Card className="border-rose-500/20 bg-rose-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-rose-400">
                <Zap className="h-4 w-4" /> Top Losers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/10">
                {losers.map((m, i) => <MoverRow key={m.symbol} m={m} rank={i + 1} />)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Most Active Volume */}
      {active.length > 5 && (
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-sky-500" /> Most Active by Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/10">
              {[...active].sort((a, b) => b.volume - a.volume).slice(0, 10).map((m, i) => <MoverRow key={m.symbol} m={m} rank={i + 1} />)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}