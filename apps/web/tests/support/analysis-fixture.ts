/**
 * TEST-ONLY fixtures for the analysis server tests.
 *
 * It lives under `tests/`, OUTSIDE the Next.js `src/` tree, so it is structurally
 * unreachable from any application path — the same boundary every workspace package draws
 * with its own `tests/fixture.ts`. It used to sit in `src/server/`, where it was only
 * tree-shaking that kept production-adjacent scaffolding out of the app (review R1/m4).
 *
 * Every hand it produces is a REAL hand played through `poker-core`'s public API and stored
 * through the app's own `persistCompletedHand` — the same path the browser uses. No
 * `HandState` is hand-written and no row is inserted behind the service's back, because the
 * properties these tests assert (all-history recomputation, `NO_CHANGES`, determinism) are
 * only meaningful over history that arrived the way real history arrives.
 */
import { asId, Money, parseCards, RANKS, SUITS, unwrap } from '@gto-self/shared';
import type { IdFactory, SessionId } from '@gto-self/shared';
import type { Timestamp } from '@gto-self/player-core';
import {
  advanceButton,
  applyCommands,
  applyHandResult,
  awardPots,
  betTo,
  call,
  check,
  CP_NL50_6MAX_ANTE,
  dealBoard,
  encodeHandEvents,
  fold,
  raiseTo,
  SEAT_INDEXES,
  setHoleCards,
  setSeatStack,
  startHand,
  type Hand,
  type HandCommand,
  type SeatIndex,
  type TableState,
} from '@gto-self/poker-core';
import { getSession, type GtoDatabase } from '@gto-self/db';
import type { SeatFormValue, SessionFormValue } from '../../src/lib/session-setup/contract.js';
import { emptySeatForm } from '../../src/lib/session-setup/plan.js';
import { startSession } from '../../src/server/session-service.js';
import { persistCompletedHand } from '../../src/server/hand-history-service.js';

/** A deterministic 52-card deck, as the strings `parseCards` reads. */
const DECK: readonly string[] = RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));

/** Nine distinct cards for one hand: five board, two hero, two shown. */
function cardsFor(handIndex: number): readonly string[] {
  const offset = (handIndex * 9) % (DECK.length - 9);
  return DECK.slice(offset, offset + 9);
}

/**
 * The four preflop shapes the fixture cycles through, written seat-agnostically so they stay
 * legal as the button rotates. None of them ends the hand preflop, so every hand reaches a
 * showdown and produces postflop opportunities as well.
 */
const PREFLOP_SHAPES: readonly (readonly HandCommand[])[] = [
  // Open, fold, call.
  [raiseTo(Money.fromBB(3)), fold(), call()],
  // Open, 3-bet, fold, call.
  [raiseTo(Money.fromBB(3)), raiseTo(Money.fromBB(9)), fold(), call()],
  // Limped pot, big blind takes its option.
  [call(), call(), check()],
  // Fold, open, call.
  [fold(), raiseTo(Money.fromBB(3)), call()],
];

/** Seats still able to act, in ring order. */
function liveSeats(hand: Hand): readonly SeatIndex[] {
  return SEAT_INDEXES.filter((seat) => hand.state.seats[seat].status === 'IN_HAND');
}

export interface SessionFixture {
  readonly sessionId: SessionId;
  /** Advances between hands, exactly as the store does. */
  table: TableState;
  /** Next hand's index, so ids and cards stay distinct. */
  handIndex: number;
}

function seatForm(nickname: string, isHero: boolean): SeatFormValue {
  return {
    ...emptySeatForm(),
    occupancy: 'ACTIVE',
    nickname,
    stackText: '100',
    isHero,
  };
}

/**
 * Start a real session with the given nicknames seated. Reusing a nickname across two
 * fixture sessions reuses the PLAYER row, which is what makes the multi-session accumulation
 * tests test anything (prompt §25).
 */
export function startFixtureSession(
  db: GtoDatabase,
  options: {
    readonly label: string;
    readonly nicknames: readonly string[];
    readonly ids: IdFactory;
    readonly now: Timestamp;
  },
): SessionFixture {
  const form: SessionFormValue = {
    presetId: CP_NL50_6MAX_ANTE.presetId,
    anteEnabled: true,
    label: options.label,
    buttonSeat: 0,
    autoTopUpEnabled: false,
    autoTopUpTargetText: '100',
    seats: SEAT_INDEXES.map((index) =>
      index < options.nicknames.length
        ? seatForm(options.nicknames[index] as string, index === 0)
        : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
    ),
  };
  const started = startSession(db, form, { ids: options.ids, now: options.now });
  if (!started.ok) throw new Error(started.issues.map((issue) => issue.message).join('; '));
  const sessionId = asId<'Session'>(started.sessionId);
  const stored = getSession(db, sessionId);
  if (!stored.ok || stored.value === null) throw new Error('the fixture session did not come back');
  return { sessionId, table: stored.value.table, handIndex: 0 };
}

