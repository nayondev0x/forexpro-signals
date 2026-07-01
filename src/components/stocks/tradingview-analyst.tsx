"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target, RefreshCw, Loader2, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Users, DollarSign
} from "lucide-react";

interface AnalystData {
  symbol: string;
  analyst_recommendations?: {
    recommendation_mark: number;
    price_target_low: number;
    price_target_high: number;
    price_target_average: number;
    price_target_median: number;
    recommendation_total: number;
    recommendation_buy: number;
    recommendation_hold: number;
    recommendation_sell: number;
    recommendation_under: number;
    recommendation_date: string;
    counts?: { strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number; total: number };
  };
  summary?: {
    rating?: { key: string; label: string };
    recommendation_mark: number;
    counts?: { strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number; total: number };
  };
}

export function TradingViewAnalystPanel({ defaultTicker = "AAPL" }: { defaultTicker?: string }) {
  const [ticker, setTicker] = useState(defaultTicker);
  const [data, setData] = useState<AnalystData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalyst = useCallback(async (t?: string) => {
    const sym = `NASDAQ:${t || ticker}`;
    setLoading(true);
    try {
      const res = await fetch(`/api/tradingview?type=analyst&symbol=${encodeURIComponent(sym)}`);
      const json = await res.json();
      if (json?.analyst_recommendations || json?.summary) {
        setData({ symbol: sym, ...json });
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [ticker]);

  useEffect(() => { fetchAnalyst(); }, [fetchAnalyst]);

  const tickers = ["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA", "AMZN", "META", "AMD", "NFLX", "SPY"];

  const rec = data?.analyst_recommendations;
  const summary = data?.summary;
  const counts = summary?.counts || rec?.counts;
  const total = counts?.total || rec?.recommendation_total || 0;
  const ratingKey = summary?.rating?.key || (rec?.recommendation_mark !== undefined ? (rec.recommendation_mark <= 1.5 ? "buy" : rec.recommendation_mark <= 2.5 ? "hold" : "sell") : "neutral");

  const ratingStyles: Record<string, string> = {
    "strong_buy": "bg-emerald-500/20 text-emerald-400",
    "buy": "bg-emerald-500/10 text-emerald-300",
    "neutral": "bg-yellow-500/10 text-yellow-300",
    "hold": "bg-yellow-500/10 text-yellow-300",
    "sell": "bg-rose-500/10 text-rose-300",
    "strong_sell": "bg-rose-500/20 text-rose-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-bold">Analyst Recommendations</h2>
          <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">TRADINGVIEW</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchAnalyst()} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Ticker Selector */}
      <div className="flex flex-wrap gap-1.5">
        {tickers.map(t => (
          <button
            key={t}
            onClick={() => { setTicker(t); fetchAnalyst(t); }}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-md transition-colors ${
              ticker === t ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-muted/50 text-muted-foreground border border-transparent hover:border-border"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">No analyst data</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Rating Summary */}
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-blue-400" /> Consensus Rating
                </span>
                <Badge className={`text-xs border-0 ${ratingStyles[ratingKey] || ratingStyles.neutral}`}>
                  {summary?.rating?.label || ratingKey.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {/* Bar Chart of counts */}
              {counts && (
                <div className="space-y-2 mb-4">
                  {[
                    { label: "Strong Buy", value: counts.strong_buy || 0, color: "bg-emerald-500" },
                    { label: "Buy", value: counts.buy || 0, color: "bg-emerald-400" },
                    { label: "Hold", value: counts.hold || 0, color: "bg-yellow-400" },
                    { label: "Sell", value: counts.sell || 0, color: "bg-rose-400" },
                    { label: "Strong Sell", value: counts.strong_sell || 0, color: "bg-rose-500" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-20 text-right">{item.label}</span>
                      <div className="flex-1 bg-muted/30 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-500`}
                          style={{ width: total > 0 ? `${(item.value / total) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-bold w-6 text-right">{item.value}</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-muted-foreground mt-1">Total: {total} analysts</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Price Targets */}
          {rec && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-2 px-4 pt-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <DollarSign className="h-4 w-4 text-amber-400" /> Price Targets
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">Low Target</div>
                    <div className="text-lg font-bold font-mono text-rose-400">${rec.price_target_low?.toFixed(0)}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">High Target</div>
                    <div className="text-lg font-bold font-mono text-emerald-400">${rec.price_target_high?.toFixed(0)}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">Average Target</div>
                    <div className="text-lg font-bold font-mono text-sky-400">${rec.price_target_average?.toFixed(0)}</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">Median Target</div>
                    <div className="text-lg font-bold font-mono text-violet-400">${rec.price_target_median?.toFixed(0)}</div>
                  </div>
                </div>
                {rec.recommendation_date && (
                  <div className="text-[10px] text-muted-foreground text-center">As of {rec.recommendation_date}</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}