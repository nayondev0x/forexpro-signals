"use client";

import { Activity } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/30 bg-card/40 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            ForexPro<span className="text-emerald-500">Signals</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Developed with{" "}
          <span className="font-semibold text-emerald-500">nayondev</span> &bull;
          Real-time Forex Signals &bull; Powered by RapidAPI
        </p>
        <p className="text-[10px] text-muted-foreground/50">
          &copy; {new Date().getFullYear()} All rights reserved
        </p>
      </div>
    </footer>
  );
}