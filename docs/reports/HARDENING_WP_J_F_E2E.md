# WP J-F — 상대 적응 · ADAPTIVE, the E2E spec

2026-09-02. Test-only work package. **No source file was modified** — nothing under
`packages/**`, nothing under `apps/web/src/**`, and no `data-testid` had to be added: the
`data-testid`s and `data-*` attributes WP J-E2 shipped were sufficient for every assertion
below.

---

## 1. File

| file | what it is |
| --- | --- |
| `apps/web/tests/e2e/adaptive-strategy.spec.ts` | **created.** 2 tests, ~230 lines including the header. Formatted with `prettier --write` (that file only). |

Nothing else in the repo changed.

---

## 2. The spot both tests drive, and why

One deterministic spot, reached identically by both tests through the existing
`startSession` helper:

- 6-handed, button seat 0, **hero seat 2 (BB)**, 100 BB stacks;
- hero's cards `Ah 5h` clicked out of the palette;
- UTG / HJ / CO fold from the keyboard, the **button opens to 2.5 BB** (`R`, typed, `Enter`),
  the small blind folds;
- hero is on the clock, the panel is `data-state="READY"`, `data-family="VS_OPEN"`.

The REFERENCE answer there is a full three-row mix — **FOLD 35 / CALL 35 / 3BET 30** — which
is what makes an adaptation *visible*: a mix can move in either direction and the primary can
change. It is the same spot `strategy-panel.spec.ts` already pins, so the baseline is
independently asserted elsewhere too.

Nicknames are prefixed per test (`JF1 …`, `JF2 …`) because `players.normalized_nickname` is
UNIQUE and a player is reused across sessions — two tests sharing a nickname would share a HUD
history, and `playwright.config.ts` runs `fullyParallel`.

---

## 3. What the spec covers

### Test 1 — `switches between REFERENCE and ADAPTIVE, and reports an unknown opponent as 데이터 부족`

Covers the brief's items **1 (mode switching)**, **2 (honest empty state)** and **5 (never GTO)**.

