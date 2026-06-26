"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bitcoin, RefreshCw, TrendingUp, TrendingDown, Minus, Gauge,
  Flame, ArrowUpRight, ArrowDownRight, Loader2, Shield, Activity,
  AlertTriangle, Zap, BarChart3, Layers, ArrowLeftRight, BookOpen,
  Brain, Eye, Users, Bell, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/* ─ Types ─ */
interface CryptoSignal {
  pair: string;
  action: string;
  confidence: number;
  signal_score: number;
  sl_price: number | null;
  tp_price: number | null;
  current_price: number | null;
  regime: string;
  timestamp: number;
}

interface FundingRate {
  symbol: string;
  funding_rate: number;
  funding_rate_8h: string;
  direction: string;
  mark_price: number;
  next_funding_time: number;
}

interface FearGreed {
  value: number;
  label: string;
}

interface BinanceFlow {
  orderFlowScore: number;
  signal: string;
  reasons: string[];
  depth: {
    bidRatio: number; askRatio: number; imbalance: number;
    bidWall: { price: number; volume: number };
    askWall: { price: number; volume: number };
    bestBid: number; bestAsk: number; spread: number; spreadPct: number;
    signal: string;
  } | null;
  tradeFlow: {
    totalTrades: number; buyTrades: number; sellTrades: number;
    buyVolume: number; sellVolume: number;
    buyRatio: number; sellRatio: number;
    recentBuyRatio: number;
    signal: string;
  } | null;
  ticker: {
    price: number; change: number; changePercent: number;
    high: number; low: number; volume: number;
    volatility: number; rangePosition: number;
    signal: string;
  } | null;
  bookTicker: {
    bidPrice: number; bidQty: number;
    askPrice: number; askQty: number;
    spread: number; spreadPct: number;
  } | null;
}

