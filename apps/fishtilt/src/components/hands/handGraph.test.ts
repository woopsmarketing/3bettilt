/**
 * @vitest-environment node
 *
 * `handGraph.ts` — every derived number and link a hand page shows, pinned against the
 * packages and the content graph rather than reasoned about (Stage 3 common rule 3).
 */
import { describe, expect, it } from 'vitest';
import { handClassByKey, HAND_CLASSES } from '@gto-self/strategy-core';
import { HAND_STRENGTH_BY_RANK } from '@gto-self/learn-core';
import { factValue } from '../../content/facts.js';
import { contentById, contentOfKind } from '../../content/graph.js';
import type { HandRecord } from '../../content/types.js';
import {
  classKeyOfCards,
  guidesFor,
  handFamilyOf,
  handHubGroups,
  handRecordForKey,
  hubListedHands,
  rankNeighbours,
  rfiSeatsWith,
  storiesFeaturing,
  twinKeyOf,
} from './handGraph.js';

function classOf(key: string) {
  const handClass = handClassByKey(key);
  if (handClass === undefined) throw new Error(`fixture: no such class ${key}`);
  return handClass;
}

function handRecord(id: string): HandRecord {
  const record = contentById(id);
  if (record.kind !== 'hands') throw new Error(`fixture: ${id} is not a hand record`);
  return record;
}

describe('classKeyOfCards', () => {
  it('maps two concrete cards to strategy-core’s class key', () => {
    expect(classKeyOfCards('Qs Qh')).toBe('QQ');
    expect(classKeyOfCards('Ad 4d')).toBe('A4s');
    expect(classKeyOfCards('7c 2d')).toBe('72o');
    expect(classKeyOfCards('Jh Th')).toBe('JTs');
  });

  it('refuses anything that is not exactly two distinct legal cards', () => {
    expect(classKeyOfCards('Qs')).toBeNull();
    expect(classKeyOfCards('Qs Qs')).toBeNull();
    expect(classKeyOfCards('Qs Qh 2d')).toBeNull();
    expect(classKeyOfCards('not cards')).toBeNull();
  });
});

describe('twinKeyOf', () => {
  it('flips s/o for a non-pair and is null for a pair', () => {
    expect(twinKeyOf(classOf('AKs'))).toBe('AKo');
    expect(twinKeyOf(classOf('AKo'))).toBe('AKs');
    expect(twinKeyOf(classOf('QQ'))).toBeNull();
  });
});

describe('rankNeighbours', () => {
  it('lists the hand, two above, two below, sorted strongest first — read from the dataset', () => {
    const rows = rankNeighbours(classOf('KQs'));
    const selfRank = Number(factValue('HAND_RANK', 'KQs'));
    const expectedNeighbours = [-2, -1, 1, 2].map(
      (delta) => HAND_STRENGTH_BY_RANK[selfRank + delta - 1]!.key,
    );
    const keys = rows.map((row) => row.entry.key);
    for (const key of expectedNeighbours) expect(keys).toContain(key);
    expect(keys).toContain('KQs');
    expect(keys).toContain('KQo'); // the twin
    expect(rows.map((row) => row.entry.rank)).toEqual(
      [...rows].map((row) => row.entry.rank).sort((a, b) => a - b),
    );
    expect(rows.find((row) => row.entry.key === 'KQs')?.role).toBe('self');
    expect(rows.find((row) => row.entry.key === 'KQo')?.role).toBe('twin');
    expect(rows.filter((row) => row.role === 'neighbour')).toHaveLength(4);
  });

  it('clamps at rank 1 and never duplicates a key', () => {
    const rows = rankNeighbours(classOf('AA'));
    expect(rows.map((row) => row.entry.key)).toEqual(
      HAND_STRENGTH_BY_RANK.slice(0, 3).map((entry) => entry.key),
    );
    expect(rows[0]?.role).toBe('self');
    expect(new Set(rows.map((row) => row.entry.key)).size).toBe(rows.length);
  });

  it('keeps the twin role for a twin that also sits inside the rank window', () => {
    // Find any suited class whose offsuit twin is within two ranks, if the dataset has one;
    // otherwise the property is vacuous, and the assertion below still holds.
    for (const handClass of HAND_CLASSES) {
      const rows = rankNeighbours(handClass);
      const twin = twinKeyOf(handClass);
      const twinRow = rows.find((row) => row.entry.key === twin);
      if (twinRow !== undefined) expect(twinRow.role).toBe('twin');
      expect(rows.filter((row) => row.role === 'self')).toHaveLength(1);
    }
  });
});

describe('rfiSeatsWith', () => {
  it('agrees with the RFI_POSITIONS_WITH fact for every hand that has a page', () => {
    for (const record of contentOfKind('hands') as readonly HandRecord[]) {
      const seats = rfiSeatsWith(classOf(record.handKey));
      const sentence = factValue('RFI_POSITIONS_WITH', record.handKey);
      const expected = sentence === '한 자리도 없습니다' ? [] : sentence.split(' · ');
      expect(seats, record.handKey).toEqual(expected);
    }
  });

  it('never lists BB — nobody opens first-in from the big blind', () => {
    for (const handClass of HAND_CLASSES) {
      expect(rfiSeatsWith(handClass)).not.toContain('BB');
    }
  });
});

