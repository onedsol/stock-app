<script setup lang="ts">
import { computed } from 'vue'
import type { Valuation, ValuationMethod } from '../types/index.js'

const props = defineProps<{ valuation: Valuation; price: number; loading?: boolean }>()

function fmt(n: number | null, d = 2) {
  if (n == null) return 'N/A'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function mosClass(mos: number) {
  return mos >= 20 ? 'mos-good' : mos >= 0 ? 'mos-ok' : 'mos-bad'
}
function cardClass(mos: number) {
  return mos >= 20 ? 'card-good' : mos >= 0 ? 'card-ok' : 'card-bad'
}

interface MethodRow {
  label: string
  method: ValuationMethod | null
  note: string
  pending?: boolean
}

// computed: histPE arrives after SEC/multiples load and replaces the valuation prop
const methods = computed<MethodRow[]>(() => {
  const v = props.valuation
  return [
    { label: 'DCF — Discounted Cash Flow', method: v.dcf,    note: '' },
    { label: 'Graham Number',              method: v.graham, note: '√(22.5 × EPS × BVPS)' },
    { label: 'P/E Fair Value',             method: v.pe,     note: v.pe ? `Fair P/E: ${v.pe.fairPE.toFixed(1)}` : '' },
    { label: 'EV/EBITDA Fair Value',       method: v.evEb,   note: v.evEb ? `${v.evEb.mult}× multiple` : '' },
    {
      label: 'Historical P/E',
      method: v.histPE,
      note: v.histPE ? `NTM EPS $${fmt(v.histPE.eps)} × 5Y cons. NTM P/E ${v.histPE.pe.toFixed(1)}×` : '',
      pending: props.loading,
    },
  ]
})
</script>

<template>
  <div class="vgrid">
    <div
      v-for="m in methods"
      :key="m.label"
      class="vc"
      :class="m.method ? cardClass(m.method.mos) : ''"
    >
      <div class="vm">{{ m.label }}</div>
      <template v-if="m.method">
        <div class="vp">${{ fmt(m.method.iv) }}</div>
        <div class="vmos" :class="mosClass(m.method.mos)">
          {{ m.method.mos >= 0 ? '+' : '' }}{{ m.method.mos.toFixed(1) }}% MoS
        </div>
        <div v-if="m.note" class="vnote">{{ m.note }}</div>
      </template>
      <div v-else-if="m.pending" class="vpending"><div class="spinner" /> Loading history…</div>
      <div v-else class="vp na">N/A</div>
    </div>
  </div>

  <div v-if="valuation.avg" class="vsummary">
    <div>
      <div class="vs-label">Average Fair Value ({{ valuation.count }} method{{ valuation.count === 1 ? '' : 's' }})</div>
      <div class="vs-val">
        ${{ fmt(valuation.avg) }}
        <span :class="mosClass(valuation.avgMOS ?? 0)" style="font-size:13px">
          ({{ (valuation.avgMOS ?? 0) >= 0 ? '+' : '' }}{{ (valuation.avgMOS ?? 0).toFixed(1) }}% MoS)
        </span>
      </div>
    </div>
    <div style="text-align:right">
      <div class="vs-label">Current Price</div>
      <div class="vs-val">${{ fmt(price) }}</div>
    </div>
  </div>

  <div class="vassume">
    <template v-if="valuation.wacc">
      <span>WACC: {{ ((valuation.wacc ?? 0) * 100).toFixed(1) }}%</span>
      <span>Growth yr1–5: {{ ((valuation.g1 ?? 0) * 100).toFixed(1) }}%</span>
      <span>Growth yr6–10: {{ ((valuation.g2 ?? 0) * 100).toFixed(1) }}%</span>
      <span>Terminal: 3.0%</span>
    </template>
  </div>
</template>

<style scoped>
.vgrid  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.vc     { background: var(--bg2); border-radius: var(--rs); padding: 10px 12px; border: 1px solid var(--border); }
.card-good { background: var(--green-bg); border-color: var(--green-b); }
.card-ok   { background: var(--yellow-bg); border-color: var(--yellow-b); }
.card-bad  { background: var(--red-bg); border-color: var(--red-b); }
.vm    { font-size: 10px; color: var(--dim); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
.vp    { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.vmos  { font-size: 11px; font-weight: 600; margin-top: 3px; }
.vnote { font-size: 10px; color: var(--dim); margin-top: 3px; }
.na    { color: var(--muted); }
.vc:last-child:nth-child(odd) { grid-column: span 2; }
.vpending { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dim); padding: 4px 0; }
.spinner  { width: 11px; height: 11px; border: 2px solid rgba(255,255,255,.1); border-top-color: #60a5fa; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.mos-good { color: var(--green); }
.mos-ok   { color: var(--yellow); }
.mos-bad  { color: var(--red); }
.vsummary { background: var(--bg3); border-radius: var(--rs); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
.vs-label { font-size: 11px; color: var(--dim); margin-bottom: 2px; }
.vs-val   { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.vassume  { font-size: 11px; color: var(--dim); display: flex; flex-wrap: wrap; gap: 4px 14px; }
@media (max-width: 480px) { .vgrid { grid-template-columns: 1fr; } .vc:last-child:nth-child(odd) { grid-column: auto; } }
</style>
