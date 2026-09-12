# WP-J2 — Glossary, Batch 2 (카드 · 족보 · 확률)

30 glossary MDX terms written and published: the 28 assigned by
`docs/FISHTILT_CONTENT_PLAN.md` §3.4/§7 (cards, board streets, the nine hand categories,
kicker/split-pot/hand-matrix, and the draw/outs/equity/pot-odds/nuts probability cluster)
plus the two the orchestrator asked this batch to add to close the hand-category gap flagged
in `docs/reports/WP_G4_REGISTRY_SKELETON.md` §9 — `term-one-pair` (원페어) and
`term-four-of-a-kind` (포카드).

## 1. Scope

- Wrote MDX prose for all 30 owned records at `apps/fishtilt/content/glossary/<slug>.mdx`,
  including rewriting the WP-G2 placeholder `range.mdx` (its map registration and
  `shortDefinition` were left as they were, per instruction).
- Registered all 30 in the MDX component map `apps/fishtilt/src/content/glossary/j2.ts`.
- Flipped all 30 registry records in `apps/fishtilt/src/content/registry/glossary/j2.ts` from
  `PLANNED` to `PUBLISHED`, set `indexable: true`, and set `readMinutes` to the exact value
  `estimateReadMinutes` computes from each file's measured prose (all landed at 2 minutes —
  no file's prose exceeded ~800 characters).
- Added `term-one-pair` and `term-four-of-a-kind` as new records (not in the original 28),
  cross-linked into neighbouring records' `relatedConcepts` (`term-two-pair`,
  `term-full-house`, `term-three-of-a-kind`).
- Added several legitimate cross-link `relatedConcepts` entries surfaced while expanding
  prose to clear the 400-character glossary floor (`term-turn` → `term-outs`,
  `term-high-card` → `term-split-pot`, `term-one-pair` → `term-kicker`,
  `term-three-of-a-kind` → `term-full-house`, `term-straight` → `term-split-pot`).
- Verified every hand-ranking/tie-break claim in the prose against the real evaluator
  (`@gto-self/strategy-core`) in a throwaway script, never by reasoning it out by hand (§4).
- Wrote this batch's own test file,
  `apps/fishtilt/src/content/registry/glossary/j2.test.ts` (14 tests, all passing) — see §7
  for why it does not import the compiled MDX map.
