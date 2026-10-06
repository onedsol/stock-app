import NodeCache from 'node-cache';
import { getCompanyFacts } from './edgar.js';
import { yf } from './yahoo.js';
import type { QuarterEps, PEPoint, MetricSummary, MultiplesData } from '../types.js';

const cache = new NodeCache({ stdTTL: 3600 }); // 1 h

const DAY  = 864e5;
const YEAR = 365.25 * DAY;
const MIN_QUARTERS = 8;

interface Split { date: string; ratio: number }
interface Val { end: string; val: number; filed: string }

const ms     = (d: string) => Date.parse(d);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const mean   = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const round  = (x: number | null, d = 4) => x == null ? null : Math.round(x * 10 ** d) / 10 ** d;

/**
 * Discrete fiscal quarters from XBRL facts, keyed by quarter end.
 * Q4 is rarely reported on its own, so it is derived as FY − (Q1 + Q2 + Q3).
 * Each value comes from its latest filing (restated), availability from its first filing.
 * `adjust` rescales a value given the date it was filed (used for split adjustment of per-share facts).
 */
function quarterly(facts: any[] | undefined, adjust: (val: number, filed: string) => number = v => v): Map<string, Val> {
  const out = new Map<string, Val>();
  if (!facts) return out;

  const pick = (lo: number, hi: number) => {
    const m = new Map<string, { start: string; end: string; val: number; first: string; last: string }>();
    for (const d of facts) {
      if (!d.start || !d.end || !d.filed || !/^10-[KQ]/.test(String(d.form))) continue;
      const days = (ms(d.end) - ms(d.start)) / DAY;
      if (days < lo || days > hi) continue;
      const k = `${d.start}|${d.end}`;
      const c = m.get(k);
      const val = adjust(d.val, d.filed);
      if (!c) m.set(k, { start: d.start, end: d.end, val, first: d.filed, last: d.filed });
      else {
        if (d.filed > c.last)  { c.val = val; c.last = d.filed; }
        if (d.filed < c.first) c.first = d.filed;
      }
    }
    return [...m.values()];
  };

  const qs  = pick(80, 100);
  const fys = pick(350, 380);
  for (const q of qs) out.set(q.end, { end: q.end, val: q.val, filed: q.first });
  for (const fy of fys) {
    if (out.has(fy.end)) continue;
    const inFy = qs.filter(q => q.start >= fy.start && q.end < fy.end);
    if (inFy.length !== 3) continue;
    out.set(fy.end, { end: fy.end, val: fy.val - inFy.reduce((s, q) => s + q.val, 0), filed: fy.first });
  }
  return out;
}

function firstConcept(gaap: any, unit: string, ...concepts: string[]): any[] | undefined {
  for (const c of concepts) if (gaap?.[c]?.units?.[unit]?.length) return gaap[c].units[unit];
  return undefined;
}

/**
 * Quarterly diluted EPS (split-adjusted) plus a tax-normalized variant:
 * EPS × (pretax × (1 − t̂)) / net income, where t̂ is the median effective tax rate of the
 * prior 8 quarters. This strips one-off tax charges/benefits (e.g. META Q3-25) from the NTM proxy.
 */
function extractQuarters(gaap: any, splits: Split[]): QuarterEps[] {
  const splitFactor = (filed: string) => splits.filter(s => s.date > filed).reduce((f, s) => f * s.ratio, 1);
  const eps = quarterly(
    firstConcept(gaap, 'USD/shares', 'EarningsPerShareDiluted', 'EarningsPerShareBasic'),
    (v, filed) => v / splitFactor(filed),
  );
  const ni = quarterly(firstConcept(gaap, 'USD', 'NetIncomeLoss'));
  const pt = quarterly(firstConcept(gaap, 'USD',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
  ));

  const sorted = [...eps.values()].sort((a, b) => a.end.localeCompare(b.end));
  const rate = (end: string) => {
    const p = pt.get(end)?.val, n = ni.get(end)?.val;
    return p != null && n != null && p > 0 ? 1 - n / p : null;
  };

  return sorted.map((q, i) => {
    const prior = sorted.slice(Math.max(0, i - 8), i).map(x => rate(x.end)).filter((r): r is number => r != null);
    const p = pt.get(q.end)?.val, n = ni.get(q.end)?.val;
    let normEps = q.val;
    if (prior.length >= 4 && p != null && n != null && p > 0 && n > 0) {
      const t = Math.min(0.5, Math.max(0, median(prior)));
      normEps = q.val * (p * (1 - t)) / n;
    }
    return { end: q.end, filed: q.filed, eps: q.val, normEps };
  });
}

