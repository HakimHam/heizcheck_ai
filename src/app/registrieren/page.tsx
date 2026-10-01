import { AuthForm } from '@/components/auth-form'
import { signUp } from '../auth/actions'

export const metadata = { title: 'Registrieren – HeizCheck' }

export default function SignUpPage() {
  return (
    <main>
      <AuthForm
        mode="signUp"
        title="Ihre Hausverwaltung bei HeizCheck registrieren"
        action={signUp}
        switchLink={{ href: '/anmelden', label: 'Bereits registriert? Anmelden' }}
      />
    </main>
  )
}
