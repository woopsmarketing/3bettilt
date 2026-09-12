# WP J-E2 — 상대 적응 · ADAPTIVE, the UI

2026-09-02. Consumer-only work package: the domain (`packages/adaptive-core`), the persistence
(`packages/db`) and the seam (`apps/web/src/lib/table/{strategy,adaptive,contract}.ts`) were
already finished and green, and nothing below modifies any of them.

Built against `docs/reports/HARDENING_WP_J_DESIGN.md` §6 (live edit) and §8 (UI).

---

## 1. Files

### Created

| file | what it is |
| --- | --- |
| `apps/web/src/lib/table/adaptiveStore.ts` | The zustand store holding `Record<playerId, AdaptiveOpponentInputWire>` + an integer `version`, with `replaceInputs` / `upsertInput` and the seat-ordered `adaptiveOpponentList` selector. Holds no poker state, makes no request, writes nothing. |
| `apps/web/src/lib/table/adaptiveStore.test.ts` | 9 tests. |
| `docs/reports/HARDENING_WP_J_E2_ADAPTIVE_UI.md` | this file |

### Changed

| file | change |
| --- | --- |
| `apps/web/src/lib/table/copy.ts` | Six new exhaustive `Readonly<Record<Enum, string>>` maps + `ADAPTIVE_ENGINE_LABEL` + four formatters. |
| `apps/web/src/components/table/StrategyPanel.tsx` | Mode selector, the ADAPTIVE `useMemo`, the whole `AdaptiveSection` render. The REFERENCE effect is byte-for-byte unchanged. |
| `apps/web/src/components/table/TableRoot.tsx` | `loadAdaptiveInputs` prop, per-mount adaptive store, the lineup loader, the one-player refresh, the wrapped `saveHudSnapshot`. |
| `apps/web/src/components/table/PlayerProfilePanel.tsx` | `EDITABLE_HUD_KEYS` 4 → all 8, driven off `HUD_STAT_KEYS`; hand-sample note. |
| `apps/web/src/app/table/[sessionId]/page.tsx` | passes `loadAdaptiveInputsAction` down as a prop. |
| `apps/web/src/components/table/StrategyPanel.test.tsx` | +6 tests (new `상대 적응 · ADAPTIVE` describe block). |
| `apps/web/src/components/table/TableRoot.test.tsx` | +4 tests (loading / live refresh / degraded paths). |
| `apps/web/src/components/table/PlayerProfilePanel.test.tsx` | +2 tests (all 8 keys; the sample note). |

Nothing under `packages/**`, nothing under `apps/web/src/server/**`, and none of
`lib/table/{strategy,adaptive,contract}.ts` was touched. No deviation from the contract was
needed, so nothing had to be escalated.

---

## 2. The rendered states, with their exact Korean copy

The panel heading and the two-button selector are rendered in EVERY state, including `REFUSED`
and `NO_HAND`:

```
[ 기본전략 · REFERENCE ]  [ 상대 적응 · ADAPTIVE ]
```

`data-testid="strategy-mode-REFERENCE"` / `-ADAPTIVE`, `data-active="true|false"`,
`aria-pressed`. Default REFERENCE, local `useState`, `data-mode` on the panel root.
In ADAPTIVE mode `strategy-engine-label` reads `상대 적응 · ADAPTIVE`; in REFERENCE mode it is
unchanged at `기본전략 · REFERENCE` (the existing E2E assertion still holds).

In ADAPTIVE mode the block is rendered ABOVE the untouched REFERENCE body, never instead of it,
so switching mode can never blank the panel or hide the engine's own answer. The two use
disjoint test ids (`adaptive-*` vs `strategy-*`).

### (a) `status: 'ADAPTED'`, `changedFromBaseline: true` — `data-status="ADAPTED" data-changed="true"`

