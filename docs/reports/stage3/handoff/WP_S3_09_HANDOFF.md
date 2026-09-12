# WP-S3-09 — Learn hub + lesson template

## Objective

`/ko/learn`을 15장 동일 카드 벽에서 두 모드(A 처음부터 배우기 = 단계별 로드맵, B 특정 주제
배우기 = 7개 카테고리 브라우즈)의 정적 허브로 바꾸고, `/ko/learn/[slug]`를 "레슨 N / 15 ·
카테고리 · 레벨 · 읽기 시간" 헤더 + 학습 목표/요약 슬롯 + 커리큘럼 순서 prev/next + D-S3-16
라벨의 RelatedContent를 가진 시각 레슨 템플릿으로 바꾼다. 15편 순서는 그대로(owner 결정).
레슨 본문은 고치지 않는다(WP-S3-10).

## Facts verified before work

- 레슨 15편 order 1..15 gapless, slug 순서: holdem-basics, poker-hand-rankings, starting-hands,
  starting-hand-ranking, hand-matrix, poker-range, position, positions-6max, poker-actions,
  preflop, flop-turn-river, three-bet, equity, pot-odds, outs. 전부 PUBLISHED, `outs.nextLessons=[]`.
- `LearnRecord`(`types.ts`)는 `order`만 추가 필드. `topic` 8종(rules·hand-strength·starting-hands·
  range·position·betting·odds·equity)은 감사 카테고리 7종과 1:1이 아님(odds+equity 병합,
  poker-actions는 topic `betting`이지만 감사는 게임 시작).
- `measureContent`(threshold.ts)는 JSX 속성은 버리고 자식만 센다 → 속성으로 넣은 텍스트는
  `readMinutes`를 움직이지 않음(Figure.test.tsx:89가 이미 의존하는 성질).
- `theme-tokens.test.ts` "SAME column"은 `<main className="…">` 리터럴에 `max-w-reading`을 요구.
- `hubCollectionPage.test.tsx`(`src/lib/seo/`, 내 경계 밖)는 `/learn`을 렌더해 (a) order 9999 ·
  미분류 PLANNED 픽스처가 "준비 중"으로 한 번 보이고, (b) 페이지의 레슨 링크 순서 == ItemList
  순서를 검사.
- e2e `learn.spec.ts`는 region '학습 순서' 안의 `li`마다 링크 1개 XOR 준비 중 1개를 요구.
- 시작 상태(내 파일 기준): typecheck 0, unit 171 files / 1943 tests(WP03 종료 시점). 동시 작업 중인
  Blog 에이전트 때문에 실제 시작 시 typecheck는 blog 파일에서만 오류.

## Decisions made

- **카테고리 7종 확정**(감사 §3 그대로): 게임 시작(1,9,11) · 카드와 족보(2) · 시작 패(3,4) ·
  레인지(5,6) · 포지션(7,8) · 베팅(10,12) · 확률과 수학(13,14,15). `poker-actions`는 topic이
  `betting`이지만 "다섯 행동"은 게임 진행 메커닉이므로 감사 판단을 따름(모듈 헤더에 기록).
  매핑은 `LessonRecord`가 아니라 **slug 키의 내 모듈** `registry/learn/categories.ts`에 둠
  (`types.ts`는 다른 WP 소유).
- **로드맵 단계 3개**(순서 불변, 연속 구간): 1단계 "판의 규칙과 내 패"(1–5) · 2단계 "레인지,
  자리, 행동"(6–10) · 3단계 "카드가 열린 뒤, 그리고 확률"(11–15). 단계는 시각적 진행감을 위한
  구간이며 카테고리와 독립. 테스트가 1..N 타일링(빈틈·겹침 0)을 검사.
- **허브 모드 전환 = 같은 페이지 앵커**(`#roadmap`, `#topics`, `#topic-<category>`). 클라이언트
  JS 0, 두 모드 모두 항상 HTML에 존재. 카테고리 칩 행은 모바일에서 가로 스크롤(자체 컨테이너),
  `sm`부터 wrap. JSON-LD ItemList는 이전과 동일(published만, 로드맵 순서).
- 로드맵 스텝의 카테고리는 **텍스트**(링크 아님) → 기존 e2e "row당 링크 정확히 1개" 규칙 유지.
  레슨 헤더의 카테고리는 링크(`/ko/learn#topic-<id>`).
- **학습 목표/요약은 MDX 컴포넌트** `<LessonGoals items={[…]} />` · `<LessonSummary items={[…]} />`
  (문자열 배열 props). 이유: 속성이라 `readMinutes` 불변(레지스트리 수정 없이 추가 가능), 문자열이라
  숫자를 넣을 수 없음(숫자는 본문의 `<Fact>`). 배치는 저자 결정이라 MDX. `LessonSummary`는
  `KeyPoint`(Callout key) 재사용, 새 표면 없음. 헤딩 요소를 만들지 않음(아웃라인은 `##`가 소유).
