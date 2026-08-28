/**
 * The persisted event log. A hand IS its ordered `HandEvent[]`; `HandState` is the fold.
 *
 * Every leaf field is `number | string | boolean`, an array of those, or `TableConfig`
 * (itself all primitives). No `Date`, `Map`, `Set`, `bigint`, `undefined` or class
 * instance appears in any payload, so `JSON.parse(JSON.stringify(e))` is lossless.
 */
import { asId, type Card, type HandId, type IdFactory } from '@gto-self/shared';
import type { EventId, MilliBB, PlayerId } from '@gto-self/shared';
import type { TableConfig } from './config.js';
import type { SeatIndex } from './seat.js';

export type EventOrigin = 'USER' | 'ENGINE';

/**
 * Engine bookkeeping, not poker facts. `id` comes from the injected IdFactory (ADR-0007);
 * `seq` is dense and ascending from 0 and is the SQLite ordering key; `commandSeq` groups
 * every event produced by one logical user command (undo drops one whole group);
 * `origin` distinguishes what the user did from what the engine derived.
 */
export interface EventMeta {
  readonly id: EventId;
  readonly seq: number;
  readonly commandSeq: number;
  readonly origin: EventOrigin;
}

export type HandEventKind =
  | 'HAND_STARTED'
  | 'PLAYER_DEALT_IN'
  | 'POST_ANTE'
  | 'POST_SB'
  | 'POST_BB'
  | 'HOLE_CARDS_SET'
  | 'FOLD'
  | 'CHECK'
  | 'CALL'
  | 'BET'
  | 'RAISE'
  | 'ALL_IN'
  | 'RETURN_UNCALLED'
  | 'FLOP_DEALT'
  | 'TURN_DEALT'
  | 'RIVER_DEALT'
  | 'POT_AWARDED'
  | 'HAND_FINISHED';

export type HandEndReason = 'ALL_FOLDED' | 'SHOWDOWN';

export interface PotShare {
  readonly seat: SeatIndex;
  readonly amount: MilliBB;
}

export type HandEventPayload =
  /** USER. Always seq 0. Embeds the whole config so the log replays with no external context. */
  | {
      readonly kind: 'HAND_STARTED';
      readonly handId: HandId;
      readonly handNumber: number;
      readonly config: TableConfig;
      readonly buttonSeat: SeatIndex;
      readonly heroSeat: SeatIndex | null;
    }
  /** ENGINE. One per dealt-in seat, ascending physical seat order. */
  | {
      readonly kind: 'PLAYER_DEALT_IN';
      readonly seat: SeatIndex;
      readonly playerId: PlayerId | null;
      /** ACTUAL entered stack, never a normalized bucket. */
      readonly startingStack: MilliBB;
    }
  /** ENGINE. amount = min(config.ante.amount, stack) — the ACTUAL amount posted. */
  | { readonly kind: 'POST_ANTE'; readonly seat: SeatIndex; readonly amount: MilliBB }
  /** ENGINE. amount = min(smallBlind, stackAfterAnte). */
  | { readonly kind: 'POST_SB'; readonly seat: SeatIndex; readonly amount: MilliBB }
  /** ENGINE. amount = min(bigBlind, stackAfterAnte). */
  | { readonly kind: 'POST_BB'; readonly seat: SeatIndex; readonly amount: MilliBB }
  /**
   * USER. 1..2 cards. `revealed: false` = hero's own entry, `true` = a showdown reveal.
   * Re-emitting for the same seat replaces the previous holding.
   */
  | {
      readonly kind: 'HOLE_CARDS_SET';
      readonly seat: SeatIndex;
      readonly cards: readonly Card[];
      readonly revealed: boolean;
    }
  | { readonly kind: 'FOLD'; readonly seat: SeatIndex }
  | { readonly kind: 'CHECK'; readonly seat: SeatIndex }
  /**
   * USER. `toAmount` is the seat's street contribution AFTER the action (raise-TO
   * semantics everywhere); `amount` is the chips moved. Both stored: the identity
   * `amount === toAmount - streetContributionBefore` is arithmetic, so it is a safe
   * integrity check for the Phase 11 parser. A short call is a CALL with a clamped
   * amount, NOT an ALL_IN — the stored verb is the verb the user pressed.
   */
  | {
      readonly kind: 'CALL';
      readonly seat: SeatIndex;
      readonly toAmount: MilliBB;
      readonly amount: MilliBB;
    }
  | {
      readonly kind: 'BET';
      readonly seat: SeatIndex;
      readonly toAmount: MilliBB;
      readonly amount: MilliBB;
    }
  | {
      readonly kind: 'RAISE';
      readonly seat: SeatIndex;
      readonly toAmount: MilliBB;
      readonly amount: MilliBB;
    }
  /**
   * USER. Emitted only when the user pressed `A`. Whether it functions as a bet, a
   * call, a full raise or a short all-in is DERIVED, never stored.
   */
  | {
      readonly kind: 'ALL_IN';
      readonly seat: SeatIndex;
      readonly toAmount: MilliBB;
      readonly amount: MilliBB;
    }
  /** ENGINE. Emitted at round close, before any street or settlement transition. */
  | { readonly kind: 'RETURN_UNCALLED'; readonly seat: SeatIndex; readonly amount: MilliBB }
  | { readonly kind: 'FLOP_DEALT'; readonly cards: readonly [Card, Card, Card] }
  | { readonly kind: 'TURN_DEALT'; readonly card: Card }
  | { readonly kind: 'RIVER_DEALT'; readonly card: Card }
  /**
   * Winners are USER input in Phase 1 (hand evaluation is out of scope) or ENGINE when
   * exactly one contender remains. Amounts are always engine-computed. `rake` records the
   * rake ACTUALLY APPLIED (ADR-0009), so a later configuration correction never rewrites
   * or invalidates stored history.
   */
  | {
      readonly kind: 'POT_AWARDED';
      readonly potIndex: number;
      readonly winners: readonly SeatIndex[];
      readonly grossAmount: MilliBB;
      readonly rake: MilliBB;
      readonly netAmount: MilliBB;
      readonly shares: readonly PotShare[];
    }
  /** ENGINE. Same command group as the award that consumed the last unawarded pot. */
  | {
      readonly kind: 'HAND_FINISHED';
      readonly reason: HandEndReason;
      readonly totalRake: MilliBB;
    };

