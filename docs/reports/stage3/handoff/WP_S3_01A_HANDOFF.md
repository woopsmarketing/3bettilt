# WP-S3-01a

도메인 + 로케일 아키텍처. 작업일 2026-09-09. 구현 에이전트: Fable High (fresh context).
원시 로그: `<scratchpad>/logs/wp-s3-01a/` (`build.log`, `unit-run5.log`, `e2e2.log`, `lint2.log`,
`snapshot-diff-final.txt`, `canonicals-final.txt`, `html-list.txt`).
`<scratchpad>` = `/private/tmp/claude-501/-Users-woops-projects-GTO-SELF/c9838946-1594-4e38-b9ef-d025effa10fa/scratchpad`

## Objective

`apps/fishtilt`의 모든 페이지를 `src/app/[locale]/…` 아래로 옮겨 URL을 `/ko/…`로 만들고(D-S3-01),
로케일 접두사의 단일 출처 `src/lib/locale.ts`를 만들며(D-S3-02), `/` → `/ko` 영구 리다이렉트 하나만
두고(D-S3-03), 기본 origin을 `https://3bettilt.com`으로 바꾸고 placeholder 개념을 제거하며(D-S3-05),
색인 가능한 페이지에 `ko-KR` + `x-default` hreflang을 내고(D-S3-06), `RANGE_PROVENANCE_SENTENCE`를
소유자 승인 문구로 교체한다. 브랜드 문자열(`SITE_NAME`, 워드마크, `og.png`)은 건드리지 않았다.

## Facts verified before work

- 스냅샷 위치는 프롬프트의 `.data/stage3-baseline/fishtilt`가 아니라 `.data/stage3-baseline/apps/fishtilt`였다 (`ls .data/stage3-baseline` → `apps`, `packages`). 최종 diff는 그 경로 기준.
- 이동 전 `src/app` 직속 페이지 디렉토리: `about blog glossary hands learn practice search tools` + `page.tsx`/`page.test.tsx` = 42 파일. `layout.tsx`, `not-found.tsx`, `error.tsx`, `global-error.tsx`, `sitemap.ts`, `robots.ts`, `icon.svg`, `apple-icon.png`, `globals.css`, `theme-tokens.test.ts`, `sitemap.test.ts`, `global-error.test.tsx`는 루트에 남음.
- `content/**/*.mdx` 본문 안에 locale-less 내부 링크 `](/learn/…)` 등 13개 존재 (`grep -rho "](/[a-z-]*" content`). 프론트매터 없음.
- 경로 리터럴 생산자: `src/lib/routes.ts`(18 entries), `src/content/graph.ts:contentPath`, 18개 page의 `SEO.path`, `features/search/url.ts:22`, `features/range/url.ts:16`, `features/strength/url.ts:14`, `features/tools/potOddsUrl.ts:45`, `SiteHeader.tsx:112 href="/"`, `global-error.tsx:120 href="/"`, `layout.tsx:31 path:'/'`.
- `next.config.ts`에서 `./src/lib/locale.js` import는 빌드 실패 (`Cannot find module './src/lib/locale.js'`). `.ts` 확장자 import + `allowImportingTsExtensions`는 성공 (`tsconfig.base.json:13`에 `noEmit: true` 이미 있음).
- `global-error.test.tsx:173`는 `global-error.tsx`가 아무것도 import하지 않을 것을 요구한다.
- 베이스라인 수치: unit 148 files/1820, e2e 267, HTML 133, sitemap 130, hreflang 0.

## Decisions made

D-S3-01..07은 그대로 구현. 그 밖에 이 WP가 내린 결정:

1. **경로 의미론 하나.** 앱 안을 흐르는 모든 `path`(`RouteEntry.path`, `contentPath()`, `BreadcrumbItem.path`, JSON-LD/`pageMetadata` 입력, `SEO.path`)는 이미 로케일이 붙은 href(`/ko/…`)다. locale-less 형태는 정의 지점(`RouteEntry.sitePath`, `CONTENT_PREFIX`)과 파일시스템 검사 테스트에만 존재. `canonicalPath()`는 로케일 없는 경로를 throw로 거부해 규약을 한 지점에서 강제한다 (`src/lib/seo/canonical.ts:47-50`).
2. **18개 page의 `SEO.path` 리터럴 제거.** `path: routeById('toolOuts').path` 식으로 registry에서 읽는다. 페이지와 registry가 어긋날 수 없게 됨.
3. **MDX 본문 링크는 locale-less 유지.** `mdx-components.tsx`의 `a` 매핑이 `localiseHref()`로 접두사를 붙인다. content 130+ 파일은 미수정.
4. **루트 `layout.tsx`가 사이트 셸 유지**, `[locale]/layout.tsx`는 `generateStaticParams` + `dynamicParams=false` + `isLocale` 검증 후 `children` 통과. 전역 `not-found.tsx`/`error.tsx`가 헤더·푸터를 계속 가진다. `<html lang={DEFAULT_LOCALE}>`(루트 layout에는 `params`가 없음; 로케일이 둘 이상이 되면 `[locale]` layout으로 이동해야 함).
5. **`global-error.tsx`는 `href="/"` 유지.** 이 파일은 import 금지(자체 테스트). `/`가 유일한 리다이렉트이므로 결과는 `/ko`. 주석으로 명시.
6. **`WebSite`/`Organization`/`isPartOf`의 `url`은 `https://3bettilt.com/ko`** (bare origin은 리다이렉트만 하므로). `Article.image`/`og:image`는 `https://3bettilt.com/og.png` 유지.
7. **sitemap에 `alternates.languages` 포함** (Next `MetadataRoute.Sitemap`이 `x-default` 포함 지원, 자명해서 넣음). `hreflangAlternates()` 하나를 `<head>`와 sitemap이 공유.
8. **`normaliseOrigin`은 path/query/fragment가 있으면 throw**, unset/blank는 `null` → `PRODUCTION_ORIGIN`. `SITE_ORIGIN_IS_PLACEHOLDER` → `SITE_ORIGIN_IS_DEFAULT`로 교체. sitemap 빌드 시 `console.info` 한 줄 (`// eslint-disable-next-line no-console` 필요: 루트 ESLint가 `warn/error`만 허용).
9. **공유 URL 상수 3개를 registry 유도로 교체** (`RANGE_EXPLORER_PATH`, `STARTING_HAND_PATH`, `POT_ODDS_PATH`). 리터럴이면 `history.replaceState`가 브라우저 URL을 `/tools/range?…`로 되돌려 nav active 상태를 잃고 reload 시 404가 났다(e2e에서 발견).
10. **provenance 문장 뒤에 붙던 중복 꼬리 삭제** (`RangeExplorer.tsx:94`, `practice/range-quiz/page.tsx:93`, `features/tools/faq.ts:263`): 새 문장이 "정답이 아니다/상황·상대에 따라 다르다"를 이미 담아 두 번 말하게 되므로.
11. **`/ko` 리터럴 가드는 주석을 제외**하고 검사한다 (`src/lib/locale.test.ts:104-116`). 문서 주석의 `` `/ko/learn` `` 예시는 허용.

## Files changed

스냅샷 diff (`diff -rq -x next-env.d.ts -x node_modules -x .next -x test-results -x playwright-report`, 기준 `.data/stage3-baseline/apps/fishtilt`):

- **moved (42)**: `src/app/{page.tsx,page.test.tsx,about,blog,glossary,hands,learn,practice,search,tools}` → `src/app/[locale]/…`. 42 전부 상대 import 깊이 `../` 1단 추가. 그중 30개는 추가 변경(18 page의 `SEO.path` → `routeById().path`; `range-quiz/page.tsx` 꼬리 문장 삭제; 12개 page.test의 href 기대값 `ko()` 경유).
- **new (4)**: `src/app/[locale]/layout.tsx`, `src/lib/locale.ts`, `src/lib/locale.test.ts`, `tests/e2e/locale.spec.ts`.
- **modified, 비테스트 (23)**: `mdx-components.tsx`, `next.config.ts`, `tsconfig.json`(`allowImportingTsExtensions`), `src/app/{global-error,layout,not-found,sitemap}.tsx|ts`, `src/components/{RangeExplorer,SiteHeader}.tsx`, `src/content/graph.ts`, `src/features/range/{copy,url}.ts`, `src/features/search/url.ts`, `src/features/strength/url.ts`, `src/features/tools/{faq,potOddsUrl}.ts`, `src/lib/routes.ts`, `src/lib/seo/{canonical,index,jsonLd,metadata,site,sitemapEntries}.ts`.
- **modified, unit tests (24)**: `src/app/{sitemap,theme-tokens}.test.ts`, `src/components/{RangeExplorer,RouteNavItem,SiteHeader}.test.tsx`, `src/content/{claims,content,graph}.test.ts`, `src/features/range/{copy,url}.test.ts`, `src/features/search/{buildIndex,url}.test.ts`, `src/features/tools/potOddsUrl.test.ts`, `src/lib/routes.test.ts`, `src/lib/seo/{breadcrumbs,canonical,homeSiteIdentity,hubCollectionPage,jsonLd,metadata,policy,site,sitemapEntries,toolPageJsonLd}.test.*`.
- **modified, e2e (24)**: `tests/e2e/helpers.ts` + 23개 spec 전부.
- **deleted**: 0. `content/`, `public/`, `playwright.config.ts` 미수정.

