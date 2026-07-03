// Sprint 08 — Version diff view using diff-match-patch (word-level diffs per section)
import React, { useMemo } from 'react'
import { useI18n } from '../i18n.js'

// diff-match-patch is a CommonJS module; import the constructor
import DiffMatchPatch from 'diff-match-patch'

const dmp = new DiffMatchPatch()

// DIFF_DELETE = -1, DIFF_INSERT = 1, DIFF_EQUAL = 0
const DELETE = -1
const INSERT =  1
const EQUAL  =  0

function diffWords(oldText, newText) {
  // Tokenise to words for more readable diff
  const encode = (text) => {
    const words = text.split(/(\s+)/)
    const chars = words.map((w, i) => String.fromCharCode(i + 32)).join('')
    return { chars, tokens: words }
  }
  const a = encode(oldText || '')
  const b = encode(newText  || '')
  const diffs = dmp.diff_main(a.chars, b.chars)
  dmp.diff_cleanupSemantic(diffs)
  // Convert char codes back to words
  return diffs.map(([op, chars]) => [op, [...chars].map(c => a.tokens[c.charCodeAt(0) - 32] ?? b.tokens[c.charCodeAt(0) - 32] ?? '').join('')])
}

function DiffSection({ title, oldText, newText, lang }) {
  const diffs = useMemo(() => diffWords(oldText, newText), [oldText, newText])
  const hasChange = diffs.some(([op]) => op !== EQUAL)

  if (!hasChange && !oldText && !newText) return null

  return (
    <div className="diff-section">
      <div className="sec-h">
        <span>{title}</span>
        {hasChange && <span className="chip" style={{ fontSize: 11, background: 'var(--warn-soft)', color: 'var(--warn)' }}>
          {lang === 'uk' ? 'Змінено' : 'Changed'}
        </span>}
      </div>
      <div className="diff-body">
        {diffs.map(([op, text], i) => {
          if (op === EQUAL)  return <span key={i}>{text}</span>
          if (op === INSERT) return <ins key={i} className="diff-insert">{text}</ins>
          if (op === DELETE) return <del key={i} className="diff-delete">{text}</del>
          return null
        })}
        {!hasChange && <span className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>
          {lang === 'uk' ? '— без змін —' : '— no changes —'}
        </span>}
      </div>
    </div>
  )
}

// ── Amendment modal ───────────────────────────────────────────────────────

import { Modal } from './UI.jsx'
import { buildReportContent } from '../api/reports.js'

function loc(v, lang) {
  if (v == null) return ''
  if (typeof v === 'object') return v[lang] ?? v.en ?? Object.values(v)[0] ?? ''
  return v
}

const AMENDMENT_TYPES = [
  { key: 'correction',   uk: 'Виправлення', en: 'Correction' },
  { key: 'addition',     uk: 'Доповнення',  en: 'Addition' },
  { key: 'clarification',uk: 'Уточнення',   en: 'Clarification' },
]

