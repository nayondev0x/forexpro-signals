"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { BarChart3 } from "lucide-react";

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

interface PerformanceDashboardProps {
  signals: ForexSignal[];
}

export function PerformanceDashboard({ signals }: PerformanceDashboardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const completedSignals = useMemo(
    () => signals.filter((s) => s.status === "TP_HIT" || s.status === "SL_HIT"),
    [signals]
  );

  const stats = useMemo(() => {
    if (completedSignals.length === 0) {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgPips: 0,
        bestTrade: 0,
        worstTrade: 0,
        profitFactor: 0,
      };
    }

    const wins = completedSignals.filter((s) => s.status === "TP_HIT").length;
    const losses = completedSignals.length - wins;
    const winRate = parseFloat(((wins / completedSignals.length) * 100).toFixed(1));

    const pipsArray = completedSignals.map((s) => s.pips ?? 0);
    const totalPips = pipsArray.reduce((a, b) => a + b, 0);
    const avgPips = parseFloat((totalPips / completedSignals.length).toFixed(1));
    const bestTrade = Math.max(...pipsArray);
    const worstTrade = Math.min(...pipsArray);

    const grossProfit = completedSignals
      .filter((s) => s.status === "TP_HIT")
      .reduce((sum, s) => sum + (s.pips ?? 0), 0);
    const grossLoss = Math.abs(
      completedSignals
        .filter((s) => s.status === "SL_HIT")
        .reduce((sum, s) => sum + (s.pips ?? 0), 0)
    );
    const profitFactor =
      grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 999 : 0;

    return {
      totalTrades: completedSignals.length,
      wins,
      losses,
      winRate,
      avgPips,
      bestTrade,
      worstTrade,
      profitFactor,
    };
  }, [completedSignals]);

  const pieData = useMemo(() => {
    if (completedSignals.length === 0) return [];
    return [
      { name: "Wins", value: stats.wins, color: isDark ? "#10b981" : "#059669" },
      { name: "Losses", value: stats.losses, color: isDark ? "#f43f5e" : "#e11d48" },
    ];
  }, [completedSignals.length, stats.wins, stats.losses, isDark]);

  const cumulativeData = useMemo(() => {
    if (completedSignals.length === 0) return [];
    let cumulative = 0;
    return completedSignals.map((s, idx) => {
      cumulative += s.pips ?? 0;
      return {
        index: idx + 1,
        pips: parseFloat(cumulative.toFixed(1)),
      };
    });
  }, [completedSignals]);

  const hasCharts = completedSignals.length >= 2;

  const statCards = [
    { label: "Total Trades", value: stats.totalTrades.toString() },
    {
      label: "Win Rate",
      value: stats.totalTrades > 0 ? `${stats.winRate}%` : "—",
    },
    { label: "Avg Pips/Trade", value: stats.avgPips.toString() },
    {
      label: "Best Trade",
      value: stats.bestTrade > 0 ? `+${stats.bestTrade}` : stats.bestTrade.toString(),
      positive: stats.bestTrade > 0,
    },
    {
      label: "Worst Trade",
      value: stats.worstTrade < 0 ? stats.worstTrade.toString() : stats.worstTrade.toString(),
      negative: stats.worstTrade < 0,
    },
    {
      label: "Profit Factor",
      value: stats.profitFactor === 999 ? "∞" : stats.profitFactor.toString(),
    },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="size-5 text-primary" />
          Performance Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {completedSignals.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No completed trades yet
          </div>
        ) : (
          <>
            {/* Charts */}
            {hasCharts && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Win/Loss Pie Chart */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Win / Loss Distribution
                  </p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }: { name: string; percent: number }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
                            border: `1px solid ${isDark ? "#333" : "#e5e7eb"}`,
                            borderRadius: "8px",
                            color: isDark ? "#e5e7eb" : "#111827",
                            fontSize: "12px",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cumulative Pips Line Chart */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Cumulative Pips
                  </p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cumulativeData}>
                        <XAxis
                          dataKey="index"
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          className="text-muted-foreground"
                          axisLine={false}
                          tickLine={false}
                          label={{
                            value: "Trade #",
                            position: "insideBottom",
                            offset: -2,
                            fontSize: 10,
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          className="text-muted-foreground"
                          axisLine={false}
                          tickLine={false}
                          width={45}
                          label={{
                            value: "Pips",
                            angle: -90,
                            position: "insideLeft",
                            offset: 10,
                            fontSize: 10,
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#1a1a2e" : "#ffffff",
                            border: `1px solid ${isDark ? "#333" : "#e5e7eb"}`,
                            borderRadius: "8px",
                            color: isDark ? "#e5e7eb" : "#111827",
                            fontSize: "12px",
                          }}
                          formatter={(value: number) => [`${value} pips`, "Cumulative"]}
                          labelFormatter={(label: string) => `Trade #${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="pips"
                          stroke={
                            (cumulativeData[cumulativeData.length - 1]?.pips ?? 0) >= 0
                              ? isDark
                                ? "#10b981"
                                : "#059669"
                              : isDark
                                ? "#f43f5e"
                                : "#e11d48"
                          }
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {statCards.map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center space-y-1"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {s.label}
                  </p>
                  <p
                    className={`font-mono text-sm font-bold ${
                      "positive" in s && s.positive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "negative" in s && s.negative
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-foreground"
                    }`}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}