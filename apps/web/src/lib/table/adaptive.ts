/**
 * The COMPOSITION SEAM: 기본전략 · REFERENCE + what we know about the opponents -> 상대 적응 ·
 * ADAPTIVE.
 *
 * `strategy.ts` is the read model for the REFERENCE engine. This file is the read model for
 * the layer above it, and it owns exactly one job: turn the panel model that file produced
 * into the neutral `AdaptiveBaseline` that `@gto-self/adaptive-core` consumes, apply the
 * seat -> player mapping that package is deliberately not given, and call `composeAdaptive`.
 *
 * ---------------------------------------------------------------------------------------
 * THE LOAD-BEARING INVARIANT (WP-J design contract §1)
 *
 * `computeStrategy(state, heroSeat)` is byte-identical whatever the player data is. Nothing
 * here can weaken that, structurally rather than by discipline:
 *
 *   - `computeStrategy`'s parameter list is untouched, and this file never calls it. ADAPTIVE
 *     is a SECOND call that takes the REFERENCE result AS A VALUE.
 *   - `AdaptiveRecommendation.baseline` is the value passed in, echoed by reference. Two
 *     compositions over the same panel model therefore carry deep-equal baselines.
 *   - Nothing in this direction of the graph is reversible: `adaptive-core` may not import
 *     `poker-core`, so it can never reconstruct the `HandState` that produced the baseline.
 *
 * ---------------------------------------------------------------------------------------
 * PURE, SYNCHRONOUS, AND CHEAP ENOUGH TO RUN IN RENDER (WP-J design contract §6)
 *
 * `computeAdaptive` is a plain function call over a handful of arrays of integers. No equity,
 * no ranges, no board analysis, no database, no clock, no random source, no `await`. That is
 * what lets the panel recompute ADAPTIVE in a `useMemo` when a HUD reading is saved mid-hand
 * — with the REFERENCE result untouched beside it — instead of scheduling a second effect.
 *
 * NOTHING HERE IS GTO (`CLAUDE.md` rule 2). `adaptive-core` fixes `provenance` at
 * `'HEURISTIC'` at the type level, and every number it produces carries the sample size,
 * confidence and source it came from.
 * ---------------------------------------------------------------------------------------
 */
import {
  buildAdjustmentProfile,
  composeAdaptive,
  type AdaptiveBaseline,
  type AdaptiveBaselineAction,
  type AdaptiveBaselineSizing,
  type AdaptiveComposeContext,
  type AdaptiveOpponentInput,
  type AdaptiveOpponentOrdering,
  type AdaptiveRecommendation,
  type AdaptiveStatObservation,
} from '@gto-self/adaptive-core';
import type { AdaptiveOpponentInputWire, AdaptiveStatObservationWire } from './contract.js';
import type { StrategyPanelModel, StrategyPanelReady } from './strategy.js';

/**
 * One wire observation as the composition layer's own DTO.
 *
 * The two shapes are structurally identical on purpose (see `contract.ts`), so this is an
 * assignment rather than a conversion — no unit changes, no rounding, no defaulting. It is
 * written out field by field anyway, because that makes a divergence between the wire and the
 * domain type a COMPILE ERROR here rather than a silently dropped field at runtime.
 */
function observationFromWire(wire: AdaptiveStatObservationWire): AdaptiveStatObservation {
  return {
    key: wire.key,
    source: wire.source,
    valueBps: wire.valueBps,
    sampleN: wire.sampleN,
    note: wire.note,
  };
}

/** Maps the wire DTO the server action returns into `adaptive-core`'s input type. */
export function opponentInputFromWire(wire: AdaptiveOpponentInputWire): AdaptiveOpponentInput {
  return {
    playerId: wire.playerId,
    seatIndex: wire.seatIndex,
    nickname: wire.nickname,
    observations: wire.observations.map(observationFromWire),
    manualHudSnapshotId: wire.manualHudSnapshotId,
    manualHudRecordedAt: wire.manualHudRecordedAt,
    learnedSnapshotId: wire.learnedSnapshotId,
    learnedModelVersion: wire.learnedModelVersion,
    externalHudSnapshotId: wire.externalHudSnapshotId,
    externalHudRecordedAt: wire.externalHudRecordedAt,
  };
}

