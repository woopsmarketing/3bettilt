# WP-S3-12 G1+G2 (category `game`)

## Objective

Own batches g1 (ante, blind, big-blind, small-blind, stack, pot, heads-up, showdown) and g2
(preflop, flop, turn, river, board, community-cards). Write/repair MDX body + relations per
`WP_S3_12_GLOSSARY_CONTENT_BRIEF.md` and the WP-S3-11 handoff how-to. No new terms.

## Facts verified before work

- g2's 6 MDX files were already in the J2 (post-fix) shape: lead sentence + `## 쉽게 설명하면` +
  `## 예로 보면` (with `<PokerCards>`), no changes needed to prose. Registry `relatedTools` for
  g2 already matched the audit's "keep" column (`range` for preflop, `toolOuts` for the other
  5) — no edits made to `registry/glossary/g2.ts` or `content/glossary/g2.ts`.
- g1's 8 MDX files were still J1-shape (no `## 쉽게 설명하면`/`## 예로 보면` headers at all).
- `src/app/[locale]/glossary/[slug]/page.tsx` comment confirms the lead (unheaded) paragraph is
  expected to restate the definition in the entry's own words — "no lead paragraph that repeats
  shortDefinition" means don't copy the field verbatim, not "delete the lead paragraph."
- `threshold.ts` (`MINIMUM_CONTENT.glossary.minTools = 1`) requires every `PUBLISHED`/
  `indexable: true` record to keep at least one `relatedTools` entry — a literal empty array
  for the audit's "range→없음" would fail `clears the glossary index threshold` in
  `batches.test.ts`.

## Decisions made

- Rewrote all 8 g1 MDX files: added `## 쉽게 설명하면` (folding in the old first headed
  section) and `## 예로 보면` (a concrete, round-number illustrative scenario — no invented
  poker stats, no `<Fact>` needed since these are plain arithmetic/rule illustrations, matching
  the site's existing convention of plain illustrative numbers like "100BB" in `big-blind.mdx`).
  Kept every existing `<Term>` usage (same id, same count) and every existing later section
  unchanged in content.
- `relatedTools` — audit's replacements for my slugs, applied literally where a valid tool
  route exists:
  - `ante`, `blind`: audit said `range→없음`. Since an empty array breaks `minTools:1`, I
    substituted `'practice'` (the quiz hub route, already the fallback the brief uses for
    action/check/fold in another batch) instead of leaving `range` in place. **Flagging this
    substitution explicitly** — it is my judgment call to satisfy a hard test floor, not a
    literal application of "없음"; orchestrator may prefer a different fallback.
  - `stack`: `range` → `toolPotOdds` (matches brief's explicit list).
  - `heads-up`: `toolOuts` → `toolEquity` (matches brief's explicit list).
  - `showdown`: `range` → `toolHandChecker` (audit table row; not in the brief's inline
    examples but is the audit's stated recommendation for this slug).
  - `big-blind`, `small-blind`, `pot`: audit shows no arrow (keep as-is) — untouched.
- `readMinutes` unchanged at 2 for all 14 slugs — `estimateReadMinutes` still returns 2 for
  every file's new prose-character count (verified by the batch gate test, not just eyeballed).

## Files changed

- `apps/fishtilt/src/content/registry/glossary/g1.ts` — `relatedTools` for ante, blind, stack,
  heads-up, showdown.
- `apps/fishtilt/content/glossary/ante.mdx`, `blind.mdx`, `big-blind.mdx`, `small-blind.mdx`,
  `stack.mdx`, `pot.mdx`, `heads-up.mdx`, `showdown.mdx` — restructured with
  `## 쉽게 설명하면` / `## 예로 보면`.
- Untouched (read only, verified already correct): `apps/fishtilt/src/content/registry/glossary/g2.ts`,
  `apps/fishtilt/src/content/glossary/g1.ts`, `g2.ts` (MDX maps), the 6 g2 `.mdx` files.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/glossary/batches.test.ts -t "batch g1"`
  → 13 passed, 106 skipped. PASS.
- `pnpm vitest run --project fishtilt src/content/registry/glossary/batches.test.ts -t "batch g2"`
  → 13 passed, 106 skipped. PASS.
- `pnpm vitest run --project fishtilt src/content/registry/glossary src/content/content.test.ts src/copy-guards.test.ts`
  → 209 passed, 6 failed. **All 6 failures are threshold (§40, <400 prose chars) failures in
  batches g3/g4/g6/g7/g9 — not g1/g2, not mine.** Slugs: `bet`, `raise`, `fold` (g3),
  `three-bet`, `vpip` (g4), `high-card`, `one-pair`, `three-of-a-kind`, `flush`, `full-house`,
  `four-of-a-kind`, `straight-flush` (g6), `kicker` (g7), `range` (g9). Reporting for the
  respective batch owners.
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 errors.
- `pnpm exec eslint` on all 4 files I touched → clean, no output.
- Did not run build/e2e/screenshots per brief.

## Known limitations

- None for g1/g2 content itself.

## Open issues

- **Decision needed**: my `practice` substitution for `ante`/`blind` `relatedTools` (see
  Decisions above) is a judgment call, not a literal "없음". If the orchestrator wants true
  "no tool" glossary entries, that requires either a schema change (allow `relatedTools: []`
  for `indexable: true` glossary records) or lowering `MINIMUM_CONTENT.glossary.minTools`,
  which is out of my file boundary (`src/content/threshold.ts`) — flagging rather than editing.
- The 6 threshold (<400 char) failures above belong to g3/g4/g6/g7/g9 owners, not me — listed
  for the orchestrator's tracking, no action taken by me.

## Exact facts next agent may rely on

- All 8 g1 slugs now follow the same `## 쉽게 설명하면` → `## 예로 보면` → (existing sections)
  shape as g2 and other already-fixed batches. `<Term>` ids and `relatedConcepts` are
  unchanged from before this WP (no id/slug changes).
- g1/g2 registries: `readMinutes: 2` for all 14 records, confirmed still correct by
  `estimateReadMinutes` after the MDX rewrite (all still comfortably under the 400-char
  threshold's 2-minute floor — actual counts are in the low 400s–700s per file, all still
  ceil-dividing to 2 under `READING_CHARACTERS_PER_MINUTE = 400`).
- `relatedTools` valid ids confirmed from `src/features/tools/hub.ts` /
  `src/lib/routes.ts`: `range`, `toolStartingHand`, `toolEquity`, `toolPotOdds`, `toolOuts`,
  `toolHandChecker`, plus the top-level route id `practice`.

## Facts next agent MUST re-check

- If another agent changes `MINIMUM_CONTENT.glossary.minTools` or adds a "no tool" sentinel,
  revisit the `ante`/`blind` `practice` substitution — it may no longer be the right call.
- `batches.test.ts` batch g1/g2 sections were the only ones run scoped; a full
  `content.test.ts` run also exercises g3/g4/g6/g7/g9, whose 6 pre-existing failures are NOT
  caused by this WP (verified by scoping the g1/g2 test run separately — both pass alone).
