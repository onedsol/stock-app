<script setup lang="ts">
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, LineElement, PointElement,
  Tooltip,
} from 'chart.js'
import type { MultiplesData, PEPoint } from '../types/index.js'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip)

const props = defineProps<{ multiples: MultiplesData | null | undefined; loading: boolean; price: number | null }>()

type Metric = 'ltm' | 'ntm'
type Range  = '1y' | '3y' | '5y' | '10y' | 'max'
const metric = ref<Metric>('ntm')
const range  = ref<Range>('5y')

const YEARS: Record<Range, number> = { '1y': 1, '3y': 3, '5y': 5, '10y': 10, max: Infinity }
const YEAR_MS = 365.25 * 864e5

const spanYears = computed(() => {
  const s = props.multiples?.series ?? []
  return s.length ? (Date.parse(s[s.length - 1].date) - Date.parse(s[0].date)) / YEAR_MS : 0
})

const ranges = computed(() => (Object.keys(YEARS) as Range[]).map(key => ({
  key,
  label: key === 'max' ? 'Max' : key.toUpperCase(),
  disabled: key !== '1y' && key !== 'max' && spanYears.value < YEARS[key] - 0.1,
})))

const visible = computed(() => {
  const s = props.multiples?.series ?? []
  if (!s.length || range.value === 'max') return s
  const from = Date.parse(s[s.length - 1].date) - YEARS[range.value] * YEAR_MS
  return s.filter(p => Date.parse(p.date) > from)
})

const pe   = (p: PEPoint) => metric.value === 'ltm' ? p.ltmPE     : p.ntmPE
const eps  = (p: PEPoint) => metric.value === 'ltm' ? p.ltmEps    : p.ntmEps
const avg  = (p: PEPoint) => metric.value === 'ltm' ? p.ltmAvg5y  : p.ntmAvg5y
const cons = (p: PEPoint) => metric.value === 'ltm' ? p.ltmCons5y : p.ntmCons5y

const summary = computed(() => props.multiples?.[metric.value])

// Mean / High / Low / Last over the selected range and metric
const stats = computed(() => {
  const pts = visible.value.filter(p => pe(p) != null)
  if (!pts.length) return null
  let hi = pts[0], lo = pts[0]
  for (const p of pts) {
    if (pe(p)! > pe(hi)!) hi = p
    if (pe(p)! < pe(lo)!) lo = p
  }
  const mean = pts.reduce((s, p) => s + pe(p)!, 0) / pts.length
  const last = pe(visible.value[visible.value.length - 1])
  return { mean, high: hi, low: lo, last, vsMean: last != null ? (last / mean - 1) * 100 : null }
})

// A year of near-zero earnings can push P/E into the hundreds and flatten everything else,
// so cap the axis near the 95th percentile when that happens.
const yMax = computed<number | undefined>(() => {
  const pes = visible.value.map(pe).filter((v): v is number => v != null).sort((a, b) => a - b)
  if (!pes.length) return undefined
  const p95  = pes[Math.floor(pes.length * 0.95)]
  const refs = visible.value.flatMap(p => [avg(p), cons(p)]).filter((v): v is number => v != null)
  const cap  = Math.max(p95, ...refs) * 1.15
  return pes[pes.length - 1] > cap * 1.3 ? Math.ceil(cap / 10) * 10 : undefined
})

const color = computed(() => metric.value === 'ltm' ? '#a78bfa' : '#60a5fa')

const chartData = computed(() => {
  const v = visible.value, s = stats.value
  return {
    labels: v.map(p => p.date),
    datasets: [
      {
        label: metric.value === 'ltm' ? 'LTM P/E' : 'NTM P/E',
        data: v.map(pe),
        borderColor: color.value,
        borderWidth: 1.5,
        // mark the range high (red) and low (green)
        pointRadius: v.map(p => p === s?.high || p === s?.low ? 3.5 : 0),
        pointBackgroundColor: v.map(p => p === s?.high ? '#ef4444' : '#22c55e'),
        pointBorderWidth: 0,
        pointHoverRadius: 3,
        tension: 0.1,
        spanGaps: false,
      },
      { label: '5Y Avg',          data: v.map(avg),  borderColor: '#7c839e', borderWidth: 1.25, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 0 },
      { label: '5Y Conservative', data: v.map(cons), borderColor: '#f59e0b', borderWidth: 1.25, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 0 },
    ],
  }
})

