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

### Extraction

`EXTRACTOR` in `.env.local` chooses how uploaded PDFs are read:

- `fake` (the default): a fixed demo package, no network. Tests always use it.
- `anthropic`: Claude Sonnet 5 over the Anthropic API. Needs `ANTHROPIC_API_KEY`. For development and the eval only, with synthetic or anonymised PDFs: the Anthropic API doesn't keep data in the EU, so never upload real Tenant data with it. The upload and Confirm screens show a warning while it is on, and the app refuses it when `VERCEL_ENV=production`.
- `bedrock`: Amazon Bedrock in `eu-west-1`, the production route (ADR 0003). Not implemented yet (ticket 17).

**Never set `ANTHROPIC_API_KEY` or `EXTRACTOR=anthropic` in the Vercel production environment.**

### Extraction eval

The eval measures how accurately Claude reads packages. It runs on demand, not in CI, and costs API credits.

```sh
npm run make-fixture        # renders eval/synthetic/*.json into eval/fixtures/ (needs Chrome or Edge; else set CHROME_PATH)
npm run eval                # every package in eval/fixtures/; EXTRACTOR=anthropic unless set, never fake
npm run eval -- 01-basis-6-we
```

Each package is `eval/fixtures/<name>/` with its PDFs and `expected.json`. Fixtures and results (`eval/results/`) are gitignored. Synthetic results test the pipeline only; the 95 % MVP target needs real, properly redacted packages through Bedrock. Redact for real: black boxes drawn in a PDF editor leave the text layer, which is what gets sent. Check with `node scripts/check-text-layer.mjs <pdf>`.

## Supabase setup

1. Apply the files in `supabase/migrations/` in order.
2. Under Authentication → URL Configuration, set the Site URL to the deployed app and add `<app-url>/auth/callback` to the redirect URLs.

## Deployment

Vercel deploys from Git: `main` to production, every other branch and pull request to a preview. `vercel.json` pins functions to `fra1` (Frankfurt). The pipeline, the URLs, the health check and the release steps are in `docs/deployment.md`.
