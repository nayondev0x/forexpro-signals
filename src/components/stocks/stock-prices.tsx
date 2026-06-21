"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, BarChart3, Search, RefreshCw,
  ArrowUpRight, ArrowDownRight, Clock, Volume2, DollarSign,
  Flame, LineChart, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ─ Types ─ */
interface StockSummary {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  prices?: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
}

interface StockDetail {
  ticker: string;
  range: string;
  prices: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  lastPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
}

type Range = "1d" | "5d" | "1mo" | "ytd" | "max";

const RANGES: { value: Range; label: string }[] = [
  { value: "1d", label: "1 Day" },
  { value: "5d", label: "5 Days" },
  { value: "1mo", label: "1 Month" },
  { value: "ytd", label: "YTD" },
  { value: "max", label: "All Time" },
];

const RANGE_COLORS: Record<Range, string> = {
  "1d": "bg-sky-500/20 text-sky-500 border-sky-500/30",
  "5d": "bg-violet-500/20 text-violet-500 border-violet-500/30",
  "1mo": "bg-amber-500/20 text-amber-500 border-amber-500/30",
  "ytd": "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  "max": "bg-rose-500/20 text-rose-500 border-rose-500/30",
};

/* ─ Helpers ─ */
function formatNum(n: number, decimals = 2) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(decimals);
}