/**
 * Internal. The REFERENCE action rows, stripped to the four fields the composition needs.
 *
 * The display name and the `isPrimary` flag are deliberately dropped: the primary is re-picked
 * by `adaptive-core` (through the REFERENCE engine's own `pickPrimaryAction`) after the mass
 * moves, so carrying the old flag into the baseline would put a stale answer where the new one
 * has to go.
 */
function baselineActionsOf(ready: StrategyPanelReady): readonly AdaptiveBaselineAction[] {
  return ready.actions.map((row) => ({
    kind: row.kind,
    frequencyBps: row.frequencyBps,
    toAmountMbb: row.toAmountMbb,
    isAllIn: row.isAllIn,
  }));
}

/**
 * Internal. The REFERENCE size plus every money fact needed to move it one rung and still land
 * on a legal amount. `null` exactly when REFERENCE recommended no sized action.
 *
 * Two mappings are worth stating:
 *
 * `kind` — `AdaptiveBaselineSizing` labels a size `BET` or `RAISE`, while the row that carried
 * the sizing may also be an aggressive `ALL_IN` (the engine attaches a sizing to a BET, a RAISE
 * or an ALL_IN that raised the price). An ALL_IN that raises the price IS a raise in every
 * sense the label is used for, so it maps to `RAISE`. The value is presentation only —
 * `adaptive-core` echoes it and never branches on it.
 *
 * `bucketIndex` — `-1` is the ladder's "not a rung that can be moved" sentinel, and the sizing
 * pass refuses to move it. `adaptiveFacts.bucketIndex` is `null` both when the engine chose no
 * pot fraction at all and PREFLOP, where sizing is a raise-TO rule rather than a pot fraction;
 * both collapse to `-1` here. Preflop sizing adaptation is out of the MVP anyway (design
 * contract §5.1) and `adaptSizing` gates the whole street out before it ever reads this field,
 * so the sentinel is belt and braces rather than the thing doing the work.
 */
function baselineSizingOf(ready: StrategyPanelReady): AdaptiveBaselineSizing | null {
  const sizing = ready.sizing;
  if (sizing === null) return null;
  return {
    kind: sizing.kind === 'BET' ? 'BET' : 'RAISE',
    bucketIndex: ready.adaptiveFacts.bucketIndex ?? -1,
    potFractionPercent: sizing.potFractionPercent,
    toAmountMbb: sizing.toAmountMbb,
    minToAmountMbb: sizing.minToAmountMbb,
    maxToAmountMbb: sizing.maxToAmountMbb,
    heroStreetContributionMbb: ready.adaptiveFacts.heroStreetContributionMbb,
    potBeforeDecisionMbb: ready.metrics.potBeforeDecisionMbb,
    callAmountMbb: ready.metrics.callAmountMbb,
    allIn: sizing.allIn,
  };
}

/**
 * Internal. The ordering facts, with a `playerId` attached to each seat.
 *
 * A SEAT WITH NO KNOWN PLAYER IS DROPPED. `AdaptiveOpponentOrdering` is keyed by `playerId`
 * because a role only means something if a profile can be looked up for it, and a seat we
 * cannot name can carry no profile: it could never be read as PRIMARY, and it could never trip
 * the §9 guard rail. Dropping it is therefore the same answer as keeping it with an unusable
 * id, and it is the conservative one — every effect of the ordering list either names the
 * villain a rule reads or REFUSES an adjustment, so a missing seat can only ever make the
 * layer do less. This is documented rather than reported as a note: `AdaptiveNote`'s codes are
 * a closed union owned by `adaptive-core`, and inventing one here would be authoring in a
 * package this seam only consumes.
 */
