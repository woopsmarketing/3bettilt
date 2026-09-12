# WP-S3-00 — BASELINE (3BetTilt Stage 3 시작 전 측정)

측정일 2026-09-09. 측정 에이전트: Fable High (fresh context). **구현·수정 0건** — 이 WP는
측정만 한다. 모든 숫자는 소스/빌드 산출물에서 직접 얻었고, 명령과 함께 적었다. 과거
보고서의 값과 다른 곳은 둘 다 적고 보고서 값을 `stale`로 표시했다.

원시 로그: `<scratchpad>/logs/` (`INDEX.txt` 참조).
`<scratchpad>` = `/private/tmp/claude-501/-Users-woops-projects-GTO-SELF/c9838946-1594-4e38-b9ef-d025effa10fa/scratchpad`

---

## 1. Git

| 항목 | 값 | 명령 |
| --- | --- | --- |
| branch | `main` | `git branch --show-current` |
| HEAD | `7c3a4e232e0595bf48ed727fb061cf55c7f25fb6` | `git rev-parse HEAD` |
| tracked 변경 (M/D) | **65** (deleted 1: `.claude/scheduled_tasks.lock`) | `git status --porcelain \| grep -vc '^??'` |
| untracked 항목 | **153** | `git status --porcelain \| grep -c '^??'` |
| `apps/fishtilt` tracked 파일 | **0** — 디렉토리 전체가 untracked | `git ls-files apps/fishtilt \| wc -l` |
| `packages/learn-core` tracked 파일 | **0** — 전체 untracked | `git ls-files packages/learn-core \| wc -l` |
| `packages/strategy-core` | 78 파일 tracked (읽기 전용 엔진, 커밋됨) | `git ls-files packages/strategy-core \| wc -l` |
| `docs/FISHTILT_*.md`, `docs/reports/FISHTILT_*.md` | 전부 untracked | `git ls-files docs \| grep -i fishtilt` → 0 |

**함의.** `apps/fishtilt`, `packages/learn-core`, FISHTILT 문서 전부가 git에 한 번도 커밋된 적이
없다. 따라서 `git diff`/`git stash`/`git checkout`으로는 Stage 3 변경을 되돌리거나 비교할 수
**없다.** 중단 복구와 WP 간 경계 검증은 §2의 파일시스템 스냅샷 `diff -rq`에 의존한다.
untracked 153건 중 fishtilt 외의 것(`apps/web/**` 40여 건, `packages/adaptive-core/`,
`packages/db/drizzle/0006~0010`, HANDSON/HARDENING 보고서 등)은 다른 워크스트림 소유다.

`.gitignore`(루트)가 제외하는 것 중 이 앱에 해당하는 것: `.next/`, `node_modules/`,
`test-results/`, `playwright-report/`, `.env`/`.env.*`(`.env.example` 제외), `*.tsbuildinfo`,
`prompt2`/`prompt3`. `prompt`(마스터 계약)는 **tracked이며 미수정**이라 `git status`에 나타나지
않는다(`git ls-files prompt` → 있음, `git check-ignore` → 미제외).

## 2. Snapshot (Stage 3 이전 기준본)

```
rsync -a --exclude node_modules --exclude .next --exclude test-results --exclude playwright-report \
  apps/fishtilt/ <scratchpad>/stage3-baseline/apps/fishtilt/
rsync -a --exclude node_modules packages/learn-core/ <scratchpad>/stage3-baseline/packages/learn-core/
```

| 경로 | 파일 수 |
| --- | --- |
| `<scratchpad>/stage3-baseline/apps/fishtilt/` | **464** (원본 동일 제외 조건으로 464 — 일치) |
| `<scratchpad>/stage3-baseline/packages/learn-core/` | **29** |
| 합계 | **493**, 3.9 MB |

이후 WP는 `diff -rq <scratchpad>/stage3-baseline/apps/fishtilt apps/fishtilt`로 경계를 검증한다.
스냅샷은 세션 scratchpad에 있으므로 세션이 바뀌면 사라질 수 있다 — 마스터가 보존 여부를 결정할 것.

