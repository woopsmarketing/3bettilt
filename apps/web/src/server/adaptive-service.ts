/**
 * The ONE place a persisted player fact becomes an ADAPTIVE observation.
 *
 * `@gto-self/adaptive-core` may not import `@gto-self/db` and may not import
 * `@gto-self/analysis-core` (ADR-0061, WP-J design contract §1), so it never learns that a
 * `player_hud_snapshots` row or a `player_model_snapshots` row exists. Both reach it as the
 * neutral `AdaptiveStatObservation[]` DTO, and this module owns the whole
 * `HudStatKey` / `ModelStatKey` -> `AdaptiveStatKey` mapping that produces it. It lives under
 * `apps/web/src/server/**`, the only directory `eslint.config.js` permits `@gto-self/db` in.
 *
 * ---------------------------------------------------------------------------------------
 * FOUR PROPERTIES THIS FILE EXISTS TO GUARANTEE
 *
 * 1. **A sample size is never invented** (`CLAUDE.md` rules 2 and 5). A HUD that did not
 *    report a hand count yields `sampleN 0` — which, read against the formula in
 *    `adaptive-core`'s `profile.ts`, gives the reading exactly zero weight rather than a
 *    small one. A learned stat with zero opportunities is DROPPED, never emitted as 0%:
 *    "never had the chance" and "had the chance and never did it" are different facts.
 *
 * 2. **A differently-scoped stat is never aliased.** `analysis-core` scopes
 *    `FOLD_TO_STEAL` to the SB *or* the BB, so its `position: null` aggregate is NOT
 *    fold-BB-to-steal. `FOLD_BB_TO_STEAL` is therefore read from the **`position: 'BB'`**
 *    row and from nothing else, and carries that caveat in its note.
 *
 * 3. **Both mappings are exhaustive records over their source union.** A new `HudStatKey`
 *    or `ModelStatKey` is a COMPILE ERROR here, not a stat that quietly stops reaching the
 *    ADAPTIVE layer. The four `ModelStatKey` members with no counterpart map to an explicit
 *    `null` with the reason written down.
 *
 * 4. **Manual and learned readings are never merged here.** They arrive as two separate
 *    observations with the same `key` and different `source`; pooling happens inside
 *    `buildAdjustmentProfile`, which retains both in the estimate's `sources`. A HUD
 *    reading the user typed can therefore never be silently replaced by a computed one
 *    (`CLAUDE.md` rule 3).
 * ---------------------------------------------------------------------------------------
 *
 * Not a hot path. The seat lineup changes on a click, not on a keypress, and nothing in the
 * hand-action path awaits this (ADR-0043).
 */
import { asId } from '@gto-self/shared';
import type { PlayerId } from '@gto-self/shared';
import { SEAT_COUNT } from '@gto-self/poker-core';
import {
  getLatestSnapshot,
  latestExternalProfileForPlayer,
  latestHudSnapshotForPlayer,
  listSnapshotVersions,
} from '@gto-self/db';
import type { GtoDatabase } from '@gto-self/db';
import {
  EXTERNAL_HUD_STAT_KEYS,
  HUD_STAT_KEYS,
  MODEL_STAT_KEYS,
  externalHudStat,
  hudStat,
} from '@gto-self/player-core';
import type {
  ExternalHudStatKey,
  HudStatKey,
  ModelStatCount,
  ModelStatKey,
  ObservedPosition,
  PlayerExternalHudSnapshot,
  PlayerHudSnapshot,
  PlayerModelSnapshot,
} from '@gto-self/player-core';
import { manualHudSampleCap } from '@gto-self/adaptive-core';
import type {
  AdaptiveOpponentInput,
  AdaptiveStatKey,
  AdaptiveStatObservation,
} from '@gto-self/adaptive-core';
import type { AdaptiveSeatInput } from '../lib/table/contract.js';

/* -------------------------------------------------------------------------- */
/* Notes — carried VERBATIM to the UI and into the stored trace (rule 3)       */
/* -------------------------------------------------------------------------- */

