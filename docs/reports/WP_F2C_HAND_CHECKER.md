# WP-F2C — Hand Checker (`/tools/hand-checker`)

**Date:** 2026-09-05 · **Scope:** WP-F2C only — the hand checker. Equity calculator (WP-F2A/B)
and Starting Hand Explorer (WP-E2) are separate work packages, not touched.

---

## 1. Scope

Built `/tools/hand-checker`: a beginner picks up to 2 hole cards and up to 5 board cards; the
tool names the best five-card hand among them (5, 6 or 7 cards) in beginner Korean, using
`strategy-core`'s `bestFiveOf`/`evaluateHand` read-only. No new evaluator code — the brief's
own baseline audit confirmed `bestFiveOf` is the exact display primitive needed, and that
held. All Korean copy and the "which 5 cards played" logic are new, pure, and unit-tested
independently of React, in `apps/fishtilt/src/features/tools/handRank.ts`.

## 2. Files changed

| File | Status |
| --- | --- |
| `apps/fishtilt/src/features/tools/handRank.ts` | new — view model, Korean copy, `evaluateHandRank` |
| `apps/fishtilt/src/features/tools/handRank.test.ts` | new — 22 tests |
| `apps/fishtilt/src/components/HandChecker.tsx` | new — the client island |
| `apps/fishtilt/src/components/HandChecker.test.tsx` | new — 9 tests |
| `apps/fishtilt/src/app/tools/hand-checker/page.tsx` | new — server shell |
| `apps/fishtilt/src/app/tools/hand-checker/page.test.tsx` | new — 9 tests |
| `apps/fishtilt/tests/e2e/hand-checker.spec.ts` | new — 9 tests |
| `apps/fishtilt/src/lib/routes.ts` | edited — `toolHandChecker.available: false → true` (one targeted string edit) |
| `apps/fishtilt/src/features/tools/hub.ts` | **inspected, not edited** — already carried a `TOOL_DESCRIPTION['toolHandChecker']` entry from WP-F1; flipping `routes.ts` alone makes the hub card a live link |
| `docs/reports/WP_F2C_HAND_CHECKER.md` | this report |

No other file was written to. `packages/strategy-core` was read-only. `packages/learn-core`
was not touched (a concurrent agent owns that tree).

## 3. Decisions

1. **Board first, hole cards last, when calling `bestFiveOf`.** `evaluateHandRank` calls
   `bestFiveOf([...boardCards, ...holeCards])`. `bestFiveOf`'s own doc comment states that on
   a tie it keeps the lexicographically-first optimal subset in input order — passing the
   board first means a tie prefers attributing cards to the board, which yields the *minimum*
   number of hole cards genuinely necessary. This one ordering choice is what makes "only one
   hole card plays" and "the board plays alone" answerable at all, without any extra logic.
2. **"The board plays alone" is provably reachable only at a 5-card board.** Dropping both
   hole cards requires excluding at least 2 of the combined cards; `bestFiveOf` only ever
   excludes `total − 5`. With ≤2 hole and ≤5 board cards, `total − 5 ≥ 2` forces
   `boardCards.length ≥ 5`, and 5 is also the max — so it can only be exactly 5. This is
   proven in a code comment and checked by a dedicated regression test (`handRank.test.ts`),
   not assumed.
3. **Category names are established loanwords already live in this app's own copy**
   (`원페어`, `스트레이트 플러시` both already appear in `content/registry/learn.ts`'s
   `hand-rankings` lesson description) — not invented for this WP.
4. **A dedicated 와/과 particle helper** (`hasBatchim`/`josaWaGwa`, Unicode Hangul-block
   arithmetic) was added after a first draft hard-coded "와" for two-pair ("킹와 퀸 투페어"),
   which is ungrammatical — 킹 ends in a batchim (ㅇ) and takes "과". This is the one place in
   the reading that concatenates two spoken rank words with a Korean particle; it is
   unit-tested with both a batchim rank (킹) and a non-batchim rank (에이스).
