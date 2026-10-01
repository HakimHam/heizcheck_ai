import { AuthForm } from '@/components/auth-form'
import { authErrorMessage } from '@/lib/auth-messages'
import { signIn } from '../auth/actions'

export const metadata = { title: 'Anmelden – HeizCheck' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>
}) {
  const { fehler } = await searchParams
  return (
    <main>
      <AuthForm
        mode="signIn"
        title="Bei HeizCheck anmelden"
        action={signIn}
        switchLink={{ href: '/registrieren', label: 'Noch nicht registriert? Hausverwaltung registrieren' }}
        initialError={fehler ? authErrorMessage(fehler) : undefined}
      />
    </main>
  )
}
