const AUTH_PAGES = ['/anmelden', '/registrieren']
// /api/health is for monitoring, which has no session. /api/retention is for
// Vercel Cron, which has none either; the route itself checks the cron secret.
const PUBLIC_PREFIXES = [...AUTH_PAGES, '/auth', '/api/health', '/api/retention']

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/** Where to send a visitor instead of `pathname`, or null to let them through. */
export function redirectFor(pathname: string, signedIn: boolean): string | null {
  if (signedIn) {
    return AUTH_PAGES.some((page) => matches(pathname, page)) ? '/' : null
  }
  return PUBLIC_PREFIXES.some((prefix) => matches(pathname, prefix)) ? null : '/anmelden'
}
