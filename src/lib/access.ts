const AUTH_PAGES = ['/anmelden', '/registrieren']
const PUBLIC_PREFIXES = [...AUTH_PAGES, '/auth']

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/** Where to send a visitor instead of `pathname`, or null to let them through. */
export function redirectFor(pathname: string, signedIn: boolean): string | null {
  if (signedIn) {
    return AUTH_PAGES.some((page) => matches(pathname, page)) ? '/' : null
  }
  return PUBLIC_PREFIXES.some((prefix) => matches(pathname, prefix)) ? null : '/anmelden'
}
