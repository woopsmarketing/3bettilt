# WP C1-D — `apps/web` UI: 세션 분석 및 반영, the Player Model panel, and the browser E2E

Scope: `apps/web/**` only (plus this report). `packages/*`, root configs, `CLAUDE.md`, `prompt`
and `docs/STATE.md` are untouched. No server service or action logic was changed — the two
actions WP C1-B wrote are reached exactly as written, passed down as props.

Implements prompt §26 (button + safe boundary), §27 (result summary), §28 (player profile),
§40 (browser E2E) and the §29 / ADR-0062g invariant as a browser assertion.

**Gates.** `pnpm vitest run --project web` **24 files / 372 PASS + 3 skipped** (baseline
20 / 319 + 3 — 52 tests added, none weakened or deleted). `pnpm e2e` **25 specs PASS**
(baseline 24). `pnpm typecheck` PASS across all 10 projects. `pnpm lint` PASS.

---

## 1. Files

| File | Change |
|---|---|
| `src/lib/table/analysis-view.ts` | NEW. Pure gate + copy + rate derivation. No React. |
| `src/lib/table/analysis-view.test.ts` | NEW — 22 tests. |
| `src/components/table/SessionAnalysisControl.tsx` | NEW. The button, its reason, the summary overlay. |
| `src/components/table/SessionAnalysisControl.test.tsx` | NEW — 16 tests. |
| `src/components/table/PlayerModelPanel.tsx` | NEW. The learned model (prompt §28). |
| `src/components/table/PlayerModelPanel.test.tsx` | NEW — 9 tests. |
| `src/components/table/SessionAnalysisWiring.test.tsx` | NEW — 5 tests, the control inside the real table. |
| `src/components/table/TableRoot.tsx` | EDITED. Two optional props, the header slot, one modal-keyboard gate. |
| `src/components/table/useCompletedHandSaves.ts` | EDITED. `savesInFlight` added to the hook's result (§3.2). |
| `src/app/table/[sessionId]/page.tsx` | EDITED. Passes `runSessionAnalysisAction` / `getPlayerModelAction` down. |
| `tests/e2e/session-analysis.spec.ts` | NEW — 1 spec covering all 11 items of prompt §40. |

---

## 2. Components and placement

### 2.1 `SessionAnalysisControl` — header slot, modal result

The button sits in the table header, immediately after `저장된 핸드 N`. That is where the
session-level facts already are, and prompt §26 asks for the smallest clear safe-boundary UI
rather than a session-management feature; there is no session-end workflow to integrate with.

The result opens as a **modal overlay** (`data-testid="analysis-overlay"`, `role="dialog"`)
rather than inside the right aside. The aside belongs to the hand being played — `StrategyPanel`
/ `PlayerProfilePanel` on top, `ActionHistory` filling the rest — and pushing a six-player
post-session report into it would squeeze the action log out of the one column that has to stay
readable during a hand. The overlay is opened by an explicit click only, so nothing about the
table's layout, the entry tray or the pinned action dock changes (`action-dock.spec.ts` still
passes untouched).

`결과 보기` reopens the last summary without re-running anything, so closing the overlay is not
a destructive act.

**Keyboard.** While the overlay is up it is modal in the same sense the card palette is
(ADR-0048): `TableRoot`'s own listener returns early for every key, `ActionDock` is given
`hotkeysSuppressed`, and the overlay's own listener owns `Esc`. Without this, `S` would sit the
selected seat out behind a dialog the user is reading. Asserted in `SessionAnalysisWiring.test.tsx`.

### 2.2 `PlayerModelPanel` — inside the overlay, opened from a summary row

Deliberately **not** an extension of the existing `PlayerProfilePanel`. That panel shows
testimony (a HUD reading the user typed, free-text notes); this one shows what the app computed
from raw history. ADR-0062a makes those permanently separate record types that are never merged
or averaged, so they are separate panels — merging them into one box is precisely the affordance
the ADR exists to prevent. The existing panel is untouched.

It is reached from `프로필 보기` on any summary row, so the player is picked from the run that
just described them.

---

## 3. Gating design (prompt §26)

### 3.1 One function

`sessionAnalysisGate({ phase, savesInFlight, running })` in `analysis-view.ts` is the only
decision, and the button's `disabled` attribute is its only consumer.