function monthLabel(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  normalized: true,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: any[]) => items[0]?.label ?? '',
        label: (ctx: any) => ctx.parsed.y == null ? `${ctx.dataset.label}: n/a` : `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}×`,
        afterBody: (items: any[]) => {
          const p = visible.value[items[0]?.dataIndex]
          if (!p) return []
          const e = eps(p)
          const lines = [`Price $${p.close.toFixed(2)} · ${metric.value.toUpperCase()} EPS $${e?.toFixed(2) ?? 'n/a'}`]
          if (metric.value === 'ntm' && p.est) lines.push('incl. consensus estimates')
          return lines
        },
      },
    },
  },
  scales: {
    x: {
      ticks: {
        color: '#7c839e', font: { size: 11 }, maxTicksLimit: 7, maxRotation: 0, autoSkip: true,
        callback: function (this: any, val: any) { return monthLabel(this.getLabelForValue(val)) },
      },
      grid: { color: 'rgba(255,255,255,.04)' },
    },
    y: { min: 0, max: yMax.value, ticks: { color: '#7c839e', font: { size: 11 }, callback: (v: any) => v + '×' }, grid: { color: 'rgba(255,255,255,.04)' } },
  },
}))

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return 'N/A'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const x = (n: number | null | undefined) => n != null ? fmt(n, 2) + '×' : 'N/A'

function mos(iv: number | null | undefined) {
  if (iv == null || !props.price) return null
  return ((iv - props.price) / iv) * 100
}
function mosClass(m: number) {
  return m >= 20 ? 'mos-good' : m >= 0 ? 'mos-ok' : 'mos-bad'
}

const consMos = computed(() => mos(summary.value?.ivConservative))
const stdMos  = computed(() => mos(summary.value?.ivStandard))
</script>

<template>
  <div v-if="loading" class="loading-msg">
    <div class="spinner" /> Loading historical multiples…
  </div>
  <div v-else-if="!multiples" class="no-data">
    Quarterly EPS history not available — company may not file 10-Q/10-Ks with US-GAAP XBRL.
  </div>
  <template v-else>
    <div class="hd">
      <div class="seg">
        <button class="rbtn" :class="{ on: metric === 'ntm' }" @click="metric = 'ntm'" title="Price ÷ next-twelve-months EPS (approximation)">NTM</button>
        <button class="rbtn" :class="{ on: metric === 'ltm' }" @click="metric = 'ltm'" title="Price ÷ last-twelve-months diluted EPS">LTM</button>
      </div>
      <div class="seg">
        <button v-for="r in ranges" :key="r.key"
          class="rbtn" :class="{ on: range === r.key }" :disabled="r.disabled"
          @click="range = r.key">
          {{ r.label }}
        </button>
      </div>
    </div>

    <div class="cur">
      LTM P/E <b>{{ x(multiples.ltm.pe) }}</b>
      <span class="sep">·</span>
      NTM P/E <b>{{ x(multiples.ntm.pe) }}</b>
    </div>

    <div v-if="stats" class="mstats">
      <div class="ms">
        <div class="sl">Mean</div>
        <div class="msv">{{ x(stats.mean) }}</div>
        <div class="msub">{{ range === 'max' ? 'all history' : range.toUpperCase() }}</div>
      </div>
      <div class="ms">
        <div class="sl">High</div>
        <div class="msv dn">{{ x(pe(stats.high)) }}</div>
        <div class="msub">{{ stats.high.date }}</div>
      </div>
      <div class="ms">
        <div class="sl">Low</div>
        <div class="msv up">{{ x(pe(stats.low)) }}</div>
        <div class="msub">{{ stats.low.date }}</div>
      </div>
      <div class="ms">
        <div class="sl">Last</div>
        <div class="msv">{{ x(stats.last) }}</div>
        <div v-if="stats.vsMean != null" class="msub" :class="stats.vsMean <= 0 ? 'up' : 'dn'">
          {{ stats.vsMean >= 0 ? '+' : '' }}{{ stats.vsMean.toFixed(0) }}% vs mean
        </div>
      </div>
    </div>

    <div class="chart-wrap">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div class="legend">
      <div class="ldot"><span class="dot" :style="{ background: color }" />{{ metric.toUpperCase() }} P/E</div>
      <div class="ldot"><span class="dash" style="border-color:#7c839e" />5Y Avg</div>
      <div class="ldot"><span class="dash" style="border-color:#f59e0b" />5Y Conservative</div>
      <div class="ldot"><span class="dot" style="background:#ef4444" />High</div>
      <div class="ldot"><span class="dot" style="background:#22c55e" />Low</div>
      <div v-if="yMax" class="capped">axis capped at {{ yMax }}×</div>
    </div>

    <div v-if="summary" class="sgrid">
      <div class="sc"><div class="sl">{{ metric.toUpperCase() }} EPS</div><div class="sv">${{ fmt(summary.eps) }}</div></div>
      <div class="sc"><div class="sl">5Y Avg P/E</div><div class="sv">{{ x(summary.avg5y) }}</div></div>
      <div class="sc"><div class="sl">5Y Conservative P/E</div><div class="sv">{{ x(summary.cons5y) }}</div></div>
      <div class="sc">
        <div class="sl">IV · Conservative</div>
        <div class="sv">{{ summary.ivConservative != null ? '$' + fmt(summary.ivConservative) : 'N/A' }}</div>
        <div v-if="consMos != null" class="smos" :class="mosClass(consMos)">{{ consMos >= 0 ? '+' : '' }}{{ consMos.toFixed(1) }}% MoS</div>
      </div>
      <div class="sc">
        <div class="sl">IV · Standard Avg</div>
        <div class="sv">{{ summary.ivStandard != null ? '$' + fmt(summary.ivStandard) : 'N/A' }}</div>
        <div v-if="stdMos != null" class="smos" :class="mosClass(stdMos)">{{ stdMos >= 0 ? '+' : '' }}{{ stdMos.toFixed(1) }}% MoS</div>
      </div>
      <div class="sc"><div class="sl">Current Price</div><div class="sv">${{ fmt(price) }}</div></div>
    </div>

    <div class="foot">
      <p><b>LTM</b>: price ÷ sum of the last 4 reported quarters' diluted EPS (SEC 10-Q/10-K, split-adjusted, point-in-time).</p>
      <p>
        <b>NTM (approx.)</b>: price ÷ the next 4 quarters' EPS. Quarters already reported use actual EPS with one-off tax
        effects removed; quarters not yet reported use Yahoo consensus. Historical consensus is not freely available, so past
        values use what the company <i>actually</i> earned. They run low when it beat expectations and high when it missed.
      </p>
      <p>IV = current {{ metric.toUpperCase() }} EPS × 5Y conservative P/E (mean of the lowest P/E in each of the last five 12-month periods). The Valuation tab uses NTM. History from {{ multiples.firstDate.slice(0, 4) }}.</p>
    </div>
  </template>
