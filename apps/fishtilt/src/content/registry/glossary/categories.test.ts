import { describe, expect, it } from 'vitest';
import { GLOSSARY_RECORDS } from './index.js';
import {
  categoryOfTerm,
  categoryOfTermOrNull,
  GLOSSARY_CATEGORIES,
  GLOSSARY_HUB_ANCHORS,
  headwordOf,
  otherNamesOf,
  sortByHeadword,
  TERM_CATEGORY,
  TERM_HEADWORD,
  termsOfCategory,
} from './categories.js';
import { initialOf } from './initials.js';

/**
 * The content audit's §4 assignment (`3BETTILT_CONTENT_AUDIT.md`), pinned per slug so a
 * term cannot quietly move category. A move must change this list on purpose, in the open.
 */
const AUDIT_ASSIGNMENT = {
  game: [
    'ante',
    'blind',
    'big-blind',
    'small-blind',
    'stack',
    'pot',
    'heads-up',
    'showdown',
    'preflop',
    'board',
    'community-cards',
    'flop',
    'turn',
    'river',
  ],
  betting: [
    'open-raise',
    'action',
    'all-in',
    'check',
    'call',
    'bet',
    'raise',
    'fold',
    'limp',
    'three-bet',
    'four-bet',
    'c-bet',
    'bluff',
    'vpip',
    'pfr',
  ],
  position: ['position', 'button', 'cutoff', 'hijack', 'utg', 'ip-oop'],
  'hand-rankings': [
    'hand-ranking',
    'high-card',
    'one-pair',
    'two-pair',
    'three-of-a-kind',
    'set-vs-trips',
    'straight',
    'flush',
    'full-house',
    'four-of-a-kind',
    'straight-flush',
    'kicker',
    'split-pot',
    'nuts',
  ],
  math: ['draw', 'outs', 'equity', 'pot-odds', 'gutshot', 'open-ended'],
  'starting-hands': [
    'range',
    'suited',
    'offsuit',
    'pocket-pair',
    'combo',
    'hand',
    'hand-matrix',
    'broadway',
    'connector',
  ],
} as const;

describe('glossary categories', () => {
  it('has six categories with unique ids and labels, each described', () => {
    expect(GLOSSARY_CATEGORIES).toHaveLength(6);
    expect(new Set(GLOSSARY_CATEGORIES.map((c) => c.id)).size).toBe(6);
    expect(new Set(GLOSSARY_CATEGORIES.map((c) => c.label)).size).toBe(6);
    for (const category of GLOSSARY_CATEGORIES) {
      expect(category.description.length, category.id).toBeGreaterThan(0);
    }
  });

  it('puts every term in exactly one category, and maps nothing that is not a term', () => {
    const slugs = GLOSSARY_RECORDS.map((term) => term.slug);
    expect(Object.keys(TERM_CATEGORY).toSorted()).toEqual([...slugs].toSorted());
    for (const term of GLOSSARY_RECORDS) {
      const category = categoryOfTerm(term);
      const memberships = GLOSSARY_CATEGORIES.filter((c) =>
        termsOfCategory(c.id).some((entry) => entry.id === term.id),
      );
      expect(
        memberships.map((c) => c.id),
        term.slug,
      ).toEqual([category.id]);
    }
  });

  it('leaves no category empty', () => {
    for (const category of GLOSSARY_CATEGORIES) {
      expect(termsOfCategory(category.id).length, category.id).toBeGreaterThan(0);
    }
  });

  it('matches the content audit §4 assignment, term by term', () => {
    for (const [id, slugs] of Object.entries(AUDIT_ASSIGNMENT)) {
      const actual = termsOfCategory(id as keyof typeof AUDIT_ASSIGNMENT).map((t) => t.slug);
      expect([...actual].toSorted(), id).toEqual([...slugs].toSorted());
    }
    const total = Object.values(AUDIT_ASSIGNMENT).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(GLOSSARY_RECORDS.length);
  });

  it('throws for an unmapped slug rather than guessing, and the OrNull form says null', () => {
    expect(() => categoryOfTerm({ slug: 'not-a-term' })).toThrow(/no glossary category/u);
    expect(categoryOfTermOrNull({ slug: 'not-a-term' })).toBeNull();
    expect(categoryOfTermOrNull({ slug: 'kicker' })?.id).toBe('hand-rankings');
  });

  it('names one anchor per category, distinct from the fixed section anchors', () => {
    const fixed = [
      GLOSSARY_HUB_ANCHORS.search,
      GLOSSARY_HUB_ANCHORS.popular,
      GLOSSARY_HUB_ANCHORS.categories,
      GLOSSARY_HUB_ANCHORS.index,
    ];
    expect(new Set(fixed).size).toBe(fixed.length);
    const anchors = GLOSSARY_CATEGORIES.map((c) => GLOSSARY_HUB_ANCHORS.category(c.id));
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const anchor of anchors) expect(fixed).not.toContain(anchor);
    expect(GLOSSARY_HUB_ANCHORS.initial('g')).not.toBe(GLOSSARY_HUB_ANCHORS.category('game'));
  });
});

