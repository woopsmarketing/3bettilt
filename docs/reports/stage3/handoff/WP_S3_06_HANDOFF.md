# WP-S3-06 — Blog hub + article template

## Objective

블로그를 "Learn의 부록"(2열 카드 벽 + 동일 골격 글)에서 두 엔진(검색 가이드 · 핸드 스토리)을 가진
에디토리얼 허브로 바꾸는 **아키텍처와 템플릿**. 콘텐츠 타입 5종(D-S3-19), `seoTitle`, 핸드 스토리 typed
데이터 모델 + evaluator 검증(D-S3-20), 매거진 허브 `/ko/blog`, 아티클 템플릿 2종(검색 가이드 / 핸드
스토리). 기존 20편의 제목·본문은 건드리지 않음(WP-07). 스토리 콘텐츠는 0편(WP-08).

## Facts verified before work

- 시작 상태: typecheck 0, fishtilt+learn-core 171 files / 1943 tests, `BlogRecord`는 `ContentRecord`에
  필드 추가 없음. 허브는 `LinkCard` 2열 그리드(topic별 그룹), 아티클은 `<main class="max-w-reading">`.
- 감사(§2)의 타입 배정: 검색 가이드 11 · 데이터와 확률 6 · 포커 개념·문화 3 · 초보자 실수 0 · 핸드 스토리 0.
  B12 `same-pair-who-wins`는 타입 미지정(B13에 MERGE 예정) → B13과 같은 검색 가이드로 배정.
- MDX는 vitest에서 렌더 불가(ruling 37). 컴파일된 MDX는 `props.components`를 provider 맵 위에 병합
  (`mdx-components.tsx`의 `useMDXComponents`는 인자를 무시하지만 컴파일 출력이 `...props.components`를
  마지막에 spread) → 템플릿에서 `h2`/`StreetSection`을 렌더 시점에 덮어쓸 수 있음. **빌드로 확인함**(아래).
- `strategy-core`: `bestFiveOf(cards)`→`{value: HandValue, cards}`, `compareHands`, `handClassOfCombo(comboIndexOf(a,b)).key`.
  Korean 족보명/읽기는 `features/tools/handRank.ts`의 `HAND_CATEGORY_LABEL`·`handReading`(barrel 미노출, 직접 import).
- `Money.fromBB(x, 'exact')`는 milliBB로 표현 불가한 값에 throw.

## Decisions made

- **타입 모델**: `BlogRecord.contentType: BlogContentType`(필수, 5종 union `BLOG_CONTENT_TYPES` 허브 순서로
  선언), `seoTitle?: string`, `hand?: HandStoryHand`. `HandStoryRecord extends BlogRecord`
  (`contentType:'hand-story'` + `hand` 필수). 스토리는 **별도 레코드가 아니라 블로그 레코드** — 허브·sitemap·검색·
  graph에 이중 등록 없음. `isHandStory()`가 유일한 narrowing.
- **라벨은 graph.ts**: `BLOG_CONTENT_TYPE_LABEL`(핸드 스토리 · 검색 가이드 · 초보자 실수 · 데이터와 확률 ·
  포커 개념·문화), `BLOG_CONTENT_TYPE_ANCHOR`(hand-stories · search-guides · beginner-mistakes ·
  data-probability · concepts-culture). 카테고리 라우트 없음.
- **돈**: 모든 금액 `MilliBB`(`bb(2.5)` 헬퍼 = `Money.fromBB(x,'exact')`). 액션 `amount`는 "그 스트리트에서
  그 자리가 넣은 총액(raise to)". **팟은 저작하지 않고 합산**(`resolve.ts`): 블라인드(SB 0.5/BB 1)는 모델이 포스트.
  체크/콜/레이즈/올인 합법성, 스트리트 마감, 유효 스택 초과, 폴드 후 액션, 언급 없는 BB 옵션까지 검사.
