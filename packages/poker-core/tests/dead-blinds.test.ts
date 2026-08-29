/**
 * Dead blinds and the manual SB/BB assignment override (ADR-0031).
 *
 * Both are NEUTRAL primitives. Nothing here asserts a CoinPoker missed-blind or
 * dead-button rule, because neither is implemented: a dead blind exists only when the
 * caller states one, and the blind seats move only when the caller names them.
 *
 * The load-bearing rules, hand-derived from real NLHE and docs/POKER_CORE_API.md:
 *
 *   1. A dead blind is dead money. It reaches the pot and the side-pot layering basis,
 *      it never lowers what the seat owes to call, and it can put the seat all in.
 *   2. Preflop, the big blind acts last; postflop, the button acts last. Those two
 *      anchors are what the override has to keep true.
 *   3. Nothing invents a position name. A lineup the six labels cannot describe is
 *      refused.
 */
import { describe, expect, it } from 'vitest';
import { asId, Money, type HandId, type IdFactory, type MilliBB } from '@gto-self/shared';
import { callAmount } from '../src/betting.js';
import { fold, dealBoard, type DeadBlindPost, type StartHandOptions } from '../src/commands.js';
import { loadHand, replayHand, startHand, undo, type Hand } from '../src/hand.js';
import type { BlindSeatOverride } from '../src/positions.js';
import type { SeatIndex } from '../src/seat.js';
import type { HandEvent } from '../src/events.js';
import { jsonRoundTrip } from '../src/serialization.js';
import type { HandState } from '../src/state.js';
import { foldEvents } from '../src/reduce.js';
import type { TableState } from '../src/table.js';
import { ANTE_PRESET, BB, buildTable, cards, errCode, ids, NO_ANTE_PRESET } from '../src/testing.js';
import { awardAllTo, seatMoney, step } from './_helpers.js';

const HAND_ID = asId<'Hand'>('h1') as HandId;

interface StartSpec {
  readonly blindOverride?: BlindSeatOverride | null;
  readonly deadBlinds?: readonly DeadBlindPost[];
  readonly buttonSeat?: SeatIndex;
}

function options(spec: StartSpec): StartHandOptions {
  return { handId: HAND_ID, ...spec };
}

/** Starts a hand with the full option set, failing loudly with the engine's own code. */
function begin(table: TableState, factory: IdFactory, spec: StartSpec = {}): Hand {
  const result = startHand(table, options(spec), factory);
  if (!result.ok) {
    throw new Error(`startHand was rejected: ${result.error.code} — ${result.error.message}`);
  }
  return result.value;
}

