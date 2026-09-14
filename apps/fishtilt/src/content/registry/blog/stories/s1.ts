/**
 * Hand-story batch S1 (WP-S3-08). One writable file per story agent, the same split the
 * I1-I4 / H1-H3 batches use: add your `HandStoryRecord`s here and your `.mdx` map entries
 * in `src/content/blog/s1.ts`, and touch nothing else. `stories.test.ts` runs every record
 * in this array through `stories/validate.ts` and checks the MDX shape against the record.
 *
 * A record here IS a blog record (`contentType: 'hand-story'`): it appears on the hub, in
 * the sitemap and in search through `BLOG_RECORDS` with no second registration.
 *
 * Both stories are reconstructed scenarios (the record carries `HAND_STORY_DISCLOSURE`, the
 * template always prints it). The `winner` on each showdown is the author's claim; the
 * validator checks it against `strategy-core`'s evaluator, and `s1.test.ts` pins the
 * categories the evaluator produces so the prose can rely on them:
 *
 * - `blog-qq-vs-72o-flop-227`: hero 3-bets QQ on the button, the cutoff calls with 7-2
 *   offsuit, the flop is 2-2-7. Hero's two pair (Q-Q-2-2) loses to the villain's full house
 *   (2-2-2-7-7).
 * - `blog-full-house-loses`: hero opens 9-9 on the button, the big blind calls with T-9
 *   offsuit, the flop is T-T-9. Both make a full house from the same five ranks — hero
 *   nines full of tens, villain tens full of nines — and the villain's wins.
 *
 * `readMinutes` is `estimateReadMinutes` of the measured MDX prose (`content.test.ts`
 * asserts it), not a guess.
 */
import { bb, HAND_STORY_DISCLOSURE } from '../../../stories/types.js';
import type { HandStoryRecord } from '../../../types.js';

