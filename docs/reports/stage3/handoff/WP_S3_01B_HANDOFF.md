# WP-S3-01b

## Objective

퍼블릭 브랜드를 **FishTilt → 3BetTilt**로 기계적·전수 치환한다. 워드마크(대문자
**3BETTILT**), 타이틀 접미사·JSON-LD·OG 메타데이터의 `3BetTilt`, 소셜 카드/파비콘 자산,
사용자에게 보이는 한국어 카피(홈/소개/검색/404/용어집 MDX 등)를 대상으로 하며, 내부
식별자(`@gto-self/fishtilt`, `apps/fishtilt`, `build:fishtilt`/`e2e:fishtilt`, vitest
프로젝트명 `fishtilt`, import 경로, DOM id, localStorage 키, `docs/FISHTILT_*.md` 문서
파일명 참조)는 그대로 둔다. 라우트/락언어(`/ko`), poker 로직, 레이아웃은 손대지 않는다.

## Facts verified before work

- `grep -rn -i fishtilt apps/fishtilt/{src,content,public,tests}` → 313줄 / 174개 파일,
  baseline과 일치.
- `SITE_NAME`(`src/lib/seo/site.ts:22`)·`OG_IMAGE_ALT`(`site.ts:95`) 두 상수만 있으면
  `jsonLd.ts`/`metadata.ts`가 리터럴 없이 `<title>`, `og:site_name`, `og:image:alt`,
  JSON-LD `Organization`/`WebSite` 이름을 전부 파생시킴. 유일한 예외는
  `global-error.tsx:105`의 하드코딩 `<title>…· FishTilt</title>` (루트 레이아웃을 타지
  않는 전역 에러 바운더리라 `formatTitle`을 못 씀 — 기존 설계, 범위 밖).
- `public/og.png`(1200×630, 원본 7,003B)는 `FISHTILT` 워드마크 + 13×13 range-matrix
  모티프를 담은 실제 텍스트 이미지. `icon.svg`(32×32)는 `<title>`만 텍스트고 렌더링
  글리프는 사각형 모티프. `apple-icon.png`(180×180)는 원본부터 텍스트가 전혀 없는
  동일 글리프.
- "fish/물고기/피시" 유래를 설명하는 문장은 코드베이스에 없었음(`globals.css:4`의
  "피쉬틸트" 음역 주석 하나뿐, 유래 설명이 아닌 라벨) — 재작성 대상 없음.
- `RangeShareLink.test.tsx:6`의 `fishtilt.example`은 `3bettilt.com`으로 교체 대상.
  `site.test.ts`의 `fishtilt.test`는 `normaliseOrigin()` URL 파싱 규칙만 테스트하는
  임의 호스트명(브랜드 텍스트 아님).

## Decisions made

1. **정규식 경계**: `FishTilt`(믹스 케이스 그대로) / `FISHTILT(?!_)`(뒤에 `_` 없음)만
   치환. `FISHTILT_STATE.md` 등 `docs/` 문서 파일명 참조는 항상 `FISHTILT_<대문자>`
   형태라 `(?!_)`로 자동 제외 — 치환 후 전수 재검토로 확인 완료.
2. **소문자 `fishtilt` 전부 미변경**: 경로, `build:fishtilt`/`e2e:fishtilt`, vitest
   프로젝트명, `THEME_STORAGE_KEY='fishtilt-theme'`, DOM id
   `fishtilt-mobile-nav`/`fishtilt-search-input`, 콘솔 접두사 `[fishtilt]`
   (`sitemap.ts:28`), `fishtilt.test` 픽스처 — 전부 사용자/검색엔진에 보이지 않는 내부
   식별자.
3. `globals.css:4` "FishTilt design tokens — 피쉬틸트." → "3BetTilt design tokens."로
   정리, 옛 브랜드 음역만 제거(새 음역은 근거 없이 지어내지 않음).
