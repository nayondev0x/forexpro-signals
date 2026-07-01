"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Brain, TrendingUp, TrendingDown, Minus, RefreshCw, Search,
  ChevronDown, ChevronUp, Loader2, BarChart3, Activity,
  Eye, EyeOff, Newspaper, Layers, Sparkles, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ══════ Types ══════ */
interface Agent { agent: string; vote: number; read: string; }

interface AgentSignal {
  ticker: string; date: string; last_close: number;
  bias_score: number; verdict: string; agents: Agent[];
}

interface IndicatorData {
  sma20: number; sma50: number; sma200: number;
  ema9: number; ema20: number; ema50: number;
  rsi14: number;
  macd: { macd: number; signal: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number };
  atr14: number;
  stochastic: { k: number; d: number };
  week52_high: number; week52_low: number;
}

interface SentimentData {
  ticker: string; sentiment: string; score: number;
  headlines_analyzed: number; bullish_count: number;
  bearish_count: number; neutral_count: number;
  sample_headlines: { title: string; publisher: string; link: string; score: number }[];
}

interface MultiframeData {
  ticker: string; verdict: string; confidence: number; last_price: number;
  timeframes: {
    daily:   { trend: string; rsi: number };
    weekly:  { trend: string; rsi: number };
    monthly: { trend: string; rsi: number };
  };
}

interface CombinedSignal {
  ticker: string;
  agentSignal: AgentSignal | null;
  indicators: IndicatorData | null;
  sentiment: SentimentData | null;
  multiframe: MultiframeData | null;
  fusionScore: number;
  fusionVerdict: string;
}

interface ScanResult {
  signals: CombinedSignal[];
  scanned: number; success: number; errors: string[];
  timestamp: string;
}

interface SingleResult extends CombinedSignal {
  meta: {
    totalAgents: number; bullish: number; bearish: number; neutral: number;
    dataSources: string[];
  };
}

