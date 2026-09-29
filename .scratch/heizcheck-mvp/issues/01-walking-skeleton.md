# 01: Walking skeleton: sign-in, Organisation, German shell

**What to build:** A Property Manager can sign in and land on an empty buildings list for their Organisation. The interface is in German and shows the HeizCheck disclaimer. This proves the whole stack end to end: Next.js on Vercel (EU region), Supabase in Frankfurt for auth and Postgres, row-level security per Organisation, and a CI pipeline that runs the test suite. See the spec (`.scratch/heizcheck-mvp/spec.md`): module 8 and the Stack section. Also see ADR 0003.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A user can sign in and sign out with Supabase auth.
- [ ] Every user belongs to exactly one Organisation, and all users in an Organisation have equal rights (no roles).
- [ ] Every table owned by an Organisation has row-level security, and a test proves a user can't read another Organisation's rows.
- [ ] After sign-in, the user sees an empty buildings list in German.
- [ ] The disclaimer is visible in the app shell, in German. It says HeizCheck provides evidence-backed checking, not a guarantee of legal correctness.
- [ ] The app deploys to Vercel in an EU region and connects to Supabase in Frankfurt.
- [ ] CI runs the test runner on every push, with at least one passing test.
