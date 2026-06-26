import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SignalResult {
  id: string;
  pair: string;
  type: "BUY" | "SELL";
  entry: number;
  tp: number;
  sl: number;
  status: "TP_HIT" | "SL_HIT" | "EXPIRED";
  pips: number;
  confidence: number;
  timestamp: string;
}

interface ForexStore {
  favorites: string[];
  toggleFavorite: (pair: string) => void;
  isFavorite: (pair: string) => boolean;
  selectedPair: string;
  setSelectedPair: (pair: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  tradingMode: boolean;
  setTradingMode: (v: boolean) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  selectedSignalId: string | null;
  setSelectedSignalId: (id: string | null) => void;
  sessionFilter: string;
  setSessionFilter: (v: string) => void;
  // v4.0 new: win/loss tracking
  signalHistory: SignalResult[];
  addSignalResult: (r: SignalResult) => void;
  wins: number;
  losses: number;
}

export const useForexStore = create<ForexStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (pair: string) => {
        const favs = get().favorites;
        set({ favorites: favs.includes(pair) ? favs.filter((p) => p !== pair) : [...favs, pair] });
      },
      isFavorite: (pair: string) => get().favorites.includes(pair),
      selectedPair: "ALL",
      setSelectedPair: (pair: string) => set({ selectedPair: pair }),
      activeTab: "active",
      setActiveTab: (tab: string) => set({ activeTab: tab }),
      autoRefresh: true,
      setAutoRefresh: (v: boolean) => set({ autoRefresh: v }),
      tradingMode: false,
      setTradingMode: (v: boolean) => set({ tradingMode: v }),
      notificationsEnabled: false,
      setNotificationsEnabled: (v: boolean) => set({ notificationsEnabled: v }),
      soundEnabled: true,
      setSoundEnabled: (v: boolean) => set({ soundEnabled: v }),
      selectedSignalId: null,
      setSelectedSignalId: (id: string | null) => set({ selectedSignalId: id }),
      sessionFilter: "ALL",
      setSessionFilter: (v: string) => set({ sessionFilter: v }),
      // v4.0: win/loss tracking
      signalHistory: [],
      addSignalResult: (r: SignalResult) => {
        const hist = get().signalHistory;
        const updated = [r, ...hist].slice(0, 100); // keep last 100
        const wins = updated.filter((s) => s.status === "TP_HIT").length;
        const losses = updated.filter((s) => s.status === "SL_HIT" || s.status === "EXPIRED").length;
        set({ signalHistory: updated, wins, losses });
      },
      wins: 0,
      losses: 0,
    }),
    {
      name: "forex-prefs",
      partialize: (s) => ({
        favorites: s.favorites,
        autoRefresh: s.autoRefresh,
        tradingMode: s.tradingMode,
        notificationsEnabled: s.notificationsEnabled,
        soundEnabled: s.soundEnabled,
        selectedPair: s.selectedPair,
        activeTab: s.activeTab,
        sessionFilter: s.sessionFilter,
        signalHistory: s.signalHistory,
        wins: s.wins,
        losses: s.losses,
      }),
    }
  )
);