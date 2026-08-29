/**
 * Form state -> `TableState`. The whole of the setup form's decision-making, as PURE
 * functions with no React and no I/O, so it is directly testable and so the same code runs
 * on the client (for inline feedback) and on the server (authoritatively).
 *
 * Two rules shape this file:
 *
 * - **No poker rules live here.** Whether a seat can hold a player, whether a stack is
 *   legal, whether the button may sit where it does, and how many seats a hand needs are
 *   all decided by `poker-core` and its errors are surfaced verbatim. This module only
 *   decides what the FORM means: which text belongs to which seat, which fields are still
 *   blank, and which two seats name the same person.
 * - **Nothing typed is rewritten.** A stack that will not parse produces an issue against
 *   its seat; the entered text is the caller's to keep on screen (`CLAUDE.md` rule 3).
 */
import { Money, asId } from '@gto-self/shared';
import type { MilliBB, PlayerId } from '@gto-self/shared';
import {
  MAX_NICKNAME_LENGTH,
  MAX_HAND_SAMPLE,
  isHudStatKey,
  normalizeNickname,
} from '@gto-self/player-core';
import type { HudStatKey } from '@gto-self/player-core';
import {
  PRESETS,
  SEAT_INDEXES,
  advanceButton,
  createTable,
  isSeatIndex,
  seatPlayer,
  setButtonSeat,
  setHeroSeat,
  setSeatOccupancy,
  withAnteEnabled,
} from '@gto-self/poker-core';
import type {
  AutoTopUpPolicy,
  EngineError,
  SeatIndex,
  TableConfig,
  TableState,
} from '@gto-self/poker-core';
import type { FormIssue, SeatFormValue, SessionFormValue } from './contract.js';

/** One seat that will actually be seated, with its text resolved into domain values. */
export interface SeatPlan {
  readonly seat: SeatIndex;
  readonly occupancy: 'ACTIVE' | 'SITTING_OUT';
  /** The entered nickname, verbatim. `createPlayer` owns trimming and validation. */
  readonly nickname: string;
  /** Non-null when the user picked an existing player from the autocomplete. */
  readonly existingPlayerId: string | null;
  readonly stack: MilliBB;
  readonly isHero: boolean;
  /** Only the stats the user actually filled in. Empty means "no snapshot for this seat". */
  readonly hud: readonly { readonly key: HudStatKey; readonly enteredText: string }[];
  /** `null` is "the HUD showed no sample", never zero. */
  readonly hudHandSample: number | null;
}

export interface SessionPlan {
  /** The shipped preset the session was created from, unmodified. */
  readonly preset: TableConfig;
  /** The preset with the ante toggle applied. This is what the session runs on. */
  readonly config: TableConfig;
  readonly label: string | null;
  readonly buttonSeat: SeatIndex;
  readonly heroSeat: SeatIndex;
  readonly seats: readonly SeatPlan[];
  /** `null` when the session records no auto top-up policy at all. */
  readonly autoTopUp: AutoTopUpPolicy | null;
}

export type PlanResult =
  | { readonly ok: true; readonly value: SessionPlan }
  | { readonly ok: false; readonly issues: readonly FormIssue[] };

export type TableResult =
  | { readonly ok: true; readonly value: TableState }
  | { readonly ok: false; readonly issues: readonly FormIssue[] };

const issue = (
  seat: SeatIndex | null,
  field: string,
  message: string,
  code: string | null = null,
): FormIssue => ({ seat, field, message, code });

/** An engine rejection, kept whole: its own code, its own message, its own seat. */
export function fromEngineError(error: EngineError, field: string): FormIssue {
  return issue(error.context.seat ?? null, field, error.message, error.code);
}

/** The shipped preset with this id, or `undefined`. */
export function findPreset(presetId: string): TableConfig | undefined {
  return PRESETS.find((preset) => preset.presetId === presetId);
}

/** A blank seat, for the form's initial state. */
export function emptySeatForm(): SeatFormValue {
  return {
    occupancy: 'EMPTY',
    nickname: '',
    existingPlayerId: null,
    stackText: '',
    isHero: false,
    hud: {},
    hudHandsText: '',
  };
}

/**
 * The form the page opens with: the ante preset, three seated players' worth of blank
 * seats, and every stack pre-filled with the preset's reference stack as TEXT — the user
 * can retype it, and nothing is derived from it behind their back.
 */
export function initialSessionForm(preset: TableConfig): SessionFormValue {
  const stackText = Money.formatBB(preset.referenceStack);
  return {
    presetId: preset.presetId,
    anteEnabled: preset.ante.enabled,
    label: '',
    buttonSeat: 0,
    autoTopUpEnabled: false,
    autoTopUpTargetText: stackText,
    seats: SEAT_INDEXES.map((seat) => ({
      ...emptySeatForm(),
      occupancy: 'ACTIVE' as const,
      stackText,
      isHero: seat === 0,
    })),
  };
}

