/**
 * The data behind a hand page and the hands hub (WP-S3-13a, contract AY) — pure selectors
 * over the packages and the content graph, no React, so `handGraph.test.ts` can pin every
 * number and every derived link without rendering.
 *
 * ## Poker data honesty
 *
 * Nothing here types a rank, an equity, a combo count or a range membership. Rank
 * neighbours come from `learn-core`'s `HAND_STRENGTH_BY_RANK` (the exact enumeration the
 * rest of the site reads); range seats come from `resolveRange` over the ONE shipped
 * dataset (6-max · 100BB · first in), the same call `facts.ts`'s `RFI_POSITIONS_WITH`
 * makes; the class a story's hole cards belong to is `strategy-core`'s own
 * `handClassOfCombo`. Formatting of the numbers stays with `factValue`, so a figure in the
 * comparison table is byte-identical to the same figure in a sentence.
 *
 * ## Derived links, and why they are derived
 *
 * The content audit found 11 of 20 hand records with an empty `relatedArticles` while the
 * blog side already declared `relatedHands` pointing back at them (a guide about AK names
 * `hand-aks`), and the hand stories carry the hero's and villain's real cards. So a hand
 * page's "관련 가이드" and "이런 이야기도 있어요" groups are the UNION of what the record
 * declares and what the rest of the graph declares about it. The declared relation is
 * never dropped; the derived ones are added. The honesty gate is unchanged: a destination
 * with no page renders as 준비 중 text, never as a link.
 */
import { parseCards } from '@gto-self/shared';
import {
  comboIndexOf,
  handClassByKey,
  handClassOfCombo,
  hasHandClass,
  STRATEGY_POSITIONS,
  type HandClass,
  type StrategyPosition,
} from '@gto-self/strategy-core';
import {
  HAND_STRENGTH_BY_RANK,
  handStrengthOf,
  type HandStrengthEntry,
} from '@gto-self/learn-core';
import { blogRecords, contentOfKind, findContent, isHandStory } from '../../content/graph.js';
import type { BlogRecord, HandRecord, HandStoryRecord, LearnRecord } from '../../content/types.js';
import { resolveRange } from '../../features/range/index.js';

/* ------------------------------------------------------------------------------------- */
/* Hand classes                                                                            */
/* ------------------------------------------------------------------------------------- */

/** The hand record (if any page exists, written or planned) for a class key. */
export function handRecordForKey(handKey: string): HandRecord | undefined {
  return (contentOfKind('hands') as readonly HandRecord[]).find(
    (record) => record.handKey === handKey,
  );
}

/**
 * The published hands in the order the hub FIRST links them — the 13×13 index's grid order
 * (`HAND_CLASSES`, row-major), which sits above the grouped list on the page. This is what
 * the hub's `CollectionPage`/`ItemList` lists, so the markup's positions are the page's own
 * first-occurrence order (`hubCollectionPage.test.tsx`), not the grouped list's second
 * ordering. A record whose key is not one of the 169 has no cell and is listed last.
 */
export function hubListedHands(records: readonly HandRecord[]): readonly HandRecord[] {
  const cellIndex = (record: HandRecord): number =>
    handClassByKey(record.handKey)?.index ?? Number.POSITIVE_INFINITY;
  return records
    .filter((record) => record.status === 'PUBLISHED')
    .slice()
    .sort((a, b) => cellIndex(a) - cellIndex(b));
}

/**
 * The 169-class key two concrete cards belong to (`'Qs Qh'` -> `'QQ'`, `'Ad 4d'` ->
 * `'A4s'`), or `null` when the text is not exactly two legal, distinct cards. `null`
 * rather than a throw: a story record's cards are validated by `stories.test.ts`; this is
 * a selector, and a selector that throws on bad data takes the whole page down for a link.
 */
export function classKeyOfCards(text: string): string | null {
  const parsed = parseCards(text);
  if (!parsed.ok || parsed.value.length !== 2) return null;
  const [a, b] = parsed.value;
  if (a === undefined || b === undefined || a === b) return null;
  return handClassOfCombo(comboIndexOf(a, b)).key;
}

