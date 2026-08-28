/**
 * The JSON / SQLite boundary. Zod schemas validate foreign data (DB rows, parser output,
 * fixtures) before it ever reaches the reducer, which is why `decode*` returns a Result
 * and never throws.
 */
import { z } from 'zod';
import { asId, Money, ok, type Card, type MilliBB } from '@gto-self/shared';
import { engineErr, type EngineResult } from './errors.js';
import type { HandEvent } from './events.js';
import type { TableConfig } from './config.js';

export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

const money = z
  .number()
  .int()
  .refine((value) => Math.abs(value) <= Money.MAX_MILLI_BB, {
    message: `money must be within +/-${Money.MAX_MILLI_BB} milliBB`,
  })
  .transform((value) => value as MilliBB);

const card = z
  .number()
  .int()
  .min(0)
  .max(51)
  .transform((value) => value as Card);

const seat = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const eventId = z.string().transform((value) => asId<'Event'>(value));
const handId = z.string().transform((value) => asId<'Hand'>(value));
const playerId = z.string().transform((value) => asId<'Player'>(value));

const roundingMode = z.enum(['floor', 'ceil', 'round', 'exact']);

const tableConfigShape = z.object({
  presetId: z.string(),
  label: z.string(),
  seatCount: z.literal(6),
  blinds: z.object({ smallBlind: money, bigBlind: money }),
  minBet: money,
  ante: z.object({
    enabled: z.boolean(),
    mode: z.enum(['PER_DEALT_IN_PLAYER']),
    amount: money,
  }),
  rake: z.object({
    numerator: z.number().int(),
    denominator: z.number().int(),
    cap: money,
    rounding: roundingMode,
    noFlopNoDrop: z.boolean(),
    allocation: z.enum(['PROPORTIONAL', 'MAIN_POT_FIRST']),
  }),
  rules: z.object({
    shortAllInMinRaiseBasis: z.enum(['CURRENT_BET', 'LAST_FULL_RAISE']),
    shortBlindSetsFullLevel: z.boolean(),
    bigBlindHasOption: z.boolean(),
    headsUpButtonPostsSmallBlind: z.boolean(),
    headsUpButtonLabel: z.enum(['BTN', 'SB']),
    allowRaiseWithNoCaller: z.boolean(),
    oddChipRule: z.enum(['FIRST_LEFT_OF_BUTTON', 'LOWEST_SEAT_INDEX']),
  }),
  referenceStack: money,
  display: z.object({ bigBlindValue: z.number(), symbol: z.string() }),
});

/** Schema for a persisted `TableConfig`. */
export const tableConfigSchema = tableConfigShape as unknown as z.ZodType<TableConfig>;

const meta = {
  id: eventId,
  seq: z.number().int().min(0),
  commandSeq: z.number().int().min(0),
  origin: z.enum(['USER', 'ENGINE']),
};

const potShare = z.object({ seat, amount: money });

const wagerShape = { seat, toAmount: money, amount: money };

const handEventUnion = z.discriminatedUnion('kind', [
  z.object({
    ...meta,
    kind: z.literal('HAND_STARTED'),
    handId,
    handNumber: z.number().int(),
    config: tableConfigShape,
    buttonSeat: seat,
    heroSeat: seat.nullable(),
  }),
  z.object({
    ...meta,
    kind: z.literal('PLAYER_DEALT_IN'),
    seat,
    playerId: playerId.nullable(),
    startingStack: money,
  }),
  z.object({ ...meta, kind: z.literal('POST_ANTE'), seat, amount: money }),
  z.object({ ...meta, kind: z.literal('POST_SB'), seat, amount: money }),
  z.object({ ...meta, kind: z.literal('POST_BB'), seat, amount: money }),
  z.object({
    ...meta,
    kind: z.literal('HOLE_CARDS_SET'),
    seat,
    cards: z.array(card),
    revealed: z.boolean(),
  }),
  z.object({ ...meta, kind: z.literal('FOLD'), seat }),
  z.object({ ...meta, kind: z.literal('CHECK'), seat }),
  z.object({ ...meta, kind: z.literal('CALL'), ...wagerShape }),
  z.object({ ...meta, kind: z.literal('BET'), ...wagerShape }),
  z.object({ ...meta, kind: z.literal('RAISE'), ...wagerShape }),
  z.object({ ...meta, kind: z.literal('ALL_IN'), ...wagerShape }),
  z.object({ ...meta, kind: z.literal('RETURN_UNCALLED'), seat, amount: money }),
  z.object({ ...meta, kind: z.literal('FLOP_DEALT'), cards: z.tuple([card, card, card]) }),
  z.object({ ...meta, kind: z.literal('TURN_DEALT'), card }),
  z.object({ ...meta, kind: z.literal('RIVER_DEALT'), card }),
  z.object({
    ...meta,
    kind: z.literal('POT_AWARDED'),
    potIndex: z.number().int().min(0),
    winners: z.array(seat),
    grossAmount: money,
    rake: money,
    netAmount: money,
    shares: z.array(potShare),
  }),
  z.object({
    ...meta,
    kind: z.literal('HAND_FINISHED'),
    reason: z.enum(['ALL_FOLDED', 'SHOWDOWN']),
    totalRake: money,
  }),
]);

