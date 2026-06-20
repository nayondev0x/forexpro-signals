"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Target,
  ShieldAlert,
  Crosshair,
  Clock,
  BarChart3,
  Zap,
  Key,
  Loader2,
} from "lucide-react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import { useTheme } from "next-themes";

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
  source?: string;
  apiSource?: string;
  apiKey?: string;
}

interface HistoryEntry {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  label?: string;
}

interface SignalDetailSheetProps {
  signal: ForexSignal | null;
  open: boolean;
  onClose: () => void;
}

export function SignalDetailSheet({
  signal,
  open,
  onClose,
}: SignalDetailSheetProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [chartData, setChartData] = useState<HistoryEntry[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const calculations = useMemo(() => {
    if (!signal) return null;

    const tpDistance = Math.abs(signal.tp - signal.entry);
    const slDistance = Math.abs(signal.sl - signal.entry);
    const riskReward =
      slDistance > 0 ? parseFloat((tpDistance / slDistance).toFixed(2)) : 0;

    const decimals = signal.entry > 100 ? 2 : signal.entry > 10 ? 3 : 5;
    const pipMultiplier = signal.pair.includes("JPY") ? 100 : 10000;

    const tpPips = parseFloat((tpDistance * pipMultiplier).toFixed(1));
    const slPips = parseFloat((slDistance * pipMultiplier).toFixed(1));

    return { riskReward, decimals, tpPips, slPips };
  }, [signal]);

  // Fetch chart data when signal changes
  useEffect(() => {
    if (!signal || !open) return;
    let cancelled = false;
    setChartLoading(true);
    const [from, to] = signal.pair.split("/");
    fetch(`/api/forex/price-history?pair=${encodeURIComponent(signal.pair)}&interval=5min&outputsize=100`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data.entries) {
          setChartData(data.entries.map((e: any) => ({
            time: e.time, open: e.open, high: e.high, low: e.low, close: e.close,
            label: new Date(e.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
          })));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChartLoading(false); });
    return () => { cancelled = true; };
  }, [signal?.pair, open]);

  if (!signal) {
    return <></>;
  }

  const isBuy = signal.type === "BUY";
  const decimals = calculations?.decimals ?? 5;
  const colorUp = isDark ? "#10b981" : "#059669";
  const colorDown = isDark ? "#f43f5e" : "#e11d48";
  const strokeColor = isBuy ? colorUp : colorDown;

  // Y domain for chart
  const allPrices = chartData.flatMap(d => [d.high, d.low]);
  if (signal.entry) allPrices.push(signal.entry);
  if (signal.tp) allPrices.push(signal.tp);
  if (signal.sl) allPrices.push(signal.sl);
  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const pad = (maxP - minP) * 0.1 || maxP * 0.0005;
  const yDomain: [number, number] = [minP - pad, maxP + pad];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[460px] overflow-y-auto p-0"
      >
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold ${
                isBuy
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
              }`}
            >
              {isBuy ? (
                <ArrowUpCircle className="size-4" />
              ) : (
                <ArrowDownCircle className="size-4" />
              )}
              {signal.type}
            </div>
            <span className="font-semibold text-foreground">{signal.pair}</span>
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground font-mono">
            ID: {signal.id}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                signal.status === "ACTIVE"
                  ? "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400"
                  : signal.status === "TP_HIT"
                    ? "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400"
                    : signal.status === "SL_HIT"
                      ? "border-rose-300 text-rose-600 dark:border-rose-700 dark:text-rose-400"
                      : "border-border text-muted-foreground"
              }
            >
              {signal.status.replace("_", " ")}
            </Badge>
            {signal.pips !== undefined && (
              <Badge
                variant="outline"
                className={
                  signal.pips >= 0
                    ? "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400"
                    : "border-rose-300 text-rose-600 dark:border-rose-700 dark:text-rose-400"
                }
              >
                {signal.pips >= 0 ? "+" : ""}
                {signal.pips} pips
              </Badge>
            )}
          </div>

          <Separator />

          {/* Chart + Details Tabs */}
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="w-full h-9">
              <TabsTrigger value="chart" className="text-xs flex-1">
                <BarChart3 className="mr-1 size-3.5" /> Chart
              </TabsTrigger>
              <TabsTrigger value="details" className="text-xs flex-1">
                <Crosshair className="mr-1 size-3.5" /> Details
              </TabsTrigger>
            </TabsList>

            {/* Chart Tab */}
            <TabsContent value="chart" className="mt-3">
              <div className="h-56 rounded-lg border border-border/30 bg-muted/10 p-2">
                {chartLoading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                    <Loader2 className="mr-2 size-4 animate-spin" /> Loading chart...
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="signalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 9 }}
                        interval={Math.floor(chartData.length / 5)}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={yDomain}
                        tick={{ fontSize: 9 }}
                        stroke="currentColor"
                        className="text-muted-foreground"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v.toFixed(decimals)}
                        width={55}
                      />
                      <RTooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#1a1a2e" : "#fff",
                          border: `1px solid ${isDark ? "#333" : "#e5e7eb"}`,
                          borderRadius: "6px",
                          color: isDark ? "#e5e7eb" : "#111827",
                          fontSize: "10px",
                        }}
                        formatter={(value: number) => [value.toFixed(decimals), "Close"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke="none"
                        fill="url(#signalGrad)"
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="close"
                        stroke={strokeColor}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <ReferenceLine y={signal.entry} stroke={isDark ? "#a3a3a3" : "#737373"} strokeDasharray="6 3" strokeWidth={1} label={{ value: "Entry", position: "insideTopLeft", fill: isDark ? "#a3a3a3" : "#737373", fontSize: 9 }} />
                      <ReferenceLine y={signal.tp} stroke={colorUp} strokeDasharray="4 4" strokeWidth={1} label={{ value: "TP", position: "insideTopRight", fill: colorUp, fontSize: 9, fontWeight: "bold" }} />
                      <ReferenceLine y={signal.sl} stroke={colorDown} strokeDasharray="4 4" strokeWidth={1} label={{ value: "SL", position: "insideBottomRight", fill: colorDown, fontSize: 9, fontWeight: "bold" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                    No chart data available
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="mt-3 space-y-4">
              {/* Entry / TP / SL Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    <Crosshair className="size-3" />
                    Entry
                  </div>
                  <p className="font-mono text-xs font-semibold">
                    {signal.entry.toFixed(decimals)}
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <Target className="size-3" />
                    TP
                  </div>
                  <p className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {signal.tp.toFixed(decimals)}
                  </p>
                </div>

                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="size-3" />
                    SL
                  </div>
                  <p className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {signal.sl.toFixed(decimals)}
                  </p>
                </div>
              </div>

              {/* R:R Ratio */}
              {calculations && (
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <BarChart3 className="size-4" />
                    Risk : Reward
                  </span>
                  <span className="font-mono font-bold text-lg">
                    1 : {calculations.riskReward}
                  </span>
                </div>
              )}

              {/* Pip Distances */}
              {calculations && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-center space-y-1">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">TP Distance</p>
                    <p className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">+{calculations.tpPips} pips</p>
                  </div>
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 text-center space-y-1">
                    <p className="text-[10px] text-rose-600 dark:text-rose-400">SL Distance</p>
                    <p className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">-{calculations.slPips} pips</p>
                  </div>
                </div>
              )}

              {/* Confidence Bar */}
              {signal.confidence !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Zap className="size-4" />
                      Confidence
                    </span>
                    <span className="font-mono font-semibold">{signal.confidence}%</span>
                  </div>
                  <Progress value={signal.confidence} className="h-2" />
                </div>
              )}

              {/* Reasoning */}
              {signal.reasoning && signal.reasoning.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Reasoning</p>
                  <div className="flex flex-wrap gap-1.5">
                    {signal.reasoning.map((r, i) => (
                      <Badge key={i} variant="secondary" className="text-xs font-normal">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Indicators */}
              {signal.indicators && Object.keys(signal.indicators).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Indicators</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(signal.indicators).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 space-y-0.5">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{key}</p>
                        <p className="font-mono text-xs font-medium">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Source Info */}
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {signal.source && (
              <div className="flex items-center gap-2"><Zap className="size-3.5" /><span>Source: {signal.source}</span></div>
            )}
            {signal.apiSource && (
              <div className="flex items-center gap-2"><Zap className="size-3.5" /><span>API: {signal.apiSource}</span></div>
            )}
            {signal.apiKey && (
              <div className="flex items-center gap-2"><Key className="size-3.5" /><span className="font-mono">Key: {signal.apiKey}</span></div>
            )}
            <div className="flex items-center gap-2"><Clock className="size-3.5" /><span>{new Date(signal.timestamp).toLocaleString()}</span></div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}