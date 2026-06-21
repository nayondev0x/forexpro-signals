<div align="center">

# 📈 ForexPro Signals

**Professional Real-Time Trading Signal Dashboard**

Live Forex, Stock & Crypto signals with technical analysis, economic calendar, and market intelligence — all in one place.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-latest-black)](https://ui.shadcn.com/)

**Developed by [nayondev](https://github.com/nayondev0x)**

</div>

---

## ✨ Features

### 📊 Forex Trading
- **Live Prices** — 12 major/minor currency pairs with real-time bid/ask/spread
- **AI Signals** — Technical analysis engine (RSI, MACD, EMA, SMA, Bollinger Bands, ATR)
- **Live Charts** — Interactive Recharts with Entry/TP/SL reference lines
- **Market Watch** — Currency pair cards with change %, spread, favorites

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
- **Price Table** — OHLCV data with color-coded changes
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

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main SPA (11 tabs)
│   ├── layout.tsx                  # Root layout + theme
│   └── api/
│       ├── forex/
│       │   ├── prices/             # Live forex prices (dual-API)
│       │   ├── signal/             # AI trading signals
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
├── lib/
│   └── rapidapi.ts                 # Dual-API key manager
└── stores/
    └── forex-store.ts              # Zustand persisted store
```

---

## 🚀 Deployment

### Deploy to Render (Recommended)

1. **Fork or clone** this repository
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. Connect your GitHub repository
4. `render.yaml` will auto-configure the service
5. Set **Environment Variables** in the Render dashboard:

| Variable | Description |
|----------|-------------|
| `TWELVE_DATA_API_KEY` | Twelve Data RapidAPI key 1 |
| `TWELVE_DATA_API_KEY_2` | Twelve Data RapidAPI key 2 (backup) |
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage RapidAPI key 1 |
| `ALPHA_VANTAGE_API_KEY_2` | Alpha Vantage RapidAPI key 2 (backup) |
| `BREAKING_NEWS_API_KEY` | Breaking News API key |
| `TRADEDECONOMICS_API_KEY` | TradingEconomics Calendar API key |
| `STOCK_PRICES_API_KEY` | Stock Prices API key |
| `SELFTRADE_API_KEY` | SelfTrade Crypto API key |

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

### Dual-API Smart Key System
- **2 RapidAPI accounts × 4 services = 8 API keys**
- Per-key rate limiting with automatic rotation
- Cross-API failover (if one service exhausts, auto-switches)
- Smart alternation: even-indexed pairs → AV first, odd → TD first

### Dual-Source Calendar
- **Primary:** TradingEconomics (richer data, 227+ events)
- **Fallback:** TraderCalendar (auto-activates on TE failure)
- Server-side + client-side filtering

---

## 📊 API Endpoints

### Forex
| Endpoint | Description |
|----------|-------------|
| `/api/forex/prices` | Live prices for 12 pairs |
| `/api/forex/signal` | AI-generated trading signals |
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