/** The suited/offsuit twin of a non-pair class (`AKs` <-> `AKo`); `null` for a pair. */
export function twinKeyOf(handClass: HandClass): string | null {
  if (handClass.kind === 'PAIR') return null;
  const stem = handClass.key.slice(0, -1);
  return handClass.kind === 'SUITED' ? `${stem}o` : `${stem}s`;
}

export type ComparisonRole = 'self' | 'neighbour' | 'twin';

export interface ComparisonEntry {
  readonly entry: HandStrengthEntry;
  readonly role: ComparisonRole;
}

/**
 * The rows of a hand page's comparison table: the hand itself, `span` ranks above and
 * below it (clamped at 1 and 169), and — for a non-pair — its suited/offsuit twin, sorted
 * strongest first. A twin already inside the rank window keeps the `twin` role, so the
 * table can say what it is; it is never listed twice.
 */
export function rankNeighbours(handClass: HandClass, span = 2): readonly ComparisonEntry[] {
  const self = handStrengthOf(handClass);
  const twinKey = twinKeyOf(handClass);
  const twinClass = twinKey === null ? undefined : handClassByKey(twinKey);
  const twin = twinClass === undefined ? undefined : handStrengthOf(twinClass);

  const rows = new Map<string, ComparisonEntry>();
  const lowest = Math.max(1, self.rank - span);
  const highest = Math.min(HAND_STRENGTH_BY_RANK.length, self.rank + span);
  for (let rank = lowest; rank <= highest; rank += 1) {
    const entry = HAND_STRENGTH_BY_RANK[rank - 1];
    if (entry === undefined) continue;
    rows.set(entry.key, { entry, role: entry.key === self.key ? 'self' : 'neighbour' });
  }
  if (twin !== undefined) rows.set(twin.key, { entry: twin, role: 'twin' });

  return [...rows.values()].sort((a, b) => a.entry.rank - b.entry.rank);
}

/* ------------------------------------------------------------------------------------- */
/* Ranges                                                                                  */
/* ------------------------------------------------------------------------------------- */

/** The one supported condition, stated once so every surface words it identically. */
export const SUPPORTED_RANGE_CONDITION = '6인 · 100BB · 아무도 참여하지 않았을 때(First In)';

/**
 * The seats whose shipped first-in range includes this class — the same computation
 * `factValue('RFI_POSITIONS_WITH')` renders as a sentence, returned as positions so a
 * diagram can highlight them. BB never opens first-in, so it is never in this list.
 */
export function rfiSeatsWith(handClass: HandClass): readonly StrategyPosition[] {
  return STRATEGY_POSITIONS.filter((position) => {
    const resolution = resolveRange({
      heroPosition: position,
      spot: 'RFI',
      stackDepth: 100,
      tableSize: 6,
    });
    return resolution.kind === 'RANGE' && hasHandClass(resolution.range, handClass.index);
  });
}

/* ------------------------------------------------------------------------------------- */
/* Onward links                                                                            */
/* ------------------------------------------------------------------------------------- */

function isGuide(record: BlogRecord): boolean {
  return !isHandStory(record) && record.contentType !== 'hand-story';
}

/**
 * The guides for a hand page — declared `relatedArticles` (blog guides and lessons, in
 * declared order) followed by every blog guide whose own `relatedHands` names this hand.
 */
export function guidesFor(record: HandRecord): readonly (BlogRecord | LearnRecord)[] {
  const out: (BlogRecord | LearnRecord)[] = [];
  const seen = new Set<string>();
  const push = (candidate: BlogRecord | LearnRecord): void => {
    if (seen.has(candidate.id)) return;
    seen.add(candidate.id);
    out.push(candidate);
  };

  for (const id of record.relatedArticles) {
    const target = findContent(id);
    if (target === undefined) continue;
    if (target.kind === 'learn') push(target);
    else if (target.kind === 'blog' && isGuide(target)) push(target);
  }
  for (const article of blogRecords()) {
    if (isGuide(article) && article.relatedHands.includes(record.id)) push(article);
  }
  return out;
}

/** Why a story is on a hand page — shown as the row's small print. */
export type StoryFeatureReason = 'hero' | 'villain' | 'declared';

export interface FeaturedStory {
  readonly story: HandStoryRecord;
  readonly reason: StoryFeatureReason;
}

