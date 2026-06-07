// Sprint 10 — Autocomplete UI: Layer B pills + backoff logic
// Layer A (ghost text) is rendered inline in TipTapEditor.
// Layer B (floating pill list) is rendered here, positioned below cursor.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '../i18n.js'
import { suggest } from '../api/nlp.js'

// ── Source metadata ───────────────────────────────────────────────────────

const SOURCE_META = {
  'user.history':   { labelUk: 'З ваших фраз',         labelEn: 'From your phrases',      color: 'var(--accent)' },
  'clinic.snippets':{ labelUk: 'З клінічного словника', labelEn: 'From clinic',            color: 'var(--dictate)' },
  'system.corpus':  { labelUk: 'З медичного корпусу',   labelEn: 'From medical corpus',    color: 'var(--muted)' },
}

function sourceLabel(source, lang) {
  const m = SOURCE_META[source]
  if (!m) return source
  return lang === 'uk' ? m.labelUk : m.labelEn
}

function sourceColor(source) {
  return SOURCE_META[source]?.color || 'var(--muted)'
}

// ── Suggestion fetching (nlp-service) ─────────────────────────────────────
// Layer A (ghost) and Layer B (pills) both pull ranked snippets from
// POST /nlp/suggest. Suggestions are best-effort: a failed request resolves
// to an empty list and never interrupts dictation.

async function fetchSuggestions({ templateId, sectionId, prefix, language, limit, signal }) {
  if (!sectionId) return []
  try {
    const r = await suggest({ template_id: templateId, section_id: sectionId, prefix, language, limit })
    if (signal?.aborted) return []
    return Array.isArray(r) ? r : (r && r.suggestions) || []
  } catch {
    return []
  }
}

// Layer B — debounced pill suggestions. Returns an array (possibly empty).
export function usePillSuggestions({ templateId, sectionId, bodyText, enabled, language = 'uk' }) {
  const [items, setItems] = useState([])
  const timerRef = useRef(null)

  useEffect(() => {
    if (!enabled) { setItems([]); return }
    const words = (bodyText || '').trim().split(/\s+/).filter(Boolean)
    if (words.length < 2) { setItems([]); return }

    const ctrl = new AbortController()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const r = await fetchSuggestions({ templateId, sectionId, prefix: bodyText, language, limit: 3, signal: ctrl.signal })
      if (!ctrl.signal.aborted) setItems(r.slice(0, 3))
    }, 300)

    return () => { clearTimeout(timerRef.current); ctrl.abort() }
  }, [templateId, sectionId, bodyText, enabled, language])

  return items
}

// ── Ghost text hook (Layer A) ─────────────────────────────────────────────
// Returns ghostText string when applicable, null otherwise.

export function useGhostText({ templateId, sectionId, bodyText, enabled, dismissCount, lastDismissTime, language = 'uk' }) {
  const [ghost, setGhost] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!enabled) { setGhost(null); return }
    if (dismissCount >= 3 && Date.now() - lastDismissTime < 30_000) {
      setGhost(null); return
    }

    const ctrl = new AbortController()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const words = (bodyText || '').trim().split(/\s+/).filter(Boolean)
      if (words.length < 2) { setGhost(null); return }
      const r = await fetchSuggestions({ templateId, sectionId, prefix: bodyText, language, limit: 1, signal: ctrl.signal })
      if (!ctrl.signal.aborted) setGhost(r[0]?.text || null)
    }, 300)

    return () => { clearTimeout(timerRef.current); ctrl.abort() }
  }, [templateId, sectionId, bodyText, enabled, dismissCount, lastDismissTime, language])

  return ghost
}

// ── Backoff hook ──────────────────────────────────────────────────────────

