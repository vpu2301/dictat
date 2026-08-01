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

// One side of a split view: the old column keeps deletions and drops what was
// inserted, the new column does the reverse. Equal runs appear in both, so the
// two columns read as the two documents, not as two halves of one diff.
function DiffColumn({ diffs, side, empty }) {
  const drop = side === 'old' ? INSERT : DELETE
  const kept = diffs.filter(([op]) => op !== drop)
  if (!kept.some(([, text]) => text)) return <div className="diff-col-empty">{empty}</div>
  return (
    <>
      {kept.map(([op, text], i) => {
        if (op === EQUAL)  return <span key={i}>{text}</span>
        if (op === INSERT) return <ins key={i} className="diff-insert">{text}</ins>
        return <del key={i} className="diff-delete">{text}</del>
      })}
    </>
  )
}

function DiffSection({ title, oldText, newText, lang, view, nOld, nNew }) {
  const diffs = useMemo(() => diffWords(oldText, newText), [oldText, newText])
  const hasChange = diffs.some(([op]) => op !== EQUAL)
  const uk = lang === 'uk'

  if (!hasChange && !oldText && !newText) return null

  return (
    <div className={'diff-section' + (hasChange ? ' changed' : '')}>
      <div className="sec-h">
        <span>{title}</span>
        {hasChange && <span className="chip diff-chip">{uk ? 'Змінено' : 'Changed'}</span>}
      </div>
      {view === 'split' ? (
        <div className="diff-cols">
          <div className="diff-col old">
            {/* Per-column tag — shown only where the columns stack (the modal)
                and the single header row at the top can't label them. */}
            <span className="diff-col-tag">v{nOld}</span>
            <DiffColumn diffs={diffs} side="old" empty={uk ? '— порожньо —' : '— empty —'} />
          </div>
          <div className="diff-col new">
            <span className="diff-col-tag">v{nNew}</span>
            <DiffColumn diffs={diffs} side="new" empty={uk ? '— порожньо —' : '— empty —'} />
          </div>
        </div>
      ) : (
        <div className="diff-body">
          {diffs.map(([op, text], i) => {
            if (op === EQUAL)  return <span key={i}>{text}</span>
            if (op === INSERT) return <ins key={i} className="diff-insert">{text}</ins>
            if (op === DELETE) return <del key={i} className="diff-delete">{text}</del>
            return null
          })}
          {/* Own line — appended inline it collides with the last word. */}
          {!hasChange && <div className="diff-nochange">
            {uk ? '— без змін —' : '— no changes —'}
          </div>}
        </div>
      )}
    </div>
  )
}

// ── Amendment modal ───────────────────────────────────────────────────────

import { Modal, Icon } from './UI.jsx'
import { MenuSelect } from './MenuSelect.jsx'
import { buildReportContent } from '../api/reports.js'

function loc(v, lang) {
  if (v == null) return ''
  if (typeof v === 'object') return v[lang] ?? v.en ?? Object.values(v)[0] ?? ''
  return v
}

