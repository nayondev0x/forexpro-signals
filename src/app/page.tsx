"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
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
import { CryptoSignals } from "@/components/crypto/crypto-signals";
import { FinvizDashboard } from "@/components/finviz/finviz-dashboard";
import { OffBanner } from "@/components/forex/off-banner";
import { SignalHistory } from "@/components/forex/signal-history";
import { MarketWatch } from "@/components/forex/market-watch";
import {
  SignalCardSkeleton,
  StatsCardSkeleton,
  PriceCardSkeleton,
  ChartSkeleton,
  HeatmapSkeleton,
} from "@/components/forex/loading-skeletons";
import {
  playSignalSound,
  sendBrowserNotification,
} from "@/components/forex/notification-sound";
import { getSessionAtTime } from "@/lib/forex-helpers";
import type { ForexSignal, PriceData } from "@/lib/forex-types";

export default function Home() {
  const [signals, setSignals] = useState<ForexSignal[]>([]);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [newSignalId, setNewSignalId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("connecting");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    autoRefresh,
    tradingMode,
    setTradingMode,
    notificationsEnabled,
    soundEnabled,
    selectedPair,
    setSelectedSignalId,
    selectedSignalId,
    favorites,
    activeTab,
    setActiveTab,
    sessionFilter,
  } = useForexStore();

  const filteredSignals = useMemo(
    () =>
      signals.filter((s) => {
        if (selectedPair === "__favorites__") {
          if (favorites.length === 0 || !favorites.includes(s.pair))
            return false;
        } else if (selectedPair !== "ALL" && s.pair !== selectedPair)
          return false;
        if (sessionFilter !== "ALL") {
          const signalSession = getSessionAtTime(s.timestamp);
          if (signalSession !== sessionFilter) return false;
        }
        return true;
      }),
    [signals, selectedPair, favorites, sessionFilter]
  );

  const filteredPrices = prices.filter((p) => {
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
        setSignals((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const newOnes = data.signals.filter(
            (s: ForexSignal) => !existingIds.has(s.id)
          );
          if (newOnes.length > 0) {
            setNewSignalId(newOnes[0].id);
            setTimeout(() => setNewSignalId(null), 5000);
            if (notificationsEnabled) {
              const sig = newOnes[0];
              sendBrowserNotification(
                `${sig.pair} ${sig.type}`,
                `Entry: ${sig.entry} | Confidence: ${sig.confidence}%`
              );
            }
            if (soundEnabled) playSignalSound();
          }
          return [...newOnes, ...prev].slice(0, 30);
        });
      }
    } catch {
      /* silent — handled by retry */
    }
  }, [notificationsEnabled, soundEnabled, tradingMode]);

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
      /* silent — handled by retry */
    }
  }, [tradingMode]);

  const refreshSignals = async () => {
    if (!tradingMode) return;
    setRefreshing(true);
    await fetchSignals();
    await fetchPrices();
    setTimeout(() => setRefreshing(false), 500);
  };

  useEffect(() => {
    if (!tradingMode) return;
    const load = async () => {
      await fetchPrices();
      await fetchSignals();
    };
    load();
    if (autoRefresh) {
      const pi = setInterval(fetchPrices, 30000);
      const si = setInterval(fetchSignals, 20000);
      return () => {
        clearInterval(pi);
        clearInterval(si);
      };
    }
  }, [fetchPrices, fetchSignals, autoRefresh, tradingMode]);

  const activeSignals = filteredSignals.filter(
    (s) => s.status === "ACTIVE"
  );
  const completedSignals = filteredSignals.filter(
    (s) => s.status !== "ACTIVE"
  );
  const selectedSignal =
    signals.find((s) => s.id === selectedSignalId) || null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader tradingMode={tradingMode} dataSource={dataSource} />

      {prices.length > 0 && <PriceTickerBar prices={prices} />}
      {tradingMode && <SessionBar />}
      <ControlsBar
        refreshing={refreshing}
        onRefresh={refreshSignals}
        signalCount={signals.length}
      />

      {!tradingMode && <OffBanner onActivate={() => setTradingMode(true)} />}

      {tradingMode && (
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          <ErrorBoundary>
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
                  <Activity className="h-4 w-4" />Active
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
                  {completedSignals.length > 0 && (
                    <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500/20 px-1 text-[10px] font-bold text-sky-500">
                      {completedSignals.length}
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
            </TabsList>

            {/* Active Signals */}
            <TabsContent value="active">
              <ErrorBoundary>
                {loading ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <SignalCardSkeleton key={i} />
                    ))}
                  </div>
                ) : activeSignals.length === 0 ? (
                  <Card className="border-border/20 bg-card/40">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <Activity className="mb-4 h-12 w-12 text-muted-foreground/30" />
                      <p className="text-lg font-medium text-muted-foreground">
                        Waiting for signals...
                      </p>
                      <p className="mb-2 text-sm text-muted-foreground/60">
                        Technical analysis running on live data (RSI, MACD, EMA,
                        BBands, ATR)
                      </p>
                      {sessionFilter !== "ALL" && (
                        <p className="text-xs text-muted-foreground/40">
                          Filtered by {sessionFilter} session
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              </ErrorBoundary>
            </TabsContent>

            {/* History */}
            <TabsContent value="history">
              <ErrorBoundary>
                <SignalHistory
                  signals={completedSignals}
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
                  <MarketWatch prices={filteredPrices} />
                )}
              </ErrorBoundary>
            </TabsContent>

            {/* Live Chart */}
            <TabsContent value="chart">
              <ErrorBoundary>
                {loading ? (
                  <ChartSkeleton />
                ) : (
                  <PriceChart pair={selectedPair} prices={prices} />
                )}
              </ErrorBoundary>
            </TabsContent>

            {/* Performance Dashboard */}
            <TabsContent value="performance">
              <ErrorBoundary>
                <PerformanceDashboard signals={signals} />
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

            {/* Stock Prices */}
            <TabsContent value="stocks">
              <ErrorBoundary>
                <StockPrices />
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