# WP-S3-11 — Glossary hub + term template

## Objective

`/ko/glossary`를 58장 카드 벽에서 빠른 사전(검색 · 많이 연결된 용어 · 주제별 · ㄱㄴㄷ 색인)으로,
`/ko/glossary/[slug]`를 표제어·영어명·별칭·한 줄 정의·미니 비주얼·관련 슬롯을 가진 용어 템플릿으로 바꾸고,
J1/J2 레지스트리·MDX 맵을 카테고리별 배치 파일(g1–g9)로 분할한다(계약 AU/AV/AW).

## Facts verified before work

- 시작 상태: `/ko/glossary` = `LinkCard` 58장 2열, title(`내 차례가 오는 자리 (Position)`) ko 정렬. 상세는
  `term` + alias 칩 + MDX + `RelatedContent`만, `shortDefinition` 미표시. 스크린샷 `wp11/baseline/`.
- 58 레코드 전부 PUBLISHED. `title`은 설명형 gloss, `term`은 Latin, 한국어 이름은 alias 안에만 있음(BB/SB/BTN/
  CO/HJ는 첫 alias가 약어). "쉽게 설명하면/예로 보면" H2는 J2 계열 29편에만 있음(J1 계열 29편 없음).
- MDX 카드 예시(`<PokerCards>`) 26편 존재(족보 9 + kicker/nuts/split-pot + 스트리트 5 + 시작핸드 4 등).
- `GLOSSARY_J1_RECORDS`/`J2`를 코드로 import하는 곳 없음(주석 4곳만: `features/range/copy.ts:153`,
  `learn/h1.test.ts:5`, `blog/i1.test.ts:5`, `tests/e2e/search.spec.ts:13`).
- `theme-tokens.test.ts:389`가 `glossary/[slug]` `<main>`에 `max-w-reading`을 요구 → 유지함.
- `hubCollectionPage.test.tsx`가 모든 허브에 "JSON-LD 행 순서 = 페이지가 처음 링크하는 순서"를 요구.
- vitest에 MDX 변환 없음 → 페이지 템플릿(`[slug]/page.tsx`)은 유닛 테스트 불가, 컴포넌트 단위로 테스트.

## Decisions made

- **카테고리 6개**(감사 §4 그대로): `game` 게임 구조 14 · `betting` 베팅·액션 15 · `position` 포지션 5 ·
  `hand-rankings` 카드·족보 13 · `math` 확률·수학 4 · `starting-hands` 시작 핸드·레인지 7. `types.ts`는 건드리지
  않고 learn과 같은 매핑 모듈 `registry/glossary/categories.ts`(`TERM_CATEGORY` slug→id)로 구현.
- **표제어(headword)**: `TERM_HEADWORD` slug→한국어 이름. 값은 반드시 그 레코드의 `term` 또는 `aliases` 중 하나
  (테스트 강제) — 이름을 새로 만들지 않음. 숫자 시작 표기(`3벳`)는 한글 표기(`쓰리벳`)를 골라 ㅅ 탭에 배치.
  A–Z 탭은 `vpip`·`pfr`뿐. 표제어는 사전 전체에서 유일.
- **ㄱㄴㄷ**: `initials.ts` — 첫 글자 초성(된소리는 기본 자음으로 접음: 쓰리벳→ㅅ), 비한글은 `A–Z`. 탭 순서 →
  탭 내부는 `localeCompare(…, 'ko')`. 허브 색인의 유일한 정렬 기준.
- **"인기 용어"는 트래픽이 아니라 인바운드 수**: `popular.ts`가 `ALL_CONTENT`의 `relatedConcepts` 참조 수를
  세어 상위 8개. 라벨 "가장 많이 연결된 용어", 문장에 "검색량이 아닙니다" 명시. 칩에 숫자 표시.
- **허브 구조**: PageHero(검색 필드 포함, facts 58개/6가지) → 분류 칩 + ㄱㄴㄷ 탭(모두 same-page anchor) →
  많이 연결된 용어(칩) → 주제별로 보기(6 섹션, 표제어 inline 링크만) → Divider → 전체 용어(ㄱㄴㄷ 색인,
  행 = `표제어 · Latin 이름들 | 한 줄 정의`). 정의는 색인 행에만 한 번 인쇄. 카드 0.