**알려진 무해 드리프트 1건:** 측정 종료 시점의 `diff -rq`는 `next-env.d.ts` 하나만 보고한다.
스냅샷은 dev 서버가 남긴 `./.next/dev/types/*` import를, 현재 파일은 `pnpm build`가 재생성한
`./.next/types/*` import를 담고 있다(Next가 빌드마다 덮어쓰는 생성 파일, untracked, 소스 편집
아님). 이후 WP의 경계 검증에서 이 파일은 제외하고 읽을 것.

## 3. App structure

`apps/fishtilt` = `@gto-self/fishtilt`, Next **16.3.3 (Turbopack)**, dev 3220 / e2e 3221
(`apps/fishtilt/package.json`, `playwright.config.ts:26`). `next.config.ts`: `@next/mdx`,
`pageExtensions ['ts','tsx','mdx']`, `transpilePackages` 4개(shared, poker-core, strategy-core,
learn-core), `typedRoutes:false`, i18n 설정 **없음**.

`src/` 트리(depth 3, `find src -maxdepth 3 -type d`): `app/{about,blog/[slug],glossary/[slug],
hands/[hand],learn/[slug],practice/{hand-ranking-quiz,range-quiz,starting-hand-quiz},search,
tools/{equity,hand-checker,outs,pot-odds,range,starting-hand}}`, `components/`(flat, 56 컴포넌트
+ 테스트), `content/{blog,glossary,hands,learn,registry/{blog,glossary,hands,learn}}`,
`features/{content,quiz,range,search,strength,tools}`, `lib/seo/`.

라우트 파일(`find src/app -name page.tsx -o -name route.ts …`): `page.tsx` **22**개(정적 18 +
동적 템플릿 4: `blog/[slug]`, `glossary/[slug]`, `hands/[hand]`, `learn/[slug]`), `sitemap.ts`,
`robots.ts`, `layout.tsx`, `not-found.tsx`, `error.tsx`, `global-error.tsx`, `icon.svg`,
`apple-icon.png`. `route.ts` 0개, `opengraph-image` 0개, `[locale]` 세그먼트 0개.

라우트 헬퍼: `src/lib/routes.ts` — `ROUTES` 배열(18 entry, `id/path/label/section/available`),
`routeById()`, `PRIMARY_NAV_IDS`(헤더 6개), `FOOTER_NAV_IDS = [...PRIMARY, 'hands','about']`
(`routes.ts:142`). `routes.test.ts`가 `available:true`를 파일시스템과 대조한다. **path는 전부
`/learn` 같은 루트 상대 literal이며 locale 개념이 없다.**

콘텐츠 그래프: `src/content/types.ts`(`ContentRecord` + `LearnRecord/GlossaryRecord/BlogRecord/
HandRecord`, `types.ts:78-160`), `src/content/registry/{learn/h1-h3,published; blog/i1-i4;
glossary/j1-j2; hands/e3}.ts` → `registry/index.ts`의 `ALL_CONTENT`; `src/content/graph.ts`
(`LEARN_ROADMAP` = order 정렬, `graph.ts:69-72`; 관계 순회); `facts.ts`(`<Fact>` 도메인 수치),
`threshold.ts`(본문 길이 게이트), `allowList.ts`(MDX 컴포넌트 allow-list). MDX 본문은
`content/<kind>/<slug>.mdx`에 있고 frontmatter 없이(제목·설명은 registry 레코드가 소유)
`@next/mdx` 로더로 페이지에서 import된다(`src/content/mdx.d.ts:21`).

## 4. Content counts

`ls content/<kind>/*.mdx | wc -l`: **learn 15 · blog 20 · glossary 58 · hands 20 = 113**
(`FISHTILT_STAGE2_MASTER_SUMMARY.md` §2의 113과 일치). `content/` 안의 비-MDX 파일은
`content/hands/node_modules/.vite/vitest/.../results.json` 1개(vitest 캐시 잔재, 무해하나
이상 위치 — 다음 WP가 참고).

**Blog 20편** (slug | title, `src/content/registry/blog/i1-i4.ts`의 `title:`):