interface Slot { end: string; eps: number; est: boolean }

/**
 * Consensus EPS for the quarters after the last reported one (Yahoo earningsTrend):
 * 0q / +1q directly; the rest of each fiscal year = FY estimate − known quarters, spread evenly.
 */
function consensusSlots(trend: any[], reported: QuarterEps[]): Slot[] {
  const get = (p: string) => trend.find(t => t.period === p);
  const est = (p: string) => {
    const t = get(p), v = t?.earningsEstimate?.avg;
    return t?.endDate && typeof v === 'number' ? { end: new Date(t.endDate).toISOString().slice(0, 10), v } : null;
  };
  const q0 = est('0q'), q1 = est('+1q'), y0 = est('0y'), y1 = est('+1y');
  const last = reported[reported.length - 1];
  if (!last || !y0) return [];

  const near = (a: string, b: string) => Math.abs(ms(a) - ms(b)) < 20 * DAY;
  const slots: { end: string; eps: number | null }[] = [];
  const d = new Date(last.end);
  for (let k = 1; k <= 6; k++) {
    const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3 * k + 1, 0)).toISOString().slice(0, 10);
    const known = q0 && near(e, q0.end) ? q0.v : q1 && near(e, q1.end) ? q1.v : null;
    slots.push({ end: e, eps: known });
  }

  for (const fy of [y0, y1]) {
    if (!fy) continue;
    const inFy = (end: string) => ms(end) > ms(fy.end) - YEAR + 20 * DAY && ms(end) <= ms(fy.end) + 20 * DAY;
    const rep   = reported.filter(q => inFy(q.end));
    const mine  = slots.filter(s => inFy(s.end));
    const known = mine.filter(s => s.eps != null);
    // a fiscal year has 4 quarters, even if not all of them fall inside the generated slots
    const remaining = 4 - rep.length - known.length;
    if (remaining <= 0) continue;
    const each = (fy.v - rep.reduce((s, q) => s + q.normEps, 0) - known.reduce((s, x) => s + x.eps!, 0)) / remaining;
    for (const s of mine) if (s.eps == null) s.eps = each;
  }
  // beyond the last estimated fiscal year: carry the last FY run-rate
  const runRate = (y1 ?? y0).v / 4;
  return slots.map(s => ({ end: s.end, eps: s.eps ?? runRate, est: true }));
}

/** Rolling 5-yr mean and mean of the five trailing 12-month lows, at every index. */
function rolling(dates: number[], vals: (number | null)[]): { avg: (number | null)[]; cons: (number | null)[] } {
  const n = vals.length;
  const avg: (number | null)[] = new Array(n).fill(null);
  const cons: (number | null)[] = new Array(n).fill(null);
  let lo = 0, sum = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    if (vals[i] != null) { sum += vals[i]!; cnt++; }
    while (dates[lo] <= dates[i] - 5 * YEAR) { if (vals[lo] != null) { sum -= vals[lo]!; cnt--; } lo++; }
    if (cnt >= 250) avg[i] = sum / cnt;

    const lows: number[] = [];
    let j = i;
    for (let w = 1; w <= 5; w++) {
      const from = dates[i] - w * YEAR;
      let min = Infinity;
      while (j >= 0 && dates[j] > from) { if (vals[j] != null && vals[j]! < min) min = vals[j]!; j--; }
      if (min < Infinity) lows.push(min);
    }
    if (lows.length >= 3) cons[i] = mean(lows);
  }
  return { avg, cons };
}

function summary(eps: number | null, pe: number | null, avg: number | null, cons: number | null): MetricSummary {
  const iv = (m: number | null) => eps != null && eps > 0 && m != null && m > 0 ? eps * m : null;
  return { eps, pe, avg5y: avg, cons5y: cons, ivConservative: iv(cons), ivStandard: iv(avg) };
}

