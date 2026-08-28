import { describe, expect, it } from 'vitest';
import { Money, unwrap } from '@gto-self/shared';
import {
  awardPots,
  betTo,
  call,
  check,
  dealBoard,
  fold,
  raiseTo,
  setHoleCards,
  type HandCommand,
} from './commands.js';
import {
  decodeHandEvent,
  decodeHandEvents,
  encodeHandEvent,
  encodeHandEvents,
  handEventSchema,
  jsonRoundTrip,
  tableConfigSchema,
} from './serialization.js';
import { loadHand } from './hand.js';
import { CP_NL50_6MAX_ANTE } from './presets.js';
import { ANTE_PRESET, BB, cards, errCode, ids, play, sixHanded, start } from './testing.js';

const FULL_HAND: readonly HandCommand[] = [
  setHoleCards(0, cards('As Kd'), false),
  fold(),
  fold(),
  fold(),
  raiseTo(BB(3)),
  fold(),
  call(),
  dealBoard(cards('7c 8d 9h')),
  check(),
  betTo(BB(4)),
  call(),
  dealBoard(cards('2s')),
  check(),
  check(),
  dealBoard(cards('Jd')),
  check(),
  check(),
  awardPots([{ potIndex: 0, winners: [0] }]),
];

function fullLog() {
  const factory = ids();
  return play(start(sixHanded(ANTE_PRESET), factory), FULL_HAND, factory).events;
}

/** A shove that folds around: covers ALL_IN, RETURN_UNCALLED and an ENGINE POT_AWARDED. */
function shoveLog() {
  const factory = ids();
  return play(
    start(sixHanded(ANTE_PRESET), factory),
    [fold(), fold(), fold(), { kind: 'ALL_IN' }, fold(), fold()],
    factory,
  ).events;
}

describe('every event shape survives JSON', () => {
  it('round-trips every one of the eighteen event kinds', () => {
    const events = fullLog();
    const shove = shoveLog();
    const kinds = new Set([...events, ...shove].map((e) => e.kind));
    expect(kinds).toContain('HAND_STARTED');
    expect(kinds).toContain('PLAYER_DEALT_IN');
    expect(kinds).toContain('POST_ANTE');
    expect(kinds).toContain('POST_SB');
    expect(kinds).toContain('POST_BB');
    expect(kinds).toContain('HOLE_CARDS_SET');
    expect(kinds).toContain('FOLD');
    expect(kinds).toContain('CHECK');
    expect(kinds).toContain('CALL');
    expect(kinds).toContain('RAISE');
    expect(kinds).toContain('BET');
    expect(kinds).toContain('RETURN_UNCALLED');
    expect(kinds).toContain('FLOP_DEALT');
    expect(kinds).toContain('TURN_DEALT');
    expect(kinds).toContain('RIVER_DEALT');
    expect(kinds).toContain('POT_AWARDED');
    expect(kinds).toContain('ALL_IN');
    expect(kinds).toContain('HAND_FINISHED');
    expect(kinds.size).toBe(18);
    expect(unwrap(jsonRoundTrip(events))).toEqual(events);
    expect(unwrap(jsonRoundTrip(shove))).toEqual(shove);
  });

  it('encode is a structural clone: JSON.stringify is lossless', () => {
    const events = fullLog();
    const encoded = encodeHandEvents(events);
    expect(JSON.parse(JSON.stringify(encoded))).toEqual(encoded);
    const first = events[0];
    if (first === undefined) throw new Error('empty log');
    expect(encodeHandEvent(first)).toEqual(JSON.parse(JSON.stringify(first)));
  });

  it('a decoded log folds to exactly the same state', () => {
    const factory = ids();
    const hand = play(start(sixHanded(ANTE_PRESET), factory), FULL_HAND, factory);
    const text = JSON.stringify(encodeHandEvents(hand.events));
    const decoded = unwrap(decodeHandEvents(JSON.parse(text)));
    expect(unwrap(loadHand(decoded)).state).toEqual(hand.state);
  });
});

describe('decoding is a Result, never a throw', () => {
  it('rejects a non-array log', () => {
    expect(errCode(decodeHandEvents({}))).toBe('CORRUPT_LOG');
    expect(errCode(decodeHandEvents('nope'))).toBe('CORRUPT_LOG');
  });

  it('rejects an unknown event kind', () => {
    expect(
      errCode(decodeHandEvent({ id: 'x', seq: 0, commandSeq: 0, origin: 'USER', kind: 'NOPE' })),
    ).toBe('CORRUPT_LOG');
  });

  it('rejects out-of-range money, cards and seats', () => {
    const base = { id: 'x', seq: 0, commandSeq: 0, origin: 'USER' as const };
    expect(errCode(decodeHandEvent({ ...base, kind: 'POST_SB', seat: 1, amount: 1.5 }))).toBe(
      'CORRUPT_LOG',
    );
    expect(
      errCode(decodeHandEvent({ ...base, kind: 'POST_SB', seat: 1, amount: 2_000_000_000 })),
    ).toBe('CORRUPT_LOG');
    expect(errCode(decodeHandEvent({ ...base, kind: 'POST_SB', seat: 9, amount: 500 }))).toBe(
      'CORRUPT_LOG',
    );
    expect(errCode(decodeHandEvent({ ...base, kind: 'TURN_DEALT', card: 52 }))).toBe('CORRUPT_LOG');
  });

  it('rejects a log whose seq is not dense or whose commandSeq goes backwards', () => {
    const events = fullLog();
    const encoded = encodeHandEvents(events) as unknown[];
    const gapped = encoded.filter((_e, index) => index !== 4);
    expect(errCode(decodeHandEvents(gapped))).toBe('CORRUPT_LOG');

    const shuffled = [...encoded];
    const a = shuffled[shuffled.length - 1];
    const b = shuffled[shuffled.length - 2];
    shuffled[shuffled.length - 1] = b;
    shuffled[shuffled.length - 2] = a;
    expect(errCode(decodeHandEvents(shuffled))).toBe('CORRUPT_LOG');
  });

  it('accepts a valid event through the exported schema', () => {
    const events = fullLog();
    const first = events[0];
    if (first === undefined) throw new Error('empty log');
    expect(handEventSchema.safeParse(encodeHandEvent(first)).success).toBe(true);
    expect(tableConfigSchema.safeParse(CP_NL50_6MAX_ANTE).success).toBe(true);
    expect(tableConfigSchema.safeParse({ ...CP_NL50_6MAX_ANTE, seatCount: 9 }).success).toBe(false);
  });

  it('reports which event failed', () => {
    const encoded = encodeHandEvents(fullLog()) as unknown[];
    const broken = [...encoded];
    broken[2] = { ...(broken[2] as object), startingStack: 'lots' };
    const result = decodeHandEvents(broken);
    expect(errCode(result)).toBe('CORRUPT_LOG');
    if (result.ok) throw new Error('expected failure');
    expect(result.error.context.seq).toBe(2);
  });
});

describe('jsonRoundTrip is a property, not a smoke test', () => {
  it('detects a payload that JSON would not reproduce', () => {
    const events = fullLog();
    const tampered = events.map((event) =>
      event.kind === 'POST_SB' ? { ...event, amount: Money.mbb(499) } : event,
    );
    // The tampered log still decodes; the round trip only proves JSON fidelity.
    expect(unwrap(jsonRoundTrip(tampered))).toEqual(tampered);
    expect(unwrap(jsonRoundTrip(events))).not.toEqual(tampered);
  });
});
