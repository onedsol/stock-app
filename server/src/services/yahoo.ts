// yahoo-finance2 v3 — must instantiate the class
import YahooFinance from 'yahoo-finance2';
import NodeCache from 'node-cache';
import type { QuoteData } from '../types.js';

const cache = new NodeCache({ stdTTL: 300 }); // 5 min
const yf = new (YahooFinance as any)();

export async function fetchQuote(ticker: string): Promise<QuoteData> {
  const key = `quote:${ticker}`;
  const cached = cache.get<QuoteData>(key);
  if (cached) return cached;

  // yahoo-finance2 handles session/crumb internally
  const r: any = await yf.quoteSummary(ticker, {
    modules: [
      'price',
      'summaryDetail',
      'defaultKeyStatistics',
      'financialData',
      'cashflowStatementHistory',
      'balanceSheetHistory',
      'incomeStatementHistory',
      'assetProfile',
    ],
  });

  const price = r?.price                                                     ?? {};
  const fin   = r?.financialData                                             ?? {};
  const ks    = r?.defaultKeyStatistics                                      ?? {};
  const bs    = r?.balanceSheetHistory?.balanceSheetStatements?.[0]          ?? {};
  const is0   = r?.incomeStatementHistory?.incomeStatementHistory?.[0]       ?? {};
  const prof  = r?.assetProfile                                              ?? {};

  const sharesOut = ks.sharesOutstanding ?? price.sharesOutstanding ?? null;
  const totalDebt = fin.totalDebt  ?? bs.longTermDebt ?? null;
  const totalCash = fin.totalCash  ?? bs.cash         ?? null;
  const bookVal   = bs.totalStockholdersEquity ?? null;
  const bvps      = bookVal && sharesOut ? bookVal / sharesOut : null;
  const eps       = ks.trailingEps ?? (is0.netIncomeLoss && sharesOut ? is0.netIncomeLoss / sharesOut : null);
  const fcf       = fin.freeCashflow ?? null;
  const revenue   = fin.totalRevenue ?? null;

  const result: QuoteData = {
    ticker,
    name:        price.longName    ?? price.shortName ?? ticker,
    sector:      prof.sector       ?? '',
    price:       price.regularMarketPrice         ?? null,
    change:      price.regularMarketChangePercent ?? null,
    marketCap:   price.marketCap   ?? null,
    sharesOut,
    beta:        ks.beta           ?? null,
    pe:          ks.trailingPE     ?? null,
    forwardPE:   ks.forwardPE      ?? null,
    pb:          ks.priceToBook    ?? null,
    week52High:  ks.fiftyTwoWeekHigh  ?? price.fiftyTwoWeekHigh ?? null,
    week52Low:   ks.fiftyTwoWeekLow   ?? price.fiftyTwoWeekLow  ?? null,
    revenue,
    ebitda:      fin.ebitda          ?? null,
    grossMargin: fin.grossMargins     ?? null,
    opMargin:    fin.operatingMargins ?? null,
    netMargin:   fin.profitMargins    ?? null,
    fcf,
    fcfMargin:   fcf && revenue ? fcf / revenue : null,
    totalDebt,
    totalCash,
    netDebt:     (totalDebt ?? 0) - (totalCash ?? 0),
    roe:         fin.returnOnEquity ?? null,
    revGrowth:   fin.revenueGrowth  ?? null,
    earnGrowth:  fin.earningsGrowth ?? null,
    bookVal,
    bvps,
    eps,
  };

  cache.set(key, result);
  return result;
}
