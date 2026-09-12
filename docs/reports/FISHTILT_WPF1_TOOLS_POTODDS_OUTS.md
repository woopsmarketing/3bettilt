# FishTilt WP-F1 — `/tools`, `/tools/pot-odds`, `/tools/outs`

**Date:** 2026-09-05 · **Scope:** WP-F, part 1 (pot odds + outs + the tools hub).
**Not in scope:** hand checker, equity calculator (WP-F2).

---

## 한국어 요약

### 무엇을 만들었나

세 개의 라우트를 만들었습니다. 전부 정적 프리렌더(`○ Static`)입니다.

| 라우트 | 무엇 |
| --- | --- |
| `/tools` | 무료 도구 허브. 라우트 레지스트리에서 목록을 읽어 "지금 쓸 수 있는 도구 3개 / 준비 중 3개"를 정직하게 보여줍니다. |
| `/tools/pot-odds` | 팟 오즈 계산기. 필요 승률, 콜한 뒤의 팟, "N번 중 1번", 오즈 표기, 그리고 계산 과정을 사용자의 숫자로 한 줄씩 보여줍니다. |
| `/tools/outs` | 아웃 계산기. 정확한 확률과 ×2 / ×4 암산 규칙을 **나란히** 보여주고, 그 차이를 부호와 함께 말로도 설명합니다. |

### 지킨 원칙

- **화면의 모든 숫자는 `learn-core`가 그 자리에서 계산합니다.** 페이지 산문에는 숫자가 하나도
  없고, 그 사실을 테스트가 강제합니다(설명 카드 안에 숫자가 들어가면 실패).
- **돈은 정수 milliBB.** 입력 텍스트는 `parseAmountBB`에서 한 번만 `Money.parseBB`를 거쳐
  `MilliBB`가 되고, 그 뒤로는 전부 `Money.*`입니다. 확률과 필요 승률은 돈이 아니므로
  milliBB로 반올림하지 않습니다.
- **입력을 지우지 않습니다.** 47을 넣고 스트리트를 턴으로 바꾸면 46으로 몰래 줄이지 않고
  "턴에서 보지 못한 카드는 46장입니다"라고 말합니다. 소수점 넷째 자리도 잘라내지 않고
  거절합니다. 팟 비율 버튼만 값을 씁니다 — 그리고 계산에 실제로 쓰인 값을 그대로 입력칸에
  넣으므로 숨겨진 값이 없습니다.
- **드로우 프리셋의 아웃 개수도 손으로 적지 않았습니다.** `RANKS`/`SUITS`에서 유도하고,
  유도 문장("한 무늬는 13장인데 이미 4장을 봤으니 9장")을 버튼 안에 함께 보여줍니다.
- "GTO"는 어디에도 없습니다. 제휴/카지노/가입 유도 표면도 없습니다.

### 검증 결과 (전부 PASS)

| 명령 | 결과 |
| --- | --- |
| `pnpm vitest run --project fishtilt` | **47 files / 425 tests, 0 failed** |
| `pnpm --filter @gto-self/fishtilt typecheck` | PASS |
| `npx eslint apps/fishtilt --max-warnings=0` | PASS (0 warnings) |
| `pnpm build:fishtilt` | PASS — 세 라우트 모두 `○ (Static)` |
| `pnpm e2e:fishtilt` | **49 passed** |
| `pnpm vitest run --project learn-core` (참고) | 82 passed (다른 세션이 데이터셋 블로커 해소) |

### 스크린샷에서 실제로 발견해 고친 것 2가지

1. **`계산 과정` 블록의 한글이 모노 폰트로 렌더되어 글자 사이가 벌어졌습니다.**
   `--font-mono`에 한글 글리프가 없어 모노스페이스 CJK 폰트로 폴백되고, 음절마다 1em이
   할당되어 "콜한  뒤의  팟"처럼 보였습니다. → 모노는 **숫자 쪽에만** 적용.
