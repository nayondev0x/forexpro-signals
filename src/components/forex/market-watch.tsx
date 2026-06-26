"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Star } from "lucide-react";
import { formatPrice } from "@/lib/forex-helpers";
import { useForexStore } from "@/stores/forex-store";
import type { PriceData } from "@/lib/forex-types";

interface MarketWatchProps {
  prices: PriceData[];
}

export function MarketWatch({ prices }: MarketWatchProps) {
  if (prices.length === 0) {
    return (
      <Card className="border-border/20 bg-card/40">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">
            Loading market data...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {prices.map((p) => (
        <Card
          key={p.pair}
          className="border-border/30 bg-card/80 backdrop-blur transition-colors hover:border-foreground/20 cursor-pointer"
          onClick={() => {
            useForexStore.getState().setSelectedPair(p.pair);
            useForexStore.getState().setActiveTab("chart");
          }}
        >
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-foreground">
                  {p.pair}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useForexStore.getState().toggleFavorite(p.pair);
                  }}
                  className="p-0.5 hover:bg-muted rounded"
                >
                  <Star
                    className={`h-3 w-3 ${useForexStore.getState().isFavorite(p.pair) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                  />
                </button>
              </div>
              <span
                className={`text-xs font-bold ${p.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"}`}
              >
                {p.changePercent >= 0 ? "+" : ""}
                {p.changePercent.toFixed(3)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Bid
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {formatPrice(p.bid, p.pair)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ask
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {formatPrice(p.ask, p.pair)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/20 pt-2">
              <span className="text-[10px] text-muted-foreground">
                Spread: {p.spread}
              </span>
              {p.changePercent >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-rose-500" />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}