"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, DollarSign, Target, AlertTriangle } from "lucide-react";

const COMMON_PAIRS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "NZD/USD",
  "USD/CAD",
  "EUR/GBP",
  "EUR/JPY",
  "GBP/JPY",
  "XAU/USD",
];

function getPipValue(pair: string): number {
  if (pair === "XAU/USD") return 100;
  if (pair.includes("JPY")) return 6.5;
  return 10;
}

export function RiskCalculator() {
  const [balance, setBalance] = useState<string>("10000");
  const [riskPercent, setRiskPercent] = useState<string>("2");
  const [stopLossPips, setStopLossPips] = useState<string>("50");
  const [pair, setPair] = useState<string>("EUR/USD");
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const bal = parseFloat(balance) || 0;
    const risk = parseFloat(riskPercent) || 0;
    const sl = parseFloat(stopLossPips) || 0;
    const pipValue = getPipValue(pair);

    const riskAmount = bal * (risk / 100);
    const lotSize = sl > 0 && pipValue > 0 ? riskAmount / (sl * pipValue) : 0;
    const potentialProfit = lotSize * sl * 2 * pipValue;

    return {
      riskAmount: riskAmount.toFixed(2),
      lotSize: lotSize.toFixed(2),
      pipValue: pipValue.toFixed(2),
      potentialProfit: potentialProfit.toFixed(2),
    };
  }, [balance, riskPercent, stopLossPips, pair]);

  const handleCalculate = () => {
    setCalculated(true);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="size-5 text-primary" />
          Risk Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="balance">Account Balance ($)</Label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="balance"
                type="number"
                placeholder="10000"
                value={balance}
                onChange={(e) => {
                  setBalance(e.target.value);
                  setCalculated(false);
                }}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="risk">Risk per Trade (%)</Label>
            <div className="relative">
              <AlertTriangle className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="risk"
                type="number"
                placeholder="2"
                value={riskPercent}
                onChange={(e) => {
                  setRiskPercent(e.target.value);
                  setCalculated(false);
                }}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sl">Stop Loss (pips)</Label>
            <Input
              id="sl"
              type="number"
              placeholder="50"
              value={stopLossPips}
              onChange={(e) => {
                setStopLossPips(e.target.value);
                setCalculated(false);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pair-select">Currency Pair</Label>
            <Select value={pair} onValueChange={(v) => { setPair(v); setCalculated(false); }}>
              <SelectTrigger id="pair-select" className="w-full">
                <SelectValue placeholder="Select pair" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_PAIRS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleCalculate} className="w-full">
          <Calculator className="size-4" />
          Calculate
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Risk Amount</p>
            <p className="text-xl font-bold font-mono text-foreground">
              ${results.riskAmount}
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Lot Size</p>
            <p className="text-xl font-bold font-mono text-foreground">
              {results.lotSize}
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Pip Value</p>
            <p className="text-xl font-bold font-mono text-foreground">
              ${results.pipValue}
            </p>
          </div>

          <div
            className={`rounded-lg border p-4 space-y-1 ${
              calculated
                ? "border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/5"
                : "border-border/60 bg-muted/30"
            }`}
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Target className="size-3" />
              Potential Profit (2:1)
            </p>
            <p
              className={`text-xl font-bold font-mono ${
                calculated
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
              }`}
            >
              ${results.potentialProfit}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}