/**
 * Hands batch K2 — the four smaller pocket pairs plus the wheel ace (`99`, `88`, `77`, `22`,
 * `a5s`). See `k1.ts`'s module doc for the WP-S3-13a split; records are verbatim from the
 * former `e3.ts`.
 */
import type { HandRecord } from '../../types.js';

export const HAND_K2_RECORDS: readonly HandRecord[] = [
  {
    kind: 'hands',
    id: 'hand-99',
    slug: '99',
    handKey: '99',
    title: '같은 숫자 두 장 (9 페어) · 99',
    description: '9 두 장을 받은 경우. 이 정도 포켓 페어의 조합 수와 순위를 확인합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['pocket-pair', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-pocket-pair', 'term-combo'],
    relatedTools: ['toolStartingHand', 'toolEquity'],
    relatedHands: ['hand-tt', 'hand-88'],
    nextLessons: ['starting-hands'],
    // WP-1 decision C16, implemented on `hand-22` only until WP-7b. `blog-small-pocket-pairs`
    // names no pocket pair above 55, so this is companion reading under `이 개념과 같이 보면
    // 쉬워요`, not a claim that the article covers this hand: what it explains — the six
    // combinations every pocket pair has, and why pocket pairs sit high in the ranking — is
    // exactly what this page states about 77·88·99, and holds for every pair alike.
    relatedArticles: ['blog-small-pocket-pairs'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'hands',
    id: 'hand-88',
    slug: '88',
    handKey: '88',
    title: '같은 숫자 두 장 (8 페어) · 88',
    description: '8 두 장을 받은 경우. 이 정도 포켓 페어의 조합 수와 순위를 확인합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['pocket-pair', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-pocket-pair', 'term-combo'],
    relatedTools: ['toolStartingHand', 'toolEquity'],
    relatedHands: ['hand-99', 'hand-77', 'hand-aks'],
    nextLessons: ['starting-hands'],
    // WP-1 decision C16, implemented on `hand-22` only until WP-7b. `blog-small-pocket-pairs`
    // names no pocket pair above 55, so this is companion reading under `이 개념과 같이 보면
    // 쉬워요`, not a claim that the article covers this hand: what it explains — the six
    // combinations every pocket pair has, and why pocket pairs sit high in the ranking — is
    // exactly what this page states about 77·88·99, and holds for every pair alike.
    relatedArticles: ['blog-small-pocket-pairs'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'hands',
    id: 'hand-77',
    slug: '77',
    handKey: '77',
    title: '같은 숫자 두 장 (7 페어) · 77',
    description: '7 두 장을 받은 경우. 이 정도 포켓 페어의 조합 수와 순위를 확인합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['pocket-pair', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-pocket-pair', 'term-combo'],
    relatedTools: ['toolStartingHand', 'toolEquity'],
    relatedHands: ['hand-88', 'hand-22', 'hand-aks'],
    nextLessons: ['starting-hands'],
    // WP-1 decision C16, implemented on `hand-22` only until WP-7b. `blog-small-pocket-pairs`
    // names no pocket pair above 55, so this is companion reading under `이 개념과 같이 보면
    // 쉬워요`, not a claim that the article covers this hand: what it explains — the six
    // combinations every pocket pair has, and why pocket pairs sit high in the ranking — is
    // exactly what this page states about 77·88·99, and holds for every pair alike.
    relatedArticles: ['blog-small-pocket-pairs'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 3,
  },
  {
    kind: 'hands',
    id: 'hand-22',
    slug: '22',
    handKey: '22',
    title: '같은 숫자 두 장 (2 페어) · 22',
    description: '2 두 장을 받은 경우. 가장 작은 포켓 페어가 표에서 어디에 있는지 확인합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['pocket-pair', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-pocket-pair', 'term-combo'],
    relatedTools: ['toolStartingHand', 'toolEquity'],
    relatedHands: ['hand-77'],
    nextLessons: ['starting-hands'],
    relatedArticles: ['blog-small-pocket-pairs'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 3,
  },
  {
    kind: 'hands',
    id: 'hand-a5s',
    slug: 'a5s',
    handKey: 'A5s',
    title: '같은 무늬의 A와 5 · A5s',
    description:
      'A와 5를 같은 무늬로 받은 경우. 숫자 차이가 큰 에이스 수티드 패의 위치를 확인합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['suited', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-suited', 'term-combo'],
    relatedTools: ['toolStartingHand', 'toolEquity'],
    relatedHands: ['hand-aks', 'hand-aqs', 'hand-ajs', 'hand-kqs', 'hand-22'],
    nextLessons: ['starting-hands'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
];