/** Narrows correctly on `.kind`: an intersection distributes over the union. */
export type HandEvent = EventMeta & HandEventPayload;

export type EventOf<K extends HandEventKind> = Extract<HandEvent, { readonly kind: K }>;

export const ACTION_EVENT_KINDS: readonly ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'] = [
  'FOLD',
  'CHECK',
  'CALL',
  'BET',
  'RAISE',
  'ALL_IN',
];

export const WAGER_EVENT_KINDS: readonly ['CALL', 'BET', 'RAISE', 'ALL_IN'] = [
  'CALL',
  'BET',
  'RAISE',
  'ALL_IN',
];

/**
 * Total. The ONLY place an `EventId` is minted, and it comes from the injected
 * `IdFactory` (ADR-0007). `crypto.randomUUID` is never called in this package.
 */
export function makeEvent(
  payload: HandEventPayload,
  meta: { readonly seq: number; readonly commandSeq: number; readonly origin: EventOrigin },
  ids: IdFactory,
): HandEvent {
  return {
    id: asId<'Event'>(ids.next()),
    seq: meta.seq,
    commandSeq: meta.commandSeq,
    origin: meta.origin,
    ...payload,
  };
}

/** Total. FOLD / CHECK / CALL / BET / RAISE / ALL_IN — the voluntary actions. */
export function isActionEvent(event: HandEvent): boolean {
  return (ACTION_EVENT_KINDS as readonly string[]).includes(event.kind);
}

/** Total. CALL / BET / RAISE / ALL_IN — the action events that carry `toAmount`. */
export function isWagerEvent(event: HandEvent): boolean {
  return (WAGER_EVENT_KINDS as readonly string[]).includes(event.kind);
}

/** Total. The seat an event concerns, or null for table-wide events. */
export function eventSeat(event: HandEvent): SeatIndex | null {
  return 'seat' in event ? event.seat : null;
}

/** Total. Every event belonging to one logical user command, in log order. */
export function eventsOfCommand(
  events: readonly HandEvent[],
  commandSeq: number,
): readonly HandEvent[] {
  return events.filter((event) => event.commandSeq === commandSeq);
}

/** Total. The highest `commandSeq` in the log, or null when the log is empty. */
export function lastCommandSeq(events: readonly HandEvent[]): number | null {
  let best: number | null = null;
  for (const event of events) {
    if (best === null || event.commandSeq > best) best = event.commandSeq;
  }
  return best;
}