| slug | title | | slug | title |
| --- | --- | --- | --- | --- |
| a2345-wheel | A2345는 스트레이트인가? | | playing-the-board | 보드만으로 족보가 완성되면? |
| aks-vs-ako | AKs와 AKo는 무슨 차이일까? | | pot-odds-quick | 팟오즈 쉽게 계산하기 |
| btn-why-wide | BTN에서는 왜 더 많은 패를 사용할까? | | qq-vs-ak | QQ와 AK 중 뭐가 강할까? |
| flush-vs-straight | 플러시와 스트레이트 중 뭐가 강할까? | | same-pair-who-wins | 같은 원페어면 누가 이길까? |
| full-house-vs-flush | 풀하우스와 플러시 중 뭐가 강할까? | | small-pocket-pairs | 작은 포켓페어는 좋은 패일까? |
| how-often-aa | AA는 얼마나 자주 받을까? | | what-is-kicker | kicker란? |
| is-ak-good | AK는 좋은 패인가? | | why-72o-is-weak | 72o가 약한 이유 |
| next-best-after-aa | AA 다음으로 좋은 패는? | | why-blinds-exist | Big Blind는 왜 돈을 먼저 내나? |
| outs-nine | 아웃츠 9장은 무슨 뜻일까? | | why-called-3bet | 왜 3-Bet이라고 부를까? |
| why-suited-matters | suited hand가 좋은 이유 | | why-use-range | Range를 보는 이유 |

관찰: 20편 전부 "X는 무엇/왜/뭐가 강할까" 형태의 **학습형 Q&A 제목**이다. 계약 AF(Blog의
새 역할 = hand story / editorial)와의 거리가 곧 WP-S3-07의 작업량이다.

**Learn 15편, 커리큘럼 순서** (`order` 필드, `registry/learn/h1.ts:22…h3.ts:112`,
`published.ts:15`): 1 holdem-basics · 2 hand-rankings(mdx `poker-hand-rankings`) ·
3 starting-hands · 4 starting-hand-ranking · 5 hand-matrix · 6 poker-range · 7 position ·
8 positions-6max · 9 poker-actions · 10 preflop · 11 flop-turn-river · 12 three-bet ·
13 equity · 14 pot-odds · 15 outs. (`graph.ts:72`가 `order`로 정렬해 `/learn`을 렌더.)

**Glossary 58**: action all-in ante bet big-blind blind bluff board button c-bet call check
combo community-cards cutoff draw equity flop flush fold four-bet four-of-a-kind full-house
hand-matrix hand-ranking hand heads-up high-card hijack kicker limp nuts offsuit one-pair
open-raise outs pfr pocket-pair position pot-odds pot preflop raise range river showdown
small-blind split-pot stack straight-flush straight suited three-bet three-of-a-kind turn
two-pair utg vpip.

**Hands 20**: 22 77 88 99 a5s aa ajs ako aks aqo aqs jj jts kjs kk kqs qjs qq t9s tt.

## 5. Locale architecture (현재)

- `/ko` prefix **없음.** `grep -rn '/ko' src content` → **0**. `[locale]` 세그먼트 0, i18n
  config 0, locale switcher 0.
- `lang`은 `src/app/layout.tsx:71`의 `<html lang="ko">` 하드코딩 하나. 빌드 HTML 133개 중
  132개가 `lang="ko"` (예외 `_global-error.html`, Next 합성 라우트).
- hreflang: 소스 0, 빌드 HTML `rel="alternate"` **0**, sitemap `xhtml:link` 0.
- `og:locale`은 `SITE_LOCALE = 'ko_KR'` (`src/lib/seo/site.ts:34`) → `metadata.ts:87`.
- **SITE_URL**: `src/lib/seo/site.ts:66-67` `SITE_ORIGIN = normaliseOrigin(process.env.
  NEXT_PUBLIC_SITE_URL) ?? 'https://fishtilt.example'` (`PLACEHOLDER_ORIGIN`, `site.ts:36`).
  `SITE_ORIGIN_IS_PLACEHOLDER`(`site.ts:70`)는 `src/app/sitemap.ts:32-38`에서 소비되어 빌드
  시 `console.warn`을 낸다 — 이번 빌드 로그에 2회 출력됨(독립 리뷰 N8은 **해결된 상태**).
  `.env*` 파일은 `apps/fishtilt`에 없다.
- canonical/og:url: `metadata.ts:75-95` `pageMetadata()`가 `absoluteUrl(canonicalPath)`로
  `alternates.canonical`(`:81`)과 `openGraph.url`을 만들고 `layout.tsx:29`가
  `metadataBase = new URL(SITE_ORIGIN)`. 즉 **origin 한 곳(`site.ts`) + path literal**
  구조이며, `/ko` 도입 시 path 생성층(routes.ts, graph의 href, breadcrumbs, sitemapEntries,
  canonical)이 전부 locale-aware해져야 한다.

