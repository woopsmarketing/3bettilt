/**
 * Which lessons each tool sends a stuck reader back to.
 *
 * ## The gap this closes
 *
 * Every tool carried exactly ONE link back into `/learn/*` and `/tools` carried none at all
 * (WP-1 §6 priority 8), so the six pages that take the most search traffic were the site's
 * thinnest outbound surface into its own writing.
 *
 * ## The rule for what may be listed here
 *
 * A lesson earns a place only if a reader can get STUCK on that tool for the reason that
 * lesson exists — not because the topics are adjacent. That is why `/tools/range` lists
 * `hand-matrix` (the tool's own first question is "표는 어떻게 읽나요?") and `positions-6max`
 * (its filter row is six abbreviations a beginner has not met yet), and why it does not list
 * every preflop lesson in the curriculum. Two or three per tool; a fourth would be a list
 * nobody reads.
 *
 * Ids, never paths: `contentById` throws for an unknown id and `hrefOfContent` returns `null`
 * for a record that is not published yet, so a rename cannot strand a link and an unwritten
 * lesson renders as the site's inert "준비 중" card rather than a 404. `related.test.ts` proves
 * every id below resolves.
 *
 * The FIRST id of each tool is its primary prerequisite — the one `/tools` shows on the hub —
 * so the ordering here is meaningful, not alphabetical.
 */
import type { ContentId } from '../../content/types.js';

/** Keyed by route id from `src/lib/routes.ts`, like `TOOL_DESCRIPTION` and `ToolCTA`. */
export const TOOL_LESSON_IDS: Readonly<Record<string, readonly ContentId[]>> = {
  // The 13x13 grid, the six seat abbreviations, and the word "레인지" itself: the three things
  // a first-time visitor to the flagship tool has to know before the colours mean anything.
  range: ['poker-range', 'hand-matrix', 'positions-6max'],
  // The ranking is a property of two cards; "왜 이 순서인가" is the strength lesson, "이 표는
  // 무엇인가" is the matrix lesson, and "내 두 장이 좋은 패인가" is where a beginner starts.
  toolStartingHand: ['starting-hand-ranking', 'starting-hands', 'hand-matrix'],
  // Equity itself, the hand rankings that decide who wins a runout, and the streets that
  // explain why a board is 0/3/4/5 cards — the tool's own three explanations.
  toolEquity: ['equity', 'hand-rankings', 'flop-turn-river'],
  // The price, the probability it has to be compared against, and the win rate it is a
  // threshold on. The calculator prints all three; these are the three lessons behind them.
  toolPotOdds: ['pot-odds', 'outs', 'equity'],
  // Counting outs, the price that count is measured against, and the streets the two-card
  // horizon depends on.
  toolOuts: ['outs', 'pot-odds', 'flop-turn-river'],
  // The nine categories, and the board that produced them.
  toolHandChecker: ['hand-rankings', 'flop-turn-river'],
};

/**
 * The lessons for one tool, by route id. Throws rather than returning an empty list for a
 * tool nobody mapped — a silently empty section is the "plausible stub" CLAUDE.md rule 5
 * bans, and `related.test.ts` checks every tool route is present here.
 */
export function toolLessonIds(toolRouteId: string): readonly ContentId[] {
  const ids = TOOL_LESSON_IDS[toolRouteId];
  if (ids === undefined) {
    throw new Error(`Tool route "${toolRouteId}" has no lessons in TOOL_LESSON_IDS`);
  }
  return ids;
}

/**
 * The one lesson `/tools` shows beside a tool's card. Throws for an empty list rather than
 * letting a hub card resolve to `undefined` — the ordering above is the editorial decision and
 * an empty entry would mean nobody made it.
 */
export function primaryToolLessonId(toolRouteId: string): ContentId {
  const first = toolLessonIds(toolRouteId)[0];
  if (first === undefined) {
    throw new Error(`Tool route "${toolRouteId}" has an empty lesson list in TOOL_LESSON_IDS`);
  }
  return first;
}