5. **No barrel export.** `features/tools/index.ts` is an existing file outside the stated
   file boundary (only `routes.ts` and `hub.ts` get "exactly one edit"), so `HandChecker.tsx`
   and its page import `handRank.js` directly rather than through the barrel. Flagged in §8.
6. **Reset clears to empty, not back to the worked example.** "카드 초기화" means exactly
   that; the worked example only appears on first load.
7. **Default worked example is a realistic two pair** (Ah Kd hole, As Kc 9h board), not a
   flashy rarity — matching `OutsCalculator`/`PotOddsCalculator`'s "opens on an already-
   answered example" pattern without teaching a beginner that royal flushes are common.

## 4. Behavior

Card selection is two `CardPicker`s (hole, max 2; board, max 5) that cross-reference each
other's `value` as the other's `usedCards` — a card selected anywhere is disabled everywhere
else, so a duplicate is impossible at the UI level, not merely rejected after the fact.

- **< 5 total cards** → `카드를 더 선택하면 족보를 확인할 수 있어요. 최소 5장이 필요하고,
  지금은 N장을 골랐습니다. M장 더 선택해주세요.`
- **5, 6 or 7 cards** → category label, one-line reading, rank among 9
  (`"9개 족보 중 N번째로 강한 족보"`), a 1–2 sentence explanation, every selected card marked
  사용됨/사용 안 됨 (`PokerCard`, ring + text label, never colour/opacity alone), and the best
  five shown in isolation via `PokerCards`.
- **5-card board that already beats the hand** → `보드에 놓인 다섯 장이 이미 당신의 핸드보다
  강합니다. 이번 판에서는 당신이 고른 카드가 쓰이지 않았습니다.`
- **Only one hole card plays** → `핸드 두 장 중 한 장만 이번 족보에 쓰였습니다.`
- **No hole cards picked at all** → `핸드 카드를 아직 고르지 않아서 보드 카드만으로
  계산했습니다.`

### Korean phrasing scheme, one line per category

| Category | Reading | Example |
| --- | --- | --- |
| HIGH_CARD | `{top} 하이` | 킹 하이 |
| PAIR | `{pair} 원페어` | 퀸 원페어 |
| TWO_PAIR | `{high}와/과 {low} 투페어` | 에이스와 킹 투페어 |
| TRIPS | `{trips} 트리플` | 에이스 트리플 |
| STRAIGHT | `{top} 하이 스트레이트`; wheel → `5 하이 스트레이트 (A-2-3-4-5)` | 나인 하이 스트레이트 |
| FLUSH | `{top} 하이 플러시` | 에이스 하이 플러시 |
| FULL_HOUSE | `{trips} 풀하우스, {pair} 포함` (order-sensitive) | 에이스 풀하우스, 킹 포함 ≠ 킹 풀하우스, 에이스 포함 |
| QUADS | `{quads} 포카드` | 에이스 포카드 |
| STRAIGHT_FLUSH | `{top} 하이 스트레이트 플러시`; ace-high → `로열 플러시 (Royal Flush)`; wheel → `5 하이 스트레이트 플러시 (A-2-3-4-5)` | 나인 하이 스트레이트 플러시 |

