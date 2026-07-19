// Sprint 10 — Autocomplete UI: suggestion hook + Layer B pills + backoff.
// Layer A (ghost text) renders inline in TipTapEditor from the SAME hook
// state (single fetch — the ghost is suggestions[activeIndex]).
//
// Two hard rules (FE step 03): never steal focus, never insert without an
// explicit accept. All keyboard handling lives at the editor level
// (TipTapEditor); the pills are purely presentational — rows accept via
// mousedown (click would blur the editor first) and are never focusable.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { suggest } from '../api/autocomplete.js'
import { extractPrefix } from '../autocomplete/prefix.js'
import { useI18n } from '../i18n.js'
import { Icon } from './UI.jsx'

// ── Source metadata (backend scopes: system | tenant | user) ─────────────

const SOURCE_META = {
  user:   { labelUk: 'Моя фраза',            labelEn: 'My phrase',           color: 'var(--accent)' },
  tenant: { labelUk: 'З клінічного словника', labelEn: 'From clinic',         color: 'var(--dictate)' },
  system: { labelUk: 'З медичного корпусу',   labelEn: 'From medical corpus', color: 'var(--muted)' },
}

function sourceLabel(source, lang) {
  const m = SOURCE_META[source]
  if (!m) return source
  return lang === 'uk' ? m.labelUk : m.labelEn
}

function sourceColor(source) {
  return SOURCE_META[source]?.color || 'var(--muted)'
}

// ── Suggestion hook (single source for ghost + pills) ────────────────────
//
// Debounced 130 ms; queries the sentence stem first and falls back to the
// last word (see src/autocomplete/prefix.js). Best-effort: failures resolve
// to an empty list and never interrupt typing. Stale responses are dropped
// via a sequence counter — ghost text for a prefix the user has typed past
// is never shown.
//
// LRU memo: recently answered prefixes (per language/section/template) are
// served synchronously — no debounce wait, no network. A memo hit carries
// the response's ORIGINAL request_id, so telemetry stays joinable and the
// sink's shown_only dedup keeps impression counts honest.
//
// Degraded mode: a response slower than SUGGEST_TIMEOUT_MS is never
// rendered — a ghost that pops in behind the typing rhythm reads as noise.
// The late answer still lands in the memo (next keystroke serves it
// instantly) and is reported via onDegraded → `timeout` telemetry.

const EMPTY = { suggestions: [], requestId: null, prefix: null }

export const SUGGEST_TIMEOUT_MS = 300
const MEMO_MAX = 64
const MEMO_TTL_MS = 60_000

// Micro-backoff (step 05): a dead backend must not eat one request per
// keystroke from every open editor. Three CONSECUTIVE thrown failures
// (network reject / 5xx / auth storm) suppress querying for 15 s; any
// successful response resets. Slow-but-answering responses are NOT
// failures — the backend has its own degraded path and the 300 ms render
// budget already handles them.
export const SUGGEST_FAIL_THRESHOLD = 3
export const SUGGEST_FAIL_BACKOFF_MS = 15_000