- **쇼다운은 계산값만 표시**: 저자는 `showdown.villainHand`와 `winner`(주장)만 쓰고, 템플릿은 evaluator가
  계산한 족보·읽기·승자·팟을 그림. `winner`가 계산과 다르면 validator 실패. 폴드로 끝나는 핸드는
  `showdown: null` + 마지막 액션 FOLD(팟은 마지막 남은 자리로).
- **서사는 MDX**: 스토리 MDX는 `<StreetSection street="preflop|flop|turn|river|showdown">서사</StreetSection>`만
  쓰고 board/actions/pot을 쓰지 않는다. 템플릿이 레코드 바인딩 `StreetSection`을 `components`로 주입해
  보드·타임라인·팟을 채움. `stories/mdx.ts`가 태그 순서/금지 prop/`흥미로운 지점`·`## 무엇을 배울 수 있나`를 정적 검사.
- **퀵 앤서는 MDX**(`<QuickAnswer>` 허용 목록에 이미 있음): 답에 숫자가 들어가므로 `<Fact>`가 필요 → 레지스트리
  문자열 필드로 만들지 않음. FAQ 블록 이중 렌더 없음(JSON-LD만 조건부).
- **허브 편집 슬롯**: featured = 첫 발행 스토리, 없으면 첫 발행 검색 가이드(라벨 "이 글부터"). 스토리 0편이면
  스토리 섹션 미렌더 + 내비 "준비 중"(링크 없음) + "준비 중인 시리즈" 밴드. 가짜 스토리 0.
- **컬럼**: 아티클 `<main>`은 `Section` 스택. 읽기 컬럼은 `breakout`(960) 밴드 안 3트랙 그리드
  `1fr | min(var(--container-reading),100%) | 1fr` 가운데 트랙(736). `figure`, `div:has(>table)`,
  `[data-breakout]`, 히어로 비주얼은 `col-span-full`. `theme-tokens.test.ts`의 SAME-column 검사는 blog 항목을
  `BlogArticleShell.tsx`가 `min(var(--container-reading),100%)`를 쓰는지로 대체(리터럴 금지 유지).
- **TOC**: MDX 소스의 `##`에서 추출(`articleSource.ts`, node:fs), `h2` 오버라이드가 같은 `headingId(text)`로 id 부여.
  3개 이상일 때만 렌더. 한 글 안 h2 중복은 테스트로 금지.
- **JSON-LD**: `Article`에 `articleSection`(콘텐츠 타입 라벨) 추가(blog만). 저자·날짜 없음 유지.
  `<title>`/OG는 `seoTitleOf(record)`(seoTitle ?? title), H1은 `title`.
- 관련 콘텐츠 라벨(D-S3-16): nextLessons→더 배우기, relatedTools→직접 확인하기, relatedConcepts→같이 알아둘 용어,
  relatedArticles→이런 이야기도 있어요, relatedHands→비슷한 핸드, NextRead→다음으로 읽기(같은 타입 내 레지스트리 순서).

## Files changed

- 수정 13: `src/content/types.ts`, `src/content/graph.ts`, `src/content/registry/blog/{index,i1,i2,i3,i4}.ts`
  (contentType 한 줄씩), `src/content/blog/index.ts`(S1-S3 MDX 맵 wiring), `src/app/[locale]/blog/page.tsx`,
  `src/app/[locale]/blog/[slug]/page.tsx`, `src/lib/seo/{jsonLd,metadata}.ts`, `src/app/theme-tokens.test.ts`,
  `src/lib/seo/hubCollectionPage.test.tsx`(첫 등장 순서로 dedupe, 오케스트레이터 지시), `tests/e2e/blog.spec.ts`,
  테스트 2(`blog/page.test.tsx`, `blog/[slug]/page.test.tsx`).
- 경계 밖 최소 수정 2(보고): `src/lib/seo/jsonLd.test.ts`, `src/lib/seo/metadata.test.ts` — 픽스처에
  `contentType: 'search-guide'` 한 줄(필수 필드 추가로 tsc 실패).
