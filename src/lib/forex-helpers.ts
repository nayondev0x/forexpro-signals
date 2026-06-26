/* ─ Shared Helpers for ForexPro Signals ─*/

import type { ForexSignal } from "./forex-types";

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatPrice(price: number, pair: string): string {
  if (pair.includes("XAU") || pair.includes("XAG")) return price.toFixed(2);
  if (pair.includes("JPY")) return price.toFixed(2);
  return price.toFixed(4);
}

export function calcPips(
  entry: number,
  current: number,
  type: "BUY" | "SELL",
  pair: string
): number {
  const diff = type === "BUY" ? current - entry : entry - current;
  return pair.includes("JPY") || pair.includes("XAU") || pair.includes("XAG")
    ? diff
    : diff * 10000;
}

/* ─ Forex Sessions (UTC-based) ─*/
export const SESSIONS = [
  {
    name: "Sydney",
    flag: "🇦🇺",
    startUTC: 21,
    endUTC: 6,
    color: "text-purple-400",
    bg: "bg-purple-500/20",
    border: "border-purple-500/30",
  },
  {
    name: "Tokyo",
    flag: "🇯🇵",
    startUTC: 0,
    endUTC: 9,
    color: "text-rose-400",
    bg: "bg-rose-500/20",
    border: "border-rose-500/30",
  },
  {
    name: "London",
    flag: "🇬🇧",
    startUTC: 7,
    endUTC: 16,
    color: "text-sky-400",
    bg: "bg-sky-500/20",
    border: "border-sky-500/30",
  },
  {
    name: "New York",
    flag: "🇺🇸",
    startUTC: 12,
    endUTC: 21,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
  },
] as const;

export type SessionInfo = (typeof SESSIONS)[number];

export function isSessionActive(s: SessionInfo, utcH: number): boolean {
  return s.startUTC < s.endUTC
    ? utcH >= s.startUTC && utcH < s.endUTC
    : utcH >= s.startUTC || utcH < s.endUTC;
}

export function getActiveSessions(): SessionInfo[] {
  const utcH = new Date().getUTCHours();
  return SESSIONS.filter((s) => isSessionActive(s, utcH));
}

export function getSessionAtTime(iso: string): string {
  const utcH = new Date(iso).getUTCHours();
  for (const s of SESSIONS) {
    if (isSessionActive(s, utcH)) return s.name;
  }
  return "Off-hours";
}