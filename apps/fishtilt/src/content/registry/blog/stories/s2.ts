/**
 * Hand-story batch S2 (WP-S3-08). One writable file per story agent, the same split the
 * I1-I4 / H1-H3 batches use: add your `HandStoryRecord`s here and your `.mdx` map entries
 * in `src/content/blog/s2.ts`, and touch nothing else. `stories.test.ts` runs every record
 * in this array through `stories/validate.ts` and checks the MDX shape against the record.
 *
 * A record here IS a blog record (`contentType: 'hand-story'`): it appears on the hub, in
 * the sitemap and in search through `BLOG_RECORDS` with no second registration.
 *
 * The two S2 stories (`s2.test.ts` pins the premise of each against the evaluator):
 *
 * - `qq-three-bet-frustration` — hero 3-bets QQ from the big blind, the button calls with
 *   A♦4♦, flops bottom pair on 9-4-2, turns two pair with the A♥ and wins the showdown.
 *   Hero PAIR vs villain TWO_PAIR → villain.
 * - `river-changes-everything` — hero opens J♥T♥ on the button, the big blind check-raises
 *   a K♥7♥2♦ flop with K♣7♣ (two pair) and bets every street; the 5♥ river makes hero's
 *   flush. Hero FLUSH vs villain TWO_PAIR → hero.
 *
 * Every equity / outs / pot-odds figure the two MDX files cite comes from `<Fact>` and its
 * args mirror the record (`EXACT_EQUITY` takes the exact cards, `POT_ODDS_REQUIRED_EQUITY`
 * takes the street's pot as `resolve.ts` sums it). The prose restates cards, never a pot.
 * `readMinutes` is `estimateReadMinutes` of the measured MDX (`content.test.ts`).
 */
import { bb, HAND_STORY_DISCLOSURE } from '../../../stories/types.js';
import type { HandStoryRecord } from '../../../types.js';

