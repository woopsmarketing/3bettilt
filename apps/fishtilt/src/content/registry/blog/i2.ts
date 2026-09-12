/**
 * Blog batch I2 — 무늬와 족보, five answers about hand types and suits
 * (`docs/FISHTILT_CONTENT_PLAN.md` §7 "I2", §2.2).
 *
 * All five (`blog-small-pocket-pairs`, `blog-why-72o-is-weak`, `blog-why-suited-matters`,
 * `blog-flush-vs-straight`, `blog-full-house-vs-flush`) are now `PUBLISHED`, backed by MDX at
 * `apps/fishtilt/content/blog/*.mdx` and registered in `src/content/blog/i2.ts`.
 *
 * WP-S3-07 (batch i2) migrated these five to the Stage 3 search-guide shape per the content
 * audit (`docs/reports/stage3/3BETTILT_CONTENT_AUDIT.md` §2, B06-B10): `<QuickAnswer>` first,
 * a DataTable/ComparisonTable of real numbers, an FAQ block, and one `<ToolCTA>`.
 * `why-72o-is-weak` and `why-suited-matters` were RENAMEd (new H1/seoTitle; the audit's
 * NUMBER-RISK #14/#15 claims about `why-suited-matters` — the suited/offsuit equity gap
 * staying within a single-digit percentage point, and suited beating offsuit with zero
 * exceptions across all 78 same-rank pairs — are pinned by `i2.test.ts`, computed from
 * `@gto-self/learn-core`'s `handStrengthForKey` over every `@gto-self/strategy-core`
 * `HAND_CLASSES` suited/offsuit pair, not typed from memory.
 *
 * The two ranking comparisons (`blog-flush-vs-straight`, `blog-full-house-vs-flush`) print a
 * specific showdown whose winner was verified by running `evaluateHand`/`compareHands` from
 * `@gto-self/strategy-core` over the exact cards the article shows (ruling 28) — see
 * `i2.test.ts`. `why-72o-is-weak` links to the hand story `blog-qq-vs-72o-flop-227` and
 * `full-house-vs-flush` links to `blog-full-house-loses` (both stories already link back —
 * `src/content/registry/blog/stories/s1.ts`). `readMinutes` is `estimateReadMinutes()` of
 * each file's own measured prose length, pinned by `i2.test.ts`.
 */
import type { BlogRecord } from '../../types.js';

export const BLOG_I2_RECORDS: readonly BlogRecord[] = [
  {
    kind: 'blog',
    id: 'blog-small-pocket-pairs',
    slug: 'small-pocket-pairs',
    contentType: 'search-guide',
    title: '작은 포켓페어(22~66)는 좋은 패일까?',
    seoTitle: '작은 포켓페어(22~66)는 좋은 패일까? 순위·조합·쓰이는 자리',
    description:
      '22부터 66까지 다섯 포켓페어의 순위와 승률, 조합 수와 첫 레이즈 자리까지 표 하나로 비교합니다.',
    level: 'BASIC',
    topic: 'starting-hands',
    concepts: ['pocket-pair', 'starting-hand', 'three-of-a-kind'],
    prerequisites: [],
    relatedConcepts: ['term-pocket-pair', 'term-three-of-a-kind'],
    relatedTools: ['toolStartingHand'],
    relatedHands: ['hand-22'],
    nextLessons: ['starting-hands', 'starting-hand-ranking'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 4,
  },
  {
    kind: 'blog',
    id: 'blog-why-72o-is-weak',
    slug: 'why-72o-is-weak',
    contentType: 'concept-culture',
    title: '72o가 최악의 패라는 말은 맞을까?',
    seoTitle: '72o가 최악의 패라는 말은 맞을까? 순위표 진짜 바닥은 따로 있다',
    description:
      '흔히 최악의 패로 꼽히는 72o의 실제 순위와, 169가지 중 진짜 꼴찌가 무엇인지 데이터로 확인합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['hand-strength', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-hand-ranking', 'term-offsuit'],
    relatedTools: ['toolStartingHand'],
    relatedHands: [],
    nextLessons: ['starting-hand-ranking', 'hand-rankings'],
    relatedArticles: ['blog-qq-vs-72o-flop-227'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 4,
  },
  {
    kind: 'blog',
    id: 'blog-why-suited-matters',
    slug: 'why-suited-matters',
    contentType: 'data-probability',
    title: '수티드(같은 무늬)는 얼마나 중요한가?',
    seoTitle: '수티드(같은 무늬)는 얼마나 중요한가? 같은 숫자 조합 전부 비교',
    description:
      '수티드와 오프수트의 승률·순위 차이가 실제로 얼마나 되는지, 같은 숫자 조합 78가지 전부를 근거로 확인합니다.',
    level: 'BASIC',
    topic: 'starting-hands',
    concepts: ['suited', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-suited', 'term-offsuit'],
    relatedTools: ['toolStartingHand'],
    relatedHands: [],
    nextLessons: ['starting-hands', 'hand-rankings'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 4,
  },
  {
    kind: 'blog',
    id: 'blog-flush-vs-straight',
    slug: 'flush-vs-straight',
    contentType: 'search-guide',
    title: '플러시와 스트레이트 중 뭐가 강할까?',
    seoTitle: '플러시 vs 스트레이트: 어느 쪽이 이기고, 왜 더 드문가',
    description: '두 족보 중 왜 플러시가 더 높은 순위인지, 나오는 빈도로 설명합니다.',
    level: 'BASIC',
    topic: 'hand-strength',
    concepts: ['hand-ranking', 'flush', 'straight'],
    prerequisites: [],
    relatedConcepts: ['term-flush', 'term-straight', 'term-straight-flush'],
    relatedTools: ['toolHandChecker'],
    relatedHands: [],
    nextLessons: ['hand-rankings'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 4,
  },
  {
    kind: 'blog',
    id: 'blog-full-house-vs-flush',
    slug: 'full-house-vs-flush',
    contentType: 'search-guide',
    title: '풀하우스와 플러시 중 뭐가 강할까?',
    seoTitle: '풀하우스 vs 플러시: 순위와 빈도, 풀하우스끼리 비교하는 법',
    description:
      '두 족보 중 왜 풀하우스가 더 높은 순위인지, 풀하우스끼리 비교하는 법까지 정리합니다.',
    level: 'BASIC',
    topic: 'hand-strength',
    concepts: ['hand-ranking', 'full-house', 'flush'],
    prerequisites: [],
    relatedConcepts: ['term-full-house', 'term-flush'],
    relatedTools: ['toolHandChecker'],
    relatedHands: [],
    nextLessons: ['hand-rankings'],
    relatedArticles: ['blog-flush-vs-straight', 'blog-full-house-loses'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 4,
  },
];
