"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { ConfidenceBar } from "@/components/forex/confidence-bar";
import { formatTime, formatPrice, getSessionAtTime } from "@/lib/forex-helpers";

interface HistoryEntry {
  id: string;
  pair: string;
  type: "BUY" | "SELL";
  entry: number;
  tp: number;
  sl: number;
  status: "TP_HIT" | "SL_HIT" | "EXPIRED";
  pips: number;
  confidence: number;
  timestamp: string;
}

interface SignalHistoryProps {
  signals: HistoryEntry[];
  onSelectSignal: (id: string) => void;
  sessionFilter: string;
}

export function SignalHistory({
  signals,
  onSelectSignal,
  sessionFilter,
}: SignalHistoryProps) {
  // Stats from signals
  const tpCount = signals.filter((s) => s.status === "TP_HIT").length;
  const slCount = signals.filter((s) => s.status === "SL_HIT").length;
  const expCount = signals.filter((s) => s.status === "EXPIRED").length;
  const total = tpCount + slCount + expCount;
  const winRate = total > 0 ? ((tpCount / total) * 100).toFixed(1) : "--";

  // Filter by session
  const filtered = sessionFilter === "ALL"
    ? signals
    : signals.filter((s) => getSessionAtTime(s.timestamp) === sessionFilter);

  if (filtered.length === 0) {
    return (
      <Card className="border-border/20 bg-card/40">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">
            No signal history yet
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Completed signals (TP Hit / SL Hit / Expired) will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Signal Performance History
          </p>
          {total > 0 && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-bold text-emerald-500">{tpCount}</span>
              </span>
              <span className="flex items-center gap-1 text-xs">
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                <span className="font-bold text-rose-500">{slCount}</span>
              </span>
              <span className="flex items-center gap-1 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-bold text-amber-500">{expCount}</span>
              </span>
              <Badge
                variant="outline"
                className={`text-xs font-bold ${
                  parseFloat(winRate) >= 60
                    ? "border-emerald-500/30 text-emerald-500"
                    : "border-amber-500/30 text-amber-500"
                }`}
              >
                WR: {winRate}%
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-xs">Pair</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs text-right">Entry</TableHead>
                <TableHead className="text-xs text-right">TP</TableHead>
                <TableHead className="text-xs text-right">SL</TableHead>
                <TableHead className="text-xs">Conf</TableHead>
                <TableHead className="text-xs">Result</TableHead>
                <TableHead className="text-xs text-right">Pips</TableHead>
                <TableHead className="text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow
                  key={s.id}
                  className={`border-border/20 cursor-pointer hover:bg-muted/50 ${
                    s.status === "TP_HIT"
                      ? "bg-emerald-500/5"
                      : s.status === "SL_HIT"
                        ? "bg-rose-500/5"
                        : ""
                  }`}
                  onClick={() => onSelectSignal(s.id)}
                >
                  <TableCell className="text-xs font-bold text-foreground">
                    {s.pair}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${s.type === "BUY" ? "border-emerald-500/30 text-emerald-500" : "border-rose-500/30 text-rose-500"}`}
                    >
                      {s.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatPrice(s.entry, s.pair)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-500">
                    {formatPrice(s.tp, s.pair)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-rose-500">
                    {formatPrice(s.sl, s.pair)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.confidence ? (
                      <ConfidenceBar confidence={s.confidence} />
                    ) : (
                      "--"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold flex items-center gap-1 w-fit ${
                        s.status === "TP_HIT"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : s.status === "SL_HIT"
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {s.status === "TP_HIT" && <CheckCircle2 className="h-3 w-3" />}
                      {s.status === "SL_HIT" && <XCircle className="h-3 w-3" />}
                      {s.status === "EXPIRED" && <AlertTriangle className="h-3 w-3" />}
                      {s.status === "TP_HIT" ? "TP HIT" : s.status === "SL_HIT" ? "SL HIT" : "EXPIRED"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs font-bold ${
                      s.pips > 0
                        ? "text-emerald-500"
                        : s.pips < 0
                          ? "text-rose-500"
                          : "text-amber-500"
                    }`}
                  >
                    {s.pips > 0 ? "+" : ""}
                    {s.pips}
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">
                    {formatTime(s.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}