/** Schema for one persisted `HandEvent`. */
export const handEventSchema = handEventUnion as unknown as z.ZodType<HandEvent>;

/** The type the schema actually produces. */
export type SerializedHandEvent = z.infer<typeof handEventUnion>;

/**
 * Compile-time proof that decoding produces a value the reducer accepts. If a payload
 * gains a field and the schema does not, this stops compiling.
 */
export const decodedEventIsHandEvent = (event: SerializedHandEvent): HandEvent => event;

/**
 * Total. Structurally a clone — every branded type is already a JSON primitive. It
 * exists so the DB layer has one named boundary.
 */
export function encodeHandEvent(event: HandEvent): JsonValue {
  return JSON.parse(JSON.stringify(event)) as JsonValue;
}

/** Total. `encodeHandEvent` over a log. */
export function encodeHandEvents(events: readonly HandEvent[]): readonly JsonValue[] {
  return events.map(encodeHandEvent);
}

/** Result. NEVER throws. Foreign data is expected to be wrong sometimes. */
export function decodeHandEvent(raw: unknown): EngineResult<HandEvent> {
  const parsed = handEventUnion.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return engineErr(
      'CORRUPT_LOG',
      issue === undefined
        ? 'The event does not match any known event shape'
        : `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
  }
  return ok(parsed.data);
}

/**
 * Result. Also checks that `seq` is dense and ascending from 0 and that `commandSeq` is
 * non-decreasing.
 */
export function decodeHandEvents(raw: unknown): EngineResult<readonly HandEvent[]> {
  if (!Array.isArray(raw)) {
    return engineErr('CORRUPT_LOG', 'A hand log must be an array of events');
  }
  const events: HandEvent[] = [];
  let previousCommandSeq = -1;
  for (let index = 0; index < raw.length; index += 1) {
    const decoded = decodeHandEvent(raw[index]);
    if (!decoded.ok) {
      return engineErr('CORRUPT_LOG', `Event ${index}: ${decoded.error.message}`, { seq: index });
    }
    const event = decoded.value;
    if (event.seq !== index) {
      return engineErr('CORRUPT_LOG', `Event seq ${event.seq} is not dense at index ${index}`, {
        seq: event.seq,
        eventKind: event.kind,
      });
    }
    if (event.commandSeq < previousCommandSeq) {
      return engineErr(
        'CORRUPT_LOG',
        `Event commandSeq ${event.commandSeq} decreases at seq ${event.seq}`,
        { seq: event.seq, eventKind: event.kind },
      );
    }
    previousCommandSeq = event.commandSeq;
    events.push(event);
  }
  return ok(events);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonical(source[key]);
    return out;
  }
  return value;
}

/**
 * Result. `JSON.parse(JSON.stringify(encode(...)))` then decode, asserting deep equality.
 * Exported (not test-only) so Phase 3's DB integration tests can assert the property
 * against real rows.
 */
export function jsonRoundTrip(events: readonly HandEvent[]): EngineResult<readonly HandEvent[]> {
  const text = JSON.stringify(encodeHandEvents(events));
  const decoded = decodeHandEvents(JSON.parse(text));
  if (!decoded.ok) return decoded;
  if (JSON.stringify(canonical(decoded.value)) !== JSON.stringify(canonical(events))) {
    return engineErr('CORRUPT_LOG', 'The JSON round trip did not reproduce the event log');
  }
  return ok(decoded.value);
}
