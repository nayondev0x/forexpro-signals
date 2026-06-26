"use client";

import { Card, CardContent } from "@/components/ui/card";

export function SignalCardSkeleton() {
  return (
    <Card className="border-border/20 bg-card/40 animate-pulse">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="space-y-1.5">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-2.5 w-28 rounded bg-muted/60" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-5 w-12 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted/60" />
          </div>
        </div>
        <div className="h-16 rounded-lg bg-muted/40" />
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/40 h-12" />
          <div className="rounded-lg bg-muted/40 h-12" />
          <div className="rounded-lg bg-muted/40 h-12" />
        </div>
        <div className="flex justify-between pt-2 border-t border-border/10">
          <div className="h-3 w-20 rounded bg-muted/40" />
          <div className="h-5 w-16 rounded bg-muted/40" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PriceCardSkeleton() {
  return (
    <Card className="border-border/20 bg-card/40 animate-pulse">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-3 w-14 rounded bg-muted/60" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="h-2.5 w-8 rounded bg-muted/50" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
          <div className="space-y-1">
            <div className="h-2.5 w-8 rounded bg-muted/50" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsCardSkeleton() {
  return (
    <Card className="border-border/20 bg-card/40 animate-pulse">
      <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
        <div className="h-4 w-4 rounded bg-muted" />
        <div className="h-6 w-12 rounded bg-muted" />
        <div className="h-2.5 w-16 rounded bg-muted/60" />
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border-border/20 bg-card/40 animate-pulse">
      <CardContent className="p-4 space-y-3">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="h-3 w-12 rounded bg-muted/50" />
              <div className="h-3 w-16 rounded bg-muted/50" />
              <div className="h-3 w-10 rounded bg-muted/50" />
              <div className="flex-1" />
              <div className="h-3 w-14 rounded bg-muted/50" />
              <div className="h-3 w-20 rounded bg-muted/50" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card className="border-border/20 bg-card/40 animate-pulse">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-6 w-12 rounded bg-muted/50" />
            <div className="h-6 w-12 rounded bg-muted/50" />
          </div>
        </div>
        <div className="h-[300px] rounded-lg bg-muted/30 flex items-end gap-1 px-2 pb-2">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-muted/50 rounded-t"
              style={{ height: `${20 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function HeatmapSkeleton() {
  return (
    <Card className="border-border/20 bg-card/40 animate-pulse">
      <CardContent className="p-4 space-y-3">
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="h-2.5 w-64 rounded bg-muted/50" />
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/40" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}