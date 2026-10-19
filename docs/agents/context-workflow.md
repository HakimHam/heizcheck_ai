# Context-optimized workflow: planted-error coverage (issue 16)

A worked example of how to keep the main agent's context small. A read-only sub-agent gathers the facts, and `/compact` runs once at a planned point. The task is real: it closes two open acceptance criteria in `.scratch/heizcheck-mvp/issues/16-mvp-acceptance.md`.

## 1. Task

**Goal.** Close issue 16's planted-error criteria. Every `RuleId` in the check engine gets exactly one planted-error fixture that triggers only that rule (plus whatever `alsoRaised` documents), and the clean package passes every rule. Missing fixtures are added test-first, then the checkboxes are ticked. If the scout finds no gaps, the task shrinks to verifying and ticking the boxes. That is still a valid, honest result.

**Why it costs a lot of context.** To know which rules are covered and how to trigger each one, you would have to read:

- 17 files in `src/lib/check-engine/rules/`, each with its own threshold and legal basis
- `index.ts`, `types.ts` and `fixtures.ts`
- `check-package.test.ts`, which is about 1000 lines
- `spec.md`, which is 312 lines
- the legal background: HeizkostenV, CO2KostAufG and §556 BGB

Only a small part of all that is needed to write a fixture: one field and one value per rule.

**What is unclear (before thinking about AI).**

- Is the issue-16 checkbox simply out of date? `planted-errors.test.ts` and `cleanPackage` already exist.
- Which `RuleId`s have no planted fixture?
- For each rule: what triggers it, and what is the smallest change to the clean package that triggers *only* that rule?
- Issue 16 says "11 rules". Does that still match `RULE_IDS`?

**What to understand first.** The `RULE_IDS` list, how `planted-errors.test.ts` iterates over `plantedErrors`, and what `alsoRaised` is for. It documents rules that are expected to fire together, such as H4 with H5.

**Relevant code.** `src/lib/check-engine/{types,index,fixtures}.ts`, `planted-errors.test.ts`, `check-package.test.ts`, `rules/*.ts`, and issue 16.

## 2. Context strategy

**What the agent helps the user do.** Add the missing planted-error fixtures, test-first, without the main session ever reading the rule files or the large test file.

**Operations that fill the context.**

- reading 17 rule files
- reading `check-package.test.ts` (about 1000 lines) and `spec.md` (312 lines)
- full `npm test` output, about 30 test files
- `agent-log.mjs` hook output
- exploring the repo itself. In the planning session, a repo-mapping sub-agent used about 39k tokens, and only about 1k came back.

**/compact decisions.**

| Decision | What |
|---|---|
| Summarize | The exploration phase, reduced to the task statement and the files to change. |
| Keep out of main context | Rule files, `check-package.test.ts`, `spec.md`, full `npm test` output (failures only), hook logs. |
| Keep minimal | The `fixtures.ts` excerpt being edited, the coverage table, quality rules 1, 4 and 5. |
| Save to disk instead of summarizing | The scout's table goes verbatim into `.scratch/heizcheck-mvp/planted-error-coverage.md`, so it survives compaction exactly. |

**When to compact.** Once, right after the table is saved and before implementing:

```
/compact Keep: task statement, path to planted-error-coverage.md and its Gaps list, files to change (fixtures.ts, issue 16), quality rules 1/4/5, the red→green procedure. Drop: repo exploration and planning Q&A.
```

## 3. Sub-agent

`.claude/agents/rule-coverage-scout.md`:

- **Role.** A context-control mechanism, not an implementation agent.
- **Tools.** `Read`, `Grep` and `Glob` only. No Bash, since Bash can write files, so the agent is read-only by construction.
- **Model.** `sonnet`. Haiku would be cheaper, but a misread trigger condition leads straight to a wrong fixture.
- **The one unclear part it owns.** For each `RuleId`: does a planted fixture exist, what triggers the rule (with legal basis), which fields it reads, and what minimal mutation of `cleanPackage` triggers only that rule.
- **Returns.** One table under 350 words with the columns `RuleId | rule file | planted fixture? | trigger + legal basis | fields read | minimal mutation | may also raise | boundary tests?`, followed by a **Gaps** list and an **Unsure** list. No code.

## 4. Flow

Branch: `feature/planted-error-coverage`, created from `feature/help-chat-n8n`. `main` only holds the spec. Run this in a fresh session so the baseline isn't inflated by earlier work.

1. **`/context`**: baseline. Record it below.
2. **Run `rule-coverage-scout`** as the first action.
3. **Main agent** saves the reply verbatim to `.scratch/heizcheck-mvp/planted-error-coverage.md`.
4. **`/context`**: after the scout.
5. **`/compact`** with the instruction above, then **`/context`** again.
6. **Spot-check only the Gaps list**: one grep comparing the `plantedErrors` keys against `RULE_IDS`. Don't re-read rule files. The tests in step 7 verify each mutation.
7. **For each gap, red then green:**
   - Add a `plantedErrors` entry that is an unchanged copy of `cleanPackage`. Run `npx vitest run src/lib/check-engine/planted-errors.test.ts` and confirm it fails: it expects `[rule]` and gets `[]`.
   - Apply the minimal mutation from the table, add an `alsoRaised` entry if needed, and confirm it passes.
