/**
 * The shape a hand story's MDX must have, checked statically against the record.
 *
 * The story template renders the boards, timelines and pots itself, but the NARRATIVE for
 * each street is prose, and prose lives in MDX. The two meet through `<StreetSection>`: the
 * MDX writes `<StreetSection street="flop">…narrative…</StreetSection>` with no data props,
 * and the template binds a record-aware `StreetSection` at render time that fills the
 * board, the actions and the pot in from the record (`StoryArticleLayout.tsx`).
 *
 * This module is the static half of that contract — what `stories.test.ts` checks on the
 * `.mdx` source, since MDX cannot be rendered under vitest (`docs/FISHTILT_STATE.md` ruling
 * 37):
 *
 * - one `<StreetSection street="…">` per street the record plays, in order, plus one for
 *   `showdown` exactly when the record declares one;
 * - no `board=`, `actions=` or `pot=` props on those tags — the data is the record's, and
 *   a second copy in the prose is the drift this whole design exists to prevent;
 * - the two editorial sections the template promises after the hand: 흥미로운 지점 (as a
 *   `##` heading or a `<KeyPoint title="흥미로운 지점">`) and `## 무엇을 배울 수 있나`.
 */
import { STORY_STREETS, type StoryStreet } from './resolve.js';
import type { HandStoryHand } from './types.js';

export const STORY_MDX_STREET_TAG = /<StreetSection\b([^>]*)>/gu;

export const INTERESTING_POINT_HEADING = '흥미로운 지점';
export const LESSON_HEADING = '무엇을 배울 수 있나';

/** The `street` values the MDX must carry, in order, for this hand. */
export function expectedStreetTags(hand: HandStoryHand): readonly (StoryStreet | 'showdown')[] {
  const streets: (StoryStreet | 'showdown')[] = STORY_STREETS.filter((street) => {
    if (street === 'preflop') return true;
    if (street === 'flop') return hand.flop !== undefined;
    if (street === 'turn') return hand.turn !== undefined;
    return hand.river !== undefined;
  });
  if (hand.showdown !== null) streets.push('showdown');
  return streets;
}

export function storyMdxIssues(source: string, hand: HandStoryHand): readonly string[] {
  const issues: string[] = [];
  const tags = [...source.matchAll(STORY_MDX_STREET_TAG)];
  const found: string[] = [];
  for (const [, attrs] of tags) {
    const street = /\bstreet="([^"]+)"/u.exec(attrs ?? '')?.[1];
    if (street === undefined) {
      issues.push('a <StreetSection> has no street="…"');
      continue;
    }
    found.push(street);
    for (const forbidden of ['board', 'actions', 'pot', 'title']) {
      if (new RegExp(`\\b${forbidden}=`, 'u').test(attrs ?? '')) {
        issues.push(
          `<StreetSection street="${street}"> sets ${forbidden}= — the template fills that from the record`,
        );
      }
    }
  }
  const expected = expectedStreetTags(hand);
  if (found.join(',') !== expected.join(',')) {
    issues.push(
      `expected <StreetSection> tags in order [${expected.join(', ')}], found [${found.join(', ')}]`,
    );
  }
  const hasInteresting =
    new RegExp(`^##\\s+${INTERESTING_POINT_HEADING}`, 'mu').test(source) ||
    new RegExp(`<KeyPoint\\b[^>]*title="${INTERESTING_POINT_HEADING}"`, 'u').test(source);
  if (!hasInteresting) {
    issues.push(
      `missing the "${INTERESTING_POINT_HEADING}" section (a \`## ${INTERESTING_POINT_HEADING}\` heading or <KeyPoint title="${INTERESTING_POINT_HEADING}">)`,
    );
  }
  if (!new RegExp(`^##\\s+${LESSON_HEADING}`, 'mu').test(source)) {
    issues.push(`missing the \`## ${LESSON_HEADING}\` heading`);
  }
  return issues;
}
