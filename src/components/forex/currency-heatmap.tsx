"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, ArrowRightLeft } from "lucide-react";
import type { PriceData } from "@/lib/forex-types";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];

export function CurrencyHeatmap({ prices }: { prices: PriceData[] }) {
  const strengthMap = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const ccy of CURRENCIES) map[ccy] = { total: 0, count: 0 };
    for (const p of prices) {
      const [base, quote] = p.pair.split("/");
      if (map[base]) {
        map[base].total += p.changePercent;
        map[base].count++;
      }
      if (map[quote]) {
        map[quote].total -= p.changePercent;
        map[quote].count++;
      }
    }
    const result: Record<string, number> = {};
    for (const ccy of CURRENCIES) {
      const m = map[ccy];
      result[ccy] = m.count > 0 ? m.total / m.count : 0;
    }
    return result;
  }, [prices]);

  const matrix = useMemo(() => {
    const grid: Record<string, Record<string, number | null>> = {};
    for (const row of CURRENCIES) {
      grid[row] = {};
      for (const col of CURRENCIES) {
        if (row === col) {
          grid[row][col] = 0;
          continue;
        }
        const direct = prices.find((p) => p.pair === `${row}/${col}`);
        if (direct) {
          grid[row][col] = direct.changePercent;
        } else {
          const inverse = prices.find((p) => p.pair === `${col}/${row}`);
          if (inverse) {
            grid[row][col] = -inverse.changePercent;
          } else {
            grid[row][col] = null;
          }
        }
      }
    }
    return grid;
  }, [prices]);

  const maxAbs = Math.max(
    ...CURRENCIES.map((c) => Math.abs(strengthMap[c])),
    0.01
  );

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
    if (val > 0.03)
      return `bg-emerald-500/${Math.round(norm * 80)}`;
    if (val < -0.03)
      return `bg-rose-500/${Math.round(norm * 80)}`;
    return "bg-muted/20";
  };

  const getLabel = (val: number) => {
    if (val > 0.1) return "BULLISH";
    if (val > 0.03) return "STRONG";
    if (val > -0.03) return "NEUTRAL";
    if (val > -0.1) return "WEAK";
    return "BEARISH";
  };

  const sortedCurrencies = [...CURRENCIES].sort(
    (a, b) => (strengthMap[b] || 0) - (strengthMap[a] || 0)
  );

  return (
    <div className="space-y-4">
      {/* Strength Ranking */}
      <Card className="border-border/30 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-orange-500" />
              Currency Strength Ranking
              <Badge
                variant="outline"
                className="border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-500"
              >
                {prices.length} pairs
              </Badge>
            </CardTitle>
            <Badge
              variant="outline"
              className="border-border/30 text-[10px] text-muted-foreground"
            >
              Sorted by strength
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Real-time relative strength derived from live price changes across
            all pairs
          </p>
        </CardHeader>
        <CardContent>
          {prices.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground/50 text-sm">
              Loading market data...
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-8">
              {sortedCurrencies.map((ccy, idx) => {
                const val = strengthMap[ccy] || 0;
                return (
                  <div
                    key={ccy}
                    className={`rounded-lg p-3 text-center transition-all duration-500 ${getStrengthCell(val)} relative`}
                  >
                    {idx < 3 && (
                      <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-amber-500 text-black rounded-full w-4 h-4 flex items-center justify-center">
                        {idx + 1}
                      </span>
                    )}
                    <div className="text-lg font-black">{ccy}</div>
                    <div className="text-[10px] mt-0.5 opacity-80">
                      {getLabel(val)}
                    </div>
                    <div className="text-xs font-bold mt-1">
                      {val >= 0 ? "+" : ""}
                      {val.toFixed(3)}%
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-black/20">
                      <div
                        className={`h-full rounded-full ${val >= 0 ? "bg-emerald-300" : "bg-rose-300"}`}
                        style={{
                          width: `${Math.min(100, (Math.abs(val) / maxAbs) * 100)}%`,
                        }}
                      />
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
            <p className="text-[10px] text-muted-foreground">
              Row currency vs Column currency — green = row stronger, red = row
              weaker
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-center text-[10px] border-collapse min-w-[500px]">
                <thead>
                  <tr>
                    <th className="p-1 text-muted-foreground text-[9px] font-bold" />
                    {CURRENCIES.map((c) => (
                      <th
                        key={c}
                        className="p-1 font-bold text-foreground/80 min-w-[44px]"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CURRENCIES.map((row) => (
                    <tr key={row}>
                      <td className="p-1 font-bold text-foreground/80 text-right pr-2">
                        {row}
                      </td>
                      {CURRENCIES.map((col) => {
                        if (row === col)
                          return (
                            <td key={col} className="p-0.5">
                              <div className="h-7 w-full rounded bg-muted/10 flex items-center justify-center text-muted-foreground/20">
                                —
                              </div>
                            </td>
                          );
                        const val = matrix[row]?.[col];
                        return (
                          <td key={col} className="p-0.5">
                            <div
                              className={`h-7 w-full rounded flex items-center justify-center font-mono text-[9px] font-semibold transition-all duration-500 ${getMatrixCell(val)} ${
                                val !== null
                                  ? val >= 0
                                    ? "text-emerald-100"
                                    : "text-rose-100"
                                  : "text-muted-foreground/30"
                              }`}
                            >
                              {val !== null
                                ? `${val >= 0 ? "+" : ""}${val.toFixed(3)}%`
                                : "—"}
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