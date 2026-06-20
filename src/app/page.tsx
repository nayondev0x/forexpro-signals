"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
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

/* ─── Types ─── */
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
}

interface PriceData {
  pair: string;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
}

/* ─── Helpers ─── */
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
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

/* ─── Pulse Dot ─── */
function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${color}`}
      />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}

/* ─── Price Ticker Bar ─── */
function PriceTickerBar({ prices }: { prices: PriceData[] }) {
  return (
    <div className="w-full overflow-hidden border-b border-border/40 bg-card/60 backdrop-blur">
      <div className="flex animate-scroll items-center gap-6 px-4 py-2">
        {[...prices, ...prices].map((p, i) => (
          <div key={`${p.pair}-${i}`} className="flex shrink-0 items-center gap-2 text-xs">
            <span className="font-semibold text-foreground/90">{p.pair}</span>
            <span className="font-mono text-foreground/80">{formatPrice(p.bid, p.pair)}</span>
            <span
              className={`font-mono ${
                p.change >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {p.change >= 0 ? "+" : ""}
              {p.changePercent.toFixed(3)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Stats Cards ─── */
function StatsCards({ signals }: { signals: ForexSignal[] }) {
  const totalSignals = signals.length;
  const activeSignals = signals.filter((s) => s.status === "ACTIVE").length;
  const tpHits = signals.filter((s) => s.status === "TP_HIT").length;
  const slHits = signals.filter((s) => s.status === "SL_HIT").length;
  const completed = tpHits + slHits;
  const winRate = completed > 0 ? ((tpHits / completed) * 100).toFixed(1) : "—";
  const totalPips = signals.reduce((acc, s) => acc + (s.pips || 0), 0);

  const stats = [
    { label: "Total Signals", value: totalSignals, icon: Signal, color: "text-sky-400" },
    { label: "Active Signals", value: activeSignals, icon: Activity, color: "text-amber-400" },
    { label: "Win Rate", value: `${winRate}%`, icon: Trophy, color: "text-emerald-400" },
    { label: "TP Hits", value: tpHits, icon: Target, color: "text-emerald-400" },
    { label: "SL Hits", value: slHits, icon: ShieldAlert, color: "text-rose-400" },
    { label: "Total Pips", value: `${totalPips > 0 ? "+" : ""}${totalPips.toFixed(1)}`, icon: BarChart3, color: totalPips >= 0 ? "text-emerald-400" : "text-rose-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/30 bg-card/80 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
            <span className="text-2xl font-bold text-foreground">{stat.value}</span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Signal Card ─── */
function SignalCard({ signal, isNew = false }: { signal: ForexSignal; isNew?: boolean }) {
  const isBuy = signal.type === "BUY";
  const isActive = signal.status === "ACTIVE";
  const isTP = signal.status === "TP_HIT";
  const isSL = signal.status === "SL_HIT";

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
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  isTP ? "bg-emerald-500/20" : "bg-rose-500/20"
                }`}
              >
                {isTP ? (
                  <Target className="h-5 w-5 text-emerald-400" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-rose-400" />
                )}
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-foreground">{signal.pair}</h3>
              <p className="text-xs text-muted-foreground">{signal.id}</p>
            </div>
          </div>
          <Badge
            className={`text-xs font-bold ${
              isBuy
                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                : "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
            }`}
            variant="outline"
          >
            {isBuy ? (
              <span className="flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> BUY
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <ArrowDownRight className="h-3 w-3" /> SELL
              </span>
            )}
          </Badge>
        </div>

        {/* Prices */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/60 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Entry
            </p>
            <p className="font-mono text-sm font-bold text-foreground">
              {formatPrice(signal.entry, signal.pair)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/70">
              Take Profit
            </p>
            <p className="font-mono text-sm font-bold text-emerald-400">
              {formatPrice(signal.tp, signal.pair)}
            </p>
          </div>
          <div className="rounded-lg bg-rose-500/10 p-2">
            <p className="text-[10px] uppercase tracking-wider text-rose-400/70">
              Stop Loss
            </p>
            <p className="font-mono text-sm font-bold text-rose-400">
              {formatPrice(signal.sl, signal.pair)}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTime(signal.timestamp)}
          </div>
          {!isActive && signal.pips !== undefined && (
            <Badge
              variant="outline"
              className={`text-xs font-bold ${
                signal.pips > 0
                  ? "border-emerald-500/30 text-emerald-400"
                  : "border-rose-500/30 text-rose-400"
              }`}
            >
              {signal.pips > 0 ? "+" : ""}
              {signal.pips} pips
            </Badge>
          )}
          {isActive && (
            <div className="flex items-center gap-1.5">
              <PulseDot color="bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">LIVE</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─── */
export default function Home() {
  const [signals, setSignals] = useState<ForexSignal[]>([]);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [newSignalId, setNewSignalId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("Connected to signal service");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from signal service");
      setConnected(false);
    });

    socket.on("signals", (data: ForexSignal[]) => {
      setSignals(data);
    });

    socket.on("new_signal", (signal: ForexSignal) => {
      setSignals((prev) => [signal, ...prev]);
      setNewSignalId(signal.id);
      setTimeout(() => setNewSignalId(null), 5000);
    });

    socket.on("signal_update", (updated: ForexSignal) => {
      setSignals((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
    });

    socket.on("prices", (data: PriceData[]) => {
      setPrices(data);
    });

    socket.on("price_updates", (updates: PriceData[]) => {
      setPrices((prev) => {
        const map = new Map(prev.map((p) => [p.pair, p]));
        updates.forEach((u) => map.set(u.pair, u));
        return Array.from(map.values());
      });
    });

    socketRef.current = socket;
  }, []);

  useEffect(() => {
    // Fetch initial data from API
    fetch("/api/signals")
      .then((r) => r.json())
      .then((data: ForexSignal[]) => setSignals(data))
      .catch(console.error);

    fetch("/api/prices")
      .then((r) => r.json())
      .then((data: PriceData[]) => setPrices(data))
      .catch(console.error);

    connectSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, [connectSocket]);

  const activeSignals = signals.filter((s) => s.status === "ACTIVE");
  const completedSignals = signals.filter((s) => s.status !== "ACTIVE");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ─── Header ─── */}
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

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs border border-border/40">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} />
                <span className="text-muted-foreground">
                  {connected ? "Live Connected" : "Reconnecting..."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Price Ticker ─── */}
      {prices.length > 0 && <PriceTickerBar prices={prices} />}

      {/* ─── Main Content ─── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {/* Stats */}
        <section className="mb-6">
          <StatsCards signals={signals} />
        </section>

        <Separator className="mb-6 bg-border/30" />

        {/* Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-4 bg-card/80 backdrop-blur border border-border/30">
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
                Signal History
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

          {/* Active Signals Tab */}
          <TabsContent value="active">
            {activeSignals.length === 0 ? (
              <Card className="border-border/20 bg-card/40">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Activity className="mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-lg font-medium text-muted-foreground">No active signals</p>
                  <p className="text-sm text-muted-foreground/60">New signals appear here in real-time</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeSignals.map((signal) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    isNew={signal.id === newSignalId}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            {completedSignals.length === 0 ? (
              <Card className="border-border/20 bg-card/40">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/30" />
                  <p className="text-lg font-medium text-muted-foreground">No signal history</p>
                  <p className="text-sm text-muted-foreground/60">Completed signals will appear here</p>
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
                          <TableHead className="text-xs">Signal ID</TableHead>
                          <TableHead className="text-xs">Pair</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs text-right">Entry</TableHead>
                          <TableHead className="text-xs text-right">TP</TableHead>
                          <TableHead className="text-xs text-right">SL</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right">Pips</TableHead>
                          <TableHead className="text-xs">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {completedSignals.map((signal) => (
                          <TableRow key={signal.id} className="border-border/20">
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {signal.id}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-foreground">
                              {signal.pair}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold ${
                                  signal.type === "BUY"
                                    ? "border-emerald-500/30 text-emerald-400"
                                    : "border-rose-500/30 text-rose-400"
                                }`}
                              >
                                {signal.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatPrice(signal.entry, signal.pair)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-400">
                              {formatPrice(signal.tp, signal.pair)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-rose-400">
                              {formatPrice(signal.sl, signal.pair)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold ${
                                  signal.status === "TP_HIT"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                    : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                                }`}
                              >
                                {signal.status === "TP_HIT" ? "TP HIT" : "SL HIT"}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-xs font-bold ${
                                (signal.pips || 0) > 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {(signal.pips || 0) > 0 ? "+" : ""}
                              {signal.pips || 0} pips
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatTime(signal.timestamp)}
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

          {/* Market Watch Tab */}
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
                  <Card
                    key={p.pair}
                    className="border-border/30 bg-card/80 backdrop-blur transition-colors hover:border-border/60"
                  >
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground">{p.pair}</h3>
                        <span
                          className={`text-xs font-bold ${
                            p.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {p.changePercent >= 0 ? "+" : ""}
                          {p.changePercent.toFixed(3)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Bid
                          </p>
                          <p className="font-mono text-sm font-bold text-foreground">
                            {formatPrice(p.bid, p.pair)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Ask
                          </p>
                          <p className="font-mono text-sm font-bold text-foreground">
                            {formatPrice(p.ask, p.pair)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-border/20 pt-2">
                        <span className="text-[10px] text-muted-foreground">
                          Spread: {p.spread}
                        </span>
                        {p.change >= 0 ? (
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

      {/* ─── Footer ─── */}
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
            Developed with{" "}
            <span className="font-semibold text-emerald-400">nayondev</span> &bull; Real-time Forex Trading Signals
          </p>
          <p className="text-[10px] text-muted-foreground/50">
            &copy; {new Date().getFullYear()} All rights reserved
          </p>
        </div>
      </footer>
    </div>
  );
}