"use client";

import { Activity } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({
  tradingMode,
  dataSource,
}: {
  tradingMode: boolean;
  dataSource: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              ForexPro<span className="text-emerald-500">Signals</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-2 rounded-full border border-border/40 bg-card/80 px-3 py-1.5 sm:flex">
            <span
              className={`h-2 w-2 rounded-full ${
                tradingMode
                  ? dataSource === "live"
                    ? "bg-emerald-400"
                    : "bg-amber-400"
                  : "bg-zinc-500"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {tradingMode
                ? dataSource === "live"
                  ? "Live"
                  : "Standby"
                : "Off"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}