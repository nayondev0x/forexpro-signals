"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useForexStore } from "@/stores/forex-store";
import {
  Star,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  RefreshCw,
  Filter,
  Radio,
  Power,
  Clock,
} from "lucide-react";

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

const SESSION_OPTIONS = [
  { value: "ALL", label: "All Sessions", flag: "" },
  { value: "Sydney", label: "Sydney", flag: "🇦🇺" },
  { value: "Tokyo", label: "Tokyo", flag: "🇯🇵" },
  { value: "London", label: "London", flag: "🇬🇧" },
  { value: "New York", label: "New York", flag: "🇺🇸" },
];

interface ControlsBarProps {
  refreshing: boolean;
  onRefresh: () => void;
  signalCount: number;
}

export function ControlsBar({
  refreshing,
  onRefresh,
  signalCount,
}: ControlsBarProps) {
  const {
    selectedPair,
    setSelectedPair,
    favorites,
    toggleFavorite,
    isFavorite,
    autoRefresh,
    setAutoRefresh,
    tradingMode,
    setTradingMode,
    notificationsEnabled,
    setNotificationsEnabled,
    soundEnabled,
    setSoundEnabled,
    sessionFilter,
    setSessionFilter,
  } = useForexStore();

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      setNotificationsEnabled(true);
    } else {
      setNotificationsEnabled(false);
    }
  };

  const showFavoritesOnly = selectedPair === "__favorites__";

  const handlePairChange = (value: string) => {
    setSelectedPair(value);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap border-b bg-card/60 px-4 py-2.5">
      {/* Pair Filter */}
      <div className="flex items-center gap-1.5">
        <Filter className="size-3.5 text-muted-foreground" />
        <Select value={selectedPair} onValueChange={handlePairChange}>
          <SelectTrigger size="sm" className="w-[130px]">
            <SelectValue placeholder="All Pairs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Pairs</SelectItem>
            <SelectItem value="__favorites__">⭐ Favorites</SelectItem>
            {COMMON_PAIRS.map((pair) => (
              <SelectItem key={pair} value={pair}>
                {pair}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Session Filter */}
      {tradingMode && (
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-muted-foreground" />
          <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              {SESSION_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.flag ? `${s.flag} ` : ""}{s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Favorites Toggle */}
      {!showFavoritesOnly && selectedPair !== "ALL" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(selectedPair)}
              className="size-8"
            >
              <Star
                className={`size-4 ${
                  isFavorite(selectedPair)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground"
                }`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isFavorite(selectedPair) ? "Remove from favorites" : "Add to favorites"}
          </TooltipContent>
        </Tooltip>
      )}

      {/* LIVE TRADING TOGGLE (Master Switch) */}
      <div className={`flex items-center gap-2 rounded-full px-3 py-1 border transition-all duration-300 ${
        tradingMode
          ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
          : "border-border/40 bg-card/80"
      }`}>
        <Switch
          id="trading-mode"
          checked={tradingMode}
          onCheckedChange={setTradingMode}
          className="data-[state=checked]:bg-emerald-500"
        />
        <Label
          htmlFor="trading-mode"
          className={`text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors ${
            tradingMode ? "text-emerald-500" : "text-muted-foreground"
          }`}
        >
          {tradingMode ? (
            <><Radio className="size-3.5" /> LIVE</>
          ) : (
            <><Power className="size-3.5" /> OFF</>
          )}
        </Label>
      </div>

      {/* Auto-refresh — only active when trading mode ON */}
      {tradingMode && (
        <div className="flex items-center gap-1.5">
          <Switch
            id="auto-refresh"
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
          />
          <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
            Auto
          </Label>
        </div>
      )}

      {/* Notification Bell */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNotificationToggle}
            className="size-8"
          >
            {notificationsEnabled ? (
              <BellRing className="size-4 text-primary" />
            ) : (
              <Bell className="size-4 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {notificationsEnabled ? "Notifications on" : "Enable notifications"}
        </TooltipContent>
      </Tooltip>

      {/* Sound Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="size-8"
          >
            {soundEnabled ? (
              <Volume2 className="size-4 text-primary" />
            ) : (
              <VolumeX className="size-4 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {soundEnabled ? "Sound on" : "Sound off"}
        </TooltipContent>
      </Tooltip>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Signal Count */}
      <span className="text-xs text-muted-foreground hidden sm:inline">
        {signalCount} signal{signalCount !== 1 ? "s" : ""}
      </span>

      {/* Analyze Button — disabled when OFF */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Button
              size="sm"
              onClick={onRefresh}
              disabled={refreshing || !tradingMode}
              className="gap-1.5"
            >
              <RefreshCw
                className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Analyze
            </Button>
          </div>
        </TooltipTrigger>
        {!tradingMode && (
          <TooltipContent>Turn on LIVE mode first</TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}