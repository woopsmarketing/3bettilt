import { describe, expect, it } from 'vitest';
import { glossaryRecords } from '../../content/graph.js';
import { GLOSSARY_INITIALS } from '../../content/registry/glossary/initials.js';
import type { GlossaryRecord } from '../../content/types.js';
import {
  categoryGroups,
  hubEntries,
  hubEntryOf,
  initialGroups,
  searchNormalize,
} from './hubModel.js';

const PLANNED: GlossaryRecord = {
  kind: 'glossary',
  id: 'term-fixture-unwritten',
  slug: 'fixture-unwritten',
  title: '테스트 픽스처 용어 (Fixture)',
  description: '테스트 전용.',
  level: 'BASIC',
  topic: 'range',
  concepts: [],
  prerequisites: [],
  relatedConcepts: [],
  relatedTools: [],
  relatedHands: [],
  nextLessons: [],
  relatedArticles: [],
  status: 'PLANNED',
  indexable: false,
  readMinutes: null,
  term: 'Fixture',
  aliases: ['픽스처', 'fx'],
  shortDefinition: '테스트에서만 쓰는 짧은 정의.',
};

describe('hubModel', () => {
  const entries = hubEntries([...glossaryRecords(), PLANNED]);

  it('resolves one entry per record, in dictionary order, with the fixture unlinked', () => {
    expect(entries).toHaveLength(glossaryRecords().length + 1);
    const fixture = entries.find((entry) => entry.record.id === PLANNED.id);
    expect(fixture?.href).toBeNull();
    expect(fixture?.headword).toBe('픽스처');
    expect(fixture?.category).toBeNull();
    for (const entry of entries) {
      if (entry.record.status === 'PUBLISHED') expect(entry.href, entry.record.slug).not.toBeNull();
    }
  });

  it('prints the Latin names beside the headword and keeps the Korean ones for search', () => {
    const threeBet = hubEntryOf(glossaryRecords().find((t) => t.slug === 'three-bet')!);
    expect(threeBet.headword).toBe('쓰리벳');
    expect(threeBet.latinNames).toEqual(['3-Bet', '3-bet', '3bet']);
    expect(threeBet.searchKey.split('|')).toEqual(
      expect.arrayContaining(['쓰리벳', '3-bet', '3bet', '삼벳', '쓰리벳']),
    );
    // Spaces and case are gone from the key, so "쓰리 벳" and "3Bet" both match.
    expect(threeBet.searchKey).not.toMatch(/\s|[A-Z]/u);
  });

  it('normalises a query the same way it wrote the key', () => {
    expect(searchNormalize(' 쓰리 벳 ')).toBe('쓰리벳');
    expect(searchNormalize('3-Bet')).toBe('3-bet');
  });

  it('files every entry under exactly one tab, every tab present, in order', () => {
    const groups = initialGroups(entries);
    expect(groups.map((g) => g.initial)).toEqual([...GLOSSARY_INITIALS]);
    expect(groups.flatMap((g) => g.entries).length).toBe(entries.length);
    expect(new Set(groups.map((g) => g.anchor)).size).toBe(groups.length);
    // The list order IS the tab order — the index renders `entries` and the groups agree.
    expect(groups.flatMap((g) => g.entries.map((e) => e.record.id))).toEqual(
      entries.map((e) => e.record.id),
    );
  });

  it('puts every real term in exactly one category group and leaves the fixture out', () => {
    const groups = categoryGroups(entries);
    expect(groups).toHaveLength(6);
    const ids = groups.flatMap((g) => g.entries.map((e) => e.record.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(glossaryRecords().length);
    expect(ids).not.toContain(PLANNED.id);
    for (const group of groups) expect(group.entries.length, group.category.id).toBeGreaterThan(0);
  });
});