/**
 * The scope caveat EVERY manual HUD observation carries, without exception.
 *
 * It is unconditional on purpose. The number the user typed is a HAND count from a
 * third-party HUD; it is not the opportunity count of the stat it is attached to, and for
 * every street-scoped stat it overstates that count badly. Attaching the caveat only when
 * the cap happened to bite would leave the COMMON case — a modest, plausible hand count —
 * rendering in the panel with no caveat at all, which is precisely the reading a user would
 * most take at face value.
 */
export const HUD_HAND_SCOPE_NOTE = 'HUD 핸드 수 기반 추정 · 이 스탯의 실제 기회 수 아님';

/**
 * The HUD reported no hand count. `sampleN` is 0, so this reading moves nothing; the note
 * is what tells the user WHY their typed-in number is not affecting anything.
 */
export const HUD_SAMPLE_MISSING_NOTE = 'HUD 표본 수 미입력';

/**
 * Total. The whole note for one manual HUD reading, given the snapshot's hand count and the
 * per-stat cap that applies to it. NEVER `null`.
 *
 * Three shapes, all of which begin with `HUD_HAND_SCOPE_NOTE`:
 *
 * - no hand count      -> the scope caveat plus `HUD_SAMPLE_MISSING_NOTE`; weight is 0.
 * - hand count > cap   -> the scope caveat plus BOTH numbers, so a user who typed 40,000 can
 *                         see the reading was weighted as `cap` rather than wonder why a huge
 *                         sample moved the strategy no further than a small one.
 * - hand count <= cap  -> the scope caveat plus the count that was used whole.
 *
 * Short, because it renders inside the profile panel next to the reading.
 */
export function hudObservationNote(handSample: number | null, cap: number): string {
  if (handSample === null) return `${HUD_HAND_SCOPE_NOTE} · ${HUD_SAMPLE_MISSING_NOTE}`;
  if (handSample > cap) return `${HUD_HAND_SCOPE_NOTE} · ${handSample}핸드 → 유효 표본 ${cap}`;
  return `${HUD_HAND_SCOPE_NOTE} · 표본 ${handSample}핸드`;
}

/** `STEAL_ATTEMPT`'s scope in `analysis-core`, carried verbatim rather than paraphrased. */
export const STEAL_SCOPE_NOTE = 'RFI from CO/BTN/SB';

/** Which row `FOLD_BB_TO_STEAL` was read from. See property 2 in the header. */
export const FOLD_BB_TO_STEAL_SCOPE_NOTE = 'BB 포지션 행에서 읽음';

/* -------------------------------------------------------------------------- */
/* Mapping table 1 — MANUAL_HUD (WP-J design contract §2.3)                    */
/* -------------------------------------------------------------------------- */

/**
 * Every `HudStatKey`, and the `AdaptiveStatKey` it becomes.
 *
 * Exhaustive by TYPE: `Readonly<Record<HudStatKey, AdaptiveStatKey>>` means adding a member
 * to `HudStatKey` fails to compile here until someone decides what it maps to.
 *
 * Only the rename is interesting. `WON_AT_SHOWDOWN` is `player-core`'s name for the stat
 * `adaptive-core` calls `WSD`; they are the same measurement, so this is a rename and not a
 * re-interpretation. The other seven keys are identical on both sides.
 *
 * The manual HUD has NO key for the other nine `AdaptiveStatKey` members, and `HudStatKey`
 * is deliberately not extended: `player_hud_snapshot_stats.stat_key` carries a
 * `CHECK ... in (HUD_STAT_KEYS)`, and SQLite cannot ALTER a CHECK — widening it means a
 * 12-step rebuild of an insert-only table, which ADR-0046 rules out. The nine simply have no
 * manual source, which the profile reports honestly as `available: false`.
 */
export const MANUAL_HUD_STAT_MAP: Readonly<Record<HudStatKey, AdaptiveStatKey>> = {
  VPIP: 'VPIP',
  PFR: 'PFR',
  THREE_BET: 'THREE_BET',
  FOLD_TO_THREE_BET: 'FOLD_TO_THREE_BET',
  CBET_FLOP: 'CBET_FLOP',
  FOLD_TO_CBET_FLOP: 'FOLD_TO_CBET_FLOP',
  WTSD: 'WTSD',
  WON_AT_SHOWDOWN: 'WSD',
};

