import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// The link in the confirmation e-mail lands here, either with a PKCE `code`
// (same browser) or with a `token_hash` (works from any device).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null

  const supabase = await createClient()
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: true }

  const target = error ? '/anmelden?fehler=confirmation_link_invalid' : '/'
  return NextResponse.redirect(new URL(target, request.url))
}
