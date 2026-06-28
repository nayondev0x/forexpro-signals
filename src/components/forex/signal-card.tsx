"use client";

import {
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Clock,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  Wifi,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useForexStore } from "@/stores/forex-store";
import { ConfidenceBar } from "./confidence-bar";
import { IndicatorsPanel } from "./indicators-panel";
import { PulseDot } from "./pulse-dot";
import { CountdownTimer } from "./countdown-timer";
import {
  formatTime,
  formatPrice,
  calcPips,
  getSessionAtTime,
} from "@/lib/forex-helpers";
import type { ForexSignal } from "@/lib/forex-types";

export function SignalCard({
  signal,
  isNew,
  onClick,
  livePrice,
}: {
  signal: ForexSignal;
  isNew?: boolean;
  onClick?: () => void;
  livePrice?: number;
}) {
  const isBuy = signal.type === "BUY";
  const isActive = signal.status === "ACTIVE";
  const isTP = signal.status === "TP_HIT";
  const isSL = signal.status === "SL_HIT";
  const isExpired = signal.status === "EXPIRED";
  const { isFavorite, toggleFavorite } = useForexStore();
  const fav = isFavorite(signal.pair);
  const livePips =
    isActive && livePrice
      ? calcPips(signal.entry, livePrice, signal.type, signal.pair)
      : null;

  const pipsColor =
    livePips === null
      ? ""
      : livePips > 5
        ? "text-emerald-400"
        : livePips > 0
          ? "text-emerald-500"
          : livePips < -5
            ? "text-rose-400"
            : "text-rose-500";

  const pipsBg =
    livePips === null
      ? ""
      : livePips > 5
        ? "bg-emerald-500/15"
        : livePips > 0
          ? "bg-emerald-500/10"
          : livePips < -5
            ? "bg-rose-500/15"
            : "bg-rose-500/10";

  // TP/SL progress for active signals
  const tpProgress = isActive && livePrice && signal.tp && signal.sl
    ? Math.min(100, Math.max(0,
        isBuy
          ? ((livePrice - signal.entry) / (signal.tp - signal.entry)) * 100
          : ((signal.entry - livePrice) / (signal.entry - signal.tp)) * 100
      ))
    : 0;

  const slProgress = isActive && livePrice && signal.tp && signal.sl
    ? Math.min(100, Math.max(0,
        isBuy
          ? ((signal.entry - livePrice) / (signal.entry - signal.sl)) * 100
          : ((livePrice - signal.entry) / (signal.sl - signal.entry)) * 100
      ))
    : 0;

  return (
    <Card
      className={`relative overflow-hidden border transition-all duration-500 cursor-pointer hover:border-foreground/20 ${
        isNew
          ? "border-amber-400/60 shadow-lg shadow-amber-400/10"
          : isActive
            ? "border-border/40 bg-card/80"
            : isTP
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-rose-500/30 bg-card/40 opacity-80"
      } backdrop-blur`}
      onClick={onClick}
    >
      {isNew && (
        <div className="absolute top-0 right-0 flex items-center gap-1 rounded-bl-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-black">
          <Zap className="h-3 w-3" /> NEW SIGNAL
        </div>
      )}

      {/* Result banner for completed signals */}
      {!isActive && (
        <div
          className={`flex items-center justify-center gap-2 py-2 text-sm font-black ${
            isTP
              ? "bg-emerald-500/20 text-emerald-500"
              : isSL
                ? "bg-rose-500/20 text-rose-500"
                : "bg-amber-500/20 text-amber-500"
          }`}
        >
          {isTP ? (
            <>
              <CheckCircle2 className="h-5 w-5" /> TP HIT — +{signal.pips || 0} PIPS
            </>
          ) : isSL ? (
            <>
              <XCircle className="h-5 w-5" /> SL HIT — {signal.pips || 0} PIPS
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5" /> EXPIRED — {signal.pips || 0} PIPS
            </>
          )}
        </div>
      )}

      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isActive ? (
              isBuy ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                  <TrendingUp className="h-6 w-6 text-emerald-500" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30">
                  <TrendingDown className="h-6 w-6 text-rose-500" />
                </div>
              )
            ) : (
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                  isTP
                    ? "bg-emerald-500/20 border-emerald-500/30"
                    : "bg-rose-500/20 border-rose-500/30"
                }`}
              >
                {isTP ? (
                  <Target className="h-6 w-6 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-6 w-6 text-rose-500" />
                )}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-black text-foreground">
                  {signal.pair}
                </h3>
                {signal.source === "RapidAPI" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Wifi className="h-3 w-3 text-emerald-500" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        Real API Data
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">{signal.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(signal.pair);
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <Star
                className={`h-3.5 w-3.5 ${fav ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
              />
            </button>
            <div className="flex flex-col items-end gap-1.5">
              <Badge
                className={`text-sm font-black px-3 py-0.5 ${isBuy ? "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 border-emerald-500/30" : "bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 border-rose-500/30"}`}
                variant="outline"
              >
                {isBuy ? (
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight className="h-4 w-4" /> BUY
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <ArrowDownRight className="h-4 w-4" /> SELL
                  </span>
                )}
              </Badge>
              {signal.confidence && (
                <ConfidenceBar confidence={signal.confidence} />
              )}
            </div>
          </div>
        </div>

        {/* REAL-TIME PIPS COUNTER (active only) */}
        {isActive && livePips !== null && (
          <div
            className={`mb-3 rounded-xl p-3 border transition-all duration-300 ${pipsBg} ${livePips >= 0 ? "border-emerald-500/20" : "border-rose-500/20"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <PulseDot
                  color={
                    livePips >= 0 ? "bg-emerald-400" : "bg-rose-400"
                  }
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Live P&L
                </span>
              </div>
              <span
                className={`text-2xl font-black tabular-nums ${pipsColor}`}
              >
                {livePips >= 0 ? "+" : ""}
                {livePips.toFixed(1)}
                <span className="text-xs font-bold ml-0.5">pips</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
              <span>
                Current:{" "}
                <span className="font-mono font-bold text-foreground/80">
                  {formatPrice(livePrice!, signal.pair)}
                </span>
              </span>
              <span className="flex items-center gap-1">
                {livePips >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-rose-500" />
                )}
                <span className={`font-bold ${pipsColor}`}>
                  {livePips >= 0 ? "+" : ""}
                  {livePips.toFixed(1)} pips
                </span>
              </span>
            </div>

            {/* TP/SL Progress bars */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-emerald-500 w-6">TP</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(tpProgress, 100)}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">
                  {tpProgress.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-rose-500 w-6">SL</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(slProgress, 100)}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">
                  {slProgress.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Countdown Timer (15 min = 900s) */}
            <CountdownTimer
              signalTimestamp={signal.timestamp}
              durationSec={900}
            />
          </div>
        )}

        <div className="mb-2 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/60 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Entry
            </p>
            <p className="font-mono text-sm font-bold text-foreground">
              {formatPrice(signal.entry, signal.pair)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-500/70">
              TP{" "}
              <span className="text-[8px] text-emerald-500/40">
                ({signal.tpPips ? formatPrice(signal.tpPips, signal.pair) : "--"})
              </span>
            </p>
            <p className="font-mono text-sm font-bold text-emerald-500">
              {formatPrice(signal.tp, signal.pair)}
            </p>
          </div>
          <div className="rounded-lg bg-rose-500/10 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-rose-500/70">
              SL{" "}
              <span className="text-[8px] text-rose-500/40">
                ({signal.slPips ? formatPrice(signal.slPips, signal.pair) : "--"})
              </span>
            </p>
            <p className="font-mono text-sm font-bold text-rose-500">
              {formatPrice(signal.sl, signal.pair)}
            </p>
          </div>
        </div>

        {signal.reasoning && signal.reasoning.length > 0 && (
          <div className="mb-2 rounded-lg bg-background/40 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Key Confluences
            </p>
            <div className="flex flex-wrap gap-1">
              {signal.reasoning.slice(0, 4).map((r, i) => (
                <span
                  key={i}
                  className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-foreground/70"
                >
                  {r}
                </span>
              ))}
              {signal.reasoning.length > 4 && (
                <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-400">
                  +{signal.reasoning.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        <IndicatorsPanel indicators={signal.indicators} />

        <div className="mt-3 flex items-center justify-between border-t border-border/20 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(signal.timestamp)}
            </div>
            <Badge
              variant="outline"
              className="border-border/30 bg-muted/30 text-[9px] text-muted-foreground"
            >
              {getSessionAtTime(signal.timestamp)}
            </Badge>
            <Badge
              variant="outline"
              className="border-violet-500/30 bg-violet-500/10 text-[9px] font-bold text-violet-400"
            >
              v4.0
            </Badge>
          </div>
          {isActive && livePips === null ? (
            <div className="flex items-center gap-1.5">
              <PulseDot color="bg-emerald-400" />
              <span className="text-xs font-bold text-emerald-500">LIVE</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}