function formatVol(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─ Sparkline SVG ─ */
function Sparkline({ data, positive, width = 80, height = 28 }: { data: number[]; positive: boolean; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const color = positive ? "#10b981" : "#f43f5e";
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

/* ─ Mini Chart (Canvas) ─ */
function StockChart({ data, range }: { data: StockDetail | null; range: Range }) {
  const canvasRef = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef[0] || !data?.prices?.length) return;
    const canvas = canvasRef[0];
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const closes = data.prices.map(p => p.close);
    const min = Math.min(...closes) * 0.999;
    const max = Math.max(...closes) * 1.001;
    const rangeVal = max - min || 1;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "rgba(128,128,128,0.1)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = (i / 4) * H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Area fill
    const isPositive = data.changePercent >= 0;
    const lineColor = isPositive ? "#10b981" : "#f43f5e";
    const fillColor = isPositive ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)";

    ctx.beginPath();
    closes.forEach((c, i) => {
      const x = (i / (closes.length - 1)) * W;
      const y = H - ((c - min) / rangeVal) * (H - 20) - 10;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    closes.forEach((c, i) => {
      const x = (i / (closes.length - 1)) * W;
      const y = H - ((c - min) / rangeVal) * (H - 20) - 10;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // End dot
    const lastX = W;
    const lastY = H - ((closes[closes.length - 1] - min) / rangeVal) * (H - 20) - 10;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

  }, [canvasRef[0], data, range]);

  if (!data?.prices?.length) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground/50">
        <LineChart className="mr-2 h-8 w-8" />
        <span>Select a stock to view chart</span>
      </div>
    );
  }

  return <canvas ref={(el) => { canvasRef[1](el); }} className="h-64 w-full" style={{ width: "100%", height: "256px" }} />;
}

/* ─ Main Component ─ */
export function StockPrices() {
  const [stocks, setStocks] = useState<StockSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [range, setRange] = useState<Range>("1d");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch popular stocks
  const fetchPopular = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stocks/prices?action=popular");
      const data = await res.json();
      if (data.stocks) setStocks(data.stocks);
    } catch (e) {
      console.error("Stock fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch single stock detail
  const fetchDetail = useCallback(async (ticker: string, r: Range) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/stocks/prices?ticker=${ticker}&range=${r}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      }
    } catch (e) {
      console.error("Stock detail error:", e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchPopular(); }, [fetchPopular]);

  // Fetch detail when stock/range changes
  useEffect(() => {
    if (selected) fetchDetail(selected, range);
  }, [selected, range, fetchDetail]);

  // Search ticker
  const handleSearch = async () => {
    const ticker = searchInput.trim().toUpperCase();
    if (!ticker) return;
    setDetailLoading(true);
    setSelected(ticker);
    setSearchInput("");
  };

  // Refresh
  const handleRefresh = async () => {
    if (selected) {
      fetchDetail(selected, range);
    } else {
      fetchPopular();
    }
  };

  const selectedStock = stocks.find(s => s.ticker === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left Panel: Stock List */}
      <div className="lg:col-span-1">
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Flame className="h-4 w-4 text-orange-500" />
                Stock Prices
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-500">LIVE</Badge>
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading || detailLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {/* Search */}
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Search ticker (e.g. AAPL)"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={handleSearch} className="h-8 px-3">
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stocks.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground/50">
                  <BarChart3 className="mb-2 h-8 w-8" />
                  <p className="text-xs">No stock data available</p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {stocks.map(stock => {
                    const positive = stock.changePercent >= 0;
                    const isSelected = selected === stock.ticker;
                    const sparkData = stock.prices?.map(p => p.close) || [];
                    return (
                      <div
                        key={stock.ticker}
                        className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50 ${isSelected ? "bg-muted/80 border-l-2 border-l-emerald-500" : ""}`}
                        onClick={() => setSelected(stock.ticker)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{stock.ticker}</span>
                            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                          </div>
                          <span className="font-mono text-lg font-bold text-foreground">
                            ${stock.price?.toFixed(2) || "--"}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {sparkData.length > 1 && <Sparkline data={sparkData} positive={positive} />}
                          <div className="flex items-center gap-1">
                            {positive ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-rose-500" />}
                            <span className={`text-xs font-bold ${positive ? "text-emerald-500" : "text-rose-500"}`}>
                              {positive ? "+" : ""}{stock.changePercent?.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel: Chart + Detail */}
      <div className="lg:col-span-2 space-y-4">
        {/* Selected Stock Header */}
        {selectedStock && (
          <Card className="border-border/30 bg-card/80 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground">{selectedStock.ticker}</h2>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 text-xs">LIVE</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="font-mono text-2xl font-bold text-foreground">${selectedStock.price?.toFixed(2)}</span>
                    <span className={`flex items-center gap-1 text-sm font-bold ${selectedStock.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {selectedStock.changePercent >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {selectedStock.changePercent >= 0 ? "+" : ""}{selectedStock.change?.toFixed(2)} ({selectedStock.changePercent >= 0 ? "+" : ""}{selectedStock.changePercent?.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <Select value={range} onValueChange={(v) => setRange(v as Range)}>
                      <SelectTrigger className="h-8 w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RANGES.map(r => (
                          <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="mt-3 grid grid-cols-4 gap-3">
                <div className="rounded-lg bg-background/60 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> High</p>
                  <p className="font-mono text-sm font-bold text-foreground">${selectedStock.high?.toFixed(2) || "--"}</p>
                </div>
                <div className="rounded-lg bg-background/60 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Low</p>
                  <p className="font-mono text-sm font-bold text-foreground">${selectedStock.low?.toFixed(2) || "--"}</p>
                </div>
                <div className="rounded-lg bg-background/60 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Open</p>
                  <p className="font-mono text-sm font-bold text-foreground">${detail?.prices?.[0]?.open?.toFixed(2) || "--"}</p>
                </div>
                <div className="rounded-lg bg-background/60 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Volume2 className="h-3 w-3" /> Volume</p>
                  <p className="font-mono text-sm font-bold text-foreground">{formatVol(selectedStock.volume || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <LineChart className="h-4 w-4 text-violet-500" />
                {selected ? `${selected} — ${RANGES.find(r => r.value === range)?.label} Chart` : "Stock Price Chart"}
              </CardTitle>
              {selected && <Badge variant="outline" className={`text-[10px] ${RANGE_COLORS[range]}`}>{RANGES.find(r => r.value === range)?.label}</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : detail ? (
              <StockChart data={detail} range={range} />
            ) : !selected ? (
              <div className="flex h-64 flex-col items-center justify-center text-muted-foreground/40">
                <BarChart3 className="mb-3 h-12 w-12" />
                <p className="text-sm">Select a stock from the list or search a ticker</p>
                <p className="text-xs">Try: AAPL, GOOGL, TSLA, NVDA, MSFT...</p>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground/50">
                <span>No data available for this range</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price Table */}
        {detail?.prices && detail.prices.length > 0 && (
          <Card className="border-border/30 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4 text-sky-500" />
                Price Data ({detail.prices.length} points)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-64">
                <table className="w-full text-xs">
                  <thead className="border-b border-border/30">
                    <tr className="text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-right font-medium">Open</th>
                      <th className="px-4 py-2 text-right font-medium">High</th>
                      <th className="px-4 py-2 text-right font-medium">Low</th>
                      <th className="px-4 py-2 text-right font-medium">Close</th>
                      <th className="px-4 py-2 text-right font-medium">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {[...detail.prices].reverse().slice(0, 50).map((p, i) => {
                      const change = p.close - p.open;
                      const isUp = change >= 0;
                      return (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-1.5 text-muted-foreground">{formatDate(p.date)}</td>
                          <td className="px-4 py-1.5 text-right font-mono">${p.open.toFixed(2)}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-emerald-500">${p.high.toFixed(2)}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-rose-500">${p.low.toFixed(2)}</td>
                          <td className={`px-4 py-1.5 text-right font-mono font-bold ${isUp ? "text-emerald-500" : "text-rose-500"}`}>${p.close.toFixed(2)}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">{formatVol(p.volume)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}