"use client";

import { useState } from "react";
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
  Radio,
  Wifi,
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

  return (
    <Card
      className={`relative overflow-hidden border transition-all duration-500 cursor-pointer hover:border-foreground/20 ${
        isNew
          ? "border-amber-400/60 shadow-lg shadow-amber-400/10"
          : isActive
            ? "border-border/40 bg-card/80"
            : "border-border/20 bg-card/40 opacity-70"
      } backdrop-blur`}
      onClick={onClick}
    >
      {isNew && (
        <div className="absolute top-0 right-0 flex items-center gap-1 rounded-bl-lg bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
          <Zap className="h-3 w-3" /> NEW
        </div>
      )}
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isActive ? (
              isBuy ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20">
                  <TrendingDown className="h-5 w-5 text-rose-500" />
                </div>
              )
            ) : (
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${isTP ? "bg-emerald-500/20" : "bg-rose-500/20"}`}
              >
                {isTP ? (
                  <Target className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-rose-500" />
                )}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-foreground">
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
              <p className="text-[10px] text-muted-foreground">{signal.id}</p>
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
            <div className="flex flex-col items-end gap-1">
              <Badge
                className={`text-xs font-bold ${isBuy ? "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30" : "bg-rose-500/20 text-rose-500 hover:bg-rose-500/30"}`}
                variant="outline"
              >
                {isBuy ? (
                  <span className="flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" /> BUY
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <ArrowDownRight className="h-3 w-3" /> SELL
                  </span>
                )}
              </Badge>
              {signal.confidence && (
                <ConfidenceBar confidence={signal.confidence} />
              )}
            </div>
          </div>
        </div>

        {/* REAL-TIME PIPS COUNTER */}
        {isActive && livePips !== null && (
          <div
            className={`mb-3 rounded-lg p-2.5 border transition-all duration-300 ${pipsBg} ${livePips >= 0 ? "border-emerald-500/20" : "border-rose-500/20"}`}
          >
            <div className="flex items-center justify-between mb-1.5">
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
                className={`text-lg font-black tabular-nums ${pipsColor}`}
              >
                {livePips >= 0 ? "+" : ""}
                {livePips.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
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
            <CountdownTimer
              signalTimestamp={signal.timestamp}
              durationSec={300}
            />
          </div>
        )}

        <div className="mb-2 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-background/60 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Entry
            </p>
            <p className="font-mono text-sm font-bold text-foreground">
              {formatPrice(signal.entry, signal.pair)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2">
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
          <div className="rounded-lg bg-rose-500/10 p-2">
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
              Analysis
            </p>
            <div className="flex flex-wrap gap-1">
              {signal.reasoning.slice(0, 3).map((r, i) => (
                <span
                  key={i}
                  className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-foreground/70"
                >
                  {r}
                </span>
              ))}
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
            {signal.tradeDuration && (
              <Badge
                variant="outline"
                className="border-cyan-500/30 bg-cyan-500/10 text-[9px] font-bold text-cyan-400"
              >
                <Radio className="mr-1 h-2.5 w-2.5" />
                {signal.tradeDuration}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="border-border/30 bg-muted/30 text-[9px] text-muted-foreground"
            >
              {getSessionAtTime(signal.timestamp)}
            </Badge>
          </div>
          {!isActive && signal.pips !== undefined ? (
            <Badge
              variant="outline"
              className={`text-xs font-bold ${signal.pips > 0 ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"}`}
            >
              {signal.pips > 0 ? "+" : ""}
              {signal.pips} pips
            </Badge>
          ) : isActive && livePips === null ? (
            <div className="flex items-center gap-1.5">
              <PulseDot color="bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-500">LIVE</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}