# WP-K FINAL — external HUD player profiles + 1% ADAPTIVE calibration

> **PARTLY SUPERSEDED (2026-09-03).** Three things this report describes were changed by the
> WP-K follow-up — read `EXTERNAL_ADAPTIVE_SANITY_FOLLOWUP.md` beside it. In short:
> `SIZE_WINNER_VALUE_UP` was REMOVED and `WSD` demoted to a secondary signal (ADR-0071);
> `FOLD_TO_CBET_LOW` and `CHECK_RAISE_HIGH` no longer read a VALUE hand and
> `FOLD_TO_CBET_LOW_VALUE_UP` was added, so the rule counts here (12 frequency / 5 sizing)
> are now 13 / 4 (ADR-0070); and the generic street fan-out now yields to any per-street
> reading with a real denominator (ADR-0072). Everything else below still holds.

Consolidates `EXTERNAL_ADAPTIVE_00_AUDIT.md` (decisions, written first),
`EXTERNAL_ADAPTIVE_PROFILE_IMPORT.md` (K1 — schema, import), `EXTERNAL_ADAPTIVE_MATH_CALIBRATION.md`
(K3 — 1% grid, sizing), `EXTERNAL_ADAPTIVE_KOREAN_REASON_UI.md` (K5 — UI/glossary), and
ADR-0067/0068/0069 (`docs/DECISIONS.md`). This is the single document to read for what
shipped, exactly.

## 1. What this WP is

Two goals, both delivered:

1. Bulk-import 13 real players' **lifetime** stats from an external HUD (screenshots) and
   have ADAPTIVE use them with real, honest confidence.
2. Sharpen ADAPTIVE's display grid from REFERENCE's 5% to 1%, extend sizing to read one
   more stat (`WSD`), and make the Korean "why" reasoning visible, not tooltip-only.

REFERENCE is byte-identical throughout (confirmed: `strategy-core`'s 783-test suite
passed unmodified at every stage). `strategy-core` gained zero knowledge of players or
GTO data; `poker-core`/`gto-core` were not touched at all.

## 2. Exact DB schema (K1)

Migration `packages/db/drizzle/0008_player_external_hud_snapshots.sql`, two new tables,
additive only — `player_hud_snapshots`/`_stats` (ADR-0046, 8-key manual HUD) untouched.

```sql
CREATE TABLE player_external_hud_snapshots (
  id            TEXT PRIMARY KEY,
  player_id     TEXT NOT NULL REFERENCES players(id),
  source        TEXT NOT NULL CHECK (source = 'EXTERNAL_HUD'),
  scope         TEXT NOT NULL CHECK (scope = 'LIFETIME'),
  reliability   TEXT NOT NULL CHECK (reliability = 'ESTABLISHED'),
  sample_n      INTEGER,                 -- always NULL; never defaulted or guessed
  recorded_at   INTEGER NOT NULL,
  import_batch_id TEXT NOT NULL
);

CREATE TABLE player_external_hud_snapshot_stats (
  snapshot_id           TEXT NOT NULL REFERENCES player_external_hud_snapshots(id),
  stat_key              TEXT NOT NULL CHECK (stat_key IN (
                           'VPIP','PFR','THREE_BET','FOLD_TO_THREE_BET','STEAL',
                           'CBET_ANY_STREET','FOLD_TO_CBET_ANY_STREET',
                           'CHECK_RAISE_ANY_STREET','WTSD','WSD'
                         )),
  entered_text          TEXT NOT NULL,   -- verbatim, CLAUDE.md rule 3
  value_centipercent    INTEGER NOT NULL,
  PRIMARY KEY (snapshot_id, stat_key)
);

-- 4 triggers forbidding UPDATE/DELETE on both tables (insert-only), hand-authored,
-- listed exhaustively in packages/db/tests/insert-only.test.ts's tripwire.
```

A stat the user's source did not report (`null` in the import JSON) writes **no row at
all** — never a stored `NULL`/`0` — so "we don't know" can never round-trip as "0%".

## 3. Source semantics

`EXTERNAL_HUD` is a third `AdaptiveStatSource` (`MANUAL_HUD` | `LEARNED_MODEL` |
`EXTERNAL_HUD`). Unlike a manual HUD entry (capped to 3333 bps confidence by
`manualHudSampleCap` regardless of what the user types, because it is a casual in-session
reading), an external profile is trusted at a **fixed policy confidence**,
`EXTERNAL_HUD_CONFIDENCE_BPS = 9000` — not derived from a sample size, because the true
`n` is genuinely unknown and never invented. `sampleN` is stored and echoed as `null`/`0`
everywhere and is never used to compute this confidence.

