"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { TrendingUp, TrendingDown, Activity, Target, ShieldAlert, Clock, Zap, BarChart3, Trophy, ArrowUpRight, ArrowDownRight, Signal, Wifi, WifiOff, RefreshCw, Brain, Gauge, Star, ChevronDown, ChevronUp, X, Newspaper, LineChart, Bitcoin, Radio, Power, Globe, Flame, Timer, ArrowRightLeft, LayoutGrid } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useForexStore } from "@/stores/forex-store";
import { ThemeToggle } from "@/components/forex/theme-toggle";
import { PriceChart } from "@/components/forex/price-chart";
import { RiskCalculator } from "@/components/forex/risk-calculator";
import { EconomicCalendar } from "@/components/forex/economic-calendar";
import { SignalDetailSheet } from "@/components/forex/signal-detail-sheet";
import { PerformanceDashboard } from "@/components/forex/performance-dashboard";
import { ControlsBar } from "@/components/forex/controls-bar";
import { playSignalSound, sendBrowserNotification } from "@/components/forex/notification-sound";
import { MarketNews } from "@/components/forex/market-news";
import { StockPrices } from "@/components/stocks/stock-prices";
import { CryptoSignals } from "@/components/crypto/crypto-signals";
import { FinvizDashboard } from "@/components/finviz/finviz-dashboard";

/* ─Types ─*/
interface ForexSignal {
  id: string; pair: string; type: "BUY" | "SELL"; entry: number; tp: number; sl: number;
  timestamp: string; status: "ACTIVE" | "TP_HIT" | "SL_HIT" | "CLOSED";
  pips?: number; confidence?: number; reasoning?: string[];
  indicators?: Record<string, string | number>; source?: string;
  apiSource?: string; apiKey?: string;
  tradeDuration?: string; tpPips?: number; slPips?: number;
  engineVersion?: string;
}
interface PriceData {
  pair: string; bid: number; ask: number; spread: number;
  change: number; changePercent: number; source?: string;
}

/* ─Helpers ─*/
function formatTime(iso: string) { return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); }
function formatPrice(price: number, pair: string) {
  if (pair.includes("XAU") || pair.includes("XAG")) return price.toFixed(2);
  if (pair.includes("JPY")) return price.toFixed(2);
  return price.toFixed(4);
}
function calcPips(entry: number, current: number, type: "BUY" | "SELL", pair: string): number {
  const diff = type === "BUY" ? current - entry : entry - current;
  return pair.includes("JPY") || pair.includes("XAU") || pair.includes("XAG") ? diff : diff * 10000;
}

