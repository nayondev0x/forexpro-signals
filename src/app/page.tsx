"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Activity,
  BarChart3,
  Trophy,
  Bitcoin,
  Flame,
  LayoutGrid,
  Newspaper,
  LineChart,
  TrendingUp,
  Clock,
  Target,
  Zap,
  CheckCircle2,
  XCircle,
  Timer,
  RefreshCw,
  Coins,
  Activity as ActivityIcon,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForexStore } from "@/stores/forex-store";
import { ErrorBoundary } from "@/components/error-boundary";
import { SiteHeader } from "@/components/forex/site-header";
import { SiteFooter } from "@/components/forex/site-footer";
import { SessionBar } from "@/components/forex/session-bar";
import { PriceTickerBar } from "@/components/forex/price-ticker-bar";
import { StatsCards } from "@/components/forex/stats-cards";
import { SignalCard } from "@/components/forex/signal-card";
import { CurrencyHeatmap } from "@/components/forex/currency-heatmap";
import { ControlsBar } from "@/components/forex/controls-bar";
import { PriceChart } from "@/components/forex/price-chart";
import { RiskCalculator } from "@/components/forex/risk-calculator";
import { EconomicCalendar } from "@/components/forex/economic-calendar";
import { SignalDetailSheet } from "@/components/forex/signal-detail-sheet";
import { PerformanceDashboard } from "@/components/forex/performance-dashboard";
import { MarketNews } from "@/components/forex/market-news";
import { StockPrices } from "@/components/stocks/stock-prices";
import { StockSignals } from "@/components/stocks/stock-signals";
import { CryptoSignals } from "@/components/crypto/crypto-signals";
import { FinvizDashboard } from "@/components/finviz/finviz-dashboard";
import { OffBanner } from "@/components/forex/off-banner";
import { SignalHistory } from "@/components/forex/signal-history";
import { MarketWatch } from "@/components/forex/market-watch";
import { MarketMovers } from "@/components/forex/market-movers-bloomberg";
import { CommodityTicker } from "@/components/forex/commodity-ticker";
import { TradingViewTA } from "@/components/forex/tradingview-ta";
import { TradingViewCryptoScreener } from "@/components/stocks/tradingview-crypto-screener";
import { TradingViewAnalystPanel } from "@/components/stocks/tradingview-analyst";
import {
  SignalCardSkeleton,
  StatsCardSkeleton,
  PriceCardSkeleton,
  ChartSkeleton,
  HeatmapSkeleton,
} from "@/components/forex/loading-skeletons";
import {
  playSignalSound,
  playTPSound,
  playSLSound,
  sendBrowserNotification,
} from "@/components/forex/notification-sound";
import { getSessionAtTime, calcPips, formatPrice } from "@/lib/forex-helpers";
import type { ForexSignal, PriceData } from "@/lib/forex-types";

const SIGNAL_MAX_AGE_MS = 15 * 60 * 1000; // 15 min auto expire (M15 chart)
const SCAN_INTERVAL_MS = 15000; // scan every 15s for new signals
const PRICE_CHECK_INTERVAL_MS = 5000; // check live prices every 5s for TP/SL