2. **선택된 드로우 프리셋의 유도 문장이 빨간 배경 위에서 거의 읽히지 않았습니다.**
   `text-300`(#969da8) on `brand-600`(#d71e36) ≈ 1.8:1. → 선택 상태에서는 `text-100`
   (4.70:1, AA 통과).

두 결함 모두 유닛/E2E 테스트는 전부 통과한 상태에서 **그림을 보고** 발견했습니다.

---

## English detail

### 1. What was built

Three routes, all statically prerendered by `next build`.

#### `/tools` — the hub

The list is the route registry filtered to `section === 'tools'`, with the hub itself
excluded. Nothing about a tool is written twice: name and URL come from
`src/lib/routes.ts`, the one descriptive line comes from `TOOL_DESCRIPTION` in
`features/tools/hub.ts`, and `toolHubEntries()` **throws** for a tool route with no
description rather than rendering a blank card (CLAUDE.md rule 5). Built tools are links;
planned tools are readable text with a `준비 중` badge and no link semantics — the same
treatment `/learn` gives unwritten lessons and `RouteNavItem` gives unbuilt nav entries.

#### `/tools/pot-odds`

A server shell (`PageHero` → island → four `ExplanationCard`s → `ToolCTA`) around one
`'use client'` island, `PotOddsCalculator`.

- Mounts on a worked example already answered: 10 BB pot, a 5 BB bet → **25.0%**. Same
  example the WP-0 homepage uses, so a reader arriving from there recognises the number.
- Renders `requiredEquity`, `finalPotMbb`, `oneInN` ("4.0번 중 1번"), `oddsAgainst`
  ("3.0 : 1"), and — when it exists — `uncalledReturnMbb`.
- **The uncalled remainder is a first-class feature, not a footnote.** A checkbox
  ("내 스택이 모자라서 더 적게 콜해요") reveals the call field; calling 2 into a 5 BB bet
  shows "상대에게 돌아가는 금액 3 BB" and a sentence explaining that nobody matched it, so
  it never joins the contested pot. This is exactly the case `potOdds.ts`'s header models
  and the naive published formula gets wrong.
- **The formula is shown, not hidden** (build spec §24): the pot line and the division line
  are printed with the reader's own numbers substituted.
- Pot-fraction shortcuts (1/3, 1/2, 2/3, 팟) compute through `Money.mulRatio(pot, n, d,
  'round')` and write the resulting amount into the visible field.
- A bridge panel answers the same price in cards: "턴 한 장만 보고 끝난다면 최소 12장 /
  리버까지 두 장을 다 본다면 최소 7장", with the caveat that the second line assumes no
  further betting.

#### `/tools/outs`

Same shell shape around `OutsCalculator`.

- Street selector (플롭 / 턴), a ±1 stepper with a free-text field, and seven derived draw
  presets.
- Shows `nextCardProb`, `missThenHitProb` (flop only), `byRiverProb`, `unseenCards`,
  `cardsToCome`, plus the decomposition written as the domain's own two disjoint events
  summing to the by-the-river figure.
- **Exact and shortcut side by side, always** (build spec §25). Two comparison cards on the
  flop (×2 and ×4), **one** on the turn — because on the turn "the next card" and "by the
  river" are the same event and `outs.ts` deliberately returns the identical float for
  both. Rendering it twice would invent a distinction the deck does not have.
- The signed gap is shown as `+1.0%p` / `-1.1%p` AND in words
  ("규칙이 실제보다 높게 잡습니다"), so the direction is never carried by a sign or a colour
  alone.

### 2. Files created

**Feature layer — `apps/fishtilt/src/features/tools/`** (new folder, 7 modules + 7 suites)

| File | What |
| --- | --- |
| `amount.ts` | The parse boundary. Text → integer `MilliBB` via `Money.parseBB`; typed `AmountError`. Also `parseOutsInput`. |
| `format.ts` | `formatPercent`, `formatSignedPercentagePoints`, `signOfPercentagePoints`, `formatMultiplier`, `formatAmountBB`. |
| `copy.ts` | Korean messages, exhaustive over every domain union; `outsErrorLabel` is a `switch` closed by `assertNever`. |
| `draws.ts` | The seven draw presets, out counts DERIVED from `RANKS`/`SUITS`, each with its derivation sentence. |
| `outsView.ts` | `unseenCardsOn`, `shortcutComparisons` (2 rows on the flop, 1 on the turn). |
| `requiredOuts.ts` | `minimumOutsFor(requiredEquity, street, horizon)` — the bridge from a price back to a card count. |
| `hub.ts` | `TOOL_DESCRIPTION` + `toolHubEntries()`. |
| `index.ts` | The barrel, the only import surface for components and pages. |

**Components** — `PotOddsCalculator.tsx`, `OutsCalculator.tsx` (+ their `.test.tsx`).

**Pages** — `app/tools/page.tsx`, `app/tools/pot-odds/page.tsx`, `app/tools/outs/page.tsx`
(+ their `.test.tsx`).

**E2E** — `tests/e2e/pot-odds.spec.ts`, `tests/e2e/outs.spec.ts`,
`tests/e2e/tools-hub.spec.ts`.

### 3. Files changed outside the new set

| File | Change | Why |
| --- | --- | --- |
| `src/lib/routes.ts` | `tools`, `toolPotOdds`, `toolOuts` → `available: true` | The three pages now exist. `routes.test.ts` asserts availability matches disk in BOTH directions, so this edit is not optional. |
| `src/content/graph.test.ts` | Stopped hard-coding `toolOuts` as the unbuilt example; finds an unbuilt tool route instead. | The assertion `expect(routeById('toolOuts').available).toBe(false)` becomes false the day this WP ships. `routes.test.ts`'s own comment documents this trap ("a test you edit to make it pass stops being a test"), so the fixture is now found rather than named. |
| `src/components/ToolCTA.test.tsx` | Same change, same reason. | |

Nothing under `packages/`, `apps/web/`, root config, `/tools/range`, `/learn` or
`docs/DECISIONS.md` was touched.

Flipping the registry also turned four already-written content relations
(`relatedTools: ['toolPotOdds']` / `['toolOuts']` in `content/registry/learn.ts` and
`blog.ts`) from `준비 중` badges into live deep links, with no content edit — which is the
whole reason `ToolCTA` takes a route id instead of a path.

### 4. Decisions taken, and why

**The domain is the only rulebook.** `parseAmountBB` rejects "this is not a number" and
nothing else. A negative pot, a zero call and half an out all parse cleanly and are refused
by `potOdds` / `outsOdds` with their own typed errors. Re-deciding poker rules at the parse
boundary would give the app two rulebooks that can disagree.

**Preset out counts are derived, and that arithmetic is in the wrong package.**
`draws.ts` computes 2 / 4 / 6 / 8 / 9 / 12 / 15 from `SUITS.length` and `RANKS.length`, and
subtracts the overlap explicitly on the two combined draws (a flush-plus-gutshot
double-counts one card, a flush-plus-open-ender two). This is pure card combinatorics with
no UI in it and **belongs in `learn-core` beside `outs.ts`**; it lives in the app because
`packages/` was outside this WP's file boundary. Hand-off note for whoever owns WP-F2 or a
`learn-core` follow-up.

**The pot-odds → outs bridge ships with its caveat visible.** Comparing a by-the-river
probability against the price of one call assumes no further betting. That is a real
simplification, so the page says so in bold rather than letting the number imply a rule.
The comparison itself is a search over `outsOdds`, not a formula of ours.

**No URL state.** `/tools/range` syncs `?hero=&spot=&stack=`; these two do not. The brief
did not ask for it and no content record deep-links them with parameters today. If WP-H or
WP-I wants `<ToolCTA tool="toolPotOdds" params={{ pot: '6', bet: '4' }} />` to actually open
pre-filled, that support has to be added — flagged here rather than assumed.

**Two known-value pins in `requiredOuts.test.ts` are stated in the test, not just asserted.**
6 outs by the river is 24.1% (under a 25% price) and 7 is 27.8%; 11 outs on the turn alone
is 23.4% and 12 is 25.5%. A property test brackets every boundary exhaustively beside them.

### 5. Test results (exact numbers)

```
pnpm vitest run --project fishtilt
  Test Files  47 passed (47)
       Tests  425 passed (425)          # was 40 files / 373 tests before this WP

pnpm --filter @gto-self/fishtilt typecheck
  tsc -p tsconfig.json --noEmit         # clean

npx eslint apps/fishtilt --max-warnings=0
  (no output — 0 errors, 0 warnings)

pnpm build:fishtilt
  ✓ Compiled successfully
  ○ /tools          ○ /tools/outs     ○ /tools/pot-odds     ○ /tools/range
  # all three new routes prerendered static

pnpm e2e:fishtilt
  49 passed (5.8s)                      # was 36 before this WP
```

`pnpm vitest run --project learn-core` — **82 passed, 0 failed**. The 3 failures the brief
warned about were resolved by another session on 2026-09-05 (see `docs/FISHTILT_STATE.md`
"Open blockers": the exhaustive dataset landed). Nothing in this WP touched that package.

New E2E coverage (13 tests):

- `pot-odds.spec.ts` (6): the full beginner flow (read the default answer → change the pot →
  apply a pot fraction → price an all-in for less); an impossible call explained not
  corrected; reachable from `/tools`; hands off to `/tools/outs`; no "GTO"; **no horizontal
  overflow at 390 and 1440** (measured in the widest reachable state — short-stack field
  open, a three-decimal amount in every box).
- `outs.spec.ts` (7): pick a draw → read exact + shortcut + gap → preset → stepper → switch
  to the turn and watch two comparisons collapse to one; an impossible count explained not
  clamped; reachable from `/tools`; hands off to `/tools/pot-odds`; no "GTO"; **no
  horizontal overflow at 390 and 1440**.
- `tools-hub.spec.ts` (5): reached from the header nav; the whole toolbox listed honestly;
  **every link on the hub returns HTTP 200**; no "GTO"; no overflow at 390 / 1440.

### 6. What I saw in the screenshots

Built, served on `:3223`, captured at 1440×1000 and 390×844 at `deviceScaleFactor: 2`, full
page, then opened and inspected each image. `documentElement.scrollWidth ===
clientWidth` on all six.

**Two real defects, both invisible to green tests, both fixed:**

1. **Mono-face Korean in the `계산 과정` blocks.** `--font-mono` (`ui-monospace, SF Mono,
   Menlo, Consolas…`) carries no Hangul, so the Korean `<dt>` labels fell back to a
   monospaced CJK face and every syllable was padded to a full em: "콜한  뒤의  팟",
   "턴에서  바로  맞을  확률". Fixed by moving `font-mono` onto the numeric `<dd>` only —
   the digits are what need to line up in a column, the label does not.

2. **The selected draw preset's derivation was nearly unreadable.** On the `brand-600`
   (#d71e36) fill, the `text-300` (#969da8) sub-line sits at roughly 1.8:1 — and it is the
   very sentence the preset exists to teach ("한 무늬는 13장인데… 9장이 남습니다"). Fixed by
   using `text-100` when selected (4.70:1 on `brand-600`, per the palette audit in
   `globals.css`). Very obvious at 390px, where that card is the widest thing on screen.

**One false alarm worth recording** so nobody re-reports it: a first capture of the turn
state showed BOTH street buttons in the same maroon. It was `transition-colors
duration-150` caught mid-flight by `page.screenshot()` immediately after `click()`. A
700 ms settle plus moving the mouse away shows the correct state (턴 filled brand-600, 플롭
`panel-600` with a `line-500` border). Not a defect.

**What else the images showed, and I accepted:**

- Pot odds at 1440 leaves a tall empty area under the left input panel, because the result
  column is much longer. Normal for a start-aligned two-column tool layout; the same shape
  `/tools/range` already ships.
- Both pages stack cleanly at 390. The four pot-fraction buttons stay on one row; the two
  shortcut cards stack; the preset list is full-width and legible.
- The error states read as teaching, not scolding: entering 60 outs keeps `60` in the field,
  shows the message under the input AND in the result panel, and states the real unseen
  count for the street.
- `무료 도구` now appears as a live link in both the header and the footer, and the hub's
  own `<h1>` does not duplicate as a card in its own list.

### 7. Deliberately not done

- **Hand checker and equity calculator** (`/tools/hand-checker`, `/tools/equity`) — WP-F2.
  They stay `available: false` and render as `준비 중` on the hub.
- **URL state on the two calculators** — see §4.
- **Moving `draws.ts`'s combinatorics into `learn-core`** — outside this WP's file boundary;
  flagged in §4 for the package owner.
- **Any change to `/tools/range`, `/learn`, `apps/web`, `packages/` or root config.**
- **`docs/FISHTILT_STATE.md`** — updating it is the orchestrator's job (CLAUDE.md, "Working
  agreement for phase agents"). WP-F should move to "part 1 done (pot odds, outs, hub);
  hand checker + equity remain", and the "site navigation shows five 준비 중 entries" line
  under Known limitations is now stale.

### 8. Remaining risks

- **Low.** `TOOL_DESCRIPTION` is keyed by route id with a runtime throw and a test for
  completeness, but it is a `Record<string, string>` rather than a union-typed record —
  route ids are plain `string` in the registry, so the compiler cannot check it. The test
  closes the gap; a future typed `RouteId` union would close it properly.
- **Low.** The pot-odds → outs bridge is arithmetic presented next to a caveat sentence. If
  a later review decides the caveat is not prominent enough for absolute beginners, the
  panel can be dropped without touching anything else — it is one component and one pure
  function.
