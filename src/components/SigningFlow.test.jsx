// SigningFlow unit tests — the sprint-09 VERIFY assertions:
//   1. container bytes + key password never survive the dialog: cleared from
//      the EphemeralSecret after the request and after close, never logged,
//      never in web storage;
//   2. a bad-container/password 400 renders the precise Ukrainian message;
//   3. success renders the КЕП badge (level from the API envelope, verbatim);
//   4. the account-password path renders the non-qualified badge and its notice.
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SigningFlow } from './SigningFlow.jsx'
import { EphemeralSecret } from './signing/ephemeralSecret.js'
import { signReport, getAdvertisedProviders } from '../api/signing.js'

vi.mock('../api/signing.js', () => ({
  signReport: vi.fn(),
  getSigningSession: vi.fn(),
  cancelSigningSession: vi.fn().mockResolvedValue({ status: 'cancelled' }),
  getAdvertisedProviders: vi.fn(),
  verifyEnvelope: vi.fn(),
  verifiedPdfUrl: (t) => `http://localhost:8008/verify/${t}/pdf`,
  verifyPageUrl: (t) => `http://localhost/#/verify/${t}`,
}))

const KEY_BYTES = new Uint8Array([0x4b, 0x45, 0x59, 0x2d, 0x36, 0x01, 0x02, 0x03])
const KEY_PASSWORD = 'super-secret-key-password-☂'
const QUALIFIED_ENVELOPE = {
  envelope_id: 'e1',
  signature_level: 'qualified',
  verification_token: 'tok_abc123',
  signed_at: '2026-07-03T10:00:00+00:00',
  signer_full_name: 'Др. Олена Шевченко',
  is_qualified: true,
  report_status: 'signed',
}

// Every EphemeralSecret the flow creates, captured via a prototype spy —
// lets the test reach the holders without any seam in app code.
let secretSpy
function trackedSecrets() {
  return [...new Set(secretSpy.mock.contexts)]
}

let consoleSpies
const badApiError = (status, error) =>
  Object.assign(new Error(error), { status, problem: { detail: { error, detail: error } } })

beforeEach(() => {
  vi.clearAllMocks()
  getAdvertisedProviders.mockResolvedValue(['diia', 'file_key'])
  secretSpy = vi.spyOn(EphemeralSecret.prototype, 'setPassword')
  consoleSpies = ['log', 'info', 'warn', 'error', 'debug'].map(m => vi.spyOn(console, m))
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function openFileKeyForm(user) {
  render(<SigningFlow reportId="r1" report={{ title: 'МРТ', code: 'MRI-1' }} lang="uk"
    onClose={() => {}} onSigned={() => {}} />)
  await user.click(screen.getByTestId('sign-continue'))
  await screen.findByTestId('file-key-sign')
}

async function fillFileKeyForm(user) {
  const file = new File([KEY_BYTES], 'Key-6.dat', { type: 'application/octet-stream' })
  await user.upload(screen.getByTestId('key-file-input'), file)
  await user.type(screen.getByTestId('key-password-input'), KEY_PASSWORD)
  await waitFor(() => expect(screen.getByTestId('file-key-submit')).toBeEnabled())
}

function expectNoSecretsAnywhere() {
  for (const s of trackedSecrets()) expect(s.isCleared()).toBe(true)
  for (const spy of consoleSpies) {
    for (const call of spy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(KEY_PASSWORD)
    }
  }
  for (const store of [window.localStorage, window.sessionStorage]) {
    if (store) expect(JSON.stringify({ ...store })).not.toContain(KEY_PASSWORD)
  }
}

describe('file-key signing', () => {
  it('signs, renders the КЕП badge, and clears all key material', async () => {
    const user = userEvent.setup()
    signReport.mockResolvedValue({ kind: 'envelope', envelope: QUALIFIED_ENVELOPE })

    await openFileKeyForm(user)
    await fillFileKeyForm(user)
    await user.click(screen.getByTestId('file-key-submit'))

    // success screen with the API-driven qualified badge
    await screen.findByTestId('sign-success')
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('data-signature-level', 'qualified')
    expect(badge).toHaveTextContent('КЕП')
    expect(screen.getByTestId('verify-link')).toHaveAttribute('href', '#/verify/tok_abc123')
    expect(screen.getByTestId('signed-pdf-download')).toHaveAttribute(
      'href', 'http://localhost:8008/verify/tok_abc123/pdf')

    // the request carried the container as base64 + the password — in memory only
    expect(signReport).toHaveBeenCalledTimes(1)
    const body = signReport.mock.calls[0][1]
    expect(body.provider).toBe('file_key')
    expect(Uint8Array.from(atob(body.key_container_b64), c => c.charCodeAt(0)))
      .toEqual(KEY_BYTES)
    expect(body.key_password).toBe(KEY_PASSWORD)

    // key material is gone the moment the request finished
    expectNoSecretsAnywhere()
  })

  it('renders the precise Ukrainian message on a 400 bad container/password', async () => {
    const user = userEvent.setup()
    signReport.mockRejectedValue(badApiError(400, 'key_container_rejected'))

    await openFileKeyForm(user)
    await fillFileKeyForm(user)
    await user.click(screen.getByTestId('file-key-submit'))

    const err = await screen.findByTestId('sign-error')
    expect(err).toHaveTextContent(
      'Не вдалося відкрити контейнер ключа: невірний файл або хибний пароль до ключа.')
    // rejected credentials are wiped immediately, not just on close
    expectNoSecretsAnywhere()
    expect(screen.getByTestId('key-password-input')).toHaveValue('')
  })

  it('renders the lockout message on a 423', async () => {
    const user = userEvent.setup()
    signReport.mockRejectedValue(badApiError(423, 'account_locked'))
    await openFileKeyForm(user)
    await fillFileKeyForm(user)
    await user.click(screen.getByTestId('file-key-submit'))
    expect(await screen.findByTestId('sign-error')).toHaveTextContent(
      'Обліковий запис тимчасово заблоковано')
  })

  it('renders the not-finalized message on a 409', async () => {
    const user = userEvent.setup()
    signReport.mockRejectedValue(badApiError(409, 'report_not_signable'))
    await openFileKeyForm(user)
    await fillFileKeyForm(user)
    await user.click(screen.getByTestId('file-key-submit'))
    expect(await screen.findByTestId('sign-error')).toHaveTextContent(
      'підписати можна лише завершений звіт')
  })

  it('clears key material when the dialog closes without submitting', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<SigningFlow reportId="r1" report={{}} lang="uk"
      onClose={() => {}} onSigned={() => {}} />)
    await user.click(screen.getByTestId('sign-continue'))
    await screen.findByTestId('file-key-sign')
    await fillFileKeyForm(user)

    unmount() // dialog closed mid-entry
    expectNoSecretsAnywhere()
    expect(signReport).not.toHaveBeenCalled()
  })
})

