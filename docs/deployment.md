# Deployment

HeizCheck runs on Vercel in Frankfurt (`fra1`, set in `vercel.json`) against a Supabase project in Frankfurt (`eu-central-1`). See ADR 0003.

## Supabase (once per environment)

1. Create a project with region **Central EU (Frankfurt)**. The region can't be changed later.
2. Apply the migrations in `supabase/migrations/` in filename order. Either run them in the SQL editor, or use the Supabase CLI: `supabase link --project-ref <ref>`, then `supabase db push`.
3. Under **Authentication → URL Configuration**:
   - Set **Site URL** to the production URL, for example `https://heizcheck.vercel.app`.
   - Add `https://<domain>/auth/callback` to **Redirect URLs**, plus `http://localhost:3000/auth/callback` for local development.
4. Leave e-mail confirmation on. The confirmation link lands on `/auth/callback`, which signs the user in.

## Vercel

1. Import the GitHub repository. The framework preset is Next.js.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview. Get both from Supabase under **Project Settings → API Keys**.
3. After the first deploy, check **Settings → Functions → Function Region**. It should show Frankfurt (`fra1`).

## Local development

Copy `.env.example` to `.env.local`, fill in the values, then run `npm run dev`.

## Tests

`npm test` needs no Supabase project or Docker. The row-level security tests in `supabase/tests/` apply the migrations to an in-process Postgres (PGlite). They use a small shim of Supabase's `auth` schema, `auth.uid()` and roles (`supabase/tests/supabase-shim.sql`), then query as signed-in users. Every new table that an Organisation owns needs its own policies. `row-level-security.test.ts` fails if any table in `public` has RLS disabled.