function orderingsOf(
  ready: StrategyPanelReady,
  seatPlayerIds: ReadonlyMap<number, string>,
): readonly AdaptiveOpponentOrdering[] {
  return ready.adaptiveFacts.opponentOrderings.flatMap((ordering) => {
    const playerId = seatPlayerIds.get(ordering.seatIndex);
    if (playerId === undefined) return [];
    return [
      {
        playerId,
        seatIndex: ordering.seatIndex,
        isLive: ordering.isLive,
        actsAfterHero: ordering.actsAfterHero,
        isLastAggressorThisStreet: ordering.isLastAggressorThisStreet,
        actionOrderIndex: ordering.actionOrderIndex,
      },
    ];
  });
}

/**
 * The REFERENCE panel model -> the neutral baseline, with the seat -> player mapping applied.
 *
 * Returns `null` for a spot the REFERENCE engine itself reports as `UNSUPPORTED`. That is the
 * one refusal this seam owns, and it is a product judgement worth stating: on an unsupported
 * preflop line the engine answers with a documented passive fallback and says so in
 * `unsupportedReason`. Composing an exploit on top of an answer the engine disclaims would
 * present a player-specific recommendation derived from a non-answer, which is exactly the
 * plausible-looking default `CLAUDE.md` rules 2 and 5 forbid. The panel shows REFERENCE, with
 * its refusal, and nothing else.
 *
 * Every other READY spot produces a baseline. `context` is returned beside it because the two
 * are built from the same facts and a caller that had one without the other could compose over
 * an ordering list belonging to a different decision.
 */
export function buildAdaptiveBaseline(
  ready: StrategyPanelReady,
  seatPlayerIds: ReadonlyMap<number, string>,
): { readonly baseline: AdaptiveBaseline; readonly context: AdaptiveComposeContext } | null {
  if (ready.family === 'UNSUPPORTED') return null;

  const facts = ready.adaptiveFacts;
  const baseline: AdaptiveBaseline = {
    street: ready.street,
    heroFacingBet: facts.heroFacingBet,
    activeOpponentCount: facts.activeOpponentCount,
    aggressionBand: facts.aggressionBand,
    actions: baselineActionsOf(ready),
    primaryKind: ready.primary.kind,
    sizing: baselineSizingOf(ready),
    heroIsPreflopOpener: facts.heroIsPreflopOpener,
    heroPosition: ready.heroPosition,
  };

  const context: AdaptiveComposeContext = {
    opponents: orderingsOf(ready, seatPlayerIds),
    wager: facts.wager,
  };

  return { baseline, context };
}

/**
 * REFERENCE model + opponent data -> the ADAPTIVE answer, or `null` when there is nothing to
 * adapt.
 *
 * `null` for `NO_HAND` and for `REFUSED`: ADAPTIVE has no state of its own to report and must
 * not invent one. The panel keeps showing the REFERENCE model — for `REFUSED` that means the
 * engine's own error code and message, carried verbatim — rather than a second, emptier
 * refusal alongside it. `null` also for the `UNSUPPORTED` family, for the reason
 * `buildAdaptiveBaseline` gives.
 *
 * Total otherwise. `composeAdaptive` never throws for a data-shaped reason, and every
 * degenerate case has a documented answer: no opponents at all, or no opponent the ordering
 * facts can name PRIMARY, or a profile with no samples anywhere, all come back as
 * `status: 'INSUFFICIENT_DATA'` with the baseline echoed verbatim.
 *
 * DETERMINISTIC. The profiles are built in the order the inputs arrive and the orderings in the
 * query's own seat order, so the same arguments produce the same bytes — which is what lets an
 * `adaptive_strategy_traces` row be reproduced and compared field by field.
 */
export function computeAdaptive(
  model: StrategyPanelModel,
  opponentInputs: readonly AdaptiveOpponentInputWire[],
  seatPlayerIds: ReadonlyMap<number, string>,
): AdaptiveRecommendation | null {
  if (model.kind !== 'READY') return null;
  const built = buildAdaptiveBaseline(model, seatPlayerIds);
  if (built === null) return null;

  const profiles = opponentInputs.map((wire) =>
    buildAdjustmentProfile(opponentInputFromWire(wire)),
  );
  return composeAdaptive(built.baseline, profiles, built.context);
}
