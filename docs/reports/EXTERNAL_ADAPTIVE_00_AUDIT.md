# WP-K audit — external HUD player profiles + 1% ADAPTIVE calibration

Written before any ADAPTIVE math changed (K2/K3), per this WP's own working rule: every
later report cites the decisions here instead of re-arguing them. This audit assumes the
reader has `CLAUDE.md` and `docs/DECISIONS.md` ADR-0063..0066 (WP-J) in front of them.

## 1. What already existed (WP-J)

`packages/adaptive-core` composes REFERENCE (immutable, 5% grid) with what is known about
an opponent from two sources — `MANUAL_HUD` (a DB table capped at 8 of 17 stat keys by a
CHECK constraint, ADR-0046) and `LEARNED_MODEL` (player-core's post-hand learning) — pooled
by `n/(n+K)` shrinkage, gated by per-rule and total-shift confidence thresholds, and
quantized onto the REFERENCE engine's own 500-bps (5%) grid. `manualHudSampleCap` pins a
manual HUD reading to 3333 bps (33%) confidence regardless of the hand count typed, because
a manual entry is a casual reading (STATE.md's "Strategy C2" known-issues list).

The 13-player import in `prompt` is a **lifetime** read from a third-party HUD the user runs
outside this app — not a casual one — and reports 10 stat categories, 3 of which (Cont-Bet,
Fold-to-C-Bet, Check/Raise) are generic (no street breakdown), where WP-J's per-street keys
assume one. This WP is additive to WP-J: REFERENCE is untouched, the composition-layer
boundary stays, and WP-J's 12 frequency / 4 sizing rules, shrinkage formula and safety caps
are extended, not replaced.

## 2. Decisions locked in for K1 (implemented; see `EXTERNAL_ADAPTIVE_PROFILE_IMPORT.md`)

- **New source, `EXTERNAL_HUD`**, a sibling of `MANUAL_HUD` and `LEARNED_MODEL`, carried in
  a brand-new table pair (`player_external_hud_snapshots` / `_stats`) rather than a widened
  `player_hud_snapshots` — ADR-0046 (that table's CHECK-constrained 8 keys) is untouched.
- **`sampleN` stays `null` forever** for every row this WP writes. The source screenshots
  show a lifetime total, not a hand count, and one is never invented (CLAUDE.md rule 2).
  `null` here is a fact about what we don't know; it is not read anywhere as "don't trust
  this" — see §3.
- **The stat vocabulary is GENERIC where the source is generic.** `ExternalHudStatKey`
  (`packages/player-core/src/externalHud.ts`) has 10 members: 7 map 1:1 to existing
  `AdaptiveStatKey`s (`VPIP`, `PFR`, `THREE_BET`, `FOLD_TO_THREE_BET`, `STEAL`, `WTSD`,
  `WSD`); 3 (`CBET_ANY_STREET`, `FOLD_TO_CBET_ANY_STREET`, `CHECK_RAISE_ANY_STREET`) are
  deliberately NEW, distinct from `CBET_FLOP/TURN/RIVER` etc. — the source HUD reports one
  number with no street breakdown, and mapping it onto (say) `CBET_FLOP` would silently
  claim a street-specific fact nobody measured (this is the falsifying case `prompt` §3
  names explicitly: "don't map generic Check/Raise onto one street's key").
- **A stat the source did not report is an ABSENT row, never a stored `0` or `NULL`
  value-column.** Verified by `packages/player-core/src/externalHud.test.ts` and
  `packages/db/tests/external-hud.test.ts` (Ssallabd/Dre4mTe4m's missing WTSD/WSD).
- **Nickname matching is exact-normalized reuse**, never a duplicate player — the same
  `findPlayerByNormalizedNickname` WP-J's own manual HUD path already used.
- **Insert-only, DB-enforced**, identical discipline to `player_hud_snapshots`: two
  hand-authored triggers per table (`drizzle-kit` cannot emit one), and the exhaustive
  trigger-list tripwire in `packages/db/tests/insert-only.test.ts` was extended rather than
  bypassed.

## 3. Decisions for K2 (ADAPTIVE composition) — confirmed with the user before implementation

**Confidence.** `EXTERNAL_HUD` gets a fixed constant, `EXTERNAL_HUD_CONFIDENCE_BPS = 9000`
(90%), applied whenever an `EXTERNAL_HUD` observation exists for a stat — NOT run through
the `n/(n+K)` formula with an invented `n`. This is a stated POLICY CHOICE ("an established
lifetime read is trusted close to fully, but not treated as certain, because the true n is
unknown and drift is possible"), tagged `HEURISTIC` like every other number in
`adaptive-core`, never a statistical estimate. The alternative considered (a synthetic large
`n`, e.g. 500, run through the existing formula) was rejected: a placeholder `n` reads as a
real sample size to anyone inspecting a trace later, which is closer to "inventing sampleN"
than `CLAUDE.md` rule 2 allows — a named constant is honest about being a policy choice, a
fabricated sample size is not.

**Precedence over pooling.** When a player has both an `EXTERNAL_HUD` reading and
`MANUAL_HUD`/`LEARNED_MODEL` evidence for the SAME stat, `EXTERNAL_HUD` is used ALONE (at
its fixed confidence) for that stat, and the existing pooling applies only to stats
`EXTERNAL_HUD` does not cover. Rejected alternative: pool all three sources together through
one extended weighted-average — this would need a synthetic `n` for `EXTERNAL_HUD` (the same
objection as above) and would make the Korean "why" explanation harder to write honestly,
since a reader could no longer say which source actually drove a number. Precedence keeps
provenance legible: `AdaptiveStatEstimate.sources` still lists exactly what was used.

## 4. Decision for K3 (§5/§6 of `prompt`) — 1% grid, and NOT a logit/softmax rewrite

**§5 (hard requirement) is adopted as written**: ADAPTIVE's output grid moves from 500 bps
(5%) to 100 bps (1%). REFERENCE's own grid and every REFERENCE call site are untouched —
`quantizeFrequencies` gains a grid-step parameter with the existing 500-bps behavior kept as
the default export, and `adaptive-core` calls the generalized function with 100. The
restriction that ADAPTIVE never introduces an action REFERENCE assigned exactly 0% is KEPT
AS-IS (`prompt` §5 explicitly allows re-review without requiring a change): loosening it
would let ADAPTIVE recommend an action REFERENCE never considered legal-and-relevant for
that spot, which is a materially different, larger claim than "recommend a different mix
of the actions REFERENCE already offered," and nothing in this WP's evidence (10 opponent
stats) is strong enough grounds to take that step. If revisited, it needs its own ADR.

**§6 ("검토한다" / "가능하면...설계한다" — consider / design if possible, not a hard
mandate) is explicitly NOT adopted as a logit-space/softmax rewrite.** The existing
frequency pipeline (`adaptive-core/src/policy/frequency.ts`) already computes every rule's
contribution in continuous bps — `gain × |estimate − prior|`, confidence-scaled, per-rule
capped, netted by target, transferred pro-rata, normalized — and only rounds at the FINAL
step (previously 500 bps, now 100). That pipeline was independently reviewed and had 4
MAJOR defects found and fixed (`HARDENING_WP_J_REVIEW_R1.md`); rewriting its core arithmetic
into a logit/softmax renormalization for a "consider" ask would mean re-opening
hardened, reviewed code for a benefit that is not obvious at the scale this system actually
sees (2-3 simultaneous rule contributions per decision point, under a hard total-shift cap).
§6's actual underlying goal — a hand-strength band interacting with an opponent stat, rather
than one global slope — is already structural: every frequency and sizing rule carries a
`bands` selector and a `direction`, so `WTSD_HIGH_BLUFF_DOWN` and `WTSD_HIGH_VALUE_UP` are
already two separate, band-scoped rules reading the same stat in opposite ways. **This is a
recorded scope call, not a silent skip** — see ADR-0068. If the user wants the logit rewrite
after reading this, that decision should be made before K3's code, not after.

## 5. Naming and file-layout decisions

- `packages/player-core/src/externalHud.ts` — domain type + validator, mirrors `hud.ts`.
- `packages/db/src/schema.ts` — `playerExternalHudSnapshots` / `playerExternalHudSnapshotStats`,
  migration `0008_player_external_hud_snapshots.sql`.
- `packages/db/src/repositories/external-hud.ts` — `insertExternalHudSnapshot`,
  `getExternalHudSnapshot`, `listExternalHudSnapshotsForPlayer`,
  `latestExternalProfileForPlayer` (the one `adaptive-service.ts` calls in K2).
- `apps/web/scripts/import-external-hud.ts` (`pnpm players:import-external <path>`) +
  checked-in fixture `apps/web/scripts/fixtures/external-hud-2026-09.json` (the 13 players
  from `prompt` §2, source-JSON field names `CBET`/`FOLD_TO_CBET`/`CHECK_RAISE` mapped to
  `*_ANY_STREET` inside the script, not the fixture — the fixture stays a faithful
  transcription of what the user reported).

## 6. What K2/K3 still owe (tracked here so nothing is silently dropped)

- `adaptive-core/src/stats.ts`: add `CBET_ANY_STREET`, `FOLD_TO_CBET_ANY_STREET`,
  `CHECK_RAISE_ANY_STREET` to `AdaptiveStatKey` (documented as an intentionally extensible
  closed union); `priors.ts` needs a `HEURISTIC` prior + `K` for each.
- `adaptive-core/src/stats.ts`: add `'EXTERNAL_HUD'` to `AdaptiveStatSource`.
- `adaptive-core/src/profile.ts`: the precedence rule from §3.
- `apps/web/src/server/adaptive-service.ts`: read `latestExternalProfileForPlayer` and map
  its 10 keys into `AdaptiveOpponentInput`, tagged `EXTERNAL_HUD`.
- `strategy-core/src/preflop/recommendation.ts` + `adaptive-core/src/policy/frequency.ts`:
  the 100-bps grid generalization from §4, including `trimToCap`'s step size.
- `adaptive-core/src/policy/sizingModel.ts`: a 5th sizing rule using `WSD` (the one
  currently-unused sizing stat `prompt` §7 names), per the plan's `SIZE_WINNER_VALUE_UP`.
- ADR-0067 (source priority + generic-stat extension + fixed confidence), ADR-0068 (1% grid
  + the explicit non-adoption of logit/softmax), ADR-0069 (external-profile UI/DB
  separation) — to be written in K6, referencing this audit.