</template>

<style scoped>
.hd          { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.seg         { display: flex; gap: 2px; }
.rbtn        { background: none; border: 1px solid transparent; border-radius: var(--rs); padding: 3px 9px; font-size: 11px; font-weight: 500; color: var(--dim); cursor: pointer; }
.rbtn.on     { color: var(--blue); background: var(--blue-bg); border-color: var(--blue-b); }
.rbtn:hover:not(.on):not(:disabled) { color: var(--text); }
.rbtn:disabled { opacity: .35; cursor: default; }
.cur         { font-size: 12px; color: var(--dim); font-variant-numeric: tabular-nums; margin-bottom: 8px; }
.cur b       { color: var(--text); font-weight: 600; }
.sep         { margin: 0 6px; color: var(--muted); }
.mstats      { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
.ms          { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--rs); padding: 6px 9px; }
.msv         { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.msub        { font-size: 10px; color: var(--muted); margin-top: 1px; }
.msub.up, .msv.up { color: var(--green); }
.msub.dn, .msv.dn { color: var(--red); }
.chart-wrap  { position: relative; height: 200px; margin-bottom: 8px; }
.legend      { display: flex; gap: 14px; font-size: 11px; color: var(--dim); flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
.ldot        { display: flex; align-items: center; gap: 5px; }
.dot         { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dash        { width: 14px; border-top: 2px dashed; display: inline-block; }
.capped      { margin-left: auto; color: var(--muted); }
.sgrid       { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
.sc          { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--rs); padding: 8px 10px; }
.sl          { font-size: 10px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px; }
.sv          { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.smos        { font-size: 11px; font-weight: 600; margin-top: 2px; }
.mos-good    { color: var(--green); }
.mos-ok      { color: var(--yellow); }
.mos-bad     { color: var(--red); }
.foot        { font-size: 10px; color: var(--muted); line-height: 1.5; }
.foot p      { margin: 0 0 4px; }
.loading-msg { display: flex; align-items: center; gap: 8px; color: var(--dim); font-size: 13px; }
.no-data     { font-size: 12px; color: var(--muted); }
.spinner     { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.1); border-top-color: #60a5fa; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 480px) { .sgrid, .mstats { grid-template-columns: 1fr 1fr; } }
</style>
