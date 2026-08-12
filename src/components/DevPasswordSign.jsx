// DevPasswordSign.jsx — the dev_password signing scaffold, in its own module
// so a production build does not contain it.
//
// WHAT THIS IS. The backend's `dev_password` provider re-authenticates a
// clinician against Keycloak and issues an envelope with
// signature_level='dev' — NOT a qualified signature, no legal weight. It
// exists so the signing stack can be exercised end to end without a Дія
// session or a hardware key, and it is switched off in the backend by
// SIGNING_DEV_PASSWORD_ENABLED.
//
// WHY IT MOVED HERE (sprint 16). The old arrangement kept these two surfaces
// inline in SigningFlow.jsx and ConsentSheet.jsx behind a
// `DEV_SIGNING && (...)` render guard, with a comment claiming they were
// "tree-shaken out of production builds entirely". They were not: hiding the
// button that reaches a component does not remove the component, and the
// production bundle still carried both dialogs and the literal
// `provider:"dev_password"`. `npm run verify:bundle` now checks that, which is
// how the claim was found to be false.
//
// The gating that actually works is a DEV-only DYNAMIC import at the call
// site: `import.meta.env.DEV` is replaced with the constant `false` in a
// build, the branch holding the `import()` is eliminated, and this module —
// with everything in it — is never emitted. The two call sites do exactly
// that; see the `lazy(...)` guards in SigningFlow.jsx and ConsentSheet.jsx.
//
// So: nothing may import this module statically. That is the whole point.

import React, { useState } from 'react'

import { Icon, Modal } from './UI.jsx'
import { useI18n, tr } from '../i18n.js'
import { signReport, classifySignError } from '../api/reports.js'

export const DEV_SIGNING_PROVIDER = 'dev_password'

// ── Report signing: password flow ────────────────────────────────────────

export default function DevPasswordFlow({ reportId, onSuccess, onCancel }) {
  const { lang } = useI18n()
  const uk = lang === 'uk'
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!password || busy) return
    setBusy(true); setError('')
    try {
      const res = await signReport(reportId, {
        provider: DEV_SIGNING_PROVIDER,
        password,
        language: lang,
      })
      onSuccess({
        envelopeId: res?.envelope_id,
        signer: res?.signer_full_name,
        signedAt: res?.signed_at,
      })
    } catch (e) {
      // Classified copy (2026-07-24): a 409 report_not_signable used to
      // surface as a raw error — a CORRECT password looked "rejected" when
      // the report state was the problem. Say what actually happened.
      const c = classifySignError(e)
      const NOT_SIGNABLE = {
        draft: uk
          ? 'Звіт ще не завершено — спершу натисніть «Завершити»'
          : 'The report is not finalized yet — press "Finalize" first',
        signed: uk ? 'Цю версію вже підписано' : 'This version is already signed',
        cancelled: uk ? 'Звіт скасовано — підпис неможливий' : 'The report is cancelled — cannot sign',
      }
      setError(
        c.kind === 'wrong_password' ? (uk ? 'Невірний пароль' : 'Wrong password')
        : c.kind === 'locked' ? (uk ? 'Обліковий запис тимчасово заблоковано' : 'Account temporarily locked')
        : c.kind === 'unavailable' ? (uk ? 'Сервіс підпису недоступний — спробуйте пізніше' : 'Signing service unavailable — try again later')
        : c.kind === 'not_signable' ? (NOT_SIGNABLE[c.current_status] ||
            (uk ? `Звіт у стані «${c.current_status || '?'}» не можна підписати` : `A report in "${c.current_status || '?'}" state cannot be signed`))
        : (e?.message || (uk ? 'Не вдалося підписати' : 'Could not sign')),
      )
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onCancel}>
      <div className="modal-h">
        <h2>{uk ? 'Підписати паролем' : 'Sign with Password'}</h2>
        <p className="muted" style={{ fontSize: 12.5 }}>
          {uk
            ? 'Введіть пароль вашого облікового запису. Це підпис рівня «dev» для MVP/пілоту — не кваліфікований.'
            : 'Enter your account password. This is a dev-level signature for MVP/pilot use — not a qualified signature.'}
        </p>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="sign-legal-notice" role="note" style={{ background: 'var(--rec-soft, #fff4f4)' }}>
          <Icon name="shield" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
            {uk
              ? '⚠ Підпис рівня «dev» — лише для розробки та пілотів. Не має юридичної сили кваліфікованого підпису.'
              : '⚠ Development-level signature — for development and pilots only. It does NOT carry the legal weight of a qualified signature.'}
          </p>
        </div>

        <input
          type="password"
          className="input"
          autoFocus
          autoComplete="current-password"
          placeholder={uk ? 'Пароль' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          style={{ padding: '10px 12px', fontSize: 14 }}
        />
        {error && (
          <div style={{ color: 'var(--rec)', fontSize: 12, padding: '8px 12px', background: 'var(--rec-soft, #fee)', borderRadius: 6 }}>
            {error}
          </div>
        )}
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onCancel} disabled={busy}>{uk ? 'Скасувати' : 'Cancel'}</button>
        <button className="btn primary" onClick={submit} disabled={!password || busy}>
          {busy ? (uk ? 'Підписання…' : 'Signing…') : (uk ? 'Підписати' : 'Sign')}
        </button>
      </div>
    </Modal>
  )
}


// ── Consent signing: the dev-provider field ──────────────────────────────
//
// The consent dialog (src/patients/ConsentSheet.jsx) offers the same scaffold
// for a patient consent. Only the two dev-specific pieces live here — the
// dialog around them is a real production surface and stays where it is.

export function ConsentDevPasswordField({ lang = 'uk', value, onChange }) {
  return (
    <label>
      <span>{tr(lang, 'Пароль користувача (dev-скаффолд)', 'Your password (dev scaffold)')}</span>
      <input className="ti" type="password" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/** The request body for a dev-signed consent. */
export function devConsentBody(password) {
  return { provider: DEV_SIGNING_PROVIDER, password }
}