- 신규 19: `src/content/stories/{types,resolve,validate,mdx}.ts`, `stories/validate.test.ts`,
  `stories/testing/fixtureStory.ts`, `src/content/registry/blog/stories/{index,s1,s2,s3}.ts` + `stories.test.ts`,
  `src/content/blog/{s1,s2,s3}.ts`, `src/components/blog/{articleHeadings,articleSource,blogHubModel}.ts`,
  `BlogArticleShell.tsx`, `BlogArticleFooter.tsx`, `GuideArticleLayout.tsx`, `StoryArticleLayout.tsx`,
  `BlogHubSections.tsx`, 테스트 2(`blogHubModel.test.ts`, `articleHeadings.test.ts`).

## Tests run

- 루트 `pnpm typecheck` → 0 (fishtilt 단독 tsc도 0).
- `pnpm exec eslint` (이 WP의 모든 파일) → 0.
- `pnpm vitest run --project fishtilt --project learn-core` → **183 files / 2042 tests: 2040 PASS, 2 FAIL**
  (baseline 171/1943; +12 files, +99 tests). 당시 실패 2건은 `hubCollectionPage.test.tsx`의 `/learn`·`/blog` —
  이후 dedupe 수정으로 둘 다 PASS.
- 최종 범위 재실행(components/blog, app/blog, lib/seo, theme-tokens, content 전체): **733 tests: 725 PASS, 8 FAIL** —
  실패 8건 전부 `/tools` (WP-14 진행 중, `tools/page.tsx`의 `bg-brand-500`, `/tools` ItemList 순서, 도구 6개
  WebApplication name ≠ title). 블로그·러닝·스토리 관련 실패 0.
- e2e `tests/e2e/blog.spec.ts` (build-lock 경유) → 아래 Build/runtime evidence.

## Build/runtime evidence

- build-lock 포그라운드 실행(최종 소스): `pnpm build` → **BUILD_EXIT=0**, "Compiled successfully", `ƒ` 라우트 0,
  `.next/server/app` HTML 133개. `playwright test tests/e2e/blog.spec.ts` → **E2E_EXIT=0, 28 passed**.
  로그: `artifacts/3bettilt-stage3-visual-qa/wp06/{build.log,e2e.log}`.
- 스크린샷 25장 + `shots.jsonl`(13행): `ko_blog`, `ko_blog_aks-vs-ako`(검색 가이드), `ko_blog_why-called-3bet`
  (개념·문화) × 1440x900/390x844 × dark/light(±fold), `ko_blog-320x700-dark`. 모든 샷 h1=1, overflowX=0.
  h1 56px(허브)/44px(글) @1440, 36/30px @390. 높이: 허브 4772/7725/7875(320), aks 4897/6168, 3bet 4839/5710.
- 눈으로 본 결과와 수정: (1) 390px에서 H1이 음절 단위로 잘림("검색 가이 / 드", "차이일 / 까?") →
  `HERO_TITLE_BREAK`(`[&_h1]:break-keep [&_h1]:wrap-anywhere`, `BlogArticleShell.tsx`)를 허브 EditorialHero와 두
  ArticleHero 호출부에 부여, 재촬영으로 확인. (2) 카테고리 nav가 390px에서 gap-x-8로 3줄 → `gap-x-5 sm:gap-x-8`.
  (3) 나머지는 양호: 카드 벽 없음, 16:9 fallback 일관, 본문 폭 ≤737px, 관련 콘텐츠 반쪽 카드(항목 1개일 때)는
  WP-03 `RelatedContent` 프리미티브 동작이라 그대로 둠.
- 컴파일된 MDX가 `props.components`를 provider 뒤에 merge하는 것은 `@mdx-js/mdx` compile 출력으로 확인
  (`{..._provideComponents(), ...props.components}`) → 스토리의 record-bound `<StreetSection>` 오버라이드 유효.

## Known limitations

