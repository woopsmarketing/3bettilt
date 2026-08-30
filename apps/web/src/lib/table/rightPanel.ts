/**
 * What the right-hand column leads with. One pure function, deliberately separate from
 * `TableRoot` so Phase 9/10 can replace the strategy placeholder with the real panel
 * without touching a line of layout.
 *
 * The priority the user asked for:
 *
 * ```
 * Hero's decision (hero is the actor)  -> strategy panel
 * An opponent seat is selected         -> player profile / HUD / notes
 * otherwise                            -> hand / action history
 * ```
 *
 * ## The overlap, and how it is resolved
 *
 * Those two conditions can both be true: hero is on the clock AND the user has clicked a
 * seat. **The explicit selection wins.** Three reasons, and they are the whole of the
 * decision:
 *
 * 1. Selecting a seat is a deliberate act with a deliberate undo — `Esc`. "Hero is to act"
 *    is not: it becomes true and false several times a hand with no input from the user at
 *    all. If hero-to-act outranked the selection, opening an opponent's profile mid-hand
 *    would show it for as long as it took the action to come back round, and then replace
 *    it without being asked. A panel the user opened must not be closed by the engine.
 * 2. It keeps `Esc` doing exactly what it did before this pass: clear the selection and
 *    return the column to its default. Nothing about that listener changed.
 * 3. It is what the table already did, so no existing behaviour is inverted.
 *
 * A selected seat that happens to be HERO's own also resolves to `PLAYER`. Hero is a
 * player with notes like any other, that is what clicking hero's seat does today, and the
 * rule stays "an explicit selection wins" rather than growing an exception.
 */
import type { SeatIndex } from '@gto-self/poker-core';

/** The three things the right column can lead with. */
export type RightPanelKind = 'STRATEGY' | 'PLAYER' | 'HISTORY';

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

/** Total. See the file header for how the two conditions overlap. */
export function rightPanelFor({
  selectedPlayerSeat,
  heroIsActor,
}: RightPanelInput): RightPanelKind {
  if (selectedPlayerSeat !== null) return 'PLAYER';
  if (heroIsActor) return 'STRATEGY';
  return 'HISTORY';
}
