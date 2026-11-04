# 01: Walking skeleton: sign-in, Organisation, German shell

**What to build:** A Property Manager can sign in and land on an empty buildings list for their Organisation. The interface is in German and shows the HeizCheck disclaimer. This proves the whole stack end to end: Next.js on Vercel (EU region), Supabase in Frankfurt for auth and Postgres, row-level security per Organisation, and a CI pipeline that runs the test suite. See the spec (`.scratch/heizcheck-mvp/spec.md`): module 8 and the Stack section. Also see ADR 0003.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] A user can sign in and sign out with Supabase auth.
- [x] Every user belongs to exactly one Organisation, and all users in an Organisation have equal rights (no roles).
- [x] Every table owned by an Organisation has row-level security, and a test proves a user can't read another Organisation's rows.
- [x] After sign-in, the user sees an empty buildings list in German.
- [x] The disclaimer is visible in the app shell, in German. It says HeizCheck provides evidence-backed checking, not a guarantee of legal correctness.
- [ ] The app deploys to Vercel in an EU region and connects to Supabase in Frankfurt.
- [x] CI runs the test runner on every push, with at least one passing test.

## Comments

**2026-10-01 (implementation, branch `feature/ticket-claude_code_impl`):**

- RLS is proven by `supabase/tests/organisation-access.test.ts`. The tests apply the migrations to PGlite (an in-process Postgres) with a stub of Supabase's `auth` schema, so they need neither Docker nor a Supabase project.
- People register themselves at `/registrieren`, and the sign-up trigger creates their Organisation, because invitations only arrive in ticket 15. Ticket 15 must change that trigger so that invitees join the inviting Organisation instead of getting a new one.
- **Open:** the Vercel deploy (`vercel.json` pins `fra1`) and applying the migration to the Supabase project in Frankfurt (`eu-central-1`). Both are waiting for the maintainer's approval.
