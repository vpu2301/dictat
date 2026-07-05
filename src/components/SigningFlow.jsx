// Sprint 09 (S09 revision) — Signing dialog: file KEP key + Дія.Підпис.
//
// One backend surface: POST /v1/reports/{id}/sign (src/api/signing.js).
//   file_key → inline 200 envelope (qualified) — the container is base64'd
//              in memory and travels only inside that one request;
//   diia     → 202 session, QR / deep link, polled to completion;
//   dev_password → inline 200 envelope (simple, non-qualified) — the
//              account-password path, offered whenever /readyz advertises it.
//
// Honesty rules enforced here:
//   - the success badge is <SignedBadge> driven by the envelope's
//     signature_level from the API, verbatim;
//   - key container + key password live in an EphemeralSecret (a ref, never
//     React state), cleared when the request ends and on dialog close.

import React, { useEffect, useRef, useState } from 'react'
import { Icon, Modal } from './UI.jsx'
import {
  signReport, getSigningSession, cancelSigningSession,
  getAdvertisedProviders, verifyEnvelope, verifiedPdfUrl, verifyPageUrl,
} from '../api/signing.js'
import { SignedBadge } from './signing/SignedBadge.jsx'
import { signingErrorCode, signingErrorMessage } from './signing/signingErrors.js'
import { EphemeralSecret } from './signing/ephemeralSecret.js'
import AccountPasswordSign from './signing/AccountPasswordSign.jsx'

// Providers this dialog can drive. Дія and the account-password path
// (wire provider "dev_password") are offered when advertised; file_key is
// the default MVP path and is always offered (a deployment without it fails
// loudly at sign time with the provider_unavailable copy).
const UI_PROVIDERS = ['file_key', 'diia', 'dev_password']

// ── QR renderer ───────────────────────────────────────────────────────────

function QRCanvas({ data, size = 220 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || !data) return
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current, data, {
        width: size, errorCorrectionLevel: 'M', margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }).catch(() => {})
    })
  }, [data, size])
  return (
    <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: 8 }}
      aria-label="Скануйте QR-код у застосунку Дія" data-testid="diia-qr" />
  )
}

// ── Provider choice ───────────────────────────────────────────────────────

