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

---
Task ID: 11
Agent: Main Agent
Task: Add Stock Prices feature (stock-prices2 RapidAPI) with 5 time ranges

Work Log:
- Created `/api/stocks/prices/route.ts` — stock-prices2 API integration with 2min cache, batch fetching (3 at a time)
- API supports: ?ticker=X&range=1d/5d/1mo/ytd/max, ?action=popular, ?tickers=A,B,C
- Fixed response normalization: API returns object with datetime keys + capitalized field names (Close, Open, High, Low, Volume)
- Created `src/components/stocks/stock-prices.tsx` — full stock tab UI:
  - Left panel: 8 popular stocks with sparkline SVGs, search bar for custom tickers
  - Right panel: Canvas-drawn OHLC chart with area fill, price stats (High/Low/Open/Volume)
  - Range selector: 1D, 5D, 1M, YTD, All Time
  - Price data table (last 50 entries, color-coded)
- Added "Stocks" tab to main page (orange theme, LineChart icon)
- Updated .env.example and render.yaml with STOCK_PRICES_API_KEY/HOST
- Added STOCK_PRICES_API_KEY and STOCK_PRICES_API_HOST env vars

Stage Summary:
- All 8 popular stocks fetching: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, NFLX
- All 5 ranges working: 1d(1 candle), 5d(5), 1mo(22), ytd(116), max(168)
- Build passing, all routes registered