`키커 (Kicker)` is glossed inline the first time it matters in a hand's own explanation
(PAIR/TWO_PAIR/TRIPS/QUADS), matching the site's established gloss format (`같은 무늬
(Suited)`, `것샷 스트레이트 드로우 (Gutshot)`).

## 5. Evaluator edge cases covered by tests

- All 9 categories, both via synthetic `HandValue` fixtures (`handReading`/`handExplanation`)
  and via real 5-card hands through `evaluateHandRank` (`bestFiveOf` end to end).
- **Aces full of kings ≠ kings full of aces** — same two ranks, reversed roles, both from
  real cards, asserted unequal.
- **The wheel (A-2-3-4-5)**, both as a straight and a straight flush — asserted the reading
  never implies the ace was ignored.
- **Royal flush** gets its own name, not just "에이스 하이 스트레이트 플러시".
- **와/과 particle correctness** for both a batchim rank (킹) and a non-batchim rank (에이스).
- **Board plays alone** (a royal flush entirely on a 5-card board) → both hole cards excluded,
  correct note.
- **Exactly one hole card plays** (four to a royal flush on the board + one relevant hole
  card + one irrelevant one) → the relevant one is used, the other is not, correct note.
- **No hole cards selected** → distinct note from "board plays alone".
- **Regression: "board plays" cannot fire before the board reaches 5 cards** — a strong
  4-card board with 2 junk hole cards is asserted to always use at least one hole card,
  proving the combinatorial claim in §3.2 rather than trusting the comment.
- **Incomplete counts** (0 through 4 total cards) report the exact `moreNeeded`.

## 6. Tests run — real counts

| Gate | Before this WP | After this WP |
| --- | --- | --- |
| `pnpm vitest run --project fishtilt` | 47 files / 425 tests | **50 files / 465 tests, 0 failed** |
| `pnpm --filter @gto-self/fishtilt typecheck` | clean | **clean** |
| `npx eslint apps/fishtilt --max-warnings=0` | clean | **clean, 0 warnings** |
| `pnpm build:fishtilt` | 7 routes | **8 routes** — `/tools/hand-checker` is `○ (Static)`:<br>`├ ○ /tools/hand-checker` |
| `pnpm e2e:fishtilt` | 49 passed | **58 passed, 1 failed** (59 total) — see §7 |

New unit/component test breakdown (exact, verbose-reporter counted): `handRank.test.ts` 22,
`HandChecker.test.tsx` 9, `page.test.tsx` 9 = **40**, exactly matching 465 − 425 = 40.

E2E: all 9 new `hand-checker.spec.ts` tests pass (worked example, real full house through
clicks, duplicate prevention, reset, board-plays-alone, nav reachability, cross-link to
outs, no "GTO", no horizontal overflow at 390/1440).

## 7. Known limitations

1. **`tests/e2e/tools-hub.spec.ts:25` now fails**, as a direct, expected consequence of
   flipping `toolHandChecker.available` to `true` (required by this WP). That test hard-codes
   `await expect(cards.getByRole('link', { name: /핸드 체커/ })).toHaveCount(0)` as its example
   of "a tool that is not built yet." This is the *exact* situation WP-F1's own report
   documents and already fixed once, for `toolOuts`, in `content/graph.test.ts` and
   `ToolCTA.test.tsx` — the same one-line pattern applies here: replace the hard-coded name
   with a dynamic "find any still-unbuilt tools-section route" lookup, e.g.
   `const stillUnbuilt = /* a route with section: 'tools' and available: false */`. This file
   is outside my file boundary (only `routes.ts`/`hub.ts` get an edit; this is neither), so
   per instructions it is reported, not fixed. **Every other test in the suite passes**;
   `pnpm e2e:fishtilt` reports 58/59 (still comfortably above the 49 baseline) with exactly
   this one pre-existing, precedented, one-line fix outstanding.
2. **No barrel export.** `features/tools/index.ts` was not edited (outside boundary), so
   `handRank.ts` is imported directly by path rather than through the barrel the rest of the
   folder uses. Harmless today; a future WP touching `features/tools/index.ts` should add
   `export * from './handRank.js';` for consistency.
3. **`draws.ts`'s WP-F1 hand-off note** (its combinatorics belongs in `learn-core`) is
   unrelated to this WP and was not touched.

## 8. Next dependency

- **WP-E** (hand-rankings lesson) should eventually flip `hand-rankings` to `PUBLISHED`.
  When it does, the "9개 족보 순서를 처음부터 배우고 싶다면" card on `/tools/hand-checker`
  turns into a live link automatically — no content edit needed on this page, by
  construction (`hrefOfContent`).
- **`tests/e2e/tools-hub.spec.ts`** needs the one-line fix described in §7.1 before/alongside
  the next tool that ships (otherwise the next agent hits the identical failure again).
