"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  ShieldAlert,
  Clock,
  Zap,
  BarChart3,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  Signal,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Brain,
  Gauge,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

/* ─Types ─*/
interface ForexSignal {
  id: string;
  pair: string;
  type: "BUY" | "SELL";
  entry: number;
  tp: number;
  sl: number;
  timestamp: string;
  status: "ACTIVE" | "TP_HIT" | "SL_HIT" | "CLOSED";
  pips?: number;
  confidence?: number;
  reasoning?: string[];
  indicators?: Record<string, string | number>;
  priceData?: { bid: number; ask: number; high: number; low: number; open: number };
  source?: string;
}

interface PriceData {
  pair: string;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
}

/* ─Helpers ─*/
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function formatPrice(price: number, pair: string) {
  if (pair.includes("XAU")) return price.toFixed(2);
  if (pair.includes("XAG")) return price.toFixed(2);
  if (pair.includes("JPY")) return price.toFixed(2);
  return price.toFixed(4);
}

function getDecimals(pair: string) {
  if (pair.includes("XAU") || pair.includes("XAG") || pair.includes("JPY")) return 2;
  return 4;
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
  const textColor = confidence >= 80 ? "text-emerald-400" : confidence >= 60 ? "text-amber-400" : "text-rose-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-background/60">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${confidence}%` }} />
      </div>
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
            <span className={p.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}>
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
  const totalSignals = signals.length;
  const activeSignals = signals.filter((s) => s.status === "ACTIVE").length;
  const tpHits = signals.filter((s) => s.status === "TP_HIT").length;
  const slHits = signals.filter((s) => s.status === "SL_HIT").length;
  const completed = tpHits + slHits;
  const winRate = completed > 0 ? ((tpHits / completed) * 100).toFixed(1) : "—";
  const totalPips = signals.reduce((acc, s) => acc + (s.pips || 0), 0);
  const realSignals = signals.filter((s) => s.source === "RapidAPI").length;
  const avgConfidence = signals.length > 0
    ? Math.round(signals.reduce((acc, s) => acc + (s.confidence || 0), 0) / signals.length)
    : 0;

  const stats = [
    { label: "Total Signals", value: totalSignals, icon: Signal, color: "text-sky-400" },
    { label: "Active", value: activeSignals, icon: Activity, color: "text-amber-400" },
    { label: "Win Rate", value: `${winRate}%`, icon: Trophy, color: "text-emerald-400" },
    { label: "TP / SL", value: `${tpHits} / ${slHits}`, icon: Target, color: "text-emerald-400" },
    { label: "Total Pips", value: `${totalPips > 0 ? "+" : ""}${totalPips.toFixed(1)}`, icon: BarChart3, color: totalPips >= 0 ? "text-emerald-400" : "text-rose-400" },
    { label: "Avg Confidence", value: `${avgConfidence}%`, icon: Brain, color: "text-violet-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/30 bg-card/80 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <span className="text-xl font-bold text-foreground">{stat.value}</span>
            <span className="text-[10px] text-muted-foreground">{stat.label}</span>
          </CardContent>
        </Card>
      ))}
      {/* Data source indicator */}
      <Card className={`col-span-2 sm:col-span-3 lg:col-span-6 border ${dataSource === "live" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <CardContent className="flex items-center justify-center gap-2 p-2.5">
          {dataSource === "live" ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">LIVE DATA — RapidAPI Connected</span>
              <span className="text-[10px] text-muted-foreground">(Twelve Data + Alpha Vantage)</span>
              <Badge variant="outline" className="ml-2 border-emerald-500/30 text-[10px] text-emerald-400">
                {realSignals} real signals
              </Badge>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">FALLBACK MODE — Using simulated data</span>
              <span className="text-[10px] text-muted-foreground">(API reconnecting...)</span>
            </>
          )}
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
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground/70 transition-colors"
      >
        <span className="flex items-center gap-1">
          <Gauge className="h-3 w-3" />
          Technical Indicators
        </span>
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
function SignalCard({ signal, isNew = false }: { signal: ForexSignal; isNew?: boolean }) {
  const isBuy = signal.type === "BUY";
  const isActive = signal.status === "ACTIVE";
  const isTP = signal.status === "TP_HIT";
  const isSL = signal.status === "SL_HIT";
  const isReal = signal.source === "RapidAPI";

  return (
    <Card
      className={`relative overflow-hidden border transition-all duration-500 ${
        isNew
          ? "border-amber-400/60 shadow-lg shadow-amber-400/10"
          : isActive
          ? "border-border/40 bg-card/80"
          : "border-border/20 bg-card/40 opacity-70"
      } backdrop-blur`}
    >
      {isNew && (
        <div className="absolute top-0 right-0 flex items-center gap-1 rounded-bl-lg bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
          <Zap className="h-3 w-3" /> NEW
        </div>
      )}

      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isActive ? (
              isBuy ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20">
                  <TrendingDown className="h-5 w-5 text-rose-400" />
                </div>
              )
            ) : (
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isTP ? "bg-emerald-500/20" : "bg-rose-500/20"}`}>
                {isTP ? <Target className="h-5 w-5 text-emerald-400" /> : <ShieldAlert className="h-5 w-5 text-rose-400" />}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-foreground">{signal.pair}</h3>
                {isReal && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Wifi className="h-3 w-3 text-emerald-400" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Real API Data</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{signal.id}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              className={`text-xs font-bold ${
                isBuy
                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  : "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
              }`}
              variant="outline"
            >
              {isBuy ? (
                <span className="flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> BUY</span>
              ) : (
                <span className="flex items-center gap-1"><ArrowDownRight className="h-3 w-3" /> SELL</span>
              )}
            </Badge>
            {signal.confidence && <ConfidenceBar confidence={signal.confidence} />}
          </div>
        </div>

        {/* Prices */}
        <div className="mb-2 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/60 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry</p>
            <p className="font-mono text-sm font-bold text-foreground">{formatPrice(signal.entry, signal.pair)}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/70">Take Profit</p>
            <p className="font-mono text-sm font-bold text-emerald-400">{formatPrice(signal.tp, signal.pair)}</p>
          </div>
          <div className="rounded-lg bg-rose-500/10 p-2">
            <p className="text-[10px] uppercase tracking-wider text-rose-400/70">Stop Loss</p>
            <p className="font-mono text-sm font-bold text-rose-400">{formatPrice(signal.sl, signal.pair)}</p>
          </div>
        </div>

        {/* Reasoning */}
        {signal.reasoning && signal.reasoning.length > 0 && (
          <div className="mb-2 rounded-lg bg-background/40 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Analysis</p>
            <div className="flex flex-wrap gap-1">
              {signal.reasoning.slice(0, 3).map((r, i) => (
                <span key={i} className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-foreground/70">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Indicators */}
        <IndicatorsPanel indicators={signal.indicators} />

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTime(signal.timestamp)}
          </div>
          {!isActive && signal.pips !== undefined ? (
            <Badge
              variant="outline"
              className={`text-xs font-bold ${signal.pips > 0 ? "border-emerald-500/30 text-emerald-400" : "border-rose-500/30 text-rose-400"}`}
            >
              {signal.pips > 0 ? "+" : ""}{signal.pips} pips
            </Badge>
          ) : isActive ? (
            <div className="flex items-center gap-1.5">
              <PulseDot color="bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">LIVE</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─Main Page ─*/
export default function Home() {
  const [signals, setSignals] = useState<ForexSignal[]>([]);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [newSignalId, setNewSignalId] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [dataSource, setDataSource] = useState<string>("connecting");
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Poll prices every 30s
  const fetchPrices = useCallback(async () => {
    try {
      const r = await fetch("/api/forex/prices");
      const data = await r.json();
      if (data.prices) { setPrices(data.prices); setDataSource(data.liveCount >= 5 ? "live" : "partial"); }
    } catch {}
  }, []);

  // Poll signals every 20s
  const fetchSignals = useCallback(async () => {
    try {
      const r = await fetch("/api/forex/signal");
      const data = await r.json();
      if (data.signals && data.signals.length > 0) {
        setSignals((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const newOnes = data.signals.filter((s: ForexSignal) => !existingIds.has(s.id));
          if (newOnes.length > 0) {
            setNewSignalId(newOnes[0].id);
            setTimeout(() => setNewSignalId(null), 5000);
          }
          return [...newOnes, ...prev].slice(0, 20);
        });
      }
    } catch {}
  }, []);

  /* Manual refresh */
  const refreshSignals = async () => {
    setRefreshing(true);
    await fetchSignals();
    await fetchPrices();
    setTimeout(() => setRefreshing(false), 500);
  };

  useEffect(() => {
    const load = async () => { await fetchPrices(); await fetchSignals(); };
    load();
    const pi = setInterval(fetchPrices, 30000);
    const si = setInterval(fetchSignals, 20000);
    pollingRef.current = si;
    return () => { clearInterval(pi); clearInterval(si); };
  }, [fetchPrices, fetchSignals]);

  const activeSignals = signals.filter((s) => s.status === "ACTIVE");
  const completedSignals = signals.filter((s) => s.status !== "ACTIVE");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                ForexPro<span className="text-emerald-400">Signals</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refreshSignals}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-card hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Analyze
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-border/40 bg-card/80 px-3 py-1.5 sm:flex">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} />
              <span className="text-xs text-muted-foreground">
                {connected ? (dataSource === "live" ? "Live" : "Standby") : "Connecting..."}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Price Ticker */}
      {prices.length > 0 && <PriceTickerBar prices={prices} />}

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <section className="mb-6">
          <StatsCards signals={signals} dataSource={dataSource} />
        </section>

        <Separator className="mb-6 bg-border/30" />

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-4 bg-card/80 border border-border/30">
            <TabsTrigger value="active" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Activity className="h-4 w-4" />
                Active Signals
                {activeSignals.length > 0 && (
                  <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-400">
                    {activeSignals.length}
                  </span>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">
              <span className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" />
                History
                {completedSignals.length > 0 && (
                  <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500/20 px-1.5 text-[10px] font-bold text-sky-400">
                    {completedSignals.length}
                  </span>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger value="market" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Market Watch
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Active Signals */}
          <TabsContent value="active">
            {activeSignals.length === 0 ? (
              <Card className="border-border/20 bg-card/40">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Activity className="mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-lg font-medium text-muted-foreground">Waiting for signals...</p>
                  <p className="mb-4 text-sm text-muted-foreground/60">
                    Technical analysis running on live data (RSI, MACD, EMA, BBands, ATR)
                  </p>
                  <button
                    onClick={refreshSignals}
                    disabled={refreshing}
                    className="flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    Run Analysis Now
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeSignals.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} isNew={signal.id === newSignalId} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Signal History */}
          <TabsContent value="history">
            {completedSignals.length === 0 ? (
              <Card className="border-border/20 bg-card/40">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-lg font-medium text-muted-foreground">No signal history yet</p>
                  <p className="text-sm text-muted-foreground/60">Completed signals (TP/SL hit) will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/30 bg-card/80 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Signal Performance History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/30 hover:bg-transparent">
                          <TableHead className="text-xs">ID</TableHead>
                          <TableHead className="text-xs">Pair</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs text-right">Entry</TableHead>
                          <TableHead className="text-xs text-right">TP</TableHead>
                          <TableHead className="text-xs text-right">SL</TableHead>
                          <TableHead className="text-xs">Confidence</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right">Pips</TableHead>
                          <TableHead className="text-xs">Time</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {completedSignals.map((signal) => (
                          <TableRow key={signal.id} className="border-border/20">
                            <TableCell className="font-mono text-[10px] text-muted-foreground">{signal.id.substring(0, 12)}</TableCell>
                            <TableCell className="text-xs font-bold text-foreground">{signal.pair}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] font-bold ${signal.type === "BUY" ? "border-emerald-500/30 text-emerald-400" : "border-rose-500/30 text-rose-400"}`}>
                                {signal.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatPrice(signal.entry, signal.pair)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-400">{formatPrice(signal.tp, signal.pair)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-rose-400">{formatPrice(signal.sl, signal.pair)}</TableCell>
                            <TableCell className="text-xs">
                              {signal.confidence ? <ConfidenceBar confidence={signal.confidence} /> : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] font-bold ${signal.status === "TP_HIT" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
                                {signal.status === "TP_HIT" ? "TP HIT" : "SL HIT"}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-mono text-xs font-bold ${(signal.pips || 0) > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {(signal.pips || 0) > 0 ? "+" : ""}{signal.pips || 0} pips
                            </TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">{formatTime(signal.timestamp)}</TableCell>
                            <TableCell>
                              {signal.source === "RapidAPI" ? (
                                <Badge variant="outline" className="border-emerald-500/30 text-[9px] text-emerald-400">LIVE</Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-500/30 text-[9px] text-amber-400">SIM</Badge>
                              )}
                            </TableCell>
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
            {prices.length === 0 ? (
              <Card className="border-border/20 bg-card/40">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-lg font-medium text-muted-foreground">Loading market data...</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {prices.map((p) => (
                  <Card key={p.pair} className="border-border/30 bg-card/80 backdrop-blur transition-colors hover:border-border/60">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground">{p.pair}</h3>
                        <span className={`text-xs font-bold ${p.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {p.changePercent >= 0 ? "+" : ""}{p.changePercent.toFixed(3)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bid</p>
                          <p className="font-mono text-sm font-bold text-foreground">{formatPrice(p.bid, p.pair)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ask</p>
                          <p className="font-mono text-sm font-bold text-foreground">{formatPrice(p.ask, p.pair)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-border/20 pt-2">
                        <span className="text-[10px] text-muted-foreground">Spread: {p.spread}</span>
                        {p.changePercent >= 0 ? (
                          <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-rose-400" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/30 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              ForexPro<span className="text-emerald-400">Signals</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Developed with <span className="font-semibold text-emerald-400">nayondev</span> &bull; Real-time Forex Signals &bull; Powered by RapidAPI
          </p>
          <p className="text-[10px] text-muted-foreground/50">
            &copy; {new Date().getFullYear()} All rights reserved
          </p>
        </div>
      </footer>
    </div>
  );
}