/* ─ Helpers ─ */
const REGIME_COLORS: Record<string, string> = {
  LOW_VOLATILITY: "text-amber-500", TRENDING_UP: "text-emerald-500",
  TRENDING_DOWN: "text-rose-500", TREND_EXHAUSTING_UP: "text-orange-500",
  TREND_EXHAUSTING_DOWN: "text-orange-500", RANGING: "text-sky-500",
  ANALYZING: "text-violet-500", BREAKOUT: "text-cyan-500",
};
const REGIME_BG: Record<string, string> = {
  LOW_VOLATILITY: "bg-amber-500/10 border-amber-500/20",
  TRENDING_UP: "bg-emerald-500/10 border-emerald-500/20",
  TRENDING_DOWN: "bg-rose-500/10 border-rose-500/20",
  TREND_EXHAUSTING_UP: "bg-orange-500/10 border-orange-500/20",
  TREND_EXHAUSTING_DOWN: "bg-orange-500/10 border-orange-500/20",
  RANGING: "bg-sky-500/10 border-sky-500/20",
  ANALYZING: "bg-violet-500/10 border-violet-500/20",
  BREAKOUT: "bg-cyan-500/10 border-cyan-500/20",
};
const ACTION_STYLES: Record<string, { bg: string; text: string; icon: typeof TrendingUp }> = {
  BUY: { bg: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30", text: "BUY", icon: TrendingUp },
  LONG: { bg: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30", text: "LONG", icon: TrendingUp },
  SELL: { bg: "bg-rose-500/20 text-rose-500 border-rose-500/30", text: "SELL", icon: TrendingDown },
  SHORT: { bg: "bg-rose-500/20 text-rose-500 border-rose-500/30", text: "SHORT", icon: TrendingDown },
  HOLD: { bg: "bg-amber-500/20 text-amber-500 border-amber-500/30", text: "HOLD", icon: Minus },
};

function getFearGreedColor(val: number) {
  if (val <= 20) return "text-rose-500"; if (val <= 40) return "text-orange-500";
  if (val <= 60) return "text-amber-500"; if (val <= 80) return "text-emerald-400";
  return "text-emerald-500";
}
function getFearGreedBarColor(val: number) {
  if (val <= 20) return "bg-rose-500"; if (val <= 40) return "bg-orange-500";
  if (val <= 60) return "bg-amber-500"; if (val <= 80) return "bg-emerald-400";
  return "bg-emerald-500";
}
function getFearGreedBg(val: number) {
  if (val <= 20) return "from-rose-500/20 to-rose-950/10";
  if (val <= 40) return "from-orange-500/20 to-orange-950/10";
  if (val <= 60) return "from-amber-500/20 to-amber-950/10";
  if (val <= 80) return "from-emerald-500/20 to-emerald-950/10";
  return "from-emerald-400/20 to-emerald-500/10";
}

/* ─ Fear & Greed Gauge ─ */
function FearGreedGauge({ data }: { data: FearGreed | null }) {
  if (!data) return <div className="flex h-40 items-center justify-center text-muted-foreground/50">Loading...</div>;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${getFearGreedBg(data.value)} border border-border/30`}>
        <div className="absolute inset-2 rounded-full bg-card/80" />
        <div className="relative flex flex-col items-center">
          <span className={`text-3xl font-black ${getFearGreedColor(data.value)}`}>{data.value}</span>
          <span className="text-[10px] font-semibold text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className={`text-sm font-bold ${getFearGreedColor(data.value)}`}>{data.label}</p>
        <p className="text-[10px] text-muted-foreground">Crypto Fear & Greed Index</p>
      </div>
      <div className="w-full">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all duration-1000 ${getFearGreedBarColor(data.value)}`} style={{ width: `${data.value}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span className="text-rose-500">Extreme Fear</span><span>Neutral</span><span className="text-emerald-500">Extreme Greed</span>
        </div>
      </div>
    </div>
  );
}

/* ─ Signal Card ─ */
function SignalCard({ signal }: { signal: CryptoSignal }) {
  const action = (signal.action || "HOLD").toUpperCase();
  const style = ACTION_STYLES[action] || ACTION_STYLES.HOLD;
  const Icon = style.icon;
  const isAction = action === "BUY" || action === "SELL" || action === "LONG" || action === "SHORT";
  return (
    <Card className={`border-border/30 bg-card/80 backdrop-blur transition-all hover:border-foreground/20 ${isAction ? "ring-1 ring-emerald-500/20" : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bitcoin className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold text-foreground">{signal.pair}</span>
          </div>
          <Badge variant="outline" className={`text-[10px] font-bold ${style.bg}`}>
            <Icon className="mr-1 h-3 w-3" />{style.text}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border ${REGIME_BG[signal.regime] || ""} ${REGIME_COLORS[signal.regime] || "text-muted-foreground"}`}>
            <Activity className="mr-1 h-2.5 w-2.5" />{signal.regime?.replace(/_/g, " ") || "N/A"}
          </Badge>
          {signal.signal_score > 0 && <span className="text-[10px] text-muted-foreground">Score: {signal.signal_score}</span>}
        </div>
        {(signal.sl_price || signal.tp_price) && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            {signal.tp_price && (
              <div className="rounded-md bg-emerald-500/10 p-1.5">
                <p className="text-[9px] text-emerald-500/70">Take Profit</p>
                <p className="font-mono text-xs font-bold text-emerald-500">{signal.tp_price}</p>
              </div>
            )}
            {signal.sl_price && (
              <div className="rounded-md bg-rose-500/10 p-1.5">
                <p className="text-[9px] text-rose-500/70">Stop Loss</p>
                <p className="font-mono text-xs font-bold text-rose-500">{signal.sl_price}</p>
              </div>
            )}
          </div>
        )}
        {signal.current_price && (
          <div className="border-t border-border/20 pt-1.5">
            <span className="text-[10px] text-muted-foreground">Price: </span>
            <span className="font-mono text-xs font-bold text-foreground">${signal.current_price}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─ Order Flow Gauge ─ */
function OrderFlowGauge({ flow, symbol }: { flow: BinanceFlow | null; symbol: string }) {
  if (!flow) return <div className="flex h-48 items-center justify-center text-muted-foreground/50"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading order flow...</div>;

  const score = flow.orderFlowScore;
  const isBullish = score > 55;
  const isBearish = score < 45;
  const scoreColor = score > 65 ? "text-emerald-400" : score < 35 ? "text-rose-400" : score > 55 ? "text-emerald-500" : score < 45 ? "text-rose-500" : "text-amber-500";
  const barColor = score > 65 ? "bg-emerald-400" : score < 35 ? "bg-rose-400" : score > 55 ? "bg-emerald-500" : score < 45 ? "bg-rose-500" : "bg-amber-500";

  return (
    <div className="space-y-3">
      {/* Main Score */}
      <div className="flex flex-col items-center gap-1">
        <span className={`text-4xl font-black ${scoreColor}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">Order Flow Score</span>
        <Badge variant="outline" className={`text-[10px] font-bold ${
          flow.signal.includes("STRONG_BUY") ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" :
          flow.signal.includes("BUY") ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" :
          flow.signal.includes("STRONG_SELL") ? "border-rose-500/50 bg-rose-500/20 text-rose-400" :
          flow.signal.includes("SELL") ? "border-rose-500/30 bg-rose-500/10 text-rose-500" :
          "border-amber-500/30 bg-amber-500/10 text-amber-500"
        }`}>
          {flow.signal.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted relative">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
        <div className="absolute inset-0 flex items-center justify-between px-1">
          <span className="text-[8px] text-rose-500 font-bold">SELL</span>
          <span className="text-[8px] text-muted-foreground font-bold">50</span>
          <span className="text-[8px] text-emerald-500 font-bold">BUY</span>
        </div>
      </div>

      {/* Reasons */}
      {flow.reasons.length > 0 && (
        <div className="space-y-1">
          {flow.reasons.slice(0, 4).map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${r.includes("buy") || r.includes("up") || r.includes("bullish") ? "bg-emerald-500" : r.includes("sell") || r.includes("down") || r.includes("bearish") ? "bg-rose-500" : "bg-amber-500"}`} />
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2">
        {/* Depth */}
        {flow.depth && (
          <div className="rounded-md bg-muted/30 p-2">
            <div className="flex items-center gap-1 mb-1">
              <Layers className="h-3 w-3 text-blue-400" />
              <span className="text-[9px] font-semibold text-muted-foreground">Order Book</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-emerald-500">{flow.depth.bidRatio}%</span>
              <ArrowLeftRight className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-rose-500">{flow.depth.askRatio}%</span>
            </div>
            <div className="text-[8px] text-muted-foreground mt-0.5">
              Bid: {flow.depth.bestBid.toFixed(2)} | Ask: {flow.depth.bestAsk.toFixed(2)}
            </div>
          </div>
        )}

        {/* Trade Flow */}
        {flow.tradeFlow && (
          <div className="rounded-md bg-muted/30 p-2">
            <div className="flex items-center gap-1 mb-1">
              <BarChart3 className="h-3 w-3 text-purple-400" />
              <span className="text-[9px] font-semibold text-muted-foreground">Trade Flow</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-emerald-500">{flow.tradeFlow.buyRatio}%</span>
              <span className="text-[9px] text-muted-foreground">{flow.tradeFlow.totalTrades} trades</span>
              <span className="text-rose-500">{flow.tradeFlow.sellRatio}%</span>
            </div>
            <div className="text-[8px] text-muted-foreground mt-0.5">
              Buy: {flow.tradeFlow.buyTrades} | Sell: {flow.tradeFlow.sellTrades}
            </div>
          </div>
        )}

        {/* Ticker */}
        {flow.ticker && (
          <div className="rounded-md bg-muted/30 p-2">
            <div className="flex items-center gap-1 mb-1">
              <Activity className="h-3 w-3 text-orange-400" />
              <span className="text-[9px] font-semibold text-muted-foreground">24h Price</span>
            </div>
            <div className="font-mono text-xs font-bold text-foreground">${flow.ticker.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className={`text-[10px] font-semibold ${flow.ticker.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {flow.ticker.changePercent >= 0 ? "+" : ""}{flow.ticker.changePercent.toFixed(2)}%
            </div>
          </div>
        )}

        {/* Book Ticker */}
        {flow.bookTicker && (
          <div className="rounded-md bg-muted/30 p-2">
            <div className="flex items-center gap-1 mb-1">
              <BookOpen className="h-3 w-3 text-cyan-400" />
              <span className="text-[9px] font-semibold text-muted-foreground">Best Bid/Ask</span>
            </div>
            <div className="text-[10px]">
              <span className="text-emerald-500 font-mono">{flow.bookTicker.bidPrice.toFixed(2)}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-rose-500 font-mono">{flow.bookTicker.askPrice.toFixed(2)}</span>
            </div>
            <div className="text-[8px] text-muted-foreground mt-0.5">
              Spread: {flow.bookTicker.spreadPct.toFixed(4)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─ Sentiment Types ─ */
interface SentimentData {
  crowding: {
    score: number; direction: string; level: string;
    contrarianSignal: string; warning: string | null;
  } | null;
  signals: {
    signal: string; confidence: number | null; reasoning: string; timeframe: string;
  } | null;
  alerts: Array<{ type: string; message: string; severity: string }> | null;
  context: {
    sentiment: string; trend: string; volatility: string; riskLevel: string; summary: string;
  } | null;
}

/* ─ Sentiment Panel ─ */
function SentimentPanel({ data, symbol }: { data: SentimentData | null; symbol: string }) {
  if (!data) return <div className="flex items-center justify-center py-8 text-muted-foreground/50"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading sentiment...</div>;

  const coin = symbol.replace("USDT", "");

  return (
    <div className="space-y-3">
      {/* Crowding Score */}
      {data.crowding && (
        <div className={`rounded-lg p-3 border ${
          data.crowding.level === "EXTREME" ? "bg-rose-500/10 border-rose-500/30" :
          data.crowding.level === "HIGH" ? "bg-amber-500/10 border-amber-500/30" :
          "bg-muted/30 border-border/20"
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-[10px] font-bold text-foreground">Crowding Score</span>
            </div>
            <span className={`text-xs font-black ${
              data.crowding.score >= 70 ? "text-rose-400" :
              data.crowding.score >= 50 ? "text-amber-500" :
              "text-emerald-500"
            }`}>{data.crowding.score}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
            <div className={`h-full rounded-full transition-all duration-500 ${
              data.crowding.score >= 70 ? "bg-rose-400" :
              data.crowding.score >= 50 ? "bg-amber-500" :
              "bg-emerald-500"
            }`} style={{ width: `${data.crowding.score}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">Direction: <span className={data.crowding.direction.includes("long") || data.crowding.direction.includes("buy") ? "text-emerald-500" : data.crowding.direction.includes("short") || data.crowding.direction.includes("sell") ? "text-rose-500" : "text-amber-500"}>{data.crowding.direction}</span></span>
            <Badge variant="outline" className={`text-[8px] ${
              data.crowding.level === "EXTREME" ? "border-rose-500/40 bg-rose-500/15 text-rose-400" :
              data.crowding.level === "HIGH" ? "border-amber-500/40 bg-amber-500/15 text-amber-500" :
              "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
            }`}>{data.crowding.level}</Badge>
          </div>
          {data.crowding.contrarianSignal !== "NONE" && (
            <div className={`mt-2 rounded-md p-1.5 text-[9px] font-semibold ${
              data.crowding.contrarianSignal === "CONTRARIAN_SELL"
                ? "bg-rose-500/15 text-rose-400"
                : "bg-emerald-500/15 text-emerald-400"
            }`}>
              <AlertTriangle className="inline h-2.5 w-2.5 mr-1" />
              {data.crowding.contrarianSignal.replace("_", " ")}
            </div>
          )}
        </div>
      )}

      {/* Sentiment Signal */}
      {data.signals && (
        <div className="rounded-md bg-muted/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="h-3 w-3 text-yellow-400" />
            <span className="text-[9px] font-bold text-foreground">Sentiment Signal</span>
            {data.signals.confidence !== null && (
              <span className="text-[8px] text-muted-foreground ml-auto">{data.signals.confidence}%</span>
            )}
          </div>
          <Badge variant="outline" className={`text-[9px] font-bold ${
            data.signals.signal.includes("BUY") || data.signals.signal.includes("LONG") || data.signals.signal.includes("BULL")
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
              : data.signals.signal.includes("SELL") || data.signals.signal.includes("SHORT") || data.signals.signal.includes("BEAR")
                ? "border-rose-500/40 bg-rose-500/15 text-rose-400"
                : "border-amber-500/40 bg-amber-500/15 text-amber-500"
          }`}>
            {data.signals.signal}
          </Badge>
          {data.signals.reasoning && (
            <p className="text-[9px] text-muted-foreground mt-1 overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{data.signals.reasoning}</p>
          )}
        </div>
      )}

      {/* Market Context */}
      {data.context && (
        <div className="rounded-md bg-muted/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Eye className="h-3 w-3 text-sky-400" />
            <span className="text-[9px] font-bold text-foreground">Market Context</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            <div><span className="text-muted-foreground">Sentiment:</span> <span className={`font-semibold ${data.context.sentiment.includes("bull") || data.context.sentiment.includes("positive") || data.context.sentiment.includes("greed") ? "text-emerald-500" : data.context.sentiment.includes("bear") || data.context.sentiment.includes("negative") || data.context.sentiment.includes("fear") ? "text-rose-500" : "text-amber-500"}`}>{data.context.sentiment}</span></div>
            <div><span className="text-muted-foreground">Trend:</span> <span className={`font-semibold ${data.context.trend.includes("up") || data.context.trend.includes("bull") ? "text-emerald-500" : data.context.trend.includes("down") || data.context.trend.includes("bear") ? "text-rose-500" : "text-amber-500"}`}>{data.context.trend}</span></div>
            <div><span className="text-muted-foreground">Volatility:</span> <span className="font-semibold text-foreground">{data.context.volatility}</span></div>
            <div><span className="text-muted-foreground">Risk:</span> <span className={`font-semibold ${data.context.riskLevel.includes("high") || data.context.riskLevel.includes("extreme") ? "text-rose-500" : data.context.riskLevel.includes("low") ? "text-emerald-500" : "text-amber-500"}`}>{data.context.riskLevel}</span></div>
          </div>
          {data.context.summary && (
            <p className="text-[9px] text-muted-foreground mt-1.5 overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{data.context.summary}</p>
          )}
        </div>
      )}

      {/* Alerts */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Bell className="h-3 w-3 text-orange-400" />
            <span className="text-[9px] font-bold text-foreground">Active Alerts</span>
            <Badge variant="outline" className="text-[8px] border-orange-500/30 bg-orange-500/10 text-orange-500">{data.alerts.length}</Badge>
          </div>
          {data.alerts.slice(0, 4).map((a, i) => (
            <div key={i} className={`rounded-md p-1.5 text-[9px] ${
              a.severity === "high" || a.severity === "critical" ? "bg-rose-500/10 border border-rose-500/20" :
              a.severity === "medium" ? "bg-amber-500/10 border border-amber-500/20" :
              "bg-muted/20 border border-border/10"
            }`}>
              <div className="flex items-center gap-1">
                <Info className={`h-2.5 w-2.5 flex-shrink-0 ${
                  a.severity === "high" || a.severity === "critical" ? "text-rose-400" :
                  a.severity === "medium" ? "text-amber-400" : "text-sky-400"
                }`} />
                <span className="text-muted-foreground">{a.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─ Main Component ─ */
export function CryptoSignals() {
  const [signals, setSignals] = useState<CryptoSignal[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreed | null>(null);
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [binanceFlow, setBinanceFlow] = useState<BinanceFlow | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [flowLoading, setFlowLoading] = useState(false);

  const CRYPTO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"];

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [sigRes, fgRes, frRes, binanceRes, sentRes] = await Promise.allSettled([
      fetch("/api/crypto/signal?action=all").then(r => r.json()),
      fetch("/api/crypto/fear-greed").then(r => r.json()),
      fetch("/api/crypto/funding-rates").then(r => r.json()),
      fetch(`/api/crypto/binance?symbol=${selectedSymbol}&action=all`).then(r => r.json()),
      fetch(`/api/crypto/sentiment?symbol=${selectedSymbol.replace("USDT", "")}&action=all`).then(r => r.json()),
    ]);

    if (sigRes.status === "fulfilled" && sigRes.value?.signals) setSignals(sigRes.value.signals);
    if (fgRes.status === "fulfilled" && fgRes.value?.value !== undefined) setFearGreed({ value: fgRes.value.value, label: fgRes.value.label });
    if (frRes.status === "fulfilled" && frRes.value?.top_rates) setFundingRates(frRes.value.top_rates);
    if (binanceRes.status === "fulfilled" && binanceRes.value?.orderFlowScore !== undefined) setBinanceFlow(binanceRes.value);
    if (sentRes.status === "fulfilled" && sentRes.value) setSentimentData(sentRes.value);

    setLoading(false);
    setRefreshing(false);
  }, [selectedSymbol]);

  const fetchFlowOnly = useCallback(async () => {
    setFlowLoading(true);
    const [binRes, sentRes] = await Promise.allSettled([
      fetch(`/api/crypto/binance?symbol=${selectedSymbol}&action=all`).then(r => r.json()),
      fetch(`/api/crypto/sentiment?symbol=${selectedSymbol.replace("USDT", "")}&action=all`).then(r => r.json()),
    ]);
    if (binRes.status === "fulfilled" && binRes.value?.orderFlowScore !== undefined) setBinanceFlow(binRes.value);
    if (sentRes.status === "fulfilled" && sentRes.value) setSentimentData(sentRes.value);
    setFlowLoading(false);
  }, [selectedSymbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => fetchData(true);

  const buyCount = signals.filter(s => s.action?.toUpperCase() === "BUY" || s.action?.toUpperCase() === "LONG").length;
  const sellCount = signals.filter(s => s.action?.toUpperCase() === "SELL" || s.action?.toUpperCase() === "SHORT").length;
  const holdCount = signals.filter(s => s.action?.toUpperCase() === "HOLD").length;

  return (
    <div className="space-y-4">
      {/* Top Row: Fear/Greed + Funding Rates */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Fear & Greed */}
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="h-4 w-4 text-violet-500" />
              Market Sentiment
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-500">LIVE</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent><FearGreedGauge data={fearGreed} /></CardContent>
        </Card>

        {/* Funding Rates */}
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-orange-500" />
              Top Funding Rates
              <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-500">
                {fundingRates.length} pairs
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {fundingRates.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground/50 text-sm">Loading funding rates...</div>
            ) : (
              <div className="divide-y divide-border/10">
                {fundingRates.slice(0, 6).map((fr, i) => {
                  const isPositive = fr.funding_rate >= 0;
                  return (
                    <div key={fr.symbol} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                        <span className="text-xs font-bold text-foreground">{fr.symbol.replace("USDT", "")}</span>
                        <span className="text-[10px] text-muted-foreground">/USDT</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">${fr.mark_price?.toFixed(2)}</span>
                        <span className={`flex items-center gap-0.5 text-xs font-bold ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                          {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {fr.funding_rate_8h}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signals Section */}
      {/* Sentiment + Order Flow Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-purple-500" />
                Sentiment Analysis
                <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-[10px] text-purple-500">CRYPTOEDGE</Badge>
              </CardTitle>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {CRYPTO_SYMBOLS.map(s => (
                <button key={s} onClick={() => setSelectedSymbol(s)}
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold transition-all ${
                    selectedSymbol === s
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
                  }`}>
                  {s.replace("USDT", "")}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <SentimentPanel data={sentimentData} symbol={selectedSymbol} />
          </CardContent>
        </Card>

        {/* Order Flow - takes full width on mobile, half on lg */}
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-amber-500" />
                Order Flow
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-500">BINANCE</Badge>
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchFlowOnly} disabled={flowLoading}>
                <RefreshCw className={`h-3 ${flowLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <OrderFlowGauge flow={binanceFlow} symbol={selectedSymbol} />
          </CardContent>
        </Card>
      </div>

      {/* Signals Section */}
      <Card className="border-border/30 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              Crypto Trading Signals
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-500">LIVE</Badge>
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{buyCount} Buy</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />{sellCount} Sell</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{holdCount} Hold</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mb-3 h-6 w-6 animate-spin" />
              <span className="text-sm">Fetching crypto signals...</span>
            </div>
          ) : signals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
              <Bitcoin className="mb-3 h-10 w-10" />
              <span className="text-sm">No signals available</span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {signals.map(s => (
                <SignalCard key={s.pair} signal={s} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}