"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

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

interface PriceChartProps {
  pair: string;
  prices: PriceData[];
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function PriceChart({ pair, prices }: PriceChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const currentPrice = prices.length > 0 ? prices[0].bid : 1.1;
  const changePercent = prices.length > 0 ? prices[0].changePercent : 0;
  const isUp = changePercent >= 0;

  const chartData = useMemo(() => {
    const rand = seededRandom(
      pair.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) +
        Math.floor(currentPrice * 10000)
    );

    const points: { time: string; price: number }[] = [];
    let price = currentPrice;

    for (let i = 0; i < 30; i++) {
      points.push({ time: `${i + 1}m`, price: parseFloat(price.toFixed(5)) });
      const volatility = currentPrice * 0.0003;
      price += (rand() - 0.5) * 2 * volatility;
    }

    return points;
  }, [pair, currentPrice]);

  const colorUp = isDark ? "#10b981" : "#059669";
  const colorDown = isDark ? "#f43f5e" : "#e11d48";
  const strokeColor = isUp ? colorUp : colorDown;
  const fillColor = isUp ? colorUp : colorDown;

  const allPrices = chartData.map((d) => d.price);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.15;
  const yDomain = [Math.floor((minPrice - padding) * 100000) / 100000, Math.ceil((maxPrice + padding) * 100000) / 100000];

  const decimals = currentPrice > 100 ? 2 : currentPrice > 10 ? 3 : 5;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{pair}</CardTitle>
          <div className="flex items-center gap-2">
            {isUp ? (
              <TrendingUp className="size-4 text-emerald-500 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="size-4 text-rose-500 dark:text-rose-400" />
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
              {changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-64 p-0 px-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={fillColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              interval={4}
              stroke="currentColor"
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={yDomain as [number, number]}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v.toFixed(decimals)}
              width={65}
            />
            <ReferenceLine
              y={currentPrice}
              stroke={strokeColor}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={strokeColor}
              strokeWidth={2}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}