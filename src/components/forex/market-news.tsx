"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Newspaper, RefreshCw, TrendingUp, TrendingDown, Minus,
  Globe, BarChart3, ExternalLink, Lock, Play, Sparkles
} from "lucide-react";

/* ─ Types ─ */
interface OldNews {
  title?: string; headline?: string; description?: string; text?: string;
  content?: string; url?: string; link?: string; source?: string;
  publishedAt?: string; time?: string; date?: string;
  sentiment?: string; currency?: string; impact?: string;
}

interface BloomArticle {
  id: string; title: string; summary: string;
  category: string; site: string; author: string;
  published: string; url: string; isPremium: boolean;
  wordCount: number; duration: number | null; type: string;
}

interface IndexQuote {
  name: string; symbol: string; last: string;
  netChange: string; pctChange: string;
  dayHigh: string; dayLow: string;
  yearHigh: string; yearLow: string; volume: number;
}

export function MarketNews() {
  const [oldNews, setOldNews] = useState<OldNews[]>([]);
  const [bloomArticles, setBloomArticles] = useState<BloomArticle[]>([]);
  const [indexBar, setIndexBar] = useState<IndexQuote[]>([]);
  const [mood, setMood] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch old news + bloomberg in parallel
      const [oldRes, bloomRes] = await Promise.allSettled([
        fetch("/api/forex/news").then(r => r.json()),
        fetch("/api/bloomberg?type=news").then(r => r.json()),
      ]);

      // Old news
      if (oldRes.status === "fulfilled" && oldRes.value?.news?.length) {
        setOldNews(oldRes.value.news);
        if (oldRes.value.mood) setMood(oldRes.value.mood);
        if (!oldRes.value.fallback) setIsLive(true);
      }

      // Bloomberg news
      if (bloomRes.status === "fulfilled" && bloomRes.value?.articles?.length) {
        setBloomArticles(bloomRes.value.articles);
        if (bloomRes.value.indexBar?.length) {
          setIndexBar(bloomRes.value.indexBar);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const formatTime = (ts: string) => {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    } catch { return ts; }
  };

  const timeAgo = (ts: string) => {
    if (!ts) return "";
    try {
      const diff = Date.now() - new Date(ts).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    } catch { return ""; }
  };

  return (
    <div className="space-y-4">
      {/* ── Index Bar (DOW, S&P, WTI, etc.) ── */}
      {indexBar.length > 0 && (
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-bold text-foreground">Live Market Indices</span>
              <Badge variant="outline" className="text-[9px] text-blue-400 border-blue-500/30">BLOOMBERG</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {indexBar.slice(0, 8).map((q, i) => {
                const up = parseFloat(q.netChange) >= 0;
                return (
                  <div key={i} className="rounded-lg bg-background/60 border border-border/20 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{q.name}</p>
                    <p className="font-mono text-sm font-bold text-foreground">{q.last}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {up ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-rose-400" />}
                      <span className={`text-xs font-mono font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                        {up ? "+" : ""}{q.pctChange}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Market Mood ── */}
      {mood && (
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" />
              Market Mood
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(mood).slice(0, 8).map(([key, val]: [string, any]) => {
                const sentiment = val?.sentiment || val?.mood || val?.trend || "";
                const value = val?.value || val?.score || val?.percent || val;
                const numVal = typeof value === "number" ? value : parseFloat(value);
                return (
                  <div key={key} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{key}</p>
                    <p className={`font-mono text-lg font-bold ${typeof numVal === "number" && !isNaN(numVal) ? (numVal >= 0 ? "text-emerald-500" : "text-rose-500") : "text-foreground"}`}>
                      {typeof numVal === "number" && !isNaN(numVal) ? (numVal >= 0 ? "+" : "") : ""}
                      {String(value)}
                    </p>
                    {sentiment && (
                      <div className="flex items-center justify-center gap-1">
                        {sentiment.toLowerCase().includes("bull") || sentiment.toLowerCase().includes("pos") ? <TrendingUp className="size-3.5 text-emerald-500" /> : sentiment.toLowerCase().includes("bear") || sentiment.toLowerCase().includes("neg") ? <TrendingDown className="size-3.5 text-rose-500" /> : <Minus className="size-3.5 text-muted-foreground" />}
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {String(sentiment).charAt(0).toUpperCase() + String(sentiment).slice(1)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Bloomberg News Feed ── */}
      <Card className="border-border/30 bg-card/80 backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="size-4 text-blue-500" />
              Bloomberg News
              <Badge variant="outline" className="text-[9px] text-blue-400 border-blue-500/30">LIVE</Badge>
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            </CardTitle>
            <Button variant="ghost" size="icon" className="size-7" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && bloomArticles.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <RefreshCw className="mr-2 size-4 animate-spin" /> Loading Bloomberg news...
            </div>
          ) : bloomArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <Newspaper className="mr-2 size-5 opacity-30" /> No Bloomberg news available
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y divide-border/20">
                {bloomArticles.slice(0, 30).map((article) => (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 shrink-0">
                        {article.type === "video" ? (
                          <Play className="h-3.5 w-3.5 text-violet-400" />
                        ) : article.isPremium ? (
                          <Lock className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <ExternalLink className="h-3 w-3 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {article.category && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                              {article.category}
                            </Badge>
                          )}
                          {article.type === "video" && (
                            <Badge variant="outline" className="text-[9px] text-violet-400 border-violet-500/30 px-1.5 py-0">
                              VIDEO
                            </Badge>
                          )}
                          {article.isPremium && (
                            <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30 px-1.5 py-0">
                              PREMIUM
                            </Badge>
                          )}
                          {timeAgo(article.published) && (
                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                              {timeAgo(article.published)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground hover:text-blue-400 transition-colors line-clamp-2">
                          {article.title}
                        </p>
                        {article.summary && article.summary !== article.title && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
                        )}
                        {article.author && (
                          <p className="mt-1 text-[10px] text-muted-foreground">{article.author}</p>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Forex News (original) ── */}
      {oldNews.length > 0 && (
        <Card className="border-border/30 bg-card/80 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="size-4 text-emerald-500" />
                Forex & Currency News
                {isLive && <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-500"><Globe className="mr-1 size-3" /> LIVE</Badge>}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y divide-border/20">
                {oldNews.slice(0, 20).map((item, idx) => {
                  const title = item.title || item.headline || item.text || item.content || "Untitled";
                  const desc = item.description || item.content || item.text || "";
                  const time = item.publishedAt || item.time || item.date || "";
                  const link = item.url || item.link;
                  return (
                    <div key={idx} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {item.sentiment?.toLowerCase().includes("bull") || item.sentiment?.toLowerCase().includes("pos") ? <TrendingUp className="size-3.5 text-emerald-500" /> : item.sentiment?.toLowerCase().includes("bear") || item.sentiment?.toLowerCase().includes("neg") ? <TrendingDown className="size-3.5 text-rose-500" /> : <Minus className="size-3.5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.source && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{item.source}</Badge>}
                            {item.currency && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{item.currency}</Badge>}
                            {time && <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatTime(time)}</span>}
                          </div>
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2">{title}</a>
                          ) : (
                            <p className="text-sm font-medium text-foreground line-clamp-2">{title}</p>
                          )}
                          {desc && desc !== title && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{desc}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}