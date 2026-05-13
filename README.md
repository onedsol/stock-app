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
│       │   └── HistoryTab.vue
│       ├── composables/
│       │   ├── useStocks.ts     — watchlist state + API calls
│       │   └── useValuation.ts  — DCF / Graham / P/E / EV-EBITDA
│       └── types/index.ts
└── server/          Express + TypeScript
    └── src/
        ├── index.ts
        ├── routes/
        │   ├── quote.ts   GET /api/quote/:ticker
        │   └── sec.ts     GET /api/sec/:ticker
        └── services/
            ├── yahoo.ts   — Yahoo Finance (direct, no proxy)
            └── edgar.ts   — SEC EDGAR (submissions + XBRL facts + EFTS)
```

## API

| Endpoint | Description | Cache |
|---|---|---|
| `GET /api/quote/:ticker` | Price, margins, FCF, EPS, BVPS… | 5 min |
| `GET /api/sec/:ticker` | Filings, 7-yr history, Form 4 insiders | 1 h |
| `GET /api/health` | Healthcheck | — |