**Precedence**: when an `EXTERNAL_HUD` reading exists for a stat, it is used ALONE at
9000 bps, and `MANUAL_HUD`/`LEARNED_MODEL` are not pooled in for that stat. Every other
stat continues to pool exactly as WP-J did (ADR-0067).

## 4. All 13 imported values (`apps/web/scripts/fixtures/external-hud-2026-09.json`)

Percent, as reported by the source. `—` is a value the source never reported (`null` in
the JSON), stored as an absent row, never `0`.

| nickname | VPIP | PFR | 3-Bet | Fold to 3-Bet | C-Bet | Fold to C-Bet | Steal | Check/Raise | WTSD | WSD |
|---|---|---|---|---|---|---|---|---|---|---|
| Shadow7 | 29 | 20 | 10 | 61 | 67 | 26 | 44 | 7 | 30 | 53 |
| STORM88 | 21 | 16 | 7 | 63 | 65 | 38 | 34 | 8 | 25 | 60 |
| Ssallabd | 32 | 20 | 9 | 50 | 47 | 27 | 42 | 11 | **—** | **—** |
| Dre4mTe4m | 33 | 19 | 7 | 40 | 69 | 26 | 38 | 9 | **—** | **—** |
| 15shasha | 35 | 27 | 15 | 56 | 61 | 27 | 55 | 16 | 33 | 50 |
| Thestral4ik | 26 | 20 | 10 | 52 | 65 | 32 | 38 | 10 | 30 | 53 |
| Dennism97 | 29 | 20 | 11 | 38 | 48 | 36 | 38 | 13 | 30 | 48 |
| Pivovarich | 20 | 16 | 8 | 53 | 70 | 30 | 35 | 7 | 29 | 59 |
| acn1977 | 56 | 33 | 15 | 10 | 81 | 24 | 63 | 17 | 38 | 43 |
| AlmostAll | 22 | 17 | 9 | 56 | 61 | 32 | 36 | 7 | 26 | 57 |
| Xzappa59 | 29 | 22 | 9 | 66 | 63 | 33 | 48 | 9 | 27 | 57 |
| Superlove | 23 | 20 | 10 | 65 | 64 | 26 | 37 | 7 | 30 | 62 |
| vonKoren | 24 | 19 | 9 | 54 | 54 | 30 | 39 | 10 | 32 | 60 |

