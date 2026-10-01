import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from './auth/actions'

export const metadata = { title: 'Gebäude – HeizCheck' }

export default async function BuildingsPage() {
  const supabase = await createClient()
  const [{ data: claims }, { data: organisation }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from('organisations').select('name').maybeSingle(),
  ])

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="brand">HeizCheck</Link>
          <div className="session">
            <span>
              {organisation?.name}
              {claims?.claims.email ? ` · ${claims.claims.email}` : ''}
            </span>
            <form action={signOut}>
              <button type="submit" className="secondary">Abmelden</button>
            </form>
          </div>
        </div>
      </header>
      <main>
        <h1>Gebäude</h1>
        <div className="empty">
          <p>Sie haben noch keine Gebäude angelegt.</p>
        </div>
      </main>
    </>
  )
}
