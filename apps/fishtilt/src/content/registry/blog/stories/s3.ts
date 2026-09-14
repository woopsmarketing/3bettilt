/**
 * Hand-story batch S3 (WP-S3-08). One writable file per story agent, the same split the
 * I1-I4 / H1-H3 batches use: add your `HandStoryRecord`s here and your `.mdx` map entries
 * in `src/content/blog/s3.ts`, and touch nothing else. `stories.test.ts` runs every record
 * in this array through `stories/validate.ts` and checks the MDX shape against the record.
 *
 * A record here IS a blog record (`contentType: 'hand-story'`): it appears on the hub, in
 * the sitemap and in search through `BLOG_RECORDS` with no second registration.
 *
 * The two S3 stories (`s3.test.ts` pins the premise of each against the evaluator):
 *
 * - `aa-loses` — hero opens A♠A♣ from the hijack, the button calls with 8♦7♦, flops an
 *   open-ended straight draw on T-9-3 and turns the straight with the 6♠; the stacks go in
 *   on the river. Hero PAIR vs villain STRAIGHT → villain. Hero's exact equity is 0 from the
 *   turn on (pinned), so the "best starting hand" was ahead for exactly two streets.
 * - `ak-flop-miss` — hero opens A♥K♥ from the cutoff, the button calls with Q♣J♣, and the
 *   9-6-2 flop misses BOTH hands; checked through the turn, a small river bet is called.
 *   Hero HIGH_CARD vs villain HIGH_CARD → hero (ace-high beats queen-high). Hero never makes
 *   a pair (pinned) — the story is about what "missing the flop" leaves AK with.
 *
 * Every equity / outs / pot-odds figure the two MDX files cite comes from `<Fact>` and its
 * args mirror the record (`EXACT_EQUITY` takes the exact cards, `POT_ODDS_REQUIRED_EQUITY`
 * takes the street's pot as `resolve.ts` sums it). The prose restates cards, never a pot.
 * `readMinutes` is `estimateReadMinutes` of the measured MDX (`content.test.ts`).
 */
import { bb, HAND_STORY_DISCLOSURE } from '../../../stories/types.js';
import type { HandStoryRecord } from '../../../types.js';

