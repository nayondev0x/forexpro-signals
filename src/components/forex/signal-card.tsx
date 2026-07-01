"use client";

import {
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
import { MiniChart } from "./mini-chart";
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
      className={`relative overflow-hidden border-2 transition-all duration-500 cursor-pointer ${
        isNew
          ? "border-amber-400/70 shadow-2xl shadow-amber-400/15"
          : isActive
            ? isBuy
              ? "border-emerald-500/40 bg-card/90 shadow-lg shadow-emerald-500/5"
              : "border-rose-500/40 bg-card/90 shadow-lg shadow-rose-500/5"
            : isTP
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-rose-500/30 bg-card/40 opacity-80"
      } backdrop-blur`}
      onClick={onClick}
    >
      {isNew && (
        <div className="absolute top-0 right-0 flex items-center gap-1 rounded-bl-xl bg-amber-500 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black text-black z-20">
          <Zap className="h-3 w-3" /> NEW SIGNAL
        </div>
      )}

      {/* Result banner for completed signals */}
      {!isActive && (
        <div
          className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 text-sm sm:text-base font-black ${
            isTP
              ? "bg-emerald-500/20 text-emerald-500"
              : isSL
                ? "bg-rose-500/20 text-rose-500"
                : "bg-amber-500/20 text-amber-500"
          }`}
        >
          {isTP ? (
            <>
              <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" /> TP HIT — +{signal.pips || 0} PIPS
            </>
          ) : isSL ? (
            <>
              <XCircle className="h-5 w-5 sm:h-6 sm:w-6" /> SL HIT — {signal.pips || 0} PIPS
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" /> EXPIRED — {signal.pips || 0} PIPS
            </>
          )}
        </div>
      )}

      <CardContent className="p-3 sm:p-5">
        {/* ═══ TOP ROW: PAIR + BUY/SELL ═══ */}
        {/* Mobile: stacked — pair top, BUY/SELL centered below */}
        {/* Desktop: side by side */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
          {/* Pair info */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  {signal.pair}
                </h3>
                {signal.source && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Wifi className="h-3 w-3 text-emerald-500" />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-48">
                        <p className="font-bold">{signal.source}</p>
                        {signal.layers?.length > 0 && signal.layers.map((l: any, i: number) => (
                          <p key={i} className="text-muted-foreground">{l.layer}: {l.score > 0 ? '+' : ''}{l.score}</p>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground font-mono mt-0.5">{signal.id}</p>
            </div>
            {/* Mobile: star + confidence inline */}
            <div className="flex items-center gap-2 sm:hidden">
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavorite(signal.pair); }}
                className="p-1 hover:bg-muted rounded"
              >
                <Star className={`h-3.5 w-3.5 ${fav ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50"}`} />
              </button>
              {signal.confidence && <ConfidenceBar confidence={signal.confidence} />}
            </div>
          </div>

          {/* ═══ BIG BUY / SELL BADGE ═══ */}
          {/* Mobile: centered, Desktop: right-aligned */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop: star + confidence */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite(signal.pair); }}
              className="hidden sm:block p-1.5 hover:bg-muted rounded-lg transition"
            >
              <Star className={`h-4 w-4 ${fav ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50"}`} />
            </button>

            {isActive ? (
              <div
                className={`flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl px-3.5 sm:px-5 py-2 sm:py-2.5 border-2 mx-auto sm:mx-0 ${
                  isBuy
                    ? "bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                    : "bg-rose-500/15 border-rose-500/50 shadow-lg shadow-rose-500/10"
                }`}
              >
                {isBuy ? (
                  <ArrowUpRight className="h-5 w-5 sm:h-7 sm:w-7 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 sm:h-7 sm:w-7 text-rose-500" />
                )}
                <span
                  className={`text-2xl sm:text-3xl font-black tracking-tight ${
                    isBuy ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {signal.type}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl px-3.5 sm:px-5 py-2 sm:py-2.5 border-2 border-border/30 mx-auto sm:mx-0">
                {isTP ? (
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-rose-500" />
                )}
                <span
                  className={`text-lg sm:text-2xl font-black ${
                    isTP ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {isTP ? "TP HIT" : isSL ? "SL HIT" : "EXPIRED"}
                </span>
              </div>
            )}

            {/* Desktop: confidence bar */}
            {signal.confidence && (
              <div className="hidden sm:block">
                <ConfidenceBar confidence={signal.confidence} />
              </div>
            )}
          </div>
        </div>

        {/* ═══ 15MIN LIVE CHART — only for active signals ═══ */}
        {isActive && (
          <div className="mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <div className="flex items-center gap-1.5">
                <PulseDot color="bg-emerald-400" />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                  15min Live Chart
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:inline">
                — Signal generated at {formatTime(signal.timestamp)}
              </span>
            </div>
            <MiniChart pair={signal.pair} height={180} />
            {/* Show time on mobile below chart */}
            <p className="text-[9px] text-muted-foreground mt-1 sm:hidden">
              Signal at {formatTime(signal.timestamp)}
            </p>
          </div>
        )}

        {/* ═══ REAL-TIME PIPS COUNTER (active only) ═══ */}
        {isActive && livePips !== null && (
          <div
            className={`mb-3 sm:mb-4 rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 transition-all duration-300 ${pipsBg} ${livePips >= 0 ? "border-emerald-500/25" : "border-rose-500/25"}`}
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <PulseDot color={livePips >= 0 ? "bg-emerald-400" : "bg-rose-400"} />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Live P&L
                </span>
              </div>
              <span
                className={`text-2xl sm:text-3xl font-black tabular-nums ${pipsColor}`}
              >
                {livePips >= 0 ? "+" : ""}
                {livePips.toFixed(1)}
                <span className="text-xs sm:text-sm font-bold ml-0.5 sm:ml-1">pips</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">
              <span>
                Current:{" "}
                <span className="font-mono font-bold text-foreground/90">
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
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <span className="text-[9px] sm:text-[10px] font-black text-emerald-500 w-6 sm:w-7">TP</span>
                <div className="flex-1 h-1.5 sm:h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(tpProgress, 100)}%` }}
                  />
                </div>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-muted-foreground w-8 sm:w-10 text-right">
                  {tpProgress.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <span className="text-[9px] sm:text-[10px] font-black text-rose-500 w-6 sm:w-7">SL</span>
                <div className="flex-1 h-1.5 sm:h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(slProgress, 100)}%` }}
                  />
                </div>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-muted-foreground w-8 sm:w-10 text-right">
                  {slProgress.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Countdown Timer (10 min = 600s) */}
            <CountdownTimer
              signalTimestamp={signal.timestamp}
              durationSec={600}
            />
          </div>
        )}

        {/* ═══ ENTRY / TP / SL GRID ═══ */}
        <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg sm:rounded-xl bg-background/60 p-2 sm:p-3 border border-border/10">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5 sm:mb-1">
              Entry
            </p>
            <p className="font-mono text-sm sm:text-base font-bold text-foreground">
              {formatPrice(signal.entry, signal.pair)}
            </p>
          </div>
          <div className="rounded-lg sm:rounded-xl bg-emerald-500/10 p-2 sm:p-3 border border-emerald-500/15">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-emerald-500/70 mb-0.5 sm:mb-1">
              TP{" "}
              <span className="text-[8px] sm:text-[9px] text-emerald-500/40">
                (+{signal.tpPips ? formatPrice(signal.tpPips, signal.pair) : "--"})
              </span>
            </p>
            <p className="font-mono text-sm sm:text-base font-bold text-emerald-500">
              {formatPrice(signal.tp, signal.pair)}
            </p>
          </div>
          <div className="rounded-lg sm:rounded-xl bg-rose-500/10 p-2 sm:p-3 border border-rose-500/15">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-rose-500/70 mb-0.5 sm:mb-1">
              SL{" "}
              <span className="text-[8px] sm:text-[9px] text-rose-500/40">
                (-{signal.slPips ? formatPrice(signal.slPips, signal.pair) : "--"})
              </span>
            </p>
            <p className="font-mono text-sm sm:text-base font-bold text-rose-500">
              {formatPrice(signal.sl, signal.pair)}
            </p>
          </div>
        </div>

        {/* ═══ KEY CONFLUENCES ═══ */}
        {signal.reasoning && signal.reasoning.length > 0 && (
          <div className="mb-3 rounded-lg sm:rounded-xl bg-background/40 p-2.5 sm:p-3 border border-border/10">
            <p className="mb-1.5 sm:mb-2 text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Key Confluences
            </p>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {signal.reasoning.slice(0, 3).map((r, i) => (
                <span
                  key={i}
                  className="rounded-full bg-background/80 border border-border/10 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] text-foreground/70"
                >
                  {r}
                </span>
              ))}
              {signal.reasoning.length > 3 && (
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold text-cyan-400">
                  +{signal.reasoning.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        <IndicatorsPanel indicators={signal.indicators} />

        {/* ═══ FOOTER METADATA ═══ */}
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/20 pt-2.5 sm:pt-3">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              {formatTime(signal.timestamp)}
            </div>
            <Badge
              variant="outline"
              className="border-border/30 bg-muted/30 text-[8px] sm:text-[9px] text-muted-foreground"
            >
              {getSessionAtTime(signal.timestamp)}
            </Badge>
            <Badge
              variant="outline"
              className="border-violet-500/30 bg-violet-500/10 text-[8px] sm:text-[9px] font-bold text-violet-400"
            >
              v8.1
            </Badge>
            {signal.confluences && (
              <Badge
                variant="outline"
                className="border-cyan-500/30 bg-cyan-500/10 text-[8px] sm:text-[9px] font-bold text-cyan-400"
              >
                {signal.confluences} confluences
              </Badge>
            )}
            {signal.rewardRatio && (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-[8px] sm:text-[9px] font-bold text-amber-400"
              >
                {signal.rewardRatio}:1 R:R
              </Badge>
            )}
          </div>
          {isActive && (
            <div className="flex items-center gap-1.5 sm:self-end">
              <PulseDot color="bg-emerald-400" />
              <span className="text-[10px] sm:text-xs font-bold text-emerald-500">LIVE</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}