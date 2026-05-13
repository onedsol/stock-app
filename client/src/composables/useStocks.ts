import { ref, computed } from 'vue'
import type { StockEntry } from '../types/index.js'
import { calcValuation } from './useValuation.js'

const STORAGE_KEY = 'sdi-watchlist'
const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN']

const entries = ref<Map<string, StockEntry>>(new Map())
const tickerOrder = ref<string[]>([])

function loadPersistedList() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    tickerOrder.value = saved ? JSON.parse(saved) : [...DEFAULT_TICKERS]
  } catch {
    tickerOrder.value = [...DEFAULT_TICKERS]
  }
}

function persistList() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickerOrder.value))
}

async function fetchTicker(ticker: string) {
  entries.value.set(ticker, { ticker, status: 'loading-quote' })

  try {
    const qRes = await fetch(`/api/quote/${ticker}`)
    if (!qRes.ok) {
      const err = await qRes.json().catch(() => ({ error: `HTTP ${qRes.status}` }))
      entries.value.set(ticker, { ticker, status: 'error', error: err.error ?? 'Unknown error' })
      return
    }
    const quote = await qRes.json()
    const valuation = calcValuation(quote)

    entries.value.set(ticker, { ticker, status: 'loading-sec', quote, valuation })

    const sRes = await fetch(`/api/sec/${ticker}`)
    const sec  = sRes.ok ? await sRes.json().catch(() => null) : null

    entries.value.set(ticker, { ticker, status: 'ready', quote, valuation, sec })
  } catch (e: any) {
    entries.value.set(ticker, { ticker, status: 'error', error: e.message })
  }
}

async function addTicker(raw: string) {
  const ticker = raw.trim().toUpperCase().replace(/[^A-Z.]/g, '')
  if (!ticker || tickerOrder.value.includes(ticker)) return
  tickerOrder.value.push(ticker)
  persistList()
  await fetchTicker(ticker)
}

function removeTicker(ticker: string) {
  tickerOrder.value = tickerOrder.value.filter(t => t !== ticker)
  entries.value.delete(ticker)
  persistList()
}

async function refreshAll() {
  await Promise.allSettled(tickerOrder.value.map(fetchTicker))
}

async function init() {
  loadPersistedList()
  // Sequential on startup to avoid rate-limiting Yahoo Finance
  for (const t of tickerOrder.value) await fetchTicker(t)
}

const stocks = computed(() =>
  tickerOrder.value.map(t => entries.value.get(t) ?? { ticker: t, status: 'idle' as const })
)

export function useStocks() {
  return { stocks, tickerOrder, addTicker, removeTicker, refreshAll, init }
}
