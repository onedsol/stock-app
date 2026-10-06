<script setup lang="ts">
import { ref } from 'vue'
import type { StockEntry } from '../types/index.js'
import OverviewTab   from './OverviewTab.vue'
import ValuationTab  from './ValuationTab.vue'
import SecTab        from './SecTab.vue'
import HistoryTab    from './HistoryTab.vue'
import PriceChartTab from './PriceChartTab.vue'

const props = defineProps<{ entry: StockEntry }>()
const emit  = defineEmits<{ remove: [ticker: string]; retry: [ticker: string] }>()

const activeTab = ref<'overview' | 'chart' | 'valuation' | 'sec' | 'history'>('overview')

function fmt(n: number | null, d = 2) {
  if (n == null) return 'N/A'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
</script>

<template>
  <div class="card" :class="{ err: entry.status === 'error' }">
    <!-- Header -->
    <div class="card-hd">
      <div class="card-left">
        <span class="sym">{{ entry.ticker }}</span>
        <div v-if="entry.quote" class="cname">{{ entry.quote.name }}</div>
        <div v-if="entry.quote?.sector" class="sector-tag">{{ entry.quote.sector }}</div>
      </div>

      <div v-if="entry.quote" class="card-price">
        <div class="pval">${{ fmt(entry.quote.price) }}</div>
        <div class="pchg" :class="(entry.quote.change ?? 0) >= 0 ? 'up' : 'dn'">
          {{ (entry.quote.change ?? 0) >= 0 ? '+' : '' }}{{ fmt((entry.quote.change ?? 0) * 100, 2) }}% today
        </div>
      </div>

      <div v-else-if="entry.status === 'loading-quote'" class="loading-price">
        <div class="spinner" />
      </div>

      <div class="card-actions">
        <button v-if="entry.status === 'error'" class="btn-retry" @click="emit('retry', entry.ticker)">↻ Retry</button>
        <button class="rm-btn" @click="emit('remove', entry.ticker)">×</button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="entry.status === 'loading-quote'" class="load-msg">
      <div class="spinner" /> Fetching {{ entry.ticker }}…
    </div>

    <!-- Error state -->
    <div v-else-if="entry.status === 'error'" class="err-msg">
      <div>⚠ Could not load data</div>
      <div class="err-detail">{{ entry.error }}</div>
    </div>

    <!-- Ready state -->
    <template v-else-if="entry.quote">
      <div class="tabs">
        <button v-for="t in ['overview','chart','valuation','sec','history']" :key="t"
          class="tab" :class="{ on: activeTab === t }"
          @click="activeTab = t as any">
          {{ t.charAt(0).toUpperCase() + t.slice(1) }}
        </button>
      </div>

      <div class="pane">
        <OverviewTab  v-if="activeTab === 'overview'"  :quote="entry.quote" />
        <PriceChartTab v-if="activeTab === 'chart'"   :ticker="entry.ticker" :price="entry.quote.price" />
        <ValuationTab v-if="activeTab === 'valuation'" :valuation="entry.valuation!" :price="entry.quote.price!" />
        <SecTab       v-if="activeTab === 'sec'"       :sec="entry.sec" :loading="entry.status === 'loading-sec'" />
        <HistoryTab   v-if="activeTab === 'history'"   :sec="entry.sec" :loading="entry.status === 'loading-sec'" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.card      { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--r); overflow: hidden; transition: border-color .2s; }
.card:hover{ border-color: var(--border2); }
.card.err  { border-color: var(--red-b); }

.card-hd   { padding: 14px 16px 12px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--border); }
.card-left .sym { font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
.cname     { font-size: 11px; color: var(--dim); margin-top: 2px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sector-tag{ display: inline-block; font-size: 10px; background: var(--bg2); border: 1px solid var(--border); border-radius: 20px; padding: 1px 8px; color: var(--dim); margin-top: 4px; }
.card-price{ text-align: right; flex-shrink: 0; }
.pval      { font-size: 19px; font-weight: 600; font-variant-numeric: tabular-nums; }
.pchg      { font-size: 11px; margin-top: 2px; font-weight: 500; }
.loading-price { display: flex; align-items: center; padding: 6px 0; }
.card-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.btn-retry { background: var(--blue-bg); border: 1px solid var(--blue-b); color: var(--blue); border-radius: var(--rs); padding: 4px 10px; font-size: 11px; cursor: pointer; }
.rm-btn    { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 18px; padding: 2px 4px; border-radius: 4px; line-height: 1; }
.rm-btn:hover { color: var(--red); }

.load-msg  { display: flex; align-items: center; gap: 10px; padding: 20px 16px; color: var(--dim); font-size: 13px; }
.err-msg   { padding: 12px 16px; color: var(--red); font-size: 12px; }
.err-detail{ color: var(--muted); font-size: 11px; margin-top: 4px; }

.tabs { display: flex; border-bottom: 1px solid var(--border); padding: 0 14px; gap: 2px; }
.tab  { background: none; border: none; border-bottom: 2px solid transparent; padding: 8px 10px; font-size: 12px; font-weight: 500; color: var(--dim); cursor: pointer; margin-bottom: -1px; transition: color .15s, border-color .15s; white-space: nowrap; }
.tab.on { color: var(--blue); border-bottom-color: var(--blue); }
.tab:hover:not(.on) { color: var(--text); }

.pane { padding: 14px 16px; }

.up { color: var(--green); }
.dn { color: var(--red); }

.spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.1); border-top-color: var(--blue); border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
