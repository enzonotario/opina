<script setup lang="ts">
import { onMounted, ref } from 'vue'

type OpinaApi = {
  show: (surveyId?: string) => void
  hide: () => void
  setMeta: (meta: Record<string, unknown>) => void
  setLocale: (locale: string) => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    Opina?: OpinaApi
  }
}

const log = ref<string[]>([])
const ready = ref(false)
const surveyId = ref('')

function push(line: string) {
  const time = new Date().toLocaleTimeString()
  log.value = [`[${time}] ${line}`, ...log.value].slice(0, 40)
}

function waitForOpina(timeoutMs = 5000) {
  return new Promise<OpinaApi>((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (window.Opina) {
        resolve(window.Opina)
        return
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('window.Opina not available — is make dev running on :3000?'))
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

onMounted(async () => {
  try {
    const opina = await waitForOpina()
    opina.setLocale('es')
    opina.setMeta({ demo: true, source: 'apps/demo' })
    opina.on('shown', (payload) => push(`shown ${JSON.stringify(payload)}`))
    opina.on('submit', (payload) => push(`submit ${JSON.stringify(payload)}`))
    opina.on('dismiss', () => push('dismiss'))
    opina.on('suppressed', (payload) => push(`suppressed ${JSON.stringify(payload)}`))
    ready.value = true
    push('window.Opina ready')

    const origin = window.location.origin
    const res = await fetch(
      `http://localhost:3000/api/v1/widget/config?key=pk_zuog15csvosgycph`,
    )
    if (!res.ok) {
      push(`config HTTP ${res.status} — allow origin ${origin} on the project`)
      return
    }
    const data = await res.json() as { surveys: Array<{ id: string }> }
    surveyId.value = data.surveys[0]?.id || ''
    push(`config ok — surveys=${data.surveys.length}`)
  }
  catch (e) {
    push(e instanceof Error ? e.message : 'boot failed')
  }
})

function openWidget() {
  window.Opina?.show(surveyId.value || undefined)
}

function hideWidget() {
  window.Opina?.hide()
}

function clearFrequency() {
  const removed: string[] = []
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('opina:freq:')) {
      localStorage.removeItem(key)
      removed.push(key)
    }
  }
  push(removed.length ? `cleared frequency (${removed.length})` : 'no frequency keys')
}
</script>

<template>
  <main>
    <h1>Opina demo</h1>
    <p class="lead">
      Site de prueba en <code>http://localhost:3001</code> que carga el widget desde
      <code>http://localhost:3000</code> (proyecto <strong>test</strong>).
    </p>

    <section class="card">
      <p class="muted">
        Project key: <code>pk_zuog15csvosgycph</code>
        <span v-if="surveyId"> · survey: <code>{{ surveyId }}</code></span>
      </p>
      <div class="row">
        <button :disabled="!ready" type="button" @click="openWidget">
          Dar feedback
        </button>
        <button
          class="secondary"
          data-opina
          type="button"
        >
          Abrir con data-opina
        </button>
        <button class="secondary" type="button" @click="hideWidget">
          Hide
        </button>
        <button class="secondary" type="button" @click="clearFrequency">
          Reset frequency
        </button>
      </div>
      <p class="muted" style="margin: 12px 0 0">
        Los triggers automáticos respetan la frecuencia (localStorage).
        <code>Opina.show()</code> y <code>data-opina</code> siempre abren.
      </p>
    </section>

    <section class="card">
      <p class="muted">
        Event log
      </p>
      <pre class="log">{{ log.join('\n') || '…' }}</pre>
    </section>

    <section class="card">
      <p class="muted">
        Snippet used in <code>index.html</code>
      </p>
      <pre>&lt;script
  src="http://localhost:3000/widget.js"
  data-key="pk_zuog15csvosgycph"
  defer
&gt;&lt;/script&gt;</pre>
      <p class="muted" style="margin-top: 8px">
        Si no ves cambios del widget: hard refresh (Ctrl+Shift+R). El script se sirve con cache 1h.
      </p>
    </section>
  </main>
</template>