4. **자산 재생성은 `og.png` 하나만 필요**하다고 판단 — `icon.svg`/`apple-icon.png`은
   원본부터 렌더링되는 워드마크 텍스트가 없어 재생성해도 픽셀이 동일함.
5. `og.png`는 Playwright(chromium, 기 설치)로 1200×630 HTML을 스크린샷해 재생성.
   레이아웃(좌측 워드마크+빨간 밑줄, 우측 13×13 대각선 모티프)과 팔레트를
   `globals.css` 토큰(`--color-ground-900:#090a0d`, `--color-text-100:#f5f6f7`,
   `--color-brand-500:#ff334d`, 빈 셀 `--color-panel-700:#171b21`, `--font-mono`)에서
   그대로 가져옴. "FISHTILT"·"3BETTILT" 둘 다 8자라 레이아웃을 그대로 재사용.
   렌더 스크립트는 스크래치패드에서 실행 후 삭제(`apps/fishtilt/scripts/`에 남기지 않음).
6. Guard는 기존 `src/copy-guards.test.ts`(이미 `SRC_FILES`/`MDX_FILES` 워커 보유)에
   `it('never reintroduces the retired FishTilt brand name')`로 추가. 결정 1과 동일한
   정규식(`FishTilt|FISHTILT(?!_)`)으로 문서 파일명 참조는 허용하고 워드마크 재발만 검출.
   `.tsx?` 워커 밖인 `icon.svg`는 별도로 읽어 같은 정규식 적용.

## Files changed

| 분류 | 개수 | 비고 |
| --- | --- | --- |
| 카피/메타데이터(non-test) | 95 | 아래 디렉터리별 요약 |
| MDX 본문 | 12 | `content/glossary/*.mdx` 전부 |
| 자산 | 1 | `public/og.png` 재생성(`icon.svg`는 카피 95건에 포함; `apple-icon.png` 변경 없음) |
| 단위 테스트 | 52 | 브랜드 기대값 갱신 + `copy-guards.test.ts` Guard 6 신규 |
| e2e | 14 | `tests/e2e/*.spec.ts` 브랜드 기대값 갱신 |
| 기타 | 1 | `tests/layering.test.ts` (주석만) |

카피/메타데이터 95건 중 실제 텍스트가 바뀐 핵심 파일: `src/lib/seo/site.ts`
(`SITE_NAME`/`OG_IMAGE_ALT`), `src/app/global-error.tsx`(하드코딩 `<title>`),
`src/app/icon.svg`, `src/app/globals.css`, `src/components/SiteHeader.tsx:121`·
`SiteFooter.tsx:33,35`(워드마크+카피), `src/app/[locale]/page.tsx`·`about/page.tsx`·
`search/page.tsx`(홈/소개/검색 노출 카피), `src/content/registry/glossary/j1.ts`
(VPIP/PFR `shortDefinition` 노출 문구 2건). 나머지 다수(`src/app/robots.ts`,
`sitemap.ts`, `layout.tsx`, `not-found.tsx`, 6개 `tools/*/page.tsx`, `blog`/`hands`/
`learn`/`practice` 페이지, `features/{tools,quiz,range,search,strength,content}/*.ts`,
`content/{blog,hands,learn,registry}/**/*.ts`, `lib/{routes,seo/*}.ts`,
`components/{Range*,Poker*,Card*,Figure,HandChecker,LinkCard,ThemeToggle,
ContentThumbnail,HomeHeroVisual,FaqSection,SearchClient,RouteNavItem}.tsx`,
`tests/e2e/helpers.ts`)는 주석/JSDoc의 제품명 언급만 갱신(동작 변화 없음).

## Tests run