```
상대 적응 · ADAPTIVE   (상대: Player 1)                       [상대 반영됨]
BET 60%  ·  33% POT · 2.153 BB
기본전략 · REFERENCE  BET 50% · 33% POT · 2.153 BB  (기본전략 추천: CHECK)
상대 반영  BET +10%  ·  사이즈 변화 없음
  CHECK  40%  -10%
  BET    60%  +10%
이유
 • Player 1 플랍 CBET에 폴드 78% (n=200, 신뢰도 83%) · 기준보다 자주 폴드 · 규칙 상한 적용
전체 이동 1,000bps / 상한 2,000bps
근거 휴리스틱 (HEURISTIC) · 정책 <policyVersion>
```

The badge is `상대 반영됨` and it is keyed on **`changedFromBaseline`**, never `status`.
The baseline row shows the SAME action kind as the adapted primary (§8's shape); when the
adaptation also moved which action is PRIMARY, REFERENCE's own top action is named beside it
(`기본전략 추천: CHECK`) instead of being quietly dropped. A sizing clamp, when the engine's legal
window overrode the moved rung, renders as `최소 레이즈로 올림, 규칙값 <BB>` (`CLAUDE.md` rule 3).

### (b) `status: 'INSUFFICIENT_DATA'` — `data-status="INSUFFICIENT_DATA" data-changed="false"`

```
상대 적응 · ADAPTIVE   (상대: Player 1)
데이터 부족 — REFERENCE 사용 중
(사유: 표본이 신뢰도 기준 25%에 못 미침, 사이즈 조정에는 신뢰도 50% 이상이 필요)
근거 휴리스틱 (HEURISTIC) · 정책 <policyVersion>
```

No `adaptive-primary`, no `adaptive-delta`, no `adaptive-actions`, no `adaptive-reasons`, no
`adaptive-shift` element exists in the DOM. **No adaptive number is fabricated**; the REFERENCE
rows below are the whole answer. The gate threshold in the sentence is the note's own `detail`
token, interpolated by `adaptiveNoteLabel`.

### (c) `status: 'ADAPTED'`, `changedFromBaseline: false` — `data-status="ADAPTED" data-changed="false"`

```
상대 적응 · ADAPTIVE   (상대: Player 6)
조정 없음 — 뒤에 공격적인 상대가 남아 있음 (플랍 체크레이즈)
이유
 • Player 6 플랍 CBET에 폴드 78% (n=200, 신뢰도 83%) · 기준보다 자주 폴드 · 뒤에 공격적인 상대가 남아 있음
전체 이동 0bps / 상한 1,000bps
근거 휴리스틱 (HEURISTIC) · 정책 <policyVersion>
```

No badge, no primary line, no delta row, no `+0%` dressed up as an adaptation. The reasoning is
still shown, with the limiter that held it (`data-capped-by="AGGRESSIVE_PLAYER_BEHIND"`).
The multiway cap (`1,000bps`) is read from `maxTotalShiftBpsFor(activeOpponentCount)`.

### (d) `computeAdaptive === null` — `data-status="NONE" data-changed="false"`

```
상대 적응 · ADAPTIVE
이 상황에는 상대 적응을 적용하지 않습니다 — 기본전략 · REFERENCE만 표시합니다.
```

Reached for `NO_HAND`, for a REFUSED spot, and for a preflop line the REFERENCE engine itself
disclaims (`UNSUPPORTED`). It is **not** an error state and carries no error styling; the
engine's own refusal code and message still render beneath it, verbatim, exactly as before.

### Never GTO

`provenance` is rendered in every non-null state as `근거 휴리스틱 (HEURISTIC)`. Three tests assert
the panel's whole `textContent` never contains `GTO`.

---

## 3. Copy — `apps/web/src/lib/table/copy.ts`

Six exhaustive maps, each typed against a union `@gto-self/adaptive-core` owns, so a new member
is a compile error rather than an English token at the table:

`ADAPTIVE_STAT_LABEL` (17 `AdaptiveStatKey`), `ADAPTIVE_REASON_LABEL` (11 `AdaptiveReasonKey`),
`ADAPTIVE_RULE_LABEL` (16 `AdaptiveRuleId` — 12 frequency + 4 sizing),
`ADAPTIVE_CAP_LABEL` (6 `AdaptiveCapId`), `ADAPTIVE_STATUS_LABEL` (2 `AdaptiveStatus`),
`ADAPTIVE_NOTE_LABEL` (10 `AdaptiveNoteCode`), plus `ADAPTIVE_SOURCE_LABEL`
(2 `AdaptiveStatSource`) beside them.

Plus `ADAPTIVE_ENGINE_LABEL = '상대 적응 · ADAPTIVE'`, `adaptiveNoteLabel(note)` (folds a note's
stable `detail` token into its sentence, per code), and four formatters: `bpsPercentLabel`,
`signedBpsPercentLabel`, `bpsAmountLabel` (`1,850bps`, locale-independent by construction) and
`sizingStepLabel`.

Every import from `@gto-self/adaptive-core` in this file is `import type`, so the copy module
gains no runtime edge to the composition layer.

---

## 4. Loading and live refresh (§6)

- `TableRoot` takes `loadAdaptiveInputs?: LoadAdaptiveInputsAction` as a **prop**, exactly like
  `loadPlayerProfile` / `saveHudSnapshot`; `page.tsx` passes the server action down. No client
  component imports a `'use server'` module.
- The adaptive store is created **per mount** (`useRef`), for the same reason `TableStoreProvider`
  gives: a module singleton would be shared across every table the process ever rendered.
- The lineup effect asks about every occupied seat **except hero's**, keyed on the lineup
  identity string, so a new `table` object that seated the same people (every `startHand`) re-reads
  nothing.
- **Stale-response guard:** a monotonic `adaptiveRequest` ref; a resolution whose token is no
  longer current is dropped.
- **HUD save:** `saveHudSnapshot` is wrapped in `TableRoot`, not inside `PlayerProfilePanel`
  (which therefore still knows nothing about ADAPTIVE). On `ok`, the loader is called again for
  that ONE player and the result is `upsertInput`ed — the server owns both mapping tables and the
  `MANUAL_HUD_MAX_EFFECTIVE_N` clamp, so nothing is re-derived client-side. The wrapper returns
  the action's own result untouched.
- **Failure is quiet and degraded:** a rejected promise and an `{ok:false}` both empty the store;
  ADAPTIVE then reports `INSUFFICIENT_DATA`. No banner, no throw, no retry loop, nothing blocking.

---

## 5. How "REFERENCE is not recomputed" is proven

Structurally:

- The REFERENCE `useEffect` is **unchanged** — same `setTimeout(0)` body, same
  `[hand, heroSeat, compute]` dependency list, same `clearTimeout` cleanup. Its dependencies
  contain no opponent data and no mode.
- ADAPTIVE is a `useMemo` over `[computed, opponentInputs, adaptiveVersion]`. Its dependencies
  contain no `HandState` beyond the one already analysed, and it calls `computeAdaptive`, which
  takes the REFERENCE result **as a value**.
- `mode` appears in neither list, so switching what is displayed recomputes nothing at all.

By test (`StrategyPanel.test.tsx`, the injected `compute` prop counted across the change):

- `switches to the adapted numbers and back to REFERENCE, recomputing neither` — two mode
  switches, `expect(compute).toHaveBeenCalledTimes(1)`, and `referenceRows()` deep-equal before
  and after.
- `recomputes ADAPTIVE on a HUD save and does NOT recompute REFERENCE` (design contract §10 row 6,
  the J6 acceptance test) — the panel starts at `INSUFFICIENT_DATA`, a real `upsertInput` lands
  mid-hand, every ADAPTIVE row changes to the independently-computed adapted numbers, the store's
  `version` goes 1 → 2, and `compute` is still at 1 — both immediately and after the scheduler
  has been given a task to run in.

---

## 6. Tests

| suite | tests | new |
| --- | --- | --- |
| `apps/web/src/lib/table/adaptiveStore.test.ts` | 9 | 9 |
| `apps/web/src/components/table/StrategyPanel.test.tsx` | 18 | 6 |
| `apps/web/src/components/table/TableRoot.test.tsx` | 49 | 4 |
| `apps/web/src/components/table/PlayerProfilePanel.test.tsx` | 6 | 2 |

**21 new tests.** Every one of the six required rows is covered: mode switch both ways; the J6
"HUD save recomputes ADAPTIVE, not REFERENCE"; `INSUFFICIENT_DATA` with no fabricated number;
`ADAPTED`-but-unchanged rendered as `조정 없음`; `computeAdaptive === null` as REFERENCE-only with
no error UI; all 8 HUD keys rendered and submitted.

No `AdaptiveRecommendation` is hand-written anywhere. Every ADAPTIVE fixture is a hand the poker
engine actually produced, driven through the real store, with the expected recommendation
recomputed independently by `computeAdaptive` from the same inputs — the file's existing
"never a hand-written model literal" rule, extended to the new layer. The `ADAPTED`-but-unchanged
state is produced by the real §9 guard rail (a three-way flop: CO is PRIMARY and folds too much,
BTN is BEHIND and check-raises), not by an injected stub.

### Verification

```
pnpm vitest run --project web   ->  31 files passed, 1 skipped; 462 passed, 3 skipped
npx tsc --noEmit -p apps/web    ->  clean
pnpm lint (eslint .)            ->  clean, repo-wide, 0 errors 0 warnings
```

Nothing outside this work package is red.

---

## 7. Deviations

1. **The `AdaptiveSection` renders above the REFERENCE body rather than replacing it.** §8 shows
   the ADAPTIVE block alone; the panel keeps the full REFERENCE body beneath it in every ADAPTIVE
   state. The design contract requires the REFERENCE rows to be shown for `INSUFFICIENT_DATA`, and
   showing them in all four states is both more honest and simpler than a conditional. Test ids are
   disjoint, so nothing is ambiguous.
2. **The baseline row names the adapted primary's kind, not `baseline.primaryKind`.** §8's example
   has them equal (`BET 75%` / `기본전략 BET 55%`). When they differ, the adapted primary's baseline
   frequency is what makes the delta row readable, so that is the row shown — and REFERENCE's own
   primary is named beside it (`기본전략 추천: CHECK`) rather than dropped.
3. **`adaptiveVersion` is a redundant `useMemo` dependency today**, because both store mutators
   replace the map object. It is kept because the design contract names it and because it is what
   keeps the memo honest if the store ever gains an in-place edit; it carries one
   `eslint-disable-next-line react-hooks/exhaustive-deps` with that reason written above it. This is
   the only lint suppression added.
4. **`prettier --check` still flags `copy.ts`, `StrategyPanel.tsx`, `StrategyPanel.test.tsx` and
   `TableRoot.tsx`.** The first three were already unformatted at `HEAD` and `TableRoot.tsx` carries
   another agent's in-flight edits, so they were deliberately not reformatted (repo-wide formatting
   is known to mangle unrelated drift). Only the two brand-new files were formatted. `format:check`
   is not part of `pnpm verify`.

