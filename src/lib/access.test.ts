import { describe, expect, it } from 'vitest'
import { redirectFor } from './access'

describe('redirectFor', () => {
  it('sends a visitor who is not signed in to the sign-in page', () => {
    expect(redirectFor('/', false)).toBe('/anmelden')
    expect(redirectFor('/gebaeude/123', false)).toBe('/anmelden')
  })

  it('lets a visitor who is not signed in reach the sign-in, sign-up and auth pages', () => {
    expect(redirectFor('/anmelden', false)).toBeNull()
    expect(redirectFor('/registrieren', false)).toBeNull()
    expect(redirectFor('/auth/callback', false)).toBeNull()
  })

  it('sends a signed-in user from the sign-in and sign-up pages to the buildings list', () => {
    expect(redirectFor('/anmelden', true)).toBe('/')
    expect(redirectFor('/registrieren', true)).toBe('/')
  })

  it('lets a signed-in user reach the app', () => {
    expect(redirectFor('/', true)).toBeNull()
    expect(redirectFor('/auth/callback', true)).toBeNull()
  })

  it('lets monitoring reach the health check without a session, but no other API route', () => {
    expect(redirectFor('/api/health', false)).toBeNull()
    expect(redirectFor('/api/health', true)).toBeNull()
    expect(redirectFor('/api/other', false)).toBe('/anmelden')
  })

  it('lets Vercel Cron reach the retention job without a session; the route checks the cron secret', () => {
    expect(redirectFor('/api/retention', false)).toBeNull()
    expect(redirectFor('/api/retentions', false)).toBe('/anmelden')
  })

  it('does not treat look-alike paths as public', () => {
    expect(redirectFor('/anmelden-falsch', false)).toBe('/anmelden')
    expect(redirectFor('/api/healthy', false)).toBe('/anmelden')
  })
})
