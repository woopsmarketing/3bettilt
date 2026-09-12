# WP-S3-12 — Glossary batches G5 (position) + G8 (math)

## Objective

Own MDX content + record relations for g5 (`position`, `button`, `cutoff`, `hijack`, `utg`) and g8
(`draw`, `outs`, `equity`, `pot-odds`); add new terms 인포지션/아웃오브포지션 (IP/OOP) to g5 and
거트샷/오픈엔디드 to g8, per the WP-S3-11 5-step procedure.

## Facts verified before work

- g5 was J1-family: no `## 쉽게 설명하면`/`## 예로 보면` sections, per audit. g8 was J2-family:
  already had those sections (draw/outs/equity/pot-odds "OK"/"KEEP" in audit, only tool-id fixes
  needed for `equity`).
- Audit §4 tool replacement table: only `equity` (`toolOuts→toolEquity`) applies to my batches.
  g5's five terms all keep `range` (no replacement listed for position/button/cutoff/hijack/utg).
- glossary threshold (`threshold.ts`): `minProseCharacters:400, minSections:2, minTools:1,
  minConcepts:1`. `readMinutes` must equal `estimateReadMinutes(proseCharacters)`.
- `draws.ts` (`src/features/tools/draws.ts`) already derives gutshot=4 outs, open-ended=8 outs from
  `RANKS`/`SUITS`; used the same arithmetic in prose (not typed as a bare invented number) and the
  `OUTS_PROB` Fact for the completion probabilities, matching `outs.mdx`'s existing convention.
- No visual entries exist for `draw`/`outs` or for position/betting terms (WP-11 handoff); kept
  that pattern — did not touch `visuals.ts` for `ip-oop`/`gutshot`/`open-ended`.

## Decisions made

- **IP/OOP: one merged record**, not two. Both states are two names for one contrastive concept
  a reader looks up together; splitting would duplicate the same "compare to `position`" content
  twice for barely any independent substance. `term: 'IP / OOP'`, headword `인포지션` (first of its
  own aliases), slug `ip-oop`, category `position`.
- Gutshot/open-ended sit in `math` (same category as `draw`/`outs`), cross-link each other via one
  `<Term>` each (`term-gutshot` ↔ `term-open-ended`) plus `term-draw`/`term-outs`, so neither
  duplicates draw/outs' own definitions — they specialize by outs count instead.
- `equity`'s `relatedTools` changed `toolOuts` → `toolEquity` (audit-mandated fix).

## Files changed

- `src/content/registry/glossary/g5.ts` — rewrote MDX bodies unaffected (registry unchanged except
  new `term-ip-oop` record appended).
- `src/content/registry/glossary/g8.ts` — `equity.relatedTools` fixed; appended `term-gutshot`,
  `term-open-ended` records.
- `src/content/registry/glossary/categories.ts` — added `ip-oop→position`, `gutshot→math`,
  `open-ended→math` to `TERM_CATEGORY`; added matching `TERM_HEADWORD` entries (`인포지션`,
  `거트샷`, `오픈엔디드`).
- `src/content/registry/glossary/categories.test.ts` — appended my 3 new slugs to
  `AUDIT_ASSIGNMENT.position`/`.math` (required or `matches the content audit §4 assignment` fails
  for the whole registry — this file is shared, edit was additive-only, one line per category).
- `src/content/glossary/g5.ts`, `src/content/glossary/g8.ts` — new MDX imports/map entries for
  `ip-oop`, `gutshot`, `open-ended`.
- `content/glossary/position.mdx`, `button.mdx`, `cutoff.mdx`, `hijack.mdx`, `utg.mdx` — rewritten:
  removed lead paragraph, added `## 쉽게 설명하면` → `## 예로 보면`, kept all pre-existing sections
  verbatim below (no content lost, only reordered/re-headed).
- New: `content/glossary/ip-oop.mdx`, `content/glossary/gutshot.mdx`,
  `content/glossary/open-ended.mdx`.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/glossary src/content/content.test.ts
  src/copy-guards.test.ts` → 211 passed, 4 failed — all 4 failures are in g3/g4/g9 (other agents'
  batches: `term-bet`/`term-raise`/`term-fold` under 400자, `term-three-bet`/`term-vpip` under
  400자, `starting-hands` audit-assignment mismatch from their new terms `broadway`/`connector`).
  Batch g5 and g8 subsets: 26/26 pass, 0 failures naming my slugs.
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 errors.
- `pnpm exec eslint` on all 6 files I touched → 0.
- Did not run build/e2e per brief.

## Known limitations

- `categories.test.ts` is a shared fixture outside my file boundary per the brief's literal list,
  but the new-term procedure (WP-11 handoff step 2) requires it to stay in sync with
  `TERM_CATEGORY`, and other batch owners had already done the same additive edit for their own
  new terms (`set-vs-trips` was already there before I touched the file). My edit only appended
  `ip-oop` to `position` and `gutshot`/`open-ended` to `math` — no other line touched.
- Did not add `ip-oop`/`gutshot`/`open-ended` to any other record's `relatedConcepts` (e.g.
  `position`'s or `draw`'s) — new terms have their own inbound-count risk (0 for now beyond each
  other and their category); not fixing this is intentional (audit's orphan list is for the
  original 58, this is out of scope) but flagged here for later hub work.

## Open issues

- None outside my boundary blocking my terms. g3/g4/g9 test failures are for the orchestrator to
  route to those batches' owners (not touched by me).

## Exact facts next agent may rely on

- g5 `TERM_CATEGORY`/`TERM_HEADWORD` now has 6 entries (added `ip-oop`); g8 now has 6 (added
  `gutshot`, `open-ended`). Total registry count for `categories.test.ts`'s sum-check will only
  balance once every batch owner's new terms are all merged.
- `equity`'s tool is now `toolEquity`, not `toolOuts` — anyone linking to equity's "직접 확인하기"
  slot should expect the equity calculator route, not the outs one.
- `ip-oop`, `gutshot`, `open-ended` have no visuals (`components/glossary/visuals.ts` untouched) —
  consistent with position/betting terms and with `draw`/`outs` having none.

## Facts next agent MUST re-check

- Once all 9 batches are merged, re-run `categories.test.ts`'s "matches the content audit §4
  assignment" and its total-count assertion — it will only pass when every agent's additions are
  in and none is missing/duplicated.
- `readMinutes` for all 3 new records is `2` (verified against `estimateReadMinutes` at time of
  writing); if another agent edits shared facts/threshold constants this could shift.
