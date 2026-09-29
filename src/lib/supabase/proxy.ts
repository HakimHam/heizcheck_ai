import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

/** Pages only for visitors who aren't signed in; signed-in users go to the buildings list. */
const signedOutPages = ["/anmelden", "/registrieren"];
const publicPaths = [...signedOutPages, "/auth"];

/** Refreshes the Supabase session cookie and routes visitors by whether they're signed in. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Validates the JWT; don't run code between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;
  const isOn = (paths: string[]) => paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!signedIn && !isOn(publicPaths)) return redirectTo(request, "/anmelden");
  if (signedIn && isOn(signedOutPages)) return redirectTo(request, "/");
  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  return NextResponse.redirect(target);
}
