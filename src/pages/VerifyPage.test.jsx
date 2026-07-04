// VerifyPage — the badge comes from the public /verify body verbatim; a dev
// envelope can never render the КЕП badge.
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VerifyPage } from './VerifyPage.jsx'

const QUALIFIED_BODY = {
  status: 'valid',
  signature_level: 'qualified',
  provider: 'diia',
  resource_type: 'report',
  signed_at: '2026-07-03T10:00:00+00:00',
  signer_full_name: 'Др. Олена Шевченко',
  is_qualified: true,
  certificate_issuer_cn: 'КНЕДП АЦСК',
  certificate_serial: '3ED5...9A',
  signature_algorithm: 'DSTU4145',
  document_hash_sha256_hex: 'ab'.repeat(32),
  valid: true,
  verification_token: 'tok_q',
}

const DEV_BODY = {
  ...QUALIFIED_BODY,
  status: 'dev_not_qualified',
  signature_level: 'dev',
  provider: 'dev_password',
  is_qualified: false,
  certificate_issuer_cn: null,
  certificate_serial: null,
  verification_token: 'tok_d',
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch')
})
afterEach(() => vi.restoreAllMocks())

const jsonResponse = (body) =>
  Promise.resolve(new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))

describe('VerifyPage', () => {
  it('renders the КЕП badge for a qualified envelope', async () => {
    fetch.mockImplementation(() => jsonResponse(QUALIFIED_BODY))
    render(<VerifyPage envelopeId="tok_q" lang="uk" />)
    expect(await screen.findByText('Підпис дійсний')).toBeInTheDocument()
    const badges = screen.getAllByRole('status')
    const levelBadge = badges.find(b => b.dataset.signatureLevel)
    expect(levelBadge).toHaveAttribute('data-signature-level', 'qualified')
    expect(levelBadge).toHaveTextContent('КЕП')
    expect(screen.getByTestId('verify-pdf-download')).toHaveAttribute(
      'href', expect.stringContaining('/verify/tok_q/pdf'))
  })

  it('a dev envelope renders the loud DEV warning and never КЕП', async () => {
    fetch.mockImplementation(() => jsonResponse(DEV_BODY))
    const { container } = render(<VerifyPage envelopeId="tok_d" lang="uk" />)
    expect(await screen.findByTestId('verify-dev-badge')).toHaveTextContent(
      'DEV — не є юридичним підписом')
    expect(container.textContent).not.toContain('КЕП')
  })

  it('renders the invalid state on a 404', async () => {
    fetch.mockImplementation(() => Promise.resolve(new Response(
      JSON.stringify({ detail: 'not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } })))
    render(<VerifyPage envelopeId="tok_missing" lang="uk" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Підпис не знайдено або недійсний')
  })
})