## Tests run

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @gto-self/fishtilt typecheck` | exit 0, 0 errors (e2e 포함) |
| `pnpm vitest run --project fishtilt --project learn-core` | **149 files / 1841 passed**, 0 failed (baseline 148/1820; +21 tests) |
| `cd apps/fishtilt && rm -rf .next && pnpm build` | exit 0 |
| `pnpm e2e:fishtilt` | **271 passed**, 0 failed, 15.9s (baseline 267; +3 `locale.spec`, +1 seo hreflang) |
| `pnpm lint` (루트) | exit 0, fishtilt 범위 0 problems (첫 실행의 `no-console` warning 1건은 disable 주석으로 해소) |

중간 실패와 처리: unit 1차 68건(경로 기대값·placeholder flag·`sitePath` 픽스처) → 기대값을 새 규약으로 갱신, assertion 삭제 없음. e2e 1차 2건(`range-explorer` reload 404, `theme-and-header` aria-current 소실) → 원인은 Decisions 9, 소스 수정 후 271/271.

## Build/runtime evidence

- HTML **133** (baseline 133): `ko.html` 1 + `ko/**` 130 + `_not-found.html` + `_global-error.html`. `ƒ`(dynamic) **0**; 라우트는 `○ Static`/`● SSG`뿐.
- `fishtilt.example` in built HTML: **0**.
- `rel="canonical"` **131**개, 전부 `https://3bettilt.com/ko…` 시작 (`/ko/search` 포함, noindex). `_not-found.html` canonical **0**.
- `hrefLang="ko-KR"` **130**, `hrefLang="x-default"` **130** (색인 페이지 130 = sitemap 130). `ko/search.html` 0, `_not-found.html` 0.
- JSON-LD 절대 URL 713개 중 678개 `https://3bettilt.com/ko…`, 나머지 35개는 전부 `"image":"https://3bettilt.com/og.png"`.
- `sitemap.xml`: `<loc>` **130**, host 단일 `https://3bettilt.com`, `/ko` 밖 0, `xhtml:link hreflang` ko-KR 130 / x-default 130.
- `robots.txt`: `Sitemap: https://3bettilt.com/sitemap.xml`, Disallow 없음.
- 빌드 HTML의 `/ko` 밖 root-relative href: `/_next/static/*`, `/icon.svg`, `/apple-icon.png`뿐.
- 리다이렉트: `tests/e2e/locale.spec.ts` — `GET /` → **308**, `location` pathname `/ko`; `GET /learn` → 404, `GET /xx/learn` → 404 (둘 다 사이트 자체 404 `<main>`); `/ko` 200, `lang="ko"`.
- 빌드 로그 `[fishtilt] NEXT_PUBLIC_SITE_URL is not set — using production origin default https://3bettilt.com` — Next가 sitemap 모듈을 두 단계에서 평가해 **2회** 출력됨(코드상 1줄).

## Known limitations

- 로케일이 하나뿐이라 `contentPath()`/`ROUTES[].path`는 `DEFAULT_LOCALE`로 고정 계산된다. 두 번째 로케일은 `localePath(locale, …)` 시그니처가 이미 받지만 registry/graph/페이지에 `params.locale`을 실제로 꿰는 작업은 남아 있다.
- `<html lang>`은 루트 layout의 `DEFAULT_LOCALE`(루트에는 `params` 없음).
- `RangeShareLink.test.tsx:6`의 픽스처 `https://fishtilt.example/tools/range?…`는 prop으로 넘기는 임의 절대 URL(canonical 아님)이라 그대로 둠. 브랜드 에이전트가 정리해도 무방.
- `sitemap.test.ts:11` 주석에 옛 flag 이름 `SITE_ORIGIN_IS_PLACEHOLDER`가 역사 설명으로 남아 있음(코드 참조 0).
- 이전 unprefixed 경로(`/learn` 등)는 결정대로 리다이렉트 없이 404.

## Open issues

- 없음(차단 항목). 경계 밖 변경 필요 없음. `eslint.config.js`의 `no-console` 허용 목록에 `info`를 넣을지는 오케스트레이터 판단(현재는 파일 내 disable 주석으로 처리).

## Exact facts next agent may rely on

- `src/lib/locale.ts`: `SUPPORTED_LOCALES = ['ko'] as const`, `type Locale`, `DEFAULT_LOCALE: Locale = 'ko'`, `APP_LOCALE_SEGMENT = '[locale]'`, `HREFLANG: Record<Locale,string> = { ko: 'ko-KR' }`, `isLocale(v: string): v is Locale`, `localePath(locale, sitePath): string` (`'/'`→`'/ko'`, query/fragment 보존, 이미 접두사 있으면 throw), `localeOfPath(path): Locale | null`, `sitePathOf(localised): string`(역함수, 로케일 없으면 throw), `localiseHref(href, locale = DEFAULT_LOCALE)`(내부 root-relative만 접두사).
- `src/lib/routes.ts`: `RouteEntry { id, sitePath, path, label, section, available }` — `path === localePath(DEFAULT_LOCALE, sitePath)`(`routes.test.ts`가 보장). registry는 `sitePath`로 쓰고 `ROUTES = DEFINITIONS.map(localise)`.
- `src/content/graph.ts`: `contentPath(record)` → `/ko/<kind>/<slug>`; `CONTENT_PREFIX`는 locale-less; `CONTENT_ROUTE_TEMPLATE.learn === '[locale]/learn/[slug]'`.
- `src/lib/seo/site.ts`: `PRODUCTION_ORIGIN = 'https://3bettilt.com'`, `SITE_ORIGIN`, `SITE_ORIGIN_IS_DEFAULT`, `normaliseOrigin()`(throw 규칙 위). `SITE_NAME = 'FishTilt'`(:22), `SITE_LOCALE = 'ko_KR'`(:25), `OG_IMAGE_ALT = 'FishTilt'`(:95) — **브랜드 에이전트 대상**. 워드마크 텍스트 `FISHTILT`: `src/components/SiteHeader.tsx:121`, `SiteFooter.tsx`; `og.png`: `apps/fishtilt/public/og.png`; `<title>` 접미사: `src/lib/seo/metadata.ts:formatTitle`.
- `src/lib/seo/metadata.ts`: `pageMetadata({ path(localised), title, description, index, ogType? })`; `index:true`일 때만 `alternates.languages = hreflangAlternates(canonical, path)` = `{ 'ko-KR': url, 'x-default': url }`. `hreflangAlternates`는 barrel(`seo/index.ts`)에서 export.
- `src/lib/seo/sitemapEntries.ts`: `sitemapEntries()` → `{ url, alternates: { languages } }[]`; `sitemapPaths()/sitemapUrls()`는 유지.
- `next.config.ts`: `redirects()` 1건 `{ source: '/', destination: localePath(DEFAULT_LOCALE, '/'), permanent: true }`; import는 `'./src/lib/locale.ts'`(확장자 `.ts` 필수).
- e2e 헬퍼(`tests/e2e/helpers.ts`): `koPath(sitePath)`, `koUrl(sitePath, allowQuery = false): RegExp`. spec에 `/ko` 리터럴 0.
- `/ko` 리터럴 가드: `src/lib/locale.test.ts` "the locale prefix is spelt once" — `src/**`(테스트 제외)·`content/**`·`mdx-components.tsx`·`next.config.ts`, 주석 제거 후 검사.
- `RANGE_PROVENANCE_SENTENCE`(`src/features/range/copy.ts`): `이 표는 6인 테이블 · 100BB · 아무도 참여하지 않았을 때 (First In) 상황을 위한 학습용 기본 레인지입니다. 모든 상황의 정답을 뜻하지 않으며, 게임 조건과 상대에 따라 실제 선택은 달라질 수 있습니다. SB만은 원래 목록이 레이즈와 림프를 합친 형태여서, 레이즈 부분만 남도록 이 사이트가 다시 계산했습니다.` — 라벨 상수(`TABLE_SIZE_LABEL`, `stackDepthLabel`, `SPOT_LABEL`, `RANGE_LABEL`)로 조립.

## Facts next agent MUST re-check

- 위 `path:line`은 이 WP 종료 시점 값. 브랜드 rename 후 `SITE_NAME`/`OG_IMAGE_ALT`/워드마크 줄 번호는 달라질 수 있다.
- `SITE_NAME`을 바꾸면 `formatTitle` 기대값을 쓰는 테스트와 e2e `seo.spec.ts`의 `toContain('FishTilt')`(제목 검사), `theme-and-header`/`SiteHeader.test`의 `FISHTILT` 워드마크 이름, `not-found.spec.ts`의 `'무료 홀덤 학습 · FishTilt'`가 함께 움직여야 한다.
- `NEXT_PUBLIC_SITE_URL`을 설정하는 배포 파이프라인은 path 없는 bare origin이어야 한다(아니면 빌드가 throw).
- `.next`는 마지막 e2e 빌드 산출물. 재검증 시 `rm -rf .next && pnpm build`부터.
- `console.info` 2회 출력은 Next 빌드 단계 특성; 1회를 요구한다면 별도 처리 필요.
