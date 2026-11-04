import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './auth-messages'

describe('authErrorMessage', () => {
  it('explains wrong credentials in German', () => {
    expect(authErrorMessage('invalid_credentials')).toBe('E-Mail-Adresse oder Passwort ist falsch.')
  })

  it('asks the user to confirm their e-mail address', () => {
    expect(authErrorMessage('email_not_confirmed')).toMatch(/bestätigen/)
  })

  it('tells the user they are already registered', () => {
    expect(authErrorMessage('user_already_exists')).toMatch(/bereits/)
  })

  it('explains an invalid or expired confirmation link', () => {
    expect(authErrorMessage('confirmation_link_invalid')).toMatch(/Bestätigungslink/)
  })

  it('falls back to a generic German message for anything else', () => {
    expect(authErrorMessage('something_new')).toBe(
      'Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.',
    )
    expect(authErrorMessage(undefined)).toBe(
      'Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.',
    )
  })
})
