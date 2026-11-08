import { describe, expect, it } from 'vitest'
import { INVITE_SUBJECT, inviteMailto, inviteText } from './invite'

describe('Einladung', () => {
  const url = 'https://treasure-hunt-app-sandy.vercel.app'

  it('enthält Link, freigeschaltete Adresse und Anleitung für beide Systeme', () => {
    const text = inviteText('anna@example.org', url)
    expect(text).toContain(url)
    expect(text).toContain('Registrieren mit: anna@example.org')
    expect(text).toContain('📱 iPhone')
    expect(text).toContain('🤖 Android')
    expect(text).toContain('Ich habe bestätigt')
  })

  it('baut einen mailto-Link mit Empfänger, Betreff und CRLF-Zeilenumbrüchen', () => {
    const link = inviteMailto('anna@example.org', url)
    expect(link.startsWith('mailto:anna@example.org?subject=')).toBe(true)
    expect(decodeURIComponent(link.split('subject=')[1].split('&')[0])).toBe(INVITE_SUBJECT)
    expect(link).toContain('%0D%0A')
    expect(link).not.toMatch(/%0A(?<!%0D%0A)/)
  })
})
