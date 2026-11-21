import axios from 'axios';
import NodeCache from 'node-cache';
import type { SecData, HistoryPoint, InsiderFiling } from '../types.js';

const cacheShort = new NodeCache({ stdTTL: 3600 });   // 1 h for submissions
const cacheLong  = new NodeCache({ stdTTL: 86400 });  // 24 h for facts (large payload)

// SEC EDGAR requires a User-Agent with contact info, e.g. "StockDashboard/1.0 you@example.com".
// https://www.sec.gov/os/accessing-edgar-data
const SEC_USER_AGENT = process.env.SEC_USER_AGENT ?? 'StockDashboard/1.0';
if (!process.env.SEC_USER_AGENT) {
  console.warn('[edgar] SEC_USER_AGENT is not set; SEC may reject requests without contact info.');
}

const SEC_HEADERS = {
  'User-Agent': SEC_USER_AGENT,
  'Accept-Encoding': 'gzip, deflate',
};

let cikMap: Record<string, string> = {};

async function loadCIKMap() {
  if (Object.keys(cikMap).length > 0) return;
  const { data } = await axios.get('https://www.sec.gov/files/company_tickers.json', {
    headers: SEC_HEADERS,
    timeout: 15000,
  });
  Object.values(data as Record<string, any>).forEach(({ ticker, cik_str }: any) => {
    if (ticker && cik_str) cikMap[String(ticker).toUpperCase()] = String(cik_str).padStart(10, '0');
  });
}

// /api/sec and /api/multiples request the same (large) facts payload concurrently
const factsInFlight = new Map<string, Promise<any>>();

function loadFacts(cik: string): Promise<any> {
  const cached = cacheLong.get<any>(`facts:${cik}`);
  if (cached) return Promise.resolve(cached);
  let p = factsInFlight.get(cik);
  if (!p) {
    p = axios.get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: SEC_HEADERS, timeout: 30000 })
      .then(r => { cacheLong.set(`facts:${cik}`, r.data); return r.data; })
      .finally(() => factsInFlight.delete(cik));
    factsInFlight.set(cik, p);
  }
  return p;
}

/** XBRL company facts for a ticker (cached 24 h); null if the ticker has no CIK. */
export async function getCompanyFacts(ticker: string): Promise<{ cik: string; facts: any } | null> {
  await loadCIKMap();
  const cik = cikMap[ticker.toUpperCase()];
  if (!cik) return null;
  return { cik, facts: await loadFacts(cik) };
}

function extractAnnual(gaap: any, ...concepts: string[]): HistoryPoint[] {
  for (const concept of concepts) {
    const arr: any[] = gaap?.[concept]?.units?.USD;
    if (!arr) continue;
    const annual = arr
      .filter((d: any) => d.form === '10-K' && d.end)
      .sort((a: any, b: any) => b.end.localeCompare(a.end));
    const seen = new Set<string>();
    const deduped = annual.filter((d: any) => {
      const yr = d.end.slice(0, 4);
      if (seen.has(yr)) return false;
      seen.add(yr);
      return true;
    });
    if (deduped.length >= 2) {
      return deduped.slice(0, 8).reverse().map((d: any) => ({ year: d.end.slice(0, 4), val: d.val }));
    }
  }
  return [];
}

export async function fetchSecData(ticker: string): Promise<SecData | null> {
  const key = `sec:${ticker}`;
  const cached = cacheShort.get<SecData>(key);
  if (cached) return cached;

  try {
    await loadCIKMap();
    const cik = cikMap[ticker.toUpperCase()];
    if (!cik) return null;

    const [subs, facts] = await Promise.all([
      axios.get(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: SEC_HEADERS, timeout: 10000 })
        .then(r => r.data),
      loadFacts(cik),
    ]);

    const gaap  = facts?.facts?.['us-gaap'] ?? {};
    const rec   = subs?.filings?.recent ?? {};
    const forms = (rec.form ?? []) as string[];
    const dates = (rec.filingDate ?? []) as string[];
    const accs  = (rec.accessionNumber ?? []) as string[];
    const docs  = (rec.primaryDocument ?? []) as string[];

    const getLatest = (formType: string) => {
      const i = forms.findIndex(f => f === formType);
      if (i === -1) return null;
      const clean = accs[i].replace(/-/g, '');
      return {
        date: dates[i],
        url:  `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${clean}/${docs[i]}`,
      };
    };

    const revH  = extractAnnual(gaap, 'RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet');
    const niH   = extractAnnual(gaap, 'NetIncomeLoss');
    const ocfH  = extractAnnual(gaap, 'NetCashProvidedByUsedInOperatingActivities');
    const capH  = extractAnnual(gaap, 'PaymentsToAcquirePropertyPlantAndEquipment');
    const fcfH: HistoryPoint[] = ocfH.map(d => {
      const cx = capH.find(c => c.year === d.year);
      return { year: d.year, val: d.val - (cx?.val ?? 0) };
    });

    // Insider transactions via EFTS full-text search
    let insiders: InsiderFiling[] = [];
    try {
      const start = new Date();
      start.setMonth(start.getMonth() - 5);
      const sd = start.toISOString().slice(0, 10);
      const { data: efts } = await axios.get(
        'https://efts.sec.gov/LATEST/search-index',
        {
          params: { q: `"${parseInt(cik)}"`, forms: '4', dateRange: 'custom', startdt: sd },
          headers: SEC_HEADERS,
          timeout: 8000,
        }
      );
      insiders = ((efts?.hits?.hits ?? []) as any[]).slice(0, 8).map((h: any) => {
        const acc      = (h._source?.accession_no ?? h._id ?? '') as string;
        const filerCIK = parseInt(acc.split('-')[0]) || 0;
        const clean    = acc.replace(/-/g, '');
        return {
          date: h._source?.file_date ?? '',
          name: (h._source?.entity_name ?? 'Insider') as string,
          url:  `https://www.sec.gov/Archives/edgar/data/${filerCIK}/${clean}/`,
        };
      });
    } catch { /* EFTS can fail silently */ }

    const result: SecData = {
      cik,
      filing10K:   getLatest('10-K'),
      filing10Q:   getLatest('10-Q'),
      revHistory:  revH,
      niHistory:   niH,
      fcfHistory:  fcfH,
      insiders,
      insiderLink: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4&dateb=&owner=include&count=20`,
    };

    cacheShort.set(key, result);
    return result;
  } catch (e: any) {
    console.warn(`SEC fetch failed for ${ticker}:`, e.message);
    return null;
  }
}