| 명령 | 결과 |
| --- | --- |
| `pnpm vitest run --project fishtilt src/copy-guards.test.ts` | PASS 8/8 (Guard 6 포함) |
| `pnpm --filter @gto-self/fishtilt typecheck` | PASS 0 errors |
| `pnpm vitest run --project fishtilt --project learn-core` | PASS 149 files / **1842** (기존 1841 + Guard 6) |
| `cd apps/fishtilt && rm -rf .next && pnpm build` | PASS 133 HTML, 전부 static (기존과 동일) |
| `pnpm e2e:fishtilt` | PASS **271/271** |
| `pnpm lint` (root) | PASS, fishtilt 관련 문제 0건 |

## Build/runtime evidence

- 빌드 산출물 스캔(`apps/fishtilt/.next/server/app/**/*.html`): 이전 `FishTilt` 1,815 /
  `FISHTILT` 396(132/133 파일) → 이후 `FishTilt|FISHTILT` 매칭 파일 **0**개,
  `3BetTilt` **1815**건 / `3BETTILT` **396**건(정확히 1:1 대응, 누락·과다 없음).
- 홈(`/ko`) 실측: `og:site_name`=`3BetTilt`, `og:image:alt`=`3BetTilt`,
  `<title>`=`무료 홀덤 학습 · 3BetTilt`, JSON-LD `Organization.name`=`WebSite.name`=
  `3BetTilt`.
- `public/og.png`: 1200×630, **11,684 bytes**(<50KB, 원본 7,003B), `3BETTILT` 워드마크 +
  동일 모티프/팔레트. `icon.svg`: 32×32, `<title>3BetTilt</title>`. `apple-icon.png`:
  180×180, 변경 없음(원본에 텍스트 없었음).

## Known limitations

- `og.png`는 디자이너 원본이 아니라 Playwright HTML 스크린샷 재현본 — 폰트 렌더링이
  픽셀 단위로 원본 툴 출력과 동일하지 않을 수 있음(레이아웃/색/텍스트는 의도대로 일치).
- `icon.svg`/`apple-icon.png`는 원본부터 워드마크 텍스트가 없어 "3BETTILT 워드마크로
  재생성" 문구를 문자 그대로 만족시키지 못함 — 텍스트를 새로 넣는 것은 범위 확장으로
  보고 하지 않음.

## Open issues

없음. typecheck/unit/build/e2e/lint 전부 통과, 빌드 산출물 옛-브랜드 잔여 0건.

## Exact facts next agent may rely on

- `SITE_NAME='3BetTilt'`(`site.ts:22`), `OG_IMAGE_ALT='3BetTilt'`(`site.ts:95`) 두
  상수만 있으면 메타데이터 전체가 파생됨(둘 다 하드코딩 리터럴 없음).
- `global-error.tsx:105`가 유일한 비-`SITE_NAME` `<title>` 리터럴 — 이미 갱신됨.
- 워드마크 리터럴: `SiteHeader.tsx:121`, `SiteFooter.tsx:33`(둘 다 `3BETTILT`),
  `icon.svg:2`(`<title>`).
- `src/copy-guards.test.ts`에 `OLD_BRAND=/FishTilt|FISHTILT(?!_)/gu` 가드 테스트가
  있어 옛 브랜드 재유입 시 유닛 테스트가 실패한다.
- 소문자 `fishtilt` 잔존 55건은 전부 의도적으로 남긴 내부 식별자 — 이후 WP에서
  "브랜드 누락"으로 오인해 건드리지 말 것.

## Facts next agent MUST re-check

- 위 `path:line`은 이번 WP 시점 기준. `apps/fishtilt/src`가 이후에도 계속 변경될 수
  있으므로 재확인 필요.
- 빌드 산출물 카운트(1815/396)는 이번 시점 콘텐츠 볼륨(133 HTML)에 종속 — 콘텐츠가
  늘면 절대 숫자는 바뀐다. 확인해야 할 조건은 "옛 브랜드 0건"이지 이 숫자 자체가 아님.
- `icon.svg`/`apple-icon.png`에 텍스트가 없다는 판단은 현재 디자인 기준 — 디자인이
  바뀌어 워드마크가 추가되면 재검토 필요.
