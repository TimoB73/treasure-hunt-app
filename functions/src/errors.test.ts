import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { anthropicError, orsError } from './errors.js'

const apiError = (status: number, type: string, message: string) =>
  Anthropic.APIError.generate(status, { type: 'error', error: { type, message } }, message, new Headers())

describe('anthropicError', () => {
  it('erkennt einen ungültigen Schlüssel', () => {
    const e = anthropicError(apiError(401, 'authentication_error', 'invalid x-api-key'))
    expect(e.reason).toBe('anthropic_key_invalid')
    expect(e.action).toContain('ANTHROPIC_API_KEY')
  })

  it('erkennt fehlendes Guthaben (neu als 402, alt als 400)', () => {
    expect(anthropicError(apiError(402, 'billing_error', 'Payment required')).reason).toBe('anthropic_credit')
    expect(
      anthropicError(
        apiError(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'),
      ).reason,
    ).toBe('anthropic_credit')
  })

  it('erkennt Überlastung', () => {
    expect(anthropicError(apiError(529, 'overloaded_error', 'Overloaded')).reason).toBe('anthropic_unavailable')
    expect(anthropicError(apiError(429, 'rate_limit_error', 'Too many')).reason).toBe('anthropic_rate_limit')
  })
})

describe('orsError', () => {
  it('unterscheidet Schlüssel- und Kontingentfehler', () => {
    expect(orsError(403, '').reason).toBe('ors_key_invalid')
    expect(orsError(429, '').reason).toBe('ors_quota')
    expect(orsError(500, 'boom').reason).toBe('ors_unavailable')
  })
})
