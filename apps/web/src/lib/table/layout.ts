/**
 * Where each physical seat is DRAWN. Presentation only — nothing here is a poker rule.
 *
 * `docs/UX.md`: "Hero is fixed at bottom-centre. Physical seats never rotate visually;
 * the button/SB/BB markers rotate instead." So the seat -> slot mapping is computed ONCE
 * from `table.heroSeat`, which does not change during a session, and every marker and
 * position label is read off `HandView` instead (`prompt` D2).
 *
 * Slots run clockwise from the hero: bottom-centre, bottom-left, top-left, top-centre,
 * top-right, bottom-right — i.e. the seat to hero's left is drawn to hero's left.
 */
import type { SeatIndex } from '@gto-self/poker-core';

/**
 * Grid placement per slot, in a 3-column x 3-row table area whose middle row holds the
 * pot and board. Literal class strings, because Tailwind scans source text.
 */
export const SLOT_CLASS: readonly string[] = [
  'col-start-2 row-start-3', // 0: hero, bottom-centre
  'col-start-1 row-start-3', // 1: bottom-left
  'col-start-1 row-start-1', // 2: top-left
  'col-start-2 row-start-1', // 3: top-centre
  'col-start-3 row-start-1', // 4: top-right
  'col-start-3 row-start-3', // 5: bottom-right
];

/** Total. 0 = bottom-centre. `heroSeat: null` pins seat 0 there instead. */
export function slotForSeat(seat: SeatIndex, heroSeat: SeatIndex | null): number {
  return (seat - (heroSeat ?? 0) + 6) % 6;
}

/** Total. The grid classes for `seat`, given the session's hero. */
export function slotClassForSeat(seat: SeatIndex, heroSeat: SeatIndex | null): string {
  return SLOT_CLASS[slotForSeat(seat, heroSeat)] ?? SLOT_CLASS[0]!;
}
