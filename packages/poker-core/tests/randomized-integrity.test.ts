/**
 * A deterministic randomized driver over the public command API.
 *
 * This is the instrument the Phase 1 review used to find the settlement crash, kept as a
 * standing guard. It is NOT random: the generator is a seeded LCG and seeds 1..N are
 * replayed in order, so a failure names an exact seed to reproduce.
 *
 * What it asserts is only what must be true of EVERY hand: `applyCommand` never throws
 * (the reducer's own per-event invariants — chip conservation, the per-seat ledger, pot
 * conservation — run inside it), no stack ever goes negative, no award is negative, and a
 * COMPLETE hand balances `sum(net) + totalRake === 0`.
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS,
  Money,
  asId,
  sequentialIdFactory,
  type Card,
  type HandId,
  type MilliBB,
  type PlayerId,
  type RoundingMode,
} from '@gto-self/shared';
import { legalActions } from '../src/betting.js';
import type {
  OddChipRule,
  RakeAllocation,
  RakeTriggerPolicy,
  ShortAllInMinRaiseBasis,
} from '../src/config.js';
import {
  allIn,
  awardPots,
  betTo,
  call,
  check,
  dealBoard,
  fold,
  raiseTo,
  type HandCommand,
} from '../src/commands.js';
import { applyCommand, startHand, type Hand } from '../src/hand.js';
import { CP_NL50_6MAX_ANTE, CP_NL50_6MAX_NO_ANTE } from '../src/presets.js';
import { foldEvents } from '../src/reduce.js';
import type { SeatIndex } from '../src/seat.js';
import { createTable, seatPlayer, setButtonSeat } from '../src/table.js';

const SEEDS = 2000;
const MAX_STEPS = 80;
const SEAT_INDEXES = [0, 1, 2, 3, 4, 5] as const;

/** Seeded LCG. Deterministic across machines and runs. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const STACK_CHOICES = [100, 160, 300, 400, 500, 900, 1000, 1500, 2000, 5000, 20000, 60000, 100000];

function pick<T>(next: () => number, values: readonly T[]): T {
  const value = values[Math.floor(next() * values.length)];
  if (value === undefined) throw new Error('pick from an empty list');
  return value;
}

function configFor(next: () => number) {
  const base = next() < 0.5 ? CP_NL50_6MAX_ANTE : CP_NL50_6MAX_NO_ANTE;
  return {
    ...base,
    rake: {
      ...base.rake,
      allocation: pick<RakeAllocation>(next, ['MAIN_POT_FIRST', 'PROPORTIONAL']),
      triggerPolicy: pick<RakeTriggerPolicy>(next, ['ALWAYS', 'NO_FLOP_NO_DROP']),
      // 8000 is a multiple of every one of these, as validateTableConfig requires.
      quantum: pick<MilliBB>(next, [Money.mbb(1), Money.mbb(20), Money.mbb(100)]),
      rounding: pick<RoundingMode>(next, ['floor', 'ceil', 'round']),
    },
    rules: {
      ...base.rules,
      shortBlindSetsFullLevel: next() < 0.5,
      bigBlindHasOption: next() < 0.8,
      headsUpButtonPostsSmallBlind: next() < 0.8,
      headsUpButtonLabel: pick<'BTN' | 'SB'>(next, ['BTN', 'SB']),
      allowRaiseWithNoCaller: next() < 0.3,
      oddChipRule: pick<OddChipRule>(next, ['FIRST_LEFT_OF_BUTTON', 'LOWEST_SEAT_INDEX']),
      shortAllInMinRaiseBasis: pick<ShortAllInMinRaiseBasis>(next, [
        'CURRENT_BET',
        'LAST_FULL_RAISE',
      ]),
    },
  };
}

function nextCommand(hand: Hand, next: () => number, deal: () => Card): HandCommand | null {
  const state = hand.state;
  if (state.phase === 'BETTING') {
    const legal = legalActions(state);
    const options: HandCommand[] = [];
    if (legal.canFold) options.push(fold());
    if (legal.canCheck) options.push(check());
    if (legal.call !== null) options.push(call());
    if (legal.allIn !== null) options.push(allIn());
    if (legal.wager !== null) {
      options.push(
        legal.wager.kind === 'BET'
          ? betTo(legal.wager.minToAmount)
          : raiseTo(legal.wager.minToAmount),
      );
    }
    return options.length === 0 ? null : pick(next, options);
  }
  if (state.phase === 'AWAITING_BOARD') {
    const count = state.pendingStreet === 'FLOP' ? 3 : 1;
    return dealBoard(Array.from({ length: count }, deal));
  }
  if (state.phase === 'AWAITING_AWARD') {
    return awardPots(
      state.pots
        .filter((pot) => !pot.awarded)
        .map((pot) => ({ potIndex: pot.index, winners: [pick(next, pot.eligibleSeats)] })),
    );
  }
  return null;
}

describe('randomized command driver', () => {
  it(`plays ${SEEDS} seeded hands without a single invariant throw or money leak`, () => {
    let played = 0;
    let completed = 0;
    let autoAwardsToAllIn = 0;

    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const next = lcg(seed);
      const config = configFor(next);

      const table = createTable(config);
      expect(table.ok).toBe(true);
      if (!table.ok) return;
      let current = table.value;

      const wanted = 2 + Math.floor(next() * 5);
      const seated: SeatIndex[] = [];
      for (const seat of SEAT_INDEXES) {
        if (seated.length >= wanted) break;
        if (next() < 0.7 || 6 - seat <= wanted - seated.length) {
          const placed = seatPlayer(
            current,
            seat,
            asId<'Player'>(`p${seat}`) as PlayerId,
            Money.mbb(pick(next, STACK_CHOICES)),
          );
          if (!placed.ok) continue;
          current = placed.value;
          seated.push(seat);
        }
      }
      if (seated.length < 2) continue;
      const withButton = setButtonSeat(current, pick(next, seated));
      expect(withButton.ok).toBe(true);
      if (!withButton.ok) return;

      const factory = sequentialIdFactory(`s${seed}`);
      const started = startHand(
        withButton.value,
        { handId: asId<'Hand'>(`h${seed}`) as HandId },
        factory,
      );
      expect(started.ok).toBe(true);
      if (!started.ok) return;

      let hand = started.value;
      played += 1;
      let cardIndex = Math.floor(next() * 20);
      const deal = (): Card => {
        const card = ALL_CARDS[cardIndex % ALL_CARDS.length];
        cardIndex += 1;
        if (card === undefined) throw new Error('deck exhausted');
        return card;
      };

      for (let step = 0; step < MAX_STEPS && hand.state.phase !== 'COMPLETE'; step += 1) {
        const command = nextCommand(hand, next, deal);
        if (command === null) break;
        // Throws here are the whole point: `applyCommand` must never throw (spec 4.16).
        const applied = applyCommand(hand, command, factory);
        if (!applied.ok) break;
        hand = applied.value;
      }

      for (const seat of hand.state.dealtInSeats) {
        expect(hand.state.seats[seat].stack).toBeGreaterThanOrEqual(0);
      }
      for (const award of hand.state.awards) {
        expect(award.netAmount).toBeGreaterThanOrEqual(0);
      }

      // An ENGINE award may never have to credit a seat that is still ALL_IN: the uncalled
      // return always un-commits such a seat first. Counted rather than assumed.
      hand.events.forEach((event, index) => {
        if (event.kind !== 'POT_AWARDED' || event.origin !== 'ENGINE') return;
        const before = foldEvents(hand.events.slice(0, index));
        for (const winner of event.winners) {
          if (before.seats[winner].status === 'ALL_IN') autoAwardsToAllIn += 1;
        }
      });

      if (hand.state.phase === 'COMPLETE') {
        completed += 1;
        const net = Money.sum(
          hand.state.dealtInSeats.map((seat) =>
            Money.sub(hand.state.seats[seat].stack, hand.state.seats[seat].startingStack),
          ),
        );
        expect(Money.add(net, hand.state.totalRake)).toBe(0);
      }
    }

    expect(played).toBeGreaterThan(SEEDS * 0.9);
    expect(completed).toBeGreaterThan(SEEDS * 0.5);
    expect(autoAwardsToAllIn).toBe(0);
  });
});