export function useBackoff() {
  const [dismissCount, setDismissCount]     = useState(0)
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

// ── Layer B pill list ─────────────────────────────────────────────────────

export function AutocompletePills({ suggestions, onAccept, onDismiss, lang }) {
  const { t } = useI18n()
  const uk = lang === 'uk'
  const [cursor, setCursor] = useState(0)
  const panelRef = useRef(null)

  if (!suggestions?.length) return null

  const handleKey = (e) => {
    if (e.altKey && ['1','2','3'].includes(e.key)) {
      const idx = parseInt(e.key) - 1
      if (suggestions[idx]) { e.preventDefault(); onAccept(suggestions[idx]) }
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => (c + 1) % suggestions.length) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => (c - 1 + suggestions.length) % suggestions.length) }
    if (e.key === 'Enter')     { e.preventDefault(); onAccept(suggestions[cursor]) }
    if (e.key === 'Escape')    { e.preventDefault(); onDismiss() }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  return (
    <div
      ref={panelRef}
      className="autocomplete-pills"
      role="listbox"
      aria-label={uk ? 'Пропозиції автодоповнення' : 'Autocomplete suggestions'}
    >
      <div className="pills-header">
        <span className="muted" style={{ fontSize: 11 }}>
          {uk ? 'Пропозиції' : 'Suggestions'}
        </span>
        <button className="iconbtn" onClick={onDismiss} aria-label="Dismiss" title="Esc">
          <span style={{ fontSize: 11 }}>✕</span>
        </button>
      </div>
      {suggestions.map((s, i) => (
        <button
          key={s.id}
          role="option"
          aria-selected={i === cursor}
          className={'autocomplete-pill' + (i === cursor ? ' focused' : '')}
          onClick={() => onAccept(s)}
          title={s.text}
        >
          <span
            className="autocomplete-shortcut"
            style={{ borderLeftColor: sourceColor(s.source) }}
          >
            {i === 0 ? 'Tab' : `Alt+${i + 1}`}
          </span>
          <span className="autocomplete-text">
            {s.text.length > 80 ? s.text.slice(0, 80) + '…' : s.text}
          </span>
          <span className="autocomplete-source" style={{ color: sourceColor(s.source) }}>
            {sourceLabel(s.source, lang)}
          </span>
        </button>
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

export function AutocompleteSettings({ prefs, onChange, lang }) {
  const uk = lang === 'uk'
  const set = (key, val) => onChange({ ...prefs, [key]: val })

  return (
    <div className="autocomplete-settings">
      <div className="rail-h">{uk ? 'Автодоповнення' : 'Autocomplete'}</div>

      <label className="setting-row">
        <span>{uk ? 'Підказки-примари (Layer A)' : 'Ghost text (Layer A)'}</span>
        <input
          type="checkbox"
          checked={prefs.ghostEnabled !== false}
          onChange={e => set('ghostEnabled', e.target.checked)}
        />
      </label>

      <label className="setting-row">
        <span>{uk ? 'Пропозиції (Layer B)' : 'Pill suggestions (Layer B)'}</span>
        <input
          type="checkbox"
          checked={prefs.pillsEnabled !== false}
          onChange={e => set('pillsEnabled', e.target.checked)}
        />
      </label>

      <div className="rail-h" style={{ marginTop: 8 }}>{uk ? 'Джерела' : 'Sources'}</div>

      {Object.entries(SOURCE_META).map(([key, meta]) => (
        <label key={key} className="setting-row">
          <span style={{ fontSize: 12 }}>{lang === 'uk' ? meta.labelUk : meta.labelEn}</span>
          <input
            type="checkbox"
            checked={prefs.sources?.[key] !== false}
            onChange={e => set('sources', { ...(prefs.sources || {}), [key]: e.target.checked })}
          />
        </label>
      ))}

      <div className="rail-h" style={{ marginTop: 8 }}>{uk ? 'Чутливість' : 'Sensitivity'}</div>
      <div style={{ padding: '0 4px' }}>
        <input
          type="range" min="1" max="3"
          value={prefs.sensitivity || 2}
          onChange={e => set('sensitivity', parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
          <span>{uk ? 'Низька' : 'Low'}</span>
          <span>{uk ? 'Середня' : 'Medium'}</span>
          <span>{uk ? 'Висока' : 'High'}</span>
        </div>
      </div>
    </div>
  )
}
