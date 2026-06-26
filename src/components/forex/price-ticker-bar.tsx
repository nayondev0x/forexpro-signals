"use client";

import { formatPrice } from "@/lib/forex-helpers";
import type { PriceData } from "@/lib/forex-types";

export function PriceTickerBar({ prices }: { prices: PriceData[] }) {
  return (
    <div className="w-full overflow-hidden border-b border-border/40 bg-card/60 backdrop-blur">
      <div className="flex animate-scroll items-center gap-6 px-4 py-2">
        {[...prices, ...prices, ...prices, ...prices].map((p, i) => (
          <div
            key={`${p.pair}-${i}`}
            className="flex shrink-0 items-center gap-2 text-xs"
          >
            <span className="font-semibold text-foreground/90">{p.pair}</span>
            <span className="font-mono text-foreground/80">
              {formatPrice(p.bid, p.pair)}
            </span>
            <span
              className={
                p.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"
              }
            >
              {p.changePercent >= 0 ? "+" : ""}
              {p.changePercent.toFixed(3)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}