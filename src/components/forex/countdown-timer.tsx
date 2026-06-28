"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, AlertTriangle } from "lucide-react";

export function CountdownTimer({
  signalTimestamp,
  durationSec = 900,
}: {
  signalTimestamp: string;
  durationSec?: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(
    Math.floor(new Date(signalTimestamp).getTime() / 1000)
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(Math.floor(Date.now() / 1000) - startTime.current);
    }, 1000);
    return () => clearInterval(iv);
  }, [signalTimestamp]);

  const remaining = Math.max(0, durationSec - elapsed);
  const pct = Math.min(100, (elapsed / durationSec) * 100);
  const isExpired = remaining <= 0;
  const isWarning = pct > 70 && !isExpired;
  const isCritical = pct > 85 && !isExpired;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="flex items-center gap-2 w-full mt-1">
      {isExpired ? (
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
      ) : (
        <Timer
          className={`h-3.5 w-3.5 flex-shrink-0 ${
            isCritical
              ? "text-rose-400 animate-pulse"
              : isWarning
                ? "text-amber-400"
                : "text-cyan-400"
          }`}
        />
      )}
      <div className="flex-1">
        <div className={`h-1.5 w-full overflow-hidden rounded-full ${isExpired ? "bg-amber-500/20" : isCritical ? "bg-rose-500/20" : "bg-muted"}`}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isExpired
                ? "bg-amber-500 w-full"
                : isCritical
                  ? "bg-rose-500"
                  : isWarning
                    ? "bg-amber-500"
                    : "bg-cyan-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span
        className={`text-xs font-mono font-black flex-shrink-0 tabular-nums ${
          isExpired
            ? "text-amber-500"
            : isCritical
              ? "text-rose-400"
              : isWarning
                ? "text-amber-400"
                : "text-foreground/80"
        }`}
      >
        {isExpired ? "EXPIRED" : `${mins}:${String(secs).padStart(2, "0")}`}
      </span>
    </div>
  );
}