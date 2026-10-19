# 19: Help chat classified by an n8n workflow

**What to build:** A signed-in Property Manager can send a help message from any page. HeizCheck forwards it to an n8n workflow (Webhook → AI classification → Switch → Action). The workflow sorts the message into one category, saves it and alerts us by email when it is urgent. The user sees which category their message was filed under. This is the bootcamp "AI-native workflow classifier" exercise, built as a real feature. Per ADR 0004 it is dev/demo only: it stays off in production.

**Blocked by:** none. Needs the n8n Cloud account (`ai-software-egnineering.app.n8n.cloud`), a Gmail credential in n8n and the existing Anthropic API key as an n8n credential.

**Status:** ready-for-agent

**Switch**

- [x] The chat icon renders only when `N8N_HELP_WEBHOOK_URL` is set. It is unset on Vercel production, so the icon does not show there (ADR 0004). `N8N_HELP_WEBHOOK_URL` and `N8N_HELP_WEBHOOK_SECRET` are added to `.env.example`.

**Widget**

- [x] A round "?" button sits fixed bottom-right, in the signed-in layout `src/app/(app)/layout.tsx` only. It does not show on `/anmelden` or `/registrieren`.
- [x] Clicking it opens a panel with a textarea, the hint "Bitte keine Mieterdaten eingeben." and a "Senden" button. The styling is plain CSS in `globals.css`, using the existing variables.
- [x] The widget POSTs `{ "message": "…", "pagePath": "/pakete/…" }` to `/api/hilfe`.

**Route `POST /api/hilfe`**

- [x] It requires a session. `src/proxy.ts` already gates new routes, and the handler also checks for itself.
- [x] The body is checked with zod `safeParse`:
  - `message` is 1–2000 characters after trimming.
  - `pagePath` starts with `/` and is at most 200 characters.
  - Invalid input gets HTTP 400 with a German message and is never sent to n8n.
- [x] It forwards this body to `N8N_HELP_WEBHOOK_URL` with header `X-HeizCheck-Secret: <N8N_HELP_WEBHOOK_SECRET>` and a 10 s timeout:
  ```json
  {
    "requestId": "uuid",
    "message": "Warum ist K1 rot?",
    "pagePath": "/pakete/3f2a…",
    "user": { "id": "uuid", "email": "pm@hausverwaltung.de" },
    "organisationName": "Muster Hausverwaltung GmbH",
    "sentAt": "2026-10-13T09:12:00.000Z"
  }
  ```
  The user id and email come from the session claims. The Organisation name comes from the `organisations` table, read through RLS. No content from packages or Check Reports is sent.
- [x] n8n's reply `{ category, summary }` is untrusted model output and is checked with zod.
- [x] The widget shows one of three results:
  - **Valid reply:** "Danke! Ihre Anfrage wurde als „[German label]“ eingeordnet. Wir melden uns per E-Mail." The label comes from a map in the code, never from the raw enum.
  - **Invalid reply:** "Ihre Nachricht ist angekommen. Wir melden uns per E-Mail.", with no category.
  - **n8n down, non-2xx or over 10 s:** "Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen." The text stays in the input field.
- [x] Messages are not stored in Supabase. The n8n table is the record.

**Categories** (enum value → German label)

- `befund_frage` → "Frage zu einem Befund": a question about a Finding in a Check Report.
- `extraktion_fehler` → "Fehler beim Auslesen": an Extracted Figure is wrong.
- `technisches_problem` → "Technisches Problem": upload, page or PDF export fails.
- `konto_zugang` → "Konto & Zugang": invitations or login.
- `datenschutz` → "Datenschutz": a deletion request or the AV-Vertrag.
- `sonstiges` → "Sonstiges": anything else.

**n8n workflow** (`n8n/hilfe-klassifizierung.workflow.json`)

- [x] **Webhook** (POST) with Header Auth on `X-HeizCheck-Secret`, response mode "Respond to Webhook".
- [x] **AI step:** Anthropic Chat Model with Claude Haiku 5.5 (`claude-haiku-5-5`) and a Structured Output Parser. It returns `{ category (one of the six), confidence (0–1), summary (German, ≤ 140 chars) }`.
- [x] `confidence < 0.6` → the category becomes `sonstiges`. If the AI step fails, the workflow carries on and saves the message as `sonstiges` with no summary.
- [x] **Switch** on the category:
  - Every message goes into the n8n Data Table `hilfe_anfragen`. The row has requestId, sentAt, email, organisationName, pagePath, message, category, confidence and summary.
  - `datenschutz` and `technisches_problem` also send a Gmail alert with the subject `[DRINGEND] [label]: [summary]`.
- [x] **Respond to Webhook** returns `{ category, summary }`.
- [x] The committed JSON has no credentials and uses `support@example.com` as the alert recipient. The real address is set in n8n after import.

**Tests** (Vitest, Node only; there is no jsdom, so the widget UI has no tests)

- [x] The request schema at its boundaries: `message` at 0, 1, 2000 and 2001 characters after trimming, plus whitespace only. `pagePath` without a leading `/`, and at 200 and 201 characters.
- [x] The payload builder: server-side fields are added, and a client-sent `user` or `organisationName` is ignored.
- [x] The reply parser: valid reply, unknown category, missing fields and non-JSON.
- [x] The route: 401 without a session, 400 on bad input with no call to n8n, 404 while the chat is off, and one success with `fetch` mocked. The invalid-reply, non-2xx and timeout paths are tested at `forwardHelpMessage`, which the route only wires up (seams agreed 2026-10-13).
- [x] The workflow file matches the code: same categories, same summary limit, and the 0.6 cut-off at 0.59, 0.6 and 0.61.
- [x] The switch: the icon shows only when `N8N_HELP_WEBHOOK_URL` is set.

**Docs**

- [x] `docs/n8n-help-chat.md` covers:
  - setup: credentials, the Data Table, the webhook URL and secret in `.env.local`
  - how to import the workflow
  - the import errors met and their fixes
  - a screenshot of the workflow in n8n
- [x] ADR 0004 is written.

**Data**

- [x] Test only with made-up messages, never real Tenant data (ADR 0004).

## Comments

**2026-10-13 (agent):** Built with TDD at three seams: `forwardHelpMessage`, `POST /api/hilfe`, `helpChatEnabled`. `src/lib/help-chat-workflow.test.ts` checks the committed n8n workflow against the code. Still open for a human: import into n8n, then note the import errors and fixes and add the screenshot in `docs/n8n-help-chat.md`. The widget has no tests (the project has no jsdom). Its `maxLength` counts untrimmed text; the server trims.

**2026-10-18 (human + agent):** Imported into n8n Cloud and tested end to end with made-up messages. The import errors (missing secret → 403, test URL instead of production URL) and the screenshot are in `docs/n8n-help-chat.md`.
