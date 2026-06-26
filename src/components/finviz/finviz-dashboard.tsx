"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, Search, Newspaper,
  Users, Building2, BarChart3, Globe2, PieChart, FileText,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ─ Types ─ */
interface FinvizItem {
  ticker?: string;
  name?: string;
  price?: string;
  change?: string;
  changePercent?: string;
  volume?: string;
  [key: string]: string | number | undefined;
}

type SubTab = "forex" | "crypto" | "futures" | "insider" | "news" | "groups" | "map" | "quote" | "screener";

/* ─ Helpers ─ */
function parseChangePercent(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  const s = String(val).replace("%", "").replace("+", "").trim();
  return parseFloat(s) || 0;
}

function ChangeCell({ value }: { value: string | number | undefined }) {
  const num = parseChangePercent(value);
  return (
    <span className={`flex items-center gap-0.5 font-mono text-xs font-bold ${num >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
      {num >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {num >= 0 ? "+" : ""}{num.toFixed(2)}%
    </span>
  );
}

/* ─ Sub-components ─ */
function DataTable({ items, columns, title }: { items: any[]; columns: { key: string; label: string; render?: (v: any, row: any) => React.ReactNode }[]; title: string }) {
  if (items.length === 0) return <div className="flex items-center justify-center py-12 text-muted-foreground/50 text-sm">No data available</div>;
  return (
    <ScrollArea className="max-h-[500px]">
      <Table>
        <TableHeader>
          <TableRow className="border-border/30 hover:bg-transparent">
            {columns.map(c => <TableHead key={c.key} className="text-[10px] whitespace-nowrap">{c.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row: any, i: number) => (
            <TableRow key={i} className="border-border/15 hover:bg-muted/30">
              {columns.map(c => (
                <TableCell key={c.key} className="text-xs py-2">
                  {c.render ? c.render(row[c.key], row) : (
                    c.key === "Change" || c.key === "change" || c.key === "Change %" || c.key === "changePercent" ?
                      <ChangeCell value={row[c.key]} /> :
                      String(row[c.key] ?? "—")
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function InsiderTable({ items }: { items: any[] }) {
  if (!items || items.length === 0) return <div className="flex items-center justify-center py-12 text-muted-foreground/50 text-sm">No insider data</div>;
  const cols = [
    { key: "Ticker", label: "Ticker" },
    { key: "Owner Name", label: "Insider" },
    { key: "Relationship", label: "Role" },
    { key: "Date", label: "Date" },
    { key: "Transaction", label: "Type" },
    { key: "Cost", label: "Cost" },
    { key: "Shares", label: "Shares" },
    { key: "Value", label: "Value ($)" },
    { key: "Sec Filed", label: "Filed" },
  ];
  return <DataTable items={items} columns={cols} title="Insider" />;
}

function NewsCards({ items }: { items: any[] }) {
  if (!items || items.length === 0) return <div className="flex items-center justify-center py-12 text-muted-foreground/50 text-sm">No news</div>;
  return (
    <ScrollArea className="max-h-[500px] pr-2">
      <div className="space-y-2">
        {items.map((n: any, i: number) => (
          <a key={i} href={n.url || n.link || "#"} target="_blank" rel="noopener noreferrer" className="block">
            <Card className="border-border/20 hover:border-border/50 transition-colors cursor-pointer">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  {n.imageUrl || n.image && (
                    <img src={n.imageUrl || n.image} alt="" className="h-16 w-16 rounded-md object-cover flex-shrink-0 bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground line-clamp-2">{n.title || "Untitled"}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">{n.source || n.site || ""}</span>
                      <span className="text-[10px] text-muted-foreground/50">{n.date || n.time || ""}</span>
                    </div>
                    {n.tickers && n.tickers.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {n.tickers.slice(0, 4).map((t: string, j: number) => (
                          <Badge key={j} variant="outline" className="text-[9px] border-border/30">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </ScrollArea>
  );
}

/* ═══════════ MAIN COMPONENT ═══════════ */
export function FinvizDashboard() {
  const [activeSub, setActiveSub] = useState<SubTab>("forex");
  const [forexData, setForexData] = useState<any[]>([]);
  const [cryptoData, setCryptoData] = useState<any[]>([]);
  const [futuresData, setFuturesData] = useState<any[]>([]);
  const [insiderData, setInsiderData] = useState<any[]>([]);
  const [newsData, setNewsData] = useState<any[]>([]);
  const [groupsData, setGroupsData] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [screenerData, setScreenerData] = useState<any[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedTicker, setSelectedTicker] = useState("AAPL");
  const [insiderType, setInsiderType] = useState("1");
  const [screenerSignal, setScreenerSignal] = useState("ta_topgainers");

  const fetchFinviz = useCallback(async (endpoint: string, setter: (d: any) => void, label: string) => {
    setLoading(label);
    setError(null);
    try {
      const r = await fetch(`/api/finviz/${endpoint}`);
      const json = await r.json();
      if (json.error) { setError(json.error); return; }
      // Handle different response shapes
      const items = json.data || json.items || json.results || json;
      if (Array.isArray(items)) setter(items);
      else setter(json.data ?? json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(null); }
  }, []);

  const fetchAll = useCallback((tab: SubTab) => {
    switch (tab) {
      case "forex": fetchFinviz("forex", setForexData, "Forex"); break;
      case "crypto": fetchFinviz("crypto", setCryptoData, "Crypto"); break;
      case "futures": fetchFinviz("futures", setFuturesData, "Futures"); break;
      case "insider": fetchFinviz(`insider?page=1&type=${insiderType}`, setInsiderData, "Insider"); break;
      case "news": fetchFinviz("news", setNewsData, "News"); break;
      case "groups": fetchFinviz("groups?group=sector&view=performance", setGroupsData, "Groups"); break;
      case "map": fetchFinviz("map?period=1d&type=sp500", setMapData, "Map"); break;
      case "quote": fetchFinviz(`quote?ticker=${selectedTicker}`, setQuoteData, "Quote"); break;
      case "screener": fetchFinviz(`screener?offset=1&view=overview&signal=${screenerSignal}&sort=marketcap`, setScreenerData, "Screener"); break;
    }
  }, [fetchFinviz, insiderType, selectedTicker, screenerSignal]);

  useEffect(() => {
    fetchAll(activeSub);
  }, [activeSub, fetchAll]);

  // Autocomplete
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/finviz/autocomplete?query=${encodeURIComponent(searchQuery)}`);
        const json = await r.json();
        setSearchResults(Array.isArray(json.data) ? json.data : json.data?.results || []);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isRefreshing = loading !== null;
  const refresh = () => fetchAll(activeSub);

  // Column definitions for tables
  const forexCols = [
    { key: "ticker", label: "Pair", render: (v: any) => <span className="font-bold text-foreground">{v}</span> },
    { key: "price", label: "Price", render: (v: any) => <span className="font-mono">{v}</span> },
    { key: "change", label: "Change" },
    { key: "changePercent", label: "Change %" },
  ];

  const cryptoCols = [
    { key: "ticker", label: "Crypto", render: (v: any) => <span className="font-bold text-foreground">{v}</span> },
    { key: "price", label: "Price", render: (v: any) => <span className="font-mono">{v}</span> },
    { key: "change", label: "Change" },
    { key: "changePercent", label: "Change %" },
    { key: "volume", label: "Volume" },
  ];

  const futuresCols = [
    { key: "ticker", label: "Contract", render: (v: any) => <span className="font-bold text-foreground">{v}</span> },
    { key: "price", label: "Price", render: (v: any) => <span className="font-mono">{v}</span> },
    { key: "change", label: "Change" },
    { key: "changePercent", label: "Change %" },
  ];

  const screenerCols = [
    { key: "No.", label: "#" },
    { key: "Ticker", label: "Ticker", render: (v: any) => <span className="font-bold text-foreground">{v}</span> },
    { key: "Company", label: "Company" },
    { key: "Sector", label: "Sector" },
    { key: "Price", label: "Price", render: (v: any) => <span className="font-mono">{v}</span> },
    { key: "Change", label: "Change" },
    { key: "Volume", label: "Volume" },
  ];

  const groupsCols = [
    { key: "Name", label: "Sector", render: (v: any) => <span className="font-bold text-foreground">{v}</span> },
    { key: "Number", label: "Stocks" },
    { key: "Change", label: "Day Change" },
    { key: "Perf Week", label: "Week" },
    { key: "Perf Month", label: "Month" },
    { key: "Perf Quarter", label: "Quarter" },
    { key: "Perf Half Y", label: "6M" },
    { key: "Perf Year", label: "YTD" },
  ];

  // Dynamic columns from data keys
  const getDynamicCols = (items: any[], keyBlacklist: string[] = []) => {
    if (!items || items.length === 0) return [];
    const keys = Object.keys(items[0]).filter(k => !keyBlacklist.includes(k));
    return keys.slice(0, 10).map(k => ({ key: k, label: k.replace(/_/g, " ") }));
  };

  const subTabs: { value: SubTab; label: string; icon: any }[] = [
    { value: "forex", label: "Forex", icon: Globe2 },
    { value: "crypto", label: "Crypto", icon: BarChart3 },
    { value: "futures", label: "Futures", icon: TrendingUp },
    { value: "insider", label: "Insider", icon: Users },
    { value: "news", label: "News", icon: Newspaper },
    { value: "groups", label: "Sectors", icon: PieChart },
    { value: "map", label: "Map", icon: Building2 },
    { value: "quote", label: "Quote", icon: FileText },
    { value: "screener", label: "Screener", icon: Search },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border/30 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Finviz Market Data
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-500">10 endpoints</Badge>
            </CardTitle>
            <Button size="sm" variant="outline" onClick={refresh} disabled={isRefreshing} className="gap-1.5">
              <RefreshCw className={`h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={activeSub} onValueChange={v => setActiveSub(v as SubTab)}>
            <TabsList className="flex-wrap h-auto p-1 gap-1 bg-muted/50">
              {subTabs.map(st => (
                <TabsTrigger key={st.value} value={st.value} className="text-[10px] gap-1 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-500">
                  <st.icon className="h-3 w-3" />{st.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Error */}
            {error && (
              <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500">{error}</div>
            )}

            {/* Forex */}
            <TabsContent value="forex">
              {loading === "Forex" ? <LoadingState /> :
                <DataTable items={Array.isArray(forexData) ? forexData : forexData?.data || []} columns={forexData && (Array.isArray(forexData) ? forexData : forexData?.data)?.length > 0 ? getDynamicCols(Array.isArray(forexData) ? forexData : forexData?.data || []) : forexCols} title="Forex" />
              }
            </TabsContent>

            {/* Crypto */}
            <TabsContent value="crypto">
              {loading === "Crypto" ? <LoadingState /> :
                <DataTable items={Array.isArray(cryptoData) ? cryptoData : cryptoData?.data || []} columns={cryptoData && (Array.isArray(cryptoData) ? cryptoData : cryptoData?.data)?.length > 0 ? getDynamicCols(Array.isArray(cryptoData) ? cryptoData : cryptoData?.data || []) : cryptoCols} title="Crypto" />
              }
            </TabsContent>

            {/* Futures */}
            <TabsContent value="futures">
              {loading === "Futures" ? <LoadingState /> :
                <DataTable items={Array.isArray(futuresData) ? futuresData : futuresData?.data || []} columns={futuresData && (Array.isArray(futuresData) ? futuresData : futuresData?.data)?.length > 0 ? getDynamicCols(Array.isArray(futuresData) ? futuresData : futuresData?.data || []) : futuresCols} title="Futures" />
              }
            </TabsContent>

            {/* Insider */}
            <TabsContent value="insider">
              <div className="flex items-center gap-2 mb-3">
                <Select value={insiderType} onValueChange={v => setInsiderType(v)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">All</SelectItem>
                    <SelectItem value="2">Buys</SelectItem>
                    <SelectItem value="3">Sales</SelectItem>
                    <SelectItem value="4">Option Exercises</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {loading === "Insider" ? <LoadingState /> :
                <InsiderTable items={Array.isArray(insiderData) ? insiderData : insiderData?.data || []} />
              }
            </TabsContent>

            {/* News */}
            <TabsContent value="news">
              {loading === "News" ? <LoadingState /> :
                <NewsCards items={Array.isArray(newsData) ? newsData : newsData?.data || []} />
              }
            </TabsContent>

            {/* Groups / Sectors */}
            <TabsContent value="groups">
              {loading === "Groups" ? <LoadingState /> :
                <DataTable items={Array.isArray(groupsData) ? groupsData : groupsData?.data || []} columns={groupsData && (Array.isArray(groupsData) ? groupsData : groupsData?.data)?.length > 0 ? getDynamicCols(Array.isArray(groupsData) ? groupsData : groupsData?.data || []) : groupsCols} title="Groups" />
              }
            </TabsContent>

            {/* Map */}
            <TabsContent value="map">
              {loading === "Map" ? <LoadingState /> : (
                mapData ? (
                  <Card className="border-border/20">
                    <CardContent className="p-4">
                      {mapData.url ? (
                        <iframe src={mapData.url} className="w-full h-[600px] rounded-lg border-0" title="Finviz Map" />
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Map data received. Displaying raw structure:</p>
                          <pre className="text-[10px] font-mono text-foreground/60 bg-muted/30 p-3 rounded-lg overflow-auto max-h-[500px]">{JSON.stringify(mapData, null, 2).substring(0, 3000)}</pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : <div className="flex items-center justify-center py-12 text-muted-foreground/50 text-sm">No map data</div>
              )}
            </TabsContent>

            {/* Quote */}
            <TabsContent value="quote">
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search ticker..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border/50 bg-card shadow-lg max-h-48 overflow-auto">
                      {searchResults.slice(0, 8).map((r: any, i: number) => (
                        <button
                          key={i}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                          onClick={() => { setSelectedTicker(r.ticker || r.symbol || r); setSearchQuery(""); setSearchResults([]); fetchFinviz(`quote?ticker=${r.ticker || r.symbol || r}`, setQuoteData, "Quote"); }}
                        >
                          <span className="font-bold">{r.ticker || r.symbol}</span>
                          <span className="text-muted-foreground truncate max-w-[200px]">{r.name || r.description || ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => fetchFinviz(`quote?ticker=${selectedTicker}`, setQuoteData, "Quote")} disabled={loading === "Quote"} className="h-8 text-xs gap-1">
                  <Search className="h-3 w-3" />Go
                </Button>
              </div>
              {loading === "Quote" ? <LoadingState /> : quoteData ? (
                <Card className="border-border/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="font-bold text-lg">{quoteData.ticker || selectedTicker}</span>
                      {quoteData.companyName && <span className="text-muted-foreground font-normal text-xs">{quoteData.companyName}</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {Object.entries(quoteData).filter(([k]) => !["ticker", "companyName", "source", "timestamp", "url"].includes(k)).slice(0, 20).map(([key, val]) => (
                        <div key={key} className="rounded-lg bg-background/60 p-2.5">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{key.replace(/_/g, " ")}</p>
                          <p className={`text-sm font-bold mt-0.5 ${(key.toLowerCase().includes("change") || key.toLowerCase().includes("perf")) ? (parseChangePercent(String(val)) >= 0 ? "text-emerald-500" : "text-rose-500") : "text-foreground"}`}>{String(val ?? "—")}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : <div className="flex items-center justify-center py-12 text-muted-foreground/50 text-sm">Search a ticker to view quote</div>}
            </TabsContent>

            {/* Screener */}
            <TabsContent value="screener">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Select value={screenerSignal} onValueChange={v => setScreenerSignal(v)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ta_topgainers">Top Gainers</SelectItem>
                    <SelectItem value="ta_toplosers">Top Losers</SelectItem>
                    <SelectItem value="ta_newhigh">New Highs</SelectItem>
                    <SelectItem value="ta_newlow">New Lows</SelectItem>
                    <SelectItem value="ta_mostvolatile">Most Volatile</SelectItem>
                    <SelectItem value="ta_mostactive">Most Active</SelectItem>
                    <SelectItem value="ta_unusualvolume">Unusual Volume</SelectItem>
                    <SelectItem value="">All (no signal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {loading === "Screener" ? <LoadingState /> :
                <DataTable items={Array.isArray(screenerData) ? screenerData : screenerData?.data || screenerData?.items || []} columns={screenerData && (Array.isArray(screenerData) ? screenerData : screenerData?.data || screenerData?.items)?.length > 0 ? getDynamicCols(Array.isArray(screenerData) ? screenerData : screenerData?.data || screenerData?.items || []) : screenerCols} title="Screener" />
              }
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 gap-3">
      <RefreshCw className="h-5 w-5 text-muted-foreground/40 animate-spin" />
      <span className="text-sm text-muted-foreground/50">Loading...</span>
    </div>
  );
}