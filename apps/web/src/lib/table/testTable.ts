/**
 * Table fixtures for the web tests.
 *
 * TEST-ONLY. Nothing in the app imports this module; it exists so the store test and the
 * component test build the SAME table through the engine's own constructors rather than
 * hand-writing a `TableState` literal that could drift from the real shape.
 */
import { Money } from '@gto-self/shared';
import { asId } from '@gto-self/shared';
import type { MilliBB, PlayerId } from '@gto-self/shared';
import {
  CP_NL50_6MAX_ANTE,
  createTable,
  seatPlayer,
  setButtonSeat,
  setHeroSeat,
  withAnteEnabled,
} from '@gto-self/poker-core';
import type { SeatIndex, TableState } from '@gto-self/poker-core';

export interface TestTableOptions {
  /** Seats to fill, in ascending order. Default `[0, 1, 2]`. */
  readonly seats?: readonly SeatIndex[];
  readonly heroSeat?: SeatIndex;
  readonly buttonSeat?: SeatIndex;
  /** Per-seat starting stack. Default 100 BB. */
  readonly stack?: MilliBB;
  readonly anteEnabled?: boolean;
}

export const testPlayerId = (seat: SeatIndex): PlayerId => asId<'Player'>(`player-${seat}`);

export function testNicknames(seats: readonly SeatIndex[]): Record<string, string> {
  const nicknames: Record<string, string> = {};
  for (const seat of seats) nicknames[testPlayerId(seat)] = `Player ${seat + 1}`;
  return nicknames;
}

/** Throws on any engine rejection: a broken fixture must fail loudly, not silently. */
export function makeTestTable(options: TestTableOptions = {}): TableState {
  const seats = options.seats ?? ([0, 1, 2] as const);
  const stack = options.stack ?? Money.fromBB(100);
  const config = withAnteEnabled(CP_NL50_6MAX_ANTE, options.anteEnabled ?? true);

  const created = createTable(config);
  if (!created.ok) throw new Error(created.error.message);
  let table = created.value;

  for (const seat of seats) {
    const seated = seatPlayer(table, seat, testPlayerId(seat), stack);
    if (!seated.ok) throw new Error(seated.error.message);
    table = seated.value;
  }

  const hero = setHeroSeat(table, options.heroSeat ?? seats[0]!);
  if (!hero.ok) throw new Error(hero.error.message);
  table = hero.value;

  const button = setButtonSeat(table, options.buttonSeat ?? seats[0]!);
  if (!button.ok) throw new Error(button.error.message);
  return button.value;
}
