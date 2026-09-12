/**
 * Glossary batch G9 — 시작 핸드·레인지 (9 terms). Category `starting-hands` in
 * `categories.ts`, which is the source of truth for membership; this file only groups the
 * records so one content agent can own it (WP-S3-11 split of the former j1/j2 batches).
 *
 * Every record's `id`, `slug`, `aliases`, `shortDefinition` and relations moved here
 * verbatim. `batches.test.ts` gates this file: threshold, readMinutes, MDX map wiring,
 * `<Term>` and `<PokerCards>` validity, no strategy claims.
 *
 * WP-S3-12 additions: `hand`'s shortDefinition rewritten (audit WEAK) and its `relatedTools`
 * moved to `toolStartingHand`; `hand-matrix` gained a real worked example. Two new terms —
 * `broadway` and `connector` — were added per the audit's "용어 신설 후보" list, closing the
 * ad hoc use of 브로드웨이/커넥터/갭 in `content/hands/kjs.mdx`, `jts.mdx`, `t9s.mdx`, `qjs.mdx`
 * and `content/learn/starting-hands.mdx`. `connector` is ONE record covering both 커넥터
 * and 갭: the site only ever teaches them together as one axis (gap size 0 vs 1, see
 * `content/learn/starting-hands.mdx`'s "숫자가 얼마나 붙어 있는가") and no hand page uses
 * "갭" without "커넥터" nearby, so a second near-duplicate stub would fail its own content
 * threshold on genuinely new prose. See `docs/reports/stage3/handoff/WP_S3_12_G9_HANDOFF.md`.
 */
import type { GlossaryRecord } from '../../types.js';

