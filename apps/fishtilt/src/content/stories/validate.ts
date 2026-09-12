/**
 * The hand-story gate (D-S3-20). `validateStory` returns every problem it can find as a
 * list of sentences; an empty list is the only pass. `registry/blog/stories/stories.test.ts`
 * runs every story in the registry through it, so a story that fails cannot be published —
 * it fails the unit suite before it reaches a build.
 *
 * What is checked, and why each is a separate line rather than one throw:
 *
 * - cards: every code parses, each street has the right count, no card is dealt twice
 *   (hero, villain, board all share one deck);
 * - board shape: a turn needs a flop, a river needs a turn;
 * - disclosure: the record carries the one sentence, exactly (rule 5 — never hidden, never
 *   paraphrased);
 * - arithmetic: `resolveStory` accepts the action sequence (checks, calls, raises, stacks,
 *   street closure, pots) — reported as its own message;
 * - showdown: the declared `winner` equals what `strategy-core`'s evaluator computes from
 *   the cards, and the hand reaches a showdown if and only if one is declared.
 *
 * An author reading the list should be able to fix the record without reading this file.
 */
import { parseCards, hasDuplicates } from '@gto-self/shared';
import type { BlogRecord, HandStoryRecord } from '../types.js';
import { resolveStory, StoryResolutionError } from './resolve.js';
import { HAND_STORY_DISCLOSURE, type HandStoryHand } from './types.js';

export interface StoryValidation {
  readonly issues: readonly string[];
  readonly ok: boolean;
}

function cardIssues(
  label: string,
  text: string | undefined,
  count: number,
  issues: string[],
): void {
  if (text === undefined) return;
  const parsed = parseCards(text);
  if (!parsed.ok) {
    issues.push(`${label}: "${text}" is not a card list (${parsed.error})`);
    return;
  }
  if (parsed.value.length !== count) {
    issues.push(`${label}: expected ${count} card(s), got ${parsed.value.length} ("${text}")`);
  }
}

/** The checks on the hand alone — no registry, no MDX. */
export function validateHand(hand: HandStoryHand): StoryValidation {
  const issues: string[] = [];

  // Cards, one at a time, so an author sees every bad code at once.
  cardIssues('heroHand', hand.heroHand, 2, issues);
  if (hand.showdown !== null)
    cardIssues('showdown.villainHand', hand.showdown.villainHand, 2, issues);
  cardIssues('flop', hand.flop, 3, issues);
  cardIssues('turn', hand.turn, 1, issues);
  cardIssues('river', hand.river, 1, issues);

  if (issues.length === 0) {
    const dealt = [hand.heroHand, hand.showdown?.villainHand, hand.flop, hand.turn, hand.river]
      .filter((text): text is string => text !== undefined)
      .join(' ');
    const parsed = parseCards(dealt);
    if (parsed.ok && hasDuplicates(parsed.value)) {
      issues.push(`the same card is dealt twice across hero, villain and board ("${dealt}")`);
    }
  }

  if (hand.turn !== undefined && hand.flop === undefined)
    issues.push('turn is given without a flop');
  if (hand.river !== undefined && hand.turn === undefined)
    issues.push('river is given without a turn');
  if (hand.flopActions !== undefined && hand.flop === undefined)
    issues.push('flopActions given without a flop');
  if (hand.turnActions !== undefined && hand.turn === undefined)
    issues.push('turnActions given without a turn');
  if (hand.riverActions !== undefined && hand.river === undefined)
    issues.push('riverActions given without a river');

  if (hand.disclosure !== HAND_STORY_DISCLOSURE) {
    issues.push(`disclosure must be exactly "${HAND_STORY_DISCLOSURE}"`);
  }
  if (hand.stakes.trim().length === 0) issues.push('stakes label is empty');

  if (issues.length > 0) return { issues, ok: false };

  try {
    const resolved = resolveStory(hand);
    if (resolved.ending.kind === 'showdown' && hand.showdown !== null) {
      if (resolved.ending.winner !== hand.showdown.winner) {
        issues.push(
          `showdown: the record declares winner "${hand.showdown.winner}", but the evaluator scores hero ${resolved.ending.hero.category} vs villain ${resolved.ending.villain.category} → "${resolved.ending.winner}"`,
        );
      }
    }
  } catch (error) {
    if (error instanceof StoryResolutionError) issues.push(`actions: ${error.message}`);
    else throw error;
  }

  return { issues, ok: issues.length === 0 };
}

/**
 * The checks on a registry record: it is a hand story in both senses (type AND hand), and
 * the hand itself validates.
 */
export function validateStory(record: BlogRecord): StoryValidation {
  const issues: string[] = [];
  if (record.contentType !== 'hand-story') {
    issues.push(`${record.id}: contentType is "${record.contentType}", not "hand-story"`);
  }
  if (record.hand === undefined) {
    issues.push(`${record.id}: a hand story needs a \`hand\``);
    return { issues, ok: false };
  }
  const hand = validateHand(record.hand);
  issues.push(...hand.issues.map((issue) => `${record.id}: ${issue}`));
  return { issues, ok: issues.length === 0 };
}

/** The `HandStoryRecord` narrowing, for callers that need the type after validating. */
export function asHandStory(record: BlogRecord): HandStoryRecord {
  const result = validateStory(record);
  if (!result.ok || record.hand === undefined) {
    throw new Error(`not a valid hand story:\n${result.issues.join('\n')}`);
  }
  return { ...record, contentType: 'hand-story', hand: record.hand };
}
