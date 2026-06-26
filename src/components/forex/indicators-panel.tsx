"use client";

import { useState } from "react";
import { Gauge, ChevronDown, ChevronUp } from "lucide-react";

export function IndicatorsPanel({
  indicators,
}: {
  indicators: Record<string, string | number> | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (!indicators || Object.keys(indicators).length === 0) return null;

  const entries = Object.entries(indicators);
  const displayed = open ? entries : entries.slice(0, 4);

  return (
    <div className="mt-3 border-t border-border/20 pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground/70 transition-colors"
      >
        <span className="flex items-center gap-1">
          <Gauge className="h-3 w-3" /> Technical Indicators
        </span>
        {open ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {displayed.map(([key, value]) => (
          <div key={key} className="rounded-md bg-background/60 px-2 py-1">
            <span className="text-[9px] text-muted-foreground">{key}</span>
            <p className="font-mono text-[11px] font-bold text-foreground/90">
              {String(value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}