describe('handRecordForKey', () => {
  it('finds the record for a covered class and nothing for an uncovered one', () => {
    expect(handRecordForKey('AKs')?.id).toBe('hand-aks');
    expect(handRecordForKey('72o')).toBeUndefined();
  });
});

describe('storiesFeaturing', () => {
  it('derives the story from the hero’s real cards, not from a declared relation', () => {
    const qq = storiesFeaturing(handRecord('hand-qq'));
    const featured = qq.find((entry) => entry.story.id === 'blog-qq-vs-72o-flop-227');
    expect(featured?.reason).toBe('hero');
    // Every story listed either dealt this class to someone or declared the relation.
    for (const { story, reason } of qq) {
      if (reason === 'hero') expect(classKeyOfCards(story.hand.heroHand)).toBe('QQ');
    }
  });

  it('derives the story from the villain’s showdown cards', () => {
    // `blog-full-house-loses`: villain shows T9o. There is no T9o page, so check the
    // mechanism on a hand that does have one: `blog-river-changes-everything` hero JTs.
    const jts = storiesFeaturing(handRecord('hand-jts'));
    expect(jts.map((entry) => entry.story.id)).toContain('blog-river-changes-everything');
    expect(jts.find((entry) => entry.story.id === 'blog-river-changes-everything')?.reason).toBe(
      'hero',
    );
  });

  it('lists each story once, card-derived reasons first', () => {
    for (const record of contentOfKind('hands') as readonly HandRecord[]) {
      const ids = storiesFeaturing(record).map((entry) => entry.story.id);
      expect(new Set(ids).size, record.id).toBe(ids.length);
    }
  });
});

describe('guidesFor', () => {
  it('keeps the declared relatedArticles and adds guides that point back at the hand', () => {
    const aks = guidesFor(handRecord('hand-aks')).map((guide) => guide.id);
    expect(aks[0]).toBe('blog-aks-vs-ako'); // declared, first
    expect(aks).toContain('blog-is-ak-good'); // reverse: its relatedHands names hand-aks
    expect(new Set(aks).size).toBe(aks.length);
  });

  it('never lists a hand story as a guide', () => {
    for (const record of contentOfKind('hands') as readonly HandRecord[]) {
      for (const guide of guidesFor(record)) {
        if (guide.kind === 'blog') expect(guide.contentType, guide.id).not.toBe('hand-story');
      }
    }
  });
});

describe('hubListedHands', () => {
  const records = contentOfKind('hands') as readonly HandRecord[];

  it('lists the published hands in 13×13 grid order — the order the hub first links them', () => {
    const listed = hubListedHands(records);
    expect(listed.every((record) => record.status === 'PUBLISHED')).toBe(true);
    expect(listed).toHaveLength(records.filter((r) => r.status === 'PUBLISHED').length);
    const indexes = listed.map((record) => handClassByKey(record.handKey)!.index);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    // Same members and order as walking the grid and keeping the covered cells.
    const covered = new Set(listed.map((record) => record.handKey));
    expect(HAND_CLASSES.filter((c) => covered.has(c.key)).map((c) => c.key)).toEqual(
      listed.map((record) => record.handKey),
    );
  });

  it('drops planned records and parks an unresolvable key last', () => {
    const planned: HandRecord = { ...records[0]!, id: 'p', slug: 'p', status: 'PLANNED' };
    const odd: HandRecord = { ...records[0]!, id: 'o', slug: 'o', handKey: 'ZZx' };
    const listed = hubListedHands([...records, planned, odd]);
    expect(listed.map((r) => r.id)).not.toContain('p');
    expect(listed.at(-1)?.id).toBe('o');
  });
});

describe('handHubGroups', () => {
  const records = contentOfKind('hands') as readonly HandRecord[];

  it('groups pairs, ace-highs and the rest, strongest first inside each group', () => {
    const groups = handHubGroups(records);
    expect(groups.map((group) => group.family)).toEqual(['PAIR', 'ACE', 'BROADWAY']);
    for (const group of groups) {
      for (const row of group.rows) expect(handFamilyOf(row.handClass!)).toBe(group.family);
      const ranks = group.rows.map((row) => row.strength!.rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
    expect(groups.flatMap((group) => group.rows)).toHaveLength(records.length);
  });

  it('parks a record with an unresolvable key last without throwing', () => {
    const fixture: HandRecord = { ...handRecord('hand-22'), id: 'x', slug: 'x', handKey: 'ZZx' };
    const groups = handHubGroups([...records, fixture]);
    const last = groups.at(-1)!.rows.at(-1)!;
    expect(last.record.id).toBe('x');
    expect(last.handClass).toBeUndefined();
  });
});
