// Sprint 09 — Public signature verification page (/verify/:token).
// Anonymous access; no auth required. No PHI — only signer + signature
// metadata, exactly as GET {signing}/verify/{token} returns it.
//
// Truthfulness: the badge is <SignedBadge> fed the verify body verbatim —
// a `dev` envelope (status "dev_not_qualified") renders the grey non-legal
// badge and never anything resembling КЕП.

import React, { useState, useEffect } from 'react'
import { Icon } from '../components/UI.jsx'
import { verifyEnvelope, verifiedPdfUrl, verifyPageUrl } from '../api/signing.js'
import { SignedBadge, providerLabel } from '../components/signing/SignedBadge.jsx'

function ValidBadge({ uk }) {
  return (
    <div className="verify-badge valid" role="status">
      <span className="verify-icon">✓</span>
      <div>
        <div className="verify-title">{uk ? 'Підпис дійсний' : 'Signature valid'}</div>
        <div className="verify-sub">{uk ? 'Перевірено за реєстром КНЕДП' : 'Verified against the qualified-provider registry'}</div>
      </div>
    </div>
  )
}

function DevBadge({ uk }) {
  return (
    <div className="verify-badge warning" role="status" data-testid="verify-dev-badge">
      <span className="verify-icon">⚠</span>
      <div>
        <div className="verify-title">{uk ? 'DEV — не є юридичним підписом' : 'DEV — not a legally binding signature'}</div>
        <div className="verify-sub">
          {uk
            ? 'Тестовий підпис середовища розробки. Документ не має юридичної сили.'
            : 'A development-environment test signature. The document carries no legal weight.'}
        </div>
      </div>
    </div>
  )
}

function InvalidBadge({ uk, reason }) {
  return (
    <div className="verify-badge invalid" role="alert">
      <span className="verify-icon">✗</span>
      <div>
        <div className="verify-title">{uk ? 'Підпис не знайдено або недійсний' : 'Signature not found or invalid'}</div>
        {reason && <div className="verify-sub">{reason}</div>}
      </div>
    </div>
  )
}

export function VerifyPage({ envelopeId: token, lang }) {
  const uk = lang === 'uk'
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    verifyEnvelope(token)
      .then(r => { if (alive) { setResult(r); setLoading(false) } })
      .catch(e => {
        if (!alive) return
        setError(e.message || (uk ? 'Не вдалося перевірити підпис.' : 'Could not verify the signature.'))
        setLoading(false)
      })
    return () => { alive = false }
  }, [token])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verifyPageUrl(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const isDev = result && result.signature_level === 'dev'

  return (
    <div className="verify-page">
      <div className="verify-header">
        <div className="sb-brand-mark" style={{ width: 32, height: 32, fontSize: 16 }}>D</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Dictat</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {uk ? 'Верифікація цифрового підпису' : 'Digital signature verification'}
          </div>
        </div>
      </div>

      <div className="verify-card">
        <div className="verify-envelope-id">
          <span className="muted" style={{ fontSize: 12 }}>{uk ? 'Токен перевірки' : 'Verification token'}</span>
          <span className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{token}</span>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <div className="muted">{uk ? 'Перевірка підпису…' : 'Verifying signature…'}</div>
          </div>
        )}

        {!loading && error && <InvalidBadge uk={uk} reason={error} />}

        {!loading && result && (
          <>
            {isDev ? <DevBadge uk={uk} /> : <ValidBadge uk={uk} />}

            <div style={{ margin: '10px 0' }}>
              <SignedBadge envelope={result} lang={lang} />
            </div>

            <div className="verify-details">
              <div className="verify-row">
                <span>{uk ? 'Підписант' : 'Signed by'}</span>
                <strong>{result.signer_full_name || '—'}</strong>
              </div>
              <div className="verify-row">
                <span>{uk ? 'Спосіб підписання' : 'Signing method'}</span>
                <span>{providerLabel(result.provider, lang) || result.provider}</span>
              </div>
              <div className="verify-row">
                <span>{uk ? 'Час підписання' : 'Signed at'}</span>
                <span>{result.signed_at ? new Date(result.signed_at).toLocaleString(uk ? 'uk-UA' : 'en-US') : '—'}</span>
              </div>
              {result.certificate_issuer_cn && (
                <div className="verify-row">
                  <span>{uk ? 'Видавець сертифіката' : 'Certificate issuer'}</span>
                  <span>{result.certificate_issuer_cn}</span>
                </div>
              )}
              {result.certificate_serial && (
                <div className="verify-row">
                  <span>{uk ? 'Серійний номер' : 'Serial number'}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{result.certificate_serial}</span>
                </div>
              )}
              {result.signature_algorithm && (
                <div className="verify-row">
                  <span>{uk ? 'Алгоритм підпису' : 'Signature algorithm'}</span>
                  <span>{result.signature_algorithm}</span>
                </div>
              )}
              <div className="verify-row">
                <span>{uk ? 'Хеш документа (SHA-256)' : 'Document hash (SHA-256)'}</span>
                <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{result.document_hash_sha256_hex}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <a className="btn" href={verifiedPdfUrl(token)} download data-testid="verify-pdf-download">
                <Icon name="download" size={13} /> {uk ? 'Завантажити підписаний документ' : 'Download signed document'}
              </a>
              <button className="btn ghost" onClick={copy}>
                {copied ? (uk ? 'Скопійовано ✓' : 'Copied ✓') : (uk ? 'Копіювати посилання' : 'Copy link')}
              </button>
            </div>
          </>
        )}

        <div className="verify-footer">
          <Icon name="shield" size={12} />
          <span>
            {uk
              ? 'Ця сторінка є публічною і не містить медичних даних пацієнта.'
              : 'This page is public and contains no patient medical data.'}
          </span>
        </div>
      </div>
    </div>
  )
}
