/**
 * Learn batch H2 — lessons 07, 08, 09, 10 (position, actions, preflop), four lessons, not
 * five: lesson 06 (`poker-range`) is already `PUBLISHED` and lives in `./published.ts`,
 * outside every batch's file (`docs/FISHTILT_CONTENT_PLAN.md` §7 "H2").
 *
 * Lesson 09's `title`/`description` are corrected here (CLAUDE.md rule 7,
 * `docs/FISHTILT_CONTENT_PLAN.md` §1.1 R3, `docs/FISHTILT_STATE.md` ruling 12): the previous
 * copy asserted "네 가지" (four) named actions and named only 콜·체크·레이즈·폴드, when there
 * are five (체크·베팅·콜·레이즈·폴드). Both fields now state five.
 */
import type { LearnRecord } from '../../types.js';

export const LEARN_H2_RECORDS: readonly LearnRecord[] = [
  {
    kind: 'learn',
    id: 'position',
    slug: 'position',
    order: 7,
    title: '자리(포지션)가 왜 그렇게 중요할까요?',
    description:
      '같은 패라도 어느 자리에 앉아 있느냐에 따라 판단이 달라집니다. 그 이유를 순서의 문제로 설명합니다.',
    level: 'BASIC',
    topic: 'position',
    concepts: ['position', 'range'],
    prerequisites: ['poker-range'],
    // WP-S3-10 L2: HJ/CO are named once each in the PositionDiagram paragraph (audit §3
    // "+cutoff, hijack"); AA is the "칠해진 자리가 늘 같은 패" contrast to 87s in the prose.
    relatedConcepts: [
      'term-position',
      'term-button',
      'term-utg',
      'term-hijack',
      'term-cutoff',
      // WP-S3-16: the 인포지션·아웃오브포지션 section introduces IP/OOP by name.
      'term-ip-oop',
    ],
    relatedTools: ['range', 'practiceRange'],
    relatedHands: ['hand-aa'],
    nextLessons: ['positions-6max'],
    relatedArticles: ['blog-btn-why-wide', 'blog-why-use-range'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
  },
  {
    kind: 'learn',
    id: 'positions-6max',
    slug: 'positions-6max',
    order: 8,
    title: '6맥스 포지션 이름 — UTG·HJ·CO·BTN·SB·BB',
    description: '6인 테이블의 여섯 자리를 하나씩 짚고, 각 자리가 언제 행동하는지 정리합니다.',
    level: 'BASIC',
    topic: 'position',
    concepts: ['position', 'blinds'],
    prerequisites: ['position'],
    relatedConcepts: [
      'term-position',
      'term-open-raise',
      'term-utg',
      'term-hijack',
      'term-cutoff',
      'term-button',
      'term-small-blind',
      'term-big-blind',
      'term-blind',
    ],
    relatedTools: ['range', 'practiceRange'],
    // WP-S3-10 L2: 22 is the prose's example of a hand only the widest (SB) first-in table
    // carries — `learn-L2.claims.test.ts` re-derives that from the shipped ranges.
    relatedHands: ['hand-22'],
    nextLessons: ['poker-actions'],
    relatedArticles: ['blog-btn-why-wide', 'blog-why-blinds-exist'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
  },
  {
    kind: 'learn',
    id: 'poker-actions',
    slug: 'poker-actions',
    order: 9,
    title: '체크 · 베팅 · 콜 · 레이즈 · 폴드, 다섯 가지 행동',
    description:
      '내 차례에 고를 수 있는 행동은 다섯 가지입니다. 체크, 베팅, 콜, 레이즈, 폴드가 각각 무엇을 뜻하고 언제 고를 수 있는지 확실히 합니다.',
    level: 'INTRO',
    topic: 'betting',
    concepts: ['action', 'betting-round'],
    prerequisites: ['holdem-basics'],
    relatedConcepts: [
      'term-action',
      'term-open-raise',
      'term-check',
      'term-bet',
      'term-call',
      'term-raise',
      // WP-S3-16: the bet section names the bluff once (the term's only contextual inbound).
      'term-bluff',
      'term-fold',
      'term-all-in',
      'term-pot',
    ],
    relatedTools: ['toolPotOdds'],
    // WP-S3-10 L2: the worked example hand is AJs, which has its own page.
    relatedHands: ['hand-ajs'],
    nextLessons: ['preflop'],
    // Was the only `relatedArticles: []` among the fifteen lessons (WP-7b). Both entries
    // continue THIS lesson's own subject rather than merely sharing a topic tag:
    // `blog-why-called-3bet` counts the raises this lesson defines, and
    // `blog-why-blinds-exist` explains the money already in the pot that makes the first
    // preflop raise an 오픈 레이즈 rather than a 베팅 — the aside this lesson leaves open.
    relatedArticles: ['blog-why-called-3bet', 'blog-why-blinds-exist'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
  },
  {
    kind: 'learn',
    id: 'preflop',
    slug: 'preflop',
    order: 10,
    title: '첫 두 장을 받은 뒤, 프리플랍',
    description:
      '공용 카드가 아직 한 장도 열리지 않은 첫 번째 베팅. 이때 무엇을 보고 결정하는지 살펴봅니다.',
    level: 'BASIC',
    topic: 'betting',
    concepts: ['preflop', 'range', 'position'],
    prerequisites: ['poker-actions', 'poker-range'],
    relatedConcepts: [
      'term-preflop',
      'term-open-raise',
      'term-limp',
      'term-button',
      'term-hijack',
      'term-utg',
      'term-vpip',
      'term-pfr',
      'term-three-bet',
    ],
    relatedTools: ['range'],
    // WP-S3-10 L2: AQo is the worked example (has a page); 72o (no page) is the
    // "한 자리도 없습니다" contrast, so its article stands in for it.
    relatedHands: ['hand-aqo'],
    nextLessons: ['flop-turn-river'],
    relatedArticles: ['blog-why-use-range', 'blog-why-72o-is-weak', 'blog-why-blinds-exist'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
  },
];
