# 20: "Erklären" chat for a Check Report finding

**What to build:** On the Check Report, each rule with a Finding gets an "Erklären" button. It opens a small panel where the Property Manager asks one question about that rule ("Was bedeutet dieser Befund und was soll ich tun?"). HeizCheck finds the matching sections in a German markdown knowledge base with naive keyword search, sends them and the question to Claude Haiku 5.5 and shows the answer with its sources. This is the bootcamp "AI Chatbot Integration" exercise, built as a real feature. Like the help chat (ADR 0004) it is dev/demo only (ADR 0005).

**Blocked by:** none. Uses the existing `ANTHROPIC_API_KEY`.

**Status:** ready-for-human

**Decisions (grilling session 2026-10-15)**

- One question: "What does this finding mean, and what do I do now?" No general legal advice, no product FAQ.
- Separate from the n8n help chat: that one routes support tickets, this one answers.
- German answers, German knowledge base.
- Single question, no history: `{ ruleId?, question }` → one answer.
- Only the rule ID and the question are sent. No Finding message, amounts, Units or other package data.
- Retrieval is naive: an exact rule-ID match plus keyword overlap with a small synonym map, top 3 sections. No vectors, no database. `feature/own-rag` (Pinecone) is the comparison in the reflection.

**Switch**

- [x] On only when `EXPLAIN_CHAT_ENABLED=true` and never when `VERCEL_ENV=production` (ADR 0005). Otherwise the button does not render and `/api/erklaerung` answers 404. The flag is added to `.env.example`.

**Knowledge base** (`knowledge/`, German)

- [x] One file per topic, one `##` section per rule or concept, with the rule ID in the heading. Each rule section says what is checked, the legal basis and what to do.
- [x] Covers all 11 rules plus how to read the Check Report (statuses, severities, next steps, what HeizCheck does not do).

**Retrieval**

- [x] Sections are split at `##`. A given `ruleId`, or a rule ID written in the question, picks its section first.
- [x] Other sections are scored by the number of distinct question words found in them (lowercased, umlauts folded, German stop words removed, synonyms mapped, a word also matches inside a compound).
- [x] Top 3 sections. Without a rule ID, a best score below 1 means "no context".

**Guardrails**

- [x] No context → the fixed fallback answer, and Claude is not called.
- [x] The prompt restricts the domain, forbids individual legal advice and statements about Tenants, and puts the question inside `<frage>` tags.
- [x] Every `§` in the answer must appear in the retrieved sections, or the answer is replaced by the fallback.
- [x] Claude's reply is checked with zod. A timeout (15 s), API error or bad reply → HTTP 502 with a German message.
- [x] The body is checked with zod: `question` 1–500 characters after trimming, `ruleId` one of the 11 rule IDs or absent. Invalid → HTTP 400, Claude is not called.

**Route `POST /api/erklaerung`**

- [x] 404 while off, 401 without a session, 400 on bad input, 200 with `{ outcome, answer, sources: [{ file, heading }] }`.

**UI**

- [x] An "Erklären" button on each rule with a Finding. The panel has a pre-filled question, the hint "Bitte keine Mieterdaten eingeben.", the answer and its sources.

**Tests** (Vitest, Node only)

- [x] Knowledge parsing, retrieval (rule-ID shortcut, synonyms, compounds, threshold at 0, 1 and 2 matches, top 3), the `§` check, the fallback without a model call, timeout, bad reply, the route's 404/401/400/200, the switch.
- [x] Every rule ID has exactly one section in the real knowledge base.

**Eval and docs**

- [x] `npm run eval:explain` runs the golden set live and saves the results under `eval/results/`.
- [x] `docs/chatbot.md` holds the assignment write-up. ADR 0005 is written.

## Comments

**2026-10-15 (agent):** Built test-first in `src/lib/explain-chat/` (knowledge, retrieve, explain, golden) plus `POST /api/erklaerung` and the "Erklären" panel. The knowledge base is 6 files and 19 sections. The layout changed from the grilling plan once the code showed C1–C3 are consistency checks and K1/K2 are the CO₂ rules. Live eval: 10/12 on the first run. Haiku 5.5 thinks by default, and 400 `max_tokens` left no room for the answer. After that fix it scored 12/12, and 12/12 again after asking for plain text. `npm test` 465 passed, `npm run typecheck` clean. Still open for a human: review `knowledge/` for legal accuracy (especially how K1 applies §9 CO2KostAufG, which describes what the code does), run `tree knowledge` and take the chat screenshot for `docs/chatbot.md`. The panel has no UI tests (no jsdom), the same as ticket 19.
