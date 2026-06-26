<div align="center">

# 📈 ForexPro Signals

**Professional Real-Time Trading Signal Dashboard**

Live Forex, Stock & Crypto signals with multi-indicator precision analysis, economic calendar, and market intelligence — all in one place.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-latest-black)](https://ui.shadcn.com/)
[![Deployed on Render](https://img.shields.io/badge/Render-deployed-4B2FBB?logo=render)](https://forexpro-signals.onrender.com/)

**Developed by [nayondev](https://github.com/nayondev0x)** | **Live Demo:** [forexpro-signals.onrender.com](https://forexpro-signals.onrender.com/)

</div>

---

## ✨ Features

### 📊 Forex Trading
- **Precision Signal Engine v2** — 8+ technical indicators with 75%+ minimum confidence
- **Multi-Indicator Analysis** — RSI, MACD crossover, EMA 5/10/20, Bollinger Bands, ATR, Candlestick patterns (Engulfing, Hammer, Shooting Star, Doji), Support/Resistance zones, Volatility expansion, Wick rejection
- **Dynamic TP/SL** — 4:1 reward ratio (85%+ signals) / 2.5:1 (75-84% signals) based on real ATR
- **Zero Fake Signals** — No random signals. Every signal needs minimum 5 confluences + 60% dominance
- **Trend Filter** — No counter-trend trades, RSI divergence check, EMA20 distance filter
- **Live Prices** — 9 major/minor currency pairs with real-time bid/ask/spread
- **Live Charts** — Interactive Recharts with Entry/TP/SL reference lines
- **Market Watch** — Currency pair cards with change %, spread, favorites

### 🔌 LIVE ON/OFF Trading Mode
- **Master Switch** — Turn ON when trading, OFF when done
- **Zero API calls when OFF** — Saves free tier limits completely
- **Persistent** — State saved in localStorage, remembers your choice
- **Smart Banner** — Clear OFF state UI with "Start Trading" CTA

### ⚡ 8-Key Smart API System
- **4 Twelve Data + 4 Alpha Vantage keys** — 40+ requests/min capacity
- **Per-key rate limiting** with automatic rotation
- **Cross-API failover** — If one service exhausts, auto-switches to other
- **Multi-layer caching** — Candles 5min / Prices 30s / Signals 20s

### 📅 Economic Calendar
- **227+ Events** — 8 major currencies (USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD)
- **Dual Source** — TradingEconomics (primary) + TraderCalendar (fallback) auto failover
- **Filters** — By currency, impact level (High/Medium/Low), date grouping
- **Actual Data** — Previous, Forecast, and Actual values with color coding

### 📰 Market News
- **Breaking News** — Live forex market news with sentiment analysis
- **Market Mood** — Real-time market sentiment indicators

### 📈 Stock Prices
- **8 Popular Stocks** — AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, NFLX
- **5 Time Ranges** — 1D, 5D, 1M, YTD, All Time
- **Interactive Charts** — Canvas-drawn OHLC charts with area fill
- **Sparklines** — Mini SVG charts on stock list
- **Search** — Search any US stock ticker

### ₿ Crypto
- **21 Crypto Signals** — BTC, ETH, SOL, DOGE, and 17 more pairs
- **Fear & Greed Index** — Circular gauge with gradient color indicator
- **Funding Rates** — Top rates with mark price and direction
- **Market Regime** — Volatility, trend, and breakout detection

### 🎯 Tools & UX
- **Risk Calculator** — Position size, pip value, risk/reward ratio
- **Performance Dashboard** — Win rate pie chart, cumulative pips line chart
- **Dark/Light Theme** — Smooth animated toggle
- **Auto-Refresh** — Configurable polling (prices 30s, signals 20s)
- **Notifications** — Browser notifications + Web Audio sound alerts
- **Favorites** — Star pairs for quick access (persisted in localStorage)

---

## 🛠 Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui (new-york) |
| Charts | Recharts 2 |
| State Management | Zustand 5 (persisted) |
| Animations | Framer Motion 12 |
| Icons | Lucide React |
| Fonts | Geist Sans / Geist Mono |
| APIs | RapidAPI (Twelve Data, Alpha Vantage, TradingEconomics) |
| Deployment | Render (Free Tier) |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main SPA (10 tabs)
│   ├── layout.tsx                  # Root layout + theme
│   └── api/
│       ├── forex/
│       │   ├── prices/             # Live forex prices (8-key dual-API)
│       │   ├── signal/             # Precision Signal Engine v2
│       │   ├── calendar/           # Economic calendar (dual-source)
│       │   ├── news/               # Market news
│       │   ├── price-history/      # OHLC chart data
│       │   ├── indicators/         # RSI, MACD, EMA, etc.
│       │   └── quote/              # Single pair quote
│       ├── stocks/
│       │   └── prices/             # US stock prices (5 ranges)
│       └── crypto/
│           ├── signal/             # 21 crypto pair signals
│           ├── funding-rates/      # Funding rates
│           ├── fear-greed/         # Fear & Greed index
│           └── pairs/              # Available pairs
├── components/
│   ├── forex/                      # 9 forex components
│   ├── stocks/                     # Stock prices component
│   ├── crypto/                     # Crypto signals component
│   └── ui/                         # 50+ shadcn/ui components
├── stores/
│   └── forex-store.ts              # Zustand persisted store (trading mode, favorites)
render.yaml                         # Auto-deploy config for Render
.env.example                        # Environment variable template
```

---

## 🚀 Deployment

### Deploy to Render (Recommended)

1. **Fork or clone** this repository
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. Connect your GitHub repository
4. `render.yaml` will auto-configure the service
5. Set **Environment Variables** in the Render dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `TWELVE_DATA_API_KEY` | Yes | Twelve Data RapidAPI key (Account 1) |
| `TWELVE_DATA_API_KEY_2` | No | Twelve Data key (Account 2) |
| `TWELVE_DATA_API_KEY_3` | No | Twelve Data key (Account 3) |
| `TWELVE_DATA_API_KEY_4` | No | Twelve Data key (Account 4) |
| `ALPHA_VANTAGE_API_KEY` | Yes | Alpha Vantage RapidAPI key (Account 1) |
| `ALPHA_VANTAGE_API_KEY_2` | No | Alpha Vantage key (Account 2) |
| `ALPHA_VANTAGE_API_KEY_3` | No | Alpha Vantage key (Account 3) |
| `ALPHA_VANTAGE_API_KEY_4` | No | Alpha Vantage key (Account 4) |
| `BREAKING_NEWS_API_KEY` | No | Breaking News API key |
| `TRADEDECONOMICS_API_KEY` | No | TradingEconomics Calendar API key |
| `STOCK_PRICES_API_KEY` | No | Stock Prices API key |
| `SELFTRADE_API_KEY` | No | SelfTrade Crypto API key |

> **Tip:** Minimum 1 TD + 1 AV key needed for signals. More keys = more rate limit capacity (up to 8 keys = 40 req/min).

6. Click **Deploy** — your site will be live in ~3 minutes!

### Local Development

```bash
# Install dependencies
npm install

# Copy and fill environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 API Architecture

### 8-Key Smart Rotation System
- **4 Twelve Data + 4 Alpha Vantage keys** from up to 4 RapidAPI accounts
- **Round-robin rotation** — each call uses the next available key
- **Per-key rate limiting** — if a key hits 429, it's cooled down 60s, others continue
- **Cross-API failover** — if TD exhausts, auto-switches to AV and vice versa
- **Smart alternation** — even-indexed pairs try AV first, odd try TD first

### Multi-Layer Caching Strategy
| Layer | TTL | Purpose |
|-------|-----|---------|
| Signal Cache | 20 sec | Same signals shown without re-analysis |
| Price Cache | 30 sec | Price data reused across requests |
| Candle Cache | 5 min | Most expensive API calls minimized |
| LIVE ON/OFF | Manual | Zero API calls when trading mode is OFF |

### Dual-Source Calendar
- **Primary:** TradingEconomics (richer data, 227+ events)
- **Fallback:** TraderCalendar (auto-activates on TE failure)

---

## 📊 API Endpoints

### Forex
| Endpoint | Description |
|----------|-------------|
| `/api/forex/prices` | Live prices for 9 pairs (8-key rotation) |
| `/api/forex/signal` | Precision Engine v2 signals (8+ indicators) |
| `/api/forex/calendar` | Economic calendar (dual-source) |
| `/api/forex/news` | Market news + sentiment |
| `/api/forex/price-history` | OHLC candle data |
| `/api/forex/indicators` | Technical indicators (RSI, MACD, etc.) |

### Stocks
| Endpoint | Description |
|----------|-------------|
| `/api/stocks/prices?ticker=AAPL&range=5d` | Stock price data (1d/5d/1mo/ytd/max) |
| `/api/stocks/prices?action=popular` | 8 popular stocks summary |

### Crypto
| Endpoint | Description |
|----------|-------------|
| `/api/crypto/signal?action=all` | 21 crypto pair signals |
| `/api/crypto/fear-greed` | Fear & Greed Index |
| `/api/crypto/funding-rates` | Top funding rates |
| `/api/crypto/pairs` | Available trading pairs |

---

## 📝 License

This project is developed by **nayondev**. All rights reserved.

---

<div align="center">

**ForexPro Signals** — Real-time trading intelligence at your fingertips

Made with 💚 by [nayondev](https://github.com/nayondev0x)

</div>