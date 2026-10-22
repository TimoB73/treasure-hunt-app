import { describe, expect, it } from 'vitest'
import { assertAdmin, assertCanCreate, normalizeEmail, type Caller } from './access.js'

const caller = (c: Partial<Caller>): Caller => ({
  uid: 'u1',
  email: 'anna@example.org',
  emailVerified: true,
  provider: 'password',
  isAdmin: false,
  isAllowed: true,
  ...c,
})

describe('assertCanCreate', () => {
  it('lässt bestätigte, freigeschaltete Konten durch', () => {
    expect(() => assertCanCreate(caller({}))).not.toThrow()
  })

  it('verlangt eine echte Anmeldung statt anonym', () => {
    expect(() => assertCanCreate(caller({ provider: 'anonymous', email: null }))).toThrow(/anmelden/)
  })

  it('verlangt eine bestätigte E-Mail – auch für Admins', () => {
    expect(() => assertCanCreate(caller({ emailVerified: false }))).toThrow(/bestätige/)
    expect(() => assertCanCreate(caller({ emailVerified: false, isAdmin: true }))).toThrow(/bestätige/)
  })

  it('weist nicht freigeschaltete Konten freundlich ab', () => {
    expect(() => assertCanCreate(caller({ isAllowed: false }))).toThrow(/privat – bitte beim Betreiber freischalten/)
  })

  it('lässt Admins auch ohne Eintrag in der Gästeliste zu', () => {
    expect(() => assertCanCreate(caller({ isAllowed: false, isAdmin: true }))).not.toThrow()
  })
})

describe('assertAdmin', () => {
  it('lässt nur Admins zu', () => {
    expect(() => assertAdmin(caller({ isAdmin: true }))).not.toThrow()
    expect(() => assertAdmin(caller({}))).toThrow(/nur für den Betreiber/)
  })
})

describe('normalizeEmail', () => {
  it('vereinheitlicht Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(normalizeEmail('  Anna@Example.ORG ')).toBe('anna@example.org')
  })
})