export const HAND_STORY_S1_RECORDS: readonly HandStoryRecord[] = [
  {
    kind: 'blog',
    id: 'blog-qq-vs-72o-flop-227',
    slug: 'qq-vs-72o-flop-227',
    contentType: 'hand-story',
    title: '72o로 3벳을 콜한다고? 그런데 플랍이 2-2-7이었다',
    seoTitle: '3벳에 72o가 콜했고 플랍은 2-2-7이었다 | QQ vs 72o 핸드 리뷰',
    description:
      '버튼에서 QQ로 3벳을 했더니 컷오프가 콜. 플랍은 2-2-7. 오버페어로 세 스트리트를 달렸는데, 쇼다운에서 상대가 뒤집은 카드는 7과 2였다.',
    level: 'BASIC',
    topic: 'hand-strength',
    concepts: ['full-house', 'three-bet', 'overpair', 'cooler'],
    prerequisites: [],
    relatedConcepts: [
      'term-three-bet',
      'term-full-house',
      'term-two-pair',
      'term-offsuit',
      'term-equity',
    ],
    relatedTools: ['toolEquity', 'toolHandChecker', 'toolPotOdds'],
    relatedHands: ['hand-qq'],
    nextLessons: ['hand-rankings', 'three-bet'],
    relatedArticles: [
      'blog-full-house-loses',
      'blog-why-72o-is-weak',
      'blog-why-called-3bet',
      'blog-qq-vs-ak',
    ],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
    hand: {
      stakes: '온라인 6인 캐시 게임',
      gameType: 'NLHE',
      tableSize: 6,
      effectiveStack: bb(100),
      heroPosition: 'BTN',
      villainPosition: 'CO',
      heroHand: 'Qs Qh',
      preflopActions: [
        { position: 'UTG', kind: 'FOLD' },
        { position: 'HJ', kind: 'FOLD' },
        { position: 'CO', kind: 'RAISE', amount: bb(2.5), note: '오픈' },
        { position: 'BTN', kind: 'RAISE', amount: bb(8), note: '3벳' },
        { position: 'SB', kind: 'FOLD' },
        { position: 'BB', kind: 'FOLD' },
        { position: 'CO', kind: 'CALL' },
      ],
      flop: '2s 2h 7d',
      flopActions: [
        { position: 'CO', kind: 'CHECK' },
        { position: 'BTN', kind: 'BET', amount: bb(6), note: '컨티뉴에이션 벳' },
        { position: 'CO', kind: 'CALL' },
      ],
      turn: 'Kc',
      turnActions: [
        { position: 'CO', kind: 'CHECK' },
        { position: 'BTN', kind: 'BET', amount: bb(18) },
        { position: 'CO', kind: 'CALL' },
      ],
      river: '4s',
      riverActions: [
        { position: 'CO', kind: 'BET', amount: bb(40), note: '리드 벳' },
        { position: 'BTN', kind: 'CALL' },
      ],
      showdown: { villainHand: '7c 2d', winner: 'villain' },
      disclosure: HAND_STORY_DISCLOSURE,
    },
  },
  {
    kind: 'blog',
    id: 'blog-full-house-loses',
    slug: 'full-house-loses',
    contentType: 'hand-story',
    title: '풀하우스를 만들었는데 내가 진다고?',
    seoTitle: '풀하우스를 만들고도 진 판 | 99 vs T9o, 플랍 TT9 핸드 리뷰',
    description:
      '버튼에서 99로 오픈, 빅 블라인드가 콜. 플랍 T-T-9으로 풀하우스가 떴는데 상대도 풀하우스였다. 같은 다섯 장의 숫자로 만든 두 풀하우스 중 왜 내 것이 작았는지 따라가 본다.',
    level: 'BASIC',
    topic: 'hand-strength',
    concepts: ['full-house', 'pocket-pair', 'cooler', 'hand-ranking'],
    prerequisites: [],
    relatedConcepts: ['term-full-house', 'term-pocket-pair', 'term-hand-ranking', 'term-equity'],
    relatedTools: ['toolHandChecker', 'toolEquity', 'toolPotOdds'],
    relatedHands: ['hand-99', 'hand-tt'],
    nextLessons: ['hand-rankings', 'equity'],
    relatedArticles: ['blog-qq-vs-72o-flop-227', 'blog-full-house-vs-flush', 'blog-what-is-kicker'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
    hand: {
      stakes: '온라인 6인 캐시 게임',
      gameType: 'NLHE',
      tableSize: 6,
      effectiveStack: bb(100),
      heroPosition: 'BTN',
      villainPosition: 'BB',
      heroHand: '9h 9c',
      preflopActions: [
        { position: 'UTG', kind: 'FOLD' },
        { position: 'HJ', kind: 'FOLD' },
        { position: 'CO', kind: 'FOLD' },
        { position: 'BTN', kind: 'RAISE', amount: bb(2.5), note: '오픈' },
        { position: 'SB', kind: 'FOLD' },
        { position: 'BB', kind: 'CALL' },
      ],
      flop: 'Ts Th 9d',
      flopActions: [
        { position: 'BB', kind: 'CHECK' },
        { position: 'BTN', kind: 'BET', amount: bb(3) },
        { position: 'BB', kind: 'RAISE', amount: bb(10), note: '체크 레이즈' },
        { position: 'BTN', kind: 'CALL' },
      ],
      turn: '3c',
      turnActions: [
        { position: 'BB', kind: 'BET', amount: bb(15) },
        { position: 'BTN', kind: 'RAISE', amount: bb(45) },
        { position: 'BB', kind: 'CALL' },
      ],
      river: '6h',
      riverActions: [
        { position: 'BB', kind: 'ALL_IN', amount: bb(42.5), note: '남은 칩 전부' },
        { position: 'BTN', kind: 'CALL' },
      ],
      showdown: { villainHand: 'Td 9s', winner: 'villain' },
      disclosure: HAND_STORY_DISCLOSURE,
    },
  },
];
