<script setup lang="ts">
import { ref, onMounted } from 'vue'
import StockCard from './components/StockCard.vue'
import { useStocks } from './composables/useStocks.js'

const { stocks, addTicker, removeTicker, refreshAll, init } = useStocks()

const input   = ref('')
const loading = ref(false)
const lastUpdated = ref('')

async function handleAdd() {
  const t = input.value.trim()
  if (!t) return
  input.value = ''
  await addTicker(t)
}

async function handleRefresh() {
  loading.value = true
  await refreshAll()
  loading.value = false
  lastUpdated.value = new Date().toLocaleTimeString()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleAdd()
}

onMounted(async () => {
  await init()
  lastUpdated.value = new Date().toLocaleTimeString()
})
</script>

<template>
  <div id="app">
    <div class="topbar">
      <h1><span class="logo">◈</span> Stock Intelligence Dashboard</h1>
      <div class="topbar-right">
        <span v-if="lastUpdated" class="last-update">Updated {{ lastUpdated }}</span>
        <button class="btn btn-primary" :disabled="loading" @click="handleRefresh">
          <span v-if="loading" class="spinner" />
          ↻ Refresh All
        </button>
      </div>
    </div>

    <div class="controls">
      <div class="chips">
        <span v-for="s in stocks" :key="s.ticker" class="chip">
          {{ s.ticker }}
          <button class="chip-rm" @click="removeTicker(s.ticker)">×</button>
        </span>
      </div>
      <div class="add-row">
        <input
          v-model="input"
          type="text"
          placeholder="Ticker (e.g. NVDA)"
          maxlength="10"
          @keydown="handleKeydown"
        />
        <button class="btn btn-primary" @click="handleAdd">+ Add</button>
      </div>
    </div>

    <div class="grid">
      <StockCard
        v-for="entry in stocks"
        :key="entry.ticker"
        :entry="entry"
        @remove="removeTicker"
        @retry="addTicker"
      />
    </div>
  </div>
</template>

<style>
/* Global reset & tokens */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:  #07090f; --bg1: #0d1117; --bg2: #161b27; --bg3: #1e2333;
  --border:  rgba(255,255,255,.06);
  --border2: rgba(255,255,255,.13);
  --text: #dde1ed; --dim: #7c839e; --muted: #434860;
  --green: #22c55e; --green-bg: rgba(34,197,94,.1);  --green-b: rgba(34,197,94,.25);
  --red:   #f43f5e; --red-bg:   rgba(244,63,94,.1);  --red-b:   rgba(244,63,94,.25);
  --yellow:#f59e0b; --yellow-bg:rgba(245,158,11,.1); --yellow-b:rgba(245,158,11,.25);
  --blue:  #60a5fa; --blue-bg:  rgba(96,165,250,.1); --blue-b:  rgba(96,165,250,.25);
  --r: 12px; --rs: 8px; --rx: 5px;
}
html, body {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.5;
}
a { color: var(--blue); text-decoration: none; }
a:hover { text-decoration: underline; }
</style>

<style scoped>
#app { max-width: 1400px; margin: 0 auto; padding: 24px 16px; }

.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
.topbar h1 { font-size: 17px; font-weight: 600; letter-spacing: -.02em; display: flex; align-items: center; gap: 9px; }
.logo { color: var(--blue); font-size: 20px; }
.topbar-right { display: flex; align-items: center; gap: 10px; }
.last-update { font-size: 11px; color: var(--muted); }

.controls { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--r); padding: 14px 16px; margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; min-width: 180px; }
.chip { display: inline-flex; align-items: center; gap: 4px; background: var(--bg3); border: 1px solid var(--border2); border-radius: 20px; padding: 3px 10px 3px 12px; font-size: 12px; font-weight: 600; letter-spacing: .04em; }
.chip-rm { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 15px; line-height: 1; padding: 1px 2px; }
.chip-rm:hover { color: var(--red); }
.add-row { display: flex; gap: 7px; align-items: center; }

input[type=text] { background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--rs); padding: 7px 12px; color: var(--text); font-size: 13px; width: 155px; outline: none; text-transform: uppercase; font-weight: 500; letter-spacing: .04em; }
input[type=text]:focus { border-color: var(--blue); }
input[type=text]::placeholder { text-transform: none; font-weight: 400; letter-spacing: 0; color: var(--muted); }

.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--rs); border: 1px solid var(--border2); background: var(--bg3); color: var(--text); font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.btn:hover { background: var(--bg2); }
.btn:disabled { opacity: .4; pointer-events: none; }
.btn-primary { background: var(--blue-bg); border-color: var(--blue-b); color: var(--blue); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); gap: 14px; }

.spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.15); border-top-color: var(--blue); border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 500px) { .grid { grid-template-columns: 1fr; } }
</style>