| Condition | Reason | Copy |
|---|---|---|
| a run this browser started is in flight | `RUNNING` | 분석 중입니다… |
| `phase` is anything but `null` / `COMPLETE` | `HAND_IN_PROGRESS` | 진행 중인 핸드가 끝나면 분석할 수 있습니다. |
| a completed hand's persist has not returned | `SAVE_IN_FLIGHT` | 핸드 저장이 끝나면 분석할 수 있습니다. |

`AWAITING_AWARD` is a **live** hand: the pot has not been given to anybody, so it is refused with
every other live phase. The reason is rendered as visible text next to the button as well as in
`title` — a disabled control with no stated reason reads as a broken app.

### 3.2 The save-in-flight boundary (an addition to the brief)

`useCompletedHandSaves` gained `savesInFlight`. It is the one behavioural addition outside the
brief's list, and the argument is the brief's own: completion persistence is deliberately
unawaited (ADR-0059c), so a run started in the window between "the hand reached COMPLETE" and
"the server acknowledged it" would compute over one fewer hand and then *report that number as
fact*. Blocking for the few ms it takes is cheaper than a summary that quietly understates the
session. The counter is state (the button renders from it), incremented exactly where `status`
becomes `IN_FLIGHT` and decremented in `.finally`, so a rejection cannot strand it above zero.

A save that **failed** does not block — a permanently failing save would otherwise lock the
button forever. It raises `analysis-unsaved-warning` inside the summary instead: the run happened,
and it says which hands were not in it.

### 3.3 Double-click

Client-side only, as WP C1-B §9.3 intends. `disabled` plus a `useRef` latch checked at the top of
the click handler (a `disabled` flag alone is one render behind a second click in the same tick).
A second *completed* run is safe by construction — it is a `NO_CHANGES` run — so the guard exists
to stop two summaries racing for one panel, not to protect the database.

---

## 4. Copy decisions (ADR-0053, Korean-first)

| Thing | Decision |
|---|---|
| Button | `세션 분석 및 반영`, verbatim from prompt §26. |
| Outcomes | `반영 완료` / `변경 없음` / `실패`, per §27. Colours modest: good / ink-500 / danger. An unchanged player is deliberately **not** green. |
| Run status | `완료` / `일부 실패` / `실패` / `분석할 핸드 없음`. |
| Disclaimer | The second sentence, `현재 기본전략 추천에는 아직 반영되지 않습니다.`, is a constant and is appended in **every** state. The first sentence is chosen from what actually happened — a `SUCCESS` run in which every player was already current says `새로 반영할 내용이 없어 플레이어 모델이 그대로 유지되었습니다.` rather than claiming an update, which is the exact overstatement §27 forbids. `SUCCESS` with at least one snapshot produces §27's sentence verbatim. |
| `NO_ELIGIBLE_HANDS` | Informational, no `role="alert"`, no player list: `이 세션에는 아직 완료된 핸드가 없습니다.` |
| Confidence | `미확인` / `학습중` / `파악됨`, with the English state (`UNKNOWN`/`LEARNING`/`KNOWN`) kept in a `title` **and** in `data-confidence` on the same element, so the stored vocabulary stays reachable and testable. |
| Stat and spot names | Kept verbatim (`VPIP`, `FOLD_TO_CBET_FLOP`, `BB_VS_BTN_OPEN`). They are the notation a Korean player reads directly — the same call `STRATEGY_FAMILY_LABEL` already makes — and they are the model's own keys, so nothing is lost between storage and screen. |
| Column headings in the summary | `Hands` / `Players` / `SHOW evidence`, exactly as prompt §27's mock-up prints them. |

---

## 5. Honest numbers (prompt §28)

- **The denominator is always on screen.** Every stat row renders `기회 N`, the raw
  `actions/opportunities` pair, and only then a percentage. Every spot effect renders
  `EFFECT n/N pct`. There is no rendering path that shows a percentage alone.
- **`UNKNOWN` is never a percentage.** `observedRateLabel` returns `—` for an `UNKNOWN`
  confidence state and for a zero denominator. The counts are still shown, so the dash never
  hides a number the user could have had.
- **Rounding is explicit.** `centiPercent(Math.round(rate * 10_000))` then
  `formatPercent(…, { maxDecimals: 0 })` — half away from zero, the same rule
  `observedRatePercent` and `Money`'s `'round'` mode use. Not `toFixed`, which under-reports
  every value it truncates (2/3 is 67%, not 66%).