- **파일럿 레슨 = `holdem-basics`**(레슨 1). 목표 4줄 · 요약 4줄, 모두 기존 본문 문장 재진술,
  숫자 없음. `readMinutes` 5 그대로(content.test 통과).
- 선행 레슨(`prerequisites`)은 RelatedContent 카드 대신 헤더 안 한 줄 "먼저 읽으면 좋아요: a · b"
  (D-S3-16 라벨 union에 선행 개념이 없고, 카드가 제목 아래를 무겁게 만들었음).
- RelatedContent 라벨: nextLessons→더 배우기 · relatedTools→직접 확인하기 · relatedConcepts→같이
  알아둘 용어 · relatedHands→비슷한 핸드 · relatedArticles→이런 이야기도 있어요. prev/next는
  `NextRead`("다음으로 읽기")로 **order±1**(편집 관계 `nextLessons`와 다름: poker-range의 next는
  position(7), nextLessons는 position·three-bet).
- `outs`(마지막): next 없음 → `CtaBand` "로드맵의 마지막 레슨입니다 / 다음 레슨은 없습니다" +
  퀴즈(`/ko/practice`) · 주제별로 다시 보기(`/ko/learn#topics`). 가짜 다음 레슨 없음.
- 리딩 컬럼 유지(`<main max-w-reading>`), **figure 브레이크아웃**: `article`에
  `[&>figure]:lg:-mx-28 [&>[data-breakout]]:lg:-mx-28` → 46rem+14rem = breakout 60rem(D-S3-10).
  theme-tokens 테스트 수정 불필요.
- 허브가 미분류/단계 밖 레코드를 받으면(테스트 픽스처) 죽지 않고 로드맵 끝 "단계 미정" 섹션에
  카테고리 없이 표시(누락 0). 실제 레슨은 `categories.test.ts`가 그런 상태를 금지.

## Files changed

- 신규 registry: `src/content/registry/learn/categories.ts`(+`.test.ts`, 11 tests).
- 신규 MDX 컴포넌트: `src/components/LessonGoals.tsx`, `LessonSummary.tsx`(+ 테스트 2).
- 신규 `src/components/learn/`: `LessonHeader.tsx`, `LessonNav.tsx`, `LearnModeNav.tsx`,
  `LearnRoadmap.tsx`, `LearnTopics.tsx`(+ 테스트 5).
- 수정: `src/app/[locale]/learn/page.tsx`(허브 재작성), `page.test.tsx`(재작성 — 픽스처 mock 제거,
  두 모드·앵커·ItemList 검사로 교체), `src/app/[locale]/learn/[slug]/page.tsx`(템플릿),
  `src/content/allowList.ts`, `mdx-components.tsx`(+LessonGoals/LessonSummary, 허용 목록 27개),
  `content/learn/holdem-basics.mdx`(파일럿), `tests/e2e/learn.spec.ts`(라벨 변경 + 7 테스트 추가,
  허브 링크 쿼리를 로드맵 region으로 스코프).
- h1/h2/h3/published 레코드, `types.ts`, `graph.ts`, `registry/index.ts`, 공용 컴포넌트: 무수정.

## Tests run

- `pnpm exec tsc -p apps/fishtilt/tsconfig.json --noEmit` → 내 파일 0 오류. (blog 에이전트 파일
  `registry/blog/i4.ts`, `seo/jsonLd.test.ts`, `seo/metadata.test.ts`, `blog/page.test.tsx`에서
  `contentType` 관련 오류 — 경계 밖, 진행 중.)
- 타깃: `vitest run --project fishtilt src/components/learn src/content/registry/learn
  "src/app/[locale]/learn" src/components/Lesson* content.test.ts theme-tokens.test.ts copy-guards
  Figure.test` → 내 범위 전부 PASS(12 files / 241 tests; theme-tokens 1 실패는 blog `[slug]` 페이지
  `<main>` — 경계 밖).
- 전체 `vitest run --project fishtilt --project learn-core`(최종, 다른 WP 동시 작업 중) → 194 files /
  2113 tests, 실패 12 — 전부 내 경계 밖: `hubCollectionPage.test.tsx` ×3(/learn·/blog·/tools 링크
  중복; /learn 건은 Open issues 1), `toolPageJsonLd.test.tsx` ×5(도구 WP), `copy-guards` ×2
  (`components/tools/PotOddsGuide.tsx`, `StartingHandGuide.tsx`), `theme-tokens` ×2(`tools/page.tsx`
  `bg-brand-500`, blog `[slug]` `<main>`). WP-09 파일을 지목한 실패 0.