- 스토리 0편: 허브의 스토리 섹션·featured 스토리는 픽스처로만 검증(유닛 렌더). 실제 스토리 MDX 렌더(컴파일된 MDX가
  `components` 오버라이드를 받는지)는 빌드 출력에서 확인했으나 스토리 페이지 자체는 아직 프리렌더된 적 없음 →
  WP-08 첫 스토리 빌드 때 재확인 필수.
- `resolve.ts`는 헤즈업 쇼다운만 지원(쇼다운 시 hero·villain만 남아야 함), 사이드팟 없음, 레이크 없음, 6-max 고정,
  블라인드 0.5/1 고정, 앤티 없음. 스트리트 안 액션 순서(자리 순)는 검증하지 않음.
- 초보자 실수 타입도 0편 → 스토리와 같이 "준비 중" 처리.
- 카테고리/스토리 이미지 자산 없음 → 모든 슬롯 `EditorialImage` 폴백(ContentThumbnail).

## Open issues

- `hubCollectionPage.test.tsx`는 이제 첫 등장 순서로 dedupe(오케스트레이터 지시). 이에 맞춰 블로그 `ItemList`는
  `hubListedItems`가 **첫 렌더 순서**(featured → 이어서 읽기 → 섹션)로 발행하고, e2e는 "전체 글 인덱스와 같은
  멤버 + 페이지 첫 링크 순서"를 검사. `/learn`·`/blog` PASS; **`/tools`는 여전히 FAIL**(선언 순서 ≠ 렌더 순서,
  WP-14 `tools/page.tsx` 소관). `theme-tokens` `bg-brand-500` 실패와 `toolPageJsonLd` 6건도 WP-14 소관.
- H1 `keep-all`은 블로그 호출부에서만 부여함. 같은 잘림이 `PageHero`를 쓰는 다른 페이지에도 있을 수 있음 →
  `src/components/PageHero.tsx:96`의 h1에 `break-keep wrap-anywhere`를 넣으면 전 사이트 해결(공용 파일이라 미수정).
- `src/content/blog/index.ts`는 경계 목록에 명시되지 않았지만 WP-08 병렬 작업을 위해 S1-S3 MDX 맵 wiring이 필요해 수정함.

## Exact facts next agent may rely on

### WP-07 (기존 20편 리라이트) — 글당 설정할 레지스트리 필드

- `title`(H1) · `seoTitle?`(탭/OG 제목, 다르면 설정) · `description`(덱; ArticleHero의 deck과 meta description 겸용)
  · `contentType`(감사 배정값 이미 입력됨; 바꾸면 허브 섹션도 이동) · `readMinutes`(measured; `content.test.ts`가 검증).
- MDX: 첫 요소로 `<QuickAnswer>`(숫자는 `<Fact>`), `##` 3개 이상이면 TOC 자동, `##` 제목은 한 글 안에서 유일해야
  함(`articleHeadings.test.ts`), FAQ는 `## 사람들이 자주 헷갈리는 부분` + `### 질문` 관례(`faq.ts`)만 사용(`<FAQ>`와 동시 사용 금지).
  `<ToolCTA>` 본문 1개 유지(i*.test.ts). 표/`<Figure>`/`DataTable`(`div:has(>table)`)은 자동으로 960px로 breakout.
- 관련 그룹은 레코드 관계에서 자동: relatedConcepts/relatedTools/relatedHands/nextLessons/relatedArticles.
  마지막 CtaBand는 `relatedTools[0]`. prev/next는 같은 contentType의 발행 글 레지스트리 순서.

### WP-08 (스토리 4–6편) — 스토리 1편 추가 절차 (자기 배치 파일만 수정)