## 6. Metadata & schema architecture

| 대상 | 위치 |
| --- | --- |
| `SITE_NAME = 'FishTilt'`, `OG_IMAGE_ALT = 'FishTilt'` | `src/lib/seo/site.ts:31`, `:90` |
| title template `${title} · ${SITE_NAME}` | `src/lib/seo/metadata.ts:42-46` `formatTitle()` |
| 페이지 metadata 빌더 (canonical, OG, Twitter) | `metadata.ts:75` `pageMetadata()`, `:109` `contentMetadata()`; OG `:83-91`(siteName, locale, images), twitter `:92` |
| 루트 fallback metadata + `metadataBase` | `src/app/layout.tsx:28-37` |
| 404 metadata (canonical/OG/Twitter null) | `src/app/not-found.tsx:40,54-56` |
| JSON-LD 빌더 | `src/lib/seo/jsonLd.ts` — Organization `:61`, WebSite `:77`, BreadcrumbList `:94`, Article `:115`, FAQPage `:139`, WebApplication `:168`, ItemList `:212`, DefinedTermSet `:246`, CollectionPage `:293`, `serializeJsonLd` `:317`; 렌더 `JsonLdScript.tsx:26` |
| breadcrumbs / FAQ 추출 / 정책 / sitemap | `breadcrumbs.ts:44,89`, `faq.ts:81`, `policy.ts:50`(`SECTION_INDEXABLE`, search만 false), `sitemapEntries.ts:42,57` |
| OG 이미지 | `public/og.png` 1200×630 정적 1장, `site.ts:87-89`; `opengraph-image` 생성기 **없음**(`site.ts` 주석: `next/og`가 nodenext 해석 실패). kind×topic별 OG 없음 |

빌드 산출물 실측(`grep` over `.next/server/app/**/*.html`): ld+json `<script>` **206**,
top-level 타입 BreadcrumbList 130 · Article 35 · FAQPage 27(Question 115) · CollectionPage
(WebPage 41 중) · WebApplication 6 · WebSite/Organization 각 1(중첩 포함 7/78) · DefinedTerm
58. `<title>` 정확히 1개: 133/133. `<main>` 1개: 132/133(`_global-error` 0). canonical 131.
noindex 2(`_not-found`, `search`).

## 7. Public brand references

명령: `grep -r{l,o,n}i fishtilt apps/fishtilt/{src,content,public,tests} --include='*.ts'
--include='*.tsx' --include='*.mdx' --include='*.json' --include='*.css' --include='*.svg'`

| 척도 | 값 |
| --- | --- |
| 파일 수 | **176** (src 147 · content 13 · tests 16 · public 0) |
| 매치 수(대소문자 무시) | **332** — `FishTilt` 93 · `FISHTILT` 170 · `fishtilt` 69 |
| 그중 테스트 파일 | src `*.test.*` 52 파일/105 매치 + `tests/` 16 파일/38 매치 |
| MDX 본문 | 12 파일/15 매치(전부 glossary: hijack·c-bet·heads-up·limp·ante·pfr·four-bet·utg·call·three-bet·vpip·cutoff) — **사용자 노출 문장** |

분류(비-테스트, 비-주석 코드 라인만; 목록은 `grep -rn "FishTilt\|FISHTILT\|fishtilt" src
content … | grep -v test | grep -v 주석`):

- **사용자 노출 카피** — `SiteHeader.tsx:116` 워드마크 `FISHTILT`; `SiteFooter.tsx:33,35`;
  `app/page.tsx:255,286,324`(FAQ "FishTilt는 무료인가요?", "FishTilt 소개 보기",
  aria-label "FishTilt 한 줄 소개"); `app/about/page.tsx:30,40,82`; `app/search/page.tsx:38,49`;
  `app/global-error.tsx:105` `<title>`; `registry/glossary/j1.ts:613,636`(VPIP/PFR description);
  glossary MDX 15문장; `icon.svg:2` `<title>FishTilt</title>`.