/* ══════ Helpers ══════ */
function getVerdictStyle(verdict: string) {
  const v = (verdict || "").toUpperCase();
  if (v === "STRONG_BUY" || v === "BUY" || v === "BULLISH")
    return { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", glow: "shadow-emerald-500/20" };
  if (v === "STRONG_SELL" || v === "SELL" || v === "BEARISH")
    return { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30", glow: "shadow-rose-500/20" };
  return { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", glow: "shadow-amber-500/20" };
}

function getVoteIcon(vote: number) {
  if (vote > 0) return <TrendingUp className="h-3 w-3 text-emerald-400 shrink-0" />;
  if (vote < 0) return <TrendingDown className="h-3 w-3 text-rose-400 shrink-0" />;
  return <Minus className="h-3 w-3 text-zinc-500 shrink-0" />;
}

function getVoteBg(vote: number) {
  if (vote > 0) return "border-emerald-500/20 bg-emerald-500/5";
  if (vote < 0) return "border-rose-500/20 bg-rose-500/5";
  return "border-zinc-700/30 bg-zinc-800/20";
}

function getTrendIcon(trend: string) {
  if (trend === "uptrend") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "downtrend") return <TrendingDown className="h-4 w-4 text-rose-400" />;
  return <Minus className="h-4 w-4 text-amber-400" />;
}

function getSentimentColor(s: string) {
  if (s === "bullish") return { text: "text-emerald-400", bar: "bg-emerald-500" };
  if (s === "bearish") return { text: "text-rose-400", bar: "bg-rose-500" };
  return { text: "text-amber-400", bar: "bg-amber-500" };
}

/* ══════ Bias Gauge ══════ */
function BiasGauge({ score }: { score: number }) {
  const maxScore = 35;
  const pct = ((score + maxScore) / (maxScore * 2)) * 100;
  const color = score > 2 ? "#10b981" : score < -2 ? "#f43f5e" : "#fbbf24";
  const label = score >= 5 ? "Strong Buy" : score >= 2 ? "Buy" : score <= -5 ? "Strong Sell" : score <= -2 ? "Sell" : "Neutral";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-2xl font-bold font-mono" style={{ color }}>
        {score > 0 ? "+" : ""}{score.toFixed(1)}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</div>
      <div className="relative h-2 w-full max-w-[200px] rounded-full bg-zinc-800 overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-600 z-10" />
        <div className="absolute top-0 bottom-0 rounded-full transition-all duration-500"
          style={{ left: Math.min(pct, 50) + "%", width: Math.abs(pct - 50) + "%", backgroundColor: color, opacity: 0.6 }} />
      </div>
      <div className="flex w-full max-w-[200px] justify-between text-[9px] text-zinc-600">
        <span>SELL</span><span>NEUTRAL</span><span>BUY</span>
      </div>
    </div>
  );
}

/* ══════ Agent Card ══════ */
function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-2.5 ${getVoteBg(agent.vote)}`}>
      <div className="mt-0.5">{getVoteIcon(agent.vote)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-foreground truncate">{agent.agent.replace("Bot", "")}</span>
          <Badge variant="outline" className={`text-[9px] shrink-0 ${agent.vote > 0 ? "text-emerald-400 border-emerald-500/30" : agent.vote < 0 ? "text-rose-400 border-rose-500/30" : "text-zinc-500 border-zinc-600/30"}`}>
            {agent.vote > 0 ? "+1" : agent.vote < 0 ? "-1" : "0"}
          </Badge>
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground line-clamp-2">{agent.read}</p>
      </div>
    </div>
  );
}

/* ══════ Sentiment Panel ══════ */
function SentimentPanel({ data }: { data: SentimentData }) {
  const sc = getSentimentColor(data.sentiment);
  const total = data.bullish_count + data.bearish_count + data.neutral_count || 1;
  const bullPct = Math.round((data.bullish_count / total) * 100);
  const bearPct = Math.round((data.bearish_count / total) * 100);

  return (
    <Card className="border-border/30 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Newspaper className="h-4 w-4 text-blue-500" />
          News Sentiment Analysis
          <Badge variant="outline" className="ml-auto text-[10px] text-blue-400 border-blue-500/30">
            {data.headlines_analyzed} headlines
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center">
            <p className="text-3xl font-bold" style={{ color: sc.text.includes("emerald") ? "#10b981" : sc.text.includes("rose") ? "#f43f5e" : "#fbbf24" }}>
              {data.score}
            </p>
            <p className={`text-xs font-bold uppercase mt-0.5 ${sc.text}`}>{data.sentiment}</p>
          </div>
          <div className="flex-1">
            <div className="flex h-8 rounded-full overflow-hidden bg-zinc-800">
              <div className="bg-emerald-500/60 transition-all" style={{ width: `${bullPct}%` }} />
              <div className="bg-amber-500/40 transition-all" style={{ width: `${100 - bullPct - bearPct}%` }} />
              <div className="bg-rose-500/60 transition-all" style={{ width: `${bearPct}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px]">
              <span className="text-emerald-400 font-mono">{data.bullish_count} Bullish</span>
              <span className="text-amber-400 font-mono">{data.neutral_count} Neutral</span>
              <span className="text-rose-400 font-mono">{data.bearish_count} Bearish</span>
            </div>
          </div>
        </div>
        {/* Headlines */}
        {data.sample_headlines?.length > 0 && (
          <ScrollArea className="max-h-[140px]">
            <div className="space-y-1.5">
              {data.sample_headlines.slice(0, 5).map((h, i) => (
                <a key={i} href={h.link} target="_blank" rel="noopener noreferrer"
                  className="block rounded-md border border-border/20 bg-background/40 p-2 hover:bg-background/70 transition-colors">
                  <p className="text-[11px] leading-snug text-foreground line-clamp-1">{h.title}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{h.publisher}</p>
                </a>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════ Multiframe Panel ══════ */
function MultiframePanel({ data }: { data: MultiframeData }) {
  const vc = getVerdictStyle(data.verdict);
  const frames = [
    { label: "Daily", key: "daily" as const, color: "text-sky-400", icon: "D" },
    { label: "Weekly", key: "weekly" as const, color: "text-violet-400", icon: "W" },
    { label: "Monthly", key: "monthly" as const, color: "text-amber-400", icon: "M" },
  ];

  return (
    <Card className="border-border/30 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Layers className="h-4 w-4 text-violet-500" />
            Multi-Timeframe Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`${vc.bg} ${vc.text} ${vc.border} border text-[10px] font-bold`}>
              {data.verdict}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Confidence: <span className="text-foreground font-bold">{data.confidence}%</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {frames.map((f) => {
            const tf = data.timeframes[f.key];
            const trendColor = tf.trend === "uptrend" ? "border-emerald-500/30 bg-emerald-500/5" : tf.trend === "downtrend" ? "border-rose-500/30 bg-rose-500/5" : "border-amber-500/30 bg-amber-500/5";
            const rsiColor = tf.rsi > 70 ? "text-rose-400" : tf.rsi < 30 ? "text-emerald-400" : "text-zinc-400";
            return (
              <div key={f.key} className={`rounded-lg border p-3 text-center ${trendColor}`}>
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <span className={`text-xs font-bold uppercase ${f.color}`}>{f.label}</span>
                </div>
                <div className="flex justify-center mb-2">{getTrendIcon(tf.trend)}</div>
                <p className="text-xs font-bold text-foreground capitalize">{tf.trend}</p>
                <div className="mt-2">
                  <p className="text-[9px] uppercase text-muted-foreground">RSI</p>
                  <p className={`text-sm font-bold font-mono ${rsiColor}`}>{tf.rsi.toFixed(1)}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${tf.rsi}%`,
                        backgroundColor: tf.rsi > 70 ? "#f43f5e" : tf.rsi < 30 ? "#10b981" : "#fbbf24",
                      }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Alignment indicator */}
        {(() => {
          const all = [data.timeframes.daily?.trend, data.timeframes.weekly?.trend, data.timeframes.monthly?.trend];
          const aligned = all.every(t => t === "uptrend") || all.every(t => t === "downtrend");
          return (
            <div className={`mt-3 rounded-lg p-2 text-center text-xs font-medium ${aligned ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border border-amber-500/20 text-amber-400"}`}>
              {aligned ? "✓ All Timeframes Aligned — High Confidence" : "~ Mixed Timeframes — Use Caution"}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

/* ══════ Indicator Panel ══════ */
function IndicatorPanel({ ind, price }: { ind: IndicatorData; price: number }) {
  const items = [
    { label: "RSI (14)", value: ind.rsi14.toFixed(1), note: ind.rsi14 > 70 ? "Overbought" : ind.rsi14 < 30 ? "Oversold" : "Normal", c: ind.rsi14 > 70 ? "text-rose-400" : ind.rsi14 < 30 ? "text-emerald-400" : "text-zinc-400" },
    { label: "SMA 20", value: `$${ind.sma20.toFixed(2)}`, note: price > ind.sma20 ? "Above ▲" : "Below ▼", c: price > ind.sma20 ? "text-emerald-400" : "text-rose-400" },
    { label: "SMA 50", value: `$${ind.sma50.toFixed(2)}`, note: price > ind.sma50 ? "Above ▲" : "Below ▼", c: price > ind.sma50 ? "text-emerald-400" : "text-rose-400" },
    { label: "SMA 200", value: `$${ind.sma200.toFixed(2)}`, note: price > ind.sma200 ? "Above ▲" : "Below ▼", c: price > ind.sma200 ? "text-emerald-400" : "text-rose-400" },
    { label: "MACD", value: ind.macd.macd.toFixed(2), note: ind.macd.histogram > 0 ? "Bullish" : "Bearish", c: ind.macd.histogram > 0 ? "text-emerald-400" : "text-rose-400" },
    { label: "Stoch %K", value: ind.stochastic.k.toFixed(1), note: ind.stochastic.k > 80 ? "Overbought" : ind.stochastic.k < 20 ? "Oversold" : "Normal", c: ind.stochastic.k > 80 ? "text-rose-400" : ind.stochastic.k < 20 ? "text-emerald-400" : "text-zinc-400" },
    { label: "ATR (14)", value: ind.atr14.toFixed(2), note: "Volatility", c: "text-violet-400" },
    { label: "52W Range", value: `$${ind.week52_low.toFixed(0)}-$${ind.week52_high.toFixed(0)}`, note: `${((price - ind.week52_low) / (ind.week52_high - ind.week52_low) * 100).toFixed(0)}% from low`, c: "text-sky-400" },
  ];

  return (
    <Card className="border-border/30 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-violet-500" />
          Technical Indicators
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map(item => (
            <div key={item.label} className="rounded-lg bg-background/60 border border-border/20 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{item.value}</p>
              <p className={`text-[10px] ${item.c}`}>{item.note}</p>
            </div>
          ))}
        </div>
        {/* Bollinger Visual */}
        <div className="mt-3 rounded-lg bg-background/60 border border-border/20 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bollinger Bands</p>
          <div className="relative h-3 rounded-full bg-zinc-800 overflow-hidden">
            <div className="absolute top-0 bottom-0 rounded-full bg-violet-500/30"
              style={{
                left: `${Math.max(0, ((ind.bollinger.lower - ind.week52_low) / (ind.week52_high - ind.week52_low)) * 100)}%`,
                right: `${Math.max(0, (1 - (ind.bollinger.upper - ind.week52_low) / (ind.week52_high - ind.week52_low))) * 100}%`,
              }} />
            <div className="absolute top-0 bottom-0 w-1.5 bg-foreground rounded-full z-10 transition-all"
              style={{ left: `${((price - ind.week52_low) / (ind.week52_high - ind.week52_low)) * 100}%`, transform: "translateX(-50%)" }} />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground font-mono">
            <span>Lower: ${ind.bollinger.lower.toFixed(2)}</span>
            <span className="text-foreground font-bold">Price: ${price.toFixed(2)}</span>
            <span>Upper: ${ind.bollinger.upper.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ══════ Stock Detail Panel (expanded view) ══════ */
function StockDetailPanel({ data, onClose }: { data: SingleResult; onClose: () => void }) {
  const [agentFilter, setAgentFilter] = useState<"all" | "bullish" | "bearish" | "neutral">("all");
  const [showAgents, setShowAgents] = useState(true);

  const as = data.agentSignal;
  const vc = getVerdictStyle(data.fusionVerdict);
  const filtered = as ? (agentFilter === "all" ? as.agents : as.agents.filter(a => {
    if (agentFilter === "bullish") return a.vote > 0;
    if (agentFilter === "bearish") return a.vote < 0;
    return a.vote === 0;
  })) : [];

  const price = as?.last_close || data.multiframe?.last_price || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
          <ChevronDown className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold text-foreground">{data.ticker}</h2>
        <Badge className={`${vc.bg} ${vc.text} ${vc.border} border font-bold text-xs shadow-lg ${vc.glow}`}>
          {data.fusionVerdict.replace("_", " ")}
        </Badge>
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {data.meta.dataSources.map(s => (
            <Badge key={s} variant="outline" className="text-[9px] text-zinc-400 border-zinc-600/30">
              {s}
            </Badge>
          ))}
        </div>
      </div>

      {/* Price + Fusion Score */}
      <Card className="border-border/30 bg-card/80 backdrop-blur">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Last Price</p>
              <p className="font-mono text-3xl font-bold text-foreground">${price.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {as?.date || data.multiframe?.as_of ? new Date((as?.date || data.multiframe!.as_of || "")).toLocaleDateString() : ""}
              </p>
            </div>
            <div className="flex items-center justify-center">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-2">Fusion Score</p>
                <BiasGauge score={data.fusionScore} />
              </div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Agent Consensus</p>
              {as ? (
                <div className="flex items-end gap-3 h-16">
                  {[
                    { n: data.meta.bullish, label: "BUY", color: "#10b981", bg: "bg-emerald-500/30" },
                    { n: data.meta.neutral, label: "FLAT", color: "#fbbf24", bg: "bg-amber-500/30" },
                    { n: data.meta.bearish, label: "SELL", color: "#f43f5e", bg: "bg-rose-500/30" },
                  ].map(x => (
                    <div key={x.label} className="flex flex-col items-center gap-1">
                      <span className="text-xl font-bold" style={{ color: x.color }}>{x.n}</span>
                      <div className={`w-8 ${x.bg} rounded-t`} style={{ height: `${(x.n / (data.meta.totalAgents || 1)) * 60}px` }} />
                      <span className="text-[9px]" style={{ color: x.color }}>{x.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">35-Agent data unavailable</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multiframe */}
      {data.multiframe && <MultiframePanel data={data.multiframe} />}

      {/* Sentiment */}
      {data.sentiment && <SentimentPanel data={data.sentiment} />}

      {/* Indicators */}
      {data.indicators && <IndicatorPanel ind={data.indicators} price={price} />}

      {/* 35-Agent Votes */}
      {as && (
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Brain className="h-4 w-4 text-pink-500" />
                35-Agent Technical Analysis
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v as typeof agentFilter)}>
                  <SelectTrigger className="h-7 w-[100px] text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All</SelectItem>
                    <SelectItem value="bullish" className="text-xs">Bullish</SelectItem>
                    <SelectItem value="bearish" className="text-xs">Bearish</SelectItem>
                    <SelectItem value="neutral" className="text-xs">Neutral</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAgents(!showAgents)}>
                  {showAgents ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {showAgents ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {showAgents ? (
              <ScrollArea className="max-h-[500px]">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((agent, i) => <AgentCard key={i} agent={agent} />)}
                </div>
                {filtered.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">No agents in this category</div>
                )}
              </ScrollArea>
            ) : (
              <div className="grid grid-cols-3 gap-3 py-4">
                <div className="text-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <p className="text-2xl font-bold text-emerald-400">{data.meta.bullish}</p>
                  <p className="text-[10px] text-emerald-400 mt-1">BULLISH</p>
                </div>
                <div className="text-center rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p className="text-2xl font-bold text-amber-400">{data.meta.neutral}</p>
                  <p className="text-[10px] text-amber-400 mt-1">NEUTRAL</p>
                </div>
                <div className="text-center rounded-lg bg-rose-500/10 border border-rose-500/20 p-3">
                  <p className="text-2xl font-bold text-rose-400">{data.meta.bearish}</p>
                  <p className="text-[10px] text-rose-400 mt-1">BEARISH</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ══════ Signal Row (collapsed card) ══════ */
function SignalRow({ signal, onClick }: { signal: CombinedSignal; onClick: () => void }) {
  const vc = getVerdictStyle(signal.fusionVerdict);
  const as = signal.agentSignal;
  const price = as?.last_close || signal.multiframe?.last_price || 0;

  const bullish = as?.agents.filter(a => a.vote > 0).length || 0;
  const bearish = as?.agents.filter(a => a.vote < 0).length || 0;
  const neutral = as?.agents.filter(a => a.vote === 0).length || 0;
  const total = as?.agents.length || 1;

  const sentimentColor = signal.sentiment ? getSentimentColor(signal.sentiment.sentiment) : null;
  const mfVerdict = signal.multiframe?.verdict || "";
  const mfVC = mfVerdict ? getVerdictStyle(mfVerdict) : null;

  // Data source badges
  const sources: { label: string; color: string }[] = [];
  if (as) sources.push({ label: "35-Agents", color: "text-pink-400 border-pink-500/30" });
  if (signal.sentiment) sources.push({ label: "Sentiment", color: "text-blue-400 border-blue-500/30" });
  if (signal.multiframe) sources.push({ label: "Multiframe", color: "text-violet-400 border-violet-500/30" });

  return (
    <Card className={`border-border/30 bg-card/80 backdrop-blur cursor-pointer hover:border-foreground/20 transition-all hover:shadow-lg ${vc.glow}`}
      onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Ticker + Price + Sources */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-foreground">{signal.ticker}</h3>
              <Badge className={`${vc.bg} ${vc.text} ${vc.border} border text-[10px] font-bold shadow-sm`}>
                {signal.fusionVerdict.replace("_", " ")}
              </Badge>
              {sources.map(s => (
                <Badge key={s.label} variant="outline" className={`text-[9px] ${s.color}`}>{s.label}</Badge>
              ))}
            </div>
            <p className="font-mono text-xl font-bold text-foreground mt-1">${price.toFixed(2)}</p>
            {/* Sentiment mini bar */}
            {signal.sentiment && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">News:</span>
                <div className="flex h-2 w-20 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="bg-emerald-500/60" style={{ width: `${(signal.sentiment.bullish_count / (signal.sentiment.headlines_analyzed || 1)) * 100}%` }} />
                  <div className="bg-amber-500/40" style={{ width: `${(signal.sentiment.neutral_count / (signal.sentiment.headlines_analyzed || 1)) * 100}%` }} />
                  <div className="bg-rose-500/60" style={{ width: `${(signal.sentiment.bearish_count / (signal.sentiment.headlines_analyzed || 1)) * 100}%` }} />
                </div>
                <span className={`text-[10px] font-bold ${sentimentColor?.text}`}>
                  {signal.sentiment.score} ({signal.sentiment.sentiment})
                </span>
              </div>
            )}
          </div>

          {/* Center: Fusion Score */}
          <div className="flex flex-col items-center shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fusion</p>
            <p className={`text-2xl font-bold font-mono ${signal.fusionScore > 2 ? "text-emerald-400" : signal.fusionScore < -2 ? "text-rose-400" : "text-amber-400"}`}>
              {signal.fusionScore > 0 ? "+" : ""}{signal.fusionScore.toFixed(1)}
            </p>
            {/* Multiframe mini badges */}
            {signal.multiframe && (
              <div className="mt-1 flex gap-1">
                {(["daily", "weekly", "monthly"] as const).map(tf => {
                  const t = signal.multiframe!.timeframes[tf];
                  const c = t.trend === "uptrend" ? "text-emerald-400 bg-emerald-500/10" : t.trend === "downtrend" ? "text-rose-400 bg-rose-500/10" : "text-amber-400 bg-amber-500/10";
                  return (
                    <span key={tf} className={`text-[8px] font-bold px-1 rounded ${c}`}>
                      {tf[0].toUpperCase()}{t.rsi.toFixed(0)}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Agent consensus bar */}
          {as && (
            <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
              <p className="text-[10px] text-muted-foreground">{total} Agents</p>
              <div className="flex h-6 w-40 overflow-hidden rounded-full bg-zinc-800">
                <div className="bg-emerald-500/60 transition-all" style={{ width: `${(bullish / total) * 100}%` }} />
                <div className="bg-amber-500/40 transition-all" style={{ width: `${(neutral / total) * 100}%` }} />
                <div className="bg-rose-500/60 transition-all" style={{ width: `${(bearish / total) * 100}%` }} />
              </div>
              <div className="flex items-center gap-2 text-[9px]">
                <span className="text-emerald-400 font-mono">{bullish}B</span>
                <span className="text-amber-400 font-mono">{neutral}N</span>
                <span className="text-rose-400 font-mono">{bearish}S</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ══════ Main Component ══════ */
export function StockSignals() {
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [selectedStock, setSelectedStock] = useState<SingleResult | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanStocks = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/stocks/technical-signal?action=scan");
      if (!res.ok) throw new Error("Scan failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScanData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan");
    } finally { setLoading(false); }
  }, []);

  const fetchDetail = useCallback(async (ticker: string) => {
    setDetailLoading(true); setError(null);
    try {
      const res = await fetch(`/api/stocks/technical-signal?action=single&ticker=${ticker}`);
      if (!res.ok) throw new Error("No data");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSelectedStock(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { scanStocks(); }, [scanStocks]);

  const handleSearch = () => {
    const t = searchInput.trim().toUpperCase();
    if (!t) return;
    setSearchInput("");
    fetchDetail(t);
  };

  // Detail view
  if (selectedStock) {
    if (detailLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    return <StockDetailPanel data={selectedStock} onClose={() => setSelectedStock(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-pink-500" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Fusion Stock Signals</h2>
            <p className="text-xs text-muted-foreground">35 Agents + News Sentiment + Multi-Timeframe Analysis</p>
          </div>
          <Badge className="bg-pink-500/15 text-pink-400 border-pink-500/30 border text-[10px] font-bold shadow-sm shadow-pink-500/10">
            3 SOURCES
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search ticker..." value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="h-8 w-32 text-xs" />
          <Button size="sm" onClick={handleSearch} className="h-8 px-3"><Search className="h-3.5 w-3.5" /></Button>
          <Button variant="outline" size="sm" onClick={scanStocks} disabled={loading} className="h-8">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Scan
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
          <p className="text-sm text-muted-foreground">Scanning 12 stocks across 3 data sources...</p>
        </div>
      )}

      {error && !loading && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="flex items-center gap-2 p-4">
            <span className="text-sm text-rose-400">{error}</span>
            <Button variant="ghost" size="sm" onClick={scanStocks} className="text-rose-400 ml-auto">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && scanData && scanData.signals.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="border-border/30 bg-card/80"><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{scanData.success}</p>
              <p className="text-[10px] text-muted-foreground">Scanned</p>
            </CardContent></Card>
            <Card className="border-emerald-500/20 bg-emerald-500/5"><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{scanData.signals.filter(s => s.fusionScore > 2).length}</p>
              <p className="text-[10px] text-emerald-400">Bullish</p>
            </CardContent></Card>
            <Card className="border-rose-500/20 bg-rose-500/5"><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-rose-400">{scanData.signals.filter(s => s.fusionScore < -2).length}</p>
              <p className="text-[10px] text-rose-400">Bearish</p>
            </CardContent></Card>
            <Card className="border-amber-500/20 bg-amber-500/5"><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{scanData.signals.filter(s => Math.abs(s.fusionScore) <= 2).length}</p>
              <p className="text-[10px] text-amber-400">Neutral</p>
            </CardContent></Card>
            <Card className="border-blue-500/20 bg-blue-500/5"><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">3</p>
              <p className="text-[10px] text-blue-400">Data Sources</p>
            </CardContent></Card>
          </div>

          {/* Signal List */}
          <div className="space-y-3">
            {scanData.signals.map(s => (
              <SignalRow key={s.ticker} signal={s} onClick={() => fetchDetail(s.ticker)} />
            ))}
          </div>

          {scanData.errors.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">Failed: {scanData.errors.join(", ")}</p>
          )}
        </>
      )}

      {!loading && !error && scanData && scanData.signals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Brain className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm">No signals available</p>
          <p className="text-xs mt-1">Try again later or search a specific ticker</p>
        </div>
      )}
    </div>
  );
}