export const HAND_STORY_S2_RECORDS: readonly HandStoryRecord[] = [
  {
    kind: 'blog',
    id: 'blog-qq-three-bet-frustration',
    slug: 'qq-three-bet-frustration',
    contentType: 'hand-story',
    title: 'QQ를 들고 3벳했는데, 상대 패를 보고 더 화가 났다',
    seoTitle: 'QQ로 3벳했는데 턴에 A가 떨어졌다 | QQ vs A4s 핸드 리뷰',
    description:
      '빅 블라인드에서 QQ로 3벳, 버튼이 콜. 플랍 9-4-2에 턴 A. 리버까지 콜한 뒤 상대가 뒤집은 패는 A4s였다. 승률이 스트리트마다 어떻게 움직였는지 숫자로 다시 본다.',
    level: 'BASIC',
    topic: 'equity',
    concepts: ['three-bet', 'overpair', 'two-pair', 'equity', 'pot-odds'],
    prerequisites: [],
    relatedConcepts: ['term-three-bet', 'term-two-pair', 'term-equity', 'term-pot-odds'],
    relatedTools: ['toolHandChecker', 'toolEquity', 'toolPotOdds'],
    relatedHands: ['hand-qq'],
    nextLessons: ['equity', 'three-bet'],
    relatedArticles: ['blog-river-changes-everything', 'blog-qq-vs-ak', 'blog-why-called-3bet'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
    hand: {
      stakes: '온라인 6인 캐시 게임',
      gameType: 'NLHE',
      tableSize: 6,
      effectiveStack: bb(100),
      heroPosition: 'BB',
      villainPosition: 'BTN',
      heroHand: 'Qs Qh',
      preflopActions: [
        { position: 'UTG', kind: 'FOLD' },
        { position: 'HJ', kind: 'FOLD' },
        { position: 'CO', kind: 'FOLD' },
        { position: 'BTN', kind: 'RAISE', amount: bb(2.5), note: '오픈' },
        { position: 'SB', kind: 'FOLD' },
        { position: 'BB', kind: 'RAISE', amount: bb(11), note: '3벳' },
        { position: 'BTN', kind: 'CALL' },
      ],
      flop: '9d 4c 2s',
      flopActions: [
        { position: 'BB', kind: 'BET', amount: bb(8), note: '컨티뉴에이션 벳' },
        { position: 'BTN', kind: 'CALL' },
      ],
      turn: 'Ah',
      turnActions: [
        { position: 'BB', kind: 'CHECK' },
        { position: 'BTN', kind: 'BET', amount: bb(20) },
        { position: 'BB', kind: 'CALL' },
      ],
      river: '7c',
      riverActions: [
        { position: 'BB', kind: 'CHECK' },
        { position: 'BTN', kind: 'BET', amount: bb(30) },
        { position: 'BB', kind: 'CALL' },
      ],
      showdown: { villainHand: 'Ad 4d', winner: 'villain' },
      disclosure: HAND_STORY_DISCLOSURE,
    },
  },
  {
    kind: 'blog',
    id: 'blog-river-changes-everything',
    slug: 'river-changes-everything',
    contentType: 'hand-story',
    title: '리버 한 장 때문에 모든 게 바뀌었다',
    seoTitle: '리버 한 장에 뒤집힌 판 | JTs vs K7s 핸드 리뷰',
    description:
      '버튼에서 J♥T♥로 오픈, 플랍 K♥7♥2♦에서 플러시 드로우. 상대는 체크-레이즈에 턴, 리버까지 벳. 5♥ 리버가 떨어지기 전까지 나는 한 번도 앞선 적이 없었다.',
    level: 'BASIC',
    topic: 'odds',
    concepts: ['flush-draw', 'outs', 'pot-odds', 'equity', 'two-pair'],
    prerequisites: [],
    relatedConcepts: ['term-outs', 'term-draw', 'term-flush', 'term-pot-odds', 'term-equity'],
    relatedTools: ['toolOuts', 'toolPotOdds', 'toolEquity'],
    relatedHands: ['hand-jts'],
    nextLessons: ['outs', 'pot-odds'],
    relatedArticles: ['blog-qq-three-bet-frustration', 'blog-outs-nine', 'blog-pot-odds-quick'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 4,
    hand: {
      stakes: '온라인 6인 캐시 게임',
      gameType: 'NLHE',
      tableSize: 6,
      effectiveStack: bb(100),
      heroPosition: 'BTN',
      villainPosition: 'BB',
      heroHand: 'Jh Th',
      preflopActions: [
        { position: 'UTG', kind: 'FOLD' },
        { position: 'HJ', kind: 'FOLD' },
        { position: 'CO', kind: 'FOLD' },
        { position: 'BTN', kind: 'RAISE', amount: bb(2.5), note: '오픈' },
        { position: 'SB', kind: 'FOLD' },
        { position: 'BB', kind: 'CALL' },
      ],
      flop: 'Kh 7h 2d',
      flopActions: [
        { position: 'BB', kind: 'CHECK' },
        { position: 'BTN', kind: 'BET', amount: bb(3), note: '컨티뉴에이션 벳' },
        { position: 'BB', kind: 'RAISE', amount: bb(10), note: '체크-레이즈' },
        { position: 'BTN', kind: 'CALL' },
      ],
      turn: '4c',
      turnActions: [
        { position: 'BB', kind: 'BET', amount: bb(15) },
        { position: 'BTN', kind: 'CALL' },
      ],
      river: '5h',
      riverActions: [
        { position: 'BB', kind: 'BET', amount: bb(30) },
        { position: 'BTN', kind: 'ALL_IN', amount: bb(72.5), note: '남은 스택 전부' },
        { position: 'BB', kind: 'CALL' },
      ],
      showdown: { villainHand: 'Kc 7c', winner: 'hero' },
      disclosure: HAND_STORY_DISCLOSURE,
    },
  },
];