/** Internal. The optional HUD reading for one seat, or an issue per bad field. */
function planHud(
  seat: SeatIndex,
  value: SeatFormValue,
  issues: FormIssue[],
): { readonly hud: SeatPlan['hud']; readonly handSample: number | null } {
  const hud: { key: HudStatKey; enteredText: string }[] = [];
  for (const [key, text] of Object.entries(value.hud)) {
    if (text === undefined || text.trim() === '') continue;
    if (!isHudStatKey(key)) {
      issues.push(issue(seat, `hud.${key}`, `unknown HUD stat "${key}"`, 'UNKNOWN_STAT'));
      continue;
    }
    hud.push({ key, enteredText: text });
  }

  const sampleText = value.hudHandsText.trim();
  let handSample: number | null = null;
  if (sampleText !== '') {
    const parsed = Number(sampleText);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_HAND_SAMPLE) {
      issues.push(
        issue(
          seat,
          'hudHandsText',
          `HUD hands must be a whole number 0..${MAX_HAND_SAMPLE}, or blank`,
          'INVALID_SAMPLE_SIZE',
        ),
      );
    } else {
      handSample = parsed;
    }
  }
  // A sample with no stats is not a snapshot: `createHudSnapshot` rejects an empty one, so
  // the seat simply records none rather than a snapshot invented from the sample alone.
  return { hud, handSample: hud.length === 0 ? null : handSample };
}

/**
 * Reads the whole form and reports EVERY problem it can see, not just the first: a setup
 * screen that fixes one field at a time is slower than the thing it is configuring.
 *
 * Money is parsed here with `Money.parseBB` and the parser's own message is used verbatim.
 */
export function planSession(form: SessionFormValue): PlanResult {
  const issues: FormIssue[] = [];

  const preset = findPreset(form.presetId);
  if (preset === undefined) {
    issues.push(issue(null, 'presetId', `unknown preset "${form.presetId}"`, 'INVALID_CONFIG'));
  }

  if (form.seats.length !== SEAT_INDEXES.length) {
    issues.push(issue(null, 'seats', `expected ${SEAT_INDEXES.length} seats`, null));
    return { ok: false, issues };
  }

  const seats: SeatPlan[] = [];
  const normalizedSeen = new Map<string, SeatIndex>();
  const playerIdSeen = new Map<string, SeatIndex>();

  for (const seat of SEAT_INDEXES) {
    const value = form.seats[seat];
    if (value === undefined) continue;
    if (value.occupancy === 'EMPTY') {
      if (value.isHero) {
        issues.push(issue(seat, 'isHero', 'an empty seat cannot be Hero', null));
      }
      continue;
    }

    const normalized = normalizeNickname(value.nickname);
    if (normalized === '') {
      issues.push(issue(seat, 'nickname', 'a seated player needs a nickname', 'EMPTY_NAME'));
    } else if (value.nickname.trim().length > MAX_NICKNAME_LENGTH) {
      issues.push(
        issue(
          seat,
          'nickname',
          `a nickname may be at most ${MAX_NICKNAME_LENGTH} characters`,
          'NAME_TOO_LONG',
        ),
      );
    } else {
      const clash = normalizedSeen.get(normalized);
      if (clash !== undefined) {
        issues.push(
          issue(
            seat,
            'nickname',
            `"${value.nickname}" is already seated at seat ${clash + 1}; one player cannot occupy two seats`,
            'DUPLICATE_PLAYER',
          ),
        );
      } else {
        normalizedSeen.set(normalized, seat);
      }
    }

    if (value.existingPlayerId !== null) {
      const clash = playerIdSeen.get(value.existingPlayerId);
      if (clash !== undefined) {
        issues.push(
          issue(
            seat,
            'nickname',
            `that player is already seated at seat ${clash + 1}`,
            'DUPLICATE_PLAYER',
          ),
        );
      } else {
        playerIdSeen.set(value.existingPlayerId, seat);
      }
    }

    const stack = Money.parseBB(value.stackText);
    const { hud, handSample } = planHud(seat, value, issues);
    if (!stack.ok) {
      issues.push(issue(seat, 'stackText', `stack in BB: ${stack.error}`, 'AMOUNT_OUT_OF_RANGE'));
      continue;
    }

    seats.push({
      seat,
      occupancy: value.occupancy,
      nickname: value.nickname,
      existingPlayerId: value.existingPlayerId,
      stack: stack.value,
      isHero: value.isHero,
      hud,
      hudHandSample: handSample,
    });
  }

  const heroes = form.seats
    .map((value, index) => ({ value, seat: index }))
    .filter((entry) => entry.value?.isHero === true && entry.value.occupancy !== 'EMPTY');
  if (heroes.length === 0) {
    issues.push(issue(null, 'heroSeat', 'choose which seat is Hero', null));
  } else if (heroes.length > 1) {
    issues.push(
      issue(
        null,
        'heroSeat',
        `Hero is a single seat, but seats ${heroes.map((h) => h.seat + 1).join(' and ')} are both marked Hero`,
        null,
      ),
    );
  }
  const heroEntry = heroes[0];
  if (heroes.length === 1 && heroEntry !== undefined && heroEntry.value?.occupancy !== 'ACTIVE') {
    issues.push(
      issue(
        isSeatIndex(heroEntry.seat) ? heroEntry.seat : null,
        'isHero',
        'Hero must be an active seat',
        null,
      ),
    );
  }

  if (form.buttonSeat === null) {
    issues.push(issue(null, 'buttonSeat', 'choose the button seat', null));
  } else if (form.seats[form.buttonSeat]?.occupancy !== 'ACTIVE') {
    issues.push(issue(null, 'buttonSeat', 'the button must sit on an active seat', null));
  }

  let autoTopUp: AutoTopUpPolicy | null = null;
  if (form.autoTopUpEnabled) {
    const target = Money.parseBB(form.autoTopUpTargetText);
    if (!target.ok) {
      issues.push(issue(null, 'autoTopUpTargetText', `top-up target in BB: ${target.error}`, null));
    } else if (target.value <= 0) {
      issues.push(
        issue(
          null,
          'autoTopUpTargetText',
          'the top-up target must be positive',
          'STACK_NOT_POSITIVE',
        ),
      );
    } else {
      // Phase 4 has no threshold control; `threshold = targetStack` is exactly the shape
      // `defaultAutoTopUpPolicy` produces. Phase 8 owns the editable threshold.
      autoTopUp = { enabled: true, targetStack: target.value, threshold: target.value };
    }
  }

  if (issues.length > 0 || preset === undefined) return { ok: false, issues };
  const heroSeat = heroEntry === undefined ? null : heroEntry.seat;
  if (heroSeat === null || !isSeatIndex(heroSeat) || form.buttonSeat === null) {
    return { ok: false, issues: [issue(null, 'form', 'the form is incomplete', null)] };
  }

  const label = form.label.trim();
  return {
    ok: true,
    value: {
      preset,
      config: withAnteEnabled(preset, form.anteEnabled),
      label: label === '' ? null : label,
      buttonSeat: form.buttonSeat,
      heroSeat,
      seats,
      autoTopUp,
    },
  };
}