/* -------------------------------------------------------------------------- */
/* Mapping table 2 — LEARNED_MODEL (WP-J design contract §2.3)                 */
/* -------------------------------------------------------------------------- */

/** Which row of `PlayerModelSnapshot.globalStats` a learned stat is read from. */
export interface LearnedStatMapping {
  readonly key: AdaptiveStatKey;
  /**
   * The `ModelStatCount.position` bucket to read. `null` is the "every position together"
   * bucket, which is its OWN row and never the sum of the six positional ones (ADR-0035).
   */
  readonly position: ObservedPosition | null;
  /** A scope caveat the reading carries verbatim, or `null` when its scope needs none. */
  readonly note: string | null;
}

/**
 * Every `ModelStatKey`, and the `AdaptiveStatKey` row it becomes — or an explicit `null`
 * when the ADAPTIVE vocabulary has no counterpart for it.
 *
 * Exhaustive by TYPE, for the same reason as `MANUAL_HUD_STAT_MAP`: a new `ModelStatKey`
 * is a compile error here rather than a stat that silently never reaches a rule. The four
 * `null`s are a DECISION that is written down, not an omission:
 *
 * - `RFI`          — `AdaptiveStatKey` has `STEAL` (late-position RFI) and no all-position
 *                    RFI stat. Mapping RFI onto STEAL would widen the scope silently.
 * - `FOUR_BET`     — no counterpart; the MVP rule table has no 4-bet rule (design §4.2).
 * - `TURN_BARREL`  — `analysis-core`'s barrel stats are scoped differently from
 * - `RIVER_BARREL`   `CBET_TURN` / `CBET_RIVER`; aliasing one onto the other is exactly the
 *                    mistake property 2 in this file's header forbids.
 *
 * The two entries that are NOT a straight `position: null` read carry their reason in the
 * note, and both are load-bearing:
 *
 * - `FOLD_TO_STEAL` is scoped by `analysis-core` to the SB *or* the BB, so the `null`
 *   aggregate mixes both and is not fold-BB-to-steal. It is read from the `'BB'` row.
 * - `STEAL_ATTEMPT` is a raise-first-in from CO, BTN or SB. That scope travels with the
 *   observation instead of being lost behind the shorter name `STEAL`.
 */
export const LEARNED_MODEL_STAT_MAP: Readonly<Record<ModelStatKey, LearnedStatMapping | null>> = {
  VPIP: { key: 'VPIP', position: null, note: null },
  PFR: { key: 'PFR', position: null, note: null },
  RFI: null,
  STEAL_ATTEMPT: { key: 'STEAL', position: null, note: STEAL_SCOPE_NOTE },
  FOLD_TO_STEAL: {
    key: 'FOLD_BB_TO_STEAL',
    position: 'BB',
    note: FOLD_BB_TO_STEAL_SCOPE_NOTE,
  },
  THREE_BET: { key: 'THREE_BET', position: null, note: null },
  FOLD_TO_THREE_BET: { key: 'FOLD_TO_THREE_BET', position: null, note: null },
  FOUR_BET: null,
  CBET_FLOP: { key: 'CBET_FLOP', position: null, note: null },
  CBET_TURN: { key: 'CBET_TURN', position: null, note: null },
  CBET_RIVER: { key: 'CBET_RIVER', position: null, note: null },
  FOLD_TO_CBET_FLOP: { key: 'FOLD_TO_CBET_FLOP', position: null, note: null },
  FOLD_TO_CBET_TURN: { key: 'FOLD_TO_CBET_TURN', position: null, note: null },
  FOLD_TO_CBET_RIVER: { key: 'FOLD_TO_CBET_RIVER', position: null, note: null },
  CHECK_RAISE_FLOP: { key: 'CHECK_RAISE_FLOP', position: null, note: null },
  CHECK_RAISE_TURN: { key: 'CHECK_RAISE_TURN', position: null, note: null },
  CHECK_RAISE_RIVER: { key: 'CHECK_RAISE_RIVER', position: null, note: null },
  TURN_BARREL: null,
  RIVER_BARREL: null,
  WTSD: { key: 'WTSD', position: null, note: null },
  WSD: { key: 'WSD', position: null, note: null },
};

