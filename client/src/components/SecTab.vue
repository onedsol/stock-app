<script setup lang="ts">
import type { SecData } from '../types/index.js'

defineProps<{ sec: SecData | null | undefined; loading: boolean }>()
</script>

<template>
  <div v-if="loading" class="sec-loading">
    <div class="spinner" /> Fetching SEC EDGAR data…
  </div>
  <div v-else-if="!sec" class="no-data">
    SEC data unavailable — ticker may not be US-listed on EDGAR.
  </div>
  <div v-else>
    <div class="sec-sect">
      <h4>Latest Filings</h4>
      <div v-if="sec.filing10K" class="frow">
        <span class="fname">10-K Annual Report</span>
        <span class="fdate">{{ sec.filing10K.date }}</span>
        <a :href="sec.filing10K.url" target="_blank" rel="noopener">Open ↗</a>
      </div>
      <div v-if="sec.filing10Q" class="frow">
        <span class="fname">10-Q Quarterly Report</span>
        <span class="fdate">{{ sec.filing10Q.date }}</span>
        <a :href="sec.filing10Q.url" target="_blank" rel="noopener">Open ↗</a>
      </div>
    </div>

    <div class="sec-sect">
      <h4>
        Insider Transactions (Form 4)
        <a :href="sec.insiderLink" target="_blank" rel="noopener" class="see-all">All on EDGAR ↗</a>
      </h4>
      <div v-if="sec.insiders.length === 0" class="no-data">
        No Form 4 filings found in last 5 months —
        <a :href="sec.insiderLink" target="_blank" rel="noopener">check EDGAR</a>
      </div>
      <div v-for="f in sec.insiders" :key="f.url" class="irow">
        <span class="iname">{{ f.name }}</span>
        <span class="idate">{{ f.date }}</span>
        <a :href="f.url" target="_blank" rel="noopener">View ↗</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sec-loading { display: flex; align-items: center; gap: 8px; color: var(--dim); font-size: 13px; padding: 8px 0; }
.no-data     { font-size: 12px; color: var(--muted); padding: 4px 0; }
.sec-sect    { margin-bottom: 14px; }
.sec-sect h4 { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: 7px; font-weight: 600; }
.see-all     { font-size: 10px; font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 8px; }
.frow, .irow { display: flex; align-items: center; gap: 8px; padding: 7px 10px; background: var(--bg2); border-radius: var(--rx); margin-bottom: 4px; font-size: 12px; }
.fname, .iname { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fdate, .idate { color: var(--dim); font-size: 11px; flex-shrink: 0; }
a { color: var(--blue); font-size: 11px; flex-shrink: 0; }
.spinner { width: 13px; height: 13px; border: 2px solid var(--border2); border-top-color: var(--blue); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