export function useSuggestions({
  textBeforeCaret, enabled, language = 'uk', sectionId, templateId, limit = 3,
  minPrefixLen = 2,   // phrase queries only; snippet triggers always fire
  onDegraded,         // ({ requestId, prefix }) → `timeout` telemetry
}) {
  const [state, setState] = useState(EMPTY)
  const seqRef = useRef(0)
  const memoRef = useRef(new Map()) // insertion-ordered → LRU via delete/re-set
  const degradedRef = useRef(onDegraded)
  degradedRef.current = onDegraded
  const failsRef = useRef(0)         // consecutive thrown failures
  const suppressUntilRef = useRef(0) // micro-backoff deadline

  const clear = useCallback(() => {
    seqRef.current++
    setState(EMPTY)
  }, [])

  useEffect(() => {
    const seq = ++seqRef.current
    if (!enabled) { setState(EMPTY); return }
    const ext = extractPrefix(textBeforeCaret)
    if (!ext) { setState(EMPTY); return }
    if (ext.kind === 'phrase' && ext.prefix.length < minPrefixLen) { setState(EMPTY); return }
    if (Date.now() < suppressUntilRef.current) { setState(EMPTY); return } // micro-backoff open
    const fallback = ext.fallback && ext.fallback.length >= minPrefixLen ? ext.fallback : null

    const memoKey = (p) => `${language}|${limit}|${sectionId || ''}|${templateId || ''}|${p}`
    const memoGet = (p) => {
      const k = memoKey(p)
      const hit = memoRef.current.get(k)
      if (!hit) return null
      if (Date.now() - hit.at > MEMO_TTL_MS) { memoRef.current.delete(k); return null }
      memoRef.current.delete(k); memoRef.current.set(k, hit) // refresh recency
      return hit
    }
    const memoSet = (p, value) => {
      const k = memoKey(p)
      memoRef.current.delete(k)
      memoRef.current.set(k, { ...value, at: Date.now() })
      while (memoRef.current.size > MEMO_MAX) {
        memoRef.current.delete(memoRef.current.keys().next().value)
      }
    }

    // Memo hit → serve synchronously. An empty primary hit still consults
    // the fallback's memo before concluding "nothing".
    let cached = memoGet(ext.prefix)
    if (cached && !cached.suggestions.length && fallback) {
      cached = memoGet(fallback) || cached
    }
    if (cached) {
      // slice(): a fresh array identity per serve. The editor's ghost
      // decoration re-arms from an effect keyed on the suggestions array —
      // re-showing the SAME cached array (e.g. backspace back onto a
      // memoed prefix) must still fire that effect.
      setState(cached.suggestions.length
        ? { suggestions: cached.suggestions.slice(), requestId: cached.requestId, prefix: cached.prefix }
        : EMPTY)
      return
    }

    const timer = setTimeout(async () => {
      const context = {}
      if (sectionId) context.section_id = sectionId
      if (templateId) context.template_id = templateId
      // UX budget guard: past SUGGEST_TIMEOUT_MS the ghost for this prefix
      // is abandoned (state already cleared); the response is handled below
      // when it eventually lands.
      let timedOut = false
      const guard = setTimeout(() => {
        timedOut = true
        if (seqRef.current === seq) setState(EMPTY)
      }, SUGGEST_TIMEOUT_MS)
      try {
        let r = await suggest({ prefix: ext.prefix, language, limit, context })
        let sugs = Array.isArray(r?.suggestions) ? r.suggestions : []
        let usedPrefix = ext.prefix
        if (!sugs.length && fallback && !timedOut) {
          memoSet(ext.prefix, { suggestions: [], requestId: r?.request_id ?? null, prefix: ext.prefix })
          r = await suggest({ prefix: fallback, language, limit, context })
          sugs = Array.isArray(r?.suggestions) ? r.suggestions : []
          usedPrefix = fallback
        }
        failsRef.current = 0 // an answer arrived — the service is alive
        // A completion the user has already finished typing is useless.
        sugs = sugs.filter(s => s.kind === 'snippet' || (s.completion && s.completion.length > 0))
        const requestId = r?.request_id ?? null
        memoSet(usedPrefix, { suggestions: sugs, requestId, prefix: usedPrefix })
        if (timedOut) {
          if (requestId && sugs.length) degradedRef.current?.({ requestId, prefix: usedPrefix })
          return
        }
        if (seqRef.current !== seq) return // stale — user typed on
        setState(sugs.length ? { suggestions: sugs, requestId, prefix: usedPrefix } : EMPTY)
      } catch {
        failsRef.current += 1
        if (failsRef.current >= SUGGEST_FAIL_THRESHOLD) {
          suppressUntilRef.current = Date.now() + SUGGEST_FAIL_BACKOFF_MS
          failsRef.current = 0
        }
        if (seqRef.current === seq && !timedOut) setState(EMPTY)
      } finally {
        clearTimeout(guard)
      }
    }, 130)

    return () => clearTimeout(timer)
  }, [textBeforeCaret, enabled, language, sectionId, templateId, limit, minPrefixLen])

  return { ...state, clear }
}

