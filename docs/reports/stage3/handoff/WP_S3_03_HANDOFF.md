# WP-S3-03

## Objective

3BetTilt Stage 3의 공용 시각 시스템(폭·타이포·간격 토큰)과, 이후 페이지 WP(홈/블로그/핸드
스토리/배우기/용어/도구/퀴즈)가 조립할 재사용 콘텐츠 프리미티브를 `apps/fishtilt/` 안에서만
구축한다. 기존 토큰 체계와 `PageHero`/`Callout`/`FaqSection`/`RelatedContent`/`ContentThumbnail`
등은 **확장**하고 두 번째 평행 시스템은 만들지 않는다. 개별 페이지 재설계는 하지 않되, 전역
타입 스케일·폭·간격 변경이 모든 페이지에 반영되는 것은 의도된 결과다.

## Facts verified before work

- 토큰: `globals.css` `@theme` dark 기본 + `prefers-color-scheme` light + `[data-theme]` 명시
  블록 3중 구조, `theme-tokens.test.ts`가 세 블록 일치와 WCAG 대비를 재계산. 확인 결과 그대로.
- 폭 리터럴 "11개" 중 실제 클래스는 10개(search/quiz×2 `max-w-3xl`, range-quiz `max-w-4xl`,
  SiteFooter `max-w-6xl`+`max-w-sm`, PageHero/SectionHeading `max-w-[42rem]`, OutsFigure
  `[22rem]`, HomeHeroVisual `[20rem]`); 11번째는 `blog/[slug]/page.tsx:17` 주석 속 문자열.
- `next/link`는 `nodenext`에서 해석 불가(`RouteNavItem.tsx:25`)지만 `next/image.js`는 `tsc`
  통과함(프로브로 확인). 단 CJS 기본 import가 네임스페이스로 타이핑되고, 런타임에서 `.default`를
  찍으면 RSC가 "cannot dot into a client module"로 빌드 실패 → 타입 캐스트만 사용.
- MDX 허용 목록은 `allowList.ts`(프로즈 검사)와 `mdx-components.tsx`(주입 맵) 두 곳이고
  `Figure.test.tsx:89`가 두 집합의 동일성을 검사. `LEVEL_LABEL` 키는 `INTRO/BASIC/INTERMEDIATE`.
- 시작 상태: typecheck 0, unit 149 files/1842, e2e 271, build 133 HTML `ƒ` 0 — 재확인함.

## Decisions made

- 폭 토큰(D-S3-10) 확정 + 보조 토큰 2개 추가: `--container-lead 42rem`(리드/설명 문단 측정폭,
  페이지 컬럼 아님)·`--container-figure 22rem`(작은 도형의 고유 폭). 리터럴 10개 매핑:
  `max-w-3xl`×3→`reading`, `max-w-4xl`(range-quiz)→`breakout`, `max-w-6xl`(footer)→`shell`,
  `max-w-sm`(footer 문구)→`lead`, `max-w-[42rem]`×2→`lead`, `max-w-[22rem]`/`[20rem]`→`figure`.
- 타입 토큰(D-S3-11)은 역할명으로: `text-prose`(17px/1.8), `text-h2`(clamp 24→26px/1.35),
  `text-article-h1`(30→44px/1.25), `text-hero-h1`(36→56px/1.15). `SectionHeading` h2도 `text-h2`,
  h3는 `text-lg`로 올려 페이지 헤딩과 MDX 헤딩이 같은 크기가 되게 함(이전엔 20px vs 18px).
- Korean line-break는 `@utility prose-ko`(`keep-all` + `overflow-wrap:anywhere`)로 정의하고
  body가 아닌 프로즈 요소(MDX p/li/blockquote/h2-4, 리드, QuickAnswer, Quote, Callout 등)에만 적용.
- 섹션 리듬: `--spacing-section 3.5rem` 유지 + `--spacing-section-lg 5rem` 추가, `Section`이
  `py-section lg:py-section-lg`로 사용.
- Hero는 하나의 `PageHero`에 `variant('article'|'hero')`·`layout('stack'|'split')`·`meta`·`visual`·
  `facts` 슬롯을 더하고 `ArticleHero`/`EditorialHero`는 얇은 진입점(별도 파일). 기본 variant는
  `article`이라 모든 기존 h1이 30→44px fluid로 커짐(의도).
