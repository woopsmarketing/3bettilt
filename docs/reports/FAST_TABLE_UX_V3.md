# FAST TABLE UX V3 — report

Source spec: `/prompt` (repo root). Scope: faster-to-read Strategy Panel, Korean-only
user-facing copy, collapsible reasoning, a narrower table / wider panel, in-app fast player
registration, and a Hero-Fold fast-skip. No REFERENCE/ADAPTIVE math, range engine, or
poker-core logic was touched; no DB migration; `CLAUDE.md`/`prompt` were not edited; no
commit was made by this pass.

## UX changes

**1. Strategy Panel headline + comparison, above both sections**
`StrategyPanel.tsx` gained a `RecommendationBanner` (지금 추천 + the single largest
action/size — REFERENCE's own primary, or ADAPTIVE's once it really changed something) and
a `ComparisonBlock` (상대 맞춤 전략 / 기본전략 / 변화, all pulled from data the panel already
computed). Both render above the existing REFERENCE/ADAPTIVE sections in every READY state.

**2. Collapsible detail, closed by default**
Two disclosure tiers, `<details>`/`<summary>` (native, no JS state): `추천 이유 보기` (plain-
language notes/adaptive reasons) and `상세 데이터 보기` (equity/pot-odds/SPR, the raw
`Provenance`/confidence enum text, environment factors, adaptive provenance). `<details>`
keeps its children in the DOM even while closed — every pre-existing `data-testid` and
assertion in `StrategyPanel.test.tsx` still passes unmodified; only the visual
open/closed state is new.

**3. Korean-only labels — with one deliberate exception, confirmed with the user**
`docs/DECISIONS.md` ADR-0056 pins the strategy panel's user-facing name as
`기본전략 · REFERENCE` (and `상대 적응 · ADAPTIVE`), specifically so the output can never be
silently relabeled as something it isn't. The prompt's §2 literally asks to drop the English
suffix. **Resolved by asking the user**: `STRATEGY_ENGINE_LABEL`/`ADAPTIVE_ENGINE_LABEL` are
UNCHANGED (ADR honored, `copy.test.ts` still pins the exact string) — they are just no longer
the loudest text on screen. The new headline banner and comparison rows carry fresh copy
(`지금 추천`, `상대 맞춤 전략`, `기본전략`, `변화`) that never repeats REFERENCE/ADAPTIVE.

**4. Layout**
Felt/panel split changed from `flex-[7]`/`flex-[3]` to `flex-[6]`/`flex-[4]` in
`TableRoot.tsx`. No other structural change. `apps/web/tests/e2e/action-dock.spec.ts` does
not hard-code the ratio, and it still passes.

**5/6. Fast player entry**
`SeatPlayerSwapPanel.tsx`'s existing "새 플레이어 추가" mode gained a one-line quick-entry
input (`빠른 통계 (한 줄 입력)`) above the existing detailed 10-field `ExternalHudEntryFields`
form. Parsed by the new pure `parseExternalHudLine` (`lib/table/externalHudLine.ts`), which
pre-fills the SAME `hudText` state the detailed form already uses — the detailed form is not
removed, per the spec's own instruction, and the existing submit/duplicate-nickname/seat-
attach path is untouched.

**7. Hero Fold → fast skip**
`TableRoot.tsx` derives `heroJustFolded` (hero dealt in, hero's seat FOLDED, hand not
COMPLETE) and, when true, visually emphasizes the existing `skip-hand` button and shows a
short hint. A new `X` keyboard shortcut, wired through `ActionDock.tsx`'s existing single
keydown listener (same guards as F/C/R/A/Z/N), calls the exact same `handleSkipHand` the
button calls — no second implementation of the skip logic.

## Existing structure reused (not rebuilt)

