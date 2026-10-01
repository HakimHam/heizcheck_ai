import Link from 'next/link'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '../auth/actions'

// The signed-in part of the app: everything behind the proxy's sign-in check.
export default async function AppLayout({ children }: { children: ReactNode }) {
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
      <main>{children}</main>
    </>
  )
}