export const HAND_STORY_S3_RECORDS: readonly HandStoryRecord[] = [
  {
    kind: 'blog',
    id: 'blog-aa-loses',
    slug: 'aa-loses',
    contentType: 'hand-story',
    title: '포켓 에이스를 들고 스택을 다 잃었다',
    seoTitle: '포켓 에이스로 스택을 다 잃은 판 | AA vs 87s 핸드 리뷰',
    description:
      '하이잭에서 AA로 오픈, 버튼이 콜. 플랍 T-9-3에 턴 6. 리버에서 올인을 콜하고 뒤집힌 패는 8♦7♦였다. 최고의 시작 핸드가 스트리트마다 어디까지 최고였는지 숫자로 다시 본다.',
    level: 'BASIC',
    topic: 'hand-strength',
    concepts: ['pocket-pair', 'overpair', 'straight', 'outs', 'equity'],
    prerequisites: [],
    relatedConcepts: [
      'term-pocket-pair',
      'term-straight',
      'term-outs',
      'term-equity',
      'term-suited',
      'term-pot-odds',
    ],
    relatedTools: ['toolEquity', 'toolHandChecker', 'toolPotOdds'],
    relatedHands: ['hand-aa'],
    nextLessons: ['equity', 'outs'],
    relatedArticles: [
      'blog-ak-flop-miss',
      'blog-how-often-aa',
      'blog-next-best-after-aa',
      'blog-why-suited-matters',
    ],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 7,
    hand: {
      stakes: '온라인 6인 캐시 게임',
      gameType: 'NLHE',
      tableSize: 6,
      effectiveStack: bb(100),
      heroPosition: 'HJ',
      villainPosition: 'BTN',
      heroHand: 'As Ac',
      preflopActions: [
        { position: 'UTG', kind: 'FOLD' },
        { position: 'HJ', kind: 'RAISE', amount: bb(2.5), note: '오픈' },
        { position: 'CO', kind: 'FOLD' },
        { position: 'BTN', kind: 'CALL' },
        { position: 'SB', kind: 'FOLD' },
        { position: 'BB', kind: 'FOLD' },
      ],
      flop: 'Ts 9c 3h',
      flopActions: [
        { position: 'HJ', kind: 'BET', amount: bb(4), note: '컨티뉴에이션 벳' },
        { position: 'BTN', kind: 'CALL' },
      ],
      turn: '6s',
      turnActions: [
        { position: 'HJ', kind: 'BET', amount: bb(10) },
        { position: 'BTN', kind: 'RAISE', amount: bb(30) },
        { position: 'HJ', kind: 'CALL' },
      ],
      river: '2c',
      riverActions: [
        { position: 'HJ', kind: 'CHECK' },
        { position: 'BTN', kind: 'ALL_IN', amount: bb(63.5), note: '남은 스택 전부' },
        { position: 'HJ', kind: 'CALL' },
      ],
      showdown: { villainHand: '8d 7d', winner: 'villain' },
      disclosure: HAND_STORY_DISCLOSURE,
    },
  },
  {
    kind: 'blog',
    id: 'blog-ak-flop-miss',
    slug: 'ak-flop-miss',
    contentType: 'hand-story',
    title: 'AK로 플랍을 완전히 놓쳤다. 그런데 내가 이겼다',
    seoTitle: 'AK로 플랍을 놓치고도 이긴 판 | AKs vs QJs 핸드 리뷰',
    description:
      '컷오프에서 A♥K♥로 오픈, 버튼이 콜. 플랍 9-6-2, 턴 4, 리버 7. 페어 하나 없이 쇼다운까지 갔는데 상대 패는 Q♣J♣였다. AK가 플랍을 "놓쳤다"는 말이 정확히 무슨 뜻인지 숫자로 본다.',
    level: 'BASIC',
    topic: 'hand-strength',
    concepts: ['high-card', 'outs', 'equity', 'pot-odds', 'showdown'],
    prerequisites: [],
    relatedConcepts: [
      'term-high-card',
      'term-outs',
      'term-equity',
      'term-pot-odds',
      'term-showdown',
    ],
    relatedTools: ['toolEquity', 'toolHandChecker', 'toolPotOdds'],
    relatedHands: ['hand-aks', 'hand-ako'],
    nextLessons: ['outs', 'equity'],
    relatedArticles: ['blog-aa-loses', 'blog-is-ak-good', 'blog-aks-vs-ako', 'blog-qq-vs-ak'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
    hand: {
      stakes: '온라인 6인 캐시 게임',
      gameType: 'NLHE',
      tableSize: 6,
      effectiveStack: bb(100),
      heroPosition: 'CO',
      villainPosition: 'BTN',
      heroHand: 'Ah Kh',
      preflopActions: [
        { position: 'UTG', kind: 'FOLD' },
        { position: 'HJ', kind: 'FOLD' },
        { position: 'CO', kind: 'RAISE', amount: bb(2.5), note: '오픈' },
        { position: 'BTN', kind: 'CALL' },
        { position: 'SB', kind: 'FOLD' },
        { position: 'BB', kind: 'FOLD' },
      ],
      flop: '9s 6d 2c',
      flopActions: [
        { position: 'CO', kind: 'BET', amount: bb(3), note: '컨티뉴에이션 벳' },
        { position: 'BTN', kind: 'CALL' },
      ],
      turn: '4h',
      turnActions: [
        { position: 'CO', kind: 'CHECK' },
        { position: 'BTN', kind: 'CHECK' },
      ],
      river: '7d',
      riverActions: [
        { position: 'CO', kind: 'CHECK' },
        { position: 'BTN', kind: 'BET', amount: bb(4) },
        { position: 'CO', kind: 'CALL' },
      ],
      showdown: { villainHand: 'Qc Jc', winner: 'hero' },
      disclosure: HAND_STORY_DISCLOSURE,
    },
  },
];