- `FaqAccordion`은 `FaqSection variant="accordion"`(native `<details>`, JS 없음). JSON-LD 경로는
  동일 배열 그대로. `FAQ`는 MDX용 이름(기본 open). MDX 한 글에서 `##` FAQ 관례와 `<FAQ>`를 함께
  쓰면 `FAQPage` 블록이 두 개가 되므로 하나만 쓰라고 문서화(콘텐츠 WP 책임).
- `KeyPoint` = `Callout variant="key"` = `ExplanationCard variant="key"`(ground-800 웰 + brand 좌측선).
- `StatStrip`(섹션)과 `StatsRow`(아티클)는 같은 컴포넌트, `StatsRow`는 alias. `ComparisonTable`은
  `DataTable`의 매핑 래퍼(테이블 구현 1개).
- `EditorialImage` 폴백은 `ContentThumbnail size="fill"`(신규)로, 부모 aspect box 안에서 SVG가
  자동 중앙 정렬. 새 raster 없음, `public/` 변경 없음.
- brand-tint 밴드(`bg-brand-950`)는 text-100/text-300/brand-500/brand-600을 감사에 추가하고
  통과. `line-500`은 light에서 2.9:1이라 brand-tint 밴드 안에는 border를 그리지 않음(`Section`,
  `CtaBand` 문서화). `Divider brand`는 `bg-brand-600`(brand-500 fill 금지 가드 준수).
- 새 컴포넌트 테스트는 `src/lib/testing/renderBothThemes.tsx`로 light/dark 마크업 동일성 +
  리터럴 색 부재를 검증(happy-dom엔 CSS가 없으므로 이것이 "양 테마 렌더" 증명). 폰트 추가 없음.

## Files changed

- 신규 48: 컴포넌트 25 + 테스트 22 + 테스트 헬퍼 1. 수정 20.
- 수정: `src/app/globals.css`, `mdx-components.tsx`, `src/content/allowList.ts`,
  `src/app/theme-tokens.test.ts`, `PageHero.tsx/.test.tsx`, `Callout.tsx`, `ExplanationCard.tsx`,
  `ContentThumbnail.tsx`, `FaqSection.tsx/.test.tsx`, `RelatedContent.tsx/.test.tsx`,
  `SectionHeading.tsx`, `SiteFooter.tsx`, `OutsFigure.tsx`, `HomeHeroVisual.tsx`,
  `[locale]/search/page.tsx`, `[locale]/practice/{hand-ranking-quiz,starting-hand-quiz,range-quiz}/page.tsx`
  (클래스 1줄씩).
- 신규 컴포넌트(`src/components/*.tsx`, 모두 server component; props 요약):
  - 리듬: `Section`(`width|tone|divider|padded|as|labelledBy`), `SplitLayout`(`ratio 7/5|5/7|6/6`,
    `primary|secondary`), `StatCard`(`value|label|note|variant`), `StatStrip`=`StatsRow`(`items|variant`),
    `Divider`(`line|brand|space`), `CtaBand`(`title|description|primary|secondary{href|null,label}`),
    `Timeline`(`steps{title,body,meta}`; `TIMELINE_RAIL` export).
  - 헤드: `ArticleHero`(`category|title|deck|meta|visual`), `EditorialHero`(`eyebrow|title|lead|visual|facts`),
    `ArticleMeta`(`level|readMinutes|category|author|date|updated|items|disclosure{badge,sentence}`).
  - 아티클: `QuickAnswer`(`label`), `TableOfContents`(`headings{id,text,level?}`), `EditorialImage`
    (`alt` 필수, `decorative|aspect|caption|sizes`, `src` 또는 `fallback{kind,topic}`), `DataTable`
    (`columns|rows|caption|rowHeader`), `ComparisonTable`(`options|rows{criterion,cells}|caption`),
    `Quote`(`cite`), `KeyPoint`(=Callout key), `NextRead`(`prev|next{href|null,title,meta}`),
    `FaqAccordion`, `FAQ`.
  - 스토리/레슨: `BoardCards`(`flop|turn|river` 표기 문자열, 개수 검증), `HandTimeline`
    (`actions: BetAction[]|street|pot`, 산술 없음), `StreetSection`(`street|title|board|actions|pot|headingAs`),
    `PositionDiagram`(`highlight|showButton|caption`, SVG `<text>` 라벨), `BettingTimeline`(`steps|label|caption`).

## Tests run

- `pnpm exec tsc -p apps/fishtilt/tsconfig.json --noEmit` → 0 에러.
- `pnpm vitest run --project fishtilt --project learn-core` → 171 files / 1943 tests PASS
  (baseline 149/1842; +22 파일, +101 테스트).