- **메타데이터** — `site.ts:31` `SITE_NAME`(→ 모든 `<title>`, og:site_name, JSON-LD
  Organization/WebSite name, CollectionPage.isPartOf), `site.ts:90` `OG_IMAGE_ALT`,
  `public/og.png`(워드마크가 그려진 래스터 — 재제작 필요), `apple-icon.png`.
- **테스트 assertion** — `tests/e2e/home.spec.ts:36,42,54…` (`toHaveTitle(/FishTilt/)`, 링크
  name `'FISHTILT'`, region name `'FishTilt 한 줄 소개'`), `tests/e2e/seo.spec.ts:216`
  (`toContain('FishTilt')`), `SiteHeader.test.tsx`, `SiteFooter.test.tsx`, `site.test.ts`,
  `page.test.tsx` 등 52+16 파일.
- **내부 식별자(사용자 비노출, 계약 N상 rename 불필요)** — `THEME_STORAGE_KEY = 'fishtilt-theme'`
  (`ThemeToggle.tsx:48`, `layout.tsx:59` inline script 중복), `id="fishtilt-mobile-nav"`
  (`SiteHeader.tsx:159,171`), `SEARCH_INPUT_ID 'fishtilt-search-input'`(`SearchClient.tsx:41`),
  `faqSource.ts:47`의 경로 `apps/fishtilt/content`, `sitemap.ts:37` 경고 프리픽스 `[fishtilt]`,
  패키지명 `@gto-self/fishtilt`/`@gto-self/learn-core` description, 주석·문서 참조 다수.

빌드 HTML(133개): `FishTilt|FISHTILT` 포함 파일 **132**, `FishTilt` **1,815**회, `FISHTILT`
**396**회, `fishtilt.example` **2,474**회(131 파일), 소문자 포함 전체 5,083회. 계약 DA/DC의
목표(0)까지의 거리다.

## 8. Design system inventory

- **components** (`src/components`, 56개 + 각 `.test.tsx`): 셸 `SiteHeader SiteFooter
  ThemeToggle RouteNavItem Breadcrumbs`; 프리미티브 `LinkCard Panel PageHero SectionHeading
  Callout ExplanationCard FaqSection RelatedContent Term Fact`; 카드/도해 `PokerCard PokerCards
  Figure ContentThumbnail OutsFigure PotOddsFigure HomeHeroVisual HomeRangePreview
  HomeCallToAction PositionLegend`; 레인지 `RangeExplorer RangeMatrix RangeMatrixMini
  RangeCompareMatrix RangeFilters RangeSummary RangeShareLink SelectedHandPanel
  HandRangeHighlight StartingHandExplorer StartingHandPanel`; 도구 `EquityCalculator
  PotOddsCalculator OutsCalculator HandChecker CardPicker ToolAnswer ToolCTA ToolLessonLinks`;
  퀴즈 `Quiz QuizQuestionCard QuizResult QuizVisual QuizRelatedLinks RangeQuiz MiniQuiz`;
  검색 `SearchClient SearchResultList SearchEmptyState`.
- **features** (`src/features`, 순수 로직): `content/topic`, `quiz/{engine,hub,rng,
  handRanking/range/startingHandQuestions}`, `range/{copy,notation,resolve,url}`,
  `search/{buildIndex,match,normalize,url,copy}`, `strength/{copy,url,viewModel}`,
  `tools/{amount,draws,equity,equityWorker(+Protocol),faq,format,handRank,hub,outsView,
  potOddsUrl,related,requiredOuts,copy}`.
- **토큰**: 단일 파일 `src/app/globals.css` — `@theme`(다크 기본, `:116-247`), 라이트
  `:307-339`(prefers-color-scheme), 명시 다크 `:345-`(`[data-theme]`). 색 역할 `ground-900/800,
  panel-700/600, line-500, text-100/300/500, brand-500/600/hover/950, suit-red, act-raise/
  call/fold, ink-on-action/brand, scrim-900`. 폰트 `--font-sans/--font-mono`(`:169-172`), 사이즈
  스케일은 Tailwind 기본(**body에 font-size 선언 없음** → 16px), line-height 토큰
  `--text-base--line-height: 1.8`(`:186`), xs 1.6 · sm 1.75 · lg 1.65 · xl 1.5 · 2xl 1.4 ·
  3xl 1.32 · 4xl 1.22. radius 4단, `--spacing-section: 3.5rem`, `--shadow-raised` 1개.
