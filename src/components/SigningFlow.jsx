// Sprint 09 — Signing Flow: Дія QR + local-key fallback
// Legal weight: completing this flow creates a cryptographically-signed artifact.
// Pre-sign review is non-skippable. Two equal paths: Дія (primary) + local key.
//
// All signing state is server-driven via src/api/signing.js — the FE initiates a
// signing session, renders the backend QR payload, and polls real status.

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Icon, Modal } from './UI.jsx'
import { useI18n } from '../i18n.js'
import {
  initSigning, getSigningStatus, cancelSigning,
  listCertificates, uploadSignedPdf, unsignedPdfUrl,
} from '../api/signing.js'
import { signReport, classifySignError } from '../api/reports.js'
import { asList } from './DataStates.jsx'
import { useAsync } from '../api/useAsync.js'

// Password signing is a DEVELOPMENT / PILOT scaffold: the backend
// dev_password provider re-authenticates the clinician against Keycloak
// and issues an envelope with signature_level='dev' (NOT qualified) —
// matching the backend's SIGNING_DEV_PASSWORD_ENABLED guard.
//
// Sprint 16: this used to hide the RADIO BUTTON behind the DEV flag while
// leaving the dialog itself in the bundle, under a comment claiming it was
// "tree-shaken out of production builds entirely". `npm run verify:bundle`
// disagreed. The flow now lives in ./DevPasswordSign.jsx and is reached only
// through the DEV-guarded dynamic import below — `import.meta.env.DEV` is the
// constant `false` in a build, so the branch, the `import()` and the whole
// module go away together.
const DEV_SIGNING = !!(import.meta.env && import.meta.env.DEV)

const DevPasswordFlow = DEV_SIGNING ? lazy(() => import('./DevPasswordSign.jsx')) : null

// ── QR Code renderer via qrcode library ──────────────────────────────────

function QRCanvas({ data, size = 240 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || !data) return
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current, data, {
        width: size, errorCorrectionLevel: 'H', margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).catch(() => {})
    })
  }, [data, size])
  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 8 }} aria-label="Scan this QR code with the Дія app on your phone" />
}

// ── Pre-sign review modal ──────────────────────────────────────────────────

