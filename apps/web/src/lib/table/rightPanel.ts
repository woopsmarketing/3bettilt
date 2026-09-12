/**
 * What the right-hand column leads with, and what it opens underneath. One pure function,
 * deliberately separate from `TableRoot` so the component behind each slot can be replaced
 * without touching a line of layout.
 *
 * ```
 * hero is the actor                          -> lead STRATEGY
 *   ... and a seat is selected               -> lead STRATEGY, drawer PLAYER
 * hero is not the actor, a seat is selected  -> lead PLAYER
 * neither                                    -> lead HISTORY
 * ```
 *
 * ## STRATEGY OUTRANKS THE SELECTION, and the column shows both rather than choosing
 *
 * An earlier version of this file resolved the overlap the other way — an explicit seat
 * selection won, and the strategy panel was unmounted for as long as the selection lasted. It
 * argued that a panel the user opened must not be closed by the engine. That reasoning was
 * accepted and has since been overruled by the user (V2 design contract, WP-9), for a reason
 * the old rule had no answer to: clicking an opponent's seat is how you look up who you are
 * up against, and it happened to be the one gesture that deleted the answer you were looking
 * them up FOR. The strategy panel is the whole product at a hero decision; nothing may take
 * its place while hero is on the clock.
 *
 * So the overlap is no longer a contest. `lead` is what the column is about, `drawer` is what
 * opens below it, and a selected seat while hero is to act produces BOTH. `Esc` still clears
 * the selection and still closes the drawer; what it no longer has to do is restore a panel
 * the selection took away.
 *
 * **There is no input for which `heroIsActor` is true and `lead` is not `STRATEGY`.**
 * `rightPanel.test.ts` asserts that over the whole input space rather than over examples,
 * because "the strategy disappeared when I clicked a seat" is precisely the bug this contract
 * exists to make unrepresentable.
 *
 * A selected seat that happens to be HERO's own behaves like any other: hero is a player with
 * notes, and the rule stays uniform rather than growing an exception.
 */
import type { SeatIndex } from '@gto-self/poker-core';

/** The three things the right column can lead with. */
export type RightPanelKind = 'STRATEGY' | 'PLAYER' | 'HISTORY';

/**
 * The column, resolved. `drawer` is a SECOND panel shown below `lead`, never instead of it.
 *
 * Only `PLAYER` can be a drawer today, and that is a fact about the layout rather than a
 * placeholder: the history is the fallback lead and has nothing to add beneath either of the
 * other two, and two strategy panels is not a thing.
 */
export interface RightPanelLayout {
  readonly lead: RightPanelKind;
  readonly drawer: 'PLAYER' | null;
}

export interface RightPanelInput {
  /**
   * The seat the user explicitly selected AND that has a stored player to show — `null`
   * for no selection, and also for a selected seat with nobody in it, which has no profile
   * to render.
   */
  readonly selectedPlayerSeat: SeatIndex | null;
  /** True exactly while the engine says the hero seat is the seat on the clock. */
  readonly heroIsActor: boolean;
}

/** Total. See the file header for why hero-to-act outranks the selection. */
export function rightPanelLayoutFor({
  selectedPlayerSeat,
  heroIsActor,
}: RightPanelInput): RightPanelLayout {
  if (heroIsActor) {
    return { lead: 'STRATEGY', drawer: selectedPlayerSeat === null ? null : 'PLAYER' };
  }
  if (selectedPlayerSeat !== null) return { lead: 'PLAYER', drawer: null };
  return { lead: 'HISTORY', drawer: null };
}