describe('account-password signing', () => {
  it('offers account-password signing when advertised, and renders the non-qualified badge', async () => {
    const user = userEvent.setup()
    getAdvertisedProviders.mockResolvedValue(['file_key', 'dev_password'])
    signReport.mockResolvedValue({
      kind: 'envelope',
      envelope: { ...QUALIFIED_ENVELOPE, signature_level: 'dev', is_qualified: false },
    })

    render(<SigningFlow reportId="r1" report={{}} lang="uk" onClose={() => {}} onSigned={() => {}} />)
    await user.click(await screen.findByRole('radio', { name: /Пароль облікового запису/ }))
    await user.click(screen.getByTestId('sign-continue'))

    const input = await screen.findByTestId('account-password-input')
    expect(screen.getByTestId('account-password-sign')).toHaveTextContent('не є кваліфікованим')
    await user.type(input, KEY_PASSWORD)
    await user.click(screen.getByTestId('account-password-submit'))

    await screen.findByTestId('sign-success')
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('data-signature-level', 'dev')
    expect(badge).toHaveTextContent('не є юридичним підписом')
    expect(badge.textContent).not.toContain('КЕП')
    expect(signReport.mock.calls[0][1]).toMatchObject({
      provider: 'dev_password', password: KEY_PASSWORD,
    })
    expectNoSecretsAnywhere()
  })

  it('renders the rejected-password message on a 401 and clears the password', async () => {
    const user = userEvent.setup()
    getAdvertisedProviders.mockResolvedValue(['file_key', 'dev_password'])
    signReport.mockRejectedValue(badApiError(401, 'account_password_rejected'))

    render(<SigningFlow reportId="r1" report={{}} lang="uk" onClose={() => {}} onSigned={() => {}} />)
    await user.click(await screen.findByRole('radio', { name: /Пароль облікового запису/ }))
    await user.click(screen.getByTestId('sign-continue'))
    await user.type(await screen.findByTestId('account-password-input'), KEY_PASSWORD)
    await user.click(screen.getByTestId('account-password-submit'))

    expect(await screen.findByTestId('sign-error')).toHaveTextContent(
      'Пароль облікового запису не прийнято.')
    expect(screen.getByTestId('account-password-input')).toHaveValue('')
    expectNoSecretsAnywhere()
  })

  it('does not offer account-password signing when the backend does not advertise it', async () => {
    getAdvertisedProviders.mockResolvedValue(['file_key', 'diia'])
    render(<SigningFlow reportId="r1" report={{}} lang="uk" onClose={() => {}} onSigned={() => {}} />)
    await screen.findByRole('radio', { name: /Дія/ })
    await waitFor(() =>
      expect(screen.queryByRole('radio', { name: /Пароль облікового запису/ })).toBeNull())
  })
})
