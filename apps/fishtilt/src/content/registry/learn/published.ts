/**
 * Lesson 06, `poker-range` — authored end to end in WP-G as the template every later lesson
 * copies. No H1/H2/H3 batch owns it (H2 is explicitly four lessons, not five, for exactly
 * this reason): it sits here, outside every batch file, so no later agent can mistake it for
 * something still to write. `docs/FISHTILT_CONTENT_PLAN.md` §7 "H2": "Do not touch its MDX
 * or its record. Link to it."
 */
import type { LearnRecord } from '../../types.js';

export const LEARN_PUBLISHED_RECORDS: readonly LearnRecord[] = [
  {
    kind: 'learn',
    id: 'poker-range',
    slug: 'poker-range',
    order: 6,
    title: '핸드레인지란?',
    seoTitle: '포커 레인지란? | 홀덤 핸드레인지 개념과 13×13 표',
    description:
      '홀덤 핸드레인지가 어렵다면 13×13 표를 직접 눌러보세요. 상대가 들고 있을 수 있는 패를 하나로 묶어서 보는 방법을 초보자 눈높이에서 설명합니다.',
    level: 'BASIC',
    topic: 'range',
    concepts: ['range', 'hand-matrix', 'position', 'preflop'],
    prerequisites: ['starting-hands', 'hand-matrix'],
    // Exactly the words the article introduces with <Term>, so "같이 알아둘 용어" is a
    // truthful heading rather than a topic dump. `content.test.ts` checks the containment
    // direction that matters: every <Term> in the prose is declared here. WP-S3-10 L2 added
    // `term-hand-matrix` (the 13×13 표 is now a <Term> at its first mention).
    relatedConcepts: [
      'term-range',
      'term-hand-matrix',
      'term-suited',
      'term-offsuit',
      'term-pocket-pair',
      'term-combo',
      'term-open-raise',
      'term-button',
      'term-utg',
    ],
    relatedTools: ['range', 'toolStartingHand', 'practice'],
    relatedHands: ['hand-aks', 'hand-ako'],
    nextLessons: ['position', 'three-bet'],
    // WP-S3-10 L2: `blog-why-use-range` is the article-length answer to this lesson's own
    // question ("왜 레인지로 보나"), so it joins the two hand-comparison pieces.
    relatedArticles: ['blog-btn-why-wide', 'blog-aks-vs-ako', 'blog-why-use-range'],
    status: 'PUBLISHED',
    indexable: true,
    // Verified against the MDX file's measured length by `content.test.ts` — never typed by
    // hand and left to drift.
    readMinutes: 5,
  },
];
