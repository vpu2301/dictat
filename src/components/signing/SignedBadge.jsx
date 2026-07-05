// SignedBadge.jsx — the truthful signature badge.
//
// Driven ONLY by the envelope object the API returned (inline sign response,
// completed-session verify lookup, or the public /verify body) — the level is
// never inferred client-side. A `dev` envelope renders an unmistakable grey
// "not legally signed" badge and can never look like КЕП.

import React from 'react'

const PROVIDER_LABELS = {
  file_key: { uk: 'файловий ключ', en: 'file key' },
  diia: { uk: 'Дія.Підпис', en: 'Diia.Signature' },
  iit: { uk: 'апаратний токен', en: 'hardware token' },
}

export function providerLabel(provider, lang) {
  const l = PROVIDER_LABELS[provider]
  return l ? (lang === 'uk' ? l.uk : l.en) : provider || null
}

// envelope: { signature_level, provider?, signer_full_name?, signed_at? }
export function SignedBadge({ envelope, lang = 'uk', compact = false }) {
  const uk = lang === 'uk'
  if (!envelope || !envelope.signature_level) return null
  const level = envelope.signature_level

  if (level === 'qualified') {
    const prov = providerLabel(envelope.provider, lang)
    return (
      <span className="sig-badge qualified" data-signature-level="qualified" role="status">
        <span className="sig-badge-mark">КЕП</span>
        {!compact && (
          <span className="sig-badge-detail">
            {prov && <span>{prov}</span>}
            {envelope.signer_full_name && <span>{envelope.signer_full_name}</span>}
            {envelope.signed_at && (
              <span className="mono">{new Date(envelope.signed_at).toLocaleString(uk ? 'uk-UA' : 'en-US')}</span>
            )}
          </span>
        )}
      </span>
    )
  }

  // Anything that is not a verified qualified envelope renders the loud
  // non-legal badge — `dev` explicitly, unknown levels defensively.
  return (
    <span className="sig-badge dev" data-signature-level={level} role="status">
      <span className="sig-badge-mark">DEV</span>
      <span className="sig-badge-detail">
        {uk ? 'не є юридичним підписом' : 'not a legally binding signature'}
      </span>
    </span>
  )
}
