"use client";

import { useMemo } from "react";
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
} from "lucide-react";

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

  if (!signal) {
    return <></>;
  }

  const isBuy = signal.type === "BUY";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[400px] overflow-y-auto p-0"
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

          {/* Entry / TP / SL Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Crosshair className="size-3" />
                Entry
              </div>
              <p className="font-mono text-sm font-semibold">
                {signal.entry.toFixed(calculations?.decimals ?? 5)}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/5 p-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Target className="size-3" />
                Take Profit
              </div>
              <p className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {signal.tp.toFixed(calculations?.decimals ?? 5)}
              </p>
            </div>

            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/5 p-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-xs text-rose-600 dark:text-rose-400">
                <ShieldAlert className="size-3" />
                Stop Loss
              </div>
              <p className="font-mono text-sm font-semibold text-rose-600 dark:text-rose-400">
                {signal.sl.toFixed(calculations?.decimals ?? 5)}
              </p>
            </div>
          </div>

          {/* R:R Ratio */}
          {calculations && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/5 p-3 text-center space-y-1">
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  TP Distance
                </p>
                <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  +{calculations.tpPips} pips
                </p>
              </div>
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/5 p-3 text-center space-y-1">
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  SL Distance
                </p>
                <p className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
                  -{calculations.slPips} pips
                </p>
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
                <span className="font-mono font-semibold">
                  {signal.confidence}%
                </span>
              </div>
              <Progress value={signal.confidence} className="h-2" />
            </div>
          )}

          {/* Reasoning */}
          {signal.reasoning && signal.reasoning.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Reasoning
              </p>
              <div className="flex flex-wrap gap-1.5">
                {signal.reasoning.map((r, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Indicators */}
          {signal.indicators &&
            Object.keys(signal.indicators).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Indicators
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(signal.indicators).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-0.5"
                    >
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {key}
                      </p>
                      <p className="font-mono text-xs font-medium">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <Separator />

          {/* Source Info */}
          <div className="space-y-2 text-xs text-muted-foreground">
            {signal.source && (
              <div className="flex items-center gap-2">
                <Zap className="size-3.5" />
                <span>Source: {signal.source}</span>
              </div>
            )}
            {signal.apiSource && (
              <div className="flex items-center gap-2">
                <Zap className="size-3.5" />
                <span>API: {signal.apiSource}</span>
              </div>
            )}
            {signal.apiKey && (
              <div className="flex items-center gap-2">
                <Key className="size-3.5" />
                <span className="font-mono">Key: {signal.apiKey}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="size-3.5" />
              <span>{new Date(signal.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}