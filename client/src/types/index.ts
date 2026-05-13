export interface QuoteData {
  ticker: string
  name: string
  sector: string
  price: number | null
  change: number | null
  marketCap: number | null
  sharesOut: number | null
  beta: number | null
  pe: number | null
  forwardPE: number | null
  pb: number | null
  week52High: number | null
  week52Low: number | null
  revenue: number | null
  ebitda: number | null
  grossMargin: number | null
  opMargin: number | null
  netMargin: number | null
  fcf: number | null
  fcfMargin: number | null
  totalDebt: number | null
  totalCash: number | null
  netDebt: number
  roe: number | null
  revGrowth: number | null
  earnGrowth: number | null
  bookVal: number | null
  bvps: number | null
  eps: number | null
}

export interface HistoryPoint {
  year: string
  val: number
}

export interface InsiderFiling {
  date: string
  name: string
  url: string
}

export interface SecData {
  cik: string
  filing10K: { date: string; url: string } | null
  filing10Q: { date: string; url: string } | null
  revHistory: HistoryPoint[]
  niHistory: HistoryPoint[]
  fcfHistory: HistoryPoint[]
  insiders: InsiderFiling[]
  insiderLink: string
}

export interface ValuationMethod {
  iv: number
  mos: number   // margin of safety %
  [key: string]: number
}

export interface Valuation {
  dcf:    ValuationMethod | null
  graham: ValuationMethod | null
  pe:     ValuationMethod & { fairPE: number } | null
  evEb:   ValuationMethod & { mult: number } | null
  avg:    number | null
  avgMOS: number | null
  wacc:   number | null
  g1:     number | null
  g2:     number | null
}

export type StockStatus = 'idle' | 'loading-quote' | 'loading-sec' | 'ready' | 'error'

export interface StockEntry {
  ticker: string
  status: StockStatus
  error?: string
  quote?: QuoteData
  sec?: SecData | null
  valuation?: Valuation | null
}