export async function fetchMultiples(ticker: string): Promise<MultiplesData | null> {
  const key = `multiples:${ticker}`;
  const cached = cache.get<MultiplesData>(key);
  if (cached) return cached;

  const [company, chart, qs] = await Promise.all([
    getCompanyFacts(ticker),
    yf.chart(ticker, { period1: '2008-01-01', interval: '1d', events: 'split' }) as Promise<any>,
    (yf.quoteSummary(ticker, { modules: ['earningsTrend'] }) as Promise<any>).catch(() => null),
  ]);
  if (!company) return null;

  const splits: Split[] = ((chart?.events?.splits ?? []) as any[])
    .filter(s => s.numerator > 0 && s.denominator > 0)
    .map(s => ({ date: new Date(s.date).toISOString().slice(0, 10), ratio: s.numerator / s.denominator }));

  const quarters = extractQuarters(company.facts?.facts?.['us-gaap'], splits);
  if (quarters.length < MIN_QUARTERS) return null;

  const future = consensusSlots(qs?.earningsTrend?.trend ?? [], quarters);
  const ntmQs: Slot[] = [...quarters.map(q => ({ end: q.end, eps: q.normEps, est: false })), ...future];
  const byFiled = [...quarters].sort((a, b) => a.filed.localeCompare(b.filed) || a.end.localeCompare(b.end));

  const days = ((chart?.quotes ?? []) as any[])
    .filter(q => q.close != null && q.date)
    .map(q => ({ date: new Date(q.date).toISOString().slice(0, 10), close: q.close as number }));

  // LTM: last 4 quarters (by fiscal end) among those filed by each date; must span ~1 year
  const known: QuarterEps[] = [];
  let k = 0, n = 0;
  const raw = [];
  for (const d of days) {
    while (k < byFiled.length && byFiled[k].filed <= d.date) {
      known.push(byFiled[k++]);
      known.sort((a, b) => a.end.localeCompare(b.end));
    }
    const l4 = known.slice(-4);
    const ltmOk = l4.length === 4 && ms(l4[3].end) - ms(l4[0].end) < 300 * DAY;
    const ltmEps = ltmOk ? l4.reduce((s, q) => s + q.eps, 0) : null;

    while (n < ntmQs.length && ntmQs[n].end <= d.date) n++;
    const n4 = ntmQs.slice(n, n + 4);
    const ntmOk = n4.length === 4 && ms(n4[3].end) - ms(n4[0].end) < 300 * DAY;
    const ntmEps = ntmOk ? n4.reduce((s, q) => s + q.eps, 0) : null;

    if (ltmEps == null && ntmEps == null) continue;
    raw.push({
      ...d,
      ltmEps, ntmEps,
      ltmPE: ltmEps != null && ltmEps > 0 ? d.close / ltmEps : null,
      ntmPE: ntmEps != null && ntmEps > 0 ? d.close / ntmEps : null,
      est: ntmOk && n4.some(q => q.est),
    });
  }
  if (!raw.length) return null;

  const t = raw.map(r => ms(r.date));
  const L = rolling(t, raw.map(r => r.ltmPE));
  const N = rolling(t, raw.map(r => r.ntmPE));

  const series: PEPoint[] = raw.map((r, i) => ({
    date: r.date,
    close: round(r.close, 2)!,
    ltmEps: round(r.ltmEps), ltmPE: round(r.ltmPE, 3),
    ntmEps: round(r.ntmEps), ntmPE: round(r.ntmPE, 3),
    est: r.est,
    ltmAvg5y: round(L.avg[i], 3), ltmCons5y: round(L.cons[i], 3),
    ntmAvg5y: round(N.avg[i], 3), ntmCons5y: round(N.cons[i], 3),
  }));

  const i = raw.length - 1, last = raw[i];
  const result: MultiplesData = {
    ticker,
    firstDate: series[0].date,
    quarters,
    series,
    ltm: summary(last.ltmEps, last.ltmPE, L.avg[i], L.cons[i]),
    ntm: summary(last.ntmEps, last.ntmPE, N.avg[i], N.cons[i]),
  };

  cache.set(key, result);
  return result;
}
