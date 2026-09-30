import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

// Pages for signed-out visitors; a signed-in user is sent on to the buildings list.
const AUTH_PAGES = ["/anmelden", "/registrieren"];
const isUnder = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

/** Refreshes the auth session on every request and sends signed-out visitors to sign-in. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims validates the token and refreshes it when needed; don't run code between here and createServerClient.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const onAuthPage = AUTH_PAGES.some((path) => isUnder(pathname, path));
  const isPublic = onAuthPage || isUnder(pathname, "/auth");

  if (!signedIn && !isPublic) return redirectTo(request, "/anmelden");
  if (signedIn && onAuthPage) return redirectTo(request, "/");

  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}
