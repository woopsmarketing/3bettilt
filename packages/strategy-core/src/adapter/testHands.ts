/**
 * TEST-ONLY hand fixtures, driven through poker-core's real constructors.
 *
 * NOT exported from the package barrel. It lives inside `src/adapter/` because that is the
 * only directory allowed to import `@gto-self/poker-core`, and because a fixture that
 * hand-wrote a `HandState` literal would drift from the engine the moment the engine
 * changed — the whole point of the adapter tests is that they run against real state.
 *
 * The 6-max seating used throughout (button on seat 0):
 *
 *   seat 0 = BTN   seat 1 = SB   seat 2 = BB   seat 3 = UTG   seat 4 = HJ   seat 5 = CO
 *
 * Preflop action order is therefore UTG(3) -> HJ(4) -> CO(5) -> BTN(0) -> SB(1) -> BB(2).
 * Five-handed (seats 0..4) drops UTG: seat 3 becomes HJ, seat 4 stays CO.
 */
import {
  asId,
  Money,
  sequentialIdFactory,
  unwrap,
  type MilliBB,
  type PlayerId,
} from '@gto-self/shared';
import {
  applyCommands,
  createTable,
  CP_NL50_6MAX_NO_ANTE,
  seatPlayer,
  setButtonSeat,
  setHeroSeat,
  startHand,
  type Hand,
  type HandCommand,
  type SeatIndex,
  type TableConfig,
  type TableState,
} from '@gto-self/poker-core';

export const BB = (bb: number): MilliBB => Money.fromBB(bb);

export interface TableSpec {
  readonly seats: readonly SeatIndex[];
  readonly buttonSeat: SeatIndex;
  readonly heroSeat?: SeatIndex;
  /** Default 100 BB for every seat. */
  readonly stacks?: Readonly<Partial<Record<SeatIndex, MilliBB>>>;
  readonly config?: TableConfig;
}

/** Throws on any engine rejection: a broken fixture must fail loudly. */
export function buildTable(spec: TableSpec): TableState {
  let table = unwrap(createTable(spec.config ?? CP_NL50_6MAX_NO_ANTE));
  for (const seat of spec.seats) {
    const stack = spec.stacks?.[seat] ?? BB(100);
    table = unwrap(seatPlayer(table, seat, asId<'Player'>(`p${seat}`) as PlayerId, stack));
  }
  table = unwrap(setButtonSeat(table, spec.buttonSeat));
  if (spec.heroSeat !== undefined) table = unwrap(setHeroSeat(table, spec.heroSeat));
  return table;
}

/** Starts a hand on `table` and applies `commands`. Throws on any Err. */
export function playHand(table: TableState, commands: readonly HandCommand[]): Hand {
  const ids = sequentialIdFactory('e');
  const started = unwrap(startHand(table, { handId: asId<'Hand'>('h1') }, ids));
  if (commands.length === 0) return started;
  return unwrap(applyCommands(started, commands, ids));
}

/** Six 100 BB stacks, button on seat 0, hero wherever you put it. */
export function sixHanded(heroSeat: SeatIndex, commands: readonly HandCommand[] = []): Hand {
  return playHand(buildTable({ seats: [0, 1, 2, 3, 4, 5], buttonSeat: 0, heroSeat }), commands);
}

/** Five 100 BB stacks in seats 0..4, button on seat 0. */
export function fiveHanded(heroSeat: SeatIndex, commands: readonly HandCommand[] = []): Hand {
  return playHand(buildTable({ seats: [0, 1, 2, 3, 4], buttonSeat: 0, heroSeat }), commands);
}
