# 01: Walking skeleton: sign-in, Organisation, German shell

**What to build:** A Property Manager can sign in and land on an empty buildings list for their Organisation. The interface is in German and shows the HeizCheck disclaimer. This proves the whole stack end to end: Next.js on Vercel (EU region), Supabase in Frankfurt for auth and Postgres, row-level security per Organisation, and a CI pipeline that runs the test suite. See the spec (`.scratch/heizcheck-mvp/spec.md`): module 8 and the Stack section. Also see ADR 0003.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human (only the first deploy is left; see Comments)

- [x] A user can sign in and sign out with Supabase auth.
- [x] Every user belongs to exactly one Organisation, and all users in an Organisation have equal rights (no roles).
- [x] Every table owned by an Organisation has row-level security, and a test proves a user can't read another Organisation's rows.
- [x] After sign-in, the user sees an empty buildings list in German.
- [x] The disclaimer is visible in the app shell, in German. It says HeizCheck provides evidence-backed checking, not a guarantee of legal correctness.
- [ ] The app deploys to Vercel in an EU region and connects to Supabase in Frankfurt.
- [x] CI runs the test runner on every push, with at least one passing test.

## Comments

**2026-09-29 (agent):** Implemented everything except the first deploy, which needs Vercel and Supabase accounts. Follow `docs/deployment.md`: create the Supabase project in Frankfurt, apply `supabase/migrations/`, set the auth redirect URLs, then import the repo in Vercel with the two env vars (`vercel.json` pins `fra1`).

- **RLS test:** runs the migrations in PGlite, an in-process Postgres, against a shim of Supabase's `auth` schema, roles and default grants. It needs no Docker. `row-level-security.test.ts` fails if any `public` table has RLS off.
- **Organisation provisioning:** self-service sign-up at `/registrieren` creates a new Organisation from the entered name, via a trigger on `auth.users`. A colleague who signs up this way gets their own Organisation. Joining an existing one comes with invitations (ticket 15), which must extend `private.handle_new_user()`.
- **Buildings:** the `buildings` table is minimal (address only). It already has insert, update and delete policies, so ticket 02 only adds the Building Profile columns and the UI.
