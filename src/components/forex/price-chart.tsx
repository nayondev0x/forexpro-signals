"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  ComposedChart,
  Area,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PriceData {
  pair: string;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
  source?: string;
  key?: string;
}

interface HistoryEntry {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  label?: string;
}

interface PriceChartProps {
  pair: string;
  prices: PriceData[];
  showEntryLevel?: number;
  showTP?: number;
  showSL?: number;
  signalType?: "BUY" | "SELL";
}

export function PriceChart({ pair, prices, showEntryLevel, showTP, showSL, signalType }: PriceChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const currentPrice = prices.length > 0
    ? prices.find(p => p.pair === pair)?.bid || prices[0]?.bid || 1.1
    : history.length > 0 ? history[history.length - 1].close : 1.1;

  const changePercent = prices.length > 0
    ? (prices.find(p => p.pair === pair)?.changePercent || 0)
    : 0;
  const isUp = changePercent >= 0;

  // Fetch real price history
  useEffect(() => {
    if (!pair) return;
    let cancelled = false;
    const fetchHistory = async () => {
      setLoading(true);
      setError(false);
      try {
        const r = await fetch(`/api/forex/price-history?pair=${encodeURIComponent(pair)}&interval=5min&outputsize=100`);
        const data = await r.json();
        if (!cancelled && data.entries && data.entries.length > 0) {
          const formatted: HistoryEntry[] = data.entries.map((e: any) => ({
            time: e.time,
            open: e.open,
            high: e.high,
            low: e.low,
            close: e.close,
            label: new Date(e.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
          }));
          setHistory(formatted);
        } else {
          setHistory([]);
          if (!data.entries) setError(true);
        }
      } catch {
        setHistory([]);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchHistory();
    return () => { cancelled = true; };
  }, [pair]);

  const chartData = useMemo(() => {
    if (history.length === 0) return [];
    return history;
  }, [history]);

  const colorUp = isDark ? "#10b981" : "#059669";
  const colorDown = isDark ? "#f43f5e" : "#e11d48";
  const strokeColor = isUp ? colorUp : colorDown;
  const fillColor = isUp ? colorUp : colorDown;

  // Compute Y domain from real data or current price
  const allPrices = chartData.length > 0
    ? chartData.flatMap(d => [d.high, d.low])
    : [currentPrice];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = chartData.length > 0
    ? (maxPrice - minPrice) * 0.1
    : currentPrice * 0.001;
  const yDomain: [number, number] = [
    Math.floor((minPrice - padding) * 100000) / 100000,
    Math.ceil((maxPrice + padding) * 100000) / 100000,
  ];

  // Include TP/SL in y domain
  if (showTP !== undefined) yDomain[1] = Math.max(yDomain[1], showTP);
  if (showSL !== undefined) yDomain[0] = Math.min(yDomain[0], showSL);

  const decimals = currentPrice > 100 ? 2 : currentPrice > 10 ? 3 : 5;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{pair}</CardTitle>
            <div className="flex items-center gap-2">
              {isUp ? (
                <TrendingUp className="size-4 text-emerald-500" />
              ) : (
                <TrendingDown className="size-4 text-rose-500" />
              )}
              <span className={`font-mono text-sm ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {currentPrice.toFixed(decimals)}
              </span>
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  isUp
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                }`}
              >
                {isUp ? "+" : ""}
                {changePercent.toFixed(3)}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {chartData.length > 0 && (
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">
                {chartData.length} candles
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => {
                setHistory([]);
                setLoading(true);
                fetch(`/api/forex/price-history?pair=${encodeURIComponent(pair)}&interval=5min&outputsize=100`)
                  .then(r => r.json())
                  .then(data => {
                    if (data.entries) {
                      setHistory(data.entries.map((e: any) => ({
                        time: e.time, open: e.open, high: e.high, low: e.low, close: e.close,
                        label: new Date(e.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
                      })));
                    }
                  })
                  .catch(() => setError(true))
                  .finally(() => setLoading(false));
              }}
              disabled={loading}
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 px-2 pb-2">
        <div className="h-72 sm:h-80">
          {loading && chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <Loader2 className="mr-2 size-5 animate-spin" /> Loading chart data...
            </div>
          ) : error && chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No chart data available for {pair}. Try again later.
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a pair to view the chart
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id={`priceGrad-${pair.replace("/", "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={fillColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={fillColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={Math.floor(chartData.length / 8)}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v.toFixed(decimals)}
                  width={65}
                />
                <RTooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
                    border: `1px solid ${isDark ? "#333" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    color: isDark ? "#e5e7eb" : "#111827",
                    fontSize: "11px",
                  }}
                  formatter={(value: number, name: string) => [value.toFixed(decimals), name]}
                  labelFormatter={(label: string) => `Time: ${label}`}
                />
                {/* Price line + area fill */}
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={strokeColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="none"
                  fill={`url(#priceGrad-${pair.replace("/", "")})`}
                  isAnimationActive={false}
                />
                {/* Signal reference lines */}
                {showEntryLevel !== undefined && (
                  <ReferenceLine
                    y={showEntryLevel}
                    stroke={isDark ? "#a3a3a3" : "#737373"}
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{ value: "Entry", position: "left", fill: isDark ? "#a3a3a3" : "#737373", fontSize: 10 }}
                  />
                )}
                {showTP !== undefined && (
                  <ReferenceLine
                    y={showTP}
                    stroke={colorUp}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: "TP", position: "right", fill: colorUp, fontSize: 10, fontWeight: "bold" }}
                  />
                )}
                {showSL !== undefined && (
                  <ReferenceLine
                    y={showSL}
                    stroke={colorDown}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: "SL", position: "right", fill: colorDown, fontSize: 10, fontWeight: "bold" }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}