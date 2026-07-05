// The badge is driven by the envelope's signature_level from the API,
// verbatim. A `dev` envelope must be unmistakably non-legal and can never
// render anything that looks like КЕП.
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SignedBadge } from './SignedBadge.jsx'

const QUALIFIED = {
  signature_level: 'qualified',
  provider: 'file_key',
  signer_full_name: 'Др. Олена Шевченко',
  signed_at: '2026-07-03T10:00:00+00:00',
}
const DEV = {
  signature_level: 'dev',
  provider: 'dev_password',
  signer_full_name: 'Др. Олена Шевченко',
  signed_at: '2026-07-03T10:00:00+00:00',
}

describe('SignedBadge', () => {
  it('renders the КЕП badge for a qualified envelope', () => {
    render(<SignedBadge envelope={QUALIFIED} lang="uk" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('data-signature-level', 'qualified')
    expect(badge).toHaveTextContent('КЕП')
    expect(badge).toHaveTextContent('файловий ключ')
    expect(badge).toHaveTextContent('Др. Олена Шевченко')
  })

  it('renders the Дія provider label', () => {
    render(<SignedBadge envelope={{ ...QUALIFIED, provider: 'diia' }} lang="uk" />)
    expect(screen.getByRole('status')).toHaveTextContent('Дія.Підпис')
  })

  it('a dev envelope renders the grey non-legal badge and NEVER КЕП', () => {
    const { container } = render(<SignedBadge envelope={DEV} lang="uk" />)
    const badge = screen.getByRole('status')
    expect(badge).toHaveAttribute('data-signature-level', 'dev')
    expect(badge).toHaveTextContent('DEV')
    expect(badge).toHaveTextContent('не є юридичним підписом')
    expect(container.textContent).not.toContain('КЕП')
  })

  it('an unknown level renders the non-legal badge, not КЕП (defensive)', () => {
    const { container } = render(
      <SignedBadge envelope={{ signature_level: 'something_new' }} lang="uk" />,
    )
    expect(container.textContent).not.toContain('КЕП')
    expect(screen.getByRole('status')).toHaveTextContent('не є юридичним підписом')
  })

  it('renders nothing without a signature_level from the API', () => {
    const { container } = render(<SignedBadge envelope={{}} lang="uk" />)
    expect(container).toBeEmptyDOMElement()
  })
})
