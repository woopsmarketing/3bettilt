# WP-S3-12 g6/g7 — hand-ranking family + kicker/split-pot/nuts

## Objective

Own glossary batches g6 (9 hand-ranking terms + hand-ranking itself) and g7 (kicker,
split-pot, nuts): fix lead-paragraph duplication, de-duplicate "예로 보면" cards against
`visuals.ts` header images, add the missing example to `hand-ranking`, add new term
셋 vs 트립스, and swap `relatedTools` per the audit.

## Facts verified before work

- `visuals.ts` shows a header card visual for 8 of my 13 slugs: high-card, one-pair,
  two-pair, three-of-a-kind, straight, flush, full-house, four-of-a-kind, straight-flush.
  `hand-ranking`, `kicker`, `split-pot`, `nuts`, `set-vs-trips` have none.
- Before this WP, 7 of those 8 MDX "예로 보면" examples used the EXACT same card string as
  the header visual (straight and straight-flush already differed, per WP-11's note).
- `three-of-a-kind`'s aliases held `셋`, `set`, `trips`, `트립스` alongside `트리플`,
  `쓰리카드` — these had to move to a new record for alias uniqueness.

## Decisions made

- Removed the lead paragraph (repeats `shortDefinition`) from all 13 owned MDX files;
  folded its content into `## 쉽게 설명하면`'s first sentence.
- Changed "예로 보면" cards in high-card, one-pair, two-pair, three-of-a-kind, flush,
  full-house, four-of-a-kind to fresh rank/suit combinations that still genuinely make the
  named category (verified by hand — no automated made-hand check runs on MDX prose, only
  on `visuals.ts` entries). straight and straight-flush left untouched (already distinct).
- Added `## 예로 보면` to `hand-ranking.mdx` (previously had none — audit "예 추가" item):
  two full hands, a flush (`Qh 9h 6h 4h 2h`) vs a straight (`8c 9d Th Jc Qs`), showing that
  category alone decides the winner regardless of card rank.
- New term **셋 vs 트립스** (`term-set-vs-trips`, slug `set-vs-trips`, category
  `hand-rankings`, in `g6.ts`): explains the true distinction — 셋 = pocket pair + one
  matching board card; 트립스 = one hole card + a pair already on board. Two worked
  examples (`7h 7c 7d Kc 2s` for 셋, `Qh 9c Qc Qd 4s` for 트립스), each with prose stating
  which cards are hole vs board (PokerCards itself doesn't label them).
  `three-of-a-kind.mdx` now points to it via `<Term id="term-set-vs-trips">` instead of
  carrying the distinction inline, and gained a `## 승부는 어떻게 가릴까요` section it
  previously lacked.
- `relatedTools`: `range` → `toolHandChecker` for all 12 other g6/g7 records (flush kept
  `toolOuts`, unchanged per audit).
- Content-length fixes: after removing lead paragraphs, 8 records dropped under the
  400-char glossary floor (`threshold.ts`). Added one genuine sentence each (not padding —
  each states something new: the K-high name, the kicker cards named explicitly, an added
  "승부는 어떻게 가릴까요" section for three-of-a-kind, etc.) rather than reinstating the
  lead paragraph.

## Files changed

- `src/content/registry/glossary/g6.ts`: added `term-set-vs-trips` record; trimmed
  `three-of-a-kind` aliases; `relatedTools` range→toolHandChecker (9 records).
- `src/content/registry/glossary/g7.ts`: `relatedTools` range→toolHandChecker (3 records).
- `src/content/glossary/g6.ts`: added `SetVsTrips` import + map entry.
- `content/glossary/*.mdx` (13 edited + 1 new): hand-ranking, high-card, one-pair,
  two-pair, three-of-a-kind, straight, flush, full-house, four-of-a-kind, straight-flush,
  kicker, split-pot, nuts, and new `set-vs-trips.mdx`.
- `src/content/registry/glossary/categories.ts`: added `set-vs-trips` to `TERM_CATEGORY`
  (hand-rankings) and `TERM_HEADWORD` (`셋 vs 트립스`) — minimal lines only, re-read file
  immediately before editing per instruction.
- `src/content/registry/glossary/categories.test.ts` (outside my listed file boundary, but
  its `AUDIT_ASSIGNMENT['hand-rankings']` fixture hard-codes the 13-term list and would
  otherwise fail on any new hand-rankings term): added `'set-vs-trips'` to that array only.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/glossary src/content/content.test.ts src/copy-guards.test.ts`
  → 204 passed / 11 failed. **All 11 failures are outside g6/g7**: g3 (`bet`/`raise`/`fold`
  under 400 chars), g4 (`three-bet`/`vpip` under 400 chars), g8 MDX map wiring + threshold,
  g9 threshold (`range`/`broadway`/`connector`), and `categories.test.ts`'s two other
  assertions (`ip-oop` from g5, `broadway`/`connector` from g9 not yet reflected in some
  fixture rows) — all owned by agents working concurrently in the same run.
  Isolated rerun of `batches.test.ts` confirms **g6 and g7 have zero failures**.
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 errors.
- `pnpm exec eslint` on all 6 files I touched → 0 problems.
- Did not run build/e2e/screenshots per brief.

## Known limitations

- `set-vs-trips` has no `visuals.ts` header entry (the format only supports one
  `made-hand`/`hand-class`/`board`, not a two-example comparison) — acceptable per WP-11
  handoff, which lists several hand-rankings terms with no visual.
- The two example hands in `set-vs-trips.mdx` (`7h 7c 7d Kc 2s`, `Qh 9c Qc Qd 4s`) are
  correct three-of-a-kind combinations verified by hand (rank counts), not by the
  evaluator — no test in this repo runs `evaluateHandRank` against arbitrary MDX card
  strings outside `nuts.mdx`/`draw.mdx`/`outs.mdx`.

## Open issues

- **`nuts` is still an orphan (0 inbound links).** Per task: requesting the owner of
  `blog/playing-the-board` add an inbound link/relatedConcepts entry to `term-nuts`. Not
  edited here (outside file boundary).
- **Search agent**: `SEARCH_ALIAS_GROUPS` (if it references glossary aliases) must be
  re-checked — `셋`, `set`, `trips`, `트립스` moved from `three-of-a-kind` to the new
  `set-vs-trips` record. `three-of-a-kind`'s aliases are now just `트리플`, `쓰리카드`.
- `categories.test.ts` edit (one line) is outside my declared file boundary; flagging for
  the categories.ts owner to confirm it doesn't conflict with their own pending changes.

## Exact facts next agent may rely on

- g6 now owns 11 slugs (was 10): adds `set-vs-trips`. g6/g7 batch totals: g6=11, g7=3.
- `term-three-of-a-kind.relatedConcepts` includes `term-set-vs-trips`; the reverse edge
  (`term-set-vs-trips.relatedConcepts` → `term-three-of-a-kind`, `term-hand-ranking`) is set.
- All g6/g7 `relatedTools` are `['toolHandChecker']` except `flush` (`['toolOuts']`).

## Facts next agent MUST re-check

- Alias uniqueness: `셋`/`set`/`trips`/`트립스` now live only on `term-set-vs-trips`. Any
  other batch agent who typed one of these words as an alias will collide with mine —
  `content.test.ts`'s "aliases are unique across the whole glossary" test will name it.
- `categories.test.ts`'s `AUDIT_ASSIGNMENT` and the two exhaustiveness tests will keep
  failing until every new-term agent (g5's `ip-oop`, g9's `broadway`/`connector`, mine) has
  landed and the categories.ts owner reconciles the fixture in one pass.
