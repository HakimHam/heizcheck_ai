'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { AuthFormState } from '@/app/auth/actions'

type Props = {
  mode: 'signIn' | 'signUp'
  title: string
  action: (state: AuthFormState, form: FormData) => Promise<AuthFormState>
  switchLink: { href: string; label: string }
  initialError?: string
}

export function AuthForm({ mode, title, action, switchLink, initialError }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: initialError })
  const signingUp = mode === 'signUp'

  return (
    <div className="card">
      <h1>{title}</h1>
      <form action={formAction} className="stack">
        {signingUp && (
          <label>
            Name Ihrer Hausverwaltung
            <input name="organisation" required autoComplete="organization" />
          </label>
        )}
        <label>
          E-Mail-Adresse
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Passwort
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
          />
        </label>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        {state.notice && <p className="notice" role="status">{state.notice}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Bitte warten …' : signingUp ? 'Registrieren' : 'Anmelden'}
        </button>
      </form>
      <p className="muted">
        <Link href={switchLink.href}>{switchLink.label}</Link>
      </p>
    </div>
  )
}
