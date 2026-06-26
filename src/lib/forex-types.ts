/* ─ Shared Types for ForexPro Signals ─*/

export interface ForexSignal {
  id: string;
  pair: string;
  type: "BUY" | "SELL";
  entry: number;
  tp: number;
  sl: number;
  timestamp: string;
  status: "ACTIVE" | "TP_HIT" | "SL_HIT" | "CLOSED" | "EXPIRED";
  pips?: number;
  confidence?: number;
  reasoning?: string[];
  indicators?: Record<string, string | number>;
  source?: string;
  apiSource?: string;
  apiKey?: string;
  tradeDuration?: string;
  tpPips?: number;
  slPips?: number;
  engineVersion?: string;
}

export interface PriceData {
  pair: string;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
  source?: string;
}