export default function Home() {
  const [signals, setSignals] = useState<ForexSignal[]>([]);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [newSignalId, setNewSignalId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("connecting");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nextScanIn, setNextScanIn] = useState(SCAN_INTERVAL_MS / 1000);
  const [scanning, setScanning] = useState(false);

  const {
    autoRefresh,
    tradingMode,
    setTradingMode,
    notificationsEnabled,
    soundEnabled,
    setSelectedSignalId,
    selectedSignalId,
    favorites,
    activeTab,
    setActiveTab,
    sessionFilter,
    signalHistory,
    addSignalResult,
    wins,
    losses,
  } = useForexStore();

  // Ref to track if we're currently resolving expired signals
  const resolvingRef = useRef(false);
  // Track processed signal IDs to avoid double-processing
  const processedRef = useRef<Set<string>>(new Set());

  const fetchPrices = useCallback(async () => {
    if (!tradingMode) return;
    try {
      const r = await fetch("/api/forex/prices");
      const data = await r.json();
      if (data.prices) {
        setPrices(data.prices);
        setDataSource(data.liveCount >= 5 ? "live" : "partial");
        setLoading(false);
      }
    } catch {
      /* silent */
    }
  }, [tradingMode]);

  const fetchSignals = useCallback(async () => {
    if (!tradingMode) return;
    setScanning(true);
    try {
      const r = await fetch("/api/forex/signal");
      const data = await r.json();
      if (data.signals && data.signals.length > 0) {
        setSignals((prev) => {
          // Only keep ACTIVE signals, replace them with fresh ones
          const activeOld = prev.filter((s) => s.status === "ACTIVE");
          const newIds = new Set(data.signals.map((s: ForexSignal) => s.id));

          // Remove old active signals that are being replaced
          const kept = activeOld.filter((s) => !newIds.has(s.id));

          // Check for truly new signals (not seen before)
          const allKnownIds = new Set([...kept.map((s) => s.id), ...processedRef.current]);
          const freshOnes = data.signals.filter(
            (s: ForexSignal) => !allKnownIds.has(s.id)
          );

          if (freshOnes.length > 0) {
            setNewSignalId(freshOnes[0].id);
            setTimeout(() => setNewSignalId(null), 5000);
            if (notificationsEnabled) {
              const sig = freshOnes[0];
              sendBrowserNotification(
                `${sig.pair} ${sig.type}`,
                `Entry: ${sig.entry} | Confidence: ${sig.confidence}%`
              );
            }
            if (soundEnabled) playSignalSound();
          }

          // Track all signal IDs as processed
          data.signals.forEach((s: ForexSignal) => processedRef.current.add(s.id));

          return [...data.signals, ...kept];
        });
      }
    } catch {
      /* silent */
    } finally {
      setScanning(false);
    }
  }, [notificationsEnabled, soundEnabled, tradingMode]);

  // ═══ LIVE TP/SL CHECKER ═══
  // Every 5s, check if any active signal has hit TP or SL
  const checkTPSL = useCallback(() => {
    if (!tradingMode || prices.length === 0) return;
    setSignals((prev) => {
      let changed = false;
      let hitResult: { pair: string; type: string; status: "TP_HIT" | "SL_HIT"; pips: number } | null = null;
      const updated = prev.map((sig) => {
        if (sig.status !== "ACTIVE") return sig;

        const livePriceData = prices.find((p) => p.pair === sig.pair);
        if (!livePriceData) return sig;

        const livePrice = livePriceData.bid || livePriceData.ask;
        if (!livePrice) return sig;

        let result: "TP_HIT" | "SL_HIT" | null = null;

        if (sig.type === "BUY") {
          if (livePrice >= sig.tp) result = "TP_HIT";
          else if (livePrice <= sig.sl) result = "SL_HIT";
        } else {
          if (livePrice <= sig.tp) result = "TP_HIT";
          else if (livePrice >= sig.sl) result = "SL_HIT";
        }

        if (result) {
          changed = true;
          const pips = calcPips(sig.entry, livePrice, sig.type, sig.pair);
          const pipsRounded = Math.round(pips * 10) / 10;
          hitResult = { pair: sig.pair, type: sig.type, status: result, pips: pipsRounded };

          // Save to persistent history
          addSignalResult({
            id: sig.id,
            pair: sig.pair,
            type: sig.type,
            entry: sig.entry,
            tp: sig.tp,
            sl: sig.sl,
            status: result,
            pips: pipsRounded,
            confidence: sig.confidence || 0,
            timestamp: sig.timestamp,
          });

          return { ...sig, status: result, pips: pipsRounded };
        }
        return sig;
      });

      // Play sound + notification on TP/SL hit
      if (hitResult) {
        if (hitResult.status === "TP_HIT") {
          playTPSound();
          sendBrowserNotification(
            `TP HIT! ${hitResult.pair} ${hitResult.type}`,
            `+${hitResult.pips} pips profit!`
          );
        } else {
          playSLSound();
          sendBrowserNotification(
            `SL HIT! ${hitResult.pair} ${hitResult.type}`,
            `${hitResult.pips} pips loss`
          );
        }
      }

      return changed ? updated : prev;
    });
  }, [tradingMode, prices, addSignalResult]);

  // ═══ AUTO-EXPIRE OLD SIGNALS ═══
  // Signals older than 7 min get marked EXPIRED
  const checkExpiry = useCallback(() => {
    if (resolvingRef.current) return;
    const now = Date.now();
    setSignals((prev) => {
      let changed = false;
      const updated = prev.map((sig) => {
        if (sig.status !== "ACTIVE") return sig;
        const age = now - new Date(sig.timestamp).getTime();
        if (age > SIGNAL_MAX_AGE_MS) {
          changed = true;
          // Find last known price for pips calculation
          const livePriceData = prices.find((p) => p.pair === sig.pair);
          const livePrice = livePriceData?.bid || livePriceData?.ask || sig.entry;
          const pips = calcPips(sig.entry, livePrice, sig.type, sig.pair);
          const pipsRounded = Math.round(pips * 10) / 10;

          addSignalResult({
            id: sig.id,
            pair: sig.pair,
            type: sig.type,
            entry: sig.entry,
            tp: sig.tp,
            sl: sig.sl,
            status: "EXPIRED",
            pips: pipsRounded,
            confidence: sig.confidence || 0,
            timestamp: sig.timestamp,
          });

          return { ...sig, status: "EXPIRED" as const, pips: pipsRounded };
        }
        return sig;
      });
      return changed ? updated : prev;
    });
  }, [prices, addSignalResult]);

  // ═══ AUTO-ROTATE: fetch new signals when all active are resolved ═══
  const autoRotate = useCallback(() => {
    const activeCount = signals.filter((s) => s.status === "ACTIVE").length;
    if (activeCount === 0 && tradingMode && !scanning) {
      fetchSignals();
    }
  }, [signals, tradingMode, scanning, fetchSignals]);

  const refreshSignals = async () => {
    if (!tradingMode) return;
    setRefreshing(true);
    await fetchSignals();
    await fetchPrices();
    setTimeout(() => setRefreshing(false), 500);
  };

  // ═══ EFFECTS ═══
  // Initial load
  useEffect(() => {
    if (!tradingMode) return;
    const load = async () => {
      await fetchPrices();
      await fetchSignals();
    };
    load();
  }, [tradingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Price polling + TP/SL check
  useEffect(() => {
    if (!tradingMode) return;
    const pi = setInterval(() => {
      fetchPrices();
      checkTPSL();
    }, PRICE_CHECK_INTERVAL_MS);
    return () => clearInterval(pi);
  }, [fetchPrices, checkTPSL, tradingMode]);

  // Signal scan interval + expiry check
  useEffect(() => {
    if (!tradingMode || !autoRefresh) return;
    const si = setInterval(() => {
      fetchSignals();
      checkExpiry();
    }, SCAN_INTERVAL_MS);
    return () => clearInterval(si);
  }, [fetchSignals, checkExpiry, autoRefresh, tradingMode]);

  // Countdown timer for next scan
  useEffect(() => {
    const timer = setInterval(() => {
      setNextScanIn((prev) => (prev <= 1 ? Math.round(SCAN_INTERVAL_MS / 1000) : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-rotate when all signals resolved
  useEffect(() => {
    autoRotate();
  }, [autoRotate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ DERIVED STATE ═══
  const activeSignals = useMemo(
    () => signals.filter((s) => s.status === "ACTIVE"),
    [signals]
  );
  const completedSignals = useMemo(
    () => signals.filter((s) => s.status !== "ACTIVE"),
    [signals]
  );
  const selectedSignal = signals.find((s) => s.id === selectedSignalId) || null;

  // Merge persistent history with in-session completed signals for display
  const allHistory = useMemo(() => {
    const sessionResults = completedSignals.map((s) => ({
      id: s.id,
      pair: s.pair,
      type: s.type,
      entry: s.entry,
      tp: s.tp,
      sl: s.sl,
      status: s.status as "TP_HIT" | "SL_HIT" | "EXPIRED",
      pips: s.pips || 0,
      confidence: s.confidence || 0,
      timestamp: s.timestamp,
    }));
    // Combine: persistent history (from store) + current session completed
    const sessionIds = new Set(sessionResults.map((s) => s.id));
    const fromStore = signalHistory.filter((s) => !sessionIds.has(s.id));
    return [...sessionResults, ...fromStore];
  }, [completedSignals, signalHistory]);

  // Stats from persistent store
  const totalWins = wins;
  const totalLosses = losses;
  const totalResults = totalWins + totalLosses;
  const winRate = totalResults > 0 ? ((totalWins / totalResults) * 100).toFixed(1) : "--";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader tradingMode={tradingMode} dataSource={dataSource} />

      {prices.length > 0 && <PriceTickerBar prices={prices} />}
      {tradingMode && <SessionBar />}
      <ControlsBar
        refreshing={refreshing}
        onRefresh={refreshSignals}
        signalCount={activeSignals.length}
      />

      {!tradingMode && <OffBanner onActivate={() => setTradingMode(true)} />}

      {tradingMode && (
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          <ErrorBoundary>
            {/* ═══ WIN/LOSS STATS BAR ═══ */}
            <section className="mb-4">
              <Card className="border-border/30 bg-card/80 backdrop-blur">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      <span className="text-sm font-bold text-foreground">
                        Win: <span className="text-emerald-500">{totalWins}</span>
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        Loss: <span className="text-rose-500">{totalLosses}</span>
                      </span>
                    </div>
                    {totalResults > 0 && (
                      <Badge
                        className={`text-xs font-bold ${
                          parseFloat(winRate) >= 60
                            ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-500 border-amber-500/30"
                        }`}
                        variant="outline"
                      >
                        WR: {winRate}%
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {activeSignals.length === 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-500">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Scanning for elite signals...
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-cyan-500">
                        <Zap className="h-3.5 w-3.5" />
                        {activeSignals.length} active signal{activeSignals.length > 1 ? "s" : ""}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" />
                      Next scan: {nextScanIn}s
                    </div>
                    {scanning && (
                      <Badge variant="outline" className="border-cyan-500/30 text-[10px] text-cyan-400">
                        SCANNING 9 PAIRS...
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ═══ STATS CARDS ═══ */}
            <section className="mb-6">
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <StatsCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <StatsCards signals={signals} dataSource={dataSource} />
              )}
            </section>
          </ErrorBoundary>

          <Separator className="mb-6 bg-border/30" />

          <Tabs
            value={activeTab}
            className="w-full"
            onValueChange={(v) => setActiveTab(v)}
          >
            <TabsList className="mb-4 flex-wrap bg-card/80 border border-border/30 h-auto p-1 gap-1">
              <TabsTrigger value="active" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />Signals
                  {activeSignals.length > 0 && (
                    <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[10px] font-bold text-emerald-500">
                      {activeSignals.length}
                    </span>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" />History
                  {totalResults > 0 && (
                    <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500/20 px-1 text-[10px] font-bold text-sky-500">
                      {totalResults}
                    </span>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="market" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />Market
                </span>
              </TabsTrigger>
              <TabsTrigger value="chart" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" />Chart
                </span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" />Stats
                </span>
              </TabsTrigger>
              <TabsTrigger value="calculator" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Target className="h-4 w-4" />Risk
                </span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />Calendar
                </span>
              </TabsTrigger>
              <TabsTrigger value="news" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Newspaper className="h-4 w-4" />News
                </span>
              </TabsTrigger>
              <TabsTrigger value="movers" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <ActivityIcon className="h-4 w-4" />Movers
                </span>
              </TabsTrigger>
              <TabsTrigger value="commodities" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Coins className="h-4 w-4" />Gold/Comm
                </span>
              </TabsTrigger>
              <TabsTrigger value="stocks" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <LineChart className="h-4 w-4" />Stocks
                </span>
              </TabsTrigger>
              <TabsTrigger value="crypto" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Bitcoin className="h-4 w-4" />Crypto
                </span>
              </TabsTrigger>
              <TabsTrigger value="heatmap" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Flame className="h-4 w-4" />Heatmap
                </span>
              </TabsTrigger>
              <TabsTrigger value="finviz" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <LayoutGrid className="h-4 w-4" />Finviz
                </span>
              </TabsTrigger>
              <TabsTrigger value="tv-ta" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Target className="h-4 w-4" />TV Pivots
                </span>
              </TabsTrigger>
              <TabsTrigger value="tv-analyst" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />Analysts
                </span>
              </TabsTrigger>
              <TabsTrigger value="tv-crypto" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-500 text-xs">
                <span className="flex items-center gap-1.5">
                  <Bitcoin className="h-4 w-4" />Crypto Scr
                </span>
              </TabsTrigger>
            </TabsList>

            {/* Active Signals — 2 BIG CARDS */}
            <TabsContent value="active">
              <ErrorBoundary>
                {loading ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <SignalCardSkeleton key={i} />
                    ))}
                  </div>
                ) : activeSignals.length === 0 ? (
                  <Card className="border-border/20 bg-card/40">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      {scanning ? (
                        <>
                          <RefreshCw className="mb-4 h-12 w-12 text-cyan-500/50 animate-spin" />
                          <p className="text-lg font-bold text-cyan-500">
                            Scanning 9 pairs with 28 indicators...
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Only the strongest signals (85%+ confidence, 10+ confluences) will appear
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground/60">
                            Next scan in {nextScanIn}s | Next auto-refresh: {SCAN_INTERVAL_MS / 1000}s
                          </p>
                        </>
                      ) : (
                        <>
                          <Activity className="mb-4 h-12 w-12 text-muted-foreground/30" />
                          <p className="text-lg font-medium text-muted-foreground">
                            No qualifying signals right now
                          </p>
                          <p className="mb-2 text-sm text-muted-foreground/60">
                            Engine requires 85%+ confidence with 10+ indicator confluences
                          </p>
                          <button
                            onClick={refreshSignals}
                            className="mt-2 rounded-lg bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-500 hover:bg-cyan-500/30 transition"
                          >
                            <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" />
                            Force Scan Now
                          </button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {activeSignals.map((s) => {
                      const lp = prices.find((p) => p.pair === s.pair)?.bid;
                      return (
                        <SignalCard
                          key={s.id}
                          signal={s}
                          isNew={s.id === newSignalId}
                          onClick={() => setSelectedSignalId(s.id)}
                          livePrice={lp}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Recently completed — show last 2 below active */}
                {completedSignals.length > 0 && (
                  <div className="mt-6">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Recent Results
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {completedSignals.slice(0, 4).map((s) => (
                        <Card
                          key={s.id}
                          className={`border-border/20 bg-card/40 cursor-pointer hover:border-foreground/20 transition-all ${
                            s.status === "TP_HIT" ? "border-emerald-500/30" : "border-rose-500/30"
                          }`}
                          onClick={() => setSelectedSignalId(s.id)}
                        >
                          <CardContent className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2">
                              {s.status === "TP_HIT" ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-rose-500" />
                              )}
                              <div>
                                <p className="text-xs font-bold text-foreground">{s.pair}</p>
                                <p className="text-[10px] text-muted-foreground">{s.type}</p>
                              </div>
                            </div>
                            <Badge
                              className={`text-xs font-bold ${
                                s.status === "TP_HIT"
                                  ? "bg-emerald-500/20 text-emerald-500"
                                  : s.status === "SL_HIT"
                                    ? "bg-rose-500/20 text-rose-500"
                                    : "bg-amber-500/20 text-amber-500"
                              }`}
                              variant="outline"
                            >
                              {s.status === "TP_HIT"
                                ? `+${s.pips || 0} pips`
                                : s.status === "SL_HIT"
                                  ? `${s.pips || 0} pips`
                                  : "EXPIRED"}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </ErrorBoundary>
            </TabsContent>

            {/* History — with win/loss summary */}
            <TabsContent value="history">
              <ErrorBoundary>
                {/* Win/Loss Summary Bar */}
                {totalResults > 0 && (
                  <Card className="mb-4 border-border/30 bg-card/80">
                    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-black text-emerald-500">{totalWins}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Wins (TP Hit)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black text-rose-500">{totalLosses}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Losses (SL/Expired)</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-2xl font-black ${parseFloat(winRate) >= 60 ? "text-emerald-500" : "text-amber-500"}`}>
                            {winRate}%
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Win Rate</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{totalResults}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Trades</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <SignalHistory
                  signals={allHistory as any}
                  onSelectSignal={setSelectedSignalId}
                  sessionFilter={sessionFilter}
                />
              </ErrorBoundary>
            </TabsContent>

            {/* Market Watch */}
            <TabsContent value="market">
              <ErrorBoundary>
                {loading ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <PriceCardSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <MarketWatch prices={prices} />
                )}
              </ErrorBoundary>
            </TabsContent>

            {/* Live Chart */}
            <TabsContent value="chart">
              <ErrorBoundary>
                {loading ? (
                  <ChartSkeleton />
                ) : (
                  <PriceChart pair={sessionFilter} prices={prices} />
                )}
              </ErrorBoundary>
            </TabsContent>

            {/* Performance Dashboard */}
            <TabsContent value="performance">
              <ErrorBoundary>
                <PerformanceDashboard signals={[...signals, ...signalHistory.map(h => ({ ...h, status: h.status } as ForexSignal))]} />
              </ErrorBoundary>
            </TabsContent>

            {/* Risk Calculator */}
            <TabsContent value="calculator">
              <ErrorBoundary>
                <RiskCalculator />
              </ErrorBoundary>
            </TabsContent>

            {/* Economic Calendar */}
            <TabsContent value="calendar">
              <ErrorBoundary>
                <EconomicCalendar />
              </ErrorBoundary>
            </TabsContent>

            {/* Market News */}
            <TabsContent value="news">
              <ErrorBoundary>
                <MarketNews />
              </ErrorBoundary>
            </TabsContent>

            {/* Market Movers (Bloomberg DOW) */}
            <TabsContent value="movers">
              <ErrorBoundary>
                <MarketMovers />
              </ErrorBoundary>
            </TabsContent>

            {/* Commodities (Gold, Oil, Silver...) */}
            <TabsContent value="commodities">
              <ErrorBoundary>
                <CommodityTicker />
              </ErrorBoundary>
            </TabsContent>

            {/* Stock Prices + 35-Agent Signals */}
            <TabsContent value="stocks">
              <ErrorBoundary>
                <StockSignals />
                <div className="mt-6">
                  <StockPrices />
                </div>
              </ErrorBoundary>
            </TabsContent>

            {/* Crypto Signals */}
            <TabsContent value="crypto">
              <ErrorBoundary>
                <CryptoSignals />
              </ErrorBoundary>
            </TabsContent>

            {/* Currency Strength Heatmap */}
            <TabsContent value="heatmap">
              <ErrorBoundary>
                {loading ? <HeatmapSkeleton /> : <CurrencyHeatmap prices={prices} />}
              </ErrorBoundary>
            </TabsContent>

            {/* Finviz Market Data */}
            <TabsContent value="finviz">
              <ErrorBoundary>
                <FinvizDashboard />
              </ErrorBoundary>
            </TabsContent>

            {/* TradingView Technical Analysis + Pivot Points */}
            <TabsContent value="tv-ta">
              <ErrorBoundary>
                <TradingViewTA />
              </ErrorBoundary>
            </TabsContent>

            {/* TradingView Analyst Recommendations */}
            <TabsContent value="tv-analyst">
              <ErrorBoundary>
                <TradingViewAnalystPanel />
              </ErrorBoundary>
            </TabsContent>

            {/* TradingView Crypto Screener */}
            <TabsContent value="tv-crypto">
              <ErrorBoundary>
                <TradingViewCryptoScreener />
              </ErrorBoundary>
            </TabsContent>
          </Tabs>
        </main>
      )}

      <SiteFooter />

      <SignalDetailSheet
        signal={selectedSignal}
        open={!!selectedSignalId}
        onClose={() => setSelectedSignalId(null)}
      />
    </div>
  );
}