**Missing values: exactly 4** — Ssallabd and Dre4mTe4m's WTSD and WSD. Both remain
UNKNOWN through storage (no row), the composition layer (`available: false` on that
stat's estimate), and the UI (`알 수 없음`, never `0%`).

## 5. The 5% → 1% grid change, exactly

`quantizeFrequencies` (`strategy-core`) is now a 500-bps-pinned wrapper over
`quantizeFrequenciesToGrid(values, stepBps)`; every REFERENCE call site is unchanged.
`adaptive-core/policy/frequency.ts` sets `GRID_STEP_BPS = 100` and calls the same
apportionment logic at that step; `trimToCap`'s post-quantization safety net moves in
100-bps units (same termination proof, smaller step). The frequency arithmetic itself
(gain → confidence-scaling → per-rule cap → limiters → pro-rata transfer → normalize) is
**unchanged** — only the final rounding step and its trim moved. Log-odds/softmax
renormalization was considered (`prompt` §6, a "consider," not a mandate) and explicitly
NOT adopted: full rationale in ADR-0068.

## 6. Every heuristic coefficient added

| Constant | Value | File | Meaning |
|---|---|---|---|
| `EXTERNAL_HUD_CONFIDENCE_BPS` | 9000 | `priors.ts` | Fixed confidence for any `EXTERNAL_HUD` reading — a policy choice, not a statistical estimate |
| `CBET_ANY_STREET` prior | 5500 | `priors.ts` | Borrowed from the flop `CBET_FLOP` anchor (flop is the dominant c-bet street) |
| `FOLD_TO_CBET_ANY_STREET` prior | 4500 | `priors.ts` | Borrowed from the flop `FOLD_TO_CBET_FLOP` anchor, same reasoning |
| `CHECK_RAISE_ANY_STREET` prior | 800 | `priors.ts` | Borrowed from the flop `CHECK_RAISE_FLOP` anchor |
| `K` for all 3 new keys | 40 | `priors.ts` | Matches their per-street siblings' `K` |
| `ADAPTIVE_FREQUENCY_STEP_BPS` (`GRID_STEP_BPS`) | 100 | `policy/frequency.ts` | ADAPTIVE's own display grid, independent of REFERENCE's 500 |
| `SIZE_WINNER_VALUE_UP` | stat `WSD`, `ABOVE_PRIOR`, `VALUE_ONLY`, steps `+1` | `policy/sizingModel.ts` | 5th sizing rule — reads the one previously-unused stat the prompt named |

Every one of these is tagged `HEURISTIC` with a mandatory authored note (never presented
as GTO or solver output), enforced by `invariants.test.ts`'s "every rule explains itself"
sweep, which also asserts no rule's note contains "GTO" or "solver".

## 7. Worked examples — Shadow7 vs acn1977

Golden fixtures: `packages/adaptive-core/src/externalProfileFixtures.ts` +
`externalProfile.golden.test.ts`, 8 named spots × 2 players, every value read from a live
`composeAdaptive` run (not hand-derived) and pinned as a permanent regression.

**Flop, hero has a strong value hand (CHECK 40% / BET 60% baseline):**

- **Shadow7** (Fold-to-CBet 26%, WTSD 30%, WSD 53%, Check/Raise 7%): `FOLD_TO_CBET_LOW`,
  `WTSD_HIGH_VALUE_UP`, `SIZE_STATION_VALUE_UP`, `SIZE_STATION_VALUE_UP_FOLD`,
  `SIZE_WINNER_VALUE_UP` all fire → **CHECK 46% / BET 54%**, sizing held at rung 4 (two
  agreeing station rules + the new WSD rule collapse to one already-optimal rung).
- **acn1977** (Fold-to-CBet 24%, WTSD 38%, Check/Raise 17% — a much wider, stickier,
  more check-raise-happy player): the same family fires **plus `CHECK_RAISE_HIGH`** →
  **CHECK 51% / BET 49%**, and the total shift is nearly double Shadow7's (1100 bps vs
  600 bps) — the extreme profile visibly moves ADAPTIVE further.

**Preflop, hero facing an open (FOLD 40% / CALL 30% / RAISE 30% baseline):**

- **Shadow7** (Fold-to-3-Bet 61%, above the anchor): `FOLD_TO_3BET_HIGH` fires — hero
  3-bets MORE: **FOLD 39% / CALL 29% / RAISE 32%**.
- **acn1977** (Fold-to-3-Bet only 10%, well below the anchor): `FOLD_TO_3BET_LOW`
  fires — hero 3-bets LESS, calls more: **FOLD 45% / CALL 33% / RAISE 22%** — the
  opposite direction, from the same baseline, because the underlying read is opposite.

**Audit finding (the test `prompt` §11 itself asks for):** the two profiles produce a
different ADAPTIVE output in every one of the 8 spots. The one spot that comes closest
(steal/blind defense) still diverges, because both players also satisfy the generic
`PREFLOP_HERO_OPENING` scope there and their `THREE_BET` values differ — but the
STEAL-SPECIFIC rule (`FOLD_BB_TO_STEAL_HIGH`) never fires for either, a genuine,
documented limitation (§10 below).

## 8. Sizing reason examples

`SIZE_WINNER_VALUE_UP` firing for Shadow7 on the flop (see `sizingModel.ts`'s own note,
shown verbatim in the UI): *"WTSD says an opponent reaches showdown often; WSD says what
happens once they get there. A player who also WINS more of those showdowns than the
anchor is one who is not just curious — they tend to actually have it, which means a
genuine value hand should be sized up to collect from a range that is stronger on average
than the baseline assumes."* Collapses to one rung with the two `SIZE_STATION_VALUE_UP*`
rules via `MAX_SIZING_BUCKET_DELTA` when more than one fires — exactly what happens in
Shadow7's flop-value spot above (three value-sizing rules agree, net rung unchanged from
the engine's own 75%-pot pick).

## 9. Korean explanation examples