- eslint(내 파일 전부) → 0.

## Build/runtime evidence

- `rm -rf .next && pnpm build`(build-lock) → 성공, `ƒ` 0(모두 ○/●).
- `playwright test tests/e2e/learn.spec.ts` → 1차 18/19(허브 링크 쿼리 strict-mode 중복 → 스코프
  수정), 최종(재빌드 후, build-lock) **19/19 passed**; 빌드 137 static pages, HTML 133, `ƒ` 0.
  주의: 공유 lock을 다른 WP가 20분+ 점유해 재빌드 대기가 길었음(lock 자체는 정상 동작).
- 스크린샷 `artifacts/3bettilt-stage3-visual-qa/wp09/` 26장: `ko_learn`, `ko_learn_holdem-basics`,
  `ko_learn_outs` × 1440x900/390x844 × dark/light(+fold), `ko_learn` 320x700 × dark/light.
  shoot.mjs 측정: h1 1개, 1440 h1 44px / 390·320 30px, `<main>` 허브 1088 · 레슨 736, overflowX 0
  전부. 육안: 허브 1440은 hero → A/B 모드 카드 → facts(15편·7가지·약 62분) → 3단계 split 로드맵
  (번호 레일) → 칩 행 + 7개 카테고리 split. 390/320은 단일 컬럼, 칩 행 가로 스크롤, 겹침 없음.
  레슨 헤더는 "레슨 1 / 15 [게임 시작]" + 15칸 진행 레일 + h1 + 메타. `outs` 끝에 CtaBand(라이트는
  brand-950 핑크 틴트). 목표 박스(panel-700 + 체크)와 요약(KeyPoint) 양 테마 정상.

## Known limitations

- 허브 높이 1440에서 4554px(두 모드 모두 인라인). 카테고리 섹션 우측 목록이 성긴 편 — 카드 벽
  대신 리스트로 둔 의도적 선택.
- `LessonGoals/Summary`는 문자열만 받음(`<Fact>` 불가). 숫자가 필요한 요약은 본문 `<Fact>`로.
- 로드맵 단계 이름은 편집 카피(포커 사실 아님). 카테고리 설명에도 수치 없음.
- TableOfContents는 레슨에 넣지 않음(헤딩 추출 경로 없음, 범위 밖).

## Open issues

1. **`src/lib/seo/hubCollectionPage.test.tsx` (blog 에이전트 경계) 1건 실패** — "lists exactly the
   links the page renders for it": 두 모드 허브는 레슨 링크를 2번(로드맵+주제) 렌더하므로 30 ≠ 15.
   테스트 의도("선언된 행마다 링크가 있고 선언 순서 == 렌더 순서")는 유지되므로 첫 등장 기준
   dedupe가 정확한 수정. 정확한 변경(약 150행):
   `const onPage = [...new Set(renderedHrefs(container).filter((href) => wanted.has(href)))];`
   (D-S3-19 블로그 허브 섹션+앵커도 같은 문제를 만나면 한 번에 해결됨.)
2. `theme-tokens.test.ts` SAME column 실패는 `blog/[slug]/page.tsx`의 `<main>`(blog 에이전트).
3. typecheck 오류 4파일 모두 blog `contentType`(blog 에이전트 진행 중).

## Exact facts next agent may rely on

- `registry/learn/categories.ts` exports: `LEARN_CATEGORIES`(7, id: game-start|hand-rankings|
  starting-hands|range|position|betting|math), `LESSON_CATEGORY`(slug→id), `categoryOfLesson`
  (throw)/`categoryOfLessonOrNull`, `lessonsOfCategory(id)`, `LEARN_STAGES`(3, `first/last`),
  `lessonsOfStage`, `stageOfLesson(OrNull)`, `LESSON_COUNT`(15), `neighboursOf(lesson)`(order±1),
  `LEARN_HUB_ANCHORS = { roadmap:'roadmap', topics:'topics', category:(id)=>`topic-${id}` }`.
- 허브 DOM: `<section id="roadmap" aria-label="학습 순서">` 안 `li[data-order]` 15개(단계별 `<ol start>`),
  `<section id="topics" aria-label="주제별로 배우기">` 안 `nav[aria-label="주제 고르기"]` 칩 7개 +
  `section#topic-<id>[aria-labelledby]` 7개, 각 `li[data-order]`. `nav[aria-label="배우는 방법"]`
  링크 2개(`a[data-mode=roadmap|topics]`).
- 레슨 DOM: `header[data-lesson=header]` > "레슨 N / 15" · `a[data-lesson=category]`(href
  `/ko/learn#topic-<id>`) · `[data-lesson=progress]`(aria-hidden, span×15 `data-state`) · h1 ·
  ArticleMeta · `p[data-lesson=prerequisites]`(있을 때만). 하단 `div[data-lesson=nav]` >
  `nav[aria-label="다음으로 읽기"]` (`a[data-direction=prev|next]`) + 마지막 레슨만 CtaBand.
