<script setup lang="ts">
import type { QuoteData } from '../types/index.js'

const props = defineProps<{ quote: QuoteData }>()

function fmt(n: number | null, d = 2) {
  if (n == null) return 'N/A'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function fmtPct(n: number | null, d = 1) {
  if (n == null) return 'N/A'
  return (n * 100).toFixed(d) + '%'
}
function fmtB(n: number | null) {
  if (n == null) return 'N/A'
  const a = Math.abs(n)
  if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (a >= 1e9)  return (n / 1e9).toFixed(2) + 'B'
  if (a >= 1e6)  return (n / 1e6).toFixed(2) + 'M'
  return n.toLocaleString()
}

const q = props.quote
const metrics = [
  { label: 'Market Cap',   value: fmtB(q.marketCap) },
  { label: 'P/E (TTM)',    value: fmt(q.pe, 1) },
  { label: 'Fwd P/E',      value: fmt(q.forwardPE, 1) },
  { label: 'P/B',          value: fmt(q.pb, 2) },
  { label: 'Beta',         value: fmt(q.beta, 2) },
  { label: 'Rev Growth',   value: fmtPct(q.revGrowth), up: (q.revGrowth ?? 0) >= 0 },
  { label: 'Revenue',      value: fmtB(q.revenue) },
  { label: 'EBITDA',       value: fmtB(q.ebitda) },
  { label: 'Free Cash Flow', value: fmtB(q.fcf) },
  { label: 'FCF Margin',   value: fmtPct(q.fcfMargin) },
  { label: 'Op. Margin',   value: fmtPct(q.opMargin) },
  { label: 'Net Margin',   value: fmtPct(q.netMargin) },
  { label: 'Net Debt',     value: fmtB(q.netDebt) },
  { label: 'Book Val/Sh',  value: q.bvps ? '$' + fmt(q.bvps, 2) : 'N/A' },
  { label: 'EPS (TTM)',    value: q.eps ? '$' + fmt(q.eps, 2) : 'N/A' },
  { label: '52W High',     value: '$' + fmt(q.week52High, 2) },
  { label: '52W Low',      value: '$' + fmt(q.week52Low, 2) },
  { label: 'Shares Out',   value: fmtB(q.sharesOut) },
]
</script>

<template>
  <div class="mgrid">
    <div v-for="m in metrics" :key="m.label" class="metric">
      <div class="ml">{{ m.label }}</div>
      <div class="mv" :class="{ up: m.up === true, dn: m.up === false }">{{ m.value }}</div>
    </div>
  </div>
</template>

<style scoped>
.mgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.metric { background: var(--bg2); border-radius: var(--rx); padding: 8px 10px; }
.ml { font-size: 10px; color: var(--dim); margin-bottom: 2px; text-transform: uppercase; letter-spacing: .04em; }
.mv { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.up { color: var(--green); }
.dn { color: var(--red); }
@media (max-width: 480px) { .mgrid { grid-template-columns: repeat(2, 1fr); } }
</style>