- **검색**: `GlossarySearch`('use client', 페이지 유일 클라이언트 섬). `<form role=search action=/ko/search
  method=get name=q>` → JS 없으면 사이트 검색으로 제출. JS 있으면 `[data-glossary-row][data-search]`를
  `hidden` 토글(표제어·term·alias·title, 소문자·공백 제거), 빈 탭 숨김, `[data-glossary-hide-on-search]`
  섹션(많이 연결된/주제별) 숨김, live region 카운트. 매치 0이면 submit을 사이트 검색으로 통과시킴.
- **DefinedTermSet**: `name`=표제어, `description`=shortDefinition, PUBLISHED만. 행 순서는 페이지 최초 링크
  순서(많이 연결된 → 주제별 → 색인, 중복 제거) — `hubCollectionPage.test.tsx` 규칙 준수.
- **상세 템플릿**: h1은 여전히 `title`(`<title>`/breadcrumb과 동일). `GlossaryTermHeader`: 용어 · 카테고리
  칩(허브 `#cat-<id>`로 복귀) · 난이도 → h1 → 이름 줄(`data-glossary-headword` · `data-glossary-term` ·
  `data-glossary-alias` 각 1회, 표제어 중복 없음) → 한 줄 정의(`data-glossary-definition`) → 비주얼.
  본문 MDX는 `border-t` 아래 prose 크기(예전 첫 문단 확대 제거: 리드가 이미 정의를 말함).
  그 뒤 `GlossaryRelatedTerms`(같이 알아둘 용어, inline) → `RelatedContent` 4회 개별 호출로 순서 고정
  (더 배우기 → 직접 확인하기 → 이런 이야기도 있어요 → 비슷한 핸드).
- **DefinedTerm JSON-LD**: `components/glossary/definedTermJsonLd.ts`(name/description/alternateName/url +
  `inDefinedTermSet`→허브). `lib/seo/**` 경계 밖이라 컴포넌트 옆에 둠 — 이동 요청은 Open issues.
- **미니 비주얼** `components/glossary/visuals.ts`: 족보 9(`made-hand`, 평가기로 카테고리 검증) ·
  suited/offsuit/pocket-pair(`hand-class`) · flop/turn/river/board/community-cards(`board`, 같은 보드
  `Kd 7s 2h / 9c / 4d` 진행). 베팅·포지션 용어는 비주얼 없음.
- **배치 분할 9개**(카테고리 경계를 넘는 파일 없음): g1 게임 구조·판과 돈(8) · g2 게임 구조·스트리트와 보드(6) ·
  g3 베팅·기본 액션(7) · g4 베팅·프리플랍 이름과 통계(8) · g5 포지션(5) · g6 아홉 족보(10) · g7 승부 판정
  kicker/split-pot/nuts(3) · g8 확률·수학(4) · g9 시작 핸드·레인지(7). 레코드 블록은 스크립트로 verbatim 이동
  (블록 내부 주석 포함). `GLOSSARY_RECORDS` 순서는 g1→g9 순(예전 J1→J2와 다름 — 아래 Known limitations).
- 테스트 이동: J1/J2 배치 게이트 → `batches.test.ts`(9배치 × 동일 assertion, J1의 `무조건/반드시` 규칙을 전
  배치에 확대 적용해도 통과), J2 개별 예시 검사 → `examples.test.ts`(alias 충돌·flush-draw·nuts 보드).

## Files changed

- 삭제 6: `registry/glossary/{j1,j2}.ts`, `{j1,j2}.test.ts`, `content/glossary/{j1,j2}.ts`.
- 신규 레지스트리: `registry/glossary/{g1..g9}.ts`, `categories.ts`, `initials.ts`, `popular.ts`,
  `batches.test.ts`, `examples.test.ts`, `categories.test.ts`, `initials.test.ts`, `popular.test.ts`;
  수정 `registry/glossary/index.ts`(`GLOSSARY_BATCHES` 추가). MDX 맵 신규 `content/glossary/{g1..g9}.ts`, 수정 `index.ts`.