/* -------------------------------------------------------------------------- */
/* Mapping table 3 — EXTERNAL_HUD (WP-K)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Every `ExternalHudStatKey`, and the `AdaptiveStatKey` it becomes.
 *
 * Exhaustive by TYPE, same discipline as `MANUAL_HUD_STAT_MAP`. Unlike the manual map, this
 * is an IDENTITY mapping on every key: `@gto-self/player-core`'s `ExternalHudStatKey` was
 * deliberately named to match the `AdaptiveStatKey` it feeds (`docs/reports/
 * EXTERNAL_ADAPTIVE_00_AUDIT.md` §5), including the three generic street-blind keys
 * (`CBET_ANY_STREET` etc.) — there is no rename and no scope decision left to make here.
 */
export const EXTERNAL_HUD_STAT_MAP: Readonly<Record<ExternalHudStatKey, AdaptiveStatKey>> = {
  VPIP: 'VPIP',
  PFR: 'PFR',
  THREE_BET: 'THREE_BET',
  FOLD_TO_THREE_BET: 'FOLD_TO_THREE_BET',
  STEAL: 'STEAL',
  CBET_ANY_STREET: 'CBET_ANY_STREET',
  FOLD_TO_CBET_ANY_STREET: 'FOLD_TO_CBET_ANY_STREET',
  CHECK_RAISE_ANY_STREET: 'CHECK_RAISE_ANY_STREET',
  WTSD: 'WTSD',
  WSD: 'WSD',
};

/**
 * The note EVERY `EXTERNAL_HUD` observation carries. Unconditional, like
 * `HUD_HAND_SCOPE_NOTE` — a reader of the trace or the panel should never have to guess why
 * this reading was trusted differently from a manual one.
 */
export const EXTERNAL_HUD_SCOPE_NOTE = '외부 HUD · 전체 기간(라이프타임) 기록';

/**
 * The note a GENERIC external reading carries when it is ALSO applied per street (see
 * `GENERIC_STAT_APPLIES_TO_STREETS` below) — distinct from `EXTERNAL_HUD_SCOPE_NOTE` because
 * this one additionally admits the reading has no street breakdown.
 */
export const EXTERNAL_HUD_GENERIC_APPLIED_PER_STREET_NOTE =
  '외부 HUD 전체 통계 · 스트리트 구분 없음 (모든 스트리트에 동일 적용)';

/**
 * WP-K §3/§7. The source reports `CBET`/`FOLD_TO_CBET`/`CHECK_RAISE` with no street
 * breakdown, stored verbatim under the dedicated `*_ANY_STREET` keys (never aliased onto a
 * per-street key at storage time — `externalHudObservations` below reads this table to ALSO
 * feed the per-street keys the existing frequency/sizing rules actually select on
 * (`CBET_FLOP/TURN/RIVER` etc.), because otherwise a generic reading would be stored and
 * displayed but never reach a single rule: none of the WP-J rule tables select on the
 * `*_ANY_STREET` keys themselves (they are `BY_STREET` selectors keyed to the per-street
 * names). Applying one number to all three streets is an honest reading of "we were not told
 * which street this happened on" — not a guess at a street-specific number — and it is
 * consistent with `EXTERNAL_HUD`'s existing per-stat precedence rule for the stats the source
 * genuinely reports per-street. Recorded as a WP-K design choice in ADR-0068, not a reopening
 * of WP-J's own `BY_STREET` selector shape.
 *
 * WHAT THE FAN-OUT MUST NOT DO (WP-K follow-up §3). A fanned-out reading is a STAND-IN for a
 * street-specific number nobody measured, so it must yield to a street-specific number somebody
 * DID measure. `EXTERNAL_HUD`'s blanket per-stat precedence in `adaptive-core`'s `profile.ts`
 * would otherwise let one lifetime `Check/Raise 17%` override a `CHECK_RAISE_RIVER` this app
 * observed itself over real river opportunities — a generic proxy beating direct evidence,
 * which inverts the whole point of the precedence rule. `externalHudObservations` therefore
 * takes the set of per-street keys already covered by a REAL reading with a real denominator
 * and skips exactly those, so the two are never both applied to one key. The `*_ANY_STREET`
 * key itself is always written regardless: that is the reading as reported, and it stays
 * visible in the profile panel whether or not it also reached a rule.
 */
