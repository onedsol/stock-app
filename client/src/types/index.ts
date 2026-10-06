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
  histPE: ValuationMethod & { pe: number; eps: number } | null
  avg:    number | null
  count:  number        // methods included in avg
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
  multiples?: MultiplesData | null
}

export interface PricePoint {
  date: string  // YYYY-MM-DD
  close: number
}

export type ChartRange = '1m' | '6m' | '1y' | '5y'

export interface QuarterEps {
  end: string       // fiscal quarter end
  filed: string     // first filing date
  eps: number       // diluted GAAP EPS, split-adjusted
  normEps: number   // tax-normalized
}

export interface PEPoint {
  date: string
  close: number
  ltmEps: number | null
  ltmPE: number | null
  ntmEps: number | null
  ntmPE: number | null
  est: boolean            // ntmEps includes consensus estimates
  ltmAvg5y: number | null
  ltmCons5y: number | null
  ntmAvg5y: number | null
  ntmCons5y: number | null
}

export interface MetricSummary {
  eps: number | null
  pe: number | null
  avg5y: number | null
  cons5y: number | null
  ivConservative: number | null
  ivStandard: number | null
}

export interface MultiplesData {
  ticker: string
  firstDate: string
  quarters: QuarterEps[]
  series: PEPoint[]
  ltm: MetricSummary
  ntm: MetricSummary
}
