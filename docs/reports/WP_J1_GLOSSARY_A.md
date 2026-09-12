# WP-J1 — Glossary, Batch 1 (테이블 · 돈 · 행동)

## 1. Scope

Authored the 28 terms `docs/FISHTILT_CONTENT_PLAN.md` §3.3 assigns to batch J1: seats, money
and actions. `term-position` and `term-open-raise` reused their existing id/slug/aliases/
`shortDefinition` verbatim (WP-G's seed, referenced by the published lesson `poker-range`);
the other 26 were `PLANNED`-only records from WP-G4 that this batch gave prose and flipped to
`PUBLISHED`. No term from §3.4 (J2's cards/board/arithmetic batch) was written or touched.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/content/glossary/{28 slugs}.mdx` | NEW — one file per owned term |
| `apps/fishtilt/src/content/glossary/j1.ts` | MDX map — 28 named imports + `GLOSSARY_J1_MDX` |
| `apps/fishtilt/src/content/registry/glossary/j1.ts` | All 28 records: `status` → `PUBLISHED`, `indexable` → `true`, `readMinutes` → `2` (id/slug/aliases/relations untouched) |
| `apps/fishtilt/src/content/registry/glossary/j1.test.ts` | NEW — this batch's test file, 13 tests |
| `docs/reports/WP_J1_GLOSSARY_A.md` | this report |

Nothing in `types.ts`, `graph.ts`, `content.test.ts`, `allowList.ts`, `facts.ts`, `routes.ts`,
`src/app/**`, `src/components/**`, `src/features/**`, or any J2/H/I/E3/L registry or MDX file
was touched.

## 3. Term table

| id | Korean name | One-line definition | Facts cited |
| --- | --- | --- | --- |
| `term-position` | 자리 (Position) | 몇 번째로 액션하는 차례인지 | none |
| `term-open-raise` | 오픈 레이즈 (Open Raise) | 아무도 안 들어온 판에 처음 거는 레이즈 | none |
| `term-action` | 내 차례의 행동 (Action) | 체크·베팅·콜·레이즈·폴드 중 하나를 고르는 것 | none |
| `term-all-in` | 가진 칩 전부 (All-in) | 스택 전부를 걸어 더 낼 것이 없는 상태 | none |
| `term-ante` | 모두가 내는 참가비 (Ante) | 전원이 매 판 내는 소액 강제 베팅 | none |
| `term-blind` | 강제로 내는 돈 (Blind) | 차례 전에 강제로 내는 돈 | none |
| `term-big-blind` | 빅 블라인드 (BB) | SB의 두 배를 내는 자리/돈 | none |
| `term-small-blind` | 스몰 블라인드 (SB) | 버튼 다음 자리가 내는, BB보다 적은 돈 | none |
| `term-button` | 버튼 (BTN) | 딜러 역할 표시, 매 판 이동 | none |
| `term-cutoff` | 컷오프 (CO) | 버튼 바로 앞자리 | none |
| `term-hijack` | 하이잭 (HJ) | 컷오프 바로 앞자리 | none |
| `term-utg` | 첫 번째 자리 (UTG) | 6인 테이블에서 가장 먼저 액션 | none |
| `term-stack` | 내 앞의 칩 (Stack) | 아직 걸지 않은 칩 | none |
| `term-pot` | 판에 쌓인 돈 (Pot) | 이미 걸린 돈이 모인 것 | none |
| `term-check` | 돈을 걸지 않고 넘기기 (Check) | 걸린 돈이 없을 때만 가능한 무비용 패스 | none |
| `term-call` | 같은 금액 맞추기 (Call) | 상대 베팅과 같은 금액을 냄 | none |
| `term-bet` | 처음 돈을 거는 것 (Bet) | 아무도 안 걸었을 때 처음 거는 액션 | none |
| `term-raise` | 금액을 올리기 (Raise) | 앞사람보다 더 많이 거는 액션 | none |
| `term-fold` | 패를 접는 것 (Fold) | 패를 접고 판에서 빠짐 | none |
| `term-limp` | 최소 금액만 맞춰 들어가기 (Limp) | 레이즈 없이 BB만 콜 | none |
| `term-three-bet` | 다시 거는 레이즈 (3-Bet) | 오픈 레이즈에 다시 레이즈 (BB=1st, open=2nd, 3-bet=3rd) | none |
| `term-four-bet` | 그다음 레이즈 (4-Bet) | 3-Bet에 다시 레이즈 | none |
| `term-c-bet` | 이어서 거는 베팅 (C-Bet) | 프리플랍 레이저가 플랍에서도 이어 베팅 | none |
| `term-bluff` | 약한 패로 거는 베팅 (Bluff) | 지금 열면 못 이기는 패로 하는 베팅 | none |
| `term-heads-up` | 둘만 남은 상황 (Heads-Up) | 2인 대결 | none |
| `term-showdown` | 카드 공개 순간 (Showdown) | 남은 사람들이 패를 열어 승자를 가림 | none |
| `term-vpip` | 자발적 참여율 (VPIP) | 프리플랍 자발적 참여 비율; 미계산·미추적 | none |
| `term-pfr` | 프리플랍 레이즈율 (PFR) | 프리플랍 레이즈 비율; 미계산·미추적 | none |

No `<Fact>` was used anywhere in this batch — none of the 20 fact names in
`docs/reports/WP_G3B_CONTENT_FACTS.md` (hand-class equity/rank/combo-count, category
frequency, class-vs-class equity, exact equity, outs probability, pot-odds required equity)
apply to seats/money/action definitions. `stack.mdx` and `big-blind.mdx` state "100BB"/"BB"
as a unit convention and `big-blind.mdx`/`small-blind.mdx` state "두 배" (double), both typed
literally — this matches the precedent already shipped in `poker-range.mdx` ("6인 테이블,
100BB" typed directly) and the `big-blind` record's own pre-existing `shortDefinition`
("스몰 블라인드의 두 배"), not a new invented number.

## 4. Strategy-claim guidance applied (§3.5, the 9 flagged terms)

| Term | What changed |
| --- | --- |
| Bluff | Defined only as "지금 열면 이길 수 없는 패로 거는 베팅." Explicit line: "언제, 얼마나 자주 해야 하는지는 이 사이트가 다루는 범위 밖." No verdict. |
| C-Bet | Defined as the prefix-raiser's continuation on the flop only. Explicit: "얼마나 자주 하는 것이 좋은지는... FishTilt는 이 데이터를 다루지 않습니다." |
| 3-Bet | Counting convention stated exactly per `docs/FISHTILT_STATE.md` ruling 18 (BB=1st, open-raise=2nd, 3-bet=3rd). Explicit: "3벳에 어떤 패로 대응하는 것이 좋은지 보여주는 표는... 준비 중입니다." No competing convention offered. |
| 4-Bet | Counting only; "4벳이 나온 이후 어떤 패로 대응하는 것이 좋은지는... 학습용 기본 레인지 밖의 영역." |
| Limp | Defined mechanically (call BB, no raise) with no verdict. Explicit: "어떤 패로 하는 것이 맞는지는... 포함되어 있지 않습니다." |
| VPIP | Defined as what it counts; explicit: "FishTilt는... 계산하거나 보여주지 않습니다," "좋은 수치도... 답하지 않습니다." |
| PFR | Same treatment as VPIP, plus explicit "FishTilt는 이를 계산하거나 추적하지 않습니다." |
| Ante | No fixed ratio to blinds asserted (CLAUDE.md rule 10 — site rules vary); "사이트마다 다릅니다... 실제로 앉은 테이블의 안내를 직접 확인해야 합니다." |
| Position | Kept at the registered `shortDefinition`'s existing mechanical framing (later position sees more information); no advice added. |

One extra caution beyond the plan's own list: `hijack.mdx` and `cutoff.mdx` mention
possible etymologies for their names but explicitly flag the origin as uncertain
("여러 설이 있고, FishTilt는 확인되지 않은 유래를 사실처럼 단정하지 않습니다") rather than
asserting one — CLAUDE.md rule 7 applied to trivia, not just strategy.

## 5. Facts wanted and not available

None. Every J1 term is a rules/structure/action definition; the fact layer's 20 names are
all hand-strength, category-frequency, class-matchup, exact-equity, outs, or pot-odds
figures, none of which a table/money/action glossary entry needs to cite.

## 6. Tests run (real counts)

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt src/content/registry/glossary/j1.test.ts` | **13/13 passed** (this batch's new test file) |
| `pnpm vitest run --project fishtilt` (whole app) | **762 passed, 7 failed, 6 files** — none in a file this batch owns; see §7 |
| `pnpm --filter @gto-self/fishtilt typecheck` | PASS, 0 errors |
| `pnpm typecheck` (all 13 workspace projects) | PASS, 0 errors |
| `npx eslint apps/fishtilt/src/content/glossary/j1.ts apps/fishtilt/src/content/registry/glossary/j1.ts apps/fishtilt/src/content/registry/glossary/j1.test.ts --max-warnings=0` | PASS, no output |
| `npx eslint apps/fishtilt --max-warnings=0` (whole app) | 1 error, 1 warning — in `apps/fishtilt/measure-h1-tmp.mjs`, an untracked scratch file another concurrent agent (H1) left on disk (`git status` confirms it, not touched by this batch); `.mdx` files are not covered by this project's ESLint config at all ("File ignored because no matching configuration"), so MDX content has no lint surface — only the 3 `.ts` files above do, and they are clean |
| `npx prettier --check` on all 28 `.mdx` + 3 `.ts` files owned by this batch | PASS after one `--write` pass on 4 files (scoped to only files this batch created — no repo-wide format run) |

My own test file's 13 assertions cover: exactly the 28 owned slugs registered once each;
every record `PUBLISHED`/`indexable: true`/positive `readMinutes`; the MDX map imports and
keys every owned slug and no other; every owned `.mdx` file exists and clears the glossary
index threshold (§40) with the correct `estimateReadMinutes`; no `import`/`export`, no
top-level heading; only allow-listed components used; every `<Term id>` is used once per
file, resolves to a real glossary entry, and is declared in that record's `relatedConcepts`;
every `<PokerCards hand>` names one of the 169 real hand classes; no banned "GTO"/"무조건"/
"반드시 ~해야 합니다" construction.

**Why the test never imports the compiled MDX component.** Confirmed by hand (a throwaway
Vitest test importing the already-shipped `poker-range.mdx`) that this workspace's
`vitest.config.ts` registers no MDX transform for the `fishtilt` project — the import fails
at Vite's own import-analysis step ("Failed to parse source... invalid JS syntax") on a
plain markdown paragraph, before any JSX is involved. This is a pre-existing gap (nothing in
`content/learn/published.ts`'s already-shipped `poker-range.mdx` chain is exercised by any
current Vitest test either — only `pnpm build:fishtilt`'s real `@next/mdx` pipeline renders
it), not something this batch introduced or can fix from inside its file boundary
(`vitest.config.ts` is a shared root file; `@mdx-js/mdx` itself is not even a declared
dependency reachable from `apps/fishtilt`). So "renders without throwing" is verified the
same way `content.test.ts` already verifies every other kind of content — by statically
checking, from the raw source text, every property a render would actually exercise (Term
resolution, PokerCards hand validity, component allow-list, threshold) — see §8 for the
recommended follow-up.

## 7. Known limitations / failures not owned by this batch

Full-suite run showed 7 failing tests in 6 files, none touched by this batch (`git status`
confirms all are untracked/concurrently-modified by other live agents):

1. **`src/content/content.test.ts`** — 2 failures, both about **learn lessons**
   (`position`, `positions-6max`, `poker-actions`, `preflop` — lesson ids, not this batch's
   glossary ids) whose prose is currently short of the 1500-char lesson floor. Confirmed via
   `git status` + file mtimes: `apps/fishtilt/content/learn/*.mdx` were being actively
   written (timestamps seconds before this check) by a concurrent H-batch lesson agent —
   ruling 23's "page written, flag not yet flipped" window.
2. **`src/components/RelatedContent.test.tsx`**, **`Term.test.tsx`**,
   **`src/app/glossary/page.test.tsx`** — all fail on "shows 준비 중 for an unwritten
   glossary entry," because with J1 (28) and J2 (30) both finishing around the same moment,
   the glossary now has 58/58 `PUBLISHED` and zero `PLANNED` records left to serve as the
   fixture these tests search for live. This is `docs/FISHTILT_STATE.md` ruling 26's pattern
   recurring for the glossary specifically — the same trap ruling 21/26 already documented
   for `/tools` and `/learn`.
3. **`src/app/learn/page.test.tsx`** — same ruling-26 pattern, for lessons.

## 8. Needs a source or component change (reporting, not doing)

**One failure is a direct, foreseeable consequence of this batch's mandated work, in a file
outside this batch's boundary:**

`src/content/graph.test.ts` — `labels > states only the level when there is no text to time
yet` does `expect(contentMeta(contentById('position'))).toBe('초급')`, relying on the
**real** `term-position` record staying `PLANNED` (no `readMinutes`) forever. This batch's
brief explicitly requires publishing `term-position` (§3.3 row 11, reusing its existing id
verbatim) — doing that is not optional, and doing it makes this assertion fail, because the
test hard-coded a live, mutable registry record as its "still-unpublished" fixture instead of
constructing one. This is exactly the shape `docs/FISHTILT_STATE.md` ruling 26 already named
and fixed twice for `/tools` and `/learn`; the same fix generalizes here: build a local fake
`ContentRecord` with `readMinutes: null` inside the test rather than reading `contentById
('position')`. `graph.test.ts` is not in this batch's file boundary (shared arbiter file,
live agents in H/I/J2/E3 all depend on its current shape), so this batch reports it rather
than editing it, per the same precedent (WP-F2C/ruling 21).

No other gap found. No component (`Term`, `Fact`, `Callout`, `PokerCards`, `ToolCTA`,
`RangeMatrixMini`) was missing anything this batch needed.
