/**
 * GOLDEN FIXTURES for WP-K §11/§12: two real (nickname-only, stats from `prompt`) opponent
 * profiles used as a permanent regression + divergence audit across a named set of spots.
 *
 * Not exported from the package barrel, same convention as `testBaseline.ts`: a fixture that
 * ships in the public surface becomes a second, undocumented way to construct a domain value.
 *
 * The observation-building here intentionally MIRRORS (does not import — layering forbids
 * `apps/web` -> `adaptive-core` importing the other way) `apps/web/src/server/adaptive-
 * service.ts`'s `externalHudObservations`: a generic, street-blind reading (`CBET`,
 * `FOLD_TO_CBET`, `CHECK_RAISE`) is stored under its own `*_ANY_STREET` key AND fanned out to
 * all three per-street keys, because none of the WP-J frequency/sizing rules select on the
 * `*_ANY_STREET` keys themselves — see `EXTERNAL_ADAPTIVE_MATH_CALIBRATION.md` and
 * `adaptive-service.ts`'s own doc comment for the full rationale.
 *
 * These two fixtures have NO manual and NO learned readings, so the service's per-street
 * precedence rule (WP-K follow-up §3: a real reading with a real denominator takes the key
 * away from the fan-out) never engages for them and this mirror stays exact. The precedence
 * itself is pinned where it lives, in `apps/web`'s `adaptive-service.test.ts`.
 */
import type { AdaptiveOpponentInput, AdaptiveStatObservation } from './inputs.js';
import type { AdaptiveStatKey } from './stats.js';
import { opponentInput } from './testBaseline.js';

/** The 10 stat categories the external HUD reports, in percent (matches `prompt` §2 verbatim). */
export interface ExternalProfileStats {
  readonly VPIP: number;
  readonly PFR: number;
  readonly THREE_BET: number;
  readonly FOLD_TO_THREE_BET: number;
  readonly CBET: number;
  readonly FOLD_TO_CBET: number;
  readonly STEAL: number;
  readonly CHECK_RAISE: number;
  readonly WTSD: number;
  readonly WSD: number;
}

/** `prompt` §11 — a typical, unremarkable player. */
export const SHADOW7_STATS: ExternalProfileStats = {
  VPIP: 29,
  PFR: 20,
  THREE_BET: 10,
  FOLD_TO_THREE_BET: 61,
  CBET: 67,
  FOLD_TO_CBET: 26,
  STEAL: 44,
  CHECK_RAISE: 7,
  WTSD: 30,
  WSD: 53,
};

/** `prompt` §11 — an extreme, loose-aggressive outlier, deliberately far from Shadow7. */
export const ACN1977_STATS: ExternalProfileStats = {
  VPIP: 56,
  PFR: 33,
  THREE_BET: 15,
  FOLD_TO_THREE_BET: 10,
  CBET: 81,
  FOLD_TO_CBET: 24,
  STEAL: 63,
  CHECK_RAISE: 17,
  WTSD: 38,
  WSD: 43,
};

const GENERIC_STAT_APPLIES_TO_STREETS: Readonly<Record<'CBET' | 'FOLD_TO_CBET' | 'CHECK_RAISE', readonly AdaptiveStatKey[]>> = {
  CBET: ['CBET_FLOP', 'CBET_TURN', 'CBET_RIVER'],
  FOLD_TO_CBET: ['FOLD_TO_CBET_FLOP', 'FOLD_TO_CBET_TURN', 'FOLD_TO_CBET_RIVER'],
  CHECK_RAISE: ['CHECK_RAISE_FLOP', 'CHECK_RAISE_TURN', 'CHECK_RAISE_RIVER'],
};

const GENERIC_ANY_STREET_KEY: Readonly<Record<'CBET' | 'FOLD_TO_CBET' | 'CHECK_RAISE', AdaptiveStatKey>> = {
  CBET: 'CBET_ANY_STREET',
  FOLD_TO_CBET: 'FOLD_TO_CBET_ANY_STREET',
  CHECK_RAISE: 'CHECK_RAISE_ANY_STREET',
};

/** One `EXTERNAL_HUD` observation, `sampleN` always 0 — see `profile.test.ts`'s own `external()`. */
const external = (key: AdaptiveStatKey, percent: number): AdaptiveStatObservation => ({
  key,
  source: 'EXTERNAL_HUD',
  valueBps: percent * 100,
  sampleN: 0,
  note: null,
});

/** Total. Turns a raw external-HUD percent set into the observations `adaptive-service.ts` produces. */
export function externalObservationsFor(stats: ExternalProfileStats): readonly AdaptiveStatObservation[] {
  const observations: AdaptiveStatObservation[] = [
    external('VPIP', stats.VPIP),
    external('PFR', stats.PFR),
    external('THREE_BET', stats.THREE_BET),
    external('FOLD_TO_THREE_BET', stats.FOLD_TO_THREE_BET),
    external('STEAL', stats.STEAL),
    external('WTSD', stats.WTSD),
    external('WSD', stats.WSD),
  ];
  for (const generic of ['CBET', 'FOLD_TO_CBET', 'CHECK_RAISE'] as const) {
    const percent = stats[generic];
    observations.push(external(GENERIC_ANY_STREET_KEY[generic], percent));
    for (const perStreetKey of GENERIC_STAT_APPLIES_TO_STREETS[generic]) {
      observations.push(external(perStreetKey, percent));
    }
  }
  return observations;
}

/** One opponent input built entirely from an external profile, at the given seat. */
export function externalOpponentInput(
  playerId: string,
  stats: ExternalProfileStats,
  seatIndex = 2,
): AdaptiveOpponentInput {
  return {
    ...opponentInput(playerId, externalObservationsFor(stats), seatIndex),
    externalHudSnapshotId: `external-${playerId}`,
    externalHudRecordedAt: 1_700_000_000_000,
  };
}