- 신규 `src/components/glossary/`: `GlossarySearch.tsx`(client), `GlossaryNav.tsx`, `GlossaryIndex.tsx`,
  `GlossaryCategoryMap.tsx`, `GlossaryPopular.tsx`, `GlossaryTermHeader.tsx`, `GlossaryRelatedTerms.tsx`,
  `GlossaryVisual.tsx`, `visuals.ts`, `hubModel.ts`, `definedTermJsonLd.ts` + 테스트 7
  (`GlossarySearch/GlossaryTermHeader/GlossaryIndex.test.tsx`, `hubModel/visuals/definedTermJsonLd.test.ts`).
- 수정: `app/[locale]/glossary/page.tsx`, `page.test.tsx`(갱신: 표제어·색인 순서·DefinedTermSet), `[slug]/page.tsx`,
  `tests/e2e/glossary.spec.ts`(갱신: 사전 계약 + 검색 + no-JS + DefinedTerm + 비주얼).
- `Term.tsx`, `types.ts`, `graph.ts`, `globals.css`, `lib/seo/**` 무변경.

## Tests run

- `pnpm --filter @gto-self/fishtilt typecheck` → 0.
- `pnpm vitest run --project fishtilt src/content/registry/glossary src/components/glossary src/app/[locale]/glossary`
  → 11 files / 194 tests PASS.