/** Six 100 BB stacks, button on seat 0, no ante unless a config is supplied. */
function sixSeats(config = NO_ANTE_PRESET, stacks?: Readonly<Partial<Record<SeatIndex, MilliBB>>>) {
  return buildTable({
    config,
    stacks: stacks ?? { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
    buttonSeat: 0,
  });
}

/** `kind:seat` for every posting event, in log order. */
function postLog(events: readonly HandEvent[]): readonly string[] {
  return events
    .filter(
      (e) =>
        e.kind === 'POST_ANTE' ||
        e.kind === 'POST_DEAD_BLIND' ||
        e.kind === 'POST_SB' ||
        e.kind === 'POST_BB',
    )
    .map((e) => `${e.kind}:${'seat' in e ? e.seat : ''}`);
}

/** Every event except its id — ids differ per factory by design (ADR-0007). */
function payloads(events: readonly HandEvent[]): readonly unknown[] {
  return events.map(({ id: _id, ...rest }) => rest);
}

const label = (state: HandState, seat: SeatIndex): string | null =>
  state.positions[seat]?.position ?? null;

const labelsOf = (state: HandState, seats: readonly SeatIndex[]): readonly (string | null)[] =>
  seats.map((seat) => label(state, seat));

// ---------------------------------------------------------------------------
// 1. Accounting: a dead blind is an ante that only some seats post.
// ---------------------------------------------------------------------------

describe('POST_DEAD_BLIND accounting', () => {
  it('adds to the pot and to dead/total contribution without lowering the call', () => {
    const f = ids();
    // Ante preset: 160 milliBB per dealt-in seat. Seat 4 also owes a dead 1 BB.
    const hand = begin(sixSeats(ANTE_PRESET), f, { deadBlinds: [{ seat: 4, amount: BB(1) }] });
    const st = hand.state;

    // 6 x 160 antes + 1000 dead + 500 SB + 1000 BB.
    expect(st.potTotal).toBe(960 + 1000 + 500 + 1000);

    // Seat 4 paid 160 + 1000, all of it dead: streetContribution is untouched.
    expect(seatMoney(st, 4)).toEqual({ stack: 100000 - 1160, street: 0, total: 1160 });
    expect(st.seats[4].deadContribution).toBe(1160);
    expect(st.seats[4].status).toBe('IN_HAND');

    // The price of entry is one big blind for everyone. Dead money is not a part-call:
    // seat 4 still owes the full 1000, exactly like seat 3 which posted no dead blind.
    expect(st.round.currentBet).toBe(1000);
    expect(callAmount(st, 4)).toBe(1000);
    expect(callAmount(st, 3)).toBe(1000);
    expect(callAmount(st, 2)).toBe(0);

    // A seat with no dead blind is completely unaffected.
    expect(seatMoney(st, 3)).toEqual({ stack: 100000 - 160, street: 0, total: 160 });
    expect(st.seats[3].deadContribution).toBe(160);
  });

  it('posts after the antes and before the live blinds, in ring order from the SB', () => {
    const f = ids();
    const hand = begin(sixSeats(ANTE_PRESET), f, {
      // Supplied out of ring order on purpose: the log order is the engine's, not ours.
      deadBlinds: [
        { seat: 5, amount: BB(1) },
        { seat: 0, amount: Money.mbb(500) },
        { seat: 3, amount: BB(1) },
      ],
    });
    expect(postLog(hand.events)).toEqual([
      'POST_ANTE:1',
      'POST_ANTE:2',
      'POST_ANTE:3',
      'POST_ANTE:4',
      'POST_ANTE:5',
      'POST_ANTE:0',
      // Ring order from the small blind (seat 1): 3, then 5, then 0.
      'POST_DEAD_BLIND:3',
      'POST_DEAD_BLIND:5',
      'POST_DEAD_BLIND:0',
      'POST_SB:1',
      'POST_BB:2',
    ]);
    // 6 x 160 + 1000 + 1000 + 500 dead + 500 SB + 1000 BB.
    expect(hand.state.potTotal).toBe(960 + 2500 + 1500);
  });

  it('is dead money even for the seat that also posts a live blind', () => {
    const f = ids();
    const hand = begin(sixSeats(), f, { deadBlinds: [{ seat: 1, amount: Money.mbb(500) }] });
    const st = hand.state;
    // Seat 1 is the small blind: 500 dead + 500 live.
    expect(seatMoney(st, 1)).toEqual({ stack: 100000 - 1000, street: 500, total: 1000 });
    expect(st.seats[1].deadContribution).toBe(500);
    // It still owes the other half of the big blind — the dead 500 buys nothing.
    expect(callAmount(st, 1)).toBe(500);
  });

  it('records the ACTUAL clamped amount and leaves the seat ALL_IN when it takes the stack', () => {
    const f = ids();
    // Seat 4 has 0.3 BB and is asked for a dead 1 BB.
    const table = sixSeats(NO_ANTE_PRESET, {
      0: BB(100),
      1: BB(100),
      2: BB(100),
      3: BB(100),
      4: Money.mbb(300),
      5: BB(100),
    });
    let hand = begin(table, f, { deadBlinds: [{ seat: 4, amount: BB(1) }] });

    const posted = hand.events.find((e) => e.kind === 'POST_DEAD_BLIND');
    expect(posted?.kind === 'POST_DEAD_BLIND' ? posted.amount : null).toBe(300);
    expect(seatMoney(hand.state, 4)).toEqual({ stack: 0, street: 0, total: 300 });
    expect(hand.state.seats[4].status).toBe('ALL_IN');
    expect(hand.state.seats[4].deadContribution).toBe(300);
    expect(hand.state.potTotal).toBe(300 + 500 + 1000);

    // An all-in seat is never on the clock. UTG (seat 3) opens.
    expect(hand.state.actorSeat).toBe(3);
    hand = step(hand, fold(), f); // UTG
    expect(hand.state.actorSeat).toBe(5); // seat 4 is all-in and skipped
    hand = step(hand, fold(), f); // CO
    hand = step(hand, fold(), f); // BTN
    hand = step(hand, fold(), f); // SB

    // The big blind's 1000 is uncalled down to the folded small blind's 500.
    expect(seatMoney(hand.state, 2)).toEqual({ stack: 100000 - 500, street: 500, total: 500 });
    expect(hand.state.potTotal).toBe(300 + 500 + 500);
    expect(hand.state.phase).toBe('AWAITING_BOARD');

    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);

    // Levels 300 / 500. Seat 4 funded exactly the 300 layer: 3 contributors x 300 = 900,
    // and it is eligible for that layer and no other.
    const pots = hand.state.pots;
    expect(pots).toHaveLength(2);
    expect(pots[0]?.amount).toBe(900);
    expect(pots[0]?.eligibleSeats).toEqual([2, 4]);
    expect(pots[1]?.amount).toBe(400);
    expect(pots[1]?.eligibleSeats).toEqual([2]);

    // A CLAMPED post must survive a strict replay: the log carries the actual 300, and
    // re-clamping 300 against a 300 stack is idempotent.
    const replayed = replayHand(hand.events);
    expect(errCode(replayed)).toBeUndefined();
    if (!replayed.ok) return;
    expect(payloads(replayed.value.events)).toEqual(payloads(hand.events));
  });

  it('emits no event at all when the ante already took the whole stack', () => {
    const f = ids();
    // Seat 4 has exactly one ante (160) and is all in before the dead blind is reached.
    const table = sixSeats(ANTE_PRESET, {
      0: BB(100),
      1: BB(100),
      2: BB(100),
      3: BB(100),
      4: Money.mbb(160),
      5: BB(100),
    });
    const hand = begin(table, f, { deadBlinds: [{ seat: 4, amount: BB(1) }] });

    expect(hand.events.some((e) => e.kind === 'POST_DEAD_BLIND')).toBe(false);
    expect(hand.state.seats[4].status).toBe('ALL_IN');
    expect(hand.state.seats[4].totalContribution).toBe(160);
    // No chips moved, so nothing was recorded — and the log still replays strictly.
    expect(replayHand(hand.events).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. The standing invariants, checked independently after every single event.
// ---------------------------------------------------------------------------

describe('conservation through a full hand containing a dead blind', () => {
  it('holds the chip and seat-ledger identities after every event', () => {
    const f = ids();
    const table = sixSeats(ANTE_PRESET, {
      0: BB(100),
      1: BB(100),
      2: BB(100),
      3: BB(100),
      4: Money.mbb(5000),
      5: BB(100),
    });
    let hand = begin(table, f, { deadBlinds: [{ seat: 5, amount: Money.mbb(500) }] });
    hand = step(hand, fold(), f); // UTG seat 3
    hand = step(hand, { kind: 'ALL_IN' }, f); // seat 4 shoves 5000 - 160 ante = 4840
    hand = step(hand, fold(), f); // CO seat 5, having paid a dead 500
    hand = step(hand, fold(), f); // BTN seat 0
    hand = step(hand, fold(), f); // SB seat 1
    hand = step(hand, { kind: 'CALL' }, f); // BB seat 2 calls the shove
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, dealBoard(cards('2d')), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    hand = step(hand, awardAllTo(hand.state, 2), f);
    expect(hand.state.phase).toBe('COMPLETE');

    // Re-derive both identities from scratch on every prefix of the log. The arithmetic
    // here is written out rather than borrowed from the engine's own assertions.
    for (let length = 1; length <= hand.events.length; length += 1) {
      const st = foldEvents(hand.events.slice(0, length));
      const seats = st.dealtInSeats;
      const started = seats.reduce<number>((sum, s) => sum + st.seats[s].startingStack, 0);
      const behind = seats.reduce<number>((sum, s) => sum + st.seats[s].stack, 0);
      const live = st.pots.filter((p) => !p.awarded).reduce((sum, p) => sum + p.amount, 0);
      expect(behind + live + st.totalRake + st.totalFees).toBe(started);

      for (const s of seats) {
        const seat = st.seats[s];
        expect(seat.stack).toBe(
          seat.startingStack - seat.totalContribution + seat.wonGross - seat.rakePaid - seat.feePaid,
        );
        expect(seat.stack).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Rehydration: strict replay, structural load, JSON, undo.
// ---------------------------------------------------------------------------

describe('rehydrating a hand that contains a dead blind', () => {
  function playedHand(): Hand {
    const f = ids();
    let hand = begin(sixSeats(ANTE_PRESET), f, {
      blindOverride: { smallBlindSeat: 3, bigBlindSeat: 4 },
      deadBlinds: [{ seat: 1, amount: BB(1) }],
    });
    hand = step(hand, fold(), f);
    hand = step(hand, fold(), f);
    hand = step(hand, fold(), f);
    hand = step(hand, fold(), f);
    hand = step(hand, fold(), f);
    return hand;
  }

  it('replays strictly to the same events and the same state', () => {
    const hand = playedHand();
    const replayed = replayHand(hand.events);
    expect(errCode(replayed)).toBeUndefined();
    if (!replayed.ok) return;
    expect(payloads(replayed.value.events)).toEqual(payloads(hand.events));
    expect(replayed.value.state).toEqual(hand.state);
  });

  it('loads structurally to the same state', () => {
    const hand = playedHand();
    const loaded = loadHand(hand.events);
    expect(errCode(loaded)).toBeUndefined();
    if (!loaded.ok) return;
    expect(loaded.value.state).toEqual(hand.state);
  });

  it('round-trips through JSON losslessly, override and dead blind included', () => {
    const hand = playedHand();
    const round = jsonRoundTrip(hand.events);
    expect(errCode(round)).toBeUndefined();
    if (!round.ok) return;
    expect(round.value).toEqual(hand.events);

    const started = round.value[0];
    expect(started?.kind === 'HAND_STARTED' ? started.blindOverride : undefined).toEqual({
      smallBlindSeat: 3,
      bigBlindSeat: 4,
    });
    const dead = round.value.filter((e) => e.kind === 'POST_DEAD_BLIND');
    expect(dead).toHaveLength(1);
  });

  it('undo still refuses to unwind the hand start, and leaves group 0 intact', () => {
    const f = ids();
    const start = begin(sixSeats(ANTE_PRESET), f, { deadBlinds: [{ seat: 4, amount: BB(1) }] });
    expect(errCode(undo(start))).toBe('NOTHING_TO_UNDO');

    const afterFold = step(start, fold(), f);
    const undone = undo(afterFold);
    expect(errCode(undone)).toBeUndefined();
    if (!undone.ok) return;
    expect(payloads(undone.value.events)).toEqual(payloads(start.events));
    expect(undone.value.state).toEqual(start.state);
    expect(undone.value.events.some((e) => e.kind === 'POST_DEAD_BLIND')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. The manual SB/BB override.
// ---------------------------------------------------------------------------

describe('manual SB/BB override', () => {
  it('is persisted on HAND_STARTED as null when absent', () => {
    const started = begin(sixSeats(), ids()).events[0];
    expect(started?.kind === 'HAND_STARTED' ? started.blindOverride : undefined).toBeNull();
  });

  it('swaps the blind roles, the labels and the preflop order when SB and BB swap', () => {
    const f = ids();
    const hand = begin(sixSeats(), f, {
      blindOverride: { smallBlindSeat: 2, bigBlindSeat: 1 },
    });
    const st = hand.state;

    expect(st.blinds).toEqual({
      buttonSeat: 0,
      smallBlindSeat: 2,
      bigBlindSeat: 1,
      headsUp: false,
    });
    expect(postLog(hand.events)).toEqual(['POST_SB:2', 'POST_BB:1']);
    expect(seatMoney(st, 2)).toEqual({ stack: 99500, street: 500, total: 500 });
    expect(seatMoney(st, 1)).toEqual({ stack: 99000, street: 1000, total: 1000 });
    expect(st.seats[2].deadContribution).toBe(0);

    // Ring order from the button is unchanged; the two blind LABELS swapped with the
    // roles, and the ladder still walks backwards from the button over the rest.
    expect(labelsOf(st, [0, 1, 2, 3, 4, 5])).toEqual(['BTN', 'BB', 'SB', 'UTG', 'HJ', 'CO']);
    expect(st.positions[1]?.blindRole).toBe('BB');
    expect(st.positions[2]?.blindRole).toBe('SB');

    // Preflop the big blind still acts last, so the first actor is the seat after it.
    expect(st.round.actionOrder).toEqual([2, 3, 4, 5, 0, 1]);
    expect(st.actorSeat).toBe(2);

    // Postflop the BUTTON still acts last. The seat order is a button rule and does not
    // move; the labels along it are the ones that swapped.
    const postflop = [1, 2, 3, 4, 5, 0] as const;
    expect(postflop.map((seat) => st.positions[seat]?.postflopOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(labelsOf(st, postflop)).toEqual(['BB', 'SB', 'UTG', 'HJ', 'CO', 'BTN']);
  });

  it('pins the derived lineup for blinds that are not adjacent to the button', () => {
    const f = ids();
    // Button 0, blinds parked on seats 3 and 4 — a shape the ordinary rotation never
    // produces. The labelling is purely STRUCTURAL and may match no solver lineup.
    const hand = begin(sixSeats(), f, {
      blindOverride: { smallBlindSeat: 3, bigBlindSeat: 4 },
    });
    const st = hand.state;

    expect(postLog(hand.events)).toEqual(['POST_SB:3', 'POST_BB:4']);
    expect(st.blinds.smallBlindSeat).toBe(3);
    expect(st.blinds.bigBlindSeat).toBe(4);

    // BTN on the button; SB/BB where they were named; the ladder walked BACKWARDS from
    // the button over the seats that hold no blind: seat 5 = CO, seat 2 = HJ, seat 1 = UTG.
    expect(labelsOf(st, [0, 1, 2, 3, 4, 5])).toEqual(['BTN', 'UTG', 'HJ', 'SB', 'BB', 'CO']);

    // Preflop: ring order starting after the big blind (seat 4).
    expect(st.round.actionOrder).toEqual([5, 0, 1, 2, 3, 4]);
    expect(st.actorSeat).toBe(5);
    expect(labelsOf(st, [5, 0, 1, 2, 3, 4])).toEqual(['CO', 'BTN', 'UTG', 'HJ', 'SB', 'BB']);

    // Postflop: ring order starting after the button, unchanged by the override.
    const postflop = [1, 2, 3, 4, 5, 0] as const;
    expect(postflop.map((seat) => st.positions[seat]?.postflopOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(labelsOf(st, postflop)).toEqual(['UTG', 'HJ', 'SB', 'BB', 'CO', 'BTN']);

    // Every seat still has exactly one label, and no label is used twice.
    const labels = [0, 1, 2, 3, 4, 5].map((seat) => label(st, seat as SeatIndex));
    expect(new Set(labels).size).toBe(6);
  });

  it('keeps the structural keys usable while the names are non-standard', () => {
    const st = begin(sixSeats(), ids(), {
      blindOverride: { smallBlindSeat: 3, bigBlindSeat: 4 },
    }).state;
    // seatsBeforeButton is naming-independent: seat 5 is one seat before the button
    // whatever it happens to be called.
    expect(st.positions[5]?.seatsBeforeButton).toBe(1);
    expect(st.positions[3]?.seatsAfterButton).toBe(3);
  });

  it('applies to a shorter lineup too', () => {
    const f = ids();
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100) },
      buttonSeat: 0,
    });
    const st = begin(table, f, { blindOverride: { smallBlindSeat: 3, bigBlindSeat: 1 } }).state;
    // Four handed: BTN 0, and only CO survives the ladder. Walking backwards from the
    // button, seat 3 is a blind and is skipped, so seat 2 takes CO.
    expect(labelsOf(st, [0, 1, 2, 3])).toEqual(['BTN', 'BB', 'CO', 'SB']);
    expect(st.round.actionOrder).toEqual([2, 3, 0, 1]);
    expect(st.actorSeat).toBe(2);
  });

  it('rejects a lineup it cannot label instead of coping', () => {
    // The button holding a blind with three or more dealt in IS the dead-button case.
    // It is not modelled, so it is refused rather than approximated.
    expect(
      errCode(startHand(sixSeats(), options({ blindOverride: bo(0, 2) }), ids())),
    ).toBe('BLIND_OVERRIDE_ON_BUTTON');
    expect(
      errCode(startHand(sixSeats(), options({ blindOverride: bo(1, 0) }), ids())),
    ).toBe('BLIND_OVERRIDE_ON_BUTTON');
  });

  it('rejects blind seats that are not dealt in, or the same seat twice', () => {
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100) },
      buttonSeat: 0,
    });
    expect(errCode(startHand(table, options({ blindOverride: bo(5, 2) }), ids()))).toBe(
      'SEAT_NOT_DEALT_IN',
    );
    expect(errCode(startHand(table, options({ blindOverride: bo(1, 4) }), ids()))).toBe(
      'SEAT_NOT_DEALT_IN',
    );
    expect(errCode(startHand(table, options({ blindOverride: bo(2, 2) }), ids()))).toBe(
      'BLIND_OVERRIDE_INVALID',
    );
  });

  it('leaves a hand with no override byte-identical to one built without the field', () => {
    const plain = begin(sixSeats(ANTE_PRESET), ids());
    const explicit = begin(sixSeats(ANTE_PRESET), ids(), {
      blindOverride: null,
      deadBlinds: [],
    });
    expect(payloads(explicit.events)).toEqual(payloads(plain.events));
    expect(explicit.state).toEqual(plain.state);
    // And it is still the ordinary rotation.
    expect(plain.state.blinds).toEqual({
      buttonSeat: 0,
      smallBlindSeat: 1,
      bigBlindSeat: 2,
      headsUp: false,
    });
    expect(labelsOf(plain.state, [0, 1, 2, 3, 4, 5])).toEqual([
      'BTN',
      'SB',
      'BB',
      'UTG',
      'HJ',
      'CO',
    ]);
  });
});

function bo(smallBlindSeat: SeatIndex, bigBlindSeat: SeatIndex): BlindSeatOverride {
  return { smallBlindSeat, bigBlindSeat };
}

// ---------------------------------------------------------------------------
// 5. Heads-up precedence.
// ---------------------------------------------------------------------------

describe('heads-up, the override outranks the configured rule', () => {
  const headsUp = (config = NO_ANTE_PRESET) =>
    buildTable({ config, stacks: { 0: BB(100), 1: BB(100) }, buttonSeat: 0 });

  it('moves the small blind off the button even though the rule says otherwise', () => {
    // Default rules say the heads-up button posts the small blind. The override says
    // seat 1 does, and the override wins.
    const hand = begin(headsUp(), ids(), { blindOverride: bo(1, 0) });
    const st = hand.state;
    expect(st.config.rules.headsUpButtonPostsSmallBlind).toBe(true);
    expect(st.blinds).toEqual({
      buttonSeat: 0,
      smallBlindSeat: 1,
      bigBlindSeat: 0,
      headsUp: true,
    });
    expect(postLog(hand.events)).toEqual(['POST_SB:1', 'POST_BB:0']);

    // Labels follow the roles, never ring position, so they cannot contradict blindRole.
    expect(labelsOf(st, [0, 1])).toEqual(['BB', 'SB']);
    expect(st.positions[0]?.blindRole).toBe('BB');
    expect(st.positions[1]?.blindRole).toBe('SB');
    // The big blind still acts last preflop: the small blind (seat 1) is first.
    expect(st.round.actionOrder).toEqual([1, 0]);
    expect(st.actorSeat).toBe(1);
  });

  it('moves it back onto the button even though the rule says otherwise', () => {
    const flipped = {
      ...NO_ANTE_PRESET,
      rules: { ...NO_ANTE_PRESET.rules, headsUpButtonPostsSmallBlind: false },
    };
    // The rule says the button posts the BIG blind; the override says it posts the SMALL
    // one. The override wins in both directions.
    const hand = begin(headsUp(flipped), ids(), { blindOverride: bo(0, 1) });
    const st = hand.state;
    expect(st.config.rules.headsUpButtonPostsSmallBlind).toBe(false);
    expect(st.blinds.smallBlindSeat).toBe(0);
    expect(st.blinds.bigBlindSeat).toBe(1);
    expect(postLog(hand.events)).toEqual(['POST_SB:0', 'POST_BB:1']);
    expect(labelsOf(st, [0, 1])).toEqual(['BTN', 'BB']);
    expect(st.round.actionOrder).toEqual([0, 1]);
  });

  it('still refuses the same seat for both blinds', () => {
    expect(errCode(startHand(headsUp(), options({ blindOverride: bo(1, 1) }), ids()))).toBe(
      'BLIND_OVERRIDE_INVALID',
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Dead-blind rejection paths.
// ---------------------------------------------------------------------------

describe('dead-blind validation', () => {
  const attempt = (deadBlinds: readonly DeadBlindPost[]) =>
    errCode(startHand(sixSeats(), options({ deadBlinds }), ids()));

  it('refuses a post for a seat that is not dealt in', () => {
    const table = buildTable({
      stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100) },
      buttonSeat: 0,
    });
    expect(errCode(startHand(table, options({ deadBlinds: [{ seat: 5, amount: BB(1) }] }), ids()))).toBe(
      'SEAT_NOT_DEALT_IN',
    );
  });

  it('refuses two posts for one seat', () => {
    expect(
      attempt([
        { seat: 3, amount: BB(1) },
        { seat: 3, amount: Money.mbb(500) },
      ]),
    ).toBe('DUPLICATE_DEAD_BLIND');
  });

  it('refuses a non-positive or out-of-range amount', () => {
    expect(attempt([{ seat: 3, amount: Money.ZERO }])).toBe('AMOUNT_OUT_OF_RANGE');
    expect(attempt([{ seat: 3, amount: Money.mbb(-500) }])).toBe('AMOUNT_OUT_OF_RANGE');
    expect(attempt([{ seat: 3, amount: (Money.MAX_MILLI_BB + 1) as MilliBB }])).toBe(
      'AMOUNT_OUT_OF_RANGE',
    );
    expect(attempt([{ seat: 3, amount: 12.5 as MilliBB }])).toBe('AMOUNT_OUT_OF_RANGE');
  });

  it('rejects the whole hand start rather than dropping the bad post', () => {
    const result = startHand(
      sixSeats(),
      options({
        deadBlinds: [
          { seat: 3, amount: BB(1) },
          { seat: 3, amount: BB(1) },
        ],
      }),
      ids(),
    );
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Tamper resistance. Both properties below were previously held by reasoning
//    alone; an independent review pointed out that neither was pinned by a test.
// ---------------------------------------------------------------------------

describe('a tampered log is refused, not silently reinterpreted', () => {
  function playedToFold(): Hand {
    const f = ids();
    const hand = begin(sixSeats(ANTE_PRESET), f, {
      blindOverride: { smallBlindSeat: 3, bigBlindSeat: 4 },
      deadBlinds: [{ seat: 1, amount: BB(1) }],
    });
    return step(hand, fold(), f);
  }

  function spliceAfterFirstFold(events: readonly HandEvent[], kind: 'POST_ANTE' | 'POST_DEAD_BLIND') {
    const at = events.findIndex((e) => e.kind === 'FOLD');
    expect(at).toBeGreaterThan(0);
    const host = events[at];
    if (host === undefined) throw new Error('no fold to splice after');
    const injected = {
      id: asId<'Event'>('tampered'),
      seq: host.seq + 1,
      commandSeq: host.commandSeq,
      origin: 'ENGINE' as const,
      kind,
      seat: 2 as SeatIndex,
      amount: BB(1),
    } as HandEvent;
    const after = events.slice(at + 1).map((e) => ({ ...e, seq: e.seq + 1 }));
    return [...events.slice(0, at + 1), injected, ...after];
  }

  // A post re-seeds the preflop round. Spliced in later it would silently reset the
  // street, the price to call and the action order — and because dead money touches
  // neither streetContribution nor contributionByStreet, the ledger and conservation
  // identities stay satisfied and would NOT catch it.
  it('refuses a POST_DEAD_BLIND spliced in outside command group 0', () => {
    const tampered = spliceAfterFirstFold(playedToFold().events, 'POST_DEAD_BLIND');
    expect(errCode(loadHand(tampered))).toBe('CORRUPT_LOG');
    expect(errCode(replayHand(tampered))).toBeDefined();
  });

  it('refuses a POST_ANTE spliced in outside command group 0', () => {
    const tampered = spliceAfterFirstFold(playedToFold().events, 'POST_ANTE');
    expect(errCode(loadHand(tampered))).toBe('CORRUPT_LOG');
  });

  // The load-bearing promise of a persisted override: a hand can never replay to
  // different blinds than it was dealt with.
  it('refuses a HAND_STARTED whose blindOverride was altered after the fact', () => {
    const hand = playedToFold();
    const [started, ...rest] = hand.events;
    if (started === undefined || started.kind !== 'HAND_STARTED') throw new Error('no start');
    const tampered = [
      { ...started, blindOverride: { smallBlindSeat: 1 as SeatIndex, bigBlindSeat: 2 as SeatIndex } },
      ...rest,
    ] as HandEvent[];
    expect(errCode(loadHand(tampered))).toBe('CORRUPT_LOG');
    expect(errCode(replayHand(tampered))).toBeDefined();
  });

  it('still accepts the untampered log, so the tests above are not vacuous', () => {
    const hand = playedToFold();
    expect(errCode(loadHand(hand.events))).toBeUndefined();
    expect(errCode(replayHand(hand.events))).toBeUndefined();
  });
});
