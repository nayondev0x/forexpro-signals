"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";

export function CountdownTimer({
  signalTimestamp,
  durationSec = 300,
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
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="flex items-center gap-1.5 w-full">
      <Timer
        className={`h-3 w-3 flex-shrink-0 ${
          isExpired
            ? "text-amber-500"
            : pct > 80
              ? "text-rose-400"
              : "text-cyan-400"
        }`}
      />
      <div className="flex-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isExpired
                ? "bg-amber-500"
                : pct > 80
                  ? "bg-rose-500"
                  : "bg-cyan-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span
        className={`text-[10px] font-mono font-bold flex-shrink-0 ${
          isExpired ? "text-amber-500" : "text-foreground/70"
        }`}
      >
        {isExpired ? "EXPIRED" : `${mins}:${String(secs).padStart(2, "0")}`}
      </span>
    </div>
  );
}