- 전체 fishtilt 유닛 → 217 files PASS, 1 FAIL `src/app/[locale]/about/page.test.tsx`("carries no affiliate or
  deposit link") — 경계 밖(about/footer는 다른 에이전트 작업 중), 단독 재실행 시 실패 재현 안 됨.
- `eslint` (glossary app/components/registry/content + e2e spec) → 0.
- build-lock: `rm -rf .next && pnpm build` → exit 0, `ƒ` 0. `playwright test tests/e2e/glossary.spec.ts` → 14 passed.

## Build/runtime evidence

- 스크린샷 `artifacts/3bettilt-stage3-visual-qa/wp11/`: `ko_glossary-{1440x900,390x844,320x700}-{dark,light}[-fold]`,
  `ko_glossary_{three-bet,kicker}-{1440x900,390x844}-{dark,light}` (총 22장) + `crops/`(색인·주제별 확대) +
  `baseline/`(작업 전 4장). 측정: overflowX 0 전부, h1 1개, 허브 `<main>` 1088px(grid), 상세 736px(reading).
- 육안: 허브 1440은 히어로 안 검색 필드 → 분류 칩/ㄱㄴㄷ 탭 → 연결 칩 → 주제별 2열(제목·설명 | 표제어 링크) →
  색인(탭 글자 | 표제어·Latin | 정의) 로 사전처럼 읽힘. 390/320은 단일 컬럼, 칩 행은 가로 스크롤. 상세 1440 light:
  이름 줄 `쓰리벳 · 3-Bet · 3벳 · 쓰리 벳 · 3-bet · 3bet · 삼벳` 가독, 리드 뒤 hairline, 관련 4묶음. kicker 390 dark:
  MDX 카드 예시 두 줄 정상.

## Known limitations

- `GLOSSARY_RECORDS` 순서가 J1→J2에서 g1→g9로 바뀌어 `ALL_CONTENT` 내 용어 순서(sitemap의 glossary URL 순서,
  검색 인덱스 tie 순서)가 달라짐. URL 집합·개수는 동일(HTML 수 불변).
- 족보/시작핸드/스트리트 용어는 헤더 비주얼과 MDX "예로 보면"의 `<PokerCards>`가 같은/비슷한 카드를 두 번 보여줌
  (straight·straight-flush만 다른 예). WP-S3-12가 MDX 쪽을 정리해야 함(아래 how-to).
- MDX 첫 문단은 여전히 정의를 반복함(J1/J2 관례). 리드가 정의를 맡으니 12에서 첫 문단을 "쉽게 설명하면"으로 흡수 권장.
- 검색 필터는 DOM 직접 토글(React 외부). 페이지에 검색 필드는 1개만 가능(`id` 고정 `glossary-search-input`).
- `hand-ranking`·`kicker`·`split-pot`·`nuts`·`hand`·`combo`·`hand-matrix`·`draw`·`outs`는 비주얼 없음(단일 카드로
  정직하게 표현 불가 — 원하면 12에서 MDX 예시로).

## Open issues

- `lib/seo/jsonLd.ts`: `definedTermJsonLd`를 `definedTermSetJsonLd` 옆으로 이동하고 `lib/seo/index.ts`에서 export
  (현재 `components/glossary/definedTermJsonLd.ts`). 이동 시 `[slug]/page.tsx` import 한 줄만 바꾸면 됨.
- 주석 4곳의 `registry/glossary/j1.ts`·`j2.ts` 경로 언급(`features/range/copy.ts:153`, `learn/h1.test.ts:5`,
  `blog/i1.test.ts:5`, `tests/e2e/search.spec.ts:13`) — 파일이 없어졌으니 `g*.ts`/`batches.test.ts`로 갱신 요망.
- 감사 §4 "tool(현재→제안)" 열의 `relatedTools` 교체(range→toolHandChecker 등 30여 건)와 고아 3건(c-bet/bluff/nuts)
  인바운드 공급은 레코드 관계 수정이므로 12 배치 에이전트 몫(아래 표).
- about 페이지 유닛 테스트 1건 실패(위) — footer/header 에이전트 확인 필요.

## Exact facts next agent may rely on — WP-S3-12 how-to

- **배치 파일 소유**: 한 에이전트 = 한 배치 = 파일 2개 + MDX. `src/content/registry/glossary/gN.ts`(레코드),
  `src/content/glossary/gN.ts`(MDX 맵), `content/glossary/<slug>.mdx`(본문). 다른 배치 파일은 건드리지 않음.
  | 배치 | 카테고리 | slug |
  |---|---|---|
  | g1 | game | ante, blind, big-blind, small-blind, stack, pot, heads-up, showdown |
  | g2 | game | preflop, flop, turn, river, board, community-cards |
  | g3 | betting | action, check, bet, call, raise, fold, all-in |
  | g4 | betting | open-raise, limp, three-bet, four-bet, c-bet, bluff, vpip, pfr |
  | g5 | position | position, button, cutoff, hijack, utg |
  | g6 | hand-rankings | hand-ranking, high-card, one-pair, two-pair, three-of-a-kind, straight, flush, full-house, four-of-a-kind, straight-flush |
  | g7 | hand-rankings | kicker, split-pot, nuts |
  | g8 | math | draw, outs, equity, pot-odds |
  | g9 | starting-hands | hand, suited, offsuit, pocket-pair, combo, range, hand-matrix |
- **템플릿이 데이터에서 그리는 것(MDX에 쓰지 말 것)**: 카테고리·난이도, h1(`title`), 이름 줄(표제어·`term`·`aliases`),
  한 줄 정의(`shortDefinition`), 비주얼(`visuals.ts`에 있는 slug만), 같이 알아둘 용어(`relatedConcepts`),
  더 배우기(`nextLessons`), 직접 확인하기(`relatedTools`), 이런 이야기도 있어요(`relatedArticles`), 비슷한 핸드(`relatedHands`).
- **MDX에 기대하는 절(순서)**: 첫 문단 없이 바로 `## 쉽게 설명하면` → `## 예로 보면`(카드가 필요하면 `<PokerCards>`/
  `<BoardCards>`; 헤더 비주얼과 같은 카드면 생략) → 선택 `## 헷갈리기 쉬운 부분`/`## 승부는 어떻게 가릴까요` 등.
  `#` 금지, import/export 금지, `<Term id>`는 파일당 id별 1회이며 `relatedConcepts`에 있어야 함, 숫자는 `<Fact>`로만,
  `GTO`·`무조건`·`반드시 …해야 합니다` 금지(`batches.test.ts`). `readMinutes`는 `estimateReadMinutes`와 일치해야 함
  (테스트가 값을 알려줌). `pnpm exec prettier`를 `.mdx`에 쓰지 말 것.
- **새 용어 추가 절차**(예: 브로드웨이, 커넥터/갭, 거트샷/오픈엔디드, 셋/트립스, IP/OOP):
  1. 카테고리에 맞는 `gN.ts`에 레코드 추가: `kind:'glossary'`, `id:'term-<slug>'`, `slug`, `term`(Latin),
     `aliases`(한국어 이름 포함, **사전 전체에서 유일**하고 다른 항목의 `term`/`slug`와도 겹치면 안 됨 —
     `content.test.ts`; 한 줄로 쓸 것: `copy-guards`가 `aliases:` 줄만 면제), `title`(한국어 gloss + `(Latin)`),
     `shortDefinition`, `description`, `level`, `topic`, `concepts`, 관계 필드, `status:'PUBLISHED'`, `indexable:true`,
     `readMinutes`.
  2. `categories.ts`의 `TERM_CATEGORY`에 slug→카테고리, `TERM_HEADWORD`에 slug→표제어(반드시 `term` 또는 alias 중
     하나, 유일, 가급적 한글 표기) 추가. 빠지면 `categories.test.ts`가 실패하고 상세 페이지 빌드가 throw.
  3. `content/glossary/gN.ts`에 `import X from '../../../content/glossary/<slug>.mdx'` + 맵 항목.
  4. `content/glossary/<slug>.mdx` 작성. 카드 용어면 `components/glossary/visuals.ts`에 항목 추가
     (`made-hand`는 `visuals.test.ts`가 평가기로 카테고리 검증).
  5. 셋 vs 트립스: 현재 `three-of-a-kind`의 aliases에 `셋`,`set`,`trips`,`트립스`가 있음 — 신설하려면 이 alias들을
     먼저 빼야 유일성 테스트가 통과함(레코드 alias 변경은 검색 에이전트에 보고).
- 게이트: `pnpm vitest run --project fishtilt src/content/registry/glossary src/content/content.test.ts`
  → 이후 build-lock으로 `pnpm build`(MDX 컴파일은 빌드만이 증명).
- **감사 항목 잔여(용어별)**: 영어 alias 누락 36건은 템플릿이 `term`을 이름 줄/색인에 보여줘 해소됨(데이터 추가 불필요).
  `three-of-a-kind` "셋/트립스 구분", `action`·`hand` 정의 약함(WEAK), `hand-ranking`·`hand-matrix` "예 추가",
  `relatedTools` 교체(range→toolHandChecker: 족보 11 · range→toolPotOdds: all-in/stack/bet · range→practice:
  action/check/fold · toolOuts→toolEquity: heads-up/equity · range→toolStartingHand: hand · range→없음:
  ante/blind/c-bet/bluff), 고아 인바운드(c-bet←learn/flop-turn-river, bluff←learn/poker-actions,
  nuts←blog/playing-the-board — 상대 레코드 수정은 해당 소유자에게 요청), J1 계열 29편에 "쉽게 설명하면/예로 보면" 절 신설.
- 앵커: 허브 `#cat-<categoryId>`, `#initial-<g|n|d|r|m|b|s|ng|j|ch|k|t|p|h|latin>`, `#popular`, `#categories`, `#index`.
- 검색 에이전트: alias 데이터 형태 변경 없음. 상세 HTML의 `data-glossary-term`은 이제 이름 줄의 Latin term 노드
  (예전과 같은 속성명, 값 동일), `data-glossary-alias`는 표제어·term을 제외한 alias 각 1개, 추가로
  `data-glossary-headword`·`data-glossary-definition`. 예전 `data-glossary-aliases` 래퍼는 없어짐.

## Facts next agent MUST re-check

- `hubCollectionPage.test.tsx`: 허브에 링크 섹션을 추가/이동하면 `page.tsx`의 `declared` 순서(popular → categories →
  index)를 같이 바꿔야 한다.
- 새 용어의 표제어 초성이 새 탭을 열면 `GlossaryNav`가 자동으로 링크화함(빈 탭은 비활성 라벨) — 별도 작업 없음.
- 검색 에이전트가 `SEARCH_ALIAS_GROUPS`에서 glossary alias를 참조한다면 alias를 뺄 때(셋/트립스) 그쪽 테스트 확인.
- `tests/e2e/glossary.spec.ts`는 `three-bet`·`kicker`·`flush`·`range`의 alias/표제어 문자열을 고정함 — 그 레코드를
  바꾸면 spec도 갱신.
