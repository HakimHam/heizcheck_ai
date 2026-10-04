# 14: Corrected packages and history

**What to build:** When the Metering Provider sends a corrected Statement Package, the Property Manager uploads it for the same building and Billing Period. It supersedes the previous package, and both packages and both Check Reports are kept. See the spec: the Supersession section.

**Blocked by:** 03 (Tracer bullet).

**Status:** ready-for-agent

- [ ] When a building and Billing Period already have a package, uploading another one marks the older package as superseded by the new one.
- [ ] Nothing is deleted. The Superseded Package and its Check Report stay viewable.
- [ ] Views show the current package by default and link to its history.
- [ ] The history lists all packages and Check Reports for the building and Billing Period in order.
- [ ] The status in the buildings list reflects the current package only.
- [ ] `src/lib/check-report-pdf.tsx` starts with `import 'server-only'`, like the other modules that read from the server (it reads the fonts from disk). Make vitest accept the guard (e.g. alias `server-only` to an empty module in `vitest.config.ts`) so `check-report-pdf.test.ts` still runs. Carried over from the #13 review.
