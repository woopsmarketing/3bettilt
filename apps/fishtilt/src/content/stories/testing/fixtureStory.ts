/**
 * A TEST-ONLY hand story. It is imported by tests and by nothing else: it is not in any
 * registry file, has no MDX on disk, is never a route, and is never in the sitemap —
 * `stories.test.ts` asserts all four. It exists so the story template and the validator can
 * be exercised while the registry holds zero stories (WP-S3-08 writes the real ones).
 *
 * The hand: hero opens QQ on the button, the big blind three-bets, hero calls; the flop is
 * 2-2-7, the villain leads every street, and turns over 7-2 offsuit for a full house. The
 * `winner` below is the author's claim; `validate.ts` checks it against the evaluator, and
 * `validate.test.ts` shows that changing it fails the gate.
 */
import { bb, HAND_STORY_DISCLOSURE } from '../types.js';
import type { HandStoryRecord } from '../../types.js';

export const FIXTURE_STORY_SLUG = 'fixture-story-qq-vs-72o';

export const FIXTURE_STORY: HandStoryRecord = {
  kind: 'blog',
  id: 'blog-fixture-story-qq-vs-72o',
  slug: FIXTURE_STORY_SLUG,
  title: '72o로 3벳을 콜한다고? 그런데 플랍이 2-2-7이었다 (테스트 픽스처)',
  seoTitle: '홀덤 핸드 리뷰: QQ vs 72o, 플랍 2-2-7 (테스트 픽스처)',
  description:
    '버튼에서 QQ로 오픈했더니 빅 블라인드가 3벳. 콜했더니 플랍이 2-2-7. 테스트 전용 픽스처 스토리입니다.',
  contentType: 'hand-story',
  level: 'BASIC',
  topic: 'hand-strength',
  concepts: ['full-house', 'three-bet', 'cooler'],
  prerequisites: [],
  relatedConcepts: ['term-three-bet', 'term-full-house'],
  relatedTools: ['toolHandChecker'],
  relatedHands: ['hand-qq'],
  nextLessons: ['hand-rankings'],
  relatedArticles: ['blog-full-house-vs-flush'],
  status: 'PUBLISHED',
  indexable: false,
  readMinutes: 4,
  hand: {
    stakes: '온라인 6인 캐시 게임',
    gameType: 'NLHE',
    tableSize: 6,
    effectiveStack: bb(100),
    heroPosition: 'BTN',
    villainPosition: 'BB',
    heroHand: 'Qs Qh',
    preflopActions: [
      { position: 'UTG', kind: 'FOLD' },
      { position: 'HJ', kind: 'FOLD' },
      { position: 'CO', kind: 'FOLD' },
      { position: 'BTN', kind: 'RAISE', amount: bb(2.5), note: '오픈' },
      { position: 'SB', kind: 'FOLD' },
      { position: 'BB', kind: 'RAISE', amount: bb(9), note: '3벳' },
      { position: 'BTN', kind: 'CALL' },
    ],
    flop: '2s 2h 7d',
    flopActions: [
      { position: 'BB', kind: 'BET', amount: bb(6) },
      { position: 'BTN', kind: 'CALL' },
    ],
    turn: 'Kc',
    turnActions: [
      { position: 'BB', kind: 'CHECK' },
      { position: 'BTN', kind: 'BET', amount: bb(15) },
      { position: 'BB', kind: 'CALL' },
    ],
    river: '4s',
    riverActions: [
      { position: 'BB', kind: 'BET', amount: bb(30) },
      { position: 'BTN', kind: 'CALL' },
    ],
    showdown: { villainHand: '7c 2c', winner: 'villain' },
    disclosure: HAND_STORY_DISCLOSURE,
  },
};

/**
 * The MDX shape a story's prose file must have (see `stories/mdx.ts`). Kept beside the
 * fixture so the checker has a known-good example and WP-S3-08 has one to copy.
 */
export const FIXTURE_STORY_MDX = `버튼에서 QQ를 받았다. 앞 자리는 모두 폴드. 오픈 레이즈를 넣었더니 빅 블라인드가 3벳으로 돌아왔다.

<StreetSection street="preflop">
  3벳 팟에서 QQ는 여전히 강한 패다. 콜로 플랍을 보기로 했다.
</StreetSection>

<StreetSection street="flop">
  2-2-7. 이보다 마른 보드가 있을까. 상대가 벳을 했고, 나는 콜했다.
</StreetSection>

<StreetSection street="turn">
  K가 떨어졌다. 상대가 체크했고, 나는 벳을 했다. 상대는 콜.
</StreetSection>

<StreetSection street="river">
  4. 상대가 크게 벳을 했다. 오버페어로 콜.
</StreetSection>

<StreetSection street="showdown">
  상대가 카드를 뒤집었다. 7과 2였다.
</StreetSection>

<KeyPoint title="흥미로운 지점">
  3벳 팟에서 72o가 보이는 일은 드물다. 그런데 보였다.
</KeyPoint>

## 무엇을 배울 수 있나

풀하우스는 트리플의 숫자가 우선이다. 이 손에서는 보드의 2 두 장이 상대의 2와 만났다.
`;
