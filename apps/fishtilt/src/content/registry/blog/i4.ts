/**
 * Blog batch I4 — 규칙 · 용어 · 계산, five answers about rules, terms and calculation
 * (`docs/FISHTILT_CONTENT_PLAN.md` §7 "I4", §2.2).
 *
 * `blog-outs-nine` already existed (WP-G's seed) and is I4's item #20 — reuse its id, slug
 * (§2.1). I4's other four items (`blog-why-blinds-exist`, `blog-why-called-3bet`,
 * `blog-why-use-range`, `blog-pot-odds-quick`) were registered by WP-G4 and written by WP-I4.
 *
 * WP-S3-07 (Stage 3 blog migration, `docs/reports/stage3/3BETTILT_CONTENT_AUDIT.md` §2
 * B16–B20) rewrote all five as search-intent-complete guides and set the Stage 3 fields:
 * `title` is the H1 (may be curious), `seoTitle` states the search query, `description` is
 * the deck, `contentType` follows the audit (B17/B18 moved to `concept-culture`), and
 * `readMinutes` is measured by `i4.test.ts` against the prose. Relations point at records
 * that exist today; `i4.test.ts` resolves every id against the full graph.
 */
import type { BlogRecord } from '../../types.js';

export const BLOG_I4_RECORDS: readonly BlogRecord[] = [
  {
    kind: 'blog',
    id: 'blog-outs-nine',
    slug: 'outs-nine',
    contentType: 'data-probability',
    title: '아웃츠 9장 = 플러시 드로우: 완성 확률과 콜에 쓸 수 있는지까지',
    seoTitle: '아웃츠 9장 뜻 — 플러시 드로우 완성 확률과 팟오즈 비교',
    description:
      '플러시 드로우의 아웃츠가 왜 9장인지 세는 과정부터, 플랍에서 리버까지의 정확한 확률, ×4 규칙의 오차, 그리고 그 숫자를 팟오즈와 나란히 놓는 방법까지 한 번에 답합니다.',
    level: 'BASIC',
    topic: 'odds',
    concepts: ['outs', 'draw', 'probability', 'pot-odds'],
    prerequisites: [],
    relatedConcepts: ['term-outs', 'term-draw', 'term-flush', 'term-big-blind'],
    relatedTools: ['toolOuts', 'toolPotOdds', 'toolEquity'],
    relatedHands: [],
    nextLessons: ['outs', 'pot-odds'],
    relatedArticles: ['blog-pot-odds-quick', 'blog-river-changes-everything'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
  },
  {
    kind: 'blog',
    id: 'blog-why-blinds-exist',
    slug: 'why-blinds-exist',
    contentType: 'concept-culture',
    title: '블라인드는 왜 있을까? 강제 베팅이 판을 움직이는 이유',
    seoTitle: '빅 블라인드는 왜 먼저 돈을 내나? 블라인드가 있는 이유',
    description:
      '아무도 걸지 않으면 아무도 참여할 이유가 없다는 것을, 블라인드가 걸리는 순서와 앤티와의 차이, 빅 블라인드 자리만의 특수한 점까지 짚어 가며 설명합니다.',
    level: 'INTRO',
    topic: 'rules',
    concepts: ['blind', 'rules', 'ante'],
    prerequisites: [],
    relatedConcepts: [
      'term-blind',
      'term-big-blind',
      'term-small-blind',
      'term-ante',
      'term-button',
    ],
    relatedTools: ['range'],
    relatedHands: [],
    nextLessons: ['holdem-basics', 'positions-6max'],
    relatedArticles: ['blog-why-called-3bet'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
  },
  {
    kind: 'blog',
    id: 'blog-why-called-3bet',
    slug: 'why-called-3bet',
    contentType: 'concept-culture',
    title: "3벳(3-Bet)은 왜 '3'일까? 벳을 세는 규칙과 4벳·5벳",
    seoTitle: '3벳(쓰리벳, 3-Bet)은 왜 3일까? 벳을 세는 규칙과 여러 표기',
    description:
      '두 번째 레이즈를 왜 3벳이라 부르는지, 빅 블라인드부터 세는 규칙과 4벳·5벳으로 이어지는 이름, 3벳·쓰리벳·3bet·three-bet이 전부 같은 말인 이유를 설명합니다.',
    level: 'BASIC',
    topic: 'betting',
    concepts: ['three-bet', 'bet-counting', 'four-bet'],
    prerequisites: [],
    relatedConcepts: ['term-three-bet', 'term-four-bet', 'term-open-raise', 'term-big-blind'],
    relatedTools: ['range'],
    relatedHands: [],
    nextLessons: ['three-bet', 'poker-actions'],
    relatedArticles: [
      'blog-qq-three-bet-frustration',
      'blog-qq-vs-72o-flop-227',
      'blog-why-blinds-exist',
    ],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
  },
  {
    kind: 'blog',
    id: 'blog-why-use-range',
    slug: 'why-use-range',
    contentType: 'search-guide',
    title: '상대 패를 하나로 찍으면 왜 틀릴까? 레인지로 보는 이유와 읽는 법',
    seoTitle: '레인지로 보는 이유 — 상대 패를 하나로 찍으면 틀리는 것',
    description:
      '상대 패를 하나로 찍었을 때 무엇이 틀리는지, 13×13 표를 어떻게 읽는지, 자리마다 레인지 폭이 얼마나 다른지, 그리고 이 사이트의 표가 정답이 아니라 학습용 기준인 이유까지 설명합니다.',
    level: 'BASIC',
    topic: 'range',
    concepts: ['range', 'hand-matrix', 'position'],
    prerequisites: [],
    relatedConcepts: [
      'term-range',
      'term-utg',
      'term-button',
      'term-hand-matrix',
      'term-combo',
      'term-open-raise',
      'term-position',
    ],
    relatedTools: ['range', 'practiceRange', 'toolEquity'],
    relatedHands: [],
    nextLessons: ['poker-range', 'hand-matrix', 'position'],
    relatedArticles: ['blog-qq-vs-72o-flop-227', 'blog-btn-why-wide'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 7,
  },
  {
    kind: 'blog',
    id: 'blog-pot-odds-quick',
    slug: 'pot-odds-quick',
    contentType: 'data-probability',
    title: '팟오즈 계산법: 하프팟·2/3팟·풀팟에 필요한 승률 표',
    seoTitle: '팟오즈 쉽게 계산하기 — 벳 크기별 암산 숫자',
    description:
      '테이블에서 3초 안에 팟오즈를 계산하는 절차와, 하프팟·2/3팟·풀팟은 물론 1/4팟과 오버벳까지 벳 크기별로 필요한 최소 승률을 표로 보여줍니다.',
    level: 'BASIC',
    topic: 'odds',
    concepts: ['pot-odds', 'bet-sizing'],
    prerequisites: [],
    relatedConcepts: ['term-pot-odds', 'term-pot', 'term-big-blind', 'term-outs'],
    relatedTools: ['toolPotOdds', 'toolOuts', 'toolEquity'],
    relatedHands: [],
    nextLessons: ['pot-odds', 'outs'],
    relatedArticles: ['blog-outs-nine'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
  },
];