- **Impossible pairs do not crash the panel.** `actions > opportunities` can only come from
  damaged storage; `centiPercent` would throw and React would blank the whole profile over one
  row. It returns `—` instead, with the counts still rendered beside it.
- **`position: null` is never summed with the positional rows** (ADR-0035). `overallStats` and
  `positionalStats` are two named, disjoint filters, and the two lists are rendered in two
  separate sections — the positional one behind a `<details>` whose own summary line says
  `전체 포지션 값과 합산하지 않습니다`. Asserted both in the pure test and in the DOM.
- **A `null` count is a dash, never a zero or a substitute.** `addedSinceLastSnapshot: null`
  (first snapshot) renders `—`, explicitly asserted *not* to render `totalHands`;
  `spotGroupCount` / `showCount` are `—` on a `변경 없음` row because that run did not recompute
  them (WP C1-B §6.2).
- **Failures are verbatim.** A `FAILED` player row prints the refusing layer's own `errorCode`
  and `errorMessage`; a failed run prints the service's own code and message.

---

## 6. Tests

### 6.1 `src/lib/table/analysis-view.test.ts` — 22

Gate (8): no hand enabled, `COMPLETE` enabled, all four live phases refused, save-in-flight
refused, run-in-flight refused, reason precedence, every reason has copy.
Disclaimer (6): §27's sentence verbatim; no update claimed when nothing changed; PARTIAL; FAILED;
`NO_ELIGIBLE_HANDS` is not a failure; the strategy sentence is present in all four statuses.
Rates (5): half-away-from-zero rounding, LEARNING shows a rate, UNKNOWN does not, no denominator,
impossible pair. Partitioning (2) and `topSpots` (2 — order, cap, and no mutation of the model's
own order). `countOrDash` (1).

### 6.2 `SessionAnalysisControl.test.tsx` — 16

Boundary (5): enabled between hands and after `COMPLETE`, disabled mid-hand with both the tooltip
and the visible reason, disabled while storing, and **no request fired at all** while disabled.
In-flight (1): three clicks → exactly one call, button disabled, `분석 중` shown, re-enabled after.
Summary (10): totals + per-player row; the §27 disclaimer verbatim; a first snapshot's `—`
increment (asserted not to be the total); a `변경 없음` row's `—`s and retained version; a
`PARTIAL` run's verbatim error with the healthy player still 반영 완료; `NO_ELIGIBLE_HANDS` with no
player list and no alert; a whole-run failure verbatim; the unsaved-hand warning; opening the model
panel from a row; `Esc` closes and `결과 보기` reopens without re-running.

### 6.3 `PlayerModelPanel.test.tsx` — 9

Headline (hands / version / last analysed / observations / SHOW); denominator beside every rate;
counts-but-no-percentage for `UNKNOWN` with `title="UNKNOWN"`; the positional row provably outside
the headline list; a spot's `기회 42` with per-effect `n/N pct` and no 0% row; a `LEARNING` bucket;
version history; no-snapshot is a state not an error; a refusal shown verbatim.

### 6.4 `SessionAnalysisWiring.test.tsx` — 5

Absent when the page passes no actions; present and enabled before the first deal; disabled the
moment a hand is dealt and enabled again when it completes (driven through the real store);
`S` cannot sit a seat out while the overlay is open, and can again once it closes; the session id
the page rendered with is what is sent.

### 6.5 `tests/e2e/session-analysis.spec.ts` — 1 spec, all 11 items of prompt §40

One session, because every step depends on the history the last one created.

| §40 | Covered by |
|---|---|
| 1 create session with named players | six named seats through the real setup form |
| 2 play a complete hand | hand 1, BTN RFI then folded out; `저장된 핸드 1` |
| 3 another hand with SHOW | hand 2 checked down heads-up, `award-show-3` + two palette cards |
| 4 history persists | `저장된 핸드 2`, no `hand-save-error` |
| 5 button at a safe boundary | disabled mid-hand **and** at `AWAITING_AWARD`; enabled with no reason text after |
| 6 click 세션 분석 및 반영 | real action, real service, real database |
| 7 success summary | Hands 2 / Players 6 / SHOW 1 / 완료, disclaimer asserted **verbatim** |
| 8 profile shows counts | `총 관찰 2`, v1, SHOW 1, `기회 …` on stats and spots |
| 9 re-click does not double | 변경 없음, still `2 hands`, `이번 추가 0`, still v1, exactly one version row |
| 10 Strategy Panel unchanged | the BTN-RFI recommendation captured before any analysis and re-read in a fresh session with the **same nicknames** (so the players now carrying snapshots are at the table) — `toEqual` on family, primary, hand class, RAISE frequency, sizing and stack bucket |
| 11 6 → 5 attribution | seat 5 sat out for hand 3: the five who played go to v2 / `3 hands` / `이번 추가 1`, and seat 5 is 변경 없음 / `2 hands` / v1, with one version row in its profile |

