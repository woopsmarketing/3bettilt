/**
 * Learn batch H1 — lessons 01-05 (foundations), `docs/FISHTILT_CONTENT_PLAN.md` §7 "H1".
 *
 * Split out of the single `registry/learn.ts` (WP-G2) so H1 owns exactly one writable file
 * and can author in parallel with H2 and H3. See `registry/learn/index.ts` for how the
 * batches recombine into `LEARN_RECORDS`.
 *
 * ## The slug rename (`docs/FISHTILT_STATE.md` ruling 11)
 *
 * Lesson 02's `slug` is `poker-hand-rankings`, not `hand-rankings` — the build spec names
 * this route twice and nothing is shipped at either URL, so the rename is free. The `id`
 * stays `hand-rankings`: relations (`nextLessons`, `prerequisites`, `relatedArticles` …) are
 * all by id, never by slug, so this rename moves no other record and needs no redirect.
 */
import type { LearnRecord } from '../../types.js';

export const LEARN_H1_RECORDS: readonly LearnRecord[] = [
  {
    kind: 'learn',
    id: 'holdem-basics',
    slug: 'holdem-basics',
    order: 1,
    title: '텍사스 홀덤 하는 법 — 규칙과 한 판의 흐름',
    description:
      '카드를 받고, 돈을 걸고, 승자를 가리기까지. 한 판의 흐름을 처음부터 끝까지 따라갑니다.',
    level: 'INTRO',
    topic: 'rules',
    concepts: ['rules', 'betting-round', 'showdown'],
    prerequisites: [],
    relatedConcepts: [
      'term-blind',
      'term-big-blind',
      'term-button',
      'term-pot',
      'term-stack',
      'term-community-cards',
      'term-showdown',
    ],
    relatedTools: ['toolHandChecker'],
    relatedHands: [],
    nextLessons: ['hand-rankings'],
    relatedArticles: ['blog-why-blinds-exist', 'blog-playing-the-board'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
  },
  {
    kind: 'learn',
    id: 'hand-rankings',
    // Ruling 11: the URL is `/learn/poker-hand-rankings`. The id is unchanged.
    slug: 'poker-hand-rankings',
    order: 2,
    title: '포커 족보 순서 — 어떤 족보가 더 강할까요?',
    description:
      '원페어부터 스트레이트 플러시까지, 다섯 장으로 만드는 패의 순서를 그림으로 정리합니다.',
    level: 'INTRO',
    topic: 'hand-strength',
    concepts: ['hand-ranking', 'showdown'],
    prerequisites: ['holdem-basics'],
    relatedConcepts: [
      'term-hand-ranking',
      'term-kicker',
      'term-split-pot',
      'term-high-card',
      'term-one-pair',
      'term-two-pair',
      'term-three-of-a-kind',
      'term-straight',
      'term-flush',
      'term-full-house',
      'term-four-of-a-kind',
      'term-straight-flush',
    ],
    relatedTools: ['toolHandChecker', 'practiceHandRanking'],
    relatedHands: [],
    nextLessons: ['starting-hands'],
    relatedArticles: [
      'blog-flush-vs-straight',
      'blog-full-house-vs-flush',
      'blog-what-is-kicker',
      'blog-a2345-wheel',
    ],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
  },
  {
    kind: 'learn',
    id: 'starting-hands',
    slug: 'starting-hands',
    order: 3,
    title: '홀덤 시작 핸드 보는 법 — 수티드·커넥터·포켓 페어',
    description:
      '같은 무늬인지, 숫자가 붙어 있는지, 같은 숫자인지. 시작 패를 보는 세 가지 기준을 설명합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['starting-hand', 'suited', 'offsuit', 'pocket-pair'],
    prerequisites: ['hand-rankings'],
    relatedConcepts: [
      'term-hand',
      'term-suited',
      'term-offsuit',
      'term-pocket-pair',
      'term-combo',
      // WP-S3-16: 커넥터 and 브로드웨이 are introduced by name in their own sections.
      'term-connector',
      'term-broadway',
    ],
    relatedTools: ['toolStartingHand', 'range'],
    relatedHands: ['hand-aks', 'hand-ako', 'hand-88', 'hand-t9s'],
    nextLessons: ['starting-hand-ranking'],
    relatedArticles: ['blog-aks-vs-ako', 'blog-small-pocket-pairs', 'blog-why-suited-matters'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
  },
  {
    kind: 'learn',
    id: 'starting-hand-ranking',
    slug: 'starting-hand-ranking',
    order: 4,
    title: '시작 패는 어떤 순서로 강할까요?',
    description:
      '169가지 시작 패를 강한 순서로 늘어놓으면 어떤 모습인지, 그리고 그 순서가 무엇을 뜻하는지 봅니다.',
    level: 'BASIC',
    topic: 'starting-hands',
    concepts: ['starting-hand', 'hand-strength'],
    prerequisites: ['starting-hands'],
    relatedConcepts: ['term-combo', 'term-equity', 'term-hand-matrix'],
    relatedTools: ['toolStartingHand', 'practiceStartingHand'],
    relatedHands: [
      'hand-aks',
      'hand-aa',
      'hand-kk',
      'hand-qq',
      'hand-jj',
      'hand-tt',
      'hand-99',
      'hand-88',
      'hand-77',
      'hand-22',
    ],
    nextLessons: ['hand-matrix'],
    relatedArticles: ['blog-next-best-after-aa', 'blog-is-ak-good', 'blog-why-72o-is-weak'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
  },
  {
    kind: 'learn',
    id: 'hand-matrix',
    slug: 'hand-matrix',
    order: 5,
    title: '13×13 표는 어떻게 읽나요?',
    description:
      '포커 자료에 자주 나오는 정사각형 표. 대각선, 위쪽, 아래쪽이 각각 무엇을 뜻하는지 짚어봅니다.',
    level: 'BASIC',
    topic: 'range',
    concepts: ['hand-matrix', 'suited', 'offsuit', 'pocket-pair'],
    prerequisites: ['starting-hands'],
    relatedConcepts: [
      'term-suited',
      'term-offsuit',
      'term-pocket-pair',
      'term-combo',
      'term-hand-matrix',
    ],
    relatedTools: ['range', 'toolStartingHand'],
    relatedHands: [
      'hand-aks',
      'hand-ako',
      'hand-aqs',
      'hand-aqo',
      'hand-ajs',
      'hand-kk',
      'hand-kqs',
      'hand-kjs',
      'hand-qjs',
      'hand-jts',
      'hand-t9s',
      'hand-a5s',
    ],
    nextLessons: ['poker-range'],
    relatedArticles: ['blog-aks-vs-ako', 'blog-how-often-aa', 'blog-why-suited-matters'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
  },
];
