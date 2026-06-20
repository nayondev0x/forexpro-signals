"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Activity, Target, ShieldAlert, Clock, Zap, BarChart3, Trophy, ArrowUpRight, ArrowDownRight, Signal, Wifi, WifiOff, RefreshCw, Brain, Gauge, Star, ChevronDown, ChevronUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

/* ─Types ─*/
interface ForexSignal {
  id: string; pair: string; type: "BUY" | "SELL"; entry: number; tp: number; sl: number;
  timestamp: string; status: "ACTIVE" | "TP_HIT" | "SL_HIT" | "CLOSED";
  pips?: number; confidence?: number; reasoning?: string[];
  indicators?: Record<string, string | number>; source?: string;
  apiSource?: string; apiKey?: string;
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

/* ─Signal Card ─*/
function SignalCard({ signal, isNew, onClick }: { signal: ForexSignal; isNew?: boolean; onClick?: () => void }) {
  const isBuy = signal.type === "BUY";
  const isActive = signal.status === "ACTIVE";
  const isTP = signal.status === "TP_HIT";
  const { isFavorite, toggleFavorite } = useForexStore();
  const fav = isFavorite(signal.pair);

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
        <div className="mb-2 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/60 p-2"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry</p><p className="font-mono text-sm font-bold text-foreground">{formatPrice(signal.entry, signal.pair)}</p></div>
          <div className="rounded-lg bg-emerald-500/10 p-2"><p className="text-[10px] uppercase tracking-wider text-emerald-500/70">Take Profit</p><p className="font-mono text-sm font-bold text-emerald-500">{formatPrice(signal.tp, signal.pair)}</p></div>
          <div className="rounded-lg bg-rose-500/10 p-2"><p className="text-[10px] uppercase tracking-wider text-rose-500/70">Stop Loss</p><p className="font-mono text-sm font-bold text-rose-500">{formatPrice(signal.sl, signal.pair)}</p></div>
        </div>
        {signal.reasoning && signal.reasoning.length > 0 && (
          <div className="mb-2 rounded-lg bg-background/40 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Analysis</p>
            <div className="flex flex-wrap gap-1">{signal.reasoning.slice(0, 3).map((r, i) => (<span key={i} className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-foreground/70">{r}</span>))}</div>
          </div>
        )}
        <IndicatorsPanel indicators={signal.indicators} />
        <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatTime(signal.timestamp)}</div>
          {!isActive && signal.pips !== undefined ? (
            <Badge variant="outline" className={`text-xs font-bold ${signal.pips > 0 ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"}`}>{signal.pips > 0 ? "+" : ""}{signal.pips} pips</Badge>
          ) : isActive ? (<div className="flex items-center gap-1.5"><PulseDot color="bg-emerald-400" /><span className="text-xs font-medium text-emerald-500">LIVE</span></div>) : null}
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

  const { autoRefresh, notificationsEnabled, soundEnabled, selectedPair, setSelectedSignalId, selectedSignalId, favorites, setActiveTab } = useForexStore();

  // Filter signals by pair and favorites
  const filteredSignals = signals.filter(s => {
    if (selectedPair !== "ALL" && s.pair !== selectedPair) return false;
    if (favorites.length > 0 && !favorites.includes(s.pair)) return false;
    return true;
  });
  const filteredPrices = prices.filter(p => {
    if (selectedPair !== "ALL" && p.pair !== selectedPair) return false;
    if (favorites.length > 0 && !favorites.includes(p.pair)) return false;
    return true;
  });

  const fetchPrices = useCallback(async () => {
    try {
      const r = await fetch("/api/forex/prices");
      const data = await r.json();
      if (data.prices) { setPrices(data.prices); setDataSource(data.liveCount >= 5 ? "live" : "partial"); }
    } catch {}
  }, []);

  const fetchSignals = useCallback(async () => {
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
            // Notification
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
  }, [notificationsEnabled, soundEnabled]);

  const refreshSignals = async () => { setRefreshing(true); await fetchSignals(); await fetchPrices(); setTimeout(() => setRefreshing(false), 500); };

  useEffect(() => {
    const load = async () => { await fetchPrices(); await fetchSignals(); };
    load();
    if (autoRefresh) {
      const pi = setInterval(fetchPrices, 30000);
      const si = setInterval(fetchSignals, 20000);
      pollingRef.current = si;
      return () => { clearInterval(pi); clearInterval(si); };
    }
  }, [fetchPrices, fetchSignals, autoRefresh]);

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
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} />
              <span className="text-xs text-muted-foreground">{connected ? (dataSource === "live" ? "Live" : "Standby") : "Connecting..."}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Price Ticker */}
      {prices.length > 0 && <PriceTickerBar prices={prices} />}

      {/* Controls Bar */}
      <ControlsBar refreshing={refreshing} onRefresh={refreshSignals} signalCount={signals.length} />

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <section className="mb-6"><StatsCards signals={signals} dataSource={dataSource} /></section>
        <Separator className="mb-6 bg-border/30" />

        <Tabs defaultValue="active" className="w-full" onValueChange={v => setActiveTab(v)}>
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
          </TabsList>

          {/* Active Signals */}
          <TabsContent value="active">
            {activeSignals.length === 0 ? (
              <Card className="border-border/20 bg-card/40"><CardContent className="flex flex-col items-center justify-center py-16"><Activity className="mb-4 h-12 w-12 text-muted-foreground/30" /><p className="text-lg font-medium text-muted-foreground">Waiting for signals...</p><p className="mb-4 text-sm text-muted-foreground/60">Technical analysis running on live data (RSI, MACD, EMA, BBands, ATR)</p></CardContent></Card>
            ) : (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{activeSignals.map(s => <SignalCard key={s.id} signal={s} isNew={s.id === newSignalId} onClick={() => setSelectedSignalId(s.id)} />)}</div>)}
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
                      <TableHeader><TableRow className="border-border/30 hover:bg-transparent"><TableHead className="text-xs">ID</TableHead><TableHead className="text-xs">Pair</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs text-right">Entry</TableHead><TableHead className="text-xs text-right">TP</TableHead><TableHead className="text-xs text-right">SL</TableHead><TableHead className="text-xs">Conf</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs text-right">Pips</TableHead><TableHead className="text-xs">Time</TableHead></TableRow></TableHeader>
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
        </Tabs>
      </main>

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