Runtime ≈ 2.4 s; the whole suite is 25 specs in under 8 s.

---

## 7. Residual risks

1. **`observationCount` is not surfaced.** The summary's run-level `observationCount` counts only
   the snapshots the run created (WP C1-B §9.1), so an all-`NO_CHANGES` run records zero. Showing
   it beside `Hands` would read as "this session had no observations". Per-player truth is in the
   model panel (`관찰 기회 합계`), which is where it is honest.
2. **Bet-size observations are not rendered.** `snapshot.betSizes` is loaded and unused. Prompt
   §28's minimum list does not include it and the panel is already dense; it is the obvious next
   addition if a user asks for sizing tendencies.
3. **The spot list is capped at 8** (most-observed first, ties by key). The model keeps every
   bucket; only the display is capped, and the heading states both numbers. There is no
   "show all" control yet.
4. **The profile is reachable only from a summary row**, not from a seat on the felt. A user who
   wants a model without running an analysis has no route to it. Deliberate for now: the model is
   a post-session artefact and the overlay is where it belongs; a seat-side entry point is a
   product decision, not a gap in this WP.
5. **The `savesInFlight` gate is best-effort against a page that is closed mid-save.** It cannot
   protect a hand whose persist never fired because the tab went away; that is ADR-0059's
   territory and unchanged here.
6. **The overlay is a plain `role="dialog"`, not a focus trap.** Tab can reach the table behind
   it. The keyboard shortcuts are fully suppressed, which is the hazard that mattered; full focus
   containment is a follow-up if the overlay grows.

---

## 8. User hands-on script (prompt §44)

1. `pnpm dev`, open `http://localhost:3210`, go to 새 세션.
2. Fill six seats with nicknames (e.g. 모카 / 감자 / 참외 / 대추 / 자두 / 유자), hero seat 1,
   button seat 1, start the session.
3. Note the header: `저장된 핸드 0`, and `세션 분석 및 반영` sitting beside it, enabled.
4. 핸드 시작. Observe the button greys out and reads `진행 중인 핸드가 끝나면 분석할 수 있습니다.`
5. Enter hero's two cards from the palette, then fold five times. `저장된 핸드 1`, button enabled again.
6. Play a second hand to showdown: fold down to two players, check every street, entering the
   flop / turn / river cards from the palette.
7. In 정산, press `오픈` on one opponent and enter their two cards; press `머크` on nobody else;
   pick the winner and submit. `저장된 핸드 2`.
8. Play a third hand with one seat sat out (press its `자리비움` chip, then 핸드 시작 — that seat
   shows 딜 제외), and fold it out. `저장된 핸드 3`.
9. Press `세션 분석 및 반영`.
10. Read the summary: Hands 3, Players 6, SHOW evidence 1, and the line
    `플레이어 모델이 업데이트되었습니다. 현재 기본전략 추천에는 아직 반영되지 않습니다.`
11. Press `프로필 보기` on the player who showed. Check 총 관찰 핸드, 모델 버전 v1, SHOW 증거 1,
    and that every stat row prints `기회 N` next to its percentage — and that a small sample shows
    `—` with `신뢰도 미확인` rather than a made-up percentage.
12. Press `프로필 보기` on the player who sat out: their 총 관찰 핸드 is **2**, not 3.
13. Press `Esc`, then `세션 분석 및 반영` again. Every row now reads `변경 없음`, 총 관찰 is
    unchanged (not doubled), 이번 추가 is 0, and the model version has not moved.
14. Press `Esc`, 핸드 시작, fold to the button and read 기본전략 · REFERENCE: the recommendation,
    its frequencies and its sizing are exactly what they were before any analysis ran.
