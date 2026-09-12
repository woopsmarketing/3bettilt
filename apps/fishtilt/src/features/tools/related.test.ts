import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../lib/routes.js';
import { contentById, findContent, hrefOfContent } from '../../content/graph.js';
import { TOOL_LESSON_IDS, toolLessonIds } from './related.js';

/*
 * WP-1 §6 priority 8: every tool linked back to exactly one lesson and `/tools` linked to
 * none. This file is what stops that list from rotting — a renamed content id, an unpublished
 * lesson or a seventh tool nobody mapped all fail here rather than shipping a dead card.
 */
const TOOL_ROUTES = ROUTES.filter((route) => route.section === 'tools' && route.id !== 'tools');

describe('TOOL_LESSON_IDS', () => {
  it('covers every tool route the registry knows about, and nothing else', () => {
    for (const route of TOOL_ROUTES) {
      expect(TOOL_LESSON_IDS[route.id], route.id).toBeDefined();
    }
    expect(Object.keys(TOOL_LESSON_IDS).toSorted()).toEqual(
      TOOL_ROUTES.map((route) => route.id).toSorted(),
    );
  });

  it('lists two or three lessons per tool, without repeating one', () => {
    for (const route of TOOL_ROUTES) {
      const ids = toolLessonIds(route.id);
      expect(ids.length, route.id).toBeGreaterThanOrEqual(2);
      // A fourth is a list nobody reads — see the module doc's rule for what may be listed.
      expect(ids.length, route.id).toBeLessThanOrEqual(3);
      expect(new Set(ids).size, route.id).toBe(ids.length);
    }
  });

  it('names lessons that exist, are lessons, and are published', () => {
    for (const route of TOOL_ROUTES) {
      for (const id of toolLessonIds(route.id)) {
        const record = findContent(id);
        expect(record, `${route.id} -> ${id}`).toBeDefined();
        expect(contentById(id).kind, `${route.id} -> ${id}`).toBe('learn');
        // Not a hard requirement of the component — `LinkCard` renders an unpublished record
        // as the inert 준비 중 card — but shipping a tool page whose "go and read" section is
        // three badges would be a worse page than the one this replaced.
        expect(hrefOfContent(contentById(id)), `${route.id} -> ${id}`).not.toBeNull();
      }
    }
  });

  it('puts a genuinely primary prerequisite first — the one /tools shows', () => {
    // The hub renders `toolLessonIds(id)[0]`, so the first entry is load-bearing rather than
    // incidental ordering.
    expect(toolLessonIds('range')[0]).toBe('poker-range');
    expect(toolLessonIds('toolEquity')[0]).toBe('equity');
    expect(toolLessonIds('toolPotOdds')[0]).toBe('pot-odds');
    expect(toolLessonIds('toolOuts')[0]).toBe('outs');
    expect(toolLessonIds('toolHandChecker')[0]).toBe('hand-rankings');
    expect(toolLessonIds('toolStartingHand')[0]).toBe('starting-hand-ranking');
  });

  it('throws for a tool nobody mapped rather than rendering an empty section', () => {
    expect(() => toolLessonIds('toolNotARealTool')).toThrow(/TOOL_LESSON_IDS/u);
  });
});