describe('glossary headwords', () => {
  it('gives every term an explicit headword, and maps nothing that is not a term', () => {
    const slugs = GLOSSARY_RECORDS.map((term) => term.slug);
    expect(Object.keys(TERM_HEADWORD).toSorted()).toEqual([...slugs].toSorted());
  });

  it('never invents a name: each headword is verbatim the term or one of its aliases', () => {
    for (const term of GLOSSARY_RECORDS) {
      const headword = headwordOf(term);
      expect([term.term, ...term.aliases], `${term.slug}: "${headword}"`).toContain(headword);
    }
  });

  it('appears in every title, so the word a reader searches is in the <title>/H1 (WP-S3-19)', () => {
    for (const term of GLOSSARY_RECORDS) {
      expect(term.title, `${term.slug}: "${term.title}"`).toContain(headwordOf(term));
    }
  });

  it('is unique across the glossary, so the dictionary has one row per word', () => {
    const headwords = GLOSSARY_RECORDS.map(headwordOf);
    expect(new Set(headwords).size).toBe(headwords.length);
  });

  it('files digit-first terms under a consonant tab by choosing the Hangul spelling', () => {
    expect(headwordOf({ slug: 'three-bet', term: '3-Bet', aliases: ['3벳', '쓰리벳'] })).toBe(
      '쓰리벳',
    );
    expect(initialOf(headwordOf(GLOSSARY_RECORDS.find((t) => t.slug === 'four-bet')!))).toBe('ㅍ');
    // Only the two stat abbreviations have no Korean name of their own.
    const latin = GLOSSARY_RECORDS.filter((term) => initialOf(headwordOf(term)) === 'A–Z');
    expect(latin.map((term) => term.slug).toSorted()).toEqual(['pfr', 'vpip']);
  });

  it('falls back to the first Hangul alias, then the term, for a record outside the table', () => {
    expect(headwordOf({ slug: 'fixture', term: 'Fixture', aliases: ['fx', '픽스처'] })).toBe(
      '픽스처',
    );
    expect(headwordOf({ slug: 'fixture', term: 'Fixture', aliases: [] })).toBe('Fixture');
  });

  it('lists the other names with the Latin term first and the headword removed', () => {
    const threeBet = GLOSSARY_RECORDS.find((t) => t.slug === 'three-bet')!;
    const others = otherNamesOf(threeBet);
    expect(others[0]).toBe('3-Bet');
    expect(others).not.toContain('쓰리벳');
    expect(others).toEqual(expect.arrayContaining(['3벳', '3bet']));
  });

  it('sorts by tab first (ㄱ … ㅎ, then A–Z), then by Korean collation inside the tab', () => {
    const sorted = sortByHeadword(GLOSSARY_RECORDS);
    const headwords = sorted.map(headwordOf);
    const tabs = headwords.map(initialOf);
    // Tabs never go backwards.
    const ORDER = [
      'ㄱ',
      'ㄴ',
      'ㄷ',
      'ㄹ',
      'ㅁ',
      'ㅂ',
      'ㅅ',
      'ㅇ',
      'ㅈ',
      'ㅊ',
      'ㅋ',
      'ㅌ',
      'ㅍ',
      'ㅎ',
      'A–Z',
    ];
    for (let i = 1; i < tabs.length; i += 1) {
      expect(ORDER.indexOf(tabs[i]!), headwords[i]).toBeGreaterThanOrEqual(
        ORDER.indexOf(tabs[i - 1]!),
      );
    }
    // And the Latin group is last.
    expect(tabs.at(-1)).toBe('A–Z');
    // Inside one tab, Korean collation.
    const s = headwords.filter((h) => initialOf(h) === 'ㅅ');
    expect(s).toEqual([...s].sort((a, b) => a.localeCompare(b, 'ko')));
  });
});