8. **If a fixture exposes a rule bug** (the wrong rule fires, or none does): stop. Don't change the rule. File `.scratch/heizcheck-mvp/issues/20-….md` as `needs-triage` and note it here.
9. **`npm test` and `npm run typecheck`**: record what they printed.
10. **Tick** the checkboxes in issue 16 that are now true.
11. **`/context`**: end. Fill in section 5.

**Files changed.**

- New: `.claude/agents/rule-coverage-scout.md`, `docs/agents/context-workflow.md`, `.scratch/heizcheck-mvp/planted-error-coverage.md`
- Edited: `src/lib/check-engine/fixtures.ts`, `.scratch/heizcheck-mvp/issues/16-mvp-acceptance.md`
- Unchanged: every file in `rules/`. The local n8n email change is not committed.

## 5. Implement & reflect

Run on 2026-10-17, model Opus 5.5 (1M context window).

| Measurement | Tokens |
|---|---|
| `/context` at start | 38.6k (4%) |
| `/context` after scout returns | 82.5k (8%), of which messages 43.9k |
| `/context` after `/compact` | 74.5k (7%), of which messages 36.6k |
| `/context` at end | 101.5k (10%), of which messages 60.8k. The 27k rise after `/compact` comes from verification, ticking issue 16, writing this section, and the two `/context` dumps pasted into the conversation. |
| Scout's own `subagent_tokens` | 39,626 (25 tool calls, about 41 s) |
| Estimated cost of reading the same files inline (`wc -c` ÷ 4, **an estimate**) | about 30.6k (122,403 bytes: 18 files in `rules/`, `types`/`index`/`fixtures.ts`, both test files, `spec.md`) |

**Did the sub-agent reduce context usage?** Yes, but less dramatically than the numbers might suggest. The scout spent 39.6k tokens in its own context and returned a reply of about 1k tokens, which now lives on disk. Reading the same files inline would have added at least 30k to the main context, before any re-reads. The jump from 38.6k to 82.5k is **not** the scout's cost. Most of it is this workflow doc, the agent definition, planning and conversation in the main session, which `/compact` then cut by only 8k. The real saving is the 30k or more of rule code and test code that never entered the main context. The compaction made less difference, because there wasn't much exploration left to drop.

**What stayed out of the main context?** All 18 rule files, `check-package.test.ts` (about 1000 lines), `spec.md`, and the legal background. Full `npm test` output also stayed out, since only the summary and failures were grepped. The only check-engine code that entered the main context was one grep line per `plantedErrors` key plus the `RULE_IDS` line.

**Gaps found and fixtures added:** none, the checkbox was stale. All 11 `RuleId`s already had a planted fixture, and `alsoRaised = { H4: ['H5'] }` documents the only overlap. Since there were no gaps, there was no red→green step, and `fixtures.ts` and `rules/` are unchanged. Issue 16 lines 17 and 18 are ticked, with a note about the H4/H5 overlap. Line 19 (engine invariants) was not part of this task and stays open.

**Rule bugs filed:** none. No fixture fired the wrong rule.

Boundary follow-up: the scout flagged that B1's four-week Warning window (`WARNING_DAYS = 28` in `rules/b1.ts`) had no test at exactly 28 or 27 days left, which breaks quality rule 4. I added two tests to `check-package.test.ts`: 28 days left passes, and 27 days left warns. The rule was unchanged and already correct. To check the tests work, I made two temporary changes to `b1.ts` and reverted each with `git checkout`:

- Changing `>=` to `>` made the 28-day test fail.
- Changing `WARNING_DAYS` to 27 made the 27-day test fail.

Still open, not filed: the scout did not confirm that K1 has "just above" tests for every tier.

**`npm test` / `npm run typecheck` output:**

- `npx vitest run src/lib/check-engine/planted-errors.test.ts`: `Test Files 1 passed (1)`, `Tests 12 passed (12)`.
- `npm test`: exit 0, `Test Files 34 passed (34)`, `Tests 392 passed (392)`. After adding the B1 boundary tests: exit 0, `Tests 394 passed (394)`.
- `npm run typecheck` (`next typegen && tsc --noEmit`): `✓ Types generated successfully`, and `tsc` printed no errors.

**Would I use a sub-agent here again? What would I change?** Yes. A read-only scout with a fixed table format suits a "survey many files, act on a few facts" task well, and saving its reply to disk made the compaction safe. I'd change three things:

1. Take the baseline only after loading the workflow doc, so the "after scout" delta measures the scout alone.
2. Have the scout grep `plantedErrors` keys against `RULE_IDS` first and stop early when there is no gap. That would likely have cost a fraction of the 39.6k tokens.
3. Ask the scout to list rule-4 boundary gaps as their own section, since that turned out to be the most useful finding.
