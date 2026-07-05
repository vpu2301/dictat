import { describe, it, expect } from 'vitest'
import { EphemeralSecret } from './ephemeralSecret.js'

describe('EphemeralSecret', () => {
  it('round-trips container bytes to base64', () => {
    const s = new EphemeralSecret()
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255])
    s.setContainer(bytes)
    const b64 = s.containerBase64()
    const decoded = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    expect(Array.from(decoded)).toEqual([0, 1, 2, 250, 251, 252, 253, 254, 255])
  })

  it('handles containers larger than one base64 chunk', () => {
    const s = new EphemeralSecret()
    const big = new Uint8Array(0x8000 * 2 + 17).map((_, i) => i % 256)
    s.setContainer(big)
    const decoded = Uint8Array.from(atob(s.containerBase64()), c => c.charCodeAt(0))
    expect(decoded.length).toBe(big.length)
    expect(decoded[0x8000 * 2 + 16]).toBe((0x8000 * 2 + 16) % 256)
  })

  it('clear() zeroes the container bytes in place and drops everything', () => {
    const bytes = new Uint8Array([9, 9, 9, 9])
    const s = new EphemeralSecret()
    s.setContainer(bytes)
    s.setPassword('пароль')
    expect(s.isCleared()).toBe(false)
    s.clear()
    // the caller's own reference to the buffer is zeroed, not just dropped
    expect(Array.from(bytes)).toEqual([0, 0, 0, 0])
    expect(s.isCleared()).toBe(true)
    expect(s.containerBase64()).toBeNull()
    expect(s.password()).toBeNull()
    expect(s.hasContainer()).toBe(false)
    expect(s.hasPassword()).toBe(false)
  })
})