| assertion | selector |
| --- | --- |
| REFERENCE is the default | `strategy-panel[data-mode=REFERENCE]`, `strategy-mode-REFERENCE[data-active=true]`, `strategy-mode-ADAPTIVE[aria-pressed=false]` |
| …and ADAPTIVE renders nothing until asked | `adaptive-panel` `toHaveCount(0)` |
| the engine's own name | `strategy-engine-label` = `기본전략 · REFERENCE` |
| rendered content, not a class | `strategy-action-RAISE[data-percent=30]` |
| the switch lands | `data-mode=ADAPTIVE`, `strategy-engine-label` = `상대 적응 · ADAPTIVE`, `strategy-mode-ADAPTIVE[data-active=true]` |
| the honest empty state | `adaptive-panel[data-status=INSUFFICIENT_DATA][data-changed=false]`, `adaptive-status` = **`데이터 부족 — REFERENCE 사용 중`** (exact text) |
| the gate that was missed is named | `adaptive-status-reason` contains `신뢰도 기준 25%` (the policy's own `FREQUENCY_MIN_CONFIDENCE_BPS = 2500`) |
| **no fabricated number** | `adaptive-primary`, `adaptive-actions`, `adaptive-delta`, `adaptive-reasons`, `adaptive-shift`, `adaptive-changed-badge` each `toHaveCount(0)` — the elements are ABSENT, not zeroed |
| provenance is shown as itself | `adaptive-provenance` contains `근거 휴리스틱 (HEURISTIC)` |
| ADAPTIVE never blanks REFERENCE | `strategy-action-RAISE[data-percent=30]` still there in ADAPTIVE mode |
| the switch back | `data-mode=REFERENCE`, label back, `adaptive-panel` gone, all three REFERENCE rows still 35/35/30 |
| **`CLAUDE.md` rule 2** | `strategy-panel` `not.toContainText('GTO')`, asserted **three times** — REFERENCE, ADAPTIVE, and REFERENCE again |

### Test 2 — `a HUD reading saved mid-hand adapts the recommendation and leaves REFERENCE untouched`

Covers items **3 (the live-edit path, J6 acceptance)** and **4 (REFERENCE invariant)**, and
re-asserts **5**.

Flow, all inside one hand with no page reload:

1. capture the whole REFERENCE recommendation (`referenceRecommendation()`: the FOLD / CALL /
   RAISE `data-percent`s, the panel's `data-primary` and `data-family`, `strategy-hand-class`,
   `strategy-sizing`, `strategy-pot-odds`);
2. click `seat-0` → `right-panel[data-panel=PLAYER]`, and the villain has **no** reading
   (`profile-no-hud` visible);
3. type into `hud-input-FOLD_TO_THREE_BET` = `90` and `hud-input-handSample` = `500`, click
   `hud-save-button`;
4. the reading is read back out of SQLite: `profile-hud` contains `500핸드`,
   `FOLD_TO_THREE_BET` and the verbatim `90`;
5. `Escape` → `right-panel[data-panel=STRATEGY]`;
6. **`expect(await referenceRecommendation(page)).toEqual(before)`** — the invariant, seen
   from outside the app;
7. switch to ADAPTIVE and assert the adapted answer (table below);
8. switch back to REFERENCE and assert `toEqual(before)` a second time.

The adapted assertions:

| assertion | value |
| --- | --- |
| `adaptive-panel` | `data-status=ADAPTED`, `data-changed=true` |
| `adaptive-changed-badge` | `상대 반영됨` |
| the adaptation names the opponent | `adaptive-opponent` contains `JF2 Btn` |
| the reason cites rule, stat and the sample the user typed | `adaptive-reason-FOLD_TO_3BET_HIGH` with `data-stat=FOLD_TO_THREE_BET`, `data-sample=500`, and the nickname in its text |
| the adapted primary | `adaptive-primary[data-kind=RAISE]`, text contains `3BET 40%` |
| the adapted mix | `adaptive-action-RAISE` `data-percent=40` `data-delta=1000`; `-FOLD` and `-CALL` both `data-percent=30` `data-delta=-500` |
| the delta row | `adaptive-delta` contains `3BET +10%` |
| the shift against its cap | `adaptive-shift` = `전체 이동 1,000bps / 상한 2,000bps` |
| provenance / no GTO | as above |

**The numbers are asserted exactly, and they are the policy's own arithmetic**, derived in a
comment in the spec: `FOLD_TO_THREE_BET` at 90% over 500 hands against the 55% anchor with
`K = 40` gives `confidence = round(10000·500/540) = 9259` bps and `estimate = 8741` bps, a
deviation of 3241; `FOLD_TO_3BET_HIGH` scales it by its 4000 gain (1296) and by confidence
(1199) and is held at its own 1000-bps ceiling, so exactly 10 points move onto the aggressive
row, taken pro rata from FOLD and CALL. Total shift 1000 bps against the 2000-bps heads-up cap.
A deliberate policy change to a gain, ceiling, anchor or K is *expected* to fail this test —
it is the end-to-end record of what a user is shown for a named reading.

---

## 4. `data-testid`s used (all pre-existing)

`strategy-panel`, `strategy-engine-label`, `strategy-mode-REFERENCE` / `-ADAPTIVE`,
`strategy-action-{FOLD,CALL,RAISE}`, `strategy-hand-class`, `strategy-sizing`,
`strategy-pot-odds`, `adaptive-panel`, `adaptive-status`, `adaptive-status-reason`,
`adaptive-opponent`, `adaptive-changed-badge`, `adaptive-primary`, `adaptive-delta`,
`adaptive-actions`, `adaptive-action-{FOLD,CALL,RAISE}`, `adaptive-reasons`,
`adaptive-reason-FOLD_TO_3BET_HIGH`, `adaptive-shift`, `adaptive-provenance`,
`right-panel`, `seat-0`, `seat-2`, `player-profile` (via `profile-no-hud` / `profile-hud`),
`hud-input-FOLD_TO_THREE_BET`, `hud-input-handSample`, `hud-save-button`,
`start-hand`, `palette-*`, `raise-input`.

**Nothing was added to any component.** The only copy-coupled assertions are the deliberate
Korean-copy ones listed above, matching `strategy-panel.spec.ts`'s convention.

No `waitForTimeout` anywhere: every wait is an auto-retrying `expect` on a `data-*` attribute
or on text, including the wait for the post-save ADAPTIVE recomputation (`data-status` flips
`INSUFFICIENT_DATA → ADAPTED` when the refreshed opponent input lands in the store).

---

## 5. Runs

Each run used a freshly-built production server (`pnpm build` once) started on `:3211` with a
**fresh throwaway SQLite file per run**, and `playwright test` reusing it
(`reuseExistingServer`). The user's dev server on `:3210` was left alone.

| run | command | result |
| --- | --- | --- |
| 1 | `playwright test adaptive-strategy` | **2 passed** (1.1s) |
| 2 | `playwright test adaptive-strategy` | **2 passed** (1.0s) |
| 3 | `playwright test adaptive-strategy --repeat-each=3` | **6 passed** (1.3s) |
| 4 | after `prettier --write`, `playwright test adaptive-strategy` | **2 passed** (1.1s) |

**12 executions of the new spec, 12 green, 0 flakes.**

Also run on the new file: `npx eslint` (clean), `npx prettier --check` (clean after the
`--write`), `npx tsc --noEmit -p apps/web` (clean — `next build` typechecks the spec directory,
so a broken spec fails the build).

### Full suite, once

`playwright test` (whole `tests/e2e` directory, fresh DB): **28 passed, 2 failed**.

Both failures are **pre-existing and not caused by this spec** — see §6. Re-running just those
two files, with `adaptive-strategy.spec.ts` not in the run, reproduces both failures
identically.

---

## 6. BLOCKING FINDING — WP J-E2 broke two existing E2E specs (not this WP)

```
✘ tests/e2e/action-dock.spec.ts:24  plays a hand from the keyboard with no network request on the action path
✘ tests/e2e/card-palette.spec.ts:23 enters a complete hand: hole cards, three streets, settlement
```

Both fail on `expect(requests).toEqual([])` with exactly one captured entry:

```
POST http://127.0.0.1:3211/table/<sessionId>
```

I probed it with a throwaway spec (since deleted) that logs `postData`. The request body is:

```json
[[{"playerId":"…","seatIndex":1,"nickname":"TMP B"},{"playerId":"…","seatIndex":2,"nickname":"TMP C"}]]
```

That is **`loadAdaptiveInputsAction`, the ADAPTIVE lineup load**, fired once when `TableRoot`
mounts — measured to land **before `start-hand` is even clicked**, and never again during the
hand.

So the app is doing what WP J-E1/E2 designed (a lineup read on mount: "a click, not a
keypress", off the hot path — ADR-0043 is not violated by the *behaviour*). What broke is the
two specs' **assertion scope**: they attach `page.on('request')` the moment `startSession`
resolves and then assert a blanket zero, so a mount-time read now falls inside a window whose
own comment says it is about "the action path itself".

I did **not** touch either spec: relaxing an ADR-0043 assertion is a product/architecture
judgement, not something a test-writing WP should decide unilaterally (`CLAUDE.md` rules 8, 9
and 13). The orchestrator's options, in my order of preference:

1. **Attach the listener after the mount-time reads have settled** — keeps the assertion at
   full strength and matches what it says it tests. Needs a deterministic anchor; the honest
   one available today is `await page.waitForLoadState('networkidle')` before `page.on(...)`,
   since nothing in the DOM changes when an empty adaptive load resolves.
2. **Filter the captured list to the action path** (drop the single lineup POST by body or by
   ordinal) and assert the remainder is empty, with a comment naming why the exception exists.
3. Give `TableRoot` a settled marker for the adaptive load (e.g. `data-adaptive="LOADED"`) so
   option 1 has a real anchor — a source change, out of scope here.

Do **not** simply delete the assertions: they are the only automated proof that the action
path is local.

---

## 7. What I could NOT test deterministically, and why

1. **The `ADAPTED`-but-unchanged state (`조정 없음`).** Reaching it needs the §9 guard rail to
   fire: a PRIMARY villain who folds too much AND a *different* live opponent behind hero who
   check-raises above the anchor with confidence ≥ 25% — i.e. two players, two HUD saves, on a
   flop where hero may bet and both are still live. It is reachable through the UI, but the
   spot is several more keystrokes and a second profile edit, and its outcome depends on the
   REFERENCE flop mix for whatever board is entered. It is already covered by a real
   (non-stubbed) unit test in `StrategyPanel.test.tsx`. I judged a long, board-sensitive E2E
   script worse than the existing coverage; say the word and I will add it.
2. **A specific aggression band** (`bands: THIN_AND_AIR` / `VALUE_ONLY` rules, i.e. the whole
   WTSD family). The band comes out of the postflop engine's hand-strength read for the exact
   board entered; pinning one from the outside means choosing a board and asserting a band the
   spec does not control. That is the flaky-test shape the brief warned about, so I did not
   write it.
3. **Sizing adaptation.** Out of scope by policy preflop (`PREFLOP_SIZING_OUT_OF_SCOPE`), so it
   cannot be exercised from the deterministic spot this suite uses. It would need the flop
   scenario in (1).
4. **The learned-model source.** `LEARNED_MODEL` observations come from a post-session learning
   run, not from anything the table UI can produce inside one hand. Only the `MANUAL_HUD`
   source is exercised here.
5. **`--repeat-each` caveat (not a defect).** Under `--repeat-each`, copies of test 2 share the
   `JF2 Btn` player by nickname, so its `profile-no-hud` assertion is only guaranteed on a clean
   database — which `playwright.config.ts` gives every real run (a per-PID tmpdir DB). It passed
   3/3 under `--repeat-each=3` anyway.

---

## 8. Remaining risk

- The exact adapted numbers (40 / 30 / 30, `+1000` bps, `1,000bps / 2,000bps`) couple this spec
  to `ADAPTIVE_PRIORS.FOLD_TO_THREE_BET`, `ADAPTIVE_STAT_K.FOLD_TO_THREE_BET`,
  `FOLD_TO_3BET_HIGH`'s gain/ceiling and `MAX_TOTAL_SHIFT_BPS_HEADS_UP`. Deliberate: it is the
  only place the whole chain — typed reading → SQLite → server action → store → composition →
  rendered percent — is checked as one number. A policy tune must update this spec, and the
  derivation is written out in the spec header so the update is arithmetic, not guesswork.
- The REFERENCE invariant is asserted over the *rendered* recommendation. It cannot see a
  recomputation that produced the identical result; that stronger claim (the `compute` call
  count) is what `StrategyPanel.test.tsx` covers, and the two together are the full statement.
