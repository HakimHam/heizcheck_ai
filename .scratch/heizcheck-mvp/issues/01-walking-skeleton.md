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

**2026-09-30 (agent):** Implemented on `feature/specs-implementation`.

- Signing up at `/registrieren` asks for the Hausverwaltung's name. The `on_auth_user_created` trigger creates the Organisation and the membership in the same transaction. `organisation_members.user_id` is the primary key, so each user has exactly one Organisation. Invitations (#15) will need to add members to an existing Organisation instead.
- Row-level security is enabled on `organisations`, `organisation_members` and `buildings`. `buildings` is a minimal table (address only) that #02 extends with the Building Profile.
- Tests in `supabase/tests/` run the real migrations on PGlite, with a shim of Supabase's auth schema and default grants. They cover isolation between Organisations, equal rights within one, visitors who aren't signed in, and a guard that every `public` table has row-level security.
- Still open: the actual Vercel and Supabase deploy. `vercel.json` pins `fra1`, and `docs/deployment.md` lists the steps (Supabase region Frankfurt, redirect URL, env vars). That needs the maintainer's accounts.