- **컨테이너 폭** (`globals.css:226-229`): `--container-reading 42rem(672px)`, `grid 56rem
  (896px)`, `shell 72rem(1152px)`, `matrix 85rem(1360px)`. 실측 `<main>`: 홈 `max-w-shell`,
  6개 허브 `max-w-grid`, about/learn·blog·glossary·hands 상세 `max-w-reading`. 토큰 외 literal
  11곳: `practice/range-quiz max-w-4xl`, `hand-ranking-quiz`/`starting-hand-quiz`/`search
  max-w-3xl`, `SiteFooter max-w-6xl`, `PageHero`/`SectionHeading`/`blog/[slug]` 주석 `max-w-[42rem]`,
  `OutsFigure max-w-[22rem]`, `HomeHeroVisual max-w-[20rem]`.
- **테마 토글**: `layout.tsx:59` no-flash inline script가 `localStorage['fishtilt-theme']`가
  명시 값일 때만 `data-theme` 스탬프; 미설정 시 `prefers-color-scheme`. `ThemeToggle.tsx`
  (client, `matchMedia` `:61,104`). provider/context 없음.
- **이미지/도해 컴포넌트**: `Figure`(figure+figcaption, 서피스 없음), `ContentThumbnail`
  (topic×kind **DOM/SVG 생성**, `TOPIC_ART`/`KIND_ACCENT` `:322-323`), `OutsFigure`,
  `PotOddsFigure`, `HomeHeroVisual`. `EditorialImage` 류 **없음**. `next/image` import **0**,
  `<img` **1**(위치는 §13).
- `"use client"` 파일 **32** (`grep -rl "use client" src | wc -l`): 도구 6 + 퀴즈 3 + search +
  error/global-error 페이지, 컴포넌트 20.

## 9. Build

`cd apps/fishtilt && rm -rf .next && pnpm build` (로그 `logs/build.log`):
exit **0**, wall **7 s**(Turbopack compile 1.9 s + TS 2.7 s + 137 페이지 613 ms), prerendered
HTML **133**(`find .next/server/app -name '*.html' | wc -l`; 사이트 131 + `_not-found` +
`_global-error`), 라우트 표기 `○ Static` 32 + `● SSG` 4 템플릿, **`ƒ` 0**. 경고는
`[fishtilt] NEXT_PUBLIC_SITE_URL is not set` 2회뿐(의도된 경고). Stage 2 요약의 133과 일치.

## 10. Tests

| 게이트 | 명령 | 결과 |
| --- | --- | --- |
| unit | `pnpm vitest run --project fishtilt --project learn-core` | **148 files / 1820 tests passed**, 0 fail, 0 skip, 14.3 s (exit 0) |
| unit split | `pnpm vitest run --project learn-core` | learn-core **11 files / 114 tests** → fishtilt = 137 files / 1706 tests |
| typecheck | `pnpm --filter @gto-self/fishtilt typecheck` | exit 0 (출력 없음, 1 s) |
| lint | `pnpm lint` (root `eslint .`) | exit 0, 문제 0 (5 s; `eslint.config.js:457`에 fishtilt 전용 블록, ignores에 fishtilt 없음 — `apps/fishtilt/src/lib/seo/site.ts` 등 타깃 실행도 0) |

이전 보고서 대조: `FISHTILT_STAGE2_MASTER_SUMMARY.md §2` "fishtilt 1706 (137 파일)"은 fishtilt
단독 값으로 **일치**; `FISHTILT_STATE.md`의 "fishtilt+learn-core 1805"는 `stale`(현재 1820,
WP-9 시정 후 +15). apps/web 쪽 lint 문제는 이번 실행에서 0 — 다른 세션이 편집 중이므로
재현 불가한 값일 수 있다.

## 11. E2E

`pnpm e2e:fishtilt` (webServer가 `pnpm build && next start --port 3221` 실행, chromium 로컬
설치본 1234 사용, 추가 설치 불필요): **267 passed / 0 failed / 0 skipped**, 15.9 s, exit 0.
spec 파일 23 + `helpers.ts`, `test()` 선언 207(파라미터화로 267 케이스). 요약 보고서 267과 일치.
실행 후 3221 포트 해제 확인.

## 12. Sitemap / robots