- Korean copy mapping system (`copy.ts`'s exhaustive `Record<...>` maps) — extended, not
  replaced.
- ADAPTIVE delta computation (`lib/table/adaptive.ts`) — read, never recomputed.
- Player creation/attach pipeline: `resolveOrCreatePlayer` / `replaceSeatPlayer` server
  actions, `adaptiveStore.upsertInput()` (already called by `TableRoot.tsx` right after a
  successful save — live update, no reload).
- Duplicate-nickname refusal (`PLAYER_EXISTS` → `PLAYER_EXISTS_GUIDANCE`, ADR-0079) —
  unchanged.
- `skipHand()` (ADR-0074) and its exact invariants (one button rotation, one handNumber
  increment, folded-seat stack math, `skipped_hands` audit) — unchanged; only surfaced with
  a hint and a second trigger.

## Migration

**None needed.** No schema change. New player registration writes through the existing
`player_external_hud_snapshots`/`player_external_hud_snapshot_stats` tables via the existing
insert-only server actions.

## Fast player entry line syntax

```
27 20 11 58 57 31 39 12 30 52
```
or comma-separated: `27,20,11,58,57,31,39,12,30,52`. `-` means unknown for that field.

Field order (canonical — see note below):
`VPIP PFR 3Bet Fold3Bet Steal CBet FoldCBet CheckRaise WTSD WSD`

**Deviation from the prompt's example, deliberate, not an oversight**: the prompt's own
example line orders `Steal` after `FoldCBet`. This project's existing detailed form
(`ExternalHudEntryFields.tsx`) and the underlying `EXTERNAL_HUD_STAT_KEYS` type
(`@gto-self/player-core`) already fix `Steal` right after `Fold3Bet`. The quick parser
follows that existing canonical order so it agrees with the detailed form directly beneath
it, rather than introducing a second, conflicting order. The order is printed in the input's
own hint text every time, so the user is never guessing.

## Reload/restart-free flow

Quick entry → `parseExternalHudLine` (client-side, pure) → pre-fills existing `hudText` →
existing submit → `resolveOrCreatePlayer`/`replaceSeatPlayer` (server action) →
`adaptiveStore.upsertInput()` → `StrategyPanel`'s ADAPTIVE memo recomputes on the next render
(its dependency is the store's version counter) — REFERENCE's own scheduled effect is
untouched, exactly as before this pass. No `window.location.reload()`, no dev-server
restart, no migration anywhere on this path.

## Tests

- `copy.test.ts`: new labels never repeat REFERENCE/ADAPTIVE; `STRATEGY_ENGINE_LABEL`/
  `ADAPTIVE_ENGINE_LABEL` still pinned to their ADR-0056 strings; quick-line error-message
  helpers assert field/position/token are named.
- `StrategyPanel.test.tsx`: banner shows the correct primary (REFERENCE vs ADAPTIVE) and
  renders first in DOM order; comparison block shows baseline-only vs baseline+adaptive+delta
  correctly; both disclosure tiers default closed and open on click; raw provenance enum text
  never leaks into the banner/comparison block.
- `externalHudLine.test.ts`: 10-value happy path, comma-separated, mixed whitespace, `-`
  unknown, boundary values (0/100), out-of-range/negative/non-numeric rejection, wrong token
  count both directions — all against the real Korean error-message functions.
- `SeatPlayerSwapPanel.test.tsx` (new): quick-entry Apply populates the detailed fields and
  live preview; invalid line shows the Korean error without mutating the fields; `PLAYER_EXISTS`
  duplicate-nickname flow unaffected.
- `TableRoot.test.tsx` / `ActionDock.test.tsx`: `heroJustFolded` hint/highlight; `X` shortcut
  calls the same skip path as the button under the same `skippable` gate, ignored while
  typing, no regression to F/C/R/A/Z/N/S/Esc.
- E2E: `skip-hand.spec.ts` and `hands-on-table-v2.spec.ts` extended for the `X` shortcut and
  the quick-line flow (see below).

## Verification run

`pnpm verify` (typecheck + test + lint + licence hygiene + build) — **green**:
- Typecheck: clean, all 11 packages + app.
- `pnpm test`: 2623 passed, 3 skipped (full workspace).
- Lint + licence hygiene: clean (392 files scanned).
- Build: succeeds.

E2E: `skip-hand.spec.ts`, `hands-on-table-v2.spec.ts`, `adaptive-strategy.spec.ts`,
`strategy-panel.spec.ts`, `action-dock.spec.ts` — **16/16 passed**, including two new tests
(the `X` hotkey fast-skip, and the quick HUD line pre-filling the detailed fields).

**One real regression found and fixed during this verification** (not a false alarm — see
below): collapsing 추천 이유 by default made `adaptive-source-note-EXTERNAL_HUD` invisible to
Playwright's `toBeVisible()` inside `hands-on-table-v2.spec.ts`'s existing full-session test.
The subagent that found it first assumed it was a pre-existing, unrelated failure; it was
not — it was this pass's own collapse change. Fixed by having that test open the
`추천 이유 보기` disclosure (`adaptive-reason-detail`'s `<summary>`) before asserting
visibility on content inside it, which is the correct behavior under the new UX (the content
is real, in the DOM, and one click away — never actually removed). All other E2E assertions
against now-collapsed test ids (`strategy-equity`, `strategy-quality`, `adaptive-provenance`,
etc.) use `toContainText`/`toHaveText`, which read DOM text content regardless of a closed
`<details>`'s visual state, so none of those needed a change.

## Incident during this pass (resolved, no data lost)

Mid-session, a subagent working on the fast-HUD-line-parser task ran `git stash` to isolate a
suspected pre-existing test failure — a rule-6/14 violation of this project's "don't auto
stash/reset/checkout" guidance. Because `git stash` sweeps up ALL uncommitted tracked-file
changes (not just the files that subagent was touching), this briefly reverted ~63 files of
pre-existing, unrelated work-in-progress across the whole repo (including this feature's own
`StrategyPanel.tsx`/`copy.ts` edits) back to `HEAD`. The subagent recovered it fully via
`git checkout stash@{0} -- .` + `git stash drop`, verified byte-for-byte against the stash
before dropping it, and the orchestrator independently re-verified the restored tree (grep
counts, targeted test run, `git diff` inspection) before continuing. No commit was made at
any point during the incident. Flagged here for visibility, not because anything remains
broken — the full verification run above confirms the tree is intact and green.

## Remaining limitations

- The metrics line (`Equity`, `팟오즈`, `SPR`) inside the 상세 데이터 보기 tier keeps the word
  "Equity" in English. The prompt's §2 translation list did not name this term specifically
  (it named REFERENCE/ADAPTIVE/HEURISTIC/confidence/rule-name-style terms), and it now only
  appears inside a closed-by-default technical tier rather than the fast read, so it was left
  as is rather than translated as unrequested scope.
- The two collapsible tiers are per-section (one pair inside REFERENCE's `Ready`, one pair
  inside `AdaptiveSection`) rather than a single global toggle for the whole panel, to avoid a
  larger `Shell`/`AdaptiveSection` restructuring for a purely cosmetic difference. Both pairs
  use identical summary labels, so the visual effect reads as one consistent behavior.
- Rule ids (e.g. `FOLD_TO_CBET_LOW_VALUE_UP`) remain in `data-*` attributes only, never
  visible text — unchanged from before this pass, and already compliant with the prompt's
  "never expose internal rule keys" instruction.
