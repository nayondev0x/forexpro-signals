---
Task ID: 1-10
Agent: Main Agent
Task: Implement Features 1-10 for ForexPro Signals (excluding 11-Telegram Bot, 12-User Auth)

Work Log:
- Fixed critical bugs: added `activeTab`/`setActiveTab` to Zustand store, fixed `selectedPair` default from "EUR/USD" to "ALL"
- Fixed filter logic for pair filter + favorites mode (__favorites__ special handling)
- Made Tabs controlled with `value={activeTab}` instead of uncontrolled `defaultValue`
- Added new API keys to .env.local: TRADER_CALENDAR_API_KEY/HOST, BREAKING_NEWS_API_KEY/HOST
- Created `/api/forex/calendar/route.ts` - live economic calendar via trader-calendar.p.rapidapi.com with 30min cache
- Created `/api/forex/price-history/route.ts` - historical price data via Alpha Vantage FX_INTRADAY with 5min cache
- Created `/api/forex/news/route.ts` - market news via myallies-breaking-news-v1.p.rapidapi.com with 10min cache
- Updated EconomicCalendar component: live API with fallback to static data, grouped by date, LIVE badge
- Updated PriceChart component: real OHLC data from API, ComposedChart with Line+Area+ReferenceLines
- Updated SignalDetailSheet: added Chart/Details tabs, chart shows price line with Entry/TP/SL reference lines
- Created MarketNews component: market mood display + news list with sentiment indicators
- Added News tab to main page with Newspaper icon
- Fixed duplicate Area elements in PriceChart (replaced with Line+Area)
- All builds passing, server running on port 3000

Stage Summary:
- Feature 1 (Live Price Charts): Recharts with real AV FX_INTRADAY data
- Feature 2 (Economic Calendar): Live trader-calendar API + fallback
- Feature 3 (Risk Calculator): Already implemented, working
- Feature 4 (Signal Detail Page): Sheet with Chart tab (Entry/TP/SL lines) + Details tab
- Feature 5 (Dark/Light Theme): Already implemented via next-themes
- Feature 6 (Notification System): Browser notifications + Web Audio API sound alert
- Feature 7 (Favorite Pairs): Zustand persisted, star toggle on cards + market watch
- Feature 8 (Performance Dashboard): PieChart + LineChart with win rate, cumulative pips
- Feature 9 (Auto-refresh Toggle): Switch in controls bar, persisted in Zustand
- Feature 10 (Pair-wise Filter): Select dropdown with ALL/Favorites/individual pairs
- Bonus: Market News tab with live API integration