---

## 8. Remaining risk

- **A HUD-save upsert can be overwritten by a lineup load that was already in flight.** The token
  guard orders concurrent *lineup* loads against each other, but a lineup read that started before
  the HUD write and resolves after it would replace the map with the pre-save row. It needs a seat
  change and a HUD save inside the same round trip; the recovery is the next lineup change or the
  next HUD save. Fixing it properly means merging by `playerId` with a per-player sequence, which
  is more machinery than the race warrants today.
- **`HudStatKey` still models only 8 of the 17 `AdaptiveStatKey` members.** The other nine can only
  ever arrive from the learned model. Widening it is a 12-step SQLite table rebuild of an
  insert-only table (ADR-0046) and is out of scope; recorded in the design contract §2.3.
- **No E2E covers the mode switch yet.** The design contract assigns that to WP J-F. The four
  component-level paths (switch, HUD save, degraded load, refusal) are covered by unit tests.
- **`StrategyPanel` now imports `maxTotalShiftBpsFor` from `@gto-self/adaptive-core` at runtime.**
  That is the display cap on the 전체 이동 line. It is a pure integer function in a React-free
  package and `apps/web` may import everything, so no layering rule is affected — but it does mean
  the panel reads one policy constant directly rather than off the recommendation. If
  `AdaptiveRecommendation` ever carries the cap it applied, the panel should read it from there.
