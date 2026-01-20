# Portfolio Tracker - Project Context

## Overview
Portfolio tracking application for Argentine stocks, CEDEARs, and bonds. Built with React + Vercel, using data912.com API for real-time prices.

## Tech Stack
- **Frontend**: React 18 + Vite
- **Styling**: TailwindCSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Data**: data912.com API (free tier)
- **Deployment**: Vercel

## Architecture

### File Structure
```
src/
├── App.jsx                    # Main application (900+ lines - needs refactoring)
├── components/
│   ├── common/
│   │   └── SummaryCard.jsx    # Reusable card component
│   ├── dashboard/
│   │   └── PositionsTable.jsx # Positions table component
│   ├── DistributionChart.jsx  # Asset allocation donut chart
│   └── PositionDetailModal.jsx # Position detail view with historical chart
├── hooks/
│   └── useBondPrices.js       # Bond detection and price utilities
├── services/
│   └── priceService.js        # API fetching logic (NEW)
├── utils/
│   ├── constants.js           # App constants (MEP, TTL, endpoints)
│   ├── formatters.js          # Currency/percentage formatting
│   ├── data912.js             # data912 API wrapper
│   └── portfolioHelpers.js    # Portfolio calculations
└── main.jsx                   # App entry point
```

## Key Features

### Price Sources
1. `/live/mep` - Main endpoint (bonds + CEDEARs with MEP)
2. `/live/arg_stocks` - Argentine stocks (YPFD, GGAL, etc.)
3. `/live/arg_cedears` - CEDEARs with pct_change
4. `/live/arg_bonds` - Peso bonds (TTD26, T15E7, TX26, etc.)

### Historical Data
- `/historical/stocks/{ticker}` - For stocks and CEDEARs
- `/historical/bonds/{ticker}` - For hard dollar bonds (AL30, GD30, etc.)

### Bond Types
- **BONOS PESOS**: TTD26, T15E7, TX26, TX28, S31E5, etc. (price per $1 VN)
- **BONOS HD**: AL30, GD30, AL29, GD29, etc. (price per 100 USD VN)
- **CEDEARs**: GOOGL, AAPL, MSFT, etc.
- **ARGY Stocks**: YPFD, GGAL, PAMP, etc.

## Data Flow
1. App loads → fetchPrices() hits all 4 endpoints
2. Prices stored in localStorage (`portfolio-prices-v3`)
3. Positions calculated from trades + current prices
4. Auto-refresh every 30 seconds
5. Price persistence: keeps last valid price if new price is 0/null

## Known Issues / TODOs
- [ ] App.jsx is too large (900+ lines) - needs component extraction
- [ ] No test coverage
- [ ] Hardcoded MEP fallback (1467)
- [ ] Rate limiting without retry logic
- [ ] No TypeScript types
- [ ] Future: User authentication with Supabase

## Recent Changes
- Phase 1: Code organization (constants, formatters, useBondPrices hook)
- Phase 2: Component extraction and priceService
- Fixed: Multiple syntax errors from rapid development

## Important Functions

### Price Formatting
```javascript
formatARS(value)  // "$1.234.567"
formatUSD(value)  // "US$ 1.234,56"
formatPercent(value) // "+5.25%"
```

### Bond Detection
```javascript
isBonoPesos('TTD26')    // true
isBonoHardDollar('AL30') // true
```

## API Endpoints
- Live prices: `https://data912.com/live/*`
- Historical: `https://data912.com/historical/*`
- Rate limit: 120 req/min