- MDX 허용 목록 27개(`allowList.ts`, `mdx-components.tsx`): 기존 25 + `LessonGoals`, `LessonSummary`.
  `Figure.test.tsx` 집합 동일성 통과.
- **WP-S3-10 how-to**(레슨 4–5편/에이전트):
  1. 목표: 리드 문단 바로 아래
     `<LessonGoals items={['…할 수 있다', '…를 안다']} />`(3–5줄, 숫자 금지, 문장 끝 "안다/구분한다").
  2. 요약: `## 사람들이 자주 헷갈리는 부분` 직전 `<LessonSummary items={['문장.', '문장.']} />`(3–5줄).
     둘 다 속성이므로 `readMinutes` 불변 — 레지스트리 수정 없음. 본문 문장을 추가/삭제하면
     `content.test.ts`가 `readMinutes` 재계산값을 요구하니 그때만 레코드 수정.
  3. 감사 §3 "필수 시각" 컴포넌트(모두 MDX 허용, 숫자는 `<Fact>`로만):
     - holdem-basics 판 흐름 6단계 → `<HandTimeline street="…" pot="…" actions={[{position:'BTN',
       action:'레이즈', amount:'2.5BB', note?, hero?:true}]} />`(BetAction 전부 문자열)
       또는 단계 나열이면 `<Timeline steps={[{title, body, meta}]} aria-label="…" />`.
     - poker-actions 한 스트리트 액션 순서 / three-bet 1→3→9BB / preflop 림프 vs 오픈 →
       `<BettingTimeline steps={[…]} label="…" caption="…" />`(문자열만, 산술 없음).
     - position · positions-6max 6석 원형 → `<PositionDiagram highlight="BTN" showButton caption="…" />`.
     - flop-turn-river 스트리트 묶음 → `<BoardCards flop="As Kd 7c" turn="2h" river="9s" showLabels />`
       (표기 문자열, 개수 검증됨) 또는 `<StreetSection street="FLOP" title="…" board={{flop:'…'}}
       actions={[…]} pot="…" headingAs="h3" />`.
     - hand-rankings 빈도 / starting-hand-ranking 1위·8위·169위 / equity 대결 →
       `<StatsRow items={[{label:'…', value:<Fact …/>, note?}]} />`, 비교표는
       `<ComparisonTable options={[{key,label,highlight?}]} rows={[{criterion, cells:{optionKey: …}}]}
       caption="…" />`(cells는 option key로 된 record),
       일반 표는 `<DataTable columns={[{key,label,numeric?}]} rows={[{key?, cells:{columnKey: …}}]}
       caption="…" rowHeader?="columnKey" />`. 셀 값은 ReactNode라 `<Fact>` 가능.
     - 레인지 표(RangeEmbed 상당) → 기존 `<RangeMatrixMini … />`(hero/spot/stack 조건 표시 유지).
     - 큰 그림은 `<Figure caption="…">…</Figure>`로 감싸면 lg에서 자동 브레이크아웃(960px);
       다른 블록을 넓히려면 루트에 `data-breakout` 속성.
  4. `<FAQ>`와 `##` FAQ 관례를 한 글에서 같이 쓰지 말 것(FAQPage 중복). 새 `##` 섹션 추가 시
     `sectionCount`·`readMinutes` 검사 확인.

## Facts next agent MUST re-check

- Open issue 1의 dedupe가 들어가기 전까지 `hubCollectionPage.test.tsx` 1건 실패 — orchestrator가
  적용 후 `vitest run --project fishtilt src/lib/seo/hubCollectionPage.test.tsx` 재실행.
- 홈 WP(05)가 learn 카테고리를 집계하려면 `LEARN_CATEGORIES`+`lessonsOfCategory`를 쓰고 href는
  `routeById('learn').path + '#' + LEARN_HUB_ANCHORS.category(id)`로 만들 것(리터럴 금지).
- 레슨 순서를 바꾸면 `categories.test.ts`의 `CURRICULUM_ORDER` 리터럴과 `LEARN_STAGES` 구간을 함께
  바꿔야 한다(의도된 잠금).
- 새 레슨(16번째)을 추가하면 `LESSON_CATEGORY`에 slug를 넣고 마지막 단계 `last`를 늘려야 테스트가
  통과한다(안 넣으면 categories.test 실패, 허브는 "단계 미정"으로 렌더).
- `LessonGoals/Summary` 문자열 안에 따옴표(`'`)를 쓰면 MDX 속성 파싱이 깨진다 — 큰따옴표나
  백틱 없이 쓰거나 문장을 바꿀 것. 파일럿은 따옴표 없음.
