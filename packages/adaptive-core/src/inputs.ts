/**
 * The NEUTRAL input DTO of the ADAPTIVE layer.
 *
 * This package must be able to compose a profile without knowing that a database, a hand
 * event log or an `analysis-core` snapshot exists (ADR-0061 — nothing but `apps/web`
 * imports `analysis-core`). So every opponent fact arrives here already flattened into
 * `AdaptiveStatObservation[]` by `apps/web/src/server/adaptive-service.ts`, which owns the
 * whole `HudStatKey`/`ModelStatKey` -> `AdaptiveStatKey` mapping.
 *
 * Two properties of this shape are load-bearing:
 *
 * 1. `sampleN` is a DENOMINATOR that was actually observed. It is never invented, never
 *    defaulted to a plausible number, and never back-filled from a different stat
 *    (CLAUDE.md rules 2 and 5). An unknown sample size arrives as `0`, which — read the
 *    formula in `profile.ts` — gives the reading exactly zero weight rather than a small
 *    one.
 * 2. `note` is a scope caveat carried VERBATIM to the UI (CLAUDE.md rule 3: what the user
 *    entered, and the caveat under which we read it, both survive). It is the honest place
 *    for "read from the BB positional row", "RFI from CO/BTN/SB", "HUD 표본 수 미입력".
 */
import { kFor } from './priors.js';
import type { AdaptiveStatKey, AdaptiveStatSource } from './stats.js';

/** One reading of one stat from one source. Nothing here is derived; it is all reported. */
export interface AdaptiveStatObservation {
  readonly key: AdaptiveStatKey;
  readonly source: AdaptiveStatSource;
  /**
   * 0..10000. CentiPercent (hundredths of a percent, `player-core`'s HUD unit) and basis
   * points share this unit EXACTLY, so the mapping is an assignment and not a conversion —
   * there is no rounding step between a stored HUD reading and the number a rule sees.
   */
  readonly valueBps: number;
  /**
   * The DENOMINATOR this value was observed over: opportunities for a learned stat, a
   * (capped) hand count for a HUD reading. Never invented. `0` means "unknown", and an
   * unknown sample carries no weight at all.
   */
  readonly sampleN: number;
  /** A scope caveat the UI must be able to show verbatim, or `null` when there is none. */
  readonly note: string | null;
}

/** Everything the ADAPTIVE layer is allowed to know about one opponent. */
export interface AdaptiveOpponentInput {
  readonly playerId: string;
  readonly seatIndex: number;
  readonly nickname: string | null;
  readonly observations: readonly AdaptiveStatObservation[];
  /** Provenance: the exact `player_hud_snapshots` row the MANUAL_HUD readings came from. */
  readonly manualHudSnapshotId: string | null;
  /** Epoch ms, injected by the caller (ADR-0007). This package never reads a clock. */
  readonly manualHudRecordedAt: number | null;
  /** Provenance: the exact `player_model_snapshots` row the LEARNED_MODEL readings came from. */
  readonly learnedSnapshotId: string | null;
  readonly learnedModelVersion: number | null;
  /**
   * Provenance: the exact `player_external_hud_snapshots` row the EXTERNAL_HUD readings
   * came from (WP-K). `null` when the player has no external profile.
   */
  readonly externalHudSnapshotId: string | null;
  /** Epoch ms, injected by the caller (ADR-0007). This package never reads a clock. */
  readonly externalHudRecordedAt: number | null;
}

/**
 * HEURISTIC. The largest effective sample a MANUAL HUD reading may claim FOR ONE STAT,
 * before it is used as a denominator: `floor(K / 2)` for that stat's own `K`.
 *
 * WHY A CAP EXISTS AT ALL. A HUD reports one number — the hands it has seen the player in —
 * and the user types that one number in once. But the stats it labels are scoped to wildly
 * different denominators: "VPIP over 4,000 hands" really did have roughly 4,000
 * opportunities, whereas "Fold to CBet flop over 4,000 hands" had a few hundred at most,
 * because the player has to reach a flop as the caller and then face a bet. A hand count is
 * simply not an opportunity count, and we have no way to recover the real one from what the
 * user can type. So the HUD reading is treated as TESTIMONY — a read worth listening to,
 * never a measurement we made.
 *
 * WHY `floor(K / 2)`, AND THE ONE PROPERTY IT BUYS. Confidence is
 * `confidenceWeightBps(n, K) = round(10000 * n / (n + K))`, so pinning `n` to `K / 2` pins
 * the weight:
 *
 * ```
 *   (K/2) / ((K/2) + K)  =  1/3   ->  3333 bps, for EVERY stat, at any hand count
 * ```
 *
 * A MANUAL HUD READING ALONE THEREFORE REACHES AT MOST 3333 BPS (33%) CONFIDENCE, whatever
 * the user types — 40 hands or 40,000. `floor` makes that a ceiling rather than an equality
 * for an odd `K` (`K = 25` yields `12/37 = 3243`); every `K` a HUD stat can actually reach
 * is even, so those all land on exactly 3333.
 *
 * THE CONSEQUENCE IS THE POINT OF THE DESIGN, NOT A SIDE EFFECT. Against the policy layer's
 * gates — `FREQUENCY_MIN_CONFIDENCE_BPS = 2500`, `SIZING_MIN_CONFIDENCE_BPS_HEADS_UP = 5000`,
 * `SIZING_MIN_CONFIDENCE_BPS_MULTIWAY = 7500` — 3333 sits deliberately between the first and
 * the second:
 *
 *   **Manual HUD testimony alone can adjust FREQUENCIES. It can NEVER, on its own, move a
 *   bet SIZE.** Changing a size always requires evidence this app observed itself.
 *
 * LEARNED_MODEL evidence pools on top of it normally — `n = nM + nL` in `profile.ts` — and a
 * real opportunity count can carry a stat past either sizing gate. Nothing here suppresses
 * that; the cap bounds only the HUD's own contribution to the denominator.
 *
 * WHAT THE OLD FLAT CAP GOT WRONG. This constant used to be a flat 1000 with a paragraph
 * arguing that it bounded an overstated denominator. It did not: 1000 is 25x the largest `K`
 * in `ADAPTIVE_STAT_K`, so `confidenceWeightBps(1000, 40) = 9615` and even 40 typed hands
 * cleared the heads-up sizing gate EXACTLY. It damped nothing at any hand count a person
 * would type. The flat constant has been removed rather than retuned, so no call site can
 * still reach for it.
 *
 * WHERE IT IS APPLIED. In `apps/web/src/server/adaptive-service.ts`, at the mapping boundary
 * — `sampleN = min(snapshot.handSample ?? 0, manualHudSampleCap(key))` — so that the capped
 * value is the one recorded in the trace and shown in the UI, always beside a note saying
 * the reading is a HUD hand count and not this stat's opportunity count. This package does
 * NOT re-apply it: `buildAdjustmentProfile` takes `sampleN` at face value, because a
 * function that silently rewrote its input would make the trace disagree with the maths.
 */
export function manualHudSampleCap(key: AdaptiveStatKey): number {
  return Math.floor(kFor(key) / 2);
}

/**
 * The confidence a MANUAL_HUD reading can reach on its own, in basis points.
 *
 * Exported as a NAMED CEILING rather than left implicit, because it is the number the whole
 * cap exists to produce and the number the tests and the review pin. It is an upper bound:
 * `manualHudSampleCap` floors, so an odd `K` lands just below it, and a user who types fewer
 * hands than the cap lands below it too.
 */
export const MANUAL_HUD_MAX_CONFIDENCE_BPS = 3333;
