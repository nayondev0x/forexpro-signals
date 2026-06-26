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
import { BarChart3 } from "lucide-react";
import { ConfidenceBar } from "@/components/forex/confidence-bar";
import { formatTime, formatPrice, getSessionAtTime } from "@/lib/forex-helpers";
import type { ForexSignal } from "@/lib/forex-types";

interface SignalHistoryProps {
  signals: ForexSignal[];
  onSelectSignal: (id: string) => void;
  sessionFilter: string;
}

export function SignalHistory({
  signals,
  onSelectSignal,
  sessionFilter,
}: SignalHistoryProps) {
  if (signals.length === 0) {
    return (
      <Card className="border-border/20 bg-card/40">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">
            No signal history yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <p className="text-sm font-medium text-muted-foreground">
          Signal Performance History
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-96">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-xs">ID</TableHead>
                <TableHead className="text-xs">Pair</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs text-right">Entry</TableHead>
                <TableHead className="text-xs text-right">TP</TableHead>
                <TableHead className="text-xs text-right">SL</TableHead>
                <TableHead className="text-xs">Conf</TableHead>
                <TableHead className="text-xs">Session</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Pips</TableHead>
                <TableHead className="text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signals.map((s) => (
                <TableRow
                  key={s.id}
                  className="border-border/20 cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectSignal(s.id)}
                >
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {s.id.substring(0, 12)}
                  </TableCell>
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
                      className="text-[9px] border-border/30 text-muted-foreground"
                    >
                      {getSessionAtTime(s.timestamp)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${s.status === "TP_HIT" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-rose-500/30 bg-rose-500/10 text-rose-500"}`}
                    >
                      {s.status === "TP_HIT" ? "TP HIT" : "SL HIT"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-xs font-bold ${(s.pips || 0) > 0 ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {(s.pips || 0) > 0 ? "+" : ""}
                    {s.pips || 0}
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