export const GLOSSARY_G9_RECORDS: readonly GlossaryRecord[] = [
  {
    kind: 'glossary',
    id: 'term-hand',
    slug: 'hand',
    term: 'Hand',
    aliases: ['핸드', '패', '내 패', '손패'],
    title: '핸드 (Hand) — 내가 들고 있는 패',
    shortDefinition:
      '프리플랍에서 받은 시작 두 장, 또는 쇼다운에서 완성한 다섯 장짜리 패를 모두 가리키는 말입니다.',
    description: '핸드라는 말이 시작 패와 완성된 족보 둘 다를 가리킬 수 있다는 것을 설명합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['hand', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-hand-ranking'],
    relatedTools: ['toolStartingHand'],
    relatedHands: [],
    nextLessons: ['starting-hands'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-suited',
    slug: 'suited',
    term: 'Suited',
    aliases: ['수티드', '수딧', '같은 무늬'],
    title: '수티드 (Suited) — 같은 무늬',
    shortDefinition: '받은 두 장의 무늬가 같다는 뜻입니다. 표기할 때 뒤에 s를 붙여 AKs처럼 씁니다.',
    description:
      '같은 무늬 두 장을 뜻하는 Suited. 표기법과 다른 무늬(Offsuit)와의 차이를 설명합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['suited', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-offsuit'],
    relatedTools: ['toolStartingHand'],
    relatedHands: ['hand-aks'],
    nextLessons: ['starting-hands'],
    relatedArticles: ['blog-aks-vs-ako'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-offsuit',
    slug: 'offsuit',
    term: 'Offsuit',
    aliases: ['오프수트', '오프숱', '다른 무늬'],
    title: '오프수트 (Offsuit) — 다른 무늬',
    shortDefinition:
      '받은 두 장의 무늬가 서로 다르다는 뜻입니다. 표기할 때 뒤에 o를 붙여 AKo처럼 씁니다.',
    description:
      '서로 다른 무늬 두 장을 뜻하는 Offsuit. 표기법과 같은 무늬(Suited)와의 차이를 설명합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['offsuit', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-suited'],
    relatedTools: ['toolStartingHand'],
    relatedHands: ['hand-ako'],
    nextLessons: ['starting-hands'],
    relatedArticles: ['blog-aks-vs-ako'],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-pocket-pair',
    slug: 'pocket-pair',
    term: 'Pocket Pair',
    aliases: ['포켓 페어', '포켓페어', '같은 숫자 두 장'],
    title: '포켓 페어 (Pocket Pair) — 같은 숫자 두 장',
    shortDefinition:
      '받은 두 장의 숫자가 같은 경우입니다. AA, 77처럼 숫자를 두 번 써서 표기합니다.',
    description:
      '같은 숫자 두 장을 받은 경우를 뜻하는 포켓 페어. 표기법과 13×13 표에서의 위치를 설명합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['pocket-pair', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-combo'],
    relatedTools: ['toolStartingHand'],
    relatedHands: [],
    nextLessons: ['starting-hands'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-combo',
    slug: 'combo',
    term: 'Combo',
    aliases: ['콤보', '조합'],
    title: '콤보 (Combo) — 무늬까지 따진 한 가지 조합',
    shortDefinition:
      '무늬까지 구별해서 센 시작 패 하나를 뜻합니다. AKs 한 칸 안에도 서로 다른 조합이 여러 개 들어 있습니다.',
    description:
      '무늬까지 구별해서 세는 단위인 콤보. 표의 한 칸과 실제 조합 수가 왜 다른지 설명합니다.',
    level: 'BASIC',
    topic: 'starting-hands',
    concepts: ['combo', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-suited', 'term-offsuit', 'term-pocket-pair'],
    relatedTools: ['toolStartingHand'],
    relatedHands: [],
    nextLessons: ['hand-matrix'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-range',
    slug: 'range',
    term: 'Range',
    aliases: ['레인지', '핸드레인지', '핸드 레인지', '패의 범위'],
    title: '레인지 (Range) — 패의 묶음',
    shortDefinition:
      '어떤 상황에서 한 사람이 들고 있을 수 있는 시작 패 전부를 하나로 묶어 부르는 말입니다.',
    description:
      '포커에서 레인지는 상대가 들고 있을 수 있는 패 전체를 뜻합니다. 하나로 찍지 않고 묶어서 보는 이유를 설명합니다.',
    level: 'BASIC',
    topic: 'range',
    concepts: ['range'],
    prerequisites: [],
    relatedConcepts: ['term-combo', 'term-preflop'],
    relatedTools: ['range'],
    relatedHands: [],
    nextLessons: ['poker-range'],
    relatedArticles: [],
    // WP-G2 proof record — see the module doc. J2 replaces the placeholder MDX with the
    // real entry and clears the index threshold, so this flips to indexable too.
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-hand-matrix',
    slug: 'hand-matrix',
    term: 'Hand Matrix',
    aliases: ['핸드 매트릭스', '13x13', '13×13 표', '레인지 차트', '레인지표'],
    title: '핸드 매트릭스 (Hand Matrix) — 13×13 표',
    shortDefinition: '169가지 시작 패를 늘어놓은 13×13 정사각형 표를 말합니다.',
    description: '핸드 매트릭스의 대각선, 위쪽, 아래쪽이 각각 무엇을 뜻하는지 설명합니다.',
    level: 'BASIC',
    topic: 'range',
    concepts: ['hand-matrix'],
    prerequisites: [],
    relatedConcepts: ['term-combo'],
    relatedTools: ['range'],
    relatedHands: [],
    nextLessons: ['hand-matrix'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-broadway',
    slug: 'broadway',
    term: 'Broadway',
    aliases: ['브로드웨이', '브로드웨이 카드', '브로드웨이 패'],
    title: '브로드웨이 (Broadway) — 10 이상의 다섯 숫자',
    shortDefinition:
      '10·J·Q·K·A 다섯 숫자를 묶어 부르는 말입니다. 이 중 두 장으로 시작한 패를 브로드웨이 패라고 부릅니다.',
    description:
      '브로드웨이가 가리키는 다섯 숫자와, 브로드웨이 패라는 이름이 순위까지 정해 주지는 않는다는 점을 설명합니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['broadway', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-connector'],
    relatedTools: ['toolStartingHand'],
    relatedHands: ['hand-kjs', 'hand-qjs', 'hand-jts'],
    nextLessons: ['starting-hands'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
  {
    kind: 'glossary',
    id: 'term-connector',
    slug: 'connector',
    term: 'Connector',
    aliases: ['커넥터', '갭', 'gapper'],
    title: '커넥터 (Connector / Gapper) — 숫자가 붙거나 한 칸 뜬 두 장',
    shortDefinition:
      '두 숫자가 바로 이어져 있으면 커넥터, 한 칸 떨어져 있으면 갭 하나짜리 조합이라고 부릅니다.',
    description:
      '두 숫자 사이의 간격을 기준으로 시작 패를 부르는 커넥터와 갭을 설명합니다. 두 이름 모두 나중에 스트레이트로 이어질 가능성을 보는 이름입니다.',
    level: 'INTRO',
    topic: 'starting-hands',
    concepts: ['connector', 'gapper', 'starting-hand'],
    prerequisites: [],
    relatedConcepts: ['term-straight', 'term-broadway'],
    relatedTools: ['toolStartingHand'],
    relatedHands: ['hand-jts', 'hand-t9s'],
    nextLessons: ['starting-hands'],
    relatedArticles: [],
    status: 'PUBLISHED',
    indexable: true,
    readMinutes: 2,
  },
];
