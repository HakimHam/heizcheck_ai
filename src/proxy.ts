import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { redirectFor } from '@/lib/access'
import { supabaseEnv } from '@/lib/supabase/env'

// Refreshes the Supabase session cookie and sends visitors to the right page.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { url, key } = supabaseEnv()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value)
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const target = redirectFor(request.nextUrl.pathname, Boolean(data?.claims))
  if (!target) return response

  const redirect = NextResponse.redirect(new URL(target, request.url))
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
