# Deployment

HeizCheck is one Next.js app: the pages (frontend) and Server Actions and route handlers (backend) deploy together to Vercel in `fra1` (Frankfurt), with Supabase in `eu-central-1` (ADR 0003).

| Environment | URL | Built from | Extractor |
|---|---|---|---|
| Production | https://heizcheck-khaki.vercel.app | `main` | `fake` (demo figures) until Bedrock, ticket 17 |
| Preview | `https://heizcheck-<hash>-hakimhams-projects.vercel.app`, one per push; Vercel posts it on the pull request | any other branch, every pull request | `anthropic`, synthetic or anonymised PDFs only |
| Local | http://localhost:3000 | your working tree | from `.env.local` |

Health check: `GET /api/health` on any of them. It returns `200` and `"ok": true` when the configuration is valid and Supabase answers, otherwise `503`. It also reports the environment, the deployed commit and the Extractor, never a secret.

## The pipeline

```
push branch ──► pull request ──► CI: typecheck, tests, build ──┐
                     │                                         ├─► review ─► merge to main
                     └─► Vercel preview ─► Deployment check ───┘                  │
                                                                                  ▼
                     Uptime, every 30 min ◄── Deployment check ◄── Vercel production
```

1. **CI** (`.github/workflows/ci.yml`) runs on every pull request and every push to `main`: `npm ci`, `npm run typecheck` (including Next.js route types), `npm test` (unit and database tests against an in-process Postgres) and `npm run build`.
2. **Vercel** builds and deploys every push by itself, through its GitHub integration: a preview for branches and pull requests, production for `main`.
3. **Deployment check** (`.github/workflows/deployment-check.yml`) runs when Vercel reports a deployment as ready. It calls `/api/health` on the new URL and checks that it is healthy and runs the commit just deployed.
4. **Uptime** (`.github/workflows/uptime.yml`) calls production's `/api/health` every 30 minutes. A failed run is a red run in the Actions tab and an email from GitHub.

**What triggers it?** Every pull request, and every push to `main`, runs CI. Every Vercel deployment, preview or production, triggers the deployment check. A schedule runs the uptime check every 30 minutes.

**What fails it?** A TypeScript error, a failing test, or a build error fails CI, and the pull request shows a red check, so it isn't merged. A deployment that doesn't answer `/api/health` with `200` and `"ok": true` for its own commit fails the deployment check: for example a missing environment variable, Supabase unreachable, or `EXTRACTOR=anthropic` in production. Production unhealthy for a scheduled check fails the uptime run. The repository is private on GitHub Free, so GitHub can't enforce "no merge while red" (branch protection needs GitHub Pro or a public repository). Until then the rule is a team rule: merge only with every check green.

## Releasing, step by step

1. Branch from `main`, commit, push. Open a pull request.
2. Wait for **CI** and the **Deployment check** on the preview to go green. Try the preview URL Vercel posts on the pull request.
3. Merge. Vercel deploys production. The deployment check runs against it.
4. Open https://heizcheck-khaki.vercel.app/api/health and check `commit` is the merge commit.

**Rolling back:** in Vercel, Deployments → the last good production deployment → Instant Rollback (or `npx vercel rollback`). Then revert the change on `main`.

**Database migrations** aren't applied by the pipeline: apply the new files in `supabase/migrations/` in order before merging code that needs them.

## One-time setup

- **Vercel environment variables**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview. `EXTRACTOR=anthropic` and `ANTHROPIC_API_KEY` for **Preview only**, never Production.
- **Preview health checks**: previews are behind Vercel's login. In Vercel, Settings → Deployment Protection → Protection Bypass for Automation, create a secret, then store it in GitHub: `gh secret set VERCEL_AUTOMATION_BYPASS_SECRET`.
- **Supabase auth**: under Authentication → URL Configuration, set the Site URL to the production URL and allow `https://heizcheck-khaki.vercel.app/auth/callback` and `https://*-hakimhams-projects.vercel.app/auth/callback`.
