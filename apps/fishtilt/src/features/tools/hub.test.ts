import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../lib/routes.js';
import { FEATURED_TOOL_ID, TOOL_DESCRIPTION, TOOL_HUB_GROUPS, toolHubEntries } from './hub.js';

const TOOL_ROUTES = ROUTES.filter((route) => route.section === 'tools' && route.id !== 'tools');

describe('toolHubEntries', () => {
  it('lists every tool route, and never the hub itself', () => {
    const listed = toolHubEntries().map((entry) => entry.route.id);
    expect(listed).toEqual(TOOL_ROUTES.map((route) => route.id));
    expect(listed).not.toContain('tools');
  });

  it('lists planned tools too, so the hub shows the whole plan honestly', () => {
    // This used to assert `planned.length > 0` — i.e. it leaned on at least one tool still
    // being unbuilt. That is a fact about how much of the product exists today, not a fact
    // about the hub's behaviour, and it went stale the day the last tool shipped. What the
    // hub actually promises is that it hides nothing: every `tools`-section route appears,
    // shipped or not, so assert that directly against the registry rather than against
    // whatever fraction happens to be unbuilt right now.
    const listed = toolHubEntries();
    expect(listed.length).toBe(TOOL_ROUTES.length);
    for (const route of TOOL_ROUTES) {
      expect(
        listed.some((entry) => entry.route.id === route.id),
        route.id,
      ).toBe(true);
    }
  });

  it('describes every tool — a new tool route cannot ship as a blank card', () => {
    for (const route of TOOL_ROUTES) {
      expect(TOOL_DESCRIPTION[route.id], route.id).toBeTruthy();
    }
    for (const entry of toolHubEntries()) {
      expect(entry.description.length, entry.route.id).toBeGreaterThan(10);
      expect(entry.description, entry.route.id).toMatch(/[가-힣]/u);
    }
  });

  it('has no description for a route that is not a tool', () => {
    const toolIds = new Set(TOOL_ROUTES.map((route) => route.id));
    for (const id of Object.keys(TOOL_DESCRIPTION)) {
      expect(toolIds.has(id), id).toBe(true);
    }
  });

  it('never says "GTO"', () => {
    for (const description of Object.values(TOOL_DESCRIPTION)) {
      expect(description.toUpperCase()).not.toContain('GTO');
    }
  });

  it('states no figure a reader would have to trust', () => {
    // The hub is prose only. The 13×13 in the range description is the SHAPE of a table, not
    // a computed value, so digits beyond that pair would mean a number crept into copy.
    for (const description of Object.values(TOOL_DESCRIPTION)) {
      const digits = description.replace(/13×13|×2|×4/gu, '').match(/\d/gu);
      expect(digits, description).toBeNull();
    }
  });
});

describe('tool hub — featured + groups (WP-S3-14)', () => {
  it('asks a question for every tool, with no figure a reader would have to trust', () => {
    for (const entry of toolHubEntries()) {
      expect(entry.question, entry.route.id).toMatch(/[가-힣]/u);
      expect(entry.question, entry.route.id).not.toMatch(/\d/u);
      expect(entry.question.toUpperCase()).not.toContain('GTO');
    }
  });

  it('partitions every tool into the featured slot or exactly one group', () => {
    const ids = toolHubEntries().map((entry) => entry.route.id);
    const grouped = TOOL_HUB_GROUPS.flatMap((group) => group.ids);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).not.toContain(FEATURED_TOOL_ID);
    expect([FEATURED_TOOL_ID, ...grouped].sort()).toEqual([...ids].sort());
    for (const group of TOOL_HUB_GROUPS) expect(group.title).toMatch(/[가-힣]/u);
  });
});
