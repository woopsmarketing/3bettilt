# WP-S3-13a — Hands template + hub

## Objective

`/ko/hands/[hand]`(20) 템플릿을 "참고 시트"로 강화하고 `/ko/hands` 허브를 카드 벽에서 정적 13×13
인덱스 + 묶음 목록으로 바꾼다(계약 AY). 레지스트리 `e3`를 K1–K4 4배치로 분할해 13b 콘텐츠 에이전트
4명이 병렬로 작업할 수 있게 한다. MDX 본문은 건드리지 않는다.

## Facts verified before work

- 템플릿은 이미 PokerCards·조합/비율·13×13(`HandRangeHighlight`)·순위/상위비중/기대몫·RFI 자리를
  데이터에서 렌더. `HandRangeHighlight`는 hands 페이지 + 자기 테스트만 사용(grep) → API 변경 없음.
- `features/strength/url.ts`는 `view`/`pct`만, `features/range/url.ts`는 `hero/spot/stack`만 파싱 → 핸드
  프리셀렉트 URL 파라미터 **없음**. 도구 링크는 프리셀렉트 없이 연결.
- `theme-tokens.test.ts:390`이 `hands/[hand]/page.tsx`의 `<main className>`에 `max-w-reading`을 요구 →
  유지하고 데이터 블록만 `lg:-mx-28`(breakout 60rem)로 확장.
- `readFaqItems('hands', slug)` → `faqPageJsonLd`는 `## 자주 묻는 것` + `###` ≥2, 답에 컴포넌트 없음일
  때만 emit. 현재 20편 중 FAQPage 0(22/a5s의 "자주 묻는 것" H2는 `###` 없음).
- 스토리 레코드는 `hand.heroHand`('Qs Qh')·`showdown.villainHand` 실제 카드를 가짐 →
  `comboIndexOf`+`handClassOfCombo`로 클래스 도출 가능. s3.ts는 현재 빈 배열(다른 에이전트 작업 중).
- `RELATED_LABELS`(D-S3-16)에 "관련 가이드"가 없음.
- 시작 상태: 이 WP 파일 typecheck 0. 밖: `registry/blog/i3.test.ts:69` TS6133(다른 에이전트).

## Decisions made

- **레지스트리 분할**: `registry/hands/{k1,k2,k3,k4}.ts` + `index.ts`가 `HAND_REGISTRY_ORDER`(옛 e3 순서)로
  재정렬 → `HAND_RECORDS` 순서·id·내용 불변(`index.test.ts`가 핀). MDX 맵도 `src/content/hands/{k1..k4}.ts`
  + `index.ts`. `e3.ts`·`e3.test.ts`·`content/hands/e3.ts` 삭제(분할 지시에 따름).
- **배치 테스트**: 공통 검사는 `registry/hands/batchGate.ts`의 `describeHandBatch()`(e3.test.ts의 assertion
  전부, 약화 없음) + 각 `kN.test.ts`가 자기 핸드의 ruling-28 비교 주장 핀을 보유. `AKs>77, JJ>AKs`는
  jj(K1)·77(K2) 양쪽에 동일하게 둠. "20개 중 T9s 아래는 22뿐"은 K4에서 barrel `HAND_RECORDS`를 읽음.
  `batchGate.ts`는 `.test.` 파일이 아니라 `copy-guards`가 스캔 → 금지어 regex를 조각으로 조립.
- **템플릿 구조**(`<main max-w-reading>` 유지): 히어로 → 참고 시트 웰(카드 lg + `HandFactStrip` 4수치,
  breakout) → 리드 → §3 정의(+`HAND_ONE_IN_N` 한 줄) → §4 13×13 → §5 강도 + Callout +
  `HandComparisonTable`(h3 "이웃한 패와 나란히 보면", breakout) → §6 `HandRfiSeats`(PositionDiagram
  highlight + 지원/지원하지 않음 dl, breakout) → MDX 나머지(FAQ 포함) → ToolCTA range → `HandOnward`(관련
  가이드 · 이런 이야기도 있어요) → RelatedContent ×4(비슷한 핸드 / 직접 확인하기 / 더 배우기 / 같이 알아둘 용어).
- **비교 표**: `rankNeighbours(class, 2)` = 자기 + 순위 ±2(1/169 클램프) + s/o 쌍둥이(페어 제외), 순위
  오름차순. 숫자는 전부 `<Fact>`(HAND_RANK/COMBOS/TOP_SHARE/EQUITY_VS_RANDOM). 페이지 있는 이웃만 링크,
  없는 클래스는 평문(준비 중 배지 없음 — 약속된 페이지가 아니므로). 캡션이 "기대 몫·비기면 절반" 의미 명시.
- **온워드 도출**: 가이드 = 선언 `relatedArticles`(learn/blog 비스토리) ∪ `relatedHands`가 이 핸드를 가리키는
  blog 비스토리. 스토리 = hero 클래스 일치 → villain 일치 → 선언(양방향) 순, 중복 제거, 행마다 이유 표시,
  disclosure 문장 가시. 허브·상세 모두 honesty gate(링크 xor 준비 중) 유지.
