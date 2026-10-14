# Spec: HeizCheck own RAG

Status: done (built and evaluated 2026-10-14; golden set 10/10)

Bootcamp exercise "Build your own RAG" (LLM, MCP, LangChain & Vector integration):
index two of our own PDFs, retrieve from our own vector store, and prove it works —
including questions it must refuse. Decisions below come from a grilling session on 2026-10-14.

Branch: `feature/own-rag`, cut from `feature/ticket-claude_code_impl` (`main` holds docs only).

## 1. Source documents

Written in German Markdown under `docs/rag-source/`, exported to PDF (3–6 pages each).
**Rule:** only facts already present in the repo docs (`CONTEXT.md`, `docs/mvp-scope.md`,
`docs/adr/`, `.scratch/heizcheck-mvp/spec.md`). If the docs don't say it, the PDF doesn't say it.

**`heizcheck-handbuch.pdf`** — user manual
- Was ist HeizCheck?
- Gebäude anlegen
- Abrechnungspaket hochladen (Gesamtabrechnung + Einzelabrechnungen)
- Den Prüfbericht lesen (Befund, Schweregrad, Regelcodes wie B1)
- Die Prüfregeln im Überblick (one H2 per rule: what it checks + legal basis)
- Neue Version einer Abrechnung (supersession)

**`heizcheck-faq-richtlinien.pdf`** — FAQ & policies
- Datenspeicherung und Löschfristen (4-year deletion)
- Datenschutz und KI-Verarbeitung (which data goes to Claude, EU route)
- Wer sieht welche Daten? (Organisation, access)
- Was HeizCheck nicht tut (rental management only, no legal advice, no correcting statements)

No help-chat section: its docs (ADR 0004, `docs/n8n-help-chat.md`) are not on this branch.

Export: `md-to-pdf` (headless Chrome) via a repeatable `tsx` script. Real H1/H2 headings.

Built (2026-10-14): the Handbuch came out at 5 pages; the FAQ at 2, under the 3–6 target, because
padding it would mean inventing facts. Golden #8 was changed from "…und wer kann ihn sehen?" to
"…und was steht darin?": both original facts sit in the FAQ, so it didn't test two PDFs.

## 2. Parsing & chunking

- **Parsing:** `pdfjs-dist` (already a dependency). Headings detected by **font size** —
  H1/H2 text items are larger than body text. Pure function: text items in → heading tree out.
- **Split rule:** one chunk per H2 section. Sections over **1,000 chars** split on paragraph
  boundaries with **~150 chars overlap**.
- **Embedded text:** `"<H1> > <H2>\n\n<body>"` (heading prefix helps short sections match).
- **Metadata per chunk:**
  - `source_file` — `heizcheck-handbuch.pdf`
  - `heading` — `"Prüfbericht > Befundcodes"`
  - `chunk_id` — `heizcheck-handbuch#07` (also the Pinecone vector id → re-seed overwrites, never duplicates)
  - `chunk_index` — `7`
  - `page` — `3`
  - `chunk_text`

## 3. Vector store

- Pinecone, own serverless index **`heizcheck-rag`** (1536 dims, cosine, aws us-east-1), created by the
  first seed. Changed 2026-10-14: the Pinecone account had no `handbook` index; the user chose an own index.
- Own namespace **`heizcheck-own-rag`** (never `workshop-shared`).
- Full re-seed clears the namespace first.
- Embeddings: OpenAI `text-embedding-3-small` (Anthropic has no embedding model).

## 4. Retrieval chain

Forked from `../dl-school-agentic/example/rag/deterministic-chain.ts` into `scripts/rag/`.

1. User question
2. Embed query (OpenAI)
3. Search own namespace, top 3 chunks + metadata
4. **Score threshold** *t* (start ≈ 0.30 cosine, tuned on the golden set): top score below *t* →
   refuse without calling the LLM
5. Assemble prompt with numbered context blocks carrying `chunk_id`, `source_file`, `heading`, `page`
6. `ChatAnthropic` (`@langchain/anthropic`), model `claude-haiku-5-5`, no temperature (the API rejects it for this model) — the job is
   answering from 3 short retrieved chunks, not reading full statements like the extractor
   (`claude-sonnet-5`), so the smaller, faster, cheaper model is enough. If the golden set shows
   Haiku failing on a question the chunks do answer, switch to Sonnet and re-run.
7. Structured output, validated with zod `safeParse`:
   `{ answerable: boolean, answer: string, citations: chunk_id[] }`.
   Any citation not among the retrieved chunks → rejected (no invented sources).