function PreSignModal({ report, onCancel, onContinueDiia, onContinueLocal, onContinuePassword }) {
  const { lang } = useI18n()
  const uk = lang === 'uk'
  const [method, setMethod] = useState('diia')

  const onContinue = () => {
    if (method === 'diia') onContinueDiia()
    else if (method === 'password') onContinuePassword()
    else onContinueLocal()
  }

  return (
    <Modal onClose={onCancel}>
      <div className="modal-h">
        <h2>{uk ? 'Підписання документа' : 'Sign Document'}</h2>
        <p>{uk ? 'Перегляньте документ перед підписанням.' : 'Review the document before signing.'}</p>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="sign-preview-box">
          <Icon name="fileText" size={28} style={{ color: 'var(--muted)' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {report?.title || (uk ? 'Документ' : 'Document')}
            </div>
            {report?.subtitle && <div className="muted" style={{ fontSize: 12 }}>{report.subtitle}</div>}
          </div>
          <span className="chip" style={{ marginLeft: 'auto' }}>PDF</span>
        </div>

        <div className="sign-legal-notice" role="note">
          <Icon name="shield" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            {uk
              ? `⚠ Цей підпис є юридично обов'язковим відповідно до Закону України №2155-VIII. Підписаний документ неможливо редагувати — лише виправляти через механізм правок.`
              : '⚠ This signature is legally binding under Law 2155-VIII of Ukraine. A signed document cannot be edited — only amended through the formal amendment process.'}
          </p>
        </div>

        <div className="sign-method-picker">
          <div className="sign-method-label">{uk ? 'Спосіб підписання:' : 'Signing method:'}</div>
          <div className="sign-method-opts">
            <label className={'sign-method-opt' + (method === 'diia' ? ' on' : '')}>
              <input type="radio" name="method" value="diia" checked={method === 'diia'} onChange={() => setMethod('diia')} />
              <span>
                <strong>Дія.Підпис</strong>
                <span className="muted" style={{ fontSize: 12, display: 'block' }}>{uk ? 'QR-код у застосунку Дія' : 'QR code in the Дія app'}</span>
              </span>
              <span className="chip" style={{ marginLeft: 'auto', fontSize: 10 }}>{uk ? 'Рекомендовано' : 'Recommended'}</span>
            </label>
            <label className={'sign-method-opt' + (method === 'local' ? ' on' : '')}>
              <input type="radio" name="method" value="local" checked={method === 'local'} onChange={() => setMethod('local')} />
              <span>
                <strong>{uk ? 'Локальний КЕП' : 'Local KEP'}</strong>
                <span className="muted" style={{ fontSize: 12, display: 'block' }}>{uk ? 'Апаратний токен / сертифікат' : 'Hardware token / certificate'}</span>
              </span>
            </label>
            {DEV_SIGNING && (
              <label className={'sign-method-opt' + (method === 'password' ? ' on' : '')}>
                <input type="radio" name="method" value="password" checked={method === 'password'} onChange={() => setMethod('password')} />
                <span>
                  <strong>{uk ? 'Пароль' : 'Password'}</strong>
                  <span className="muted" style={{ fontSize: 12, display: 'block' }}>{uk ? 'Пароль облікового запису (для MVP/пілоту)' : 'Account password (MVP / pilot only)'}</span>
                </span>
                <span className="chip" style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--rec-soft, #fee)', color: 'var(--rec, #b00)' }}>DEV</span>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onCancel}>{uk ? 'Скасувати' : 'Cancel'}</button>
        <button className="btn primary" onClick={onContinue}>
          {uk ? 'Продовжити' : 'Continue'} →
        </button>
      </div>
    </Modal>
  )
}

// ── Дія QR flow ───────────────────────────────────────────────────────────

const DIIA_STEPS = ['initiated', 'awaiting_user', 'signing']

function DiiaQRFlow({ reportId, onSuccess, onCancel, onSwitchMethod }) {
  const { lang } = useI18n()
  const uk = lang === 'uk'
  const sessionReq = useAsync(() => initSigning(reportId, { method: 'diia' }), [reportId])
  const session = sessionReq.data
  const [status, setStatus] = useState('initiated')
  const [remaining, setRemaining] = useState(null)

  // Poll real signing status + run the expiry countdown.
  useEffect(() => {
    if (!session?.signing_id) return
    setStatus(session.status || 'initiated')
    if (session.expires_in != null) setRemaining(session.expires_in)

    let alive = true
    const poll = setInterval(async () => {
      try {
        const st = await getSigningStatus(session.signing_id)
        if (!alive) return
        setStatus(st.status)
        if (st.status === 'complete') {
          clearInterval(poll)
          onSuccess({ envelopeId: st.envelope_id, signer: st.signer, signedAt: st.signed_at })
        } else if (st.status === 'expired' || st.status === 'cancelled') {
          clearInterval(poll)
        }
      } catch { /* keep polling; transient errors are non-fatal */ }
    }, 2500)

    const tick = setInterval(() => setRemaining(s => (s == null ? s : Math.max(0, s - 1))), 1000)
    return () => { alive = false; clearInterval(poll); clearInterval(tick) }
  }, [session])

  const cancel = () => {
    if (session?.signing_id) cancelSigning(session.signing_id).catch(() => {})
    onCancel()
  }

  const statusLabels = {
    uk: { initiated: 'Очікування сканування…', awaiting_user: 'Підтвердіть у застосунку Дія…', signing: 'Підписання…', complete: 'Підписано!', expired: 'QR-код прострочений.', cancelled: 'Скасовано.' },
    en: { initiated: 'Waiting for scan…', awaiting_user: 'Confirm in the Дія app…', signing: 'Applying signature…', complete: 'Signed!', expired: 'QR code expired.', cancelled: 'Cancelled.' },
  }
  const label = statusLabels[lang]?.[status] || status
  const expired = status === 'expired' || status === 'cancelled'
  const complete = status === 'complete'

  return (
    <Modal onClose={cancel}>
      <div className="modal-h">
        <h2>{uk ? 'Підписати через Дія' : 'Sign with Дія'}</h2>
        <p>{uk ? 'Відскануйте QR-код у застосунку Дія для підписання.' : 'Scan the QR code in the Дія app to sign.'}</p>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {sessionReq.loading && <div className="sign-status-label">{uk ? 'Підготовка…' : 'Preparing…'}</div>}
        {sessionReq.error && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0' }}>
            <Icon name="x" size={36} style={{ color: 'var(--rec)', margin: '0 auto' }} />
            <div style={{ fontWeight: 500 }}>{sessionReq.error.message || (uk ? 'Не вдалося розпочати' : 'Could not start signing')}</div>
            <button className="btn ghost sm" onClick={onSwitchMethod}>{uk ? 'Перейти до локального КЕП' : 'Switch to local key'}</button>
          </div>
        )}

        {session && !expired && !complete && (
          <>
            <div className={'qr-wrapper' + (status === 'signing' ? ' qr-signing' : '')}>
              <QRCanvas data={session.qr_data} size={200} />
              {status !== 'initiated' && (
                <div className="qr-overlay">
                  {status === 'awaiting_user' && <div className="qr-pulse" />}
                  {status === 'signing' && <div className="spinner" style={{ width: 32, height: 32 }} />}
                </div>
              )}
            </div>
            <div className="sign-status-label">{label}</div>
            {remaining != null && (
              <div className="sign-countdown">{uk ? `Дійсний ще ${remaining} с` : `Valid for ${remaining}s`}</div>
            )}
            {session.deeplink && (
              <div className="muted" style={{ fontSize: 12 }}>
                {uk ? 'Або відкрийте на цьому пристрої:' : 'Or open on this device:'}
                <a href={session.deeplink} style={{ marginLeft: 6, color: 'var(--accent)', textDecoration: 'underline' }}>Дія →</a>
              </div>
            )}
          </>
        )}

        {expired && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0' }}>
            <Icon name="x" size={36} style={{ color: 'var(--rec)', margin: '0 auto' }} />
            <div style={{ fontWeight: 500 }}>{label}</div>
            <button className="btn primary" onClick={() => sessionReq.reload()}>{uk ? 'Спробувати ще раз' : 'Try again'}</button>
            <button className="btn ghost sm" onClick={onSwitchMethod}>{uk ? 'Перейти до локального КЕП' : 'Switch to local key'}</button>
          </div>
        )}

        {complete && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0' }}>
            <div className="sign-success-check">✓</div>
            <div style={{ fontWeight: 600, color: 'var(--ok)' }}>{label}</div>
          </div>
        )}

        {session && !expired && (
          <div className="sign-steps">
            {DIIA_STEPS.map((st, i) => {
              const idx = DIIA_STEPS.indexOf(status)
              const isDone = i < idx
              const isAct = DIIA_STEPS[i] === status
              return (
                <div key={st} className={'sign-step' + (isDone ? ' done' : isAct ? ' active' : '')}>
                  <span className="step-icon">{isDone ? '✓' : i + 1}</span>
                  <span>{statusLabels[lang]?.[st]?.replace('…', '') || st}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={cancel} disabled={status === 'signing'}>{uk ? 'Скасувати' : 'Cancel'}</button>
      </div>
    </Modal>
  )
}

// ── Local key flow ────────────────────────────────────────────────────────

function LocalKeyFlow({ reportId, onSuccess, onCancel }) {
  const { lang } = useI18n()
  const uk = lang === 'uk'
  const certsReq = useAsync(() => listCertificates(), [])
  const certs = asList(certsReq.data)
  const [selected, setSelected] = useState(null)
  const [phase, setPhase] = useState('pick') // 'pick' | 'download' | 'upload' | 'done'
  const [signingId, setSigningId] = useState(null)
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const proceed = async () => {
    if (!selected) return
    setError('')
    try {
      const s = await initSigning(reportId, { method: 'local' })
      setSigningId(s?.signing_id || null)
      setPhase('download')
    } catch (e) {
      setError(e.message || (uk ? 'Не вдалося розпочати' : 'Could not start'))
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError(uk ? 'Файл занадто великий (>10 МБ)' : 'File too large (>10 MB)'); return }
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError(uk ? 'Очікується PDF-файл' : 'Expected a PDF file'); return
    }
    setUploading(true)
    setError('')
    try {
      const r = await uploadSignedPdf(signingId, file)
      setPhase('done')
      setTimeout(() => onSuccess({ envelopeId: r?.envelope_id, signer: r?.signer, signedAt: r?.signed_at }), 500)
    } catch (err) {
      setUploading(false)
      setError(err.message || (uk ? 'Не вдалося перевірити підпис' : 'Could not validate signature'))
    }
  }

  return (
    <Modal onClose={onCancel}>
      <div className="modal-h">
        <h2>{uk ? 'Підписати локальним КЕП' : 'Sign with Local KEP'}</h2>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {phase === 'pick' && (
          <>
            <div className="muted" style={{ fontSize: 13 }}>{uk ? 'Оберіть сертифікат:' : 'Select a certificate:'}</div>
            {certsReq.loading && <div className="muted" style={{ fontSize: 13 }}>{uk ? 'Завантаження…' : 'Loading…'}</div>}
            {certsReq.error && <div style={{ color: 'var(--rec)', fontSize: 12 }}>{certsReq.error.message}</div>}
            {!certsReq.loading && certs.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>{uk ? 'Немає доступних сертифікатів.' : 'No certificates available.'}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {certs.map(c => (
                <label key={c.id} className={'cert-option' + (selected === c.id ? ' on' : '') + (!c.valid ? ' disabled' : '')}>
                  <input type="radio" name="cert" value={c.id} disabled={!c.valid}
                    checked={selected === c.id} onChange={() => c.valid && setSelected(c.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{c.subject}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {c.issuer} · {uk ? 'Дійсний до' : 'Expires'} {c.expires}
                      {!c.valid && <span style={{ color: 'var(--rec)', marginLeft: 6 }}>{uk ? '(прострочений)' : '(expired)'}</span>}
                    </div>
                  </div>
                  <Icon name={c.valid ? 'shield' : 'x'} size={14} style={{ color: c.valid ? 'var(--ok)' : 'var(--rec)' }} />
                </label>
              ))}
            </div>
            {error && <div style={{ color: 'var(--rec)', fontSize: 12 }}>{error}</div>}
          </>
        )}

        {phase === 'download' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>
              {uk
                ? '1. Завантажте непідписаний PDF.\n2. Підпишіть у програмі «Cipher» або «ІІТ Користувач».\n3. Завантажте підписаний PDF нижче.'
                : '1. Download the unsigned PDF.\n2. Sign it using Cipher or ІІТ User software.\n3. Upload the signed PDF below.'}
            </div>
            <a href={unsignedPdfUrl(reportId, lang)} className="btn" target="_blank" rel="noopener noreferrer">
              <Icon name="download" size={14} /> {uk ? 'Завантажити PDF' : 'Download PDF'}
            </a>
            <button className="btn primary" onClick={() => setPhase('upload')}>
              {uk ? 'Далі: завантажити підписаний' : 'Next: upload signed PDF'} →
            </button>
          </div>
        )}

        {phase === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="muted" style={{ fontSize: 13 }}>{uk ? 'Завантажте підписаний PDF-файл:' : 'Upload the signed PDF file:'}</div>
            {error && (
              <div style={{ color: 'var(--rec)', fontSize: 12, padding: '8px 12px', background: 'var(--rec-soft)', borderRadius: 6 }}>{error}</div>
            )}
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleUpload} />
            <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? (uk ? 'Перевірка…' : 'Validating…') : (uk ? 'Вибрати файл' : 'Choose file')}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="sign-success-check">✓</div>
            <div style={{ fontWeight: 600, color: 'var(--ok)' }}>{uk ? 'Підпис прийнято!' : 'Signature accepted!'}</div>
          </div>
        )}
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onCancel}>{uk ? 'Скасувати' : 'Cancel'}</button>
        {phase === 'pick' && (
          <button className="btn primary" disabled={!selected} onClick={proceed}>{uk ? 'Продовжити' : 'Continue'}</button>
        )}
      </div>
    </Modal>
  )
}

// ── Success state ─────────────────────────────────────────────────────────

function SignSuccess({ signerName, timestamp, envelopeId, onClose, lang }) {
  const uk = lang === 'uk'
  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2 style={{ color: 'var(--ok)' }}>{uk ? '✓ Підписано' : '✓ Signed'}</h2>
      </div>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="signed-info-card">
          {signerName && (
            <div className="signed-row">
              <span className="muted">{uk ? 'Підписано' : 'Signed by'}</span>
              <span>{signerName}</span>
            </div>
          )}
          {timestamp && (
            <div className="signed-row">
              <span className="muted">{uk ? 'Час' : 'Time'}</span>
              <span>{new Date(timestamp).toLocaleString(uk ? 'uk-UA' : 'en-US')}</span>
            </div>
          )}
          {envelopeId && (
            <div className="signed-row">
              <span className="muted">{uk ? 'Верифікація' : 'Verify'}</span>
              <a href={`#/verify/${envelopeId}`} style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--mono)' }}>
                /verify/{String(envelopeId).slice(0, 12)}…
              </a>
            </div>
          )}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={onClose}>{uk ? 'Закрити' : 'Close'}</button>
      </div>
    </Modal>
  )
}

// ── Main export: SigningFlow ───────────────────────────────────────────────

export function SigningFlow({ reportId, report, onClose, onSigned, lang }) {
  const [phase, setPhase] = useState('review') // 'review' | 'diia' | 'local' | 'success'
  const [result, setResult] = useState(null)

  const handleSuccess = (res) => {
    setResult(res || {})
    setPhase('success')
    onSigned?.(res || {})
  }

  if (phase === 'review') {
    return <PreSignModal report={report} onCancel={onClose}
      onContinueDiia={() => setPhase('diia')} onContinueLocal={() => setPhase('local')}
      onContinuePassword={() => setPhase('password')} />
  }
  if (phase === 'diia') {
    return <DiiaQRFlow reportId={reportId} onSuccess={handleSuccess} onCancel={onClose} onSwitchMethod={() => setPhase('local')} />
  }
  if (phase === 'local') {
    return <LocalKeyFlow reportId={reportId} onSuccess={handleSuccess} onCancel={onClose} />
  }
  // Unreachable in production twice over: the radio that sets this phase is
  // DEV-gated, and the component it renders does not exist in the bundle.
  if (phase === 'password' && DevPasswordFlow) {
    return (
      <Suspense fallback={null}>
        <DevPasswordFlow reportId={reportId} onSuccess={handleSuccess} onCancel={onClose} />
      </Suspense>
    )
  }
  if (phase === 'success') {
    return <SignSuccess signerName={result?.signer} timestamp={result?.signedAt || Date.now()}
      envelopeId={result?.envelopeId} onClose={onClose} lang={lang} />
  }
  return null
}
