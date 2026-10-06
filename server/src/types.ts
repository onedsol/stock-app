export interface QuoteData {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  change: number | null;
  marketCap: number | null;
  sharesOut: number | null;
  beta: number | null;
  pe: number | null;
  forwardPE: number | null;
  pb: number | null;
  week52High: number | null;
  week52Low: number | null;
  revenue: number | null;
  ebitda: number | null;
  grossMargin: number | null;
  opMargin: number | null;
  netMargin: number | null;
  fcf: number | null;
  fcfMargin: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  netDebt: number;
  roe: number | null;
  revGrowth: number | null;
  earnGrowth: number | null;
  bookVal: number | null;
  bvps: number | null;
  eps: number | null;
}

export interface HistoryPoint {
  year: string;
  val: number;
}

export interface InsiderFiling {
  date: string;
  name: string;
  url: string;
}

export interface SecData {
  cik: string;
  filing10K: { date: string; url: string } | null;
  filing10Q: { date: string; url: string } | null;
  revHistory: HistoryPoint[];
  niHistory: HistoryPoint[];
  fcfHistory: HistoryPoint[];
  insiders: InsiderFiling[];
  insiderLink: string;
}

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

export type ChartRange = '1m' | '6m' | '1y' | '5y';

export interface QuarterEps {
  end: string;       // fiscal quarter end, YYYY-MM-DD
  filed: string;     // first filing date (when the market first saw it)
  eps: number;       // diluted GAAP EPS, split-adjusted to today's share basis
  normEps: number;   // eps with tax one-offs removed (normalized effective tax rate)
}

export interface PEPoint {
  date: string;
  close: number;
  ltmEps: number | null;   // sum of last 4 reported quarters (GAAP)
  ltmPE: number | null;    // null when ltmEps <= 0
  ntmEps: number | null;   // next 4 quarters: actual tax-normalized, else consensus
  ntmPE: number | null;
  est: boolean;            // ntmEps includes consensus estimates
  ltmAvg5y: number | null; // rolling 5-yr mean
  ltmCons5y: number | null;// rolling mean of the five trailing 12-month lows
  ntmAvg5y: number | null;
  ntmCons5y: number | null;
}

export interface MetricSummary {
  eps: number | null;            // current
  pe: number | null;             // current
  avg5y: number | null;
  cons5y: number | null;
  ivConservative: number | null; // eps × cons5y
  ivStandard: number | null;     // eps × avg5y
}

export interface MultiplesData {
  ticker: string;
  firstDate: string;
  quarters: QuarterEps[];
  series: PEPoint[];             // daily, oldest first
  ltm: MetricSummary;
  ntm: MetricSummary;
}