`pnpm exec next start --port 3221` → `curl`(저장본 `logs/sitemap.xml`, `logs/robots.txt`):
sitemap `<loc>` **130**, host 전부 `https://fishtilt.example`(placeholder), hreflang 0.
robots: `User-Agent: * / Allow: / / Sitemap: https://fishtilt.example/sitemap.xml`. `/search`는
`noindex, follow`이며 robots에서 Disallow하지 않음(의도). 미존재 경로 → HTTP 404. 서버 종료
확인. `sitemap.ts:30`, `robots.ts:28` 모두 `dynamic = 'force-static'`.

## 13. Images

`public/`: **`og.png` 7,003 B 한 개**. 앱 전체 래스터(`find -iname '*.png|jpg|webp|avif|gif'`,
node_modules/.next 제외): `public/og.png`, `src/app/apple-icon.png` 1,542 B — **2개**. SVG:
`src/app/icon.svg` 606 B 1개. `next/image` **0**, 프로덕션 코드의 `<img` **0** (`grep -rn '<img'
src --include='*.tsx'`의 유일한 hit은 `ContentThumbnail.test.tsx:102`의 `not.toContain('<img')`
assertion). 모든 썸네일·히어로·도해는 DOM/SVG 생성. 계약 W~AC(AI editorial image)의
출발점은 사실상 **0 자산**이다.

## 14. Existing reports

`docs/reports/FISHTILT_*.md` 26개(`wc -l` | 첫 제목):
00_AUDIT_AND_PLAN 630 (Phase 0 감사·계획) · BLOG_TOPIC_BACKLOG 360 (다음 블로그 주제 20선) ·
INDEPENDENT_REVIEW 440 (독립 릴리스 리뷰, B1·B2 블로커 + N1~N8) · MVP_FINAL 162 ·
QA_01_ORCHESTRATOR_REVIEW 240 · REMAINDER_00_BASELINE 240 · STAGE2_MASTER_SUMMARY 273 ·
WP0_SCAFFOLD 126 · WP1_AUDIT_AND_KEYWORD_MAP 634 · WP2_DESIGN_SYSTEM 614 · WP3_HOME_REDESIGN 461 ·
WP4_TOOL_UX 376 · WP5_BLOG_AND_IMAGE_SYSTEM 437 · WP6_VISUAL_ASSET_PLAN 1007 ·
WP7A_SEO_AND_SCHEMA 451 · WP7B_SEO_CONTENT 317 · WP8_FINAL_QA 239 · WP9_REVIEW_REMEDIATION 206 ·
WPA_DESIGN_SYSTEM 119 · WPB_DOMAIN_MATH 94 · WPC_RANGE_MATRIX 97 · WPD_RANGE_EXPLORER 115 ·
WPF1_TOOLS_POTODDS_OUTS 283 · WPG_CONTENT_SYSTEM 185 · WP_R_STRENGTH_DATASET 398.
`docs/FISHTILT_STATE.md` 2,504줄(Stage 2까지의 상태·rulings). `docs/reports/stage3/`는 이
파일이 첫 항목이다(측정 시점에 미존재 확인).

독립 리뷰 항목의 현재 상태(소스 grep으로 확인): B1 404/500 — `not-found.tsx:40,82`,
`error.tsx:45` 한국어로 존재(해결); N1 `가장 널리 쓰이는` 0, N2 `가장 많이 받는 질문` 0,
N3 `실제로 여는 패` 0(해결); N5 skip link `layout.tsx:96` 존재(해결); N8 경고 존재(해결);
**미해결**: `RANGE_PROVENANCE_SENTENCE`의 "다른 두 자료가 말하는 범위와도 맞습니다"
(`src/features/range/copy.ts:234`) — 계약 M이 제거를 명령한 문장이다(WP-S3-14).

## 15. Known design problems (계약 Q, 실측 첨부)