/**
 * The hand stories that actually feature this hand: the hero held it, the villain turned
 * it over at showdown, or one side declared the relation (`relatedArticles` on the hand,
 * `relatedHands` on the story). Card-derived matches come first; every story record is
 * considered, and the honesty gate decides whether a row links.
 */
export function storiesFeaturing(record: HandRecord): readonly FeaturedStory[] {
  const out: FeaturedStory[] = [];
  const seen = new Set<string>();
  const push = (story: HandStoryRecord, reason: StoryFeatureReason): void => {
    if (seen.has(story.id)) return;
    seen.add(story.id);
    out.push({ story, reason });
  };

  const stories = blogRecords().filter(isHandStory);
  for (const story of stories) {
    if (classKeyOfCards(story.hand.heroHand) === record.handKey) push(story, 'hero');
  }
  for (const story of stories) {
    const villain = story.hand.showdown?.villainHand;
    if (villain !== undefined && classKeyOfCards(villain) === record.handKey) {
      push(story, 'villain');
    }
  }
  for (const story of stories) {
    if (story.relatedHands.includes(record.id) || record.relatedArticles.includes(story.id)) {
      push(story, 'declared');
    }
  }
  return out;
}

/* ------------------------------------------------------------------------------------- */
/* Hub grouping                                                                            */
/* ------------------------------------------------------------------------------------- */

export type HandFamily = 'PAIR' | 'ACE' | 'BROADWAY';

/** The hub's three groups, in display order, with the label each renders under. */
export const HAND_FAMILY_ORDER: readonly HandFamily[] = ['PAIR', 'ACE', 'BROADWAY'];

export const HAND_FAMILY_LABEL: Readonly<Record<HandFamily, string>> = {
  PAIR: '페어',
  ACE: '에이스 수티드 · 오프수트',
  BROADWAY: '브로드웨이 · 수티드 커넥터',
};

/** A one-line description of what the group is, in the hub's own words — no strategy. */
export const HAND_FAMILY_DESCRIPTION: Readonly<Record<HandFamily, string>> = {
  PAIR: '같은 숫자 두 장. 13×13 표의 대각선에 놓입니다.',
  ACE: 'A가 들어간 두 장. 같은 무늬(s)와 다른 무늬(o)를 따로 셉니다.',
  BROADWAY: 'A 없이 10 이상 두 장, 또는 숫자가 이어지는 같은 무늬 두 장.',
};

/** Which group a class belongs to: pairs, ace-highs, and everything else. */
export function handFamilyOf(handClass: HandClass): HandFamily {
  if (handClass.kind === 'PAIR') return 'PAIR';
  if (handClass.highRank === 'A') return 'ACE';
  return 'BROADWAY';
}

export interface HandHubRow {
  readonly record: HandRecord;
  /** `undefined` only for a record whose key is not one of the 169 (a test fixture). */
  readonly handClass: HandClass | undefined;
  readonly strength: HandStrengthEntry | undefined;
}

export interface HandHubGroup {
  readonly family: HandFamily;
  readonly label: string;
  readonly description: string;
  readonly rows: readonly HandHubRow[];
}

function rankOfRow(row: HandHubRow): number {
  return row.strength?.rank ?? Number.POSITIVE_INFINITY;
}

/**
 * The hub's grouped, strength-ordered rows. A record whose key resolves to no class (the
 * hub test's PLANNED fixture) falls into the last group, last, rather than throwing.
 * Groups with no rows are omitted.
 */
export function handHubGroups(records: readonly HandRecord[]): readonly HandHubGroup[] {
  const rows: HandHubRow[] = records.map((record) => {
    const handClass = handClassByKey(record.handKey);
    return {
      record,
      handClass,
      strength: handClass === undefined ? undefined : handStrengthOf(handClass),
    };
  });
  return HAND_FAMILY_ORDER.flatMap((family) => {
    const members = rows
      .filter((row) =>
        row.handClass === undefined
          ? family === 'BROADWAY'
          : handFamilyOf(row.handClass) === family,
      )
      .sort((a, b) => rankOfRow(a) - rankOfRow(b));
    if (members.length === 0) return [];
    return [
      {
        family,
        label: HAND_FAMILY_LABEL[family],
        description: HAND_FAMILY_DESCRIPTION[family],
        rows: members,
      },
    ];
  });
}
