"use client";

import { Progress } from "@/components/ui/progress";

export function ConfidenceBar({ confidence }: { confidence: number }) {
  const color =
    confidence >= 80
      ? "bg-emerald-500"
      : confidence >= 60
        ? "bg-amber-500"
        : "bg-rose-500";
  const textColor =
    confidence >= 80
      ? "text-emerald-500"
      : confidence >= 60
        ? "text-amber-500"
        : "text-rose-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold ${textColor}`}>
        {confidence}%
      </span>
    </div>
  );
}