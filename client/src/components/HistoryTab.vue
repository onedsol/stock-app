<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Tooltip, Legend,
} from 'chart.js'
import type { SecData } from '../types/index.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps<{ sec: SecData | null | undefined; loading: boolean }>()

const chartData = computed(() => {
  const sec = props.sec
  if (!sec) return null

  const years = [...new Set([
    ...sec.revHistory.map(d => d.year),
    ...sec.niHistory.map(d => d.year),
    ...sec.fcfHistory.map(d => d.year),
  ])].sort()

  const get = (arr: { year: string; val: number }[], yr: string) => {
    const d = arr.find(x => x.year === yr)
    return d ? +(d.val / 1e9).toFixed(2) : null
  }

  return {
    labels: years,
    datasets: [
      {
        label: 'Revenue ($B)',
        data: years.map(y => get(sec.revHistory, y)),
        backgroundColor: 'rgba(96,165,250,.55)',
        borderColor: '#60a5fa',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'Net Income ($B)',
        data: years.map(y => get(sec.niHistory, y)),
        backgroundColor: 'rgba(34,197,94,.55)',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 3,
      },
      {
        label: 'FCF ($B)',
        data: years.map(y => get(sec.fcfHistory, y)),
        backgroundColor: 'rgba(245,158,11,.55)',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 3,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: $${ctx.parsed.y}B` } },
  },
  scales: {
    x: { ticks: { color: '#7c839e', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.04)' } },
    y: { ticks: { color: '#7c839e', font: { size: 11 }, callback: (v: any) => '$' + v + 'B' }, grid: { color: 'rgba(255,255,255,.04)' } },
  },
}
</script>

<template>
  <div v-if="loading" class="loading-msg">
    <div class="spinner" /> Loading SEC EDGAR history…
  </div>
  <div v-else-if="!sec || (!sec.revHistory.length && !sec.niHistory.length)" class="no-data">
    Historical data not available for this ticker.
  </div>
  <div v-else>
    <div class="chart-wrap">
      <Bar :data="chartData!" :options="chartOptions" />
    </div>
    <div class="legend">
      <div class="ldot"><span class="dot" style="background:#60a5fa" />Revenue</div>
      <div class="ldot"><span class="dot" style="background:#22c55e" />Net Income</div>
      <div class="ldot"><span class="dot" style="background:#f59e0b" />Free Cash Flow</div>
    </div>
  </div>
</template>

<style scoped>
.chart-wrap  { position: relative; height: 200px; margin-bottom: 8px; }
.legend      { display: flex; gap: 14px; font-size: 11px; color: var(--dim); flex-wrap: wrap; }
.ldot        { display: flex; align-items: center; gap: 5px; }
.dot         { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.loading-msg { display: flex; align-items: center; gap: 8px; color: var(--dim); font-size: 13px; }
.no-data     { font-size: 12px; color: var(--muted); }
.spinner     { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.1); border-top-color: #60a5fa; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
