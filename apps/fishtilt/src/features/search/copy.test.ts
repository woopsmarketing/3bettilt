import { describe, expect, it } from 'vitest';
import { routeById } from '../../lib/routes.js';
import { CONTENT_KINDS } from '../../content/types.js';
import { SEARCH_HUB_ROUTE_IDS, SEARCH_KIND_ORDER, searchKindLabel } from './copy.js';

describe('searchKindLabel', () => {
  it('labels every real content kind', () => {
    for (const kind of CONTENT_KINDS) {
      expect(searchKindLabel(kind).length).toBeGreaterThan(0);
    }
  });

  it('labels a tool distinctly from any content kind', () => {
    const contentLabels = CONTENT_KINDS.map(searchKindLabel);
    expect(contentLabels).not.toContain(searchKindLabel('tool'));
  });
});

describe('SEARCH_KIND_ORDER', () => {
  it('lists every content kind plus tool, exactly once each', () => {
    expect(new Set(SEARCH_KIND_ORDER).size).toBe(SEARCH_KIND_ORDER.length);
    for (const kind of CONTENT_KINDS) {
      expect(SEARCH_KIND_ORDER).toContain(kind);
    }
    expect(SEARCH_KIND_ORDER).toContain('tool');
  });
});

describe('SEARCH_HUB_ROUTE_IDS', () => {
  it('every id resolves to a real route', () => {
    for (const id of SEARCH_HUB_ROUTE_IDS) {
      expect(() => routeById(id), id).not.toThrow();
    }
  });
});