- **허브**: `EditorialHero`(facts 3 + 액션: 순위표 도구·순위 레슨·시작 핸드 레슨 = C9 인트로 링크) →
  recessed breakout 밴드의 정적 `HandIndexMatrix`(169칸, 서버 컴포넌트, 버튼 0, 발행=링크 채움·계획=점선·
  나머지 `aria-hidden`) → `전체 핸드` 리전의 `HandHubGroups`(페어 9 / 에이스 6 / 브로드웨이·커넥터 5, 각
  강도순, divide-y 행) → `CtaBand`. SEO title `홀덤 시작 핸드 목록 — 패별 순위·조합 수·승률`, h1
  `홀덤 시작 핸드 목록`. ItemList = 묶음 렌더 순서의 발행 페이지.
- MDX 20편 **무수정**(기계적 제거 0건) — 표로 옮겨진 Fact 반복 제거는 13b 몫(아래 how-to).
- **허브 ItemList 순서 수정(오케스트레이터 지적)**: `hubCollectionPage.test.tsx`는 렌더된 href를 첫 등장
  기준으로 dedupe해 ItemList와 비교한다. 허브는 13×13 인덱스(HAND_CLASSES 격자 순)가 묶음 목록보다 먼저
  링크하므로 ItemList도 그 순서여야 한다. `hubListedHands(records)`(`handGraph.ts`)를 추가 — 발행 레코드를
  격자 index 순으로 — 하고 페이지 JSON-LD가 이를 읽음(블로그 `hubListedItems` 선례와 동일). 테스트 파일은
  수정하지 않음. `handGraph.test.ts`가 순서·발행 필터·미해결 키 후순위를 핀.

## Files changed

- 신규 컴포넌트 `src/components/hands/`: `handGraph.ts`, `HandFactStrip.tsx`, `HandComparisonTable.tsx`,
  `HandRfiSeats.tsx`, `HandOnward.tsx`, `HandIndexMatrix.tsx`, `HandHubGroups.tsx` + 테스트 6개
  (`handGraph.test.ts`, `HandComparisonTable/HandRfiSeats/HandOnward/HandIndexMatrix/HandHubGroups.test.tsx`).
- 수정: `src/app/[locale]/hands/page.tsx`, `page.test.tsx`, `hands/[hand]/page.tsx`; 신규 `hands/[hand]/faq.test.ts`.
- 레지스트리: 신규 `registry/hands/{k1,k2,k3,k4}.ts`, `{k1..k4}.test.ts`, `batchGate.ts`, `index.test.ts`;
  수정 `registry/hands/index.ts`; 삭제 `e3.ts`, `e3.test.ts`.