/**
 * Play ONE complete hand on the fixture's current table and return it, without storing it.
 *
 * `idPrefix` makes the hand id globally unique — `hands.id` is a primary key across every
 * session.
 */
export function playFixtureHand(fixture: SessionFixture, idPrefix: string): Hand {
  const index = fixture.handIndex;
  const cards = cardsFor(index);
  const ids = {
    next: (() => {
      let counter = 0;
      return () => `${idPrefix}-ev-${index}-${(counter += 1)}`;
    })(),
  };

  const handId = `${idPrefix}-h${index}`;
  let hand = unwrap(startHand(fixture.table, { handId: asId<'Hand'>(handId) }, ids));

  // Hero's own cards, entered face down, exactly as the table's card palette enters them.
  hand = unwrap(
    applyCommands(
      hand,
      [setHoleCards(0, unwrap(parseCards(cards.slice(5, 7).join(' '))), false)],
      ids,
    ),
  );

  const shape = PREFLOP_SHAPES[index % PREFLOP_SHAPES.length] as readonly HandCommand[];
  hand = unwrap(applyCommands(hand, [...shape], ids));

  const live = liveSeats(hand);
  const postflop: HandCommand[] = [dealBoard(unwrap(parseCards(cards.slice(0, 3).join(' '))))];
  if (index % PREFLOP_SHAPES.length === 1) {
    // One shape carries real postflop aggression, so the model sees a c-bet and a call and
    // not only checked-down streets.
    postflop.push(betTo(Money.fromBB(2)));
    for (let seat = 1; seat < live.length; seat += 1) postflop.push(call());
  } else {
    for (let seat = 0; seat < live.length; seat += 1) postflop.push(check());
  }
  postflop.push(dealBoard(unwrap(parseCards(cards[3] as string))));
  for (let seat = 0; seat < live.length; seat += 1) postflop.push(check());
  postflop.push(dealBoard(unwrap(parseCards(cards[4] as string))));
  for (let seat = 0; seat < live.length; seat += 1) postflop.push(check());
  hand = unwrap(applyCommands(hand, postflop, ids));

  // One player SHOWS at the showdown (ADR-0052 / ADR-0062f): the last live seat, which is
  // never hero, so the fixture has both a face-down hero hand and a genuinely revealed one.
  const shower = live[live.length - 1] as SeatIndex;
  hand = unwrap(
    applyCommands(
      hand,
      [
        setHoleCards(shower, unwrap(parseCards(cards.slice(7, 9).join(' '))), true),
        awardPots([{ potIndex: 0, winners: [live[0] as SeatIndex] }]),
      ],
      ids,
    ),
  );
  return hand;
}

/**
 * Advance the fixture's table between hands, exactly as the store does, and then RESET every
 * occupied seat to its 100 BB buy-in.
 *
 * The reset is not cosmetic. Without it stacks drift as chips accumulate on the winner, and
 * after a few dozen hands a seat is short enough that a fixed script ("open to 3 BB, fold,
 * call") stops being a legal command sequence — the fixture would fail for a reason that has
 * nothing to do with what these tests are about. It is exactly what a rebuy does, and every
 * hand is still a real hand the engine played.
 */
export function advanceFixture(fixture: SessionFixture, hand: Hand): void {
  let table = unwrap(advanceButton(unwrap(applyHandResult(fixture.table, hand))));
  for (const seat of SEAT_INDEXES) {
    if (table.seats[seat].occupancy === 'EMPTY') continue;
    table = unwrap(setSeatStack(table, seat, Money.fromBB(100)));
  }
  fixture.table = table;
  fixture.handIndex += 1;
}

/**
 * Play and STORE `count` complete hands through the app's own persistence service. Returns
 * the stored hand ids, in order.
 */
export function persistFixtureHands(
  db: GtoDatabase,
  fixture: SessionFixture,
  count: number,
  options: { readonly idPrefix: string; readonly now: Timestamp },
): readonly string[] {
  const stored: string[] = [];
  for (let played = 0; played < count; played += 1) {
    const hand = playFixtureHand(fixture, options.idPrefix);
    const result = persistCompletedHand(
      db,
      {
        sessionId: fixture.sessionId,
        events: encodeHandEvents(hand.events),
        startedAt: options.now - 60_000,
        finishedAt: options.now,
      },
      { now: options.now },
    );
    if (!result.ok) throw new Error(`fixture hand did not store: ${result.code} ${result.message}`);
    stored.push(result.handId);
    advanceFixture(fixture, hand);
  }
  return stored;
}
