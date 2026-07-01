"use client";

import { memo } from "react";

/**
 * Lightweight TradingView chart embed — 15min candlestick
 * Used in SignalCard to show the chart at signal time
 */
export const MiniChart = memo(function MiniChart({
  pair,
  height = 200,
}: {
  pair: string;
  height?: number;
}) {
  // Convert pair: EUR/USD → FX:EURUSD
  const symbol = pair.includes("/")
    ? `FX:${pair.replace("/", "")}`
    : pair;

  // TradingView widget embed URL — 15min candles, dark theme, minimal chrome
  const params = new URLSearchParams({
    frameElementId: `mc-${symbol}`,
    symbol,
    interval: "15",
    theme: "dark",
    style: "1",
    locale: "en",
    toolbar_bg: "0d1117",
    enable_publishing: "false",
    allow_symbol_change: "false",
    save_image: "false",
    hide_top_toolbar: "true",
    hide_side_toolbar: "true",
    hide_legend: "false",
    withdateranges: "true",
    hidevolume: "false",
    showpopupbutton: "false",
    studies: "[]",
    studies_overrides: "{}",
    overrides: "{}",
    enabled_features: "[]",
    disabled_features:
      "header_symbol_search,header_screenshot,header_compare,use_localstorage_for_settings,left_toolbar",
    showsource: "false",
    backgroundColor: "0d1117",
    gridColor: "1e222d",
  });

  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-border/20 bg-[#0d1117] relative"
      style={{ height }}
    >
      {/* Subtle overlay gradient at bottom for depth */}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0d1117] to-transparent pointer-events-none z-10" />
      <iframe
        src={`https://s.tradingview.com/widgetembed/?${params.toString()}`}
        className="w-full h-full border-0"
        loading="lazy"
        title={`${pair} 15min Chart`}
        allowTransparency
      />
    </div>
  );
});