// An amendment is a new *version* of the body, so the modal collects the
// amendment type, a reason, AND an editable copy of the report content seeded
// from the signed version. onConfirm receives the full AmendRequest payload
// ({ amendment_type, amendment_reason, content }); content is nested per the
// backend contract (buildReportContent).
export function AmendmentModal({ report, template, lang, onConfirm, onCancel, initialBody }) {
  const { t } = useI18n()
  const uk = lang === 'uk'
  const content = report?.content || {}
  const seedSections = content.sections || []

  const [amendmentType, setAmendmentType] = React.useState('correction')
  const [reason, setReason] = React.useState('')
  // Editable body keyed by section_key. Seeded from the current version, but a
  // voice-dictated draft (initialBody, from the report-view mic) wins per key so
  // the modal opens with the spoken corrections already applied.
  const [body, setBody] = React.useState(() =>
    Object.fromEntries(seedSections.map(s => [
      s.section_key,
      (initialBody && s.section_key in initialBody) ? initialBody[s.section_key] : (s.text || ''),
    ])))

  // Localized section titles resolved server-side (guide §3), keyed by section_key.
  const labelMap = React.useMemo(() => Object.fromEntries(
    (report?.section_labels || []).filter(l => l?.section_key).map(l => [l.section_key, l.name || {}])
  ), [report])
  const sectionLabel = (key) => loc(labelMap[key], lang) || key

  const reasonValid = reason.trim().length >= 20
  const changed = seedSections.some(s => (body[s.section_key] ?? '') !== (s.text || ''))
  const valid = reasonValid && changed

  const setSection = (key, text) => setBody(b => ({ ...b, [key]: text }))

  const submit = () => {
    if (!valid) return
    const contentPayload = buildReportContent({
      template_id: content.template_id,
      template_schema_version: content.template_schema_version,
      body,
      title: content.title,
      encounter_date: content.encounter_date,
    })
    onConfirm({
      amendment_type: amendmentType,
      amendment_reason: reason.trim(),
      content: contentPayload,
    })
  }

  return (
    <Modal onClose={onCancel}>
      <div className="modal-h">
        <h2>{uk ? 'Внести правки' : 'Amend Report'}</h2>
        <p>
          {uk
            ? 'Підписаний звіт неможливо редагувати напряму. Правки створять нову версію; оригінальний підпис залишається дійсним для попереднього тексту.'
            : 'A signed report cannot be edited directly. Amendments create a new version; the original signature remains valid for the prior text.'}
        </p>
      </div>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="signed-info-card">
          <div className="signed-row">
            <span className="muted">{uk ? 'Поточна версія' : 'Current version'}</span>
            <span>v{report?.version || 1} · {uk ? 'Підписано' : 'Signed'}</span>
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{uk ? 'Тип правки *' : 'Amendment type *'}</span>
          <div className="seg" style={{ display: 'flex', gap: 6 }}>
            {AMENDMENT_TYPES.map(ty => (
              <button
                key={ty.key}
                type="button"
                className={`btn sm${amendmentType === ty.key ? ' accent' : ''}`}
                onClick={() => setAmendmentType(ty.key)}
                aria-pressed={amendmentType === ty.key}
              >
                {uk ? ty.uk : ty.en}
              </button>
            ))}
          </div>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{uk ? 'Зміст звіту' : 'Report content'}</span>
          {seedSections.length === 0 ? (
            <span className="muted" style={{ fontSize: 12 }}>{uk ? '— порожній звіт —' : '— empty report —'}</span>
          ) : seedSections.map(s => (
            <label key={s.section_key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sectionLabel(s.section_key)}</span>
              <textarea
                className="ti"
                rows={3}
                value={body[s.section_key] ?? ''}
                onChange={e => setSection(s.section_key, e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </label>
          ))}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {uk ? 'Причина правок *' : 'Reason for amendment *'}
          </span>
          <textarea
            className="ti"
            rows={3}
            placeholder={uk
              ? 'Опишіть причину правок (мін. 20 символів)…'
              : 'Describe the reason for this amendment (min. 20 chars)…'}
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <span className="muted" style={{ fontSize: 11, textAlign: 'right' }}>
            {reason.length} / 4000 {!reasonValid && reason.length > 0 && `— ${uk ? 'мін. 20' : 'min. 20'}`}
          </span>
        </label>
        {!changed && reasonValid && (
          <span className="muted" style={{ fontSize: 11 }}>
            {uk ? 'Змініть текст звіту, щоб внести правку.' : 'Edit the report text to make an amendment.'}
          </span>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onCancel}>{uk ? 'Скасувати' : 'Cancel'}</button>
        <button className="btn primary" disabled={!valid} onClick={submit}>
          {uk ? 'Зберегти правки' : 'Save amendment'}
        </button>
      </div>
    </Modal>
  )
}

// ── Version diff view (full page) ─────────────────────────────────────────

export function ReportDiffView({ report, template, v1, v2, lang, onBack }) {
  const uk = lang === 'uk'
  const oldBody = report?.versions?.[v1 - 1]?.body || report?.body || {}
  const newBody = report?.versions?.[v2 - 1]?.body || report?.body || {}

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 8 }}>
            ← {uk ? 'Назад до звіту' : 'Back to report'}
          </button>
          <h1 style={{ fontSize: 18 }}>
            {uk ? `Порівняння версій v${v1} → v${v2}` : `Version diff v${v1} → v${v2}`}
          </h1>
        </div>
      </div>

      <div className="diff-legend">
        <span><ins className="diff-insert">+</ins> {uk ? 'Додано' : 'Inserted'}</span>
        <span><del className="diff-delete">−</del> {uk ? 'Видалено' : 'Deleted'}</span>
      </div>

      <div className="diff-doc">
        {(template?.sections || []).map(s => (
          <DiffSection
            key={s.id}
            title={s.name?.[lang] || s.name?.en}
            oldText={oldBody[s.id] || ''}
            newText={newBody[s.id] || ''}
            lang={lang}
          />
        ))}
      </div>
    </div>
  )
}
