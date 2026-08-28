/**
 * Test-only helpers. NOT exported from the package barrel: nothing in the app may
 * depend on these, and they exist so every test builds a table the same way.
 */
import {
  asId,
  Money,
  parseCard,
  parseCards,
  sequentialIdFactory,
  unwrap,
  type Card,
  type HandId,
  type IdFactory,
  type MilliBB,
  type PlayerId,
} from '@gto-self/shared';
import { applyCommands, startHand, type Hand } from './hand.js';
import type { HandCommand } from './commands.js';
import type { EngineError, EngineResult } from './errors.js';
import { CP_NL50_6MAX_ANTE, CP_NL50_6MAX_NO_ANTE } from './presets.js';
import type { TableConfig } from './config.js';
import { createTable, seatPlayer, setButtonSeat, setHeroSeat, type TableState } from './table.js';
import type { SeatIndex } from './seat.js';

export const BB = (bb: number): MilliBB => Money.fromBB(bb);

export const ANTE_PRESET = CP_NL50_6MAX_ANTE;
export const NO_ANTE_PRESET = CP_NL50_6MAX_NO_ANTE;

export interface TableSpec {
  readonly config?: TableConfig;
  /** Seat -> starting stack in milliBB. Ascending seat order is not required. */
  readonly stacks: Readonly<Partial<Record<SeatIndex, MilliBB>>>;
  readonly buttonSeat: SeatIndex;
  readonly heroSeat?: SeatIndex;
}

/** Builds a fully seated table. Throws on any Err, because a broken fixture is a bug. */
export function buildTable(spec: TableSpec): TableState {
  let table = unwrap(createTable(spec.config ?? NO_ANTE_PRESET));
  for (const key of Object.keys(spec.stacks)) {
    const seat = Number(key) as SeatIndex;
    const stack = spec.stacks[seat];
    if (stack === undefined) continue;
    table = unwrap(seatPlayer(table, seat, asId<'Player'>(`p${seat}`) as PlayerId, stack));
  }
  table = unwrap(setButtonSeat(table, spec.buttonSeat));
  if (spec.heroSeat !== undefined) table = unwrap(setHeroSeat(table, spec.heroSeat));
  return table;
}

/** Six 100 BB stacks in seats 0..5 with the button on seat 0. */
export function sixHanded(config: TableConfig = NO_ANTE_PRESET): TableState {
  return buildTable({
    config,
    stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
    buttonSeat: 0,
    heroSeat: 0,
  });
}

/** Deterministic id source. Every test uses this so replays are byte-identical (ADR-0007). */
export function ids(prefix = 'e'): IdFactory {
  return sequentialIdFactory(prefix);
}

/** Starts a hand, throwing on any Err. */
export function start(
  table: TableState,
  factory: IdFactory,
  handId = 'h1',
  options: { readonly buttonSeat?: SeatIndex; readonly handNumber?: number } = {},
): Hand {
  return unwrap(startHand(table, { handId: asId<'Hand'>(handId) as HandId, ...options }, factory));
}

/** Applies a command list, throwing on any Err. */
export function play(hand: Hand, commands: readonly HandCommand[], factory: IdFactory): Hand {
  return unwrap(applyCommands(hand, commands, factory));
}

/** Convenience: card index from "As" style text. Throws on a bad string. */
export function c(text: string): Card {
  return unwrap(parseCard(text));
}

/** Convenience: several cards from "As Kd 7c". */
export function cards(text: string): readonly Card[] {
  return unwrap(parseCards(text));
}

/** The error code of an Err result, or undefined when it succeeded. Test ergonomics. */
export function errCode<T>(result: EngineResult<T>): string | undefined {
  return result.ok ? undefined : result.error.code;
}

/** The whole EngineError of an Err result. Throws when the result succeeded. */
export function errOf<T>(result: EngineResult<T>): EngineError {
  if (result.ok) throw new Error('expected an Err result, got Ok');
  return result.error;
}
