"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Brain, TrendingUp, TrendingDown, Minus, RefreshCw, Search,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight,
  Loader2, Zap, Shield, BarChart3, Activity, Target,
  Eye, EyeOff, Filter, Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ─ Types ─ */
interface Agent {
  agent: string;
  vote: number;
  read: string;
}

interface StockSignal {
  ticker: string;
  date: string;
  last_close: number;
  bias_score: number;
  verdict: string;
  agents: Agent[];
  indicators?: {
    sma20: number; sma50: number; sma200: number;
    ema9: number; ema20: number; ema50: number;
    rsi14: number;
    macd: { macd: number; signal: number; histogram: number };
    bollinger: { upper: number; middle: number; lower: number };
    atr14: number;
    stochastic: { k: number; d: number };
    week52_high: number;
    week52_low: number;
  };
}

interface ScanResult {
  signals: StockSignal[];
  scanned: number;
  success: number;
  errors: string[];
  timestamp: string;
}

interface SingleResult {
  signal: StockSignal;
  indicators: StockSignal["indicators"] & { ticker: string };
  meta: { totalAgents: number; bullish: number; bearish: number; neutral: number };
}

/* ─ Helpers ─ */
function getVerdictColor(verdict: string) {
  const v = verdict.toUpperCase();
  if (v === "STRONG_BUY" || v === "BUY") return { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30", glow: "shadow-emerald-500/20" };
  if (v === "STRONG_SELL" || v === "SELL") return { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30", glow: "shadow-rose-500/20" };
  return { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", glow: "shadow-amber-500/20" };
}

function getVoteIcon(vote: number) {
  if (vote > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  if (vote < 0) return <TrendingDown className="h-3.5 w-3.5 text-rose-400 shrink-0" />;
  return <Minus className="h-3.5 w-3.5 text-zinc-500 shrink-0" />;
}

function getVoteColor(vote: number) {
  if (vote > 0) return "border-emerald-500/20 bg-emerald-500/5";
  if (vote < 0) return "border-rose-500/20 bg-rose-500/5";
  return "border-zinc-700/30 bg-zinc-800/20";
}

function getVoteTextColor(vote: number) {
  if (vote > 0) return "text-emerald-400";
  if (vote < 0) return "text-rose-400";
  return "text-zinc-500";
}

function getBiasLabel(score: number): { label: string; color: string } {
  if (score >= 10) return { label: "Strong Buy", color: "text-emerald-400" };
  if (score >= 5) return { label: "Buy", color: "text-emerald-300" };
  if (score >= 2) return { label: "Lean Buy", color: "text-green-300" };
  if (score <= -10) return { label: "Strong Sell", color: "text-rose-400" };
  if (score <= -5) return { label: "Sell", color: "text-rose-300" };
  if (score <= -2) return { label: "Lean Sell", color: "text-red-300" };
  return { label: "Neutral", color: "text-amber-400" };
}

/* ─ Bias Gauge Component ─ */
function BiasGauge({ score, totalAgents }: { score: number; totalAgents: number }) {
  const maxScore = totalAgents || 35;
  const pct = ((score + maxScore) / (maxScore * 2)) * 100; // 0-100
  const { label, color } = getBiasLabel(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-2xl font-bold font-mono" style={{ color: color.includes("emerald") || color.includes("green") ? "#10b981" : color.includes("rose") || color.includes("red") ? "#f43f5e" : "#fbbf24" }}>
        {score > 0 ? "+" : ""}{score}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: color.includes("emerald") || color.includes("green") ? "#10b981" : color.includes("rose") || color.includes("red") ? "#f43f5e" : "#fbbf24" }}>
        {label}
      </div>
      <div className="relative h-2 w-full max-w-[200px] rounded-full bg-zinc-800 overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-600 z-10" />
        <div
          className="absolute top-0 bottom-0 rounded-full transition-all duration-500"
          style={{
            left: Math.min(pct, 50) + "%",
            width: Math.abs(pct - 50) + "%",
            backgroundColor: score > 0 ? "#10b981" : score < 0 ? "#f43f5e" : "#fbbf24",
            opacity: 0.6,
          }}
        />
      </div>
      <div className="flex w-full max-w-[200px] justify-between text-[9px] text-zinc-600">
        <span>SELL</span>
        <span>NEUTRAL</span>
        <span>BUY</span>
      </div>
    </div>
  );
}

/* ─ Agent Card ─ */
function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${getVoteColor(agent.vote)}`}>
      <div className="mt-0.5">{getVoteIcon(agent.vote)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-foreground truncate">{agent.agent.replace("Bot", "")}</span>
          <Badge variant="outline" className={`text-[9px] shrink-0 ${getVoteTextColor(agent.vote)} border-current/30`}>
            {agent.vote > 0 ? "+1" : agent.vote < 0 ? "-1" : "0"}
          </Badge>
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground line-clamp-2">{agent.read}</p>
      </div>
    </div>
  );
}

/* ─ Indicator Panel ─ */
function IndicatorPanel({ indicators, ticker }: { indicators: NonNullable<StockSignal["indicators"]>; ticker: string }) {
  const items = [
    { label: "RSI (14)", value: indicators.rsi14.toFixed(1), zone: indicators.rsi14 > 70 ? "Overbought" : indicators.rsi14 < 30 ? "Oversold" : "Normal", color: indicators.rsi14 > 70 ? "text-rose-400" : indicators.rsi14 < 30 ? "text-emerald-400" : "text-zinc-400" },
    { label: "SMA 20", value: `$${indicators.sma20.toFixed(2)}`, sub: indicators.last_close > indicators.sma20 ? "Above" : "Below", color: indicators.last_close > indicators.sma20 ? "text-emerald-400" : "text-rose-400" },
    { label: "SMA 50", value: `$${indicators.sma50.toFixed(2)}`, sub: indicators.last_close > indicators.sma50 ? "Above" : "Below", color: indicators.last_close > indicators.sma50 ? "text-emerald-400" : "text-rose-400" },
    { label: "SMA 200", value: `$${indicators.sma200.toFixed(2)}`, sub: indicators.last_close > indicators.sma200 ? "Above" : "Below", color: indicators.last_close > indicators.sma200 ? "text-emerald-400" : "text-rose-400" },
    { label: "MACD", value: indicators.macd.macd.toFixed(2), sub: indicators.macd.histogram > 0 ? "Bullish" : "Bearish", color: indicators.macd.histogram > 0 ? "text-emerald-400" : "text-rose-400" },
    { label: "Stochastic %K", value: indicators.stochastic.k.toFixed(1), zone: indicators.stochastic.k > 80 ? "Overbought" : indicators.stochastic.k < 20 ? "Oversold" : "Normal", color: indicators.stochastic.k > 80 ? "text-rose-400" : indicators.stochastic.k < 20 ? "text-emerald-400" : "text-zinc-400" },
    { label: "ATR (14)", value: indicators.atr14.toFixed(2), sub: "Volatility", color: "text-violet-400" },
    { label: "52W Range", value: `$${indicators.week52_low.toFixed(0)} - $${indicators.week52_high.toFixed(0)}`, sub: `(${((indicators.last_close - indicators.week52_low) / (indicators.week52_high - indicators.week52_low) * 100).toFixed(0)}%)`, color: "text-sky-400" },
  ];

  return (
    <Card className="border-border/30 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-violet-500" />
          {ticker} — Technical Indicators
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg bg-background/60 border border-border/20 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-foreground">{item.value}</p>
              <p className={`text-[10px] ${item.color}`}>{item.sub || item.zone}</p>
            </div>
          ))}
        </div>
        {/* Bollinger Band Visual */}
        <div className="mt-3 rounded-lg bg-background/60 border border-border/20 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bollinger Bands</p>
          <div className="relative h-3 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 rounded-full bg-violet-500/30"
              style={{
                left: `${Math.max(0, ((indicators.bollinger.lower - indicators.week52_low) / (indicators.week52_high - indicators.week52_low)) * 100)}%`,
                right: `${Math.max(0, (1 - (indicators.bollinger.upper - indicators.week52_low) / (indicators.week52_high - indicators.week52_low))) * 100}%`,
              }}
            />
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-foreground rounded-full z-10 transition-all"
              style={{
                left: `${((indicators.last_close - indicators.week52_low) / (indicators.week52_high - indicators.week52_low)) * 100}%`,
                transform: "translateX(-50%)",
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground font-mono">
            <span>Lower: ${indicators.bollinger.lower.toFixed(2)}</span>
            <span className="text-foreground font-bold">Price: ${indicators.last_close.toFixed(2)}</span>
            <span>Upper: ${indicators.bollinger.upper.toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─ Expanded Detail View ─ */
function StockDetailPanel({ data, onClose }: { data: SingleResult; onClose: () => void }) {
  const [agentFilter, setAgentFilter] = useState<"all" | "bullish" | "bearish" | "neutral">("all");
  const [showAgents, setShowAgents] = useState(true);

  const signal = data.signal;
  const vc = getVerdictColor(signal.verdict);
  const filtered = agentFilter === "all" ? signal.agents : signal.agents.filter(a => {
    if (agentFilter === "bullish") return a.vote > 0;
    if (agentFilter === "bearish") return a.vote < 0;
    return a.vote === 0;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            <ChevronDown className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-xl font-bold text-foreground">{signal.ticker}</h2>
          <Badge className={`${vc.bg} ${vc.text} ${vc.border} border font-bold text-xs shadow-lg ${vc.glow}`}>
            {signal.verdict}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] text-zinc-400">
            {data.meta.totalAgents} Agents
          </Badge>
          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
            {data.meta.bullish} Bullish
          </Badge>
          <Badge variant="outline" className="text-[10px] text-rose-400 border-rose-500/30">
            {data.meta.bearish} Bearish
          </Badge>
        </div>
      </div>

      {/* Price + Bias */}
      <Card className="border-border/30 bg-card/80 backdrop-blur">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Last Close</p>
              <p className="font-mono text-3xl font-bold text-foreground">${signal.last_close.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{signal.date}</p>
            </div>
            <div className="flex items-center justify-center">
              <BiasGauge score={signal.bias_score} totalAgents={data.meta.totalAgents} />
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Agent Consensus</p>
              <div className="flex items-end gap-3 h-16">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-bold text-emerald-400">{data.meta.bullish}</span>
                  <div className="w-8 bg-emerald-500/30 rounded-t" style={{ height: `${(data.meta.bullish / data.meta.totalAgents) * 60}px` }} />
                  <span className="text-[9px] text-emerald-400">BUY</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-bold text-amber-400">{data.meta.neutral}</span>
                  <div className="w-8 bg-amber-500/30 rounded-t" style={{ height: `${(data.meta.neutral / data.meta.totalAgents) * 60}px` }} />
                  <span className="text-[9px] text-amber-400">FLAT</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-bold text-rose-400">{data.meta.bearish}</span>
                  <div className="w-8 bg-rose-500/30 rounded-t" style={{ height: `${(data.meta.bearish / data.meta.totalAgents) * 60}px` }} />
                  <span className="text-[9px] text-rose-400">SELL</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicators */}
      {data.indicators && (
        <IndicatorPanel indicators={data.indicators} ticker={signal.ticker} />
      )}

      {/* 35 Agent Votes */}
      <Card className="border-border/30 bg-card/80 backdrop-blur">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Brain className="h-4 w-4 text-pink-500" />
              35-Agent Analysis
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v as typeof agentFilter)}>
                <SelectTrigger className="h-7 w-[100px] text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All</SelectItem>
                  <SelectItem value="bullish" className="text-xs">Bullish</SelectItem>
                  <SelectItem value="bearish" className="text-xs">Bearish</SelectItem>
                  <SelectItem value="neutral" className="text-xs">Neutral</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowAgents(!showAgents)}
              >
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
                {filtered.map((agent, i) => (
                  <AgentCard key={i} agent={agent} />
                ))}
              </div>
              {filtered.length === 0 && (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
                  No agents in this category
                </div>
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
    </div>
  );
}

/* ─ Signal Row (collapsed card in list) ─ */
function SignalRow({ signal, onClick }: { signal: StockSignal; onClick: () => void }) {
  const vc = getVerdictColor(signal.verdict);
  const bullish = signal.agents.filter(a => a.vote > 0).length;
  const bearish = signal.agents.filter(a => a.vote < 0).length;
  const neutral = signal.agents.filter(a => a.vote === 0).length;
  const total = signal.agents.length || 1;
  const bullishPct = Math.round((bullish / total) * 100);
  const bearishPct = Math.round((bearish / total) * 100);
  const neutralPct = 100 - bullishPct - bearishPct;

  // Top 3 bullish & bearish agents
  const topBullish = signal.agents.filter(a => a.vote > 0).sort((a, b) => b.vote - a.vote).slice(0, 3);
  const topBearish = signal.agents.filter(a => a.vote < 0).sort((a, b) => a.vote - b.vote).slice(0, 3);

  return (
    <Card
      className={`border-border/30 bg-card/80 backdrop-blur cursor-pointer hover:border-foreground/20 transition-all hover:shadow-lg ${vc.glow}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Left: Ticker + Price */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">{signal.ticker}</h3>
                <Badge className={`${vc.bg} ${vc.text} ${vc.border} border text-[10px] font-bold shadow-sm`}>
                  {signal.verdict}
                </Badge>
              </div>
              <p className="font-mono text-xl font-bold text-foreground mt-0.5">${signal.last_close.toFixed(2)}</p>
            </div>
          </div>

          {/* Center: Bias Score */}
          <div className="flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bias Score</p>
            <p className={`text-2xl font-bold font-mono ${signal.bias_score > 0 ? "text-emerald-400" : signal.bias_score < 0 ? "text-rose-400" : "text-amber-400"}`}>
              {signal.bias_score > 0 ? "+" : ""}{signal.bias_score}
            </p>
          </div>

          {/* Right: Agent Consensus Bar */}
          <div className="flex flex-col items-end gap-1">
            <p className="text-[10px] text-muted-foreground">{total} Agents</p>
            <div className="flex items-center gap-1.5">
              <div className="flex h-6 w-40 overflow-hidden rounded-full bg-zinc-800">
                <div className="bg-emerald-500/60 transition-all" style={{ width: `${bullishPct}%` }} />
                <div className="bg-amber-500/40 transition-all" style={{ width: `${neutralPct}%` }} />
                <div className="bg-rose-500/60 transition-all" style={{ width: `${bearishPct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-emerald-400 font-mono">{bullish} Buy</span>
              <span className="text-amber-400 font-mono">{neutral} Flat</span>
              <span className="text-rose-400 font-mono">{bearish} Sell</span>
            </div>
          </div>
        </div>

        {/* Top Agents Preview */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topBullish.map((a, i) => (
            <Badge key={`b${i}`} variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
              {a.agent.replace("Bot", "")}: +1
            </Badge>
          ))}
          {topBearish.map((a, i) => (
            <Badge key={`s${i}`} variant="outline" className="text-[9px] text-rose-400 border-rose-500/20 bg-rose-500/5">
              {a.agent.replace("Bot", "")}: -1
            </Badge>
          ))}
          {signal.agents.length > 6 && (
            <Badge variant="outline" className="text-[9px] text-zinc-500">
              +{signal.agents.length - 6} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─ Main Component ─ */
export function StockSignals() {
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [selectedStock, setSelectedStock] = useState<SingleResult | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scan all popular stocks
  const scanStocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stocks/technical-signal?action=scan");
      if (!res.ok) throw new Error("Scan failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScanData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch single stock detail
  const fetchDetail = useCallback(async (ticker: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stocks/technical-signal?action=single&ticker=${ticker}`);
      if (!res.ok) throw new Error("No data for " + ticker);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSelectedStock(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Initial scan
  useEffect(() => {
    scanStocks();
  }, [scanStocks]);

  // Search
  const handleSearch = () => {
    const ticker = searchInput.trim().toUpperCase();
    if (!ticker) return;
    setSearchInput("");
    fetchDetail(ticker);
  };

  // Detail view
  if (selectedStock) {
    if (detailLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return <StockDetailPanel data={selectedStock} onClose={() => setSelectedStock(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-pink-500" />
          <div>
            <h2 className="text-lg font-bold text-foreground">35-Agent Stock Signals</h2>
            <p className="text-xs text-muted-foreground">AI-powered technical analysis with 35 specialized agents</p>
          </div>
          <Badge className="bg-pink-500/15 text-pink-400 border-pink-500/30 border text-[10px] font-bold shadow-sm shadow-pink-500/10">
            35 AGENTS
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search ticker..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-8 w-32 text-xs"
            />
            <Button size="sm" onClick={handleSearch} className="h-8 px-3">
              <Search className="h-3.5 w-3.5" />
            </Button>
          </div>
          {/* Refresh */}
          <Button variant="outline" size="sm" onClick={scanStocks} disabled={loading} className="h-8">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Scan
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
          <p className="text-sm text-muted-foreground">Scanning 12 stocks with 35 agents each...</p>
        </div>
      )}

      {/* Error */}
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

      {/* Signal Cards */}
      {!loading && scanData && scanData.signals.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/30 bg-card/80">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{scanData.success}</p>
                <p className="text-[10px] text-muted-foreground">Stocks Scanned</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {scanData.signals.filter(s => s.verdict.toUpperCase().includes("BUY")).length}
                </p>
                <p className="text-[10px] text-emerald-400">Bullish Signals</p>
              </CardContent>
            </Card>
            <Card className="border-rose-500/20 bg-rose-500/5">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-rose-400">
                  {scanData.signals.filter(s => s.verdict.toUpperCase().includes("SELL")).length}
                </p>
                <p className="text-[10px] text-rose-400">Bearish Signals</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">
                  {scanData.signals.filter(s => s.verdict.toUpperCase() === "NEUTRAL").length}
                </p>
                <p className="text-[10px] text-amber-400">Neutral</p>
              </CardContent>
            </Card>
          </div>

          {/* Signal List */}
          <div className="space-y-3">
            {scanData.signals.map((signal) => (
              <SignalRow
                key={signal.ticker}
                signal={signal}
                onClick={() => fetchDetail(signal.ticker)}
              />
            ))}
          </div>

          {scanData.errors.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Failed: {scanData.errors.join(", ")}
            </p>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && !error && scanData && scanData.signals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Brain className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm">No signals available right now</p>
          <p className="text-xs mt-1">Try again later or search a specific ticker</p>
        </div>
      )}
    </div>
  );
}