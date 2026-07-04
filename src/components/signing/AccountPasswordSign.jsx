// AccountPasswordSign.jsx — sign with the account password (S09 follow-up).
//
// Interim first-class signing path: the clinician confirms the signature with
// their account password instead of a KEP key file. On the wire this is the
// backend's `dev_password` inline provider (the only password-tier provider
// the signing-service implements), offered in the dialog whenever /readyz
// advertises it. Honesty is preserved end-to-end: the artifact carries the
// API's non-qualified signature_level and <SignedBadge> renders it verbatim,
// so this path can never look like КЕП.

import React, { useEffect, useRef, useState } from 'react'
import { signReport } from '../../api/signing.js'
import { signingErrorMessage } from './signingErrors.js'
import { EphemeralSecret } from './ephemeralSecret.js'

export default function AccountPasswordSign({ reportId, lang, onSigned, onError }) {
  const uk = lang === 'uk'
  const secret = useRef(new EphemeralSecret())
  const [hasPassword, setHasPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  // The password lives in the EphemeralSecret only — never in React state —
  // and is cleared on unmount (dialog close) no matter how the flow ends.
  useEffect(() => {
    const s = secret.current
    return () => {
      s.clear()
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [])

  const submit = async () => {
    if (!secret.current.hasPassword() || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await signReport(reportId, {
        provider: 'dev_password',
        password: secret.current.password(),
        language: lang,
      })
      secret.current.clear()
      if (inputRef.current) inputRef.current.value = ''
      onSigned(res.envelope)
    } catch (e) {
      secret.current.clear()
      if (inputRef.current) inputRef.current.value = ''
      setHasPassword(false)
      setBusy(false)
      setError(signingErrorMessage(e, lang))
      onError?.(e)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="account-password-sign">
      <div className="sig-dev-notice" role="note">
        {uk
          ? 'Підпис підтверджується паролем вашого облікового запису. Це простий електронний підпис — він не є кваліфікованим (КЕП).'
          : 'The signature is confirmed with your account password. This is a simple electronic signature — not a qualified one (КЕП).'}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <span>{uk ? 'Пароль облікового запису' : 'Account password'}</span>
        <input
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          data-testid="account-password-input"
          onChange={(e) => {
            secret.current.setPassword(e.target.value)
            setHasPassword(e.target.value.length > 0)
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
      </label>

      {error && <div className="sig-error" role="alert" data-testid="sign-error">{error}</div>}

      <button className="btn primary" data-testid="account-password-submit"
        disabled={!hasPassword || busy} onClick={submit}>
        {busy ? (uk ? 'Підписання…' : 'Signing…') : (uk ? 'Підписати' : 'Sign')}
      </button>
    </div>
  )
}