1. `src/content/registry/blog/stories/sN.ts`의 `HAND_STORY_SN_RECORDS`에 `HandStoryRecord` 추가:
   `kind:'blog', contentType:'hand-story', id:'blog-<slug>', slug, title(H1 문장), seoTitle('홀덤 핸드 리뷰: … '),
description(덱), level, topic, concepts, relatedConcepts(용어 id), relatedTools(route id), relatedHands, nextLessons,
relatedArticles(다른 스토리/글 id), status:'PUBLISHED', indexable, readMinutes(measured),
hand:{ stakes:'온라인 6인 캐시 게임', gameType:'NLHE', tableSize:6, effectiveStack: bb(100), heroPosition, villainPosition,
heroHand:'Qs Qh', preflopActions:[{position, kind:'FOLD'|'CHECK'|'CALL'|'BET'|'RAISE'|'ALL_IN', amount?: bb(x), note?}],
flop:'2s 2h 7d', flopActions, turn:'Kc', turnActions, river:'4s', riverActions, showdown:{villainHand:'7c 2c', winner:'villain'} | null,
disclosure: HAND_STORY_DISCLOSURE }`. `bb`·`HAND_STORY_DISCLOSURE`는 `src/content/stories/types.ts`.
   예시 전체: `src/content/stories/testing/fixtureStory.ts`(FIXTURE_STORY).
2. `content/blog/<slug>.mdx` 작성: 리드 문단 → `<StreetSection street="preflop">…</StreetSection>` → flop → turn → river →
   `<StreetSection street="showdown">`(쇼다운 있을 때만) → `<KeyPoint title="흥미로운 지점">` 또는 `## 흥미로운 지점` →
   `## 무엇을 배울 수 있나`. StreetSection에 board/actions/pot/title prop 금지. 예시: `FIXTURE_STORY_MDX`.
3. `src/content/blog/sN.ts`의 `BLOG_SN_MDX`에 `'<slug>': import` 추가.
4. 게이트: `pnpm vitest run --project fishtilt src/content/registry/blog/stories src/content` — validator(카드 중복,
   보드, 산술, 스택, 마감, disclosure, 승자=evaluator), MDX 형태, readMinutes/threshold, 관계 id.
   실패 메시지는 `<id>: <문장>` 형식으로 무엇을 고칠지 말해 줌.
5. 첫 발행 스토리는 자동으로 허브 featured + 스토리 섹션 + 내비 링크가 됨.

### 공통

- `blogRecords()`, `blogOfType(type)`, `publishedStories()`, `blogNeighbours(record)`, `seoTitleOf(record)`,
  `isHandStory(record)` — `src/content/graph.ts`.
- 허브 모델: `buildBlogHub(articles)` → `{nav, featured, secondary, sections[{type,layout,articles}], comingSoon, index}`
  (`src/components/blog/blogHubModel.ts`). 섹션 레이아웃: stories(3:2 이미지 2열) · rows(2열 분할 행) ·
  data(번호 스트립, recessed) · titles(대형 타이포, breakout).
- e2e 계약: 허브 `region[aria-label="전체 글"]`의 모든 `li`는 링크 xor 준비 중; `nav[aria-label="콘텐츠 타입"]` 5항목;
  `[data-featured]` 1개; `[data-section=<type>]`; 아티클 `main[data-content-type]`, `article > figure`가 breakout,
  `nav[aria-label="목차"]`, `aside[aria-label="여기까지 읽었다면"]`(스토리는 "이 핸드 다음에").

## Facts next agent MUST re-check

- WP-08의 첫 스토리 빌드: `next build`가 스토리 페이지를 프리렌더하고 `<StreetSection>`이 보드/타임라인을 실제로
  그리는지(`components` 오버라이드가 컴파일된 MDX에 적용되는지) 브라우저로 확인. 유닛 테스트는 mock MDX로만 증명.
- `hubCollectionPage.test.tsx` 수정 전까지 전체 유닛 스위트는 2 FAIL(위). 수정 후 재실행.
- WP-07이 `seoTitle`을 넣으면 `tests/e2e/blog.spec.ts`의 "sets the search title" 케이스(현재 seoTitle 없음을
  가정)를 갱신할 것.
- `content.test.ts`의 readMinutes/threshold 검사는 스토리의 레코드 데이터(보드·액션)를 세지 않고 MDX 프로즈만 잰다 —
  스토리 서사가 짧으면 `indexable: true`가 임계 미달로 거부될 수 있음.
