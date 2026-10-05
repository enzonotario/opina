type Appearance = {
  background?: string
  button?: string
  text?: string
  position?: 'left' | 'right'
  scaleStyle?: 'emojis' | 'numbers' | 'stars'
  lowLabel?: Record<string, string>
  highLabel?: Record<string, string>
  locale?: string
  includeScreenshot?: boolean
}

type Frequency =
  | { mode: 'until_submit' }
  | { mode: 'once' }
  | { mode: 'always' }
  | { mode: 'cooldown', days: number }
  | { days?: number } // legacy

type Survey = {
  id: string
  type: string
  question: Record<string, string>
  followUp: Record<string, string> | null
  thanks: Record<string, string> | null
  appearance: Appearance
  trigger: Record<string, unknown>
  targeting: {
    include?: string[]
    exclude?: string[]
    sampleRate?: number
    devices?: Array<'desktop' | 'tablet' | 'mobile'>
  }
  frequency: Frequency
}

type Config = {
  projectId: string
  settings?: Record<string, unknown>
  surveys: Survey[]
}

type ShowOptions = {
  force?: boolean
  expanded?: boolean
}

type OpinaApi = {
  show: (surveyId?: string, opts?: ShowOptions) => void
  hide: () => void
  setMeta: (meta: Record<string, unknown>) => void
  setLocale: (locale: string) => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
}

const EMOJIS = ['😠', '🙁', '😐', '🙂', '😍']

const state = {
  key: '',
  baseUrl: '',
  config: null as Config | null,
  meta: {} as Record<string, unknown>,
  locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
  visitorId: '',
  host: null as HTMLElement | null,
  shadow: null as ShadowRoot | null,
  shownAt: 0,
  handlers: new Map<string, Array<(...args: unknown[]) => void>>(),
  armed: new Set<string>(),
  escHandler: null as ((ev: KeyboardEvent) => void) | null,
}

function emit(event: string, payload?: unknown) {
  for (const handler of state.handlers.get(event) || []) {
    try {
      handler(payload)
    }
    catch { /* ignore listener errors */ }
  }
}

function quiet<T>(fn: () => T): T | undefined {
  try {
    return fn()
  }
  catch {
    return undefined
  }
}

async function quietAsync(fn: () => Promise<void>) {
  try {
    await fn()
  }
  catch { /* ignore */ }
}

function t(map: Record<string, string> | null | undefined, fallback: string) {
  if (!map) return fallback
  const short = state.locale.slice(0, 2)
  return map[state.locale] || map[short] || map.es || map.en || fallback
}

function storageKey(surveyId: string) {
  return `opina:freq:${state.key}:${surveyId}`
}

type FreqMode =
  | { mode: 'until_submit' }
  | { mode: 'once' }
  | { mode: 'always' }
  | { mode: 'cooldown', days: number }

function freqMode(survey: Survey): FreqMode {
  const f = survey.frequency || { mode: 'once' }
  if ('mode' in f && f.mode === 'until_submit') return { mode: 'until_submit' }
  if ('mode' in f && f.mode === 'once') return { mode: 'once' }
  if ('mode' in f && f.mode === 'always') return { mode: 'always' }
  if ('mode' in f && f.mode === 'cooldown') {
    return { mode: 'cooldown', days: Number((f as { days?: number }).days) || 30 }
  }
  if (typeof (f as { days?: number }).days === 'number') {
    const days = (f as { days: number }).days
    if (days === 0) return { mode: 'always' }
    return { mode: 'cooldown', days }
  }
  return { mode: 'once' }
}

function isFrequencyBlocked(survey: Survey) {
  const f = freqMode(survey)
  if (f.mode === 'always') return false
  const raw = quiet(() => localStorage.getItem(storageKey(survey.id)))
  if (!raw) return false
  if (raw === '1') return true
  const until = Number(raw)
  return Number.isFinite(until) && Date.now() < until
}

