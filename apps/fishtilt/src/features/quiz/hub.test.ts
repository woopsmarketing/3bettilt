import { describe, expect, it, vi } from 'vitest';
import type * as RoutesModule from '../../lib/routes.js';
import { PRACTICE_QUIZ_ENTRIES, practiceHubCards } from './hub.js';

/*
 * `practiceHubCards` must behave correctly whether or not `src/lib/routes.ts` has caught up
 * with a quiz's own route yet — that is the whole reason it resolves by `find` instead of
 * `routeById`. Rather than asserting today's fact ("none of the three are registered yet",
 * which WP-L2/L3 will falsify within days — the exact trap `docs/FISHTILT_STATE.md` ruling
 * 26 documents), this mocks `ROUTES` to construct all three states this module promises to
 * handle: no entry at all, an entry that is not yet available, and one that is.
 *
 * The first version of this mock spread the live `ROUTES` and then relied on `practiceRange`
 * happening to be missing from it — which held right up until WP-L2 registered
 * `/practice/range-quiz` and the "no entry at all" case started failing. That is the same
 * ruling-26 trap the comment above is about, reintroduced one line below it. So the live quiz
 * routes are now stripped out first: all three states are constructed here and none of them
 * depends on what `src/lib/routes.ts` happens to contain today.
 */
vi.mock('../../lib/routes.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RoutesModule>();
  // Declared in here, not at module scope: `vi.mock` is hoisted above module-scope consts.
  const QUIZ_ROUTE_IDS = ['practiceRange', 'practiceHandRanking', 'practiceStartingHand'];
  const ROUTES = [
    ...actual.ROUTES.filter((route) => !QUIZ_ROUTE_IDS.includes(route.id)),
    {
      id: 'practiceHandRanking',
      path: '/practice/hand-ranking-quiz',
      label: '족보 퀴즈',
      section: 'practice' as const,
      available: false,
    },
    {
      id: 'practiceStartingHand',
      path: '/practice/starting-hand-quiz',
      label: '시작 핸드 퀴즈',
      section: 'practice' as const,
      available: true,
    },
  ];
  return { ...actual, ROUTES };
});

describe('PRACTICE_QUIZ_ENTRIES', () => {
  it('names exactly the three quizzes the build spec calls for', () => {
    expect(PRACTICE_QUIZ_ENTRIES.map((entry) => entry.id)).toEqual([
      'practiceRange',
      'practiceHandRanking',
      'practiceStartingHand',
    ]);
  });

  it('describes every quiz in Korean, with no digits a reader would have to trust', () => {
    for (const entry of PRACTICE_QUIZ_ENTRIES) {
      expect(entry.description.length, entry.id).toBeGreaterThan(10);
      expect(entry.description, entry.id).toMatch(/[가-힣]/u);
      expect(entry.description, entry.id).not.toMatch(/\d/u);
    }
  });

  it('never says "GTO"', () => {
    for (const entry of PRACTICE_QUIZ_ENTRIES) {
      expect(entry.label.toUpperCase()).not.toContain('GTO');
      expect(entry.description.toUpperCase()).not.toContain('GTO');
    }
  });
});

describe('practiceHubCards', () => {
  it('resolves route to null for an id ROUTES has no entry for at all', () => {
    const cards = practiceHubCards();
    const rangeCard = cards.find((card) => card.id === 'practiceRange');
    expect(rangeCard?.route).toBeNull();
  });

  it('resolves route to the registered entry once one exists, available or not', () => {
    const cards = practiceHubCards();
    const notYetAvailable = cards.find((card) => card.id === 'practiceHandRanking');
    expect(notYetAvailable?.route).toEqual({
      id: 'practiceHandRanking',
      path: '/practice/hand-ranking-quiz',
      label: '족보 퀴즈',
      section: 'practice',
      available: false,
    });

    const shipped = cards.find((card) => card.id === 'practiceStartingHand');
    expect(shipped?.route?.available).toBe(true);
    expect(shipped?.route?.path).toBe('/practice/starting-hand-quiz');
  });

  it('lists every planned quiz exactly once, in order', () => {
    const cards = practiceHubCards();
    expect(cards.map((card) => card.id)).toEqual(PRACTICE_QUIZ_ENTRIES.map((entry) => entry.id));
  });
});
