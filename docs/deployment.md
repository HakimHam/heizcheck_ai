# Deployment

HeizCheck runs on Vercel in Frankfurt (`fra1`) against a Supabase project in Frankfurt (`eu-central-1`), so Tenant personal data stays in the EU (ADR 0003). `vercel.json` pins the Vercel Functions region, so there's nothing to choose in the dashboard.

## First deploy

1. **Supabase:** create a project with region **Central EU (Frankfurt)**.
   - Apply the migrations in `supabase/migrations/` in filename order, using the SQL editor or `supabase db push`.
   - Under Authentication → URL Configuration, set the Site URL to the Vercel production URL and add `https://<vercel-domain>/auth/callback` to the redirect URLs.
2. **Vercel:** import the repository as a Next.js project and set these environment variables from Supabase → Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. **Check:** deploy, register a Hausverwaltung at `/registrieren`, confirm the e-mail and sign in. You should land on the empty "Gebäude" list with the disclaimer in the footer.

## Local development

Copy `.env.example` to `.env.local` and fill it in with the project's values, then run `npm run dev`.

## Tests

`npm test` needs no Supabase project. The database tests apply the migrations to an in-process Postgres (PGlite), on top of `supabase/tests/supabase-shim.sql`, which reproduces the parts of Supabase's platform schema the migrations rely on. They then check row-level security as signed-in users.
