"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bitcoin, RefreshCw, TrendingUp, TrendingDown, Minus, Gauge,
  Flame, ArrowUpRight, ArrowDownRight, Loader2, Shield, Activity,
  AlertTriangle, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/* ─ Types ─ */
interface CryptoSignal {
  pair: string;
  action: string;
  confidence: number;
  signal_score: number;
  sl_price: number | null;
  tp_price: number | null;
  current_price: number | null;
  regime: string;
  timestamp: number;
}

interface FundingRate {
  symbol: string;
  funding_rate: number;
  funding_rate_8h: string;
  direction: string;
  mark_price: number;
  next_funding_time: number;
}

interface FearGreed {
  value: number;
  label: string;
}

/* ─ Helpers ─ */
const REGIME_COLORS: Record<string, string> = {
  LOW_VOLATILITY: "text-amber-500",
  TRENDING_UP: "text-emerald-500",
  TRENDING_DOWN: "text-rose-500",
  TREND_EXHAUSTING_UP: "text-orange-500",
  TREND_EXHAUSTING_DOWN: "text-orange-500",
  RANGING: "text-sky-500",
  ANALYZING: "text-violet-500",
  BREAKOUT: "text-cyan-500",
};

const REGIME_BG: Record<string, string> = {
  LOW_VOLATILITY: "bg-amber-500/10 border-amber-500/20",
  TRENDING_UP: "bg-emerald-500/10 border-emerald-500/20",
  TRENDING_DOWN: "bg-rose-500/10 border-rose-500/20",
  TREND_EXHAUSTING_UP: "bg-orange-500/10 border-orange-500/20",
  TREND_EXHAUSTING_DOWN: "bg-orange-500/10 border-orange-500/20",
  RANGING: "bg-sky-500/10 border-sky-500/20",
  ANALYZING: "bg-violet-500/10 border-violet-500/20",
  BREAKOUT: "bg-cyan-500/10 border-cyan-500/20",
};

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: typeof TrendingUp }> = {
  BUY: { bg: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30", text: "BUY", icon: TrendingUp },
  LONG: { bg: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30", text: "LONG", icon: TrendingUp },
  SELL: { bg: "bg-rose-500/20 text-rose-500 border-rose-500/30", text: "SELL", icon: TrendingDown },
  SHORT: { bg: "bg-rose-500/20 text-rose-500 border-rose-500/30", text: "SHORT", icon: TrendingDown },
  HOLD: { bg: "bg-amber-500/20 text-amber-500 border-amber-500/30", text: "HOLD", icon: Minus },
};

function getFearGreedColor(val: number): string {
  if (val <= 20) return "text-rose-500";
  if (val <= 40) return "text-orange-500";
  if (val <= 60) return "text-amber-500";
  if (val <= 80) return "text-emerald-500";
  return "text-emerald-400";
}

function getFearGreedBarColor(val: number): string {
  if (val <= 20) return "bg-rose-500";
  if (val <= 40) return "bg-orange-500";
  if (val <= 60) return "bg-amber-500";
  if (val <= 80) return "bg-emerald-400";
  return "bg-emerald-500";
}

function getFearGreedBg(val: number): string {
  if (val <= 20) return "from-rose-500/20 to-rose-950/10";
  if (val <= 40) return "from-orange-500/20 to-orange-950/10";
  if (val <= 60) return "from-amber-500/20 to-amber-950/10";
  if (val <= 80) return "from-emerald-500/20 to-emerald-950/10";
  return "from-emerald-400/20 to-emerald-500/10";
}

/* ─ Fear & Greed Gauge ─ */
function FearGreedGauge({ data }: { data: FearGreed | null }) {
  if (!data) return <div className="flex h-40 items-center justify-center text-muted-foreground/50">Loading...</div>;

  const val = data.value;
  const label = data.label;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${getFearGreedBg(val)} border border-border/30`}>
        <div className="absolute inset-2 rounded-full bg-card/80" />
        <div className="relative flex flex-col items-center">
          <span className={`text-3xl font-black ${getFearGreedColor(val)}`}>{val}</span>
          <span className="text-[10px] font-semibold text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className={`text-sm font-bold ${getFearGreedColor(val)}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground">Crypto Fear & Greed Index</p>
      </div>
      <div className="w-full">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all duration-1000 ${getFearGreedBarColor(val)}`} style={{ width: `${val}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span className="text-rose-500">Extreme Fear</span>
          <span>Neutral</span>
          <span className="text-emerald-500">Extreme Greed</span>
        </div>
      </div>
    </div>
  );
}

/* ─ Signal Card ─ */
function SignalCard({ signal }: { signal: CryptoSignal }) {
  const action = (signal.action || "HOLD").toUpperCase();
  const style = ACTION_STYLES[action] || ACTION_STYLES.HOLD;
  const Icon = style.icon;
  const isAction = action === "BUY" || action === "SELL" || action === "LONG" || action === "SHORT";

  return (
    <Card className={`border-border/30 bg-card/80 backdrop-blur transition-all hover:border-foreground/20 ${isAction ? "ring-1 ring-emerald-500/20" : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bitcoin className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold text-foreground">{signal.pair}</span>
          </div>
          <Badge variant="outline" className={`text-[10px] font-bold ${style.bg}`}>
            <Icon className="mr-1 h-3 w-3" />{style.text}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${REGIME_BG[signal.regime] || ""} ${REGIME_COLORS[signal.regime] || "text-muted-foreground"}`}>
            <Activity className="mr-1 h-2.5 w-2.5" />
            {signal.regime?.replace(/_/g, " ") || "N/A"}
          </Badge>
          {signal.signal_score > 0 && (
            <span className="text-[10px] text-muted-foreground">Score: {signal.signal_score}</span>
          )}
        </div>
        {(signal.sl_price || signal.tp_price) && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            {signal.tp_price && (
              <div className="rounded-md bg-emerald-500/10 p-1.5">
                <p className="text-[9px] text-emerald-500/70">Take Profit</p>
                <p className="font-mono text-xs font-bold text-emerald-500">{signal.tp_price}</p>
              </div>
            )}
            {signal.sl_price && (
              <div className="rounded-md bg-rose-500/10 p-1.5">
                <p className="text-[9px] text-rose-500/70">Stop Loss</p>
                <p className="font-mono text-xs font-bold text-rose-500">{signal.sl_price}</p>
              </div>
            )}
          </div>
        )}
        {signal.current_price && (
          <div className="border-t border-border/20 pt-1.5">
            <span className="text-[10px] text-muted-foreground">Price: </span>
            <span className="font-mono text-xs font-bold text-foreground">${signal.current_price}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─ Main Component ─ */
export function CryptoSignals() {
  const [signals, setSignals] = useState<CryptoSignal[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreed | null>(null);
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [sigRes, fgRes, frRes] = await Promise.allSettled([
      fetch("/api/crypto/signal?action=all").then(r => r.json()),
      fetch("/api/crypto/fear-greed").then(r => r.json()),
      fetch("/api/crypto/funding-rates").then(r => r.json()),
    ]);

    if (sigRes.status === "fulfilled" && sigRes.value?.signals) {
      setSignals(sigRes.value.signals);
    }
    if (fgRes.status === "fulfilled" && fgRes.value?.value !== undefined) {
      setFearGreed({ value: fgRes.value.value, label: fgRes.value.label });
    }
    if (frRes.status === "fulfilled" && frRes.value?.top_rates) {
      setFundingRates(frRes.value.top_rates);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => fetchData(true);

  // Stats
  const buyCount = signals.filter(s => s.action?.toUpperCase() === "BUY" || s.action?.toUpperCase() === "LONG").length;
  const sellCount = signals.filter(s => s.action?.toUpperCase() === "SELL" || s.action?.toUpperCase() === "SHORT").length;
  const holdCount = signals.filter(s => s.action?.toUpperCase() === "HOLD").length;

  return (
    <div className="space-y-4">
      {/* Top Row: Fear/Greed + Funding Rates */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Fear & Greed */}
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4 text-violet-500" />
              Market Sentiment
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-500">LIVE</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FearGreedGauge data={fearGreed} />
          </CardContent>
        </Card>

        {/* Funding Rates */}
        <Card className="lg:col-span-2 border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-orange-500" />
              Top Funding Rates
              <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-500">
                {fundingRates.length} pairs
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {fundingRates.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground/50 text-sm">Loading funding rates...</div>
            ) : (
              <div className="divide-y divide-border/10">
                {fundingRates.slice(0, 8).map((fr, i) => {
                  const isPositive = fr.funding_rate >= 0;
                  return (
                    <div key={fr.symbol} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                        <span className="text-xs font-bold text-foreground">{fr.symbol.replace("USDT", "")}</span>
                        <span className="text-[10px] text-muted-foreground">/USDT</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">${fr.mark_price?.toFixed(4)}</span>
                        <span className={`flex items-center gap-0.5 text-xs font-bold ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                          {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {fr.funding_rate_8h}
                        </span>
                        <span className="text-[9px] text-muted-foreground max-w-[100px] truncate">{fr.direction}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signals Section */}
      <Card className="border-border/30 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              Crypto Trading Signals
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-500">LIVE</Badge>
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* Stats pills */}
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{buyCount} Buy</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />{sellCount} Sell</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{holdCount} Hold</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mb-3 h-6 w-6 animate-spin" />
              <span className="text-sm">Fetching crypto signals...</span>
            </div>
          ) : signals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <Bitcoin className="mb-3 h-10 w-10" />
              <span className="text-sm">No signals available</span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {signals.map(s => (
                <SignalCard key={s.pair} signal={s} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}