| # | 계약 Q 문구 | 실측 |
| --- | --- | --- |
| 1 | card wall | 빌드 HTML의 `LinkCard` 앵커(클래스 `block h-full rounded-lg border border-line-500 bg-panel-700 …`): `/blog` **20**, `/learn` 15, `/glossary` **58**, `/hands` 20, `/tools` 12, `/` **47**(그중 33 동일 클래스) |
| 2 | 모든 페이지 시각 문법 유사 | 허브 6개 `<main>` 클래스가 **문자 그대로 동일**(`mx-auto max-w-grid px-6 py-14 sm:py-20`); 카드 클래스 문자열도 hub 간 동일(p-4/p-5 차이만) |
| 3 | 큰 데스크톱에서 content가 작게 떠 보임 | 허브 본문 폭 `--container-grid` 56rem = **896px**, 상세 `reading` 42rem = **672px**, 홈 `shell` 72rem = 1152px; 1440px 이상 뷰포트에선 좌우 여백이 본문보다 넓다 |
| 4 | typography 작음 | body font-size 미선언(브라우저 16px), 본문 `--text-base--line-height 1.8`; 카드 설명 `text-sm`(14px), meta `text-xs`(12px), 리드 문단만 `text-xl` |
| 5 | Blog가 Learn과 비슷 | `/blog`와 `/learn` 모두 `LinkCard`+`ContentThumbnail`, 같은 `grid gap-4 sm:grid-cols-2`, 같은 `<main>`; 상세 템플릿도 `max-w-reading` + 동일 `<article>` 클래스(`blog/[slug]:116` vs `learn/[slug]:109`) |
| 6 | Glossary 2열 카드 벽 | `grid gap-3 sm:grid-cols-2` 안에 **58** 카드, `<li>` 65 |
| 7 | Tool 아래 교육 콘텐츠 부족 | 도구 페이지 구조는 히어로→도구→FAQ→레슨 링크(`ToolLessonLinks`)로, 본문 설명 섹션 없음(WP-4 보고) |
| 8 | Quiz 빈 공간 | 퀴즈 3페이지 `<main>` 폭이 토큰 밖 `max-w-3xl/4xl`, `QuizQuestionCard` 선택지 `min-h-11`; 정량은 스크린샷 없이 측정 불가(WP-S3-17 시각 QA에서) |
| 9 | visual emotion 부족 | 래스터 자산 2개(아이콘·OG), 사진/일러스트 0, 모든 비주얼이 선 그림 DOM |
| 10 | editorial character 부족 | Blog 20편 전부 Q&A형 제목, 저자·날짜·스토리 필드 없음(`types.ts` BlogRecord `:149`) |

## 16. Scripts (루트 `package.json` 실측)

존재: `pnpm typecheck`(`pnpm -r --parallel typecheck`), `pnpm lint`(`eslint .`), `pnpm test`
(`vitest run`, 전 프로젝트), `pnpm build:fishtilt`, `pnpm e2e:fishtilt`, `pnpm build`
(**apps/web 전용** — fishtilt 아님), `pnpm verify`(typecheck+test+lint+lint:licences+**web build**;
fishtilt build 미포함), `pnpm dev:fishtilt`. 앱 로컬: `dev/build/start/typecheck/test/e2e/
e2e:install`. 주의: `pnpm verify`는 fishtilt e2e·build를 돌리지 않으므로 Stage 3 최종 게이트는
`build:fishtilt` + `e2e:fishtilt`를 별도로 포함해야 한다.

---

## 다음 WP(WP-S3-01)가 알아야 할 5가지

1. 브랜드는 `site.ts:31` 한 곳이 title/OG/JSON-LD를 지배하지만, 워드마크(`SiteHeader:116`,
   `SiteFooter:33`), about/home/search 카피, glossary MDX 15문장, `og.png` 래스터, `icon.svg`
   `<title>`, e2e/unit assertion 68파일은 **각각 손봐야** 한다(총 176파일/332매치).
2. `/ko`는 어디에도 없다. path는 `routes.ts`·registry href·breadcrumbs·sitemapEntries·canonical에
   루트 literal로 퍼져 있어 계약 O의 "공통 locale-aware route construction"을 새로 만들어야 한다.
3. `NEXT_PUBLIC_SITE_URL` fallback은 `https://fishtilt.example`이며 빌드가 경고를 낸다.
   `.env` 없음. 현재 빌드 HTML에 placeholder 2,474회.
4. 모든 라우트가 static(ƒ 0)이고 `sitemap/robots`는 `force-static` — 이 상태를 Stage 3 내내
   유지해야 한다(계약 B·K).
5. 소스는 git 추적 밖이다. 경계 검증은 `<scratchpad>/stage3-baseline` 스냅샷 `diff -rq`로만
   가능하다.