const GENERIC_STAT_APPLIES_TO_STREETS: Readonly<
  Partial<Record<ExternalHudStatKey, readonly AdaptiveStatKey[]>>
> = {
  CBET_ANY_STREET: ['CBET_FLOP', 'CBET_TURN', 'CBET_RIVER'],
  FOLD_TO_CBET_ANY_STREET: ['FOLD_TO_CBET_FLOP', 'FOLD_TO_CBET_TURN', 'FOLD_TO_CBET_RIVER'],
  CHECK_RAISE_ANY_STREET: ['CHECK_RAISE_FLOP', 'CHECK_RAISE_TURN', 'CHECK_RAISE_RIVER'],
};

/* -------------------------------------------------------------------------- */
/* Mapping                                                                     */
/* -------------------------------------------------------------------------- */

/** 100% in basis points. `10000 * actions / opportunities` is a rate in this unit. */
const BPS_TOTAL = 10_000;

/**
 * Total. The MANUAL_HUD observations of one snapshot, in `HUD_STAT_KEYS` order.
 *
 * `valueBps = reading.value` is an ASSIGNMENT, NOT A CONVERSION. `CentiPercent`
 * (`player-core`'s HUD unit: hundredths of a percentage point, 0..10000) and basis points
 * are the same unit with two names, so there is no arithmetic between what the user typed
 * and what a rule sees — and therefore no rounding step that could disagree with the text
 * the panel shows back.
 *
 * THE SAMPLE IS CAPPED PER STAT, NOT PER SNAPSHOT. The snapshot carries ONE hand count, but
 * that count is the denominator of at most `VPIP` and `PFR`; every other HUD stat had a
 * fraction of those hands as real opportunities. `manualHudSampleCap(key)` is `floor(K / 2)`
 * for that stat's own `K`, which pins a HUD-only reading to at most 3333 bps confidence
 * whatever the user types — enough to move a FREQUENCY (gate 2500), never enough on its own
 * to move a bet SIZE (gate 5000 heads-up / 7500 multiway). The full argument is in
 * `adaptive-core`'s `inputs.ts`.
 *
 * The cap is applied HERE, at the mapping boundary, so the capped number is the one recorded
 * in the trace and rendered in the UI; `buildAdjustmentProfile` deliberately does not
 * re-apply it, because a function that silently rewrote its input would make the trace
 * disagree with the maths.
 *
 * Every observation carries a note. There is no `null` branch: see `HUD_HAND_SCOPE_NOTE`.
 */
function manualHudObservations(snapshot: PlayerHudSnapshot): readonly AdaptiveStatObservation[] {
  const handSample = snapshot.handSample;

  const observations: AdaptiveStatObservation[] = [];
  // Iterated in the vocabulary's own order, not the order the user typed the readings in,
  // so two identical snapshots entered in different orders produce identical bytes.
  for (const hudKey of HUD_STAT_KEYS) {
    const reading = hudStat(snapshot, hudKey);
    if (reading === undefined) continue;
    const key = MANUAL_HUD_STAT_MAP[hudKey];
    const cap = manualHudSampleCap(key);
    observations.push({
      key,
      source: 'MANUAL_HUD',
      valueBps: reading.value,
      sampleN: handSample === null ? 0 : Math.min(handSample, cap),
      note: hudObservationNote(handSample, cap),
    });
  }
  return observations;
}

