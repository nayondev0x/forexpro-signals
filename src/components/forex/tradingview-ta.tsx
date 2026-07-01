"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Target, RefreshCw, TrendingUp, TrendingDown, Minus,
  ArrowUpRight, ArrowDownRight, Loader2, Crosshair, BarChart3, Activity
} from "lucide-react";

// ── Types ──
interface PivotLevel { middle: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number; }
interface DemarkPivot { middle: number; r1: number; s1: number; }

interface PivotData {
  classic: PivotLevel;
  fibonacci: PivotLevel;
  camarilla: PivotLevel;
  demark: DemarkPivot;
}

interface Indicators {
  rsi: number; macd: number; macdSignal: number; adx: number; cci20: number;
  ema10: number; ema20: number; ema50: number; ema100: number; ema200: number;
  ao: number; momentum: number; bbPower: number; hullMA9: number;
  ichimokuBase: number; adxPlusDI: number; adxMinusDI: number;
  bbUpper: number; bbMiddle: number; bbLower: number;
}

// ── Rating color helper ──
function ratingColor(rating: number) {
  if (rating >= 1) return "text-emerald-400";
  if (rating <= -1) return "text-rose-400";
  return "text-yellow-400";
}

function ratingLabel(rating: number) {
  if (rating >= 1.5) return { text: "Strong Buy", color: "bg-emerald-500/20 text-emerald-400" };
  if (rating >= 0.5) return { text: "Buy", color: "bg-emerald-500/10 text-emerald-300" };
  if (rating >= -0.5) return { text: "Neutral", color: "bg-yellow-500/10 text-yellow-300" };
  if (rating >= -1.5) return { text: "Sell", color: "bg-rose-500/10 text-rose-300" };
  return { text: "Strong Sell", color: "bg-rose-500/20 text-rose-400" };
}

