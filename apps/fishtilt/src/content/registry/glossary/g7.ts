/**
 * Glossary batch G7 — 카드·족보 · 승부 판정 (3 terms). Category `hand-rankings` in
 * `categories.ts`, which is the source of truth for membership; this file only groups the
 * records so one content agent can own it (WP-S3-11 split of the former j1/j2 batches).
 *
 * Every record's `id`, `slug`, `aliases`, `shortDefinition` and relations moved here
 * verbatim. `batches.test.ts` gates this file: threshold, readMinutes, MDX map wiring,
 * `<Term>` and `<PokerCards>` validity, no strategy claims.
 */
import type { GlossaryRecord } from '../../types.js';

export const GLOSSARY_G7_RECORDS: readonly GlossaryRecord[] = [
  {
    kind: 'glossary',
    id: 'term-kicker',
    slug: 'kicker',
    term: 'Kicker',
    aliases: ['키커', '킥커', '옆 카드'],
    title: '키커 (Kicker) — 순위를 가르는 옆 카드',
    shortDefinition: '같은 순위끼리 비교할 때, 승부를 가르는 데 쓰이는 나머지 카드를 말합니다.',
    description: '키커가 언제 승부를 가르는지 실제 예로 보여줍니다.',
    level: 'INTRO',
    topic: 'hand-strength',
    concepts: ['kicker'],
    prerequisites: [],
    relatedConcepts: ['term-hand-ranking'],
    relatedTools: ['toolHandChecker'],
    relatedHands: [],
    nextLessons: ['hand-rankings'],
    relatedArticles: ['blog-what-is-kicker'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-split-pot',
    slug: 'split-pot',
    term: 'Split Pot',
    aliases: ['스플릿', '스플릿 팟', '찹', 'chop', '팟 분배'],
    title: '스플릿 팟 (Split Pot) — 팟을 나눠 갖는 것',
    shortDefinition: '두 명 이상이 정확히 같은 순위의 패를 만들어 팟을 나눠 갖는 것을 말합니다.',
    description: '스플릿 팟이 언제 일어나는지 설명합니다.',
    level: 'INTRO',
    topic: 'hand-strength',
    concepts: ['split-pot'],
    prerequisites: [],
    relatedConcepts: ['term-hand-ranking'],
    relatedTools: ['toolHandChecker'],
    relatedHands: [],
    nextLessons: ['hand-rankings'],
    relatedArticles: ['blog-playing-the-board'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-nuts',
    slug: 'nuts',
    term: 'Nuts',
    aliases: ['넛', '넛츠', '너츠', '최강패'],
    title: '넛 (Nuts) — 그 보드에서 나올 수 있는 가장 강한 패',
    shortDefinition: '그 보드에서 만들 수 있는 가장 강한 패를 말합니다.',
    description: '넛츠가 무엇을 가리키는 말인지, 보드마다 달라진다는 것을 설명합니다.',
    level: 'INTRO',
    topic: 'hand-strength',
    concepts: ['nuts'],
    prerequisites: [],
    relatedConcepts: ['term-hand-ranking'],
    relatedTools: ['toolHandChecker'],
    relatedHands: [],
    nextLessons: ['hand-rankings'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
];