// Audit stamps carry the year — unlike the list-row dates, these are read to
// answer "when exactly was this changed", sometimes years later.
function stamp(iso, lang) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-US',
    { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const AMENDMENT_LABEL = {
  correction:    { uk: 'Виправлення', en: 'Correction' },
  addition:      { uk: 'Доповнення',  en: 'Addition' },
  clarification: { uk: 'Уточнення',   en: 'Clarification' },
}

// "v12 · Dev Clinician A · 24 лип. 2026, 16:30" — one attribution, used in the
// split column headers and in the inline view's summary line. Noun phrasing
// ("Автор") keeps it neutral: we don't know anyone's pronouns.
function VersionStamp({ meta, lang, showVersion = true, onOpen }) {
  if (!meta) return null
  const uk = lang === 'uk'
  const inner = (
    <>
      {showVersion && <b>v{meta.version_number}</b>}
      {meta.is_amendment && (
        <span className="diff-stamp-tag">
          {loc(AMENDMENT_LABEL[meta.amendment_type] || { uk: 'Правка', en: 'Amendment' }, lang)}
        </span>
      )}
      <span className="diff-stamp-who" title={uk ? 'Автор версії' : 'Version author'}>{meta.by}</span>
      <span className="diff-stamp-at">{stamp(meta.at, lang)}</span>
    </>
  )
  // Clickable when the host can open the version record — the whole line is the
  // target, so the version, the author and the timestamp all lead to the detail.
  if (!onOpen) return <span className="diff-stamp">{inner}</span>
  return (
    <button
      type="button"
      className="diff-stamp is-link"
      onClick={() => onOpen(meta.version_number)}
      title={uk ? 'Показати відомості про версію' : 'Show version details'}
    >
      {inner}
      <Icon name="chevRight" size={12} className="muted diff-stamp-go" />
    </button>
  )
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

  // Which sections were edited vs the signed version — the right rail lists
  // them so the clinician sees the amendment's scope at a glance.
  const editedKeys = seedSections
    .filter(s => (body[s.section_key] ?? '') !== (s.text || ''))
    .map(s => s.section_key)

  return (
    <Modal onClose={onCancel} className="modal-xl amend-modal">
      <div className="modal-h">
        <h2>{uk ? 'Внести правки' : 'Amend Report'}</h2>
        <p>
          {uk
            ? 'Підписаний звіт неможливо редагувати напряму. Правки створять нову версію; оригінальний підпис залишається дійсним для попереднього тексту.'
            : 'A signed report cannot be edited directly. Amendments create a new version; the original signature remains valid for the prior text.'}
        </p>
      </div>
      {/* Two panes so the whole flow fits ONE screen: the report text on the
          left (scrolls internally), type/reason/summary always visible on the
          right. The modal itself never exceeds the viewport. */}
      <div className="modal-body amend-grid">
        <div className="amend-content">
          <span className="amend-label">{uk ? 'Зміст звіту' : 'Report content'}</span>
          {seedSections.length === 0 ? (
            <span className="muted" style={{ fontSize: 12 }}>{uk ? '— порожній звіт —' : '— empty report —'}</span>
          ) : seedSections.map(s => {
            const edited = (body[s.section_key] ?? '') !== (s.text || '')
            return (
              <label key={s.section_key} className={'amend-sec' + (edited ? ' is-edited' : '')}>
                <span className="amend-sec-h">
                  {sectionLabel(s.section_key)}
                  {edited && <em className="amend-edited-tag">{uk ? 'змінено' : 'edited'}</em>}
                </span>
                <textarea
                  className="ti"
                  rows={Math.min(6, Math.max(2, Math.ceil((body[s.section_key] ?? '').length / 90)))}
                  value={body[s.section_key] ?? ''}
                  onChange={e => setSection(s.section_key, e.target.value)}
                />
              </label>
            )
          })}
        </div>

        <div className="amend-side">
          <div className="signed-info-card">
            <div className="signed-row">
              <span className="muted">{uk ? 'Поточна версія' : 'Current version'}</span>
              <span>v{report?.version || 1} · {uk ? 'Підписано' : 'Signed'}</span>
            </div>
          </div>

          <label className="amend-field">
            <span className="amend-label">{uk ? 'Тип правки *' : 'Amendment type *'}</span>
            <div className="seg amend-types">
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

          <label className="amend-field">
            <span className="amend-label">
              {uk ? 'Причина правок *' : 'Reason for amendment *'}
            </span>
            <textarea
              className="ti"
              rows={4}
              placeholder={uk
                ? 'Опишіть причину правок (мін. 20 символів)…'
                : 'Describe the reason for this amendment (min. 20 chars)…'}
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <span className="muted" style={{ fontSize: 11, textAlign: 'right' }}>
              {reason.length} / 4000 {!reasonValid && reason.length > 0 && `— ${uk ? 'мін. 20' : 'min. 20'}`}
            </span>
          </label>

          {/* Live scope summary: what this amendment will change. */}
          <div className="amend-summary">
            {editedKeys.length
              ? <>
                  <span className="amend-label">{uk ? 'Змінені розділи' : 'Edited sections'}</span>
                  {editedKeys.map(k => <span key={k} className="amend-summary-item">{sectionLabel(k)}</span>)}
                </>
              : <span className="muted" style={{ fontSize: 12 }}>
                  {uk ? 'Змініть текст звіту, щоб внести правку.' : 'Edit the report text to make an amendment.'}
                </span>}
          </div>
        </div>
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

// `sections` is the resolved [{ id, title }] list to diff (template order plus
// any key the versions carry). `template` stays supported for older callers.
// labelV1/labelV2 are the version numbers shown in the heading — they differ
// from v1/v2, which index into report.versions.
//
// `versionOptions` + `onPairChange` put the version pickers in the diff's own
// header, so switching what you compare never means leaving the diff. Omit
// them and the header is read-only.
export function ReportDiffView({
  report, template, sections, v1, v2, labelV1, labelV2, lang, onBack,
  versionOptions, onPairChange, busy, defaultView = 'split', metaOld, metaNew, onOpenVersion,
}) {
  const uk = lang === 'uk'
  // Split by default; narrow hosts (the versions modal) start inline, where
  // stacked columns would just print every unchanged section twice.
  const [view, setView] = React.useState(defaultView) // split | inline
  const oldBody = report?.versions?.[v1 - 1]?.body || report?.body || {}
  const newBody = report?.versions?.[v2 - 1]?.body || report?.body || {}
  const rows = sections
    || (template?.sections || []).map(s => ({ id: s.id, title: s.name?.[lang] || s.name?.en }))
  const nOld = labelV1 ?? v1
  const nNew = labelV2 ?? v2
  const anyText = rows.some(s => (oldBody[s.id] || '') || (newBody[s.id] || ''))
  const changedCount = rows.filter(s => (oldBody[s.id] || '') !== (newBody[s.id] || '')).length

  const opts = (versionOptions || []).map(n => ({ value: n, label: `v${n}` }))
  const pickable = opts.length > 1 && typeof onPairChange === 'function'

  return (
    <div className={'diff-page' + (view === 'split' ? ' split' : '')}>
      <div className="diff-head">
        {onBack && (
          <button className="btn ghost sm diff-back" onClick={onBack}>
            ← {uk ? 'Назад до звіту' : 'Back to report'}
          </button>
        )}
        <h1>{uk ? 'Порівняння версій' : 'Version diff'}</h1>
        <p className="diff-sub">
          {changedCount === 0
            ? (uk ? 'Ці версії ідентичні.' : 'These versions are identical.')
            : (uk ? `Змінених розділів: ${changedCount}` : `${changedCount} section${changedCount === 1 ? '' : 's'} changed`)}
        </p>

        <div className="diff-bar">
          {pickable ? (
            <div className="diff-bar-pick">
              <MenuSelect
                value={nOld} options={opts} onChange={n => onPairChange(n, nNew)}
                disabled={busy} ariaLabel={uk ? 'Версія «від»' : 'From version'}
              />
              <Icon name="arrowRight" size={13} className="muted" />
              <MenuSelect
                value={nNew} options={opts} onChange={n => onPairChange(nOld, n)}
                disabled={busy} ariaLabel={uk ? 'Версія «до»' : 'To version'}
              />
              {nOld === nNew && (
                <span className="diff-bar-warn">{uk ? 'Оберіть різні версії' : 'Pick two different versions'}</span>
              )}
            </div>
          ) : (
            <div className="diff-bar-pick"><strong>v{nOld}</strong>
              <Icon name="arrowRight" size={13} className="muted" /><strong>v{nNew}</strong>
            </div>
          )}
          <div className="spacer" />
          <div className="diff-view-toggle" role="group" aria-label={uk ? 'Вигляд' : 'View'}>
            <button type="button" className={view === 'split' ? 'on' : ''}
              aria-pressed={view === 'split'} onClick={() => setView('split')}>
              {uk ? 'Поруч' : 'Split'}
            </button>
            <button type="button" className={view === 'inline' ? 'on' : ''}
              aria-pressed={view === 'inline'} onClick={() => setView('inline')}>
              {uk ? 'Разом' : 'Inline'}
            </button>
          </div>
        </div>

        {/* Who changed what, and when. In split view the same attribution sits
            in the column headers, so it isn't repeated here. */}
        {view === 'inline' && (metaOld || metaNew) && (
          <div className="diff-attrib">
            <VersionStamp meta={metaOld} lang={lang} onOpen={onOpenVersion} />
            <Icon name="arrowRight" size={12} className="muted" />
            <VersionStamp meta={metaNew} lang={lang} onOpen={onOpenVersion} />
          </div>
        )}

        {metaNew?.is_amendment && metaNew.amendment_reason && (
          <div className="diff-reason">
            <Icon name="edit" size={13} />
            <div>
              <b>{uk ? 'Причина правки' : 'Reason for the amendment'}</b>
              <p>{metaNew.amendment_reason}</p>
            </div>
          </div>
        )}

        {metaNew?.signed_at && (
          <div className="diff-signed">
            <Icon name="shield" size={12} />
            {uk ? 'Підписано' : 'Signed'}: <b>{metaNew.signed_by || '—'}</b>
            <span className="diff-stamp-at">{stamp(metaNew.signed_at, lang)}</span>
          </div>
        )}
      </div>

      {/* Swatches are empty — the +/− comes from the ::before marker, so
          spelling it out here too would render "++" / "−−". */}
      <div className="diff-legend">
        <span><ins className="diff-insert" aria-hidden="true" /> {uk ? 'Додано' : 'Inserted'}</span>
        <span><del className="diff-delete" aria-hidden="true" /> {uk ? 'Видалено' : 'Deleted'}</span>
      </div>

      {/* Column headers, once — repeating "v2 / v3" on every card is noise.
          Same grid and insets as `.diff-cols`, so the rule lines up. */}
      {view === 'split' && anyText && (
        <div className="diff-colhead">
          <span>{metaOld ? <VersionStamp meta={metaOld} lang={lang} onOpen={onOpenVersion} /> : <b>v{nOld}</b>}</span>
          <span>{metaNew ? <VersionStamp meta={metaNew} lang={lang} onOpen={onOpenVersion} /> : <b>v{nNew}</b>}</span>
        </div>
      )}

      <div className={'diff-doc' + (busy ? ' busy' : '')}>
        {anyText ? rows.map(s => (
          <DiffSection
            key={s.id}
            title={s.title}
            oldText={oldBody[s.id] || ''}
            newText={newBody[s.id] || ''}
            lang={lang}
            view={view}
            nOld={nOld}
            nNew={nNew}
          />
        )) : (
          <div className="psub">
            {uk ? 'Обидві версії порожні — немає що порівнювати.' : 'Both versions are empty — nothing to compare.'}
          </div>
        )}
      </div>
    </div>
  )
}