// ── Pivot Table ──
function PivotTable({ title, pivots, type }: { title: string; pivots: PivotLevel | DemarkPivot; type: string; }) {
  const isFull = "r2" in pivots;
  return (
    <Card className="border-border/30 bg-card/80 backdrop-blur">
      <CardHeader className="pb-1.5 pt-3 px-3">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <div className="space-y-0.5 text-[11px] font-mono">
          {isFull ? (
            <>
              <div className="flex justify-between"><span className="text-rose-300">R3</span><span className="text-rose-400">{(pivots as PivotLevel).r3?.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-rose-300">R2</span><span className="text-rose-400">{(pivots as PivotLevel).r2?.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-rose-300">R1</span><span className="text-rose-400">{(pivots as PivotLevel).r1?.toFixed(4)}</span></div>
              <div className="flex justify-between border-t border-border/20 pt-0.5 mt-0.5"><span className="text-sky-300 font-bold">PP</span><span className="text-sky-400 font-bold">{(pivots as PivotLevel).middle?.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-emerald-300">S1</span><span className="text-emerald-400">{(pivots as PivotLevel).s1?.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-emerald-300">S2</span><span className="text-emerald-400">{(pivots as PivotLevel).s2?.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-emerald-300">S3</span><span className="text-emerald-400">{(pivots as PivotLevel).s3?.toFixed(4)}</span></div>
            </>
          ) : (
            <>
              <div className="flex justify-between"><span className="text-rose-300">R1</span><span className="text-rose-400">{(pivots as DemarkPivot).r1?.toFixed(4)}</span></div>
              <div className="flex justify-between border-t border-border/20 pt-0.5 mt-0.5"><span className="text-sky-300 font-bold">PP</span><span className="text-sky-400 font-bold">{(pivots as DemarkPivot).middle?.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-emerald-300">S1</span><span className="text-emerald-400">{(pivots as DemarkPivot).s1?.toFixed(4)}</span></div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Indicator Row ──
function IndRow({ label, value, threshold }: { label: string; value: number | undefined; threshold?: { buy: number; sell: number } }) {
  if (value === undefined || value === null) return null;
  const up = threshold ? value > threshold.buy : value > 0;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {up ? <ArrowUpRight className="h-3 w-3 text-emerald-400" /> : <ArrowDownRight className="h-3 w-3 text-rose-400" />}
        <span className={`text-[11px] font-mono font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
          {typeof value === "number" ? value.toFixed(2) : value}
        </span>
      </div>
    </div>
  );
}

// ── Main Component ──
export function TradingViewTA({ defaultSymbol = "FX:EURUSD" }: { defaultSymbol?: string }) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [pivots, setPivots] = useState<PivotData | null>(null);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [taRatings, setTaRatings] = useState<Record<string, { All: number; MA: number; Other: number }>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (sym?: string) => {
    const s = sym || symbol;
    setLoading(true);
    try {
      const [pivotRes, taRes] = await Promise.all([
        fetch(`/api/tradingview?type=forex-pivots&symbol=${encodeURIComponent(s)}`).then(r => r.json()),
        fetch(`/api/tradingview?type=ta&symbol=${encodeURIComponent(s)}`).then(r => r.json()),
      ]);
      if (pivotRes?.pivots) setPivots(pivotRes.pivots);
      if (pivotRes?.indicators) setIndicators(pivotRes.indicators);
      if (taRes && typeof taRes === "object") setTaRatings(taRes);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [symbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const forexPairs = [
    "FX:EURUSD", "FX:GBPUSD", "FX:USDJPY", "FX:USDCHF",
    "FX:AUDUSD", "FX:NZDUSD", "FX:USDCAD", "FX:XAUUSD",
  ];

  // RSI signal
  const rsiSignal = indicators?.rsi ? (indicators.rsi > 70 ? "Overbought" : indicators.rsi < 30 ? "Oversold" : "Neutral") : "";
  const adxSignal = indicators?.adx ? (indicators.adx > 25 ? "Strong Trend" : indicators.adx > 20 ? "Trending" : "Weak Trend") : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-bold">TradingView Technical Analysis</h2>
          <Badge variant="outline" className="text-[10px] text-violet-400 border-violet-500/30">PIVOT POINTS</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading} className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Pair Selector */}
      <div className="flex flex-wrap gap-1.5">
        {forexPairs.map(p => (
          <button
            key={p}
            onClick={() => { setSymbol(p); fetchData(p); }}
            className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-colors ${
              symbol === p ? "bg-violet-500/20 text-violet-400 border border-violet-500/30" : "bg-muted/50 text-muted-foreground border border-transparent hover:border-border"
            }`}
          >
            {p.replace("FX:", "").replace("/", "/")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !pivots ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">No data available</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Classic Pivots */}
          {pivots.classic && <PivotTable title="Classic Pivot Points" pivots={pivots.classic} type="classic" />}
          {/* Fibonacci Pivots */}
          {pivots.fibonacci && <PivotTable title="Fibonacci Pivot Points" pivots={pivots.fibonacci} type="fibonacci" />}
          {/* Camarilla Pivots */}
          {pivots.camarilla && <PivotTable title="Camarilla Pivot Points" pivots={pivots.camarilla} type="camarilla" />}
          {/* Demark Pivots */}
          {pivots.demark && <PivotTable title="Demark Pivot Points" pivots={pivots.demark} type="demark" />}
        </div>
      )}

      {/* Multi-Timeframe TA Ratings */}
      {Object.keys(taRatings).length > 0 && (
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2 px-4 pt-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-sky-500" /> Multi-Timeframe TA Rating
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {Object.entries(taRatings).map(([tf, vals]) => {
                const r = vals.All || 0;
                const rl = ratingLabel(r);
                return (
                  <div key={tf} className="text-center p-2 rounded-lg bg-muted/30">
                    <div className="text-[10px] text-muted-foreground mb-1">{tf}</div>
                    <Badge className={`text-[10px] ${rl.color} border-0`}>{rl.text}</Badge>
                    <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">{r.toFixed(1)}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indicators Grid */}
      {indicators && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Key Indicators */}
          <Card className="border-border/30 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="h-4 w-4 text-amber-500" /> Key Indicators
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 divide-y divide-border/10">
              <IndRow label="RSI (14)" value={indicators.rsi} threshold={{ buy: 30, sell: 70 }} />
              {rsiSignal && (
                <div className="py-1">
                  <Badge className={`text-[10px] border-0 ${rsiSignal === "Overbought" ? "bg-rose-500/20 text-rose-400" : rsiSignal === "Oversold" ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {rsiSignal}
                  </Badge>
                </div>
              )}
              <IndRow label="MACD" value={indicators.macd} />
              <IndRow label="MACD Signal" value={indicators.macdSignal} />
              <IndRow label="ADX (14)" value={indicators.adx} />
              {adxSignal && <div className="py-1"><span className="text-[10px] text-muted-foreground">{adxSignal}</span></div>}
              <IndRow label="CCI (20)" value={indicators.cci20} threshold={{ buy: -100, sell: 100 }} />
              <IndRow label="Momentum" value={indicators.momentum} />
              <IndRow label="Awesome Oscillator" value={indicators.ao} />
              <IndRow label="Bollinger Power" value={indicators.bbPower} />
            </CardContent>
          </Card>

          {/* EMA + Support/Resistance */}
          <Card className="border-border/30 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2 px-4 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4 text-cyan-500" /> Moving Averages & Support/Resistance
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 divide-y divide-border/10">
              <IndRow label="EMA 10" value={indicators.ema10} />
              <IndRow label="EMA 20" value={indicators.ema20} />
              <IndRow label="EMA 50" value={indicators.ema50} />
              <IndRow label="EMA 100" value={indicators.ema100} />
              <IndRow label="EMA 200" value={indicators.ema200} />
              <IndRow label="Hull MA 9" value={indicators.hullMA9} />
              <IndRow label="Ichimoku Base" value={indicators.ichimokuBase} />
              <IndRow label="BB Upper" value={indicators.bbUpper} />
              <IndRow label="BB Middle" value={indicators.bbMiddle} />
              <IndRow label="BB Lower" value={indicators.bbLower} />
              <IndRow label="+DI" value={indicators.adxPlusDI} />
              <IndRow label="-DI" value={indicators.adxMinusDI} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}