/**
 * Internal. `globalStats` indexed by `(key, position)`.
 *
 * `player_model_stats` carries a unique index on both `(snapshot, key, position)` and
 * `(snapshot, key)` where the position is null, so at most one row can match a mapping.
 */
function indexGlobalStats(snapshot: PlayerModelSnapshot): ReadonlyMap<string, ModelStatCount> {
  const index = new Map<string, ModelStatCount>();
  for (const count of snapshot.globalStats) {
    index.set(`${count.key}|${count.position ?? ''}`, count);
  }
  return index;
}

/**
 * Total. The LEARNED_MODEL observations of one snapshot, in `MODEL_STAT_KEYS` order.
 *
 * `sampleN` is the stat's OWN opportunity count — a real denominator for that exact
 * situation, which is what makes a learned reading worth more per observation than a HUD's
 * shared hand count.
 *
 * A row with `opportunities === 0` produces NO observation at all. Emitting it as 0% would
 * assert that the player declines an action they were never offered, and the 0 denominator
 * would then have to be trusted to make it weightless — a fact that would be true today and
 * one refactor away from being false. Dropping the row makes it structural.
 */
function learnedModelObservations(
  snapshot: PlayerModelSnapshot,
): readonly AdaptiveStatObservation[] {
  const index = indexGlobalStats(snapshot);
  const observations: AdaptiveStatObservation[] = [];
  for (const modelKey of MODEL_STAT_KEYS) {
    const mapping = LEARNED_MODEL_STAT_MAP[modelKey];
    if (mapping === null) continue;
    const count = index.get(`${modelKey}|${mapping.position ?? ''}`);
    if (count === undefined) continue;
    if (count.opportunities === 0) continue;
    observations.push({
      key: mapping.key,
      source: 'LEARNED_MODEL',
      // `player_model_stats` CHECKs `actions <= opportunities`, so the rate is in 0..1 and
      // this lands in 0..10000 without a clamp that would hide a corrupt row.
      valueBps: Math.round((BPS_TOTAL * count.actions) / count.opportunities),
      sampleN: count.opportunities,
      note: mapping.note,
    });
  }
  return observations;
}

/**
 * Total. The EXTERNAL_HUD observations of one profile, in `EXTERNAL_HUD_STAT_KEYS` order.
 *
 * `sampleN` is ALWAYS 0 — never the reading's own confidence, never a placeholder hand
 * count. An external profile's real `n` is unknown (`sampleN` on the domain snapshot is
 * always `null`, see `@gto-self/player-core`'s `externalHud.ts`), and `adaptive-core`'s
 * `estimateFor` does not read this field's `sampleN` for `EXTERNAL_HUD` at all — it applies
 * the fixed `EXTERNAL_HUD_CONFIDENCE_BPS` instead (`profile.ts`, ADR-0067). Zero here is
 * simply the honest value for a field this source never measures.
 *
 * A stat the profile does not cover produces NO observation — the same "absence, not a
 * zero" discipline the domain snapshot itself keeps.
 */
function externalHudObservations(
  profile: PlayerExternalHudSnapshot,
  measuredPerStreetKeys: ReadonlySet<AdaptiveStatKey>,
): readonly AdaptiveStatObservation[] {
  const observations: AdaptiveStatObservation[] = [];
  for (const externalKey of EXTERNAL_HUD_STAT_KEYS) {
    const reading = externalHudStat(profile, externalKey);
    if (reading === undefined) continue;
    observations.push({
      key: EXTERNAL_HUD_STAT_MAP[externalKey],
      source: 'EXTERNAL_HUD',
      valueBps: reading.value,
      sampleN: 0,
      note: EXTERNAL_HUD_SCOPE_NOTE,
    });
    const perStreetKeys = GENERIC_STAT_APPLIES_TO_STREETS[externalKey];
    if (perStreetKeys !== undefined) {
      for (const perStreetKey of perStreetKeys) {
        // Real per-street evidence wins. See this function's table doc comment.
        if (measuredPerStreetKeys.has(perStreetKey)) continue;
        observations.push({
          key: perStreetKey,
          source: 'EXTERNAL_HUD',
          valueBps: reading.value,
          sampleN: 0,
          note: EXTERNAL_HUD_GENERIC_APPLIED_PER_STREET_NOTE,
        });
      }
    }
  }
  return observations;
}

