/**
 * Blog batch I3 — 쇼다운에서 실제로 벌어지는 일, four answers about showdowns
 * (`docs/FISHTILT_CONTENT_PLAN.md` §7 "I3", §2.2; Stage 3 audit §2 B11–B15).
 *
 * `blog-btn-why-wide` already existed (WP-G's seed) and is I3's item #15 — reused its id,
 * slug and registered title verbatim (§2.1). WP-S3-07 (Stage 3) rewrote all of this batch as
 * search-intent guides and MERGED `blog-same-pair-who-wins` into `blog-what-is-kicker` (audit
 * B12 → B13; keyword map C13; cannibalization map §1.10 — the two shared one query, "키커로
 * 갈리는 승부", and differed only in the printed example). The merged article now carries the
 * absorbed example verbatim under its own `##`. No redirect: the site has never been deployed
 * (D-S3-03). Every showdown claim in the prose is verified by `i3.test.ts` running
 * `bestFiveOf`/`compareHands` from `@gto-self/strategy-core` over the exact cards printed.
 */
import type { BlogRecord } from '../../types.js';

export const BLOG_I3_RECORDS: readonly BlogRecord[] = [
  {
    kind: 'blog',
    id: 'blog-btn-why-wide',
    slug: 'btn-why-wide',
    contentType: 'search-guide',
    title: '버튼(BTN)에서 왜 더 많은 패로 참여할까? 자리별 레인지 비교',
    seoTitle: '버튼(BTN) 오픈 레인지가 넓은 이유 — 자리별 첫 레이즈 조합 비교',
    description:
      '같은 표인데 자리를 바꾸면 칠해진 칸이 늘어납니다. 여섯 자리의 행동 순서, 자리별 첫 레이즈 조합 수와 비율, 그리고 "버튼이면 아무 패나"가 왜 아닌지를 학습용 기본 레인지로 확인합니다.',
    level: 'BASIC',
    topic: 'position',
    concepts: ['position', 'range', 'open-raise'],
    prerequisites: [],
    relatedConcepts: [
      'term-position',
      'term-open-raise',
      'term-range',
      'term-button',
      'term-cutoff',
      'term-hijack',
      'term-utg',
    ],
    relatedTools: ['range'],
    relatedHands: ['hand-a5s'],
    nextLessons: ['position', 'positions-6max'],
    relatedArticles: ['blog-why-use-range', 'blog-why-72o-is-weak'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 7,
  },
  {
    kind: 'blog',
    id: 'blog-what-is-kicker',
    slug: 'what-is-kicker',
    contentType: 'search-guide',
    title: '키커(Kicker)란? 같은 원페어·투페어에서 승부를 가르는 법',
    seoTitle: '키커란? 같은 원페어면 누가 이길까 — 승부를 가르는 옆 카드, 실제 패로 보기',
    description:
      '같은 원페어, 같은 투페어, 같은 트리플일 때 승부를 마저 가르는 나머지 카드가 키커입니다. 실제 보드와 두 손으로 키커가 어디서 갈리는지, 키커까지 같으면 왜 스플릿인지, 스트레이트·플러시에는 왜 키커가 없는지를 봅니다.',
    level: 'INTRO',
    topic: 'hand-strength',
    concepts: ['kicker', 'hand-ranking', 'split-pot'],
    prerequisites: [],
    relatedConcepts: [
      'term-kicker',
      'term-one-pair',
      'term-two-pair',
      'term-three-of-a-kind',
      'term-flush',
      'term-board',
      'term-split-pot',
    ],
    relatedTools: ['toolHandChecker'],
    relatedHands: [],
    nextLessons: ['hand-rankings'],
    relatedArticles: [
      'blog-playing-the-board',
      'blog-full-house-loses',
      'blog-full-house-vs-flush',
    ],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 8,
  },
  {
    kind: 'blog',
    id: 'blog-playing-the-board',
    slug: 'playing-the-board',
    contentType: 'search-guide',
    title: '보드 플레이(Playing the Board): 공용 카드만으로 족보가 되면 누가 이기나',
    seoTitle: '보드만으로 족보가 완성되면? 스플릿 팟이 되는 경우와 아닌 경우',
    description:
      '보드 다섯 장이 그대로 모두의 최선이면 팟은 똑같이 나뉩니다. 스트레이트·플러시·풀하우스가 깔린 보드에서 언제 스플릿이 되고, 손의 카드 한 장이 언제 보드를 넘어서는지를 실제 보드로 확인합니다.',
    level: 'BASIC',
    topic: 'hand-strength',
    concepts: ['split-pot', 'board', 'nuts'],
    prerequisites: [],
    relatedConcepts: [
      'term-board',
      'term-split-pot',
      'term-community-cards',
      'term-kicker',
      'term-nuts',
      'term-flush',
      'term-full-house',
    ],
    relatedTools: ['toolHandChecker'],
    relatedHands: [],
    nextLessons: ['hand-rankings', 'flop-turn-river'],
    relatedArticles: ['blog-what-is-kicker', 'blog-full-house-loses'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 7,
  },
  {
    kind: 'blog',
    id: 'blog-a2345-wheel',
    slug: 'a2345-wheel',
    contentType: 'search-guide',
    title: 'A2345(휠)는 스트레이트인가? 에이스가 낮게 쓰이는 경우와 아닌 경우',
    seoTitle: 'A2345는 스트레이트인가? 휠 스트레이트의 순위와 스틸 휠',
    description:
      'A가 2 앞의 가장 낮은 카드로 쓰이는 A2345(휠)는 스트레이트로 인정되지만 열 가지 중 가장 낮고, QKA23처럼 에이스를 사이에 끼운 모양은 스트레이트가 아닙니다. 휠의 순위, 스틸 휠, 휠끼리 만났을 때를 정리합니다.',
    level: 'BASIC',
    topic: 'hand-strength',
    concepts: ['straight', 'straight-flush'],
    prerequisites: [],
    relatedConcepts: ['term-straight', 'term-straight-flush', 'term-split-pot'],
    relatedTools: ['toolHandChecker'],
    relatedHands: ['hand-a5s'],
    nextLessons: ['hand-rankings'],
    relatedArticles: ['blog-flush-vs-straight', 'blog-playing-the-board'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
  },
];
