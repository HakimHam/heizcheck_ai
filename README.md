# HeizCheck

A quality gate for German property managers that checks heating cost statements before they go to Tenants. Domain language is in `CONTEXT.md`; decisions are in `docs/adr/`.

## Stack

Next.js on Vercel (`fra1`), Supabase in Frankfurt (`eu-central-1`) for auth and Postgres. See ADR 0003.

## Development

```sh
npm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm run dev
```

- `npm test` runs the test suite. The database tests apply `supabase/migrations/` to an in-process Postgres (PGlite) with a stub of Supabase's `auth` schema, so they need neither Docker nor a Supabase project.
- `npm run typecheck` runs TypeScript.

## Supabase setup

1. Apply the files in `supabase/migrations/` in order.
2. Under Authentication → URL Configuration, set the Site URL to the deployed app and add `<app-url>/auth/callback` to the redirect URLs.

## Deployment

Vercel deploys from Git; `vercel.json` pins functions to `fra1` (Frankfurt). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Vercel project.