`PlayerProfilePanel`'s "외부 HUD (전체 기간)" section, for Shadow7: `VPIP 29% (프리플랍에
자발적으로 돈을 넣은 비율)`, `WTSD 30% (플랍을 본 뒤 쇼다운까지 간 비율)`, `WSD 53%
(쇼다운까지 갔을 때 이긴 비율)` — every one of `prompt` §9's 10 terms, inline, not
tooltip-only.

`StrategyPanel`'s reason list, per rule, now shows a visible second line reusing
`ADAPTIVE_RULE_LABEL` (already phrased as "관찰 → 반영"), e.g. under
`FOLD_TO_CBET_HIGH`: *"→ CBET 폴드 높음 → 공격 빈도 증가"*, alongside the existing
data line (opponent name, stat label, value, `n=`, confidence, reason label, any cap).

## 10. Tests

- `packages/adaptive-core`: 128 tests (was 106) — new `SIZE_WINNER_VALUE_UP` rule
  coverage, `EXTERNAL_HUD` precedence tests, the 8-spot × 2-player golden fixture suite
  (18 tests) plus a 20-key estimate-availability check.
- `packages/db`: 157 tests (was 151) — 4 new insert-only triggers, 2 new tables in the
  migration/schema tripwires, 7 external-HUD repository tests.
- `packages/player-core`: 191 tests (was 174) — `externalHud.ts` domain module, 21 tests.
- `packages/strategy-core`: 783 tests, **unchanged** — REFERENCE byte-identical.
- `apps/web`: 478 passed / 3 skipped (was 467/3) — import service, adaptive-service
  mapping (including the generic-to-per-street fan-out), `PlayerProfilePanel`/
  `StrategyPanel` UI, and every pinned-grid literal migrated from 500 bps to 100 bps with
  its real, freshly-computed value (never guessed).
- `pnpm e2e`: 30/30 Playwright tests, including the re-tuned `adaptive-strategy.spec.ts`
  mid-hand HUD edit test (its original 90%/500-hand fixture crossed ADAPTIVE's finer 1%
  threshold and started moving the mix; re-tuned to 70%/14-hand, which still clears the
  frequency confidence gate — so the reading is genuinely considered and shown — while its
  contribution still rounds away on the new grid).

No existing test was deleted or weakened; every changed assertion is a grid-size or
fixture-magnitude migration, each new literal read from a live run of the actual pipeline.

## 11. Performance

No new runtime cost on the action path: the composition pipeline is unchanged integer
arithmetic over the same handful of arrays; the only added work is one more DB read per
opponent load (`latestExternalProfileForPlayer`, already indexed the same way
`latestHudSnapshotForPlayer` is) and a constant-size observation list per profile (up to
20 rows instead of 17). `pnpm build` and the full `pnpm e2e` suite completed in the same
order of magnitude as the WP-J baseline.

## 12. Limitations (recorded, none silent)

- **`STEAL` never drives a rule.** The external HUD reports how often THIS player opens
  from a steal position; the rule that reads blind defense
  (`FOLD_BB_TO_STEAL_HIGH`) needs how often the BIG BLIND folds to one — a different
  seat's stat this source does not measure at all. `VPIP`/`PFR` are imported, stored and
  displayed but likewise drive no frequency/sizing rule today — a pre-existing WP-J
  property, not introduced by WP-K.
- **The generic-to-per-street fan-out (ADR-0067(e))** applies one number uniformly to
  `FLOP`/`TURN`/`RIVER` for `CBET`/`FOLD_TO_CBET`/`CHECK_RAISE`, because the source
  reports no street breakdown. If a future source ever reports real per-street values,
  the fan-out should be replaced by the real reading, not layered under it.
- **`adaptive_strategy_traces` does not yet persist which `EXTERNAL_HUD` snapshot informed
  a decision** — only manual-HUD and learned-model snapshot ids are columns on that
  table. A deliberate scope decision to stay inside WP-K's approved plan.
- All WP-J limitations (`docs/reports/HARDENING_WP_J_ADAPTIVE_PLAYER_STRATEGY.md` §13,
  restated in `docs/STATE.md`) still apply unchanged.

## 13. The exact import command

```
pnpm players:import-external apps/web/scripts/fixtures/external-hud-2026-09.json
```

Never runs automatically; the user invokes it by hand. Exact-nickname reuse (never a
duplicate player), insert-only (`ALREADY_PERSISTED`/`NEW_SNAPSHOT`/`NEW_PLAYER` reported
per player), prints an audit table, exits non-zero if any row fails. Verified end-to-end
against a scratch database during K1 development (not the user's live one).

## 14. Final verification

- `pnpm verify` (typecheck + test + lint + lint:licences + build) — **pass, exit 0**.
- `pnpm test` — **139 files / 1 skipped, 2363 passed / 3 skipped**.
- `pnpm e2e` — **30/30 Playwright tests passed**.
- `CLAUDE.md` and `prompt` — not modified by this work.
- No commit made.
