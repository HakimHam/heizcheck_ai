# HeizCheck

A quality gate for German property managers that checks heating cost statements from a Metering Provider before they go to Tenants. Domain language is in `CONTEXT.md`; key decisions are in `docs/adr/`.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Quality rules

These apply to every change in this repo.

1. **Every change ships with tests.** A feature or bug fix comes with Vitest tests in the same change, next to the code as `<name>.test.ts`. Test behaviour through the public interface. A bug fix includes a test that fails without the fix.
2. **Every export is documented.** Every exported function, component and type gets a JSDoc comment saying what it does, with a concrete example where it helps (`/** \`2026-10-02\` → \`02.10.2026\` */`). Use the domain terms from `CONTEXT.md`. Comments explain *why*, not what.
3. **All outside input is validated.** Route handler bodies and params, server action `FormData`, search params, uploaded files and model (LLM) output are untrusted. Validate them with a `zod` schema via `safeParse`, never with `as` casts. Invalid input gets a clear error (HTTP 400 for routes, a German message for forms) and never touches the database.
4. **Every threshold is tested at its boundary.** Each date, amount, percentage or CO2-tier threshold has tests at the value itself, just below it and just above it. Domain thresholds cite their legal basis (HeizkostenV, CO2KostAufG, BGB) in a comment.
5. **Report results honestly.** Run `npm test` and `npm run typecheck` before calling work done, and report what they printed, including failures and crashes you didn't cause. Never say "all tests pass" unless you saw it in this change's output.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
