// Sprint 09 — Public signature verification page (/verify/:envelopeId)
// Anonymous access; no auth required. No PHI — only signer + signature metadata.

import React, { useState, useEffect } from 'react'
import { Icon } from '../components/UI.jsx'
import { verifyEnvelope } from '../api/signing.js'

// ── Verification states ───────────────────────────────────────────────────

function ValidBadge() {
  return (
    <div className="verify-badge valid" role="status">
      <span className="verify-icon">✓</span>
      <div>
        <div className="verify-title">Підпис дійсний / Signature valid</div>
        <div className="verify-sub">Verified against KEP authority chain</div>
      </div>
    </div>
  )
}

function InvalidBadge({ reason }) {
  return (
    <div className="verify-badge invalid" role="alert">
      <span className="verify-icon">✗</span>
      <div>
        <div className="verify-title">Підпис недійсний / Signature invalid</div>
        <div className="verify-sub">{reason}</div>
      </div>
    </div>
  )
}

function WarningBadge({ reason }) {
  return (
    <div className="verify-badge warning" role="note">
      <span className="verify-icon">⚠</span>
      <div>
        <div className="verify-title">Попередження / Warning</div>
        <div className="verify-sub">{reason}</div>
      </div>
    </div>
  )
}

// ── Main verification page ────────────────────────────────────────────────

export function VerifyPage({ envelopeId, lang }) {
  const uk = lang === 'uk'
  const [loading, setLoading] = useState(true)
  const [result,  setResult]  = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    verifyEnvelope(envelopeId)
      .then(r => { if (alive) { setResult(r); setLoading(false) } })
      .catch(e => {
        if (!alive) return
        setResult({ valid: false, reason: e.message || (uk ? 'Не вдалося перевірити підпис.' : 'Could not verify signature.') })
        setLoading(false)
      })
    return () => { alive = false }
  }, [envelopeId])

  return (
    <div className="verify-page">
      <div className="verify-header">
        <div className="sb-brand-mark" style={{ width: 32, height: 32, fontSize: 16 }}>D</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Klarnote</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {uk ? 'Верифікація цифрового підпису' : 'Digital signature verification'}
          </div>
        </div>
      </div>

      <div className="verify-card">
        <div className="verify-envelope-id">
          <span className="muted" style={{ fontSize: 12 }}>Envelope ID</span>
          <span className="mono" style={{ fontSize: 12 }}>{envelopeId}</span>
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <div className="muted">{uk ? 'Перевірка підпису…' : 'Verifying signature…'}</div>
          </div>
        )}

        {!loading && result && (
          <>
            {result.valid
              ? <ValidBadge />
              : <InvalidBadge reason={result.reason} />}

            {result.warnings?.length > 0 && result.warnings.map((w, i) => (
              <WarningBadge key={i} reason={w} />
            ))}

            {result.valid && (
              <div className="verify-details">
                <div className="verify-row">
                  <span>{uk ? 'Підписано' : 'Signed by'}</span>
                  <strong>{result.signerName}</strong>
                </div>
                <div className="verify-row">
                  <span>{uk ? 'Видавець сертифіката' : 'Certificate issuer'}</span>
                  <span>{result.certIssuer}</span>
                </div>
                <div className="verify-row">
                  <span>{uk ? 'Серійний номер' : 'Serial number'}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{result.certSerial}</span>
                </div>
                <div className="verify-row">
                  <span>{uk ? 'Час підписання' : 'Signed at'}</span>
                  <span>{new Date(result.timestamp).toLocaleString(uk ? 'uk-UA' : 'en-US')}</span>
                </div>
                <div className="verify-row">
                  <span>{uk ? 'Статус відкликання' : 'Revocation status'}</span>
                  <span style={{ color: 'var(--ok)', fontWeight: 500 }}>
                    {result.revocationStatus === 'good' ? (uk ? 'Дійсний' : 'Good') : result.revocationStatus}
                  </span>
                </div>
                <div className="verify-row">
                  <span>{uk ? 'Хеш документа' : 'Document hash'}</span>
                  <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{result.documentHash}</span>
                </div>
                <div className="verify-row">
                  <span>{uk ? 'Формат підпису' : 'Signature format'}</span>
                  <span>{result.signatureValue}</span>
                </div>
                <div className="verify-row">
                  <span>LTV</span>
                  <span style={{ color: result.ltv ? 'var(--ok)' : 'var(--muted)' }}>
                    {result.ltv ? (uk ? 'Присутній' : 'Present') : '—'}
                  </span>
                </div>
              </div>
            )}

            <div className="verify-footer">
              <Icon name="shield" size={12} />
              <span>
                {uk
                  ? 'Верифікацію виконано відносно реєстру КЕП-центрів. Перевірено: '
                  : 'Verified against the KEP authority registry. Checked at: '}
                {new Date().toLocaleString(uk ? 'uk-UA' : 'en-US')}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
