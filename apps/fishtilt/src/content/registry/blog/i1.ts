/**
 * Blog batch I1 — 시작 패 강도, five answers about starting-hand strength
 * (`docs/FISHTILT_CONTENT_PLAN.md` §7 "I1", §2.2). All five `PUBLISHED`.
 *
 * WP-S3-07 (Stage 3 blog migration, `docs/reports/stage3/3BETTILT_CONTENT_AUDIT.md` §2
 * B01–B05) rewrote the five as search-intent-complete guides:
 *
 * - `blog-aks-vs-ako`        RENAME — the flagship search guide (contract AI example).
 * - `blog-next-best-after-aa` DEEP EXPAND — top-20 ranking table, 데이터와 확률.
 * - `blog-how-often-aa`      LIGHT EXPAND — six combos drawn, pair/AK comparison, FAQ.
 * - `blog-is-ak-good`        DEEP EXPAND — the AK hub (rank · RFI seats · QQ matchup · outs).
 * - `blog-qq-vs-ak`          LIGHT EXPAND — "코인플립" belief checked against the frozen
 *                            class-vs-class dataset (audit §6.1 NUMBER-RISK #27).
 *
 * `title` is the H1 (may be human/curious); `seoTitle` states the search query and is what
 * `seo/metadata.ts` puts in `<title>`/OG. Every typed number in a title/description is pinned
 * against the engine by `i1.test.ts` (a title cannot hold a `<Fact>`).
 *
 * `blog-qq-vs-ak` cites `CLASS_VS_CLASS_EQUITY` rather than fixing four concrete cards —
 * `docs/FISHTILT_STATE.md` ruling 24 corrects the content plan §2.4/§4, which was written
 * before that fact existed. Since WP-S3-07 it also cites the same two matchups from AK's side
 * (`AKs|QQ`, `AKo|QQ`); the batch test pins that the two views of one matchup sum to the pot.
 */
import type { BlogRecord } from '../../types.js';