- `pnpm e2e:fishtilt`(재사용 서버) → 271 passed. `SectionHeading` 변경 후
  `responsive-a11y`+`learn`+`blog` spec 재실행 → 55 passed.
- `pnpm lint`(루트) → fishtilt 범위 0 문제(초기 1건 `react/no-array-index-key` 미정의 룰 지시문
  제거로 해결). 루트 전체 결과는 fishtilt 외 항목 없음.

## Build/runtime evidence

- `rm -rf .next && pnpm build` → 137 static pages 생성, HTML 133, `ƒ` 0.
- 스크린샷: `artifacts/3bettilt-stage3-visual-qa/wp03/` 32장(`{home,blog,learn-pot-odds,tools-range}-{1440x900,390x844}-{dark,light}[-fold].png`).
  같은 스크립트가 측정한 값: 1440에서 h1 44px/55px, `<main>` 폭 home 1248 · blog 1088 · learn 736 ·
  range 1360; 390에서 h1 30px, 모든 페이지 `scrollWidth-clientWidth = 0`(양 테마).
- 육안 확인: 홈 1440은 shell 1248px로 넓어져 "떠 보이는" 느낌 감소, hero h1 44px가 위계를 잡음.
  레슨은 736px 컬럼에 17px 본문·`keep-all` 줄바꿈이 단어 단위로 끊김. 390에서는 h1 30px, 카드·
  매트릭스 모두 넘침 없음. light 테마도 동일 레이아웃. 문제로 본 것: 블로그 허브는 여전히 카드
  벽(이 WP 범위 밖, 페이지 WP 대상). 홈의 hero 리드는 `article` variant라 18px — 홈 WP가
  `EditorialHero`로 바꾸면 20px가 됨.

## Known limitations

- 새 프리미티브는 아직 어떤 페이지도 사용하지 않는다(의도). `EditorialImage`의 `src` 경로는
  `public/og.png`로만 유닛 테스트, 원격 `remotePatterns` 미설정, `sizes` 기본값은 reading 폭.
- `PositionDiagram`은 6-max 고정. `HandTimeline`/`BettingTimeline`은 문자열만 표시(스키마 검증은
  WP-S3-06/08). brand-tint 밴드의 `line-500` 경계선은 light 2.9:1 → 문서로만 금지.
- `FAQ`(MDX)와 `##` FAQ 관례 동시 사용 시 `FAQPage` 중복 — 컴포넌트가 막지 못함.
- 폰트는 시스템 스택 유지(ruling 111). 56px hero도 Apple SD Gothic/Malgun에서 문제 없어 폰트 제안 없음.

## Open issues

- `theme-tokens.test.ts`의 새 `max-w` 가드는 주석을 제거한 뒤 검사하므로 향후 주석에 리터럴을
  적어도 통과. 코드에 `max-w-[…]`/`max-w-{sm..7xl}`가 들어오면 실패.
- `HomeHeroVisual` 미니 매트릭스 20rem→22rem(figure 토큰); 홈 스크린샷상 문제 없음.
- `SectionHeading` h2 20→24/26px로 `/tools/*`·`FaqSection` 제목도 커짐 — 도구 WP가 시각 재검수.

## Exact facts next agent may rely on

- 폭 토큰(`globals.css:250-256`, 16px 기준): `reading 46rem/736px`, `breakout 60rem/960px`,
  `grid 68rem/1088px`, `shell 78rem/1248px`, `matrix 85rem/1360px`, `lead 42rem/672px`,
  `figure 22rem/352px`. 유틸리티 `max-w-reading|breakout|grid|shell|matrix|lead|figure`.
- 간격(`:263-264`): `--spacing-section 3.5rem`, `--spacing-section-lg 5rem` → `py-section lg:py-section-lg`.
- 타입(`:205-212`): `text-prose`(1.0625rem/1.8), `text-h2`(clamp 1.5→1.625rem/1.35),
  `text-article-h1`(clamp 1.875→2.75rem/1.25), `text-hero-h1`(clamp 2.25→3.5rem/1.15).
  `@utility prose-ko`(`:524`). UI/meta는 계속 `text-sm`/`text-[0.9375rem]`.