function markFrequency(survey: Survey, reason: 'submit' | 'dismiss') {
  const f = freqMode(survey)
  if (f.mode === 'always') return
  if (f.mode === 'until_submit' && reason === 'dismiss') return
  if (f.mode === 'cooldown') {
    const until = Date.now() + f.days * 86400000
    quiet(() => localStorage.setItem(storageKey(survey.id), String(until)))
    return
  }
  quiet(() => localStorage.setItem(storageKey(survey.id), '1'))
}

function device(): 'mobile' | 'tablet' | 'desktop' {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function ensureVisitorId() {
  const key = `opina:vid:${state.key}`
  let id = quiet(() => localStorage.getItem(key)) || ''
  if (!id) {
    id = `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    quiet(() => localStorage.setItem(key, id))
  }
  state.visitorId = id
}

function matchGlob(pattern: string, path: string) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE::/g, '.*')
  return new RegExp(`^${escaped}$`).test(path)
}

function pathAllowed(survey: Survey) {
  const path = location.pathname
  const include = survey.targeting?.include || []
  const exclude = survey.targeting?.exclude || []
  if (exclude.some(p => matchGlob(p, path))) return false
  if (include.length && !include.some(p => matchGlob(p, path))) return false
  return true
}

function deviceAllowed(survey: Survey) {
  const allowed = survey.targeting?.devices
  if (!allowed || !allowed.length) return true
  return allowed.includes(device())
}

function sampleAllows(survey: Survey) {
  const rate = Number(survey.targeting?.sampleRate ?? 100)
  if (rate >= 100) return true
  if (rate <= 0) return false
  const key = `opina:sample:${state.key}:${survey.id}`
  let bucket = quiet(() => localStorage.getItem(key))
  if (bucket == null) {
    bucket = String(Math.floor(Math.random() * 100))
    quiet(() => localStorage.setItem(key, bucket!))
  }
  return Number(bucket) < rate
}

function canAutoShow(survey: Survey) {
  return !isFrequencyBlocked(survey)
    && pathAllowed(survey)
    && deviceAllowed(survey)
    && sampleAllows(survey)
}

async function loadConfig() {
  const url = `${state.baseUrl}/api/v1/widget/config?key=${encodeURIComponent(state.key)}`
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) throw new Error('config failed')
  state.config = await res.json() as Config
}

function themeVars(a: Appearance) {
  const bg = a.background || '#ffffff'
  const btn = a.button || '#16a34a'
  const text = a.text || '#18181b'
  const side = a.position === 'left' ? 'left' : 'right'
  return `--opina-bg:${bg};--opina-btn:${btn};--opina-text:${text};--opina-side:${side};`
}

function isMobileViewport() {
  return window.innerWidth < 768
}

function css() {
  return `
:host{all:initial}
*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{position:fixed;bottom:16px;z-index:2147483646;max-width:360px;width:calc(100vw - 32px)}
.wrap.right{right:16px;left:auto}
.wrap.left{left:16px;right:auto}
.card{background:var(--opina-bg,#fff);color:var(--opina-text,#18181b);border:1px solid rgba(0,0,0,.08);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.14);padding:16px}
.h{display:flex;justify-content:flex-end;margin-bottom:4px}
.q{font-size:15px;font-weight:600;line-height:1.35;margin:0 0 12px}
.x{border:0;background:transparent;color:inherit;opacity:.55;cursor:pointer;font-size:18px;line-height:1;padding:0 2px}
.scores{display:flex;gap:6px;flex-wrap:nowrap;justify-content:space-between}
.btn{border:1px solid rgba(0,0,0,.12);background:transparent;color:inherit;border-radius:12px;min-width:44px;height:44px;cursor:pointer;font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center}
.btn:hover,.btn:focus-visible{border-color:var(--opina-btn,#16a34a);outline:none}
.btn.on{border-color:var(--opina-btn,#16a34a);box-shadow:0 0 0 2px color-mix(in srgb, var(--opina-btn,#16a34a) 35%, transparent)}
.labels{display:flex;justify-content:space-between;font-size:10px;opacity:.7;margin:6px 0 12px}
.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.send{border:0;border-radius:10px;background:var(--opina-btn,#16a34a);color:#fff;padding:8px 12px;font-weight:600;cursor:pointer}
.send:disabled{opacity:.4;cursor:not-allowed}
.back{border:0;background:transparent;color:inherit;opacity:.7;cursor:pointer;font-size:13px}
.follow{display:flex;flex-direction:column;gap:8px}
.ta{width:100%;min-height:72px;resize:vertical;border-radius:10px;border:1px solid rgba(0,0,0,.15);padding:8px 10px;font:inherit;background:transparent;color:inherit}
.thanks{font-size:15px;font-weight:600;margin:8px 0 16px;text-align:center}
.hp{position:absolute;left:-9999px;opacity:0;height:0;width:0}
.teaser{position:fixed;left:0;right:0;bottom:0;z-index:2147483646;width:100%;max-width:none;padding:0}
.teaser .card{position:relative;border-radius:14px 14px 0 0;padding:18px 12px 10px;display:flex;align-items:center;gap:6px;box-shadow:0 -6px 24px rgba(0,0,0,.14);cursor:pointer}
.teaser .grip{width:28px;height:3px;border-radius:99px;background:rgba(0,0,0,.14);position:absolute;top:7px;left:50%;transform:translateX(-50%)}
.teaser .q{margin:0;flex:1;font-size:12px;font-weight:500;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.teaser .chev{border:0;background:transparent;color:inherit;opacity:.45;font-size:14px;padding:2px;cursor:pointer;line-height:1}
.teaser .x{padding:2px;font-size:16px}
@media (max-width:767px){
  .wrap:not(.teaser){left:0!important;right:0!important;bottom:0;width:100%;max-width:none;padding:0}
  .wrap:not(.teaser) .card{border-radius:16px 16px 0 0;max-height:min(78vh,640px);overflow:auto;box-shadow:0 -8px 32px rgba(0,0,0,.16)}
  .scores .btn{min-width:0;flex:1}
}
`
}

function ensureHost() {
  if (state.host && state.shadow) return
  const host = document.createElement('div')
  host.id = 'opina-root'
  const shadow = host.attachShadow({ mode: 'closed' })
  document.documentElement.appendChild(host)
  state.host = host
  state.shadow = shadow
}

function clearEsc() {
  if (state.escHandler) {
    document.removeEventListener('keydown', state.escHandler)
    state.escHandler = null
  }
}

function hide() {
  clearEsc()
  if (state.shadow) state.shadow.innerHTML = ''
  emit('dismiss')
}

function ui(survey: Survey, key: string, fallback: string) {
  const locale = survey.appearance?.locale || state.locale
  const short = locale.slice(0, 2)
  const map: Record<string, Record<string, string>> = {
    next: { es: 'Siguiente', en: 'Next' },
    send: { es: 'Enviar', en: 'Send' },
    back: { es: 'Atrás', en: 'Back' },
    close: { es: 'Cerrar', en: 'Close' },
  }
  return map[key]?.[locale] || map[key]?.[short] || map[key]?.es || fallback
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('capture load failed'))
    document.head.appendChild(s)
  })
}

async function captureScreenshot(): Promise<string | null> {
  try {
    await loadScript(`${state.baseUrl}/capture.js?v=ms2`)
    const fn = window.__opinaCapture
    if (!fn) return null
    return await fn()
  }
  catch {
    return null
  }
}

async function uploadScreenshot(survey: Survey, responseId: string, image: string) {
  await fetch(`${state.baseUrl}/api/v1/widget/screenshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({
      key: state.key,
      surveyId: survey.id,
      responseId,
      visitorId: state.visitorId,
      image,
    }),
  })
}

async function capturePageWithoutWidget() {
  if (!state.host) return captureScreenshot()
  state.host.style.visibility = 'hidden'
  try {
    return await captureScreenshot()
  }
  finally {
    state.host.style.visibility = ''
  }
}

async function submit(survey: Survey, score: number, comment: string, hp: string) {
  if (Date.now() - state.shownAt < 800) return
  const wantShot = survey.appearance?.includeScreenshot === true
  // Capture in parallel with the response POST so the UI is not blocked.
  const shotPromise = wantShot ? capturePageWithoutWidget() : Promise.resolve(null)

  const body = {
    key: state.key,
    surveyId: survey.id,
    score,
    comment: comment || null,
    path: location.pathname,
    host: location.host,
    locale: state.locale,
    visitorId: state.visitorId,
    metadata: state.meta,
    device: device(),
    shownAt: state.shownAt,
    hp,
  }
  const res = await fetch(`${state.baseUrl}/api/v1/widget/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('submit failed')
  const payload = await res.json() as { ok?: boolean, id?: string }
  markFrequency(survey, 'submit')
  emit('submit', { surveyId: survey.id, score, comment })
  showThanks(survey)

  if (wantShot && payload.id) {
    quietAsync(async () => {
      const image = await shotPromise
      if (image) await uploadScreenshot(survey, payload.id!, image)
    })
  }
}

function showThanks(survey: Survey) {
  const shadow = state.shadow!
  const a = survey.appearance || {}
  const side = a.position === 'left' ? 'left' : 'right'
  const msg = t(survey.thanks, t({ es: '¡Gracias por tus comentarios!', en: 'Thanks for your feedback!' }, 'Thanks!'))
  shadow.innerHTML = `
    <style>${css()}</style>
    <div class="wrap ${side}" style="${themeVars(a)}">
      <div class="card" role="dialog" aria-label="Thanks">
        <div class="h"><button class="x" type="button" aria-label="Close" data-x>×</button></div>
        <p class="thanks">${escapeHtml(msg)}</p>
        <div class="actions"><button class="send" type="button" data-close>${escapeHtml(ui(survey, 'close', 'Close'))}</button></div>
      </div>
    </div>
  `
  const close = () => hide()
  shadow.querySelector('[data-x]')?.addEventListener('click', close)
  shadow.querySelector('[data-close]')?.addEventListener('click', close)
  setTimeout(close, 2500)
}

function scoreButtons(survey: Survey): Array<{ value: number, label: string }> {
  if (survey.type === 'thumbs') {
    return [
      { value: 1, label: '👍' },
      { value: 0, label: '👎' },
    ]
  }
  const style = survey.appearance?.scaleStyle || 'emojis'
  return [1, 2, 3, 4, 5].map((n) => {
    if (style === 'stars') return { value: n, label: '★' }
    if (style === 'numbers') return { value: n, label: String(n) }
    return { value: n, label: EMOJIS[n - 1]! }
  })
}

function render(survey: Survey, opts?: { startCollapsed?: boolean }) {
  ensureHost()
  clearEsc()
  const shadow = state.shadow!
  const a = survey.appearance || {}
  const side = a.position === 'left' ? 'left' : 'right'
  const question = t(survey.question, 'How was this page?')
  const follow = survey.followUp ? t(survey.followUp, '') : ''
  const hasFollow = Boolean(follow)
  state.shownAt = Date.now()

  let chosen: number | null = null
  let step: 'rating' | 'comment' = 'rating'
  let collapsed = Boolean(opts?.startCollapsed && isMobileViewport())

  const paintTeaser = () => {
    shadow.innerHTML = `
      <style>${css()}</style>
      <div class="teaser" style="${themeVars(a)}">
        <div class="card" role="button" tabindex="0" aria-expanded="false" aria-label="${escapeHtml(question)}" data-teaser>
          <span class="grip" aria-hidden="true"></span>
          <p class="q">${escapeHtml(question)}</p>
          <button class="chev" type="button" aria-label="Open" data-open>⌃</button>
          <button class="x" type="button" aria-label="Close" data-x>×</button>
        </div>
      </div>
    `
    const expand = (ev?: Event) => {
      ev?.stopPropagation()
      collapsed = false
      state.shownAt = Date.now()
      paint()
      emit('expanded', { surveyId: survey.id })
    }
    shadow.querySelector('[data-teaser]')?.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest?.('[data-x]')) return
      expand(ev)
    })
    shadow.querySelector('[data-teaser]')?.addEventListener('keydown', (ev) => {
      const ke = ev as KeyboardEvent
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault()
        expand(ke)
      }
    })
    shadow.querySelector('[data-open]')?.addEventListener('click', expand)
    shadow.querySelector('[data-x]')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      markFrequency(survey, 'dismiss')
      hide()
    })
    ;(shadow.querySelector('[data-teaser]') as HTMLElement | null)?.focus()
  }

  const paint = () => {
    if (collapsed) {
      paintTeaser()
      return
    }

    if (step === 'comment') {
      shadow.innerHTML = `
        <style>${css()}</style>
        <div class="wrap ${side}" style="${themeVars(a)}">
          <div class="card" role="dialog" aria-modal="true" aria-label="Feedback">
            <div class="h"><button class="x" type="button" aria-label="Close" data-x>×</button></div>
            <p class="q">${escapeHtml(follow)}</p>
            <div class="follow">
              <textarea class="ta" data-comment maxlength="2000"></textarea>
              <input class="hp" tabindex="-1" autocomplete="off" data-hp aria-hidden="true" />
              <div class="actions">
                <button class="back" type="button" data-back>${escapeHtml(ui(survey, 'back', 'Back'))}</button>
                <button class="send" type="button" data-send>${escapeHtml(ui(survey, 'send', 'Send'))}</button>
              </div>
            </div>
          </div>
        </div>
      `
      bindChrome()
      shadow.querySelector('[data-back]')?.addEventListener('click', () => {
        step = 'rating'
        paint()
      })
      shadow.querySelector('[data-send]')?.addEventListener('click', () => {
        if (chosen == null) return
        const comment = shadow.querySelector<HTMLTextAreaElement>('[data-comment]')?.value || ''
        const hp = shadow.querySelector<HTMLInputElement>('[data-hp]')?.value || ''
        quietAsync(() => submit(survey, chosen!, comment, hp))
      })
      shadow.querySelector<HTMLTextAreaElement>('[data-comment]')?.focus()
      return
    }

    const labels = survey.type === 'csat'
      ? `<div class="labels"><span>${escapeHtml(t(a.lowLabel, 'Low'))}</span><span>${escapeHtml(t(a.highLabel, 'High'))}</span></div>`
      : ''

    shadow.innerHTML = `
      <style>${css()}</style>
      <div class="wrap ${side}" style="${themeVars(a)}">
        <div class="card" role="dialog" aria-modal="true" aria-label="Feedback">
          <div class="h"><button class="x" type="button" aria-label="Close" data-x>×</button></div>
          <p class="q" id="opina-q">${escapeHtml(question)}</p>
          <div class="scores" data-scores role="group" aria-labelledby="opina-q"></div>
          ${labels}
          <input class="hp" tabindex="-1" autocomplete="off" data-hp aria-hidden="true" />
          <div class="actions">
            <button class="send" type="button" data-next disabled>${escapeHtml(hasFollow ? ui(survey, 'next', 'Next') : ui(survey, 'send', 'Send'))}</button>
          </div>
        </div>
      </div>
    `
    bindChrome()
    const scores = shadow.querySelector('[data-scores]')!
    const nextBtn = shadow.querySelector<HTMLButtonElement>('[data-next]')!
    for (const item of scoreButtons(survey)) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'btn' + (chosen === item.value ? ' on' : '')
      b.textContent = item.label
      b.setAttribute('aria-label', `Score ${item.value}`)
      b.addEventListener('click', () => {
        chosen = item.value
        paint()
      })
      scores.appendChild(b)
    }
    nextBtn.disabled = chosen == null
    nextBtn.addEventListener('click', () => {
      if (chosen == null) return
      if (hasFollow) {
        step = 'comment'
        paint()
        return
      }
      const hp = shadow.querySelector<HTMLInputElement>('[data-hp]')?.value || ''
      quietAsync(() => submit(survey, chosen!, '', hp))
    })
    ;(shadow.querySelector('.btn') as HTMLElement | null)?.focus()
  }

  function bindChrome() {
    shadow.querySelector('[data-x]')?.addEventListener('click', () => {
      markFrequency(survey, 'dismiss')
      hide()
    })
  }

  state.escHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      markFrequency(survey, 'dismiss')
      hide()
    }
  }
  document.addEventListener('keydown', state.escHandler)

  paint()
  emit('shown', { surveyId: survey.id, collapsed })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveSurvey(surveyId?: string) {
  const surveys = state.config?.surveys || []
  if (!surveys.length) return null
  if (surveyId) return surveys.find(s => s.id === surveyId) || null
  return surveys[0] || null
}

function show(surveyId?: string, opts?: ShowOptions) {
  quietAsync(async () => {
    if (!state.config) await loadConfig()
    const survey = resolveSurvey(surveyId)
    if (!survey) return
    if (!opts?.force && isFrequencyBlocked(survey)) {
      emit('suppressed', { surveyId: survey.id, reason: 'frequency' })
      return
    }
    if (!pathAllowed(survey)) {
      emit('suppressed', { surveyId: survey.id, reason: 'path' })
      return
    }
    if (!opts?.force && !deviceAllowed(survey)) {
      emit('suppressed', { surveyId: survey.id, reason: 'device' })
      return
    }
    const startCollapsed = !opts?.force && !opts?.expanded
    render(survey, { startCollapsed })
  })
}

function armTriggers() {
  const surveys = state.config?.surveys || []
  for (const survey of surveys) {
    if (state.armed.has(survey.id) || !canAutoShow(survey)) continue
    const type = String(survey.trigger?.type || 'manual')
    if (type === 'manual') continue
    state.armed.add(survey.id)

    if (type === 'immediate') {
      show(survey.id)
    }

    if (type === 'delay') {
      const ms = Number(survey.trigger.ms ?? 2000)
      setTimeout(() => { if (canAutoShow(survey)) show(survey.id) }, ms)
    }

    if (type === 'scroll') {
      const percent = Number(survey.trigger.percent || 50)
      const onScroll = () => {
        const doc = document.documentElement
        const max = doc.scrollHeight - window.innerHeight
        const pct = max <= 0 ? 100 : (window.scrollY / max) * 100
        if (pct >= percent) {
          window.removeEventListener('scroll', onScroll)
          if (canAutoShow(survey)) show(survey.id)
        }
      }
      window.addEventListener('scroll', onScroll, { passive: true })
    }

    if (type === 'exit_intent') {
      const onLeave = (ev: MouseEvent) => {
        if (ev.clientY > 0) return
        document.removeEventListener('mouseout', onLeave)
        if (canAutoShow(survey)) show(survey.id)
      }
      document.addEventListener('mouseout', onLeave)
    }

    if (type === 'pageviews') {
      const need = Number(survey.trigger.count || 2)
      const key = `opina:pv:${state.key}`
      const count = Number(quiet(() => sessionStorage.getItem(key)) || 0) + 1
      quiet(() => sessionStorage.setItem(key, String(count)))
      if (count >= need && canAutoShow(survey)) show(survey.id)
    }
  }
}

const api: OpinaApi = {
  show(surveyId, opts) {
    show(surveyId, { ...opts, force: true, expanded: true })
  },
  hide,
  setMeta(meta) { state.meta = { ...state.meta, ...meta } },
  setLocale(locale) { state.locale = locale },
  on(event, handler) {
    const list = state.handlers.get(event) || []
    list.push(handler)
    state.handlers.set(event, list)
  },
}

function boot() {
  const script = document.currentScript as HTMLScriptElement | null
    || document.querySelector<HTMLScriptElement>('script[data-key][src*="widget.js"]')
  if (!script) return
  state.key = script.getAttribute('data-key') || ''
  if (!state.key) return
  const dataBase = script.getAttribute('data-base')?.trim()
  try {
    state.baseUrl = dataBase
      ? new URL(dataBase, location.href).origin
      : new URL(script.src, location.href).origin
  }
  catch {
    state.baseUrl = location.origin
  }
  ensureVisitorId()
  window.Opina = api

  document.addEventListener('click', (ev) => {
    const el = (ev.target as Element | null)?.closest?.('[data-opina]') as HTMLElement | null
    if (!el) return
    const id = el.getAttribute('data-opina') || undefined
    show(id === '' ? undefined : id, { force: true })
  })

  quietAsync(async () => {
    await loadConfig()
    armTriggers()
  })
}

declare global {
  interface Window {
    Opina: OpinaApi
    __opinaCapture?: () => Promise<string | null>
  }
}

boot()

export {}