- Did not touch: `types.ts`, `graph.ts`, `content.test.ts`, `graph.test.ts`, `allowList.ts`,
  `facts.ts`, `routes.ts`, `src/app/**`, `src/components/**`, `src/features/**`, J1's files,
  or any learn/blog/hands registry or MDX.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/src/content/registry/glossary/j2.ts` | Added `term-one-pair`, `term-four-of-a-kind`; flipped all 30 records `PLANNED` → `PUBLISHED`; set `indexable`/`readMinutes`; added the cross-link `relatedConcepts` entries listed above |
| `apps/fishtilt/src/content/glossary/j2.ts` | MDX component map — imports and exports all 30 components keyed by slug |
| `apps/fishtilt/src/content/registry/glossary/j2.test.ts` | New — this batch's own test file (static/text-based; see §7) |
| `apps/fishtilt/content/glossary/*.mdx` (30 files) | New/rewritten prose — full list in §3 |

The 30 MDX files: `range.mdx` (rewritten), `suited.mdx`, `offsuit.mdx`, `pocket-pair.mdx`,
`combo.mdx`, `preflop.mdx`, `hand.mdx`, `board.mdx`, `community-cards.mdx`, `flop.mdx`,
`turn.mdx`, `river.mdx`, `hand-ranking.mdx`, `high-card.mdx`, `one-pair.mdx` (new),
`two-pair.mdx`, `three-of-a-kind.mdx`, `straight.mdx`, `flush.mdx`, `full-house.mdx`,
`four-of-a-kind.mdx` (new), `straight-flush.mdx`, `kicker.mdx`, `split-pot.mdx`,
`hand-matrix.mdx`, `draw.mdx`, `outs.mdx`, `equity.mdx`, `pot-odds.mdx`, `nuts.mdx`.

## 3. Term table

| id | 한글 이름 | 한 줄 정의 | facts cited |
| --- | --- | --- | --- |
| term-range | 레인지 (Range) | 어떤 상황에서 한 사람이 들고 있을 수 있는 시작 패 전부를 하나로 묶어 부르는 말 | — |
| term-suited | 수티드 (Suited) | 받은 두 장의 무늬가 같음 (AKs) | HAND_COMBOS(AKs) |
| term-offsuit | 오프수트 (Offsuit) | 받은 두 장의 무늬가 다름 (AKo) | HAND_COMBOS(AKo) |
| term-pocket-pair | 포켓 페어 (Pocket Pair) | 받은 두 장의 숫자가 같음 | CLASSES_OF_KIND(PAIR), COMBOS_OF_KIND(PAIR) |
| term-combo | 콤보 (Combo) | 무늬까지 구별해서 센 시작 패 하나 | CLASSES/COMBOS_OF_KIND(PAIR,SUITED,OFFSUIT) |
| term-preflop | 프리플랍 (Preflop) | 공용 카드가 아직 열리지 않은 첫 배팅 단계 | — |
| term-hand | 핸드 (Hand) | 내가 들고 있는 카드 (시작 두 장 / 완성 다섯 장) | — |
| term-board | 보드 (Board) | 테이블 가운데 깔린 공용 카드 | — |
| term-community-cards | 커뮤니티 카드 | 보드를 이루는 공용 카드 | — |
| term-flop | 플랍 (Flop) | 프리플랍 다음 처음 열리는 공용 카드 석 장 | — |
| term-turn | 턴 (Turn) | 플랍 다음 열리는 네 번째 공용 카드 | — |
| term-river | 리버 (River) | 마지막 다섯 번째 공용 카드 | — |
| term-hand-ranking | 족보 순위 | 아홉 가지 족보의 강도 순서 | CATEGORY_RANK × 9 |
| term-high-card | 하이카드 | 아무 족보도 없어 가장 높은 카드로 겨루는 상태 | CATEGORY_FREQUENCY(HIGH_CARD) |
| term-one-pair (added) | 원페어 | 같은 숫자 두 장, 아래에서 두 번째로 약한 족보 | CATEGORY_FREQUENCY(PAIR) |
| term-two-pair | 투페어 | 서로 다른 숫자로 두 쌍을 만든 패 | CATEGORY_FREQUENCY(TWO_PAIR) |
| term-three-of-a-kind | 트리플/셋 | 같은 숫자 세 장 | CATEGORY_FREQUENCY(TRIPS) |
| term-straight | 스트레이트 | 숫자가 다섯 개 연달아 이어짐, 무늬 무관 | CATEGORY_FREQUENCY(STRAIGHT) |
| term-flush | 플러시 | 같은 무늬 다섯 장, 숫자 순서 무관 | CATEGORY_FREQUENCY(FLUSH) |
| term-full-house | 풀하우스 | 같은 숫자 세 장 + 다른 숫자 페어 | CATEGORY_FREQUENCY(FULL_HOUSE) |
| term-four-of-a-kind (added) | 포카드 | 같은 숫자 네 장, 풀하우스보다 강하고 SF보다 약함 | CATEGORY_FREQUENCY(QUADS) |
| term-straight-flush | 스트레이트 플러시 | 같은 무늬로 이어진 다섯 장; 로열은 그중 최상위 | CATEGORY_FREQUENCY(STRAIGHT_FLUSH) |
| term-kicker | 키커 | 같은 순위 비교 시 승부를 가르는 나머지 카드 | — |
| term-split-pot | 스플릿 팟 | 둘 이상이 정확히 같은 순위로 팟을 나눠 가짐 | — |
| term-hand-matrix | 핸드 매트릭스 | 169가지 시작 패를 늘어놓은 13×13 표 | — |
| term-draw | 드로우 | 아직 완성되지 않았지만 다음 카드로 완성될 수 있는 패 | — |
| term-outs | 아웃츠 | 드로우를 완성시켜 주는, 아직 보지 못한 카드 | OUTS_PROB(9\|FLOP\|RIVER), OUTS_PROB(9\|FLOP\|SHORTCUT_RIVER) |
| term-equity | 에퀴티 | 지금 이 패가 끝까지 갔을 때 이길 확률 (정의만, 전략 판단 없음) | EXACT_EQUITY(AsKs\|AhKh) |
| term-pot-odds | 팟 오즈 | 콜에 필요한 최소 승률 | POT_ODDS_REQUIRED_EQUITY(3\|2) |
| term-nuts | 너츠 | 그 보드에서 만들 수 있는 가장 강한 패 (정의만) | — |

Every number visible anywhere in these 30 files is a `<Fact>` call resolved from
`facts.ts`/the real packages — none is a bare digit typed into prose.

## 4. Evaluator verification (CLAUDE.md rule 7 — never invent poker behaviour)

Ran `/private/tmp/.../scratchpad/verify_j2.ts` against the real evaluator
(`evaluateHand`/`bestFiveOf`/`compareHands` from `@gto-self/strategy-core`) before writing
any hand-ranking claim. Every claim used in the 30 files was checked this way; output
(re-run for this report, unmodified):

- **Category ordering** — all nine categories, each pairwise `compareHands` against the one
  below it: `PAIR>HIGH_CARD`, `TWO_PAIR>PAIR`, `TRIPS>TWO_PAIR`, `STRAIGHT>TRIPS`,
  `FLUSH>STRAIGHT`, `FULL_HOUSE>FLUSH`, `QUADS>FULL_HOUSE`, `STRAIGHT_FLUSH>QUADS` — all
  `compareHands = 1`. Backs `term-hand-ranking`'s ordering and every category term's
  "약하다/강하다" claim.
- **The wheel** — `Ah 2c 3d 4c 5s` → `category=STRAIGHT ranks=[3]` (5-high, the lowest
  straight); `Qh Kc Ad 2c 3s` → `category=HIGH_CARD` (confirmed NOT a straight — no
  wrap-around); broadway `Th Jc Qd Kc As` → `ranks=[12]`; wheel vs broadway
  `compareHands = -1`. Backs `term-straight`'s wheel illustration and its "가장 약한
  스트레이트" claim.
- **Kicker tie-break** — `Ah Ac Kd Qc Js` vs `Ah Ac Kd Qc 9s` (same pair, same top two
  kickers, differ only on the last) → `compareHands = 1`. Backs `term-kicker`'s worked
  example verbatim (same two hands used in the MDX `<PokerCards>`).
- **Split pot / board plays** — two different hole-card pairs (`2c 3d` and `7h 8c`) over a
  broadway board (`Ah Kc Qd Js Th`), `bestFiveOf` on both → both `category=STRAIGHT
  ranks=[12]`, `compareHands(A,B) = 0`. Backs `term-split-pot`'s board-plays example
  verbatim.
- **Straight flush beats quads** — `5h 6h 7h 8h 9h` vs `Ah Ac Ad As Kc` →
  `compareHands = 1`. Backs `term-four-of-a-kind`'s "스트레이트 플러시보다는 약합니다"
  claim.
- **Royal flush is not a separate category** — `Th Jh Qh Kh Ah` → `category=STRAIGHT_FLUSH`
  (same category constant as any other straight flush), beats a 9-high straight flush
  (`compareHands = 1`). Backs `term-straight-flush`'s "로열 플러시는 별도 족보가 아니라
  그중 가장 높은 것" framing.

## 5. The two added terms — alias collision check

`term-one-pair` aliases: `원페어`, `원 페어`, `한 쌍`, `one pair`.
`term-four-of-a-kind` aliases: `포카드`, `포 카드`, `quads`, `쿼즈`.

Checked programmatically (in `j2.test.ts`, re-run standalone below) against every other
entry's `term`/`slug`/alias across the FULL glossary graph (`glossaryRecords()` — both J1's
28 and J2's 30, 58 records total, read via `graph.ts`, not hardcoded): zero collisions for
either term. `j2.test.ts`'s `it.each(['term-one-pair','term-four-of-a-kind'])` case passed
for both.

## 6. Facts needed but unavailable

None. Every number this batch's prose needed was already covered by an existing `facts.ts`
entry from `docs/reports/WP_G3B_CONTENT_FACTS.md` (`CATEGORY_RANK`, `CATEGORY_FREQUENCY`,
`HAND_COMBOS`, `CLASSES_OF_KIND`/`COMBOS_OF_KIND`, `OUTS_PROB`, `EXACT_EQUITY`,
`POT_ODDS_REQUIRED_EQUITY`).

## 7. Tests run

- `pnpm vitest run --project fishtilt src/content/registry/glossary/j2.test.ts` — **14/14
  passing** (this batch's own file).
- `pnpm vitest run --project fishtilt` (full project) — **762/769 passing, 7 failing across
  6 files**. All 7 failures are in files this batch does not own and did not touch, and none
  reference any `term-*` id: `src/content/content.test.ts` (2), `src/content/graph.test.ts`
  (1), `src/components/RelatedContent.test.tsx` (1), `src/app/glossary/page.test.tsx` (1),
  `src/app/learn/page.test.tsx` (1) — all five trace to `learn` registry records
  (`position`, `positions-6max`, `poker-actions`, `preflop`, `poker-range`'s `nextLessons`
  chain) in `apps/fishtilt/src/content/registry/learn/h2.ts`, owned by WP-H1/H2 (both
  running concurrently with this batch — one was actively diagnosing this exact class of
  failure at the time of this run). `src/components/Term.test.tsx` (1) fails because it
  searches `glossaryRecords()` for a still-`PLANNED` entry to test the "unwritten glossary
  term" rendering path, and finds none — J1's 28 records were already all `PUBLISHED`
  before this batch started (confirmed: `grep -c "status: 'PLANNED'"` on `j1.ts` = 0), and
  this batch's own 30 are now all `PUBLISHED` too, so the combined glossary has zero
  `PLANNED` records. See §9 — this is a fixture-design gap, not a J2 regression, and would
  have surfaced from J1 alone.
- `pnpm typecheck` — clean, exit 0, no errors in any of the 13 typechecked packages.
- `npx eslint apps/fishtilt --max-warnings=0` — clean, exit 0, zero warnings/errors.

### Why `j2.test.ts` does not import the compiled MDX map

Confirmed empirically (throwaway probe, deleted): the `fishtilt` vitest project has no MDX
transform configured in the root `vitest.config.ts` (only `@next/mdx`'s webpack loader
exists, wired for Next's own bundler, invisible to Vite/vitest), so importing
`src/content/glossary/j2.ts` (which statically imports all 30 `.mdx` files) crashes at
module-parse time with a Rolldown syntax error on raw Korean prose. Manually compiling via
`@mdx-js/mdx`'s `compile`/`run` API inside the test also fails — `@mdx-js/mdx` is only a
transitive dependency (via `@mdx-js/loader`), not a direct dependency of `apps/fishtilt`,
and pnpm's strict resolution refuses the import. Fixing this would mean editing
`apps/fishtilt/package.json` and/or `vitest.config.ts` — shared config outside this batch's
file boundary, and outside "content agent" scope; a content agent silently adding a
dependency to route around a real gap would be exactly the kind of undocumented workaround
CLAUDE.md rule 5 forbids. `j2.test.ts` instead does everything checkable without that
pipeline: every record's MDX file exists on disk, every slug is wired into the MDX map's
source text, every record clears `threshold.ts`'s bar (re-measured from the real file text,
not re-derived math), readMinutes matches, no ESM import/export, no top-level heading, only
allow-listed components, `<Term>` used at most once and only for a declared
`relatedConcepts` id, no literal "GTO", and the two added terms' global alias-uniqueness.
`pnpm build:fishtilt` (Next's real MDX pipeline — the orchestrator's gate, not run here) is
what actually proves a `.mdx` file compiles and renders.

## 8. Known limitations

- The MDX-under-vitest gap in §7 applies to every content batch equally (J1, H1-H3, I1-I4,
  E3), not just this one — no batch's vitest suite can render-test its own MDX today.
- All 30 `readMinutes` values landed at the floor (2 minutes) — every file's prose is
  legitimately short (a glossary term, per `threshold.ts`'s own design note, "needs only a
  definition, an easy explanation and an example"), not padded to hit a number.
- `term-equity` and `term-nuts` (this batch's two "strategy-claim trap" terms per plan §3.5)
  are scoped to pure definition; `term-pot-odds` inherently needs to say "compare to equity
  to judge a call" as part of describing what pot odds IS (not flagged as a trap in the
  plan), which is definitional rather than a live-play recommendation.

## 9. Anything needing a source change

- **`src/components/Term.test.tsx`** ("offers no 자세히 보기 link while the glossary entry
  is unwritten") searches live `glossaryRecords()` for a still-`PLANNED` entry rather than
  constructing one. This is exactly the fixture pattern `docs/FISHTILT_STATE.md`'s ruling 26
  warns against ("a test asserting product behavior must construct fixtures it controls,
  never depend on future/other-batch publish state") — it broke the moment the glossary
  became fully authored, which is the correct end state, not a bug. Fix: build a local stub
  `GlossaryRecord` with `status: 'PLANNED'` inline in the test instead of searching the
  registry.
- **`src/app/glossary/page.test.tsx`**'s "links a written term and marks an unwritten one"
  test calls `screen.getAllByText('준비 중')` when the expected count can legitimately be 0
  (now that every glossary term is published) — `getAllByText` throws on zero matches;
  `queryAllByText` does not. One-line fix once someone owns that file.
- Both are outside this batch's file boundary (`src/components/**`, `src/app/**`) and were
  not touched.

## Return to orchestrator

- **Changed files** — grouped in §2: 1 registry file (`registry/glossary/j2.ts`), 1 MDX map
  (`content/glossary/j2.ts`), 1 new test file (`registry/glossary/j2.test.ts`), 30 MDX
  content files (`apps/fishtilt/content/glossary/*.mdx`).
- **PUBLISHED count** — 30/30, confirmed by direct grep on the registry file.
- **Evaluator-verified claims** (§4, one line each) — category ordering all 8 adjacent pairs
  correct; wheel A2345 is a straight and QKA23 is not; kicker breaks a same-pair tie;
  identical broadway boards split the pot for two different hands; straight flush beats
  quads; royal flush is the same category as, and beats, a lower straight flush.
- **Facts needed but unavailable** — none.
- **Gate results** — `j2.test.ts` 14/14 own tests pass; full fishtilt project 762/769 pass,
  7 failures in 6 files, **none owned by this batch** (5 trace to WP-H1/H2's in-flight
  `learn` records, 1 to a pre-existing cross-batch glossary-completeness fixture assumption
  in `Term.test.tsx` that J1 alone would already have broken); `pnpm typecheck` clean;
  `npx eslint apps/fishtilt --max-warnings=0` clean.
- **Outside my boundary** — the MDX-under-vitest infrastructure gap (§7, affects every
  content batch, needs `@mdx-js/mdx` as a direct dependency or a vitest MDX plugin — a
  shared-config decision for whoever owns `apps/fishtilt/package.json`/`vitest.config.ts`),
  and the two test fixture-design fixes in §9 (`Term.test.tsx`, `glossary/page.test.tsx`).
