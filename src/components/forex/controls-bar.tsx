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
    notificationsEnabled,
    setNotificationsEnabled,
    soundEnabled,
    setSoundEnabled,
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
          <SelectTrigger size="sm" className="w-[140px]">
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

      {/* Favorites Toggle - applies to current selected pair */}
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

      {/* Auto-refresh Switch */}
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

      {/* Analyze Button */}
      <Button
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="gap-1.5"
      >
        <RefreshCw
          className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
        />
        Analyze
      </Button>
    </div>
  );
}