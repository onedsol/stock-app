import type { QuoteData, Valuation, ValuationMethod } from '../types/index.js'

const SECTOR_PE: Record<string, number> = {
  Technology: 20, 'Communication Services': 18, 'Consumer Discretionary': 22,
  'Consumer Staples': 18, 'Health Care': 20, Financials: 13, Industrials: 18,
  Energy: 12, Materials: 14, 'Real Estate': 28, Utilities: 16, default: 18,
}
const SECTOR_EVEBITDA: Record<string, number> = {
  Technology: 22, 'Communication Services': 14, 'Consumer Discretionary': 16,
  'Consumer Staples': 14, 'Health Care': 18, Financials: 11, Industrials: 13,
  Energy: 8, Materials: 10, 'Real Estate': 20, Utilities: 12, default: 14,
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function mos(iv: number, price: number) { return ((iv - price) / iv) * 100 }

function calcWACC(beta: number | null, debt: number | null, mcap: number | null): number {
  const b  = clamp(beta ?? 1, 0.3, 3)
  const ke = 0.045 + b * 0.055
  const tot = (mcap ?? 0) + (debt ?? 0)
  const we  = tot > 0 ? (mcap ?? 0) / tot : 0.85
  return we * ke + (1 - we) * 0.055 * (1 - 0.21)
}

function calcDCF(y: QuoteData): (ValuationMethod & { g1: number; g2: number; wacc: number }) | null {
  if (!y.fcf || y.fcf <= 0 || !y.sharesOut || !y.price) return null
  const w = calcWACC(y.beta, y.totalDebt, y.marketCap)
  if (w <= 0.03) return null
  const g1 = clamp(y.revGrowth ?? 0.08, 0.02, 0.28)
  const g2 = g1 * 0.5
  let fcf = y.fcf
  let pv  = 0
  for (let i = 1; i <= 5; i++) { fcf *= (1 + g1); pv += fcf / Math.pow(1 + w, i) }
  for (let i = 6; i <= 10; i++) { fcf *= (1 + g2); pv += fcf / Math.pow(1 + w, i) }
  pv += (fcf * 1.03) / (w - 0.03) / Math.pow(1 + w, 10)
  const eq = pv + (y.totalCash ?? 0) - (y.totalDebt ?? 0)
  if (eq <= 0) return null
  const iv = eq / y.sharesOut
  return { iv, mos: mos(iv, y.price), g1, g2, wacc: w }
}

function calcGraham(y: QuoteData): ValuationMethod | null {
  if (!y.eps || y.eps <= 0 || !y.bvps || y.bvps <= 0 || !y.price) return null
  const iv = Math.sqrt(22.5 * y.eps * y.bvps)
  return { iv, mos: mos(iv, y.price) }
}

function calcPE(y: QuoteData): (ValuationMethod & { fairPE: number }) | null {
  if (!y.eps || y.eps <= 0 || !y.price) return null
  const spe    = SECTOR_PE[y.sector] ?? SECTOR_PE.default
  const g      = y.earnGrowth ?? y.revGrowth ?? 0.08
  const fairPE = Math.min(spe, clamp(g * 100 * 1.1, 8, 35))
  const iv     = y.eps * fairPE
  return { iv, mos: mos(iv, y.price), fairPE }
}

function calcEVEB(y: QuoteData): (ValuationMethod & { mult: number }) | null {
  if (!y.ebitda || y.ebitda <= 0 || !y.sharesOut || !y.price) return null
  const mult = SECTOR_EVEBITDA[y.sector] ?? SECTOR_EVEBITDA.default
  const eq   = y.ebitda * mult - (y.netDebt ?? 0)
  if (eq <= 0) return null
  const iv = eq / y.sharesOut
  return { iv, mos: mos(iv, y.price), mult }
}

export function calcValuation(y: QuoteData): Valuation {
  const dcf    = calcDCF(y)
  const graham = calcGraham(y)
  const pe     = calcPE(y)
  const evEb   = calcEVEB(y)

  const methods = [dcf, graham, pe, evEb].filter((m): m is ValuationMethod => !!m && m.iv > 0 && m.iv < 1e7)
  const avg     = methods.length ? methods.reduce((s, m) => s + m.iv, 0) / methods.length : null
  const avgMOS  = avg && y.price ? mos(avg, y.price) : null

  return {
    dcf, graham, pe, evEb, avg, avgMOS,
    wacc: dcf?.wacc ?? null,
    g1:   dcf?.g1   ?? null,
    g2:   dcf?.g2   ?? null,
  }
}