/**
 * Total. The per-street keys some source measured DIRECTLY, with a real denominator behind it.
 *
 * `sampleN > 0` is the whole test, and it is the honest one. A MANUAL_HUD reading whose
 * snapshot carries no hand count, or a LEARNED_MODEL stat with no opportunities yet, is a key
 * that is PRESENT but weightless: `buildAdjustmentProfile` gives it a confidence of zero, so
 * letting it displace the generic stand-in would replace a usable proxy with nothing at all.
 * Only evidence that can actually move a rule is allowed to take a key away from the fan-out.
 */
function measuredPerStreetKeysOf(
  observations: readonly AdaptiveStatObservation[],
): ReadonlySet<AdaptiveStatKey> {
  const measured = new Set<AdaptiveStatKey>();
  for (const observation of observations) {
    if (observation.source === 'EXTERNAL_HUD') continue;
    if (observation.sampleN <= 0) continue;
    if (!FANNED_OUT_PER_STREET_KEYS.has(observation.key)) continue;
    measured.add(observation.key);
  }
  return measured;
}

/** Every per-street key the generic fan-out can write. Derived, never listed twice. */
const FANNED_OUT_PER_STREET_KEYS: ReadonlySet<AdaptiveStatKey> = new Set(
  Object.values(GENERIC_STAT_APPLIES_TO_STREETS).flatMap((keys) => keys ?? []),
);

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One opponent's input, or the message of the read that failed.
 *
 * A DB read failure is a FAILURE, not an empty profile: an unreadable HUD row and a player
 * with no HUD row would otherwise be indistinguishable, and the second one silently means
 * "adapt against nothing".
 */
export type AdaptiveOpponentInputResult =
  | { readonly ok: true; readonly input: AdaptiveOpponentInput }
  | { readonly ok: false; readonly message: string };

/** The whole seat lineup, all-or-nothing (see `LoadAdaptiveInputsResult` in `contract.ts`). */
export type AdaptiveInputsResult =
  | { readonly ok: true; readonly inputs: readonly AdaptiveOpponentInput[] }
  | { readonly ok: false; readonly message: string };

/**
 * Reads all three sources for one player and maps them into the neutral DTO.
 *
 * A player with NONE of the three yields `observations: []` and six `null` provenance
 * fields. That is a valid, honest answer and not an error: `buildAdjustmentProfile` turns
 * it into 20 unavailable stats with zero deviation, which is the exact state in which
 * ADAPTIVE equals REFERENCE.
 */
export function loadAdaptiveOpponentInput(
  db: GtoDatabase,
  playerId: PlayerId,
  seatIndex: number,
  nickname: string | null,
): AdaptiveOpponentInputResult {
  const hud = latestHudSnapshotForPlayer(db, playerId);
  if (!hud.ok) return { ok: false, message: `HUD could not be read: ${hud.error.message}` };

  const external = latestExternalProfileForPlayer(db, playerId);
  if (!external.ok) {
    return { ok: false, message: `external HUD profile could not be read: ${external.error.message}` };
  }

  const learned = getLatestSnapshot(db, playerId);
  if (!learned.ok) {
    return { ok: false, message: `player model could not be read: ${learned.error.message}` };
  }

  // `PlayerModelSnapshot` is a CONTENT document: `player-core` deliberately keeps the row's
  // identity out of it (ADR-0040), so the snapshot id has to come from the header list. It is
  // read only when a snapshot exists, it is headers-only (no child table is touched), and the
  // header is matched BY VERSION rather than by position — a provenance pointer that named a
  // different row from the numbers beside it would be worse than no pointer at all.
  let learnedSnapshotId: string | null = null;
  if (learned.value !== null) {
    const versions = listSnapshotVersions(db, playerId);
    if (!versions.ok) {
      return { ok: false, message: `player model could not be read: ${versions.error.message}` };
    }
    const modelVersion = learned.value.modelVersion;
    learnedSnapshotId =
      versions.value.find((header) => header.modelVersion === modelVersion)?.snapshotId ?? null;
  }

  // The two DIRECTLY measured sources are collected first, because the external fan-out has to
  // know which per-street keys they already cover (WP-K follow-up §3). Order inside the array
  // is otherwise irrelevant: `buildAdjustmentProfile` indexes by (key, source) and emits
  // sources in `ADAPTIVE_STAT_SOURCES` order, never in arrival order.
  const measuredObservations: AdaptiveStatObservation[] = [];
  if (hud.value !== null) measuredObservations.push(...manualHudObservations(hud.value));
  if (learned.value !== null) measuredObservations.push(...learnedModelObservations(learned.value));

  const observations: AdaptiveStatObservation[] = [];
  if (external.value !== null) {
    observations.push(
      ...externalHudObservations(external.value, measuredPerStreetKeysOf(measuredObservations)),
    );
  }
  observations.push(...measuredObservations);

  return {
    ok: true,
    input: {
      playerId,
      seatIndex,
      nickname,
      observations,
      manualHudSnapshotId: hud.value?.id ?? null,
      manualHudRecordedAt: hud.value?.recordedAt ?? null,
      learnedSnapshotId,
      learnedModelVersion: learned.value?.modelVersion ?? null,
      externalHudSnapshotId: external.value?.id ?? null,
      externalHudRecordedAt: external.value?.recordedAt ?? null,
    },
  };
}

/**
 * Internal. Rejects a malformed lineup before it reaches the database.
 *
 * The caller is a server action, so this list arrives from the network and is untrusted. The
 * bounds are the table's own: at most `SEAT_COUNT` seats, each a real seat index, each
 * player named once — a lineup cannot seat the same person twice, and a repeat would mean
 * the client's own seat state is wrong rather than that the player deserves two profiles.
 */
function lineupProblem(seats: readonly AdaptiveSeatInput[]): string | null {
  if (seats.length > SEAT_COUNT) {
    return `a lineup has at most ${SEAT_COUNT} seats, got ${seats.length}`;
  }
  const seen = new Set<string>();
  for (const seat of seats) {
    if (typeof seat.playerId !== 'string' || seat.playerId.length === 0) {
      return 'every seat must name a player';
    }
    if (!Number.isInteger(seat.seatIndex) || seat.seatIndex < 0 || seat.seatIndex >= SEAT_COUNT) {
      return `seat index must be an integer 0..${SEAT_COUNT - 1}, got ${String(seat.seatIndex)}`;
    }
    if (seen.has(seat.playerId)) return `player ${seat.playerId} appears in two seats`;
    seen.add(seat.playerId);
  }
  return null;
}

/**
 * Reads the whole seat lineup, in the order given.
 *
 * ALL-OR-NOTHING. One seat's failed read fails the batch, because a lineup returned with a
 * seat quietly missing is indistinguishable from a lineup in which that opponent is genuinely
 * unknown — and ADAPTIVE would then adapt against a partial table without saying so.
 *
 * A player id with no rows behind it is NOT a failure: it comes back with no observations,
 * exactly like a player who has been seated but never observed.
 */
export function loadAdaptiveOpponentInputs(
  db: GtoDatabase,
  seats: readonly AdaptiveSeatInput[],
): AdaptiveInputsResult {
  const problem = lineupProblem(seats);
  if (problem !== null) return { ok: false, message: problem };

  const inputs: AdaptiveOpponentInput[] = [];
  for (const seat of seats) {
    const loaded = loadAdaptiveOpponentInput(
      db,
      asId<'Player'>(seat.playerId),
      seat.seatIndex,
      seat.nickname,
    );
    if (!loaded.ok) return { ok: false, message: `seat ${seat.seatIndex}: ${loaded.message}` };
    inputs.push(loaded.input);
  }
  return { ok: true, inputs };
}