/* ─ Forex Sessions (UTC-based) ─*/
const SESSIONS = [
  { name: "Sydney", flag: "🇦🇺", startUTC: 21, endUTC: 6, color: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" },
  { name: "Tokyo", flag: "🇯🇵", startUTC: 0, endUTC: 9, color: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-500/30" },
  { name: "London", flag: "🇬🇧", startUTC: 7, endUTC: 16, color: "text-sky-400", bg: "bg-sky-500/20", border: "border-sky-500/30" },
  { name: "New York", flag: "🇺🇸", startUTC: 12, endUTC: 21, color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" },
];

function isSessionActive(s: typeof SESSIONS[0], utcH: number): boolean {
  return s.startUTC < s.endUTC ? (utcH >= s.startUTC && utcH < s.endUTC) : (utcH >= s.startUTC || utcH < s.endUTC);
}

function getActiveSessions(): typeof SESSIONS {
  const utcH = new Date().getUTCHours();
  return SESSIONS.filter(s => isSessionActive(s, utcH));
}

function getSessionAtTime(iso: string): string {
  const utcH = new Date(iso).getUTCHours();
  for (const s of SESSIONS) {
    if (isSessionActive(s, utcH)) return s.name;
  }
  return "Off-hours";
}

/* ─ Session Bar ─*/
function SessionBar() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const active = getActiveSessions();
  const utcH = new Date().getUTCHours();
  const utcM = new Date().getUTCMinutes();
  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-border/20 bg-card/40 overflow-x-auto">
      <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      {SESSIONS.map(s => {
        const isActive = active.some(a => a.name === s.name);
        return (
          <Badge key={s.name} variant="outline" className={`text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${isActive ? `${s.bg} ${s.border} ${s.color}` : "border-border/20 text-muted-foreground/40"}`}>
            <span className="mr-1">{s.flag}</span>{s.name}
            {isActive && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
          </Badge>
        );
      })}
      <span className="ml-auto text-[10px] text-muted-foreground/50 flex-shrink-0">UTC {String(utcH).padStart(2, "0")}:{String(utcM).padStart(2, "0")}</span>
    </div>
  );
}

/* ─ Countdown Timer (for 5-min trade duration) ─*/
function CountdownTimer({ signalTimestamp, durationSec = 300 }: { signalTimestamp: string; durationSec?: number }) {
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Math.floor(new Date(signalTimestamp).getTime() / 1000));

  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(Math.floor(Date.now() / 1000) - startTime.current);
    }, 1000);
    return () => clearInterval(iv);
  }, [signalTimestamp]);

  const remaining = Math.max(0, durationSec - elapsed);
  const pct = Math.min(100, (elapsed / durationSec) * 100);
  const isExpired = remaining <= 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="flex items-center gap-1.5 w-full">
      <Timer className={`h-3 w-3 flex-shrink-0 ${isExpired ? "text-amber-500" : pct > 80 ? "text-rose-400" : "text-cyan-400"}`} />
      <div className="flex-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isExpired ? "bg-amber-500" : pct > 80 ? "bg-rose-500" : "bg-cyan-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${isExpired ? "text-amber-500" : "text-foreground/70"}`}>
        {isExpired ? "EXPIRED" : `${mins}:${String(secs).padStart(2, "0")}`}
      </span>
    </div>
  );
}

/* ─ Enhanced Currency Strength Heatmap with Cross-Rate Matrix ─*/
function CurrencyHeatmap({ prices }: { prices: PriceData[] }) {
  const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];
  const MATRIX_PAIRS: Record<string, string[]> = {
    USD: ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD"],
    EUR: ["EUR/USD", "EUR/GBP", "EUR/JPY"],
    GBP: ["GBP/USD", "EUR/GBP", "GBP/JPY"],
    JPY: ["USD/JPY", "EUR/JPY", "GBP/JPY"],
    AUD: ["AUD/USD", "AUD/CAD", "AUD/JPY"],
    CAD: ["USD/CAD", "AUD/CAD"],
    CHF: ["USD/CHF"],
    NZD: ["NZD/USD"],
  };

  // Calculate strength from live price changes
  const strengthMap = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const ccy of CURRENCIES) map[ccy] = { total: 0, count: 0 };

    for (const p of prices) {
      const [base, quote] = p.pair.split("/");
      if (map[base]) { map[base].total += p.changePercent; map[base].count++; }
      if (map[quote]) { map[quote].total -= p.changePercent; map[quote].count++; }
    }

    const result: Record<string, number> = {};
    for (const ccy of CURRENCIES) {
      const m = map[ccy];
      result[ccy] = m.count > 0 ? m.total / m.count : 0;
    }
    return result;
  }, [prices]);

  // Build cross-rate matrix
  const matrix = useMemo(() => {
    const grid: Record<string, Record<string, number | null>> = {};
    for (const row of CURRENCIES) {
      grid[row] = {};
      for (const col of CURRENCIES) {
        if (row === col) { grid[row][col] = 0; continue; }
        // Find the pair that gives us row/col or col/row
        const direct = prices.find(p => p.pair === `${row}/${col}`);
        if (direct) {
          // row is base, col is quote → positive change = row strong
          grid[row][col] = direct.changePercent;
        } else {
          const inverse = prices.find(p => p.pair === `${col}/${row}`);
          if (inverse) {
            // col is base, row is quote → negative change = row strong
            grid[row][col] = -inverse.changePercent;
          } else {
            grid[row][col] = null;
          }
        }
      }
    }
    return grid;
  }, [prices]);

  const maxAbs = Math.max(...CURRENCIES.map(c => Math.abs(strengthMap[c])), 0.01);

  const getStrengthCell = (val: number) => {
    const n = val / maxAbs;
    if (n > 0.6) return "bg-emerald-600/90 text-white font-bold";
    if (n > 0.25) return "bg-emerald-500/50 text-emerald-50 font-semibold";
    if (n > 0.05) return "bg-emerald-500/20 text-emerald-400";
    if (n < -0.6) return "bg-rose-600/90 text-white font-bold";
    if (n < -0.25) return "bg-rose-500/50 text-rose-50 font-semibold";
    if (n < -0.05) return "bg-rose-500/20 text-rose-400";
    return "bg-muted/30 text-muted-foreground";
  };

  const getMatrixCell = (val: number | null) => {
    if (val === null) return "bg-muted/10 text-muted-foreground/30";
    const abs = Math.abs(val);
    const norm = Math.min(abs / 0.1, 1);
    if (val > 0.03) return `bg-emerald-500/${Math.round(norm * 80)}`;
    if (val < -0.03) return `bg-rose-500/${Math.round(norm * 80)}`;
    return "bg-muted/20";
  };

  const getLabel = (val: number) => {
    if (val > 0.1) return "BULLISH";
    if (val > 0.03) return "STRONG";
    if (val > -0.03) return "NEUTRAL";
    if (val > -0.1) return "WEAK";
    return "BEARISH";
  };

  const sortedCurrencies = [...CURRENCIES].sort((a, b) => (strengthMap[b] || 0) - (strengthMap[a] || 0));

  return (
    <div className="space-y-4">
      {/* Strength Ranking */}
      <Card className="border-border/30 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-orange-500" />
              Currency Strength Ranking
              <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-500">{prices.length} pairs</Badge>
            </CardTitle>
            <Badge variant="outline" className="border-border/30 text-[10px] text-muted-foreground">Sorted by strength</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">Real-time relative strength derived from live price changes across all pairs</p>
        </CardHeader>
        <CardContent>
          {prices.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground/50 text-sm">Loading market data...</div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {sortedCurrencies.map((ccy, idx) => {
                const val = strengthMap[ccy] || 0;
                return (
                  <div key={ccy} className={`rounded-lg p-3 text-center transition-all duration-500 ${getStrengthCell(val)} relative`}>
                    {idx < 3 && <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-amber-500 text-black rounded-full w-4 h-4 flex items-center justify-center">{idx + 1}</span>}
                    <div className="text-lg font-black">{ccy}</div>
                    <div className="text-[10px] mt-0.5 opacity-80">{getLabel(val)}</div>
                    <div className="text-xs font-bold mt-1">{val >= 0 ? "+" : ""}{val.toFixed(3)}%</div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-black/20">
                      <div className={`h-full rounded-full ${val >= 0 ? "bg-emerald-300" : "bg-rose-300"}`} style={{ width: `${Math.min(100, Math.abs(val) / maxAbs * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cross-Rate Matrix */}
      {prices.length > 0 && (
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowRightLeft className="h-4 w-4 text-violet-500" />
              Cross-Rate Change Matrix
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Row currency vs Column currency — green = row stronger, red = row weaker</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="p-1 text-muted-foreground text-[9px] font-bold" />
                    {CURRENCIES.map(c => <th key={c} className="p-1 font-bold text-foreground/80 min-w-[52px]">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CURRENCIES.map(row => (
                    <tr key={row}>
                      <td className="p-1 font-bold text-foreground/80 text-right pr-2">{row}</td>
                      {CURRENCIES.map(col => {
                        if (row === col) return <td key={col} className="p-1 rounded"><div className="h-7 w-full rounded bg-muted/10 flex items-center justify-center text-muted-foreground/20">—</div></td>;
                        const val = matrix[row]?.[col];
                        return (
                          <td key={col} className="p-0.5">
                            <div className={`h-7 w-full rounded flex items-center justify-center font-mono text-[9px] font-semibold transition-all duration-500 ${getMatrixCell(val)} ${val !== null ? (val >= 0 ? "text-emerald-100" : "text-rose-100") : "text-muted-foreground/30"}`}>
                              {val !== null ? `${val >= 0 ? "+" : ""}${val.toFixed(3)}%` : "—"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─Pulse Dot ─*/
function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${color}`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}

/* ─Confidence Bar ─*/
function ConfidenceBar({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? "bg-emerald-500" : confidence >= 60 ? "bg-amber-500" : "bg-rose-500";
  const textColor = confidence >= 80 ? "text-emerald-500" : confidence >= 60 ? "text-amber-500" : "text-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${confidence}%` }} /></div>
      <span className={`text-[10px] font-bold ${textColor}`}>{confidence}%</span>
    </div>
  );
}

/* ─Price Ticker Bar ─*/
function PriceTickerBar({ prices }: { prices: PriceData[] }) {
  return (
    <div className="w-full overflow-hidden border-b border-border/40 bg-card/60 backdrop-blur">
      <div className="flex animate-scroll items-center gap-6 px-4 py-2">
        {[...prices, ...prices, ...prices, ...prices].map((p, i) => (
          <div key={`${p.pair}-${i}`} className="flex shrink-0 items-center gap-2 text-xs">
            <span className="font-semibold text-foreground/90">{p.pair}</span>
            <span className="font-mono text-foreground/80">{formatPrice(p.bid, p.pair)}</span>
            <span className={p.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"}>
              {p.changePercent >= 0 ? "+" : ""}{p.changePercent.toFixed(3)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─Stats Cards ─*/
function StatsCards({ signals, dataSource }: { signals: ForexSignal[]; dataSource: string }) {
  const total = signals.length;
  const active = signals.filter(s => s.status === "ACTIVE").length;
  const tp = signals.filter(s => s.status === "TP_HIT").length;
  const sl = signals.filter(s => s.status === "SL_HIT").length;
  const completed = tp + sl;
  const winRate = completed > 0 ? ((tp / completed) * 100).toFixed(1) : "--";
  const totalPips = signals.reduce((a, s) => a + (s.pips || 0), 0);
  const avgConf = signals.length > 0 ? Math.round(signals.reduce((a, s) => a + (s.confidence || 0), 0) / signals.length) : 0;
  const stats = [
    { label: "Total Signals", value: total, icon: Signal, color: "text-sky-500" },
    { label: "Active", value: active, icon: Activity, color: "text-amber-500" },
    { label: "Win Rate", value: `${winRate}%`, icon: Trophy, color: "text-emerald-500" },
    { label: "TP / SL", value: `${tp} / ${sl}`, icon: Target, color: "text-emerald-500" },
    { label: "Total Pips", value: `${totalPips > 0 ? "+" : ""}${totalPips.toFixed(1)}`, icon: BarChart3, color: totalPips >= 0 ? "text-emerald-500" : "text-rose-500" },
    { label: "Avg Confidence", value: `${avgConf}%`, icon: Brain, color: "text-violet-500" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map(s => (
        <Card key={s.label} className="border-border/30 bg-card/80 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
            <s.icon className={`h-4 w-4 ${s.color}`} />
            <span className="text-xl font-bold text-foreground">{s.value}</span>
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
          </CardContent>
        </Card>
      ))}
      <Card className={`col-span-2 sm:col-span-3 lg:col-span-6 border ${dataSource === "live" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <CardContent className="flex items-center justify-center gap-2 p-2.5">
          {dataSource === "live" ? (<><Wifi className="h-4 w-4 text-emerald-500" /><span className="text-xs font-medium text-emerald-500">LIVE DATA</span><Badge variant="outline" className="ml-2 border-emerald-500/30 text-[10px] text-emerald-500">Twelve Data + Alpha Vantage</Badge></>)
          : (<><WifiOff className="h-4 w-4 text-amber-500" /><span className="text-xs font-medium text-amber-500">FALLBACK</span></>)}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─Indicators Panel ─*/
function IndicatorsPanel({ indicators }: { indicators: Record<string, string | number> | undefined }) {
  const [open, setOpen] = useState(false);
  if (!indicators || Object.keys(indicators).length === 0) return null;
  const entries = Object.entries(indicators);
  const displayed = open ? entries : entries.slice(0, 4);
  return (
    <div className="mt-3 border-t border-border/20 pt-2">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground/70 transition-colors">
        <span className="flex items-center gap-1"><Gauge className="h-3 w-3" /> Technical Indicators</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {displayed.map(([key, value]) => (
          <div key={key} className="rounded-md bg-background/60 px-2 py-1">
            <span className="text-[9px] text-muted-foreground">{key}</span>
            <p className="font-mono text-[11px] font-bold text-foreground/90">{String(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─Enhanced Signal Card with Real-time Pips Counter + Countdown ─*/
function SignalCard({ signal, isNew, onClick, livePrice }: { signal: ForexSignal; isNew?: boolean; onClick?: () => void; livePrice?: number }) {
  const isBuy = signal.type === "BUY";
  const isActive = signal.status === "ACTIVE";
  const isTP = signal.status === "TP_HIT";
  const { isFavorite, toggleFavorite } = useForexStore();
  const fav = isFavorite(signal.pair);
  const livePips = isActive && livePrice ? calcPips(signal.entry, livePrice, signal.type, signal.pair) : null;

  // Determine pips color/intensity
  const pipsColor = livePips === null ? "" : livePips > 5 ? "text-emerald-400" : livePips > 0 ? "text-emerald-500" : livePips < -5 ? "text-rose-400" : "text-rose-500";
  const pipsBg = livePips === null ? "" : livePips > 5 ? "bg-emerald-500/15" : livePips > 0 ? "bg-emerald-500/10" : livePips < -5 ? "bg-rose-500/15" : "bg-rose-500/10";

  return (
    <Card className={`relative overflow-hidden border transition-all duration-500 cursor-pointer hover:border-foreground/20 ${isNew ? "border-amber-400/60 shadow-lg shadow-amber-400/10" : isActive ? "border-border/40 bg-card/80" : "border-border/20 bg-card/40 opacity-70"} backdrop-blur`} onClick={onClick}>
      {isNew && (<div className="absolute top-0 right-0 flex items-center gap-1 rounded-bl-lg bg-amber-500 px-2 py-0.5 text-xs font-bold text-black"><Zap className="h-3 w-3" /> NEW</div>)}
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isActive ? (
              isBuy ? (<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20"><TrendingUp className="h-5 w-5 text-emerald-500" /></div>)
              : (<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20"><TrendingDown className="h-5 w-5 text-rose-500" /></div>)
            ) : (
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isTP ? "bg-emerald-500/20" : "bg-rose-500/20"}`}>{isTP ? <Target className="h-5 w-5 text-emerald-500" /> : <ShieldAlert className="h-5 w-5 text-rose-500" />}</div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-foreground">{signal.pair}</h3>
                {signal.source === "RapidAPI" && (<TooltipProvider><Tooltip><TooltipTrigger><Wifi className="h-3 w-3 text-emerald-500" /></TooltipTrigger><TooltipContent className="text-xs">Real API Data</TooltipContent></Tooltip></TooltipProvider>)}
              </div>
              <p className="text-[10px] text-muted-foreground">{signal.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(signal.pair); }} className="p-1 hover:bg-muted rounded"><Star className={`h-3.5 w-3.5 ${fav ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} /></button>
            <div className="flex flex-col items-end gap-1">
              <Badge className={`text-xs font-bold ${isBuy ? "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30" : "bg-rose-500/20 text-rose-500 hover:bg-rose-500/30"}`} variant="outline">
                {isBuy ? (<span className="flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> BUY</span>) : (<span className="flex items-center gap-1"><ArrowDownRight className="h-3 w-3" /> SELL</span>)}
              </Badge>
              {signal.confidence && <ConfidenceBar confidence={signal.confidence} />}
            </div>
          </div>
        </div>

        {/* REAL-TIME PIPS COUNTER — Prominent display for active signals */}
        {isActive && livePips !== null && (
          <div className={`mb-3 rounded-lg p-2.5 border transition-all duration-300 ${pipsBg} ${livePips >= 0 ? "border-emerald-500/20" : "border-rose-500/20"}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <PulseDot color={livePips >= 0 ? "bg-emerald-400" : "bg-rose-400"} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Live P&L</span>
              </div>
              <span className={`text-lg font-black tabular-nums ${pipsColor}`}>
                {livePips >= 0 ? "+" : ""}{livePips.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
              <span>Current: <span className="font-mono font-bold text-foreground/80">{formatPrice(livePrice!, signal.pair)}</span></span>
              <span className="flex items-center gap-1">
                {livePips >= 0 ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-rose-500" />}
                <span className={`font-bold ${pipsColor}`}>{livePips >= 0 ? "+" : ""}{livePips.toFixed(1)} pips</span>
              </span>
            </div>
            {/* Countdown timer for 5-min trade */}
            <CountdownTimer signalTimestamp={signal.timestamp} durationSec={300} />
          </div>
        )}

        <div className="mb-2 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/60 p-2"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry</p><p className="font-mono text-sm font-bold text-foreground">{formatPrice(signal.entry, signal.pair)}</p></div>
          <div className="rounded-lg bg-emerald-500/10 p-2"><p className="text-[10px] uppercase tracking-wider text-emerald-500/70">TP <span className="text-[8px] text-emerald-500/40">({signal.tpPips ? formatPrice(signal.tpPips, signal.pair) : "--"})</span></p><p className="font-mono text-sm font-bold text-emerald-500">{formatPrice(signal.tp, signal.pair)}</p></div>
          <div className="rounded-lg bg-rose-500/10 p-2"><p className="text-[10px] uppercase tracking-wider text-rose-500/70">SL <span className="text-[8px] text-rose-500/40">({signal.slPips ? formatPrice(signal.slPips, signal.pair) : "--"})</span></p><p className="font-mono text-sm font-bold text-rose-500">{formatPrice(signal.sl, signal.pair)}</p></div>
        </div>
        {signal.reasoning && signal.reasoning.length > 0 && (
          <div className="mb-2 rounded-lg bg-background/40 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Analysis</p>
            <div className="flex flex-wrap gap-1">{signal.reasoning.slice(0, 3).map((r, i) => (<span key={i} className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-foreground/70">{r}</span>))}</div>
          </div>
        )}
        <IndicatorsPanel indicators={signal.indicators} />
        <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatTime(signal.timestamp)}</div>
            {signal.tradeDuration && (<Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-[9px] font-bold text-cyan-400"><Radio className="mr-1 h-2.5 w-2.5" />{signal.tradeDuration}</Badge>)}
            {/* Session badge on signal card */}
            <Badge variant="outline" className="border-border/30 bg-muted/30 text-[9px] text-muted-foreground">{getSessionAtTime(signal.timestamp)}</Badge>
          </div>
          {!isActive && signal.pips !== undefined ? (
            <Badge variant="outline" className={`text-xs font-bold ${signal.pips > 0 ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"}`}>{signal.pips > 0 ? "+" : ""}{signal.pips} pips</Badge>
          ) : isActive && livePips === null ? (<div className="flex items-center gap-1.5"><PulseDot color="bg-emerald-400" /><span className="text-xs font-medium text-emerald-500">LIVE</span></div>) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════ MAIN PAGE ═══════════ */
export default function Home() {
  const [signals, setSignals] = useState<ForexSignal[]>([]);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [newSignalId, setNewSignalId] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [dataSource, setDataSource] = useState<string>("connecting");
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const { autoRefresh, tradingMode, setTradingMode, notificationsEnabled, soundEnabled, selectedPair, setSelectedSignalId, selectedSignalId, favorites, activeTab, setActiveTab, sessionFilter } = useForexStore();

  // Filter signals by pair, favorites, and SESSION
  const filteredSignals = useMemo(() => signals.filter(s => {
    if (selectedPair === "__favorites__") {
      if (favorites.length === 0 || !favorites.includes(s.pair)) return false;
    } else if (selectedPair !== "ALL" && s.pair !== selectedPair) return false;
    // Session filter
    if (sessionFilter !== "ALL") {
      const signalSession = getSessionAtTime(s.timestamp);
      if (signalSession !== sessionFilter) return false;
    }
    return true;
  }), [signals, selectedPair, favorites, sessionFilter]);

  const filteredPrices = prices.filter(p => {
    if (selectedPair === "__favorites__") {
      return favorites.length > 0 && favorites.includes(p.pair);
    }
    if (selectedPair !== "ALL" && p.pair !== selectedPair) return false;
    return true;
  });

  const fetchSignals = useCallback(async () => {
    if (!tradingMode) return;
    try {
      const r = await fetch("/api/forex/signal");
      const data = await r.json();
      if (data.signals && data.signals.length > 0) {
        setSignals(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newOnes = data.signals.filter((s: ForexSignal) => !existingIds.has(s.id));
          if (newOnes.length > 0) {
            setNewSignalId(newOnes[0].id);
            setTimeout(() => setNewSignalId(null), 5000);
            if (notificationsEnabled) {
              const sig = newOnes[0];
              sendBrowserNotification(`${sig.pair} ${sig.type}`, `Entry: ${sig.entry} | Confidence: ${sig.confidence}%`);
            }
            if (soundEnabled) playSignalSound();
          }
          return [...newOnes, ...prev].slice(0, 30);
        });
      }
    } catch {}
  }, [notificationsEnabled, soundEnabled, tradingMode]);

  const fetchPrices = useCallback(async () => {
    if (!tradingMode) return;
    try {
      const r = await fetch("/api/forex/prices");
      const data = await r.json();
      if (data.prices) { setPrices(data.prices); setDataSource(data.liveCount >= 5 ? "live" : "partial"); }
    } catch {}
  }, [tradingMode]);

  const refreshSignals = async () => { if (!tradingMode) return; setRefreshing(true); await fetchSignals(); await fetchPrices(); setTimeout(() => setRefreshing(false), 500); };

  useEffect(() => {
    if (!tradingMode) return;
    const load = async () => { await fetchPrices(); await fetchSignals(); };
    load();
    if (autoRefresh) {
      const pi = setInterval(fetchPrices, 30000);
      const si = setInterval(fetchSignals, 20000);
      pollingRef.current = si;
      return () => { clearInterval(pi); clearInterval(si); };
    }
  }, [fetchPrices, fetchSignals, autoRefresh, tradingMode]);

  const activeSignals = filteredSignals.filter(s => s.status === "ACTIVE");
  const completedSignals = filteredSignals.filter(s => s.status !== "ACTIVE");
  const selectedSignal = signals.find(s => s.id === selectedSignalId) || null;
  const chartPairData = prices.find(p => p.pair === selectedPair);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600"><Activity className="h-5 w-5 text-white" /></div>
            <div><h1 className="text-lg font-bold tracking-tight text-foreground">ForexPro<span className="text-emerald-500">Signals</span></h1></div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 rounded-full border border-border/40 bg-card/80 px-3 py-1.5 sm:flex">
              <span className={`h-2 w-2 rounded-full ${tradingMode ? (dataSource === "live" ? "bg-emerald-400" : "bg-amber-400") : "bg-zinc-500"}`} />
              <span className="text-xs text-muted-foreground">{tradingMode ? (dataSource === "live" ? "Live" : "Standby") : "Off"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Price Ticker */}
      {prices.length > 0 && <PriceTickerBar prices={prices} />}

      {/* Session Bar */}
      {tradingMode && <SessionBar />}

      {/* Controls Bar */}
      <ControlsBar refreshing={refreshing} onRefresh={refreshSignals} signalCount={signals.length} />

      {/* OFF State Banner */}
      {!tradingMode && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80 border border-zinc-700/50">
            <Power className="h-8 w-8 text-zinc-500" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-400">Trading Mode is OFF</h2>
          <p className="text-sm text-zinc-500 text-center max-w-md">
            Zero API calls. Free tier is not being used.
            <br />Turn on <span className="text-emerald-500 font-semibold">LIVE</span> when you&apos;re ready to trade.
          </p>
          <Button
            onClick={() => setTradingMode(true)}
            className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
          >
            <Radio className="size-4" />
            Start Trading
          </Button>
        </div>
      )}

      {/* Main Content — only show when trading mode ON */}
      {tradingMode && <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <section className="mb-6"><StatsCards signals={signals} dataSource={dataSource} /></section>
        <Separator className="mb-6 bg-border/30" />

        <Tabs value={activeTab} className="w-full" onValueChange={v => setActiveTab(v)}>
          <TabsList className="mb-4 flex-wrap bg-card/80 border border-border/30 h-auto p-1 gap-1">
            <TabsTrigger value="active" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-500 text-xs">
              <span className="flex items-center gap-1.5"><Activity className="h-4 w-4" />Active{activeSignals.length > 0 && <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[10px] font-bold text-emerald-500">{activeSignals.length}</span>}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-500 text-xs">
              <span className="flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />History{completedSignals.length > 0 && <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500/20 px-1 text-[10px] font-bold text-sky-500">{completedSignals.length}</span>}</span>
            </TabsTrigger>
            <TabsTrigger value="market" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500 text-xs">
              <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Market Watch</span>
            </TabsTrigger>
            <TabsTrigger value="chart" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-500 text-xs">
              <span className="flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Live Chart</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-500 text-xs">
              <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4" />Performance</span>
            </TabsTrigger>
            <TabsTrigger value="calculator" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500 text-xs">
              <span className="flex items-center gap-1.5"><Target className="h-4 w-4" />Risk Calc</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-500 text-xs">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="news" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-500 text-xs">
              <span className="flex items-center gap-1.5"><Newspaper className="h-4 w-4" />News</span>
            </TabsTrigger>
            <TabsTrigger value="stocks" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500 text-xs">
              <span className="flex items-center gap-1.5"><LineChart className="h-4 w-4" />Stocks</span>
            </TabsTrigger>
            <TabsTrigger value="crypto" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500 text-xs">
              <span className="flex items-center gap-1.5"><Bitcoin className="h-4 w-4" />Crypto</span>
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500 text-xs">
              <span className="flex items-center gap-1.5"><Flame className="h-4 w-4" />Heatmap</span>
            </TabsTrigger>
            <TabsTrigger value="finviz" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-500 text-xs">
              <span className="flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" />Finviz</span>
            </TabsTrigger>
          </TabsList>

          {/* Active Signals */}
          <TabsContent value="active">
            {activeSignals.length === 0 ? (
              <Card className="border-border/20 bg-card/40"><CardContent className="flex flex-col items-center justify-center py-16"><Activity className="mb-4 h-12 w-12 text-muted-foreground/30" /><p className="text-lg font-medium text-muted-foreground">Waiting for signals...</p><p className="mb-2 text-sm text-muted-foreground/60">Technical analysis running on live data (RSI, MACD, EMA, BBands, ATR)</p>{sessionFilter !== "ALL" && <p className="text-xs text-muted-foreground/40">Filtered by {sessionFilter} session</p>}</CardContent></Card>
            ) : (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{activeSignals.map(s => {
              const lp = prices.find(p => p.pair === s.pair)?.bid;
              return <SignalCard key={s.id} signal={s} isNew={s.id === newSignalId} onClick={() => setSelectedSignalId(s.id)} livePrice={lp} />;
            })}</div>)}
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            {completedSignals.length === 0 ? (
              <Card className="border-border/20 bg-card/40"><CardContent className="flex flex-col items-center justify-center py-16"><BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/30" /><p className="text-lg font-medium text-muted-foreground">No signal history yet</p></CardContent></Card>
            ) : (
              <Card className="border-border/30 bg-card/80 backdrop-blur">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Signal Performance History</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-96">
                    <Table>
                      <TableHeader><TableRow className="border-border/30 hover:bg-transparent"><TableHead className="text-xs">ID</TableHead><TableHead className="text-xs">Pair</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs text-right">Entry</TableHead><TableHead className="text-xs text-right">TP</TableHead><TableHead className="text-xs text-right">SL</TableHead><TableHead className="text-xs">Conf</TableHead><TableHead className="text-xs">Session</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs text-right">Pips</TableHead><TableHead className="text-xs">Time</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {completedSignals.map(s => (
                          <TableRow key={s.id} className="border-border/20 cursor-pointer hover:bg-muted/50" onClick={() => setSelectedSignalId(s.id)}>
                            <TableCell className="font-mono text-[10px] text-muted-foreground">{s.id.substring(0, 12)}</TableCell>
                            <TableCell className="text-xs font-bold text-foreground">{s.pair}</TableCell>
                            <TableCell><Badge variant="outline" className={`text-[10px] font-bold ${s.type === "BUY" ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"}`}>{s.type}</Badge></TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatPrice(s.entry, s.pair)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-500">{formatPrice(s.tp, s.pair)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-rose-500">{formatPrice(s.sl, s.pair)}</TableCell>
                            <TableCell className="text-xs">{s.confidence ? <ConfidenceBar confidence={s.confidence} /> : "--"}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[9px] border-border/30 text-muted-foreground">{getSessionAtTime(s.timestamp)}</Badge></TableCell>
                            <TableCell><Badge variant="outline" className={`text-[10px] font-bold ${s.status === "TP_HIT" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-rose-500/30 bg-rose-500/10 text-rose-500"}`}>{s.status === "TP_HIT" ? "TP HIT" : "SL HIT"}</Badge></TableCell>
                            <TableCell className={`text-right font-mono text-xs font-bold ${(s.pips || 0) > 0 ? "text-emerald-500" : "text-rose-500"}`}>{(s.pips || 0) > 0 ? "+" : ""}{s.pips || 0}</TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">{formatTime(s.timestamp)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Market Watch */}
          <TabsContent value="market">
            {filteredPrices.length === 0 ? (
              <Card className="border-border/20 bg-card/40"><CardContent className="flex flex-col items-center justify-center py-16"><TrendingUp className="mb-4 h-12 w-12 text-muted-foreground/30" /><p className="text-lg font-medium text-muted-foreground">Loading market data...</p></CardContent></Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredPrices.map(p => (
                  <Card key={p.pair} className="border-border/30 bg-card/80 backdrop-blur transition-colors hover:border-foreground/20 cursor-pointer" onClick={() => { useForexStore.getState().setSelectedPair(p.pair); useForexStore.getState().setActiveTab("chart"); }}>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-foreground">{p.pair}</h3>
                          <button onClick={(e) => { e.stopPropagation(); useForexStore.getState().toggleFavorite(p.pair); }} className="p-0.5 hover:bg-muted rounded"><Star className={`h-3 w-3 ${useForexStore.getState().isFavorite(p.pair) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} /></button>
                        </div>
                        <span className={`text-xs font-bold ${p.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{p.changePercent >= 0 ? "+" : ""}{p.changePercent.toFixed(3)}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bid</p><p className="font-mono text-sm font-bold text-foreground">{formatPrice(p.bid, p.pair)}</p></div>
                        <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ask</p><p className="font-mono text-sm font-bold text-foreground">{formatPrice(p.ask, p.pair)}</p></div>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-border/20 pt-2">
                        <span className="text-[10px] text-muted-foreground">Spread: {p.spread}</span>
                        {p.changePercent >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-rose-500" />}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Live Chart */}
          <TabsContent value="chart">
            <PriceChart pair={selectedPair} prices={prices} />
          </TabsContent>

          {/* Performance Dashboard */}
          <TabsContent value="performance">
            <PerformanceDashboard signals={signals} />
          </TabsContent>

          {/* Risk Calculator */}
          <TabsContent value="calculator">
            <RiskCalculator />
          </TabsContent>

          {/* Economic Calendar */}
          <TabsContent value="calendar">
            <EconomicCalendar />
          </TabsContent>

          {/* Market News */}
          <TabsContent value="news">
            <MarketNews />
          </TabsContent>

          {/* Stock Prices */}
          <TabsContent value="stocks">
            <StockPrices />
          </TabsContent>

          {/* Crypto Signals */}
          <TabsContent value="crypto">
            <CryptoSignals />
          </TabsContent>

          {/* Currency Strength Heatmap */}
          <TabsContent value="heatmap">
            <CurrencyHeatmap prices={prices} />
          </TabsContent>

          {/* Finviz Market Data */}
          <TabsContent value="finviz">
            <FinvizDashboard />
          </TabsContent>
        </Tabs>
      </main>}

      {/* Footer */}
      <footer className="mt-auto border-t border-border/30 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600"><Activity className="h-4 w-4 text-white" /></div>
            <span className="text-sm font-semibold text-foreground">ForexPro<span className="text-emerald-500">Signals</span></span>
          </div>
          <p className="text-xs text-muted-foreground">Developed with <span className="font-semibold text-emerald-500">nayondev</span> &bull; Real-time Forex Signals &bull; Powered by RapidAPI</p>
          <p className="text-[10px] text-muted-foreground/50">&copy; {new Date().getFullYear()} All rights reserved</p>
        </div>
      </footer>

      {/* Signal Detail Sheet */}
      <SignalDetailSheet signal={selectedSignal} open={!!selectedSignalId} onClose={() => setSelectedSignalId(null)} />
    </div>
  );
}