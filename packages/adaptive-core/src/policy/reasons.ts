/**
 * The two closed vocabularies every adjustment is explained with: WHY it fired
 * (`AdaptiveReasonKey`) and WHAT held it back (`AdaptiveCapId`).
 *
 * Both are unions rather than strings for the same reason `AdaptiveStatKey` is: the UI maps
 * them through an exhaustive `Readonly<Record<Enum, string>>` in
 * `apps/web/src/lib/table/copy.ts` (WP-J design contract §8), so adding a member without
 * writing its copy is a compile error and never an untranslated token on screen.
 *
 * A REASON KEY NAMES THE READ, NOT THE RULE. Several rules share one: `FOLD_TO_CBET_HIGH`
 * (bet more often) and `SIZE_FOLDY_BLUFF_DOWN` (bet smaller) are two responses to the same
 * observation, "this opponent folds more than the anchor", and the explanation line the user
 * reads is about the observation. The rule id is carried separately on every adjustment for
 * anyone who needs to know which lever moved.
 *
 * NOTHING HERE IS A SENTENCE. This package is copy-free and carries no language: a token, an
 * id and the numbers behind it, and the UI writes the prose.
 */

/**
 * The observation behind an adjustment, phrased from the OPPONENT's side.
 *
 * Every entry is a comparison against `ADAPTIVE_PRIORS`' zero-adjustment anchor, so "too much"
 * always means "further from our declared neutral point than the confidence in the sample
 * justifies ignoring" — never "more than a solver would".
 */
export type AdaptiveReasonKey =
  /** Folds to a continuation bet more than the anchor. */
  | 'OPPONENT_FOLDS_TOO_MUCH'
  /** Folds to a continuation bet less than the anchor — the calling-station read. */
  | 'OPPONENT_FOLDS_TOO_LITTLE'
  /** Check-raises more than the anchor. */
  | 'OPPONENT_CHECK_RAISES'
  /** Reaches showdown more than the anchor. */
  | 'OPPONENT_GOES_TO_SHOWDOWN'
  /** Reaches showdown less than the anchor — folds somewhere along the way. */
  | 'OPPONENT_AVOIDS_SHOWDOWN'
  /** Continuation-bets more than the anchor, so the bet hero faces is a wider range. */
  | 'OPPONENT_BETS_WIDE'
  /** Continuation-bets less than the anchor, so the bet hero faces is a narrower range. */
  | 'OPPONENT_BETS_NARROW'
  /** 3-bets more than the anchor. */
  | 'OPPONENT_THREE_BETS_WIDE'
  /** Folds to a 3-bet more than the anchor. */
  | 'OPPONENT_FOLDS_TO_THREE_BET'
  /** Folds to a 3-bet less than the anchor. */
  | 'OPPONENT_DEFENDS_THREE_BET'
  /** Folds the big blind to a late-position open more than the anchor. */
  | 'OPPONENT_FOLDS_BLIND_TO_STEAL'
  /**
   * Wins more of the showdowns reached than the anchor — has the goods when they get there.
   *
   * Carried as a SECONDARY reading only (WP-K follow-up §2): no rule fires ON it. It is the
   * observation behind `SIZE_STATION_VALUE_UP`'s `suppressedWhen`, and it is what the
   * `SIZING_SECONDARY_SIGNAL_WITHDRAWN` note is about.
   */
  | 'OPPONENT_WINS_SHOWDOWNS';

/** Every member, in declaration order. Fixes iteration order wherever the set is walked. */
export const ADAPTIVE_REASON_KEYS: readonly AdaptiveReasonKey[] = [
  'OPPONENT_FOLDS_TOO_MUCH',
  'OPPONENT_FOLDS_TOO_LITTLE',
  'OPPONENT_CHECK_RAISES',
  'OPPONENT_GOES_TO_SHOWDOWN',
  'OPPONENT_AVOIDS_SHOWDOWN',
  'OPPONENT_BETS_WIDE',
  'OPPONENT_BETS_NARROW',
  'OPPONENT_THREE_BETS_WIDE',
  'OPPONENT_FOLDS_TO_THREE_BET',
  'OPPONENT_DEFENDS_THREE_BET',
  'OPPONENT_FOLDS_BLIND_TO_STEAL',
  'OPPONENT_WINS_SHOWDOWNS',
];

/**
 * What limited an adjustment. `null` on an adjustment means it was applied in full.
 *
 * The order below is the order the limiters are applied, and it matters: a rule is first
 * clipped to its own ceiling, then possibly zeroed by the player-behind guard, then possibly
 * scaled by the global shift cap. Only the LAST limiter that actually changed the number is
 * recorded, so `cappedBy` answers "what is holding this back right now".
 */
export type AdaptiveCapId =
  /** The rule's own `maxBps` ceiling clipped a contribution that wanted to be larger. */
  | 'RULE_MAX'
  /**
   * The baseline offers no action on one side of the transfer, so there is nowhere to move
   * mass from or to. Recorded rather than dropped: "REFERENCE gave hero no fold option" is a
   * real answer to "why did my opponent read change nothing".
   */
  | 'TARGET_ABSENT'
  /** WP-J design contract §9: a known aggressor is still to act, so escalation was refused. */
  | 'AGGRESSIVE_PLAYER_BEHIND'
  /** The whole set of contributions was scaled down to respect `MAX_TOTAL_SHIFT_BPS_*`. */
  | 'TOTAL_SHIFT'
  /** A sizing rule's rung offset was clipped by `MAX_SIZING_BUCKET_DELTA`. */
  | 'SIZING_BUCKET_DELTA'
  /** A sizing rung offset ran off the end of `POT_FRACTION_BUCKETS`. */
  | 'SIZING_LADDER_END';

