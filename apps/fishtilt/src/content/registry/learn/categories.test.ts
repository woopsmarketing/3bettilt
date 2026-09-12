import { describe, expect, it } from 'vitest';
import { LEARN_RECORDS } from './index.js';
import {
  categoryOfLesson,
  categoryOfLessonOrNull,
  LEARN_CATEGORIES,
  LEARN_HUB_ANCHORS,
  LEARN_STAGES,
  LESSON_CATEGORY,
  LESSON_COUNT,
  lessonsOfCategory,
  lessonsOfStage,
  neighboursOf,
  stageOfLesson,
  stageOfLessonOrNull,
} from './categories.js';

/**
 * The curriculum order as it stands today, by slug. This is the owner's decision (WP-S3-09
 * contract: "keep the existing 15-lesson ORDER exactly"), so it is pinned here as a literal
 * rather than derived — a reorder must change this list on purpose, in the open.
 */
const CURRICULUM_ORDER = [
  'holdem-basics',
  'poker-hand-rankings',
  'starting-hands',
  'starting-hand-ranking',
  'hand-matrix',
  'poker-range',
  'position',
  'positions-6max',
  'poker-actions',
  'preflop',
  'flop-turn-river',
  'three-bet',
  'equity',
  'pot-odds',
  'outs',
] as const;

describe('learn curriculum order', () => {
  it('is 1..N gapless, in the pinned sequence', () => {
    expect(LEARN_RECORDS.map((lesson) => lesson.order)).toEqual(
      CURRICULUM_ORDER.map((_, index) => index + 1),
    );
    expect(LEARN_RECORDS.map((lesson) => lesson.slug)).toEqual([...CURRICULUM_ORDER]);
    expect(LESSON_COUNT).toBe(CURRICULUM_ORDER.length);
  });

  it('walks prev/next by order, and stops honestly at both ends', () => {
    const first = LEARN_RECORDS[0];
    const last = LEARN_RECORDS.at(-1);
    if (first === undefined || last === undefined) throw new Error('empty curriculum');
    expect(neighboursOf(first).prev).toBeUndefined();
    expect(neighboursOf(first).next?.order).toBe(2);
    expect(neighboursOf(last).next).toBeUndefined();
    expect(neighboursOf(last).prev?.order).toBe(last.order - 1);
    for (const lesson of LEARN_RECORDS) {
      const { prev, next } = neighboursOf(lesson);
      if (prev !== undefined) expect(prev.order).toBe(lesson.order - 1);
      if (next !== undefined) expect(next.order).toBe(lesson.order + 1);
    }
  });
});

describe('learn categories', () => {
  it('has seven categories with unique ids and labels', () => {
    expect(LEARN_CATEGORIES).toHaveLength(7);
    expect(new Set(LEARN_CATEGORIES.map((c) => c.id)).size).toBe(7);
    expect(new Set(LEARN_CATEGORIES.map((c) => c.label)).size).toBe(7);
    for (const category of LEARN_CATEGORIES) {
      expect(category.description.length, category.id).toBeGreaterThan(0);
    }
  });

  it('puts every lesson in exactly one category, and maps nothing that is not a lesson', () => {
    const slugs = LEARN_RECORDS.map((lesson) => lesson.slug);
    expect(Object.keys(LESSON_CATEGORY).toSorted()).toEqual([...slugs].toSorted());
    for (const lesson of LEARN_RECORDS) {
      const category = categoryOfLesson(lesson);
      const memberships = LEARN_CATEGORIES.filter((c) =>
        lessonsOfCategory(c.id).some((entry) => entry.id === lesson.id),
      );
      expect(
        memberships.map((c) => c.id),
        lesson.slug,
      ).toEqual([category.id]);
    }
  });

  it('leaves no category empty, and keeps each category in curriculum order', () => {
    for (const category of LEARN_CATEGORIES) {
      const lessons = lessonsOfCategory(category.id);
      expect(lessons.length, category.id).toBeGreaterThan(0);
      const orders = lessons.map((lesson) => lesson.order);
      expect(orders, category.id).toEqual([...orders].toSorted((a, b) => a - b));
    }
  });

  it('matches the content audit §3 proposal', () => {
    const bySlug = (id: (typeof LEARN_CATEGORIES)[number]['id']) =>
      lessonsOfCategory(id).map((lesson) => lesson.slug);
    expect(bySlug('game-start')).toEqual(['holdem-basics', 'poker-actions', 'flop-turn-river']);
    expect(bySlug('hand-rankings')).toEqual(['poker-hand-rankings']);
    expect(bySlug('starting-hands')).toEqual(['starting-hands', 'starting-hand-ranking']);
    expect(bySlug('range')).toEqual(['hand-matrix', 'poker-range']);
    expect(bySlug('position')).toEqual(['position', 'positions-6max']);
    expect(bySlug('betting')).toEqual(['preflop', 'three-bet']);
    expect(bySlug('math')).toEqual(['equity', 'pot-odds', 'outs']);
  });

  it('throws for an unmapped slug rather than guessing a category, and the OrNull form says null', () => {
    expect(() => categoryOfLesson({ slug: 'not-a-lesson' })).toThrow(/no learn category/u);
    expect(categoryOfLessonOrNull({ slug: 'not-a-lesson' })).toBeNull();
    expect(categoryOfLessonOrNull({ slug: 'outs' })?.id).toBe('math');
  });

  it('names one anchor per category, distinct from the two mode anchors', () => {
    const anchors = LEARN_CATEGORIES.map((c) => LEARN_HUB_ANCHORS.category(c.id));
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(anchors).not.toContain(LEARN_HUB_ANCHORS.roadmap);
    expect(anchors).not.toContain(LEARN_HUB_ANCHORS.topics);
    expect(LEARN_HUB_ANCHORS.roadmap).not.toBe(LEARN_HUB_ANCHORS.topics);
  });
});

describe('learn roadmap stages', () => {
  it('tile the whole curriculum with no gap and no overlap, in order', () => {
    let expectedFirst = 1;
    for (const [index, stage] of LEARN_STAGES.entries()) {
      expect(stage.ordinal, stage.id).toBe(index + 1);
      expect(stage.first, stage.id).toBe(expectedFirst);
      expect(stage.last, stage.id).toBeGreaterThanOrEqual(stage.first);
      expectedFirst = stage.last + 1;
    }
    expect(expectedFirst - 1).toBe(LESSON_COUNT);
    const covered = LEARN_STAGES.flatMap((stage) => lessonsOfStage(stage).map((l) => l.order));
    expect(covered).toEqual(LEARN_RECORDS.map((lesson) => lesson.order));
  });

  it('places every lesson in exactly the stage its order falls in', () => {
    for (const lesson of LEARN_RECORDS) {
      const stage = stageOfLesson(lesson);
      expect(lesson.order).toBeGreaterThanOrEqual(stage.first);
      expect(lesson.order).toBeLessThanOrEqual(stage.last);
    }
    expect(() => stageOfLesson({ order: LESSON_COUNT + 1 })).toThrow(/outside every stage/u);
    expect(stageOfLessonOrNull({ order: LESSON_COUNT + 1 })).toBeNull();
    expect(stageOfLessonOrNull({ order: 1 })?.ordinal).toBe(1);
  });

  it('never re-sorts: a stage lists its lessons in curriculum order', () => {
    for (const stage of LEARN_STAGES) {
      const orders = lessonsOfStage(stage).map((lesson) => lesson.order);
      expect(orders, stage.id).toEqual([...orders].toSorted((a, b) => a - b));
    }
  });
});