8. Return answer + sources. Fixed refusal text:
   „Dazu enthalten die HeizCheck-Dokumente keine Information.“

## 5. Config

New dependencies: `@langchain/core`, `@langchain/anthropic`, `@pinecone-database/pinecone`, `openai`, `md-to-pdf` (dev).

Real values go in **`.env.local`** (git-ignored via `.env*.local`). Names only (no values) in `.env.example`:
`OPENAI_API_KEY`, `PINECONE_API_KEY`, `RAG_PINECONE_INDEX`, `RAG_PINECONE_NAMESPACE`.
`ANTHROPIC_API_KEY` already exists.

## 6. Tests (written first, must fail before implementation)

Vitest, mocked store + LLM, next to the code as `<name>.test.ts`:
- Heading detector: font-size items → correct H1/H2 tree
- Chunker: section of exactly 1,000 chars → 1 chunk; 1,001 → split with overlap
- Metadata: `chunk_id` format, `chunk_index`, `page`, `source_file`
- Threshold: score at *t* answers, just below refuses, just above answers
- Citation validation: unknown `chunk_id` rejected; malformed LLM output rejected via zod
- Prompt assembly contains every retrieved `chunk_id`

## 7. Golden set (`scripts/rag/golden-set.json`)

Each entry: question, type, expected `source_file` + `heading` (or `refuse`).

| # | Type | Question | Expected |
|---|---|---|---|
| 1 | real | Wann werden hochgeladene Abrechnungen gelöscht? | FAQ › Datenspeicherung und Löschfristen |
| 2 | real | Was prüft die Regel B1? | Handbuch › Prüfregeln |
| 3 | real | Welche Dateien gehören in ein Abrechnungspaket? | Handbuch › Abrechnungspaket hochladen |
| 4 | real | Was passiert, wenn ich eine neue Version hochlade? | Handbuch › Neue Version einer Abrechnung |
| 5 | real | Werden meine Daten an eine KI geschickt? | FAQ › Datenschutz und KI-Verarbeitung |
| 6 | unanswerable | Wie heißt der Geschäftsführer von HeizCheck? | refuse |
| 7 | unanswerable (near-domain) | Was kostet HeizCheck pro Wohnung im Monat? | refuse |
| 8 | tricky (both PDFs) | Wie lange bleibt ein Prüfbericht gespeichert und was steht darin? | FAQ › Löschfristen + Handbuch › Den Prüfbericht lesen |
| 9 | tricky (out of scope, documented) | Kann HeizCheck Abrechnungen für Eigentümergemeinschaften (WEG) prüfen? | answers "no", cites FAQ › Was HeizCheck nicht tut |
| 10 | cross-language | How long is my data stored? | FAQ › Datenspeicherung und Löschfristen |

After the PDFs are written, every expected answer is checked against the final text; questions
whose answer is missing (or, for #6/#7, accidentally present) are replaced. The user reviews the
final list before the first `rag:eval` run.

`npm run rag:eval` runs all 10 against the live index and prints:
question · expected source/heading · retrieved · cited · refused? · PASS/FAIL.
Answer wording is spot-checked by hand.

### Results and deviations (2026-10-14)

- **Threshold stays at 0.30, and it can't separate on-topic unanswerables.** Measured top scores:
  real questions 0.607–0.759, unanswerable #6/#7 0.623/0.684, English #10 0.444, off-topic
  "Wetter in Berlin" 0.276. Every chunk is about HeizCheck, so "CEO of HeizCheck" scores like a real
  question; those are refused by the model (`not_in_documents`). The threshold only stops off-topic
  questions without a model call. Raising it above 0.444 would start refusing #10.
- **Golden wording:** #2 expects `Handbuch › Prüfregel B1: Abrechnungsfrist nach §556 BGB` (one H2 per
  rule, per section 1, not a "Prüfregeln" section). #4 reads "…eine neue Version einer Abrechnung
  hochlade?" so the question names what is uploaded.
- **Chunk size:** the 1,000-char limit applies to each piece *before* the overlap; a later chunk can
  reach ~1,150 chars. Kept: the overlap is meant to come on top.
- **Extra Handbuch section** "Ausgelesene Zahlen bestätigen" (MVP spec stories 24–41) and an extra
  `npm run rag:ask` CLI for single questions.

## 8. Done when

- `npm test` and `npm run typecheck` pass — output reported verbatim
- `rag:eval` run against the real namespace, results reported honestly (failures included)
- Every export has JSDoc; all LLM output validated with zod
