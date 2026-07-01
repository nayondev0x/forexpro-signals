"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, RefreshCw, Coins, Loader2,
  ArrowUpRight, ArrowDownRight, Gem, Droplets, Wind, Wheat
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Commodity {
  id: string; symbol: string; name: string;
  last: number; netChange: number; pctChange: number;
  dayHigh: number; dayLow: number; currency: string; unit: string;
}

const COMMODITY_ICONS: Record<string, { icon: any; color: string }> = {
  GC1: { icon: Gem, color: "text-amber-400" },
  XAUUSD: { icon: Gem, color: "text-amber-400" },
  SI1: { icon: Coins, color: "text-zinc-400" },
  XAGUSD: { icon: Coins, color: "text-zinc-400" },
  CL1: { icon: Droplets, color: "text-rose-400" },
  NG1: { icon: Wind, color: "text-sky-400" },
  W: { icon: Wheat, color: "text-yellow-400" },
  C: { icon: Wheat, color: "text-yellow-400" },
  S: { icon: Wheat, color: "text-yellow-400" },
};

function getIcon(name: string) {
  const upper = name.toUpperCase();
  for (const [key, val] of Object.entries(COMMODITY_ICONS)) {
    if (upper.includes(key) || upper.includes("GOLD") || upper.includes("SILVER")) return val;
  }
  return { icon: Coins, color: "text-zinc-400" };
}

export function CommodityTicker() {
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommodities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bloomberg?type=commodities");
      const data = await res.json();
      if (data.commodities) setCommodities(data.commodities);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCommodities(); }, [fetchCommodities]);

  // Prioritize: Gold, Silver, Oil, Natural Gas, then rest
  const priority = ["XAUUSD", "XAUEUR", "GC1", "SI1", "XAGUSD", "CL1", "NG1"];
  const sorted = [...commodities].sort((a, b) => {
    const ai = priority.findIndex(p => a.symbol?.toUpperCase().includes(p));
    const bi = priority.findIndex(p => b.symbol?.toUpperCase().includes(p));
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold text-foreground">Live Commodities</h2>
          <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">BLOOMBERG</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCommodities} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {sorted.map((c) => {
          const up = c.pctChange >= 0;
          const { icon: Icon, color } = getIcon(c.name);
          const isGold = c.name.toUpperCase().includes("GOLD") || c.symbol.toUpperCase().includes("XAU") || c.symbol.toUpperCase().includes("GC1");
          return (
            <Card
              key={c.id}
              className={`border-border/30 bg-card/80 backdrop-blur ${isGold ? "border-amber-500/20 shadow-sm shadow-amber-500/10" : ""}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    <span className="text-xs font-bold text-foreground truncate max-w-[100px]">{c.name}</span>
                  </div>
                  {isGold && <Badge className="text-[8px] bg-amber-500/15 text-amber-400 border-amber-500/30 border px-1">GOLD</Badge>}
                </div>
                <p className="font-mono text-lg font-bold text-foreground">
                  ${c.last.toFixed(c.last < 10 ? 4 : 2)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {up ? <ArrowUpRight className="h-3 w-3 text-emerald-400" /> : <ArrowDownRight className="h-3 w-3 text-rose-400" />}
                  <span className={`text-xs font-mono font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                    {up ? "+" : ""}{c.pctChange.toFixed(2)}%
                  </span>
                  <span className={`text-[10px] font-mono ${up ? "text-emerald-400/60" : "text-rose-400/60"}`}>
                    ({up ? "+" : ""}{c.netChange.toFixed(2)})
                  </span>
                </div>
                <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
                  <span>H: ${c.dayHigh.toFixed(c.dayHigh < 10 ? 4 : 2)}</span>
                  <span>L: ${c.dayLow.toFixed(c.dayLow < 10 ? 4 : 2)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}