- MDX 맵: 신규 `src/content/hands/{k1..k4}.ts`; 수정 `index.ts`; 삭제 `e3.ts`.
- `tests/e2e/hands.spec.ts` 재작성(24 케이스). 이 문서.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/hands src/app/[locale]/hands src/components/hands
  src/copy-guards.test.ts src/app/theme-tokens.test.ts src/content/graph.test.ts` → 254 PASS / 1 FAIL
  (`copy-guards` "spells each term one way": `src/features/search/aliases.ts:37` 배팅→베팅, 내 파일 아님).
  hands 범위만: 91(레지스트리) + 컴포넌트/페이지 전부 PASS. `content.test.ts` 41 PASS.
- typecheck: 내 파일 0. 전체는 `registry/blog/i3.test.ts(69,10)` TS6133 1건(다른 에이전트).
- eslint(hands 경로 + e2e spec): 0.
- 빌드(lock): rc 0, `ƒ` 0. e2e `tests/e2e/hands.spec.ts`: **24 passed**.

## Build/runtime evidence

- 스크린샷 26장 `artifacts/3bettilt-stage3-visual-qa/wp13a/`: `ko_hands`·`ko_hands_aks`·`ko_hands_22` ×
  1440x900/390x844 × dark/light (+fold), `ko_hands` 320x700 × dark/light. 모든 샷 overflowX 0, h1 1개.
  허브 h1 56px(1440)/36px(390), 상세 h1 44px/30px, 상세 `<main>` 736px, 허브 full-bleed.
- 육안: 참고 시트 웰(카드 + 4수치) 양 테마 대비 양호; 13×13 인덱스 1440에서 fluid, 320에서 가로 스크롤
  안내문과 함께 잘림 없음; 비교 표 6열이 breakout 안에 들어감; 자리 다이어그램 2열(sm↑)/1열.

## Known limitations

- 도구 프리셀렉트 없음: `직접 확인하기`의 시작 핸드/승률 계산기는 핸드 파라미터 없이 열림.
- `HandOnward`의 "관련 가이드"는 `RELATED_LABELS` union 밖(별도 컴포넌트가 렌더). D-S3-16 확장 제안.
- `HandIndexMatrix` 스크롤 안내문은 측정 없이 `md:hidden`으로 항상 표시(정적 컴포넌트).
- 상세 §3에 `HAND_ONE_IN_N` 한 줄이 추가되어 aks/22 등 MDX의 "얼마나 자주" 단락과 현재 중복(13b 제거 대상).

## Open issues

- (범위 밖) `src/features/search/aliases.ts:37` 주석의 "배팅" → copy-guards 실패. `registry/blog/i3.test.ts:69`
  미사용 `recordOf` → typecheck 실패. `blog-small-pocket-pairs` readMinutes 3→4 불일치(i2 작업 중).
- (제안) `RelatedContent.RELATED_LABELS`에 `'관련 가이드'` 추가 → `HandOnward` 가이드 그룹을 RelatedContent
  라벨 체계로 편입 가능. (제안) `features/strength/url.ts`에 `hand` 파라미터 추가 시 `HandPage`의
  `relatedTools` 링크에 프리셀렉트 적용 가능.

## Exact facts next agent may rely on

- 템플릿이 이미 보여주는 것(MDX가 반복할 필요 없음): 조합 수·전체 대비 비율·N번에 한 번(§3), 순위·상위
  비중·무작위 상대 기대 몫(§5 + 웰), 이웃 ±2 순위와 s/o 쌍둥이의 순위/조합/상위비중/기대몫(비교 표),
  RFI 자리 + 지원/비지원 조건(§6), 관련 가이드·스토리(그래프 도출).
- 배치 소유: K1 `aa kk qq jj tt` / K2 `99 88 77 22 a5s` / K3 `aks ako aqs aqo ajs` / K4 `kqs kjs qjs jts t9s`.
  각 에이전트의 쓰기 파일: `registry/hands/kN.ts`, `registry/hands/kN.test.ts`, `content/hands/<5 mdx>`.
  `src/content/hands/kN.ts`는 슬러그 고정이라 손댈 일 없음. 게이트: `pnpm vitest run --project fishtilt
  src/content/registry/hands/kN.test.ts src/content/content.test.ts src/copy-guards.test.ts`.
- **13b how-to(핸드당)**: (1) 첫 단락 = 훅 한 줄(리드로 크게 렌더됨, 비교 문장 금지); (2) 템플릿 반복
  Fact 문단 제거 — 특히 "얼마나 자주"류(§3이 이미 말함), 이웃 순위/조합 나열(비교 표가 말함); MDX가 남길
  것은 "왜/의미/맥락" + Callout; (3) FAQ: `## 자주 묻는 것` 아래 `### 질문?` ≥2, 답은 **순수 문장**(`<Fact>`/
  `<Term>` 포함 답은 탈락 → 2개 미만이면 FAQPage 자체가 안 나옴; 안전하게 3개 작성); (4) readMinutes는
  `estimateReadMinutes`와 일치해야 하므로 본문 줄이면 kN.ts 값 갱신; indexable 임계 유지; (5) `<Term>`은
  `relatedConcepts`에 선언된 glossary만, 파일당 1회 — 브로드웨이/갭/커넥터 용어는 **아직 glossary에 없음**
  (있게 되면 `relatedConcepts` 추가 후 치환); (6) 11편 빈 `relatedArticles`는 채워도 되고(선언이 먼저 옴)
  안 채워도 역참조로 이미 노출됨; (7) `.mdx`에 prettier 금지.
- 감사 잔여 항목(§5): aa/kk `:121`·`:295` "대부분" 미출처 문장 수정(K1); 22·a5s "자주 묻는 것" H2를 `###`
  형식으로(K2); kjs/jts 브로드웨이 ad hoc 정의·`:13`/`:25` "넉넉히"(K4/K2); relatedTools 재선정(페어→
  toolStartingHand, AK/QQ→toolEquity, 커넥터→toolOuts — 단 batchGate가 `toolStartingHand`+`toolEquity`
  포함을 요구하므로 바꾸려면 그 assertion과 함께 조정·보고).
- 셀렉터: `rankNeighbours`, `rfiSeatsWith`, `guidesFor`, `storiesFeaturing`, `handHubGroups`, `classKeyOfCards`
  (`src/components/hands/handGraph.ts`). e2e 앵커: 상세 `[data-comparison=<key>]`, `[data-rfi-seats]`,
  리전 라벨 6종; 허브 `nav[aria-label="13×13 표에서 고르기"]`, `region[aria-label="전체 핸드"]`, `[data-hand-family]`.

## Facts next agent MUST re-check

- 새 스토리(`aa-loses`, `ak-flop-miss`)가 s3.ts에 들어오면 aa/aks 페이지의 "이런 이야기도 있어요"에 카드
  도출로 자동 등장 — 빌드 후 해당 페이지에서 확인(hero 카드가 정확히 AA/AKs 클래스여야 함).
- 13b가 MDX를 줄인 뒤 `content.test.ts`의 threshold/readMinutes와 `k*.test.ts`의 비교 주장 핀(예: kk.mdx의
  "AA→KK 간격" 서술이 남아 있는지)이 여전히 본문과 대응하는지.
- FAQ 추가 후 `tests/e2e/hands.spec.ts` "emits FAQPage…"와 `seo.spec.ts`의 FAQPage 카운트 재확인.
- `copy-guards`·typecheck의 범위 밖 실패 3건이 해당 에이전트 완료 후 사라지는지.
