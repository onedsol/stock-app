<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, LineElement, PointElement,
  Filler, Tooltip,
} from 'chart.js'
import type { PricePoint, ChartRange } from '../types/index.js'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip)

const props = defineProps<{ ticker: string; price: number | null }>()

const RANGES: { key: ChartRange; label: string }[] = [
  { key: '1m', label: '1M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
]

const range   = ref<ChartRange>('1y')
const points  = ref<PricePoint[]>([])
const loading = ref(false)
const error   = ref<string | null>(null)
const fetched = new Map<string, PricePoint[]>()
let reqId = 0

async function load() {
  const key = `${props.ticker}:${range.value}`
  const hit = fetched.get(key)
  if (hit) { reqId++; points.value = hit; error.value = null; loading.value = false; return }

  const id = ++reqId
  loading.value = true
  error.value = null
  try {
    const res = await fetch(`/api/chart/${props.ticker}?range=${range.value}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(err.error ?? 'Unknown error')
    }
    const data = await res.json()
    fetched.set(key, data.points)
    // Ignore stale responses if the user switched range mid-request
    if (id === reqId) points.value = data.points
  } catch (e: any) {
    if (id === reqId) { error.value = e.message; points.value = [] }
  } finally {
    if (id === reqId) loading.value = false
  }
}

watch([() => props.ticker, range], load, { immediate: true })

const change = computed(() => {
  const p = points.value
  if (p.length < 2) return null
  return (p[p.length - 1].close - p[0].close) / p[0].close
})

const lineColor = computed(() => (change.value ?? 0) >= 0 ? '#22c55e' : '#ef4444')

const chartData = computed(() => ({
  labels: points.value.map(p => p.date),
  datasets: [{
    label: 'Close',
    data: points.value.map(p => p.close),
    borderColor: lineColor.value,
    backgroundColor: lineColor.value === '#22c55e' ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
    borderWidth: 1.5,
    fill: true,
    pointRadius: 0,
    pointHoverRadius: 3,
    tension: 0.15,
  }],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx: any) => `$${ctx.parsed.y.toFixed(2)}` } },
  },
  scales: {
    x: { ticks: { color: '#7c839e', font: { size: 11 }, maxTicksLimit: 6, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,.04)' } },
    y: { ticks: { color: '#7c839e', font: { size: 11 }, callback: (v: any) => '$' + v }, grid: { color: 'rgba(255,255,255,.04)' } },
  },
}
</script>

<template>
  <div class="hd">
    <div class="ranges">
      <button v-for="r in RANGES" :key="r.key"
        class="rbtn" :class="{ on: range === r.key }"
        @click="range = r.key">
        {{ r.label }}
      </button>
    </div>
    <div v-if="change != null && !loading" class="chg" :class="change >= 0 ? 'up' : 'dn'">
      {{ change >= 0 ? '+' : '' }}{{ (change * 100).toFixed(2) }}%
    </div>
  </div>

  <div v-if="loading" class="loading-msg">
    <div class="spinner" /> Loading price history…
  </div>
  <div v-else-if="error || !points.length" class="no-data">
    {{ error ? `Could not load price history: ${error}` : 'Price history not available for this ticker.' }}
  </div>
  <div v-else class="chart-wrap">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.hd          { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.ranges      { display: flex; gap: 2px; }
.rbtn        { background: none; border: 1px solid transparent; border-radius: var(--rs); padding: 3px 9px; font-size: 11px; font-weight: 500; color: var(--dim); cursor: pointer; }
.rbtn.on     { color: var(--blue); background: var(--blue-bg); border-color: var(--blue-b); }
.rbtn:hover:not(.on) { color: var(--text); }
.chg         { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
.up          { color: var(--green); }
.dn          { color: var(--red); }
.chart-wrap  { position: relative; height: 200px; }
.loading-msg { display: flex; align-items: center; gap: 8px; color: var(--dim); font-size: 13px; }
.no-data     { font-size: 12px; color: var(--muted); }
.spinner     { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.1); border-top-color: #60a5fa; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