// ── Backoff hook (3 dismissals → 30 s pause) ─────────────────────────────

export function useBackoff() {
  const [dismissCount, setDismissCount]       = useState(0)
  const [lastDismissTime, setLastDismissTime] = useState(0)
  const [paused,   setPaused]   = useState(false)
  const [pauseMsg, setPauseMsg] = useState(false)

  const dismiss = useCallback(() => {
    const now = Date.now()
    setLastDismissTime(now)
    setDismissCount(c => {
      const next = c + 1
      if (next >= 3) {
        setPaused(true)
        setPauseMsg(true)
        setTimeout(() => {
          setPaused(false)
          setPauseMsg(false)
        }, 30_000)
      }
      return next
    })
  }, [])

  const accept = useCallback(() => {
    setDismissCount(0)
  }, [])

  const resume = useCallback(() => {
    setPaused(false)
    setPauseMsg(false)
    setDismissCount(0)
  }, [])

  return { dismissCount, lastDismissTime, paused, pauseMsg, dismiss, accept, resume }
}

// ── Layer B pill list (presentational; keyboard lives in the editor) ─────

export function AutocompletePills({ suggestions, activeIndex = 0, anchor, onAccept, onDismiss, lang }) {
  const { t } = useI18n()
  const uk = lang === 'uk'

  if (!suggestions?.length) return null

  // Anchor under the caret (viewport coords from view.coordsAtPos). Clamped
  // to the viewport; flips above the caret near the bottom edge. Without an
  // anchor the stylesheet's bottom-centered fallback applies.
  let style
  if (anchor) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(420, vw - 16)
    const left = Math.max(8, Math.min(anchor.left, vw - width - 8))
    style = anchor.bottom + 190 <= vh
      ? { position: 'fixed', left, top: anchor.bottom + 6, bottom: 'auto', transform: 'none', width }
      : { position: 'fixed', left, bottom: vh - anchor.top + 6, top: 'auto', transform: 'none', width }
  }

  return (
    <div
      className="autocomplete-pills"
      role="listbox"
      id="autocomplete-listbox"
      aria-label={uk ? 'Пропозиції автодоповнення' : 'Autocomplete suggestions'}
      tabIndex={-1}
      style={style}
    >
      <div className="pills-header">
        <span className="muted" style={{ fontSize: 11 }}>
          {uk ? 'Пропозиції' : 'Suggestions'}
        </span>
        <button
          className="iconbtn"
          tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); onDismiss() }}
          aria-label={t('ac.hint.dismiss')} title={t('ac.hint.dismiss')}
        >
          <span style={{ fontSize: 11 }}>✕</span>
        </button>
      </div>
      {suggestions.map((s, i) => (
        <div
          key={s.id}
          id={`autocomplete-option-${i}`}
          role="option"
          aria-selected={i === activeIndex}
          className={'autocomplete-pill' + (i === activeIndex ? ' focused' : '')}
          // mousedown + preventDefault: a click would blur the editor first.
          onMouseDown={e => { e.preventDefault(); onAccept(s, i) }}
          title={s.text}
        >
          <span
            className="autocomplete-shortcut"
            style={{ borderLeftColor: sourceColor(s.source) }}
          >
            {i === 0 ? 'Tab' : `Alt+${i + 1}`}
          </span>
          <span className="autocomplete-text">
            {s.text.length > 60 ? s.text.slice(0, 60) + '…' : s.text}
          </span>
          <span className="autocomplete-source" style={{ color: sourceColor(s.source) }}>
            {sourceLabel(s.source, lang)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Pause toast ───────────────────────────────────────────────────────────

export function AutocompletePauseToast({ onResume, lang }) {
  const uk = lang === 'uk'
  return (
    <div className="autocomplete-pause-toast">
      <span>
        {uk
          ? 'Автодоповнення призупинено.'
          : 'Autocomplete paused.'}
      </span>
      <button className="btn ghost sm" onClick={onResume}>
        {uk ? 'Відновити' : 'Resume'}
      </button>
    </div>
  )
}

// ── Autocomplete settings panel ───────────────────────────────────────────

// Legacy 1/2/3 (Low/Med/High) → 20/50/90%. New scale is 10–100% in 10% steps.
function sensPct(prefs) {
  const s = prefs.sensitivity
  if (s == null) return 50
  if (s <= 3) return { 1: 20, 2: 50, 3: 90 }[s] ?? 50
  return Math.min(100, Math.max(10, s))
}

export function AutocompleteSettings({ prefs, onChange, lang }) {
  const { t } = useI18n()
  const uk = lang === 'uk'
  const [open, setOpen] = useState(true)
  const set = (key, val) => onChange({ ...prefs, [key]: val })
  const off = prefs.enabled === false

  const pct = sensPct(prefs)
  const fill = ((pct - 10) / 90) * 100   // thumb position across a 10–100 track

  return (
    <details
      className="cmd-ref autocomplete-settings"
      open={open}
      onToggle={e => setOpen(e.currentTarget.open)}
    >
      <summary>
        <Icon name="chevRight" size={11} className="chev" />
        {uk ? 'Автодоповнення' : 'Autocomplete'}
      </summary>

      {(
        <div className="ac-body">
          {/* Master switch (step 05): OFF fully disables the feature — no
              queries, no ghost/popup, no telemetry, no Tab interception. */}
          <div className="setting-row">
            <span>{t('ac.settings.label')}</span>
            <Switch checked={!off} onChange={v => set('enabled', v)} />
          </div>
          <div className="muted" style={{ fontSize: 11, lineHeight: 1.45, padding: '0 4px 6px' }}>
            {t('ac.settings.desc')}
          </div>

          <div className="setting-row">
            <span>{uk ? 'Підказки-примари (Layer A)' : 'Ghost text (Layer A)'}</span>
            <Switch disabled={off} checked={prefs.ghostEnabled !== false} onChange={v => set('ghostEnabled', v)} />
          </div>

          <div className="setting-row">
            <span>{uk ? 'Пропозиції (Layer B)' : 'Pill suggestions (Layer B)'}</span>
            <Switch disabled={off} checked={prefs.pillsEnabled !== false} onChange={v => set('pillsEnabled', v)} />
          </div>

          <div className="rail-h" style={{ marginTop: 8 }}>{uk ? 'Джерела' : 'Sources'}</div>

          {Object.entries(SOURCE_META).map(([key, meta]) => (
            <div key={key} className="setting-row">
              <span style={{ fontSize: 12 }}>{lang === 'uk' ? meta.labelUk : meta.labelEn}</span>
              <Switch
                disabled={off}
                checked={prefs.sources?.[key] !== false}
                onChange={v => set('sources', { ...(prefs.sources || {}), [key]: v })}
              />
            </div>
          ))}

          <div className="ac-sens-head" style={{ marginTop: 8 }}>
            <span className="rail-h" style={{ padding: 0 }}>{uk ? 'Чутливість' : 'Sensitivity'}</span>
            <span className={'ac-sens-val' + (off ? ' off' : '')}>{pct}%</span>
          </div>
          <div className="ac-range-wrap" style={{ padding: '2px 4px 0' }}>
            <input
              className="ac-range"
              type="range" min="10" max="100" step="10"
              value={pct}
              disabled={off}
              style={{ '--ac-fill': fill + '%' }}
              onChange={e => set('sensitivity', parseInt(e.target.value))}
            />
            <div className="ac-range-scale">
              <span>{uk ? 'Низька' : 'Low'}</span>
              <span>{uk ? 'Висока' : 'High'}</span>
            </div>
          </div>
        </div>
      )}
    </details>
  )
}

// Platform toggle switch (matches Settings' Toggle) — replaces native
// checkboxes in the autocomplete panel for design consistency.
function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      className={'toggle' + (checked ? ' on' : '')}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}