/** Every member, in the order the limiters are applied. */
export const ADAPTIVE_CAP_IDS: readonly AdaptiveCapId[] = [
  'RULE_MAX',
  'TARGET_ABSENT',
  'AGGRESSIVE_PLAYER_BEHIND',
  'TOTAL_SHIFT',
  'SIZING_BUCKET_DELTA',
  'SIZING_LADDER_END',
];

/**
 * A structural remark about the whole composition, as opposed to about one rule.
 *
 * This is how `INSUFFICIENT_DATA` says WHICH gate was not met, and how a suppressed sizing
 * pass says why. A note is a CODE plus an optional stable detail token — never a sentence, for
 * the same reason as everything else in this package.
 */
export type AdaptiveNoteCode =
  /** No frequency rule reached `FREQUENCY_MIN_CONFIDENCE_BPS`. */
  | 'FREQUENCY_CONFIDENCE_GATE_NOT_MET'
  /** No sizing rule reached the applicable `SIZING_MIN_CONFIDENCE_BPS_*`. */
  | 'SIZING_CONFIDENCE_GATE_NOT_MET'
  /** Every rule is keyed to one villain and no opponent could be named PRIMARY. */
  | 'NO_PRIMARY_OPPONENT'
  /** A primary villain exists, but no rule's street / spot / band scope matched. */
  | 'NO_RULE_APPLIED_TO_SPOT'
  /** The §9 guard fired: positive aggression was refused because of a player behind. */
  | 'AGGRESSIVE_PLAYER_BEHIND'
  /** The global shift cap scaled the contributions down. */
  | 'TOTAL_SHIFT_CAP_APPLIED'
  /** The baseline size is an ALL_IN; the top rung is never moved. */
  | 'SIZING_ALL_IN_NOT_MOVED'
  /** Preflop sizing is a raise-TO rule, not a pot fraction. Out of scope for the MVP. */
  | 'PREFLOP_SIZING_OUT_OF_SCOPE'
  /** Sizing needs the engine's legal wager window and the caller supplied none. */
  | 'SIZING_WAGER_WINDOW_MISSING'
  /**
   * A sizing rule's PRIMARY signal fired, but its SECONDARY signal withdrew support and the
   * rung was not taken (WP-K follow-up §2). `detail` is the suppressed rule's own id, so the
   * panel can say WHICH size did not move rather than only that one did not.
   */
  | 'SIZING_SECONDARY_SIGNAL_WITHDRAWN'
  /** The baseline carried no actions at all, so there was no frequency set to adapt. */
  | 'BASELINE_HAS_NO_ACTIONS';

/** Every member, in declaration order. */
export const ADAPTIVE_NOTE_CODES: readonly AdaptiveNoteCode[] = [
  'FREQUENCY_CONFIDENCE_GATE_NOT_MET',
  'SIZING_CONFIDENCE_GATE_NOT_MET',
  'NO_PRIMARY_OPPONENT',
  'NO_RULE_APPLIED_TO_SPOT',
  'AGGRESSIVE_PLAYER_BEHIND',
  'TOTAL_SHIFT_CAP_APPLIED',
  'SIZING_ALL_IN_NOT_MOVED',
  'PREFLOP_SIZING_OUT_OF_SCOPE',
  'SIZING_WAGER_WINDOW_MISSING',
  'SIZING_SECONDARY_SIGNAL_WITHDRAWN',
  'BASELINE_HAS_NO_ACTIONS',
];

/** Which decision a note explains. The two passes are separate and so are their remarks. */
export type AdaptiveNoteScope = 'FREQUENCY' | 'SIZING';

/**
 * Which pass each note belongs to, exhaustively BY TYPE.
 *
 * A caller that wants to say "here is why the MIX did not move" must not reach for a note about
 * SIZING. Answering "why is the frequency unchanged?" with "preflop sizing is out of scope" is
 * a true sentence in the wrong slot, and a reader has no way to tell it is an answer to a
 * different question. Keeping the split here rather than at the call site means a new
 * `AdaptiveNoteCode` is a compile error, not a note that silently lands in the wrong
 * explanation.
 */
export const ADAPTIVE_NOTE_SCOPE: Readonly<Record<AdaptiveNoteCode, AdaptiveNoteScope>> = {
  FREQUENCY_CONFIDENCE_GATE_NOT_MET: 'FREQUENCY',
  SIZING_CONFIDENCE_GATE_NOT_MET: 'SIZING',
  NO_PRIMARY_OPPONENT: 'FREQUENCY',
  NO_RULE_APPLIED_TO_SPOT: 'FREQUENCY',
  AGGRESSIVE_PLAYER_BEHIND: 'FREQUENCY',
  TOTAL_SHIFT_CAP_APPLIED: 'FREQUENCY',
  SIZING_ALL_IN_NOT_MOVED: 'SIZING',
  PREFLOP_SIZING_OUT_OF_SCOPE: 'SIZING',
  SIZING_WAGER_WINDOW_MISSING: 'SIZING',
  SIZING_SECONDARY_SIGNAL_WITHDRAWN: 'SIZING',
  BASELINE_HAS_NO_ACTIONS: 'FREQUENCY',
};

/** One structural remark. `detail` is a stable token or a number rendered as one, never prose. */
export interface AdaptiveNote {
  readonly code: AdaptiveNoteCode;
  readonly detail: string | null;
}

/** Total. Constructs a note. Exists so the shape is written in exactly one place. */
export const adaptiveNote = (
  code: AdaptiveNoteCode,
  detail: string | null = null,
): AdaptiveNote => ({
  code,
  detail,
});
