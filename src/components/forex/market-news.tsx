"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Newspaper, RefreshCw, TrendingUp, TrendingDown, Minus, Globe, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NewsItem {
  title?: string;
  headline?: string;
  description?: string;
  text?: string;
  content?: string;
  url?: string;
  link?: string;
  source?: string;
  publishedAt?: string;
  time?: string;
  date?: string;
  sentiment?: string;
  currency?: string;
  impact?: string;
}

export function MarketNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [mood, setMood] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/forex/news");
      const data = await r.json();
      if (data.news && data.news.length > 0 && !data.fallback) {
        setNews(data.news);
        setIsLive(true);
      } else {
        setNews([]);
        setIsLive(false);
      }
      if (data.mood) setMood(data.mood);
    } catch {
      setNews([]);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const getSentimentIcon = (sentiment?: string) => {
    const s = sentiment?.toLowerCase();
    if (s === "bullish" || s === "positive" || s === "up") return <TrendingUp className="size-3.5 text-emerald-500" />;
    if (s === "bearish" || s === "negative" || s === "down") return <TrendingDown className="size-3.5 text-rose-500" />;
    return <Minus className="size-3.5 text-muted-foreground" />;
  };

  const getSentimentColor = (sentiment?: string) => {
    const s = sentiment?.toLowerCase();
    if (s === "bullish" || s === "positive" || s === "up") return "text-emerald-600 dark:text-emerald-400";
    if (s === "bearish" || s === "negative" || s === "down") return "text-rose-600 dark:text-rose-400";
    return "text-muted-foreground";
  };

  const formatNewsTime = (item: NewsItem) => {
    const t = item.publishedAt || item.time || item.date || "";
    if (!t) return "";
    try {
      const d = new Date(t);
      if (isNaN(d.getTime())) return t;
      return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return t;
    }
  };

  const getNewsTitle = (item: NewsItem) => item.title || item.headline || item.text || item.content || "Untitled";

  const getNewsDesc = (item: NewsItem) => item.description || item.content || item.text || "";

  return (
    <div className="space-y-4">
      {/* Market Mood Card */}
      {mood && (
        <Card className="w-full">
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
                        {getSentimentIcon(sentiment)}
                        <span className={`text-[10px] font-medium ${getSentimentColor(sentiment)}`}>
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

      {/* News List */}
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="size-4 text-primary" />
              Market News
            </CardTitle>
            <div className="flex items-center gap-2">
              {isLive && (
                <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-500">
                  <Globe className="mr-1 size-3" /> LIVE
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="size-7" onClick={fetchNews} disabled={loading}>
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && news.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <RefreshCw className="mr-2 size-4 animate-spin" /> Loading news...
            </div>
          ) : news.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Newspaper className="mr-2 size-5 opacity-30" /> No news available right now
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y divide-border/20">
                {news.map((item, idx) => {
                  const title = getNewsTitle(item);
                  const desc = getNewsDesc(item);
                  const time = formatNewsTime(item);
                  const link = item.url || item.link;
                  return (
                    <div key={idx} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">{getSentimentIcon(item.sentiment)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.source && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{item.source}</Badge>
                            )}
                            {item.currency && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">{item.currency}</Badge>
                            )}
                            {time && <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{time}</span>}
                          </div>
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2">
                              {title}
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-foreground line-clamp-2">{title}</p>
                          )}
                          {desc && desc !== title && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{desc}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}