- MDX 허용 목록(`src/content/allowList.ts:58`, `mdx-components.tsx:75`) 25개: 기존 10 +
  `BettingTimeline, BoardCards, ComparisonTable, DataTable, EditorialImage, FAQ, HandTimeline,
  KeyPoint, PositionDiagram, QuickAnswer, Quote, StatCard, StatsRow, StreetSection, Timeline`.
  페이지 전용(비허용): `Section, SplitLayout, StatStrip, Divider, CtaBand, ArticleHero,
  EditorialHero, ArticleMeta, TableOfContents, NextRead, FaqAccordion`.
- import는 `src/components/<Name>.js`. 예외: `StatsRow`→`StatStrip.js`, `BetAction`→`HandTimeline.js`.
- `PageHero`(`PageHero.tsx:34-59`): `variant 'article'(기본)|'hero'`, `layout 'stack'|'split'`
  (split은 `visual`이 있을 때만 적용, 없으면 `data-layout="stack"`), `meta|visual|facts[{label,value}]`,
  actions 슬롯은 `[data-slot="actions"]`. `<header data-variant data-layout>`.
- `RelatedContent`(`RelatedContent.tsx:29-47`): `RELATED_LABELS = ['더 배우기','직접 확인하기',
  '같이 알아둘 용어','이런 이야기도 있어요','비슷한 핸드','다음으로 읽기'] as const`,
  `type RelatedLabel`, props `label?: RelatedLabel`(모든 그룹), `labels?: Partial<Record<RelationKind, RelatedLabel>>`.
- `FaqSection`(`:75-83`) `variant 'open'(기본)|'accordion'`; `<section data-variant>`; accordion은
  `<details><summary><h3>` 구조, `[&::-webkit-details-marker]:hidden`, JSON-LD 동일.
- `ContentThumbnail size 'card'|'hero'|'fill'`(`:74`, `:121`): `fill`은 viewBox `0 0 240 50`,
  `h-full`, aspect 없음. `EditorialImage` 폴백은 `<span data-source="fallback" data-aspect role="img" aria-label=alt>` 안에 `ContentThumbnail size="fill" className="absolute inset-0 border-0"`; `src`가 있으면 `data-source="asset"`에 `next/image fill object-cover`. `decorative`면 alt="" / aria-hidden. `caption`이 있으면 `Figure`로 감쌈. aspect 클래스: `aspect-video|aspect-[3/2]|aspect-[21/9]|aspect-[4/5]|aspect-square`.
- `next/image` 사용법(`EditorialImage.tsx:54`): `import NextImageModule from 'next/image.js'` 후
  타입 캐스트만. 런타임 `.default` 접근 금지(빌드 실패 재현됨).
- 대비 감사 추가 쌍(`theme-tokens.test.ts:182-186`): `text-100/text-300/brand-500 on brand-950 ≥4.5`,
  `brand-600 on brand-950 ≥3`, `ground-900 on text-100 ≥4.5`. 모두 양 테마 통과.
- 테스트 헬퍼 `src/lib/testing/renderBothThemes.tsx`: light/dark 마크업 동일 + 리터럴 색 없음 검증.
- 스크린샷 패턴: `next start --port 3221` + Playwright `addInitScript`로 `localStorage['fishtilt-theme']` 설정.

## Facts next agent MUST re-check

- 페이지 WP가 `<main>`의 `mx-auto max-w-*`를 `Section` 스택으로 바꿀 때 `theme-tokens.test.ts`
  "gives every long-form template the SAME column" 테스트(5개 템플릿 `<main>`에 `max-w-reading`
  요구)를 함께 갱신해야 한다 — 현재 상태로는 `<main>`에서 컬럼을 떼는 순간 실패한다.
- `SectionHeading` 크기 변경이 `/tools/*`·퀴즈 페이지에서 어색하지 않은지 도구/퀴즈 WP가 스크린샷으로 재확인.
- `EditorialImage`에 실제 자산을 넣기 전 `next.config.ts` `images` 설정(remotePatterns/formats)과
  `sizes` 값을 배치 폭에 맞게 지정할 것. 정적 export로 바뀌면 `unoptimized`가 필요해진다.
- `FAQ` MDX 사용 글은 `extractFaqItems`(`lib/seo/faq.ts`)와의 이중 `FAQPage`를 seo spec으로 확인.
- 허용 목록이 25개로 늘었으므로 콘텐츠 WP는 `content.test.ts`의 "no MDX file names a component
  outside the allow-list"와 `Figure.test.tsx`의 집합 동일성 테스트가 계속 통과하는지 확인.
- 이 WP는 git 커밋을 하지 않았다. `apps/web`은 다른 세션이 수정 중이므로 fishtilt만 스테이징할 것.
