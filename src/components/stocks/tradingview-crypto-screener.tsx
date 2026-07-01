"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, RefreshCw, Loader2,
  ArrowUpRight, ArrowDownRight, Bitcoin, Target
} from "lucide-react";

interface CryptoItem {
  rank: number;
  symbol: string;
  close: number;
  change: number;
  "24h_vol_cmc"?: number;
  market_cap_calc?: number;
  circulating_supply?: number;
  techrating_1d?: string;
  techrating_1d_tr?: string;
  rsi?: number;
  macd_macd?: number;
  perf_1w?: number;
  perf_1m?: number;
  ticker_view?: { name?: string; description?: string; base_currency_logoid?: string };
}

export function TradingViewCryptoScreener() {
  const [coins, setCoins] = useState<CryptoItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchScreener = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tradingview?type=crypto-screener");
      const data = await res.json();
      if (data?.data) { setCoins(data.data); setTotalCount(data.totalCount || 0); }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchScreener(); }, [fetchScreener]);

  function fmtNum(n: number | undefined) {
    if (!n) return "—";
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bitcoin className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold">Crypto Screener</h2>
          <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">TRADINGVIEW</Badge>
          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
            {totalCount} Buy-Rated
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchScreener} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : coins.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">No crypto data</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Coin</th>
                <th className="text-right py-2 px-2">Price</th>
                <th className="text-right py-2 px-2">24h%</th>
                <th className="text-right py-2 px-2">1W%</th>
                <th className="text-right py-2 px-2 hidden sm:table-cell">Market Cap</th>
                <th className="text-right py-2 px-2 hidden md:table-cell">Volume 24h</th>
                <th className="text-right py-2 px-2 hidden lg:table-cell">RSI</th>
                <th className="text-right py-2 px-2">Rating</th>
              </tr>
            </thead>
            <tbody>
              {coins.map((c) => {
                const up = (c.change || 0) >= 0;
                const name = c.ticker_view?.description || c.ticker_view?.name || c.symbol.split(":")[1]?.replace("USD", "");
                return (
                  <tr key={c.symbol} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-2 text-[11px] font-mono text-muted-foreground">{c.rank}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{name || c.symbol.split(":")[1]}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-xs font-bold">
                      ${c.close < 1 ? c.close.toFixed(5) : c.close.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className={`text-[11px] font-mono font-bold flex items-center justify-end gap-0.5 ${up ? "text-emerald-400" : "text-rose-400"}`}>
                        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {up ? "+" : ""}{(c.change || 0).toFixed(2)}%
                      </span>
                    </td>
                    <td className={`py-2 px-2 text-right text-[11px] font-mono ${(c.perf_1w || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {c.perf_1w ? `${(c.perf_1w >= 0 ? "+" : "")}${c.perf_1w.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 px-2 text-right text-[11px] font-mono text-muted-foreground hidden sm:table-cell">
                      {fmtNum(c.market_cap_calc)}
                    </td>
                    <td className="py-2 px-2 text-right text-[11px] font-mono text-muted-foreground hidden md:table-cell">
                      {fmtNum(c["24h_vol_cmc"])}
                    </td>
                    <td className="py-2 px-2 text-right hidden lg:table-cell">
                      <span className={`text-[11px] font-mono font-bold ${c.rsi ? (c.rsi > 70 ? "text-rose-400" : c.rsi < 30 ? "text-emerald-400" : "text-yellow-400") : "text-muted-foreground"}`}>
                        {c.rsi?.toFixed(1) || "—"}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Badge className={`text-[9px] border-0 ${
                        c.techrating_1d === "StrongBuy" ? "bg-emerald-500/20 text-emerald-400" :
                        c.techrating_1d === "Buy" ? "bg-emerald-500/10 text-emerald-300" :
                        "bg-yellow-500/10 text-yellow-300"
                      }`}>
                        {c.techrating_1d || "Buy"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}