/**
 * The plan through the engine, one `EngineResult` at a time. EVERY call is checked and its
 * error is returned as-is: the engine decides whether this configuration is playable, and
 * the user sees what the engine said.
 *
 * `playerIdForSeat` is supplied by the caller because ids come from outside the domain
 * (ADR-0007) — the server resolves real ones, a test supplies deterministic ones.
 */
export function buildTableState(
  plan: SessionPlan,
  playerIdForSeat: (seat: SeatIndex) => PlayerId,
): TableResult {
  const created = createTable(plan.config);
  if (!created.ok) return { ok: false, issues: [fromEngineError(created.error, 'presetId')] };
  let table = created.value;

  for (const seat of plan.seats) {
    const seated = seatPlayer(table, seat.seat, playerIdForSeat(seat.seat), seat.stack);
    if (!seated.ok) return { ok: false, issues: [fromEngineError(seated.error, 'stackText')] };
    table = seated.value;
  }

  // Occupancy AFTER seating: `seatPlayer` seats a player ACTIVE, and the button must be
  // placed after any seat has been moved to SITTING_OUT (that move clears the button).
  for (const seat of plan.seats) {
    if (seat.occupancy !== 'SITTING_OUT') continue;
    const changed = setSeatOccupancy(table, seat.seat, 'SITTING_OUT');
    if (!changed.ok) return { ok: false, issues: [fromEngineError(changed.error, 'occupancy')] };
    table = changed.value;
  }

  const hero = setHeroSeat(table, plan.heroSeat);
  if (!hero.ok) return { ok: false, issues: [fromEngineError(hero.error, 'isHero')] };
  table = hero.value;

  const button = setButtonSeat(table, plan.buttonSeat);
  if (!button.ok) return { ok: false, issues: [fromEngineError(button.error, 'buttonSeat')] };
  table = button.value;

  // "Are there enough players?" is the ENGINE's rule, not React's. `advanceButton` is the
  // function that owns it; its result is discarded and only its verdict is used, so the
  // button the user chose is the button that is stored.
  const playable = advanceButton(table);
  if (!playable.ok) return { ok: false, issues: [fromEngineError(playable.error, 'seats')] };

  return { ok: true, value: table };
}

/** `planSession` then `buildTableState`. The whole form-to-engine path in one call. */
export function buildSessionTable(
  form: SessionFormValue,
  playerIdForSeat: (seat: SeatIndex) => PlayerId,
):
  | { readonly ok: true; readonly plan: SessionPlan; readonly table: TableState }
  | { readonly ok: false; readonly issues: readonly FormIssue[] } {
  const planned = planSession(form);
  if (!planned.ok) return planned;
  const table = buildTableState(planned.value, playerIdForSeat);
  if (!table.ok) return table;
  return { ok: true, plan: planned.value, table: table.value };
}

/**
 * Placeholder ids for the CLIENT's validation preview only. The preview needs a table to
 * ask the engine about, but the client never resolves or invents a real `PlayerId` — the
 * server action does that against the database.
 */
export const previewPlayerId = (seat: SeatIndex): PlayerId =>
  asId<'Player'>(`preview-seat-${seat}`);
