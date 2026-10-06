# Stock Intelligence Dashboard

Vue 3 + Express + TypeScript monorepo.

## Start

```bash
# First time — install all dependencies
pnpm run install:all

# Start both server + client with one command
pnpm run dev
```

Open http://localhost:5173

Server runs on :3001, client on :5173. Both logs appear in the same terminal, color-coded (cyan = server, magenta = client).

## Structure

```
stock-app/
├── client/          Vue 3 + Vite + TypeScript
│   └── src/
│       ├── App.vue
│       ├── components/
│       │   ├── StockCard.vue
│       │   ├── OverviewTab.vue
│       │   ├── ValuationTab.vue
│       │   ├── SecTab.vue
│       │   ├── PriceChartTab.vue
│       │   ├── MultiplesTab.vue
│       │   └── HistoryTab.vue
│       ├── composables/
│       │   ├── useStocks.ts     — watchlist state + API calls
│       │   └── useValuation.ts  — DCF / Graham / P/E / EV-EBITDA / Historical P/E
│       └── types/index.ts
└── server/          Express + TypeScript
    └── src/
        ├── index.ts
        ├── routes/
        │   ├── quote.ts   GET /api/quote/:ticker
        │   ├── sec.ts     GET /api/sec/:ticker
        │   ├── chart.ts   GET /api/chart/:ticker?range=
        │   └── multiples.ts GET /api/multiples/:ticker
        └── services/
            ├── yahoo.ts   — Yahoo Finance (direct, no proxy)
            ├── edgar.ts   — SEC EDGAR (submissions + XBRL facts + EFTS)
            └── multiples.ts — LTM / NTM P/E from 10-Q/10-K EPS, consensus, daily prices
```

## API

| Endpoint | Description | Cache |
|---|---|---|
| `GET /api/quote/:ticker` | Price, margins, FCF, EPS, BVPS… | 5 min |
| `GET /api/sec/:ticker` | Filings, 7-yr history, Form 4 insiders | 1 h |
| `GET /api/chart/:ticker?range=1m\|6m\|1y\|5y` | Closing prices (daily; weekly for 5y) | 5 min / 1 h (5y) |
| `GET /api/multiples/:ticker` | Daily LTM & NTM P/E history, rolling 5Y avg / conservative P/E, implied values | 1 h |
| `GET /api/health` | Healthcheck | — |

## Historical P/E valuation (Multiples tab)

Two multiples, each charted daily with Mean / High / Low / Last for the selected range (1Y–Max):

- **LTM P/E**: price ÷ sum of the last 4 reported quarters' diluted EPS (SEC 10-Q/10-K XBRL). Point-in-time: a quarter counts from its first filing date. Q4 = FY − Q1..Q3. Split-adjusted using Yahoo split events. Matches TIKR / Yahoo trailing P/E (META 27.95× vs TIKR 27.96×).
- **NTM P/E (approximation)**: price ÷ the next 4 quarters' EPS.
  - Reported quarters use actual EPS with tax one-offs removed: EPS × pretax × (1 − median tax rate of the prior 8 quarters) ÷ net income.
  - Unreported quarters use Yahoo `earningsTrend` consensus (0q, +1q, and the FY0 / FY1 remainder spread across the remaining quarters).
  - Historical consensus isn't freely available, so past values use realized earnings. They differ from TIKR / Capital IQ when the company beat or missed expectations.
- **5Y Avg P/E**: rolling mean over the trailing 5 years. **5Y Conservative P/E**: mean of the lowest P/E in each of the five trailing 12-month windows.

Valuation method: `Intrinsic Value = NTM EPS (consensus) × 5Y Conservative NTM P/E`. The LTM equivalent is shown on the tab for reference. Needs US-GAAP 10-Q/10-K filers; 20-F filers (most foreign ADRs) show N/A.