export const BLOG_I1_RECORDS: readonly BlogRecord[] = [
  {
    kind: 'blog',
    id: 'blog-aks-vs-ako',
    slug: 'aks-vs-ako',
    contentType: 'search-guide',
    title: 'AKs vs AKo 차이: 수티드가 실제로 얼마나 중요한가?',
    seoTitle: 'AKs vs AKo 차이는? 수티드가 실제로 얼마나 중요한가',
    description:
      '같은 A와 K인데 무늬 한 글자가 조합 수, 승률, 순위를 얼마나 바꾸는지 계산해 둔 숫자로 재고, 어디까지는 똑같은지도 함께 봅니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['suited', 'offsuit', 'starting-hand', 'combo'],
    prerequisites: [],
    relatedConcepts: [
      'term-suited',
      'term-offsuit',
      'term-combo',
      'term-flush',
      'term-hand-matrix',
    ],
    relatedTools: ['toolStartingHand', 'toolEquity'],
    relatedHands: ['hand-aks', 'hand-ako'],
    nextLessons: ['starting-hands', 'hand-matrix'],
    relatedArticles: ['blog-is-ak-good', 'blog-why-suited-matters'],
    status: 'PUBLISHED',
    indexable: true,
    // `estimateReadMinutes` of the measured prose (`i1.test.ts` / `content.test.ts` assert
    // the two agree) — never a guess.
    readMinutes: 6,
  },
  {
    kind: 'blog',
    id: 'blog-next-best-after-aa',
    slug: 'next-best-after-aa',
    contentType: 'data-probability',
    title: 'AA 다음으로 강한 시작 패는? 상위 20위 순위표와 승률',
    seoTitle: 'AA 다음으로 강한 홀덤 시작 핸드는? 순위 2위~20위와 승률',
    description:
      '2위 KK부터 20위까지 시작 패 순위표를 통째로 펼치고, 이 순위가 정확히 무엇을 잰 값인지, 왜 포켓페어가 위쪽에 몰리는지 봅니다.',
    level: 'BASIC',
    topic: 'starting-hands',
    concepts: ['hand-strength', 'starting-hand', 'equity'],
    prerequisites: [],
    relatedConcepts: ['term-equity', 'term-pocket-pair', 'term-hand-ranking'],
    relatedTools: ['toolStartingHand'],
    relatedHands: ['hand-aa', 'hand-kk', 'hand-qq', 'hand-jj'],
    nextLessons: ['starting-hand-ranking', 'equity'],
    relatedArticles: [
      'blog-how-often-aa',
      'blog-is-ak-good',
      'blog-aks-vs-ako',
      'blog-small-pocket-pairs',
    ],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
  },
  {
    kind: 'blog',
    id: 'blog-how-often-aa',
    slug: 'how-often-aa',
    contentType: 'data-probability',
    title: 'AA를 받을 확률은? 조합 6가지로 계산하는 법',
    seoTitle: 'AA 받을 확률은? 포켓 에이스는 몇 판에 한 번 나올까',
    description:
      'AA를 만드는 조합 6가지를 직접 늘어놓고 전체 조합 중 비율로 바꾸는 계산, 다른 페어·AK와의 비교, 그리고 "이제 나올 때가 됐다"는 오해까지 다룹니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['starting-hand', 'combo', 'probability'],
    prerequisites: [],
    relatedConcepts: ['term-combo', 'term-pocket-pair'],
    relatedTools: ['toolStartingHand'],
    relatedHands: ['hand-aa', 'hand-kk'],
    nextLessons: ['hand-matrix', 'starting-hands'],
    relatedArticles: ['blog-next-best-after-aa', 'blog-aks-vs-ako'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 5,
  },
  {
    kind: 'blog',
    id: 'blog-is-ak-good',
    slug: 'is-ak-good',
    contentType: 'search-guide',
    title: 'AK는 좋은 패인가? 순위·자리·페어 상대 승률까지 한 번에',
    seoTitle: 'AK는 좋은 패인가? 빅 슬릭의 순위, 첫 레이즈 자리, QQ 상대 승률',
    description:
      'AKs 8위·AKo 12위라는 순위, 학습용 기본 레인지에서 첫 레이즈로 쓰이는 자리, QQ를 만났을 때의 승률, 플랍에서 페어를 못 만들 확률까지 AK에 대한 질문을 한자리에 모았습니다.',
    level: 'BASIC',
    topic: 'starting-hands',
    concepts: ['hand-strength', 'starting-hand', 'position', 'equity'],
    prerequisites: [],
    relatedConcepts: ['term-suited', 'term-offsuit', 'term-position', 'term-outs'],
    relatedTools: ['toolStartingHand', 'toolEquity', 'range'],
    relatedHands: ['hand-aks', 'hand-ako', 'hand-qq'],
    nextLessons: ['starting-hand-ranking', 'position', 'outs'],
    relatedArticles: ['blog-aks-vs-ako', 'blog-qq-vs-ak', 'blog-next-best-after-aa'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 7,
  },
  {
    kind: 'blog',
    id: 'blog-qq-vs-ak',
    slug: 'qq-vs-ak',
    contentType: 'data-probability',
    title: "QQ vs AK 승률: '코인플립'이라는 말은 맞을까?",
    seoTitle: 'QQ vs AK 승률 — 페어와 오버카드의 대결, 정말 코인플립일까',
    description:
      'QQ가 AKs·AKo를 각각 만났을 때 팟에서 기대하는 몫을 전수 계산한 숫자로 보고, "코인플립"이라는 통념이 어디까지 맞는지, 왜 페어가 조금 앞서는지 설명합니다.',
    level: 'BASIC',
    topic: 'equity',
    concepts: ['equity', 'starting-hand', 'pocket-pair'],
    prerequisites: [],
    relatedConcepts: ['term-equity'],
    relatedTools: ['toolEquity'],
    relatedHands: ['hand-qq', 'hand-aks', 'hand-ako'],
    nextLessons: ['equity', 'starting-hand-ranking'],
    relatedArticles: ['blog-is-ak-good', 'blog-aks-vs-ako', 'blog-qq-three-bet-frustration'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 6,
  },
];