function ChooseProvider({ report, providers, method, setMethod, onCancel, onContinue, lang }) {
  const uk = lang === 'uk'
  const has = (p) => providers.includes(p)

  return (
    <Modal onClose={onCancel}>
      <div className="modal-h">
        <h2>{uk ? 'Підписання звіту' : 'Sign report'}</h2>
        <p>{uk ? 'Перегляньте документ перед підписанням.' : 'Review the document before signing.'}</p>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="sign-preview-box">
          <Icon name="fileText" size={26} style={{ color: 'var(--muted)' }} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {report?.title || (uk ? 'Медичний звіт' : 'Medical report')}
          </div>
          {report?.code && <span className="chip" style={{ marginLeft: 'auto' }}>{report.code}</span>}
        </div>

        <div className="sign-legal-notice" role="note">
          <Icon name="shield" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            {uk
              ? 'Кваліфікований електронний підпис має юридичну силу згідно із Законом України №2155-VIII. Підписаний звіт неможливо редагувати — лише доповнювати правками.'
              : 'A qualified electronic signature is legally binding under Law 2155-VIII of Ukraine. A signed report cannot be edited — only amended.'}
          </p>
        </div>

        <div className="sign-method-picker" role="radiogroup" aria-label={uk ? 'Спосіб підписання' : 'Signing method'}>
          <div className="sign-method-label">{uk ? 'Спосіб підписання:' : 'Signing method:'}</div>
          <div className="sign-method-opts">
            <label className={'sign-method-opt' + (method === 'file_key' ? ' on' : '')}>
              <input type="radio" name="sign-method" value="file_key"
                checked={method === 'file_key'} onChange={() => setMethod('file_key')} />
              <span>
                <strong>{uk ? 'Файловий ключ (КЕП)' : 'File key (KEP)'}</strong>
                <span className="muted" style={{ fontSize: 12, display: 'block' }}>
                  {uk ? 'Ваш ключ, виданий КНЕДП (.dat / .jks / .pfx)' : 'Your КНЕДП-issued key file (.dat / .jks / .pfx)'}
                </span>
              </span>
              <span className="chip" style={{ marginLeft: 'auto', fontSize: 10 }}>{uk ? 'Основний' : 'Default'}</span>
            </label>

            {has('diia') && (
              <label className={'sign-method-opt' + (method === 'diia' ? ' on' : '')}>
                <input type="radio" name="sign-method" value="diia"
                  checked={method === 'diia'} onChange={() => setMethod('diia')} />
                <span>
                  <strong>Дія.Підпис</strong>
                  <span className="muted" style={{ fontSize: 12, display: 'block' }}>
                    {uk ? 'QR-код або застосунок Дія на телефоні' : 'QR code or the Дія app on your phone'}
                  </span>
                </span>
              </label>
            )}

            {has('dev_password') && (
              <label className={'sign-method-opt' + (method === 'dev_password' ? ' on' : '')}>
                <input type="radio" name="sign-method" value="dev_password"
                  checked={method === 'dev_password'} onChange={() => setMethod('dev_password')} />
                <span>
                  <strong>{uk ? 'Пароль облікового запису' : 'Account password'}</strong>
                  <span className="muted" style={{ fontSize: 12, display: 'block' }}>
                    {uk ? 'Простий електронний підпис — без файлового ключа' : 'Simple e-signature — no key file needed'}
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onCancel}>{uk ? 'Скасувати' : 'Cancel'}</button>
        <button className="btn primary" onClick={onContinue} data-testid="sign-continue">
          {uk ? 'Продовжити' : 'Continue'} →
        </button>
      </div>
    </Modal>
  )
}

// ── File-key (КЕП) path ───────────────────────────────────────────────────

function FileKeySign({ reportId, lang, onSigned }) {
  const uk = lang === 'uk'
  const secret = useRef(new EphemeralSecret())
  const fileRef = useRef(null)
  const passwordRef = useRef(null)
  const [fileName, setFileName] = useState('')   // display only — not key material
  const [ready, setReady] = useState({ container: false, password: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Dialog close (unmount) wipes the container bytes and the password.
  useEffect(() => {
    const s = secret.current
    return () => {
      s.clear()
      if (passwordRef.current) passwordRef.current.value = ''
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [])

  const pickFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) {
      setError(uk ? 'Файл ключа завеликий (понад 512 КБ) — це не схоже на контейнер КЕП.' : 'The key file is too large (>512 KB) — not a KEP container.')
      e.target.value = ''
      return
    }
    setError('')
    const bytes = new Uint8Array(await file.arrayBuffer())
    secret.current.setContainer(bytes)
    setFileName(file.name)
    setReady(r => ({ ...r, container: true }))
  }

  const submit = async () => {
    if (busy || !secret.current.hasContainer() || !secret.current.hasPassword()) return
    setBusy(true)
    setError('')
    try {
      const res = await signReport(reportId, {
        provider: 'file_key',
        key_container_b64: secret.current.containerBase64(),
        key_password: secret.current.password(),
        language: lang,
      })
      secret.current.clear()
      if (passwordRef.current) passwordRef.current.value = ''
      if (fileRef.current) fileRef.current.value = ''
      onSigned(res.envelope)
    } catch (e) {
      // Wrong password / bad container: drop the password, keep the picked
      // file so the clinician can retype. Everything still dies on close.
      secret.current.setPassword(null)
      if (passwordRef.current) passwordRef.current.value = ''
      const code = signingErrorCode(e)
      if (code === 'key_container_rejected' || e.status === 400) {
        secret.current.clear()
        if (fileRef.current) fileRef.current.value = ''
        setFileName('')
        setReady({ container: false, password: false })
      } else {
        setReady(r => ({ ...r, password: false }))
      }
      setBusy(false)
      setError(signingErrorMessage(e, lang))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="file-key-sign">
      <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
        {uk
          ? 'Оберіть файловий контейнер вашого особистого ключа, виданого кваліфікованим надавачем (КНЕДП), та введіть пароль до нього. Ключ використовується лише для цього підпису й ніде не зберігається.'
          : 'Pick the file container of your personal key issued by a qualified provider (КНЕДП) and enter its password. The key is used for this signature only and is never stored.'}
      </div>

      <input ref={fileRef} type="file" accept=".dat,.jks,.pfx,.p12,.zs2,.key"
        style={{ display: 'none' }} onChange={pickFile} data-testid="key-file-input" />
      <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
        <Icon name="download" size={13} />{' '}
        {fileName
          ? fileName
          : (uk ? 'Обрати файл ключа (.dat, .jks, .pfx)' : 'Choose key file (.dat, .jks, .pfx)')}
      </button>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <span>{uk ? 'Пароль до ключа' : 'Key password'}</span>
        <input
          ref={passwordRef}
          type="password"
          autoComplete="off"
          data-testid="key-password-input"
          onChange={(e) => {
            secret.current.setPassword(e.target.value)
            setReady(r => ({ ...r, password: e.target.value.length > 0 }))
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
      </label>

      {error && <div className="sig-error" role="alert" data-testid="sign-error">{error}</div>}

      <button className="btn primary" data-testid="file-key-submit"
        disabled={!ready.container || !ready.password || busy} onClick={submit}>
        {busy ? (uk ? 'Підписання…' : 'Signing…') : (uk ? 'Підписати' : 'Sign')}
      </button>
    </div>
  )
}

// ── Дія path ──────────────────────────────────────────────────────────────

const DIIA_WAITING = ['initiating', 'awaiting_user']

function DiiaSign({ reportId, lang, onSigned }) {
  const uk = lang === 'uk'
  const [session, setSession] = useState(null)
  const [initError, setInitError] = useState(null)
  const [status, setStatus] = useState('initiating')
  const [failureReason, setFailureReason] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const sessionRef = useRef(null)
  const doneRef = useRef(false)

  // Initiate (and re-initiate on retry).
  useEffect(() => {
    let alive = true
    setSession(null); setInitError(null); setStatus('initiating'); setFailureReason(null)
    signReport(reportId, { provider: 'diia', language: lang })
      .then(res => {
        if (!alive) return
        if (res.kind !== 'session') { onSigned(res.envelope); return }
        sessionRef.current = res.session
        setSession(res.session)
        setStatus('awaiting_user')
      })
      .catch(e => { if (alive) setInitError(e) })
    return () => { alive = false }
  }, [reportId, attempt])

  // Poll + countdown while a session is live.
  useEffect(() => {
    if (!session?.session_id) return
    let alive = true

    const finish = async (st) => {
      doneRef.current = true
      // The badge must carry the envelope's signature_level from the API —
      // the public verify endpoint is the authoritative source for it.
      let envelope = {
        envelope_id: st.signed_envelope_id,
        verification_token: st.verification_token,
        signed_at: st.signed_at,
        signer_full_name: st.signer_full_name,
        provider: 'diia',
      }
      try {
        const v = await verifyEnvelope(st.verification_token)
        envelope = { ...envelope, ...v }
      } catch {
        // verify lookup is retried by the success screen via the public page
      }
      if (alive) onSigned(envelope)
    }

    const poll = setInterval(async () => {
      try {
        const st = await getSigningSession(session.session_id)
        if (!alive || doneRef.current) return
        setStatus(st.status)
        if (st.status === 'signed') {
          clearInterval(poll); clearInterval(tick)
          await finish(st)
        } else if (st.status === 'failed') {
          clearInterval(poll); clearInterval(tick)
          setFailureReason(st.failure_reason || null)
        } else if (st.status === 'expired' || st.status === 'cancelled') {
          clearInterval(poll); clearInterval(tick)
        }
      } catch { /* transient poll errors are non-fatal */ }
    }, 2500)

    const deadline = session.expires_at ? new Date(session.expires_at).getTime() : null
    const tick = setInterval(() => {
      if (!deadline) return
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        clearInterval(tick); clearInterval(poll)
        setStatus(s => (s === 'signed' ? s : 'expired'))
      }
    }, 1000)

    return () => { alive = false; clearInterval(poll); clearInterval(tick) }
  }, [session])

  // Closing the dialog mid-wait cancels the pending session server-side.
  useEffect(() => () => {
    const s = sessionRef.current
    if (s?.session_id && !doneRef.current) cancelSigningSession(s.session_id).catch(() => {})
  }, [])

  const statusLabels = {
    initiating: uk ? 'Створення сесії…' : 'Creating session…',
    awaiting_user: uk ? 'Відскануйте QR-код та підтвердіть у застосунку Дія' : 'Scan the QR code and confirm in the Дія app',
    verifying: uk ? 'Перевірка підпису…' : 'Verifying signature…',
    signed: uk ? 'Підписано!' : 'Signed!',
    failed: uk ? 'Не вдалося підписати.' : 'Signing failed.',
    expired: uk ? 'Сесія прострочена — спробуйте ще раз.' : 'Session expired — try again.',
    cancelled: uk ? 'Сесію скасовано.' : 'Session cancelled.',
  }

  const dead = status === 'expired' || status === 'cancelled' || status === 'failed'
  const qrData = session?.qr_payload || session?.redirect_url || null

  if (initError) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
        <Icon name="x" size={34} style={{ color: 'var(--rec)', margin: '0 auto' }} />
        <div style={{ fontWeight: 500, fontSize: 13 }}>{signingErrorMessage(initError, lang)}</div>
        <button className="btn primary" onClick={() => setAttempt(a => a + 1)}>
          {uk ? 'Спробувати ще раз' : 'Try again'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }} data-testid="diia-sign">
      {!session && <div className="sign-status-label">{statusLabels.initiating}</div>}

      {session && !dead && (
        <>
          {qrData && (
            <div className={'qr-wrapper' + (status === 'verifying' ? ' qr-signing' : '')}>
              <QRCanvas data={qrData} />
              {status === 'verifying' && (
                <div className="qr-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
              )}
            </div>
          )}
          <div className="sign-status-label" data-testid="diia-status">{statusLabels[status] || status}</div>
          {remaining != null && DIIA_WAITING.includes(status) && (
            <div className="sign-countdown">{uk ? `Сесія дійсна ще ${remaining} с` : `Session valid for ${remaining}s`}</div>
          )}
          {session.redirect_url && (
            <a className="btn" href={session.redirect_url} target="_blank" rel="noopener noreferrer">
              {uk ? 'Відкрити застосунок Дія на цьому пристрої' : 'Open the Дія app on this device'} →
            </a>
          )}
        </>
      )}

      {dead && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }} data-testid="diia-expired">
          <Icon name="x" size={34} style={{ color: 'var(--rec)', margin: '0 auto' }} />
          <div style={{ fontWeight: 500, fontSize: 13 }}>{statusLabels[status]}</div>
          {failureReason && <div className="muted" style={{ fontSize: 12 }}>{failureReason}</div>}
          <button className="btn primary" data-testid="diia-retry" onClick={() => setAttempt(a => a + 1)}>
            {uk ? 'Спробувати ще раз' : 'Try again'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Success ───────────────────────────────────────────────────────────────

function SignSuccess({ envelope, lang, onClose }) {
  const uk = lang === 'uk'
  const [copied, setCopied] = useState(false)
  const token = envelope?.verification_token
  const link = token ? verifyPageUrl(token) : null

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable — the link is still selectable */ }
  }

  return (
    <>
      <div className="modal-h">
        <h2>{uk ? 'Звіт підписано' : 'Report signed'}</h2>
      </div>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="sign-success">
        <SignedBadge envelope={envelope} lang={lang} />

        <div className="signed-info-card">
          {envelope?.signer_full_name && (
            <div className="signed-row">
              <span className="muted">{uk ? 'Підписант' : 'Signed by'}</span>
              <span>{envelope.signer_full_name}</span>
            </div>
          )}
          {envelope?.signed_at && (
            <div className="signed-row">
              <span className="muted">{uk ? 'Час підписання' : 'Signed at'}</span>
              <span>{new Date(envelope.signed_at).toLocaleString(uk ? 'uk-UA' : 'en-US')}</span>
            </div>
          )}
          {token && (
            <div className="signed-row">
              <span className="muted">{uk ? 'Перевірка підпису' : 'Verify signature'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <a href={`#/verify/${token}`} target="_blank" rel="noopener noreferrer"
                  data-testid="verify-link"
                  style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  /verify/{String(token).slice(0, 14)}…
                </a>
                <button className="btn ghost sm" onClick={copy} data-testid="copy-verify-link">
                  {copied ? (uk ? 'Скопійовано ✓' : 'Copied ✓') : (uk ? 'Копіювати' : 'Copy')}
                </button>
              </span>
            </div>
          )}
        </div>

        {token && (
          <a className="btn" href={verifiedPdfUrl(token)} download data-testid="signed-pdf-download">
            <Icon name="download" size={13} /> {uk ? 'Завантажити підписаний документ' : 'Download signed document'}
          </a>
        )}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={onClose}>{uk ? 'Готово' : 'Done'}</button>
      </div>
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────

export function SigningFlow({ reportId, report, onClose, onSigned, lang = 'uk' }) {
  const uk = lang === 'uk'
  const [providers, setProviders] = useState(['file_key', 'diia'])
  const [method, setMethod] = useState('file_key')
  const [phase, setPhase] = useState('choose') // choose | sign | success
  const [envelope, setEnvelope] = useState(null)

  // Offer only what the deployment advertises (GET /readyz). Unreachable
  // readyz degrades to the two production paths — sign-time errors stay
  // precise either way.
  useEffect(() => {
    let alive = true
    getAdvertisedProviders()
      .then(list => {
        if (!alive) return
        // Trust the advertisement verbatim — an empty overlap must NOT keep
        // unwired options on offer (file_key stays as the always-on default).
        setProviders(UI_PROVIDERS.filter(p => list.includes(p)))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const handleSigned = (env) => {
    setEnvelope(env || {})
    setPhase('success')
    onSigned?.(env || {})
  }

  if (phase === 'choose') {
    return (
      <ChooseProvider report={report} providers={providers} method={method} setMethod={setMethod}
        lang={lang} onCancel={onClose} onContinue={() => setPhase('sign')} />
    )
  }

  if (phase === 'success') {
    return <Modal onClose={onClose}><SignSuccess envelope={envelope} lang={lang} onClose={onClose} /></Modal>
  }

  const titles = {
    file_key: uk ? 'Підписати файловим ключем (КЕП)' : 'Sign with file key (KEP)',
    diia: uk ? 'Підписати через Дія' : 'Sign with Дія',
    dev_password: uk ? 'Підписати паролем облікового запису' : 'Sign with account password',
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-h">
        <h2>{titles[method]}</h2>
      </div>
      <div className="modal-body">
        {method === 'file_key' && <FileKeySign reportId={reportId} lang={lang} onSigned={handleSigned} />}
        {method === 'diia' && <DiiaSign reportId={reportId} lang={lang} onSigned={handleSigned} />}
        {method === 'dev_password' && <AccountPasswordSign reportId={reportId} lang={lang} onSigned={handleSigned} />}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={() => setPhase('choose')}>← {uk ? 'Назад' : 'Back'}</button>
        <button className="btn" onClick={onClose}>{uk ? 'Скасувати' : 'Cancel'}</button>
      </div>
    </Modal>
  )
}
