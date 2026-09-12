# WP-S3-16 — built-HTML SEO audit (3BetTilt)

- 기준: `apps/fishtilt` production build (`next build`, 2026-09-12), `.next/server/app/**/*.html` 144 문서 + `sitemap.xml.body` + `robots.txt.body`.
- 도구: `apps/fishtilt/.data/tools/seo-audit.mjs` (gitignored `.data/`; `node .data/tools/seo-audit.mjs [--json] [--min-inbound N]`, cwd = `apps/fishtilt`). 서버 없이 프리렌더 HTML을 직접 읽는다.
- "before" = 이 WP 시작 시점의 클린 빌드(콘텐츠 작업 완료 상태), "after" = 이 WP의 변경을 반영한 클린 빌드. 두 빌드 모두 `NEXT_PUBLIC_SITE_URL` 미설정 → origin `https://3bettilt.com` (D-S3-05).

## 1. 요약

| 항목 | before | after |
|---|---|---|
| 문서 수 / sitemap URL | 144 / 141 | 144 / 141 |
| sitemap 중복 · 파일 없는 URL · noindex 페이지 포함 · indexable인데 누락 | 0 · 0 · 0 · 0 | 0 · 0 · 0 · 0 |
| `<title>` 중복 / meta description 중복 | 0 / 0 | 0 / 0 |
| 깨진 내부 링크 (전체 `<a href>`, 헤더·푸터 포함) | 0 | 0 |
| 고아 페이지 (contextual inbound < 2, `/ko` 제외) | **3** (`glossary/c-bet`·`bluff`·`ip-oop` 각 1) | **0** |
| inbound 분포 (distinct 소스 페이지 수, `<main>` − 브레드크럼) | 0:1 · 1:3 · 2:9 · 3:11 · 4:8 · 5:8 · 6:11 · 7:20 · 8:10 · 9:10 · 10+:50 | 0:1 · 2:10 · 3:11 · 4:8 · 5:7 · 6:10 · 7:21 · 8:12 · 9:10 · 10+:51 |
| JSON-LD 파싱 실패 | 0 | 0 |
| `@context` 없는 top-level 블록 | **64** (`DefinedTerm`, 글로서리 전편) | 0 |
| `FishTilt` / `FISHTILT` / `fishtilt.example` / `example.com` / `localhost` (대소문자 구분) | 0 | 0 |
| title > 60자 | 0 (최대 58) | 0 |
| `<h1>` ≠ 1개인 문서 | 0 | 0 |
| `<img>` alt 누락 | 0 | 0 |

"0:1"은 `/ko`(홈)다. 홈으로 가는 링크는 워드마크와 모든 페이지의 브레드크럼이며, contextual 규칙에서 의도적으로 제외한다.

## 2. 라우트 패밀리별 (after)

canonical ok = 자기 자신을 가리키는 절대 canonical 1개. og ok = `og:title/description/url(=canonical)/image/image:width=1200/image:height=630/type/locale=ko_KR/site_name=3BetTilt` 전부. hreflang ok = `ko-KR` + `x-default` 둘 다 canonical, 다른 alternate 없음.

| family | pages | sitemap | noindex | canonical ok | og ok | hreflang ok | ld parse ok | 1 title | 1 h1 | lang=ko | twitter card | title>60 | desc<50자 | JSON-LD types |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| home (`/ko`) | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | WebSite 1 · Organization 1 · FAQPage 1 |
| learn-hub | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | BreadcrumbList · CollectionPage(ItemList 15) |
| learn | 15 | 15 | 0 | 15 | 15 | 15 | 15 | 15 | 15 | 15 | 15 | 0 | 3 | BreadcrumbList 15 · Article 15 · FAQPage 15 |
| blog-hub | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | BreadcrumbList · CollectionPage(ItemList 25) |
| blog (19 guides + 6 stories) | 25 | 25 | 0 | 25 | 25 | 25 | 25 | 25 | 25 | 25 | 25 | 0 | 2 | BreadcrumbList 25 · Article 25 (`articleSection` = content type, author/publisher = Organization) · FAQPage 19 |
| glossary-hub | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | BreadcrumbList · CollectionPage(DefinedTermSet 64) |
| glossary | 64 | 64 | 0 | 64 | 64 | 64 | 64 | 64 | 64 | 64 | 64 | 0 | 53 | BreadcrumbList 64 · DefinedTerm 64 (`@context` 추가됨) |
| hands-hub | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | BreadcrumbList · CollectionPage(ItemList 20) |
| hands | 20 | 20 | 0 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 0 | 13 | BreadcrumbList 20 · FAQPage 20 (Article 없음 — 결정 유지) |
| tools-hub | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | BreadcrumbList · CollectionPage(ItemList 6) |
| tools | 6 | 6 | 0 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 0 | 0 | BreadcrumbList 6 · WebApplication 6 · FAQPage 6 |
| practice-hub | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | BreadcrumbList · CollectionPage(ItemList 3) |
| practice | 3 | 3 | 0 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 0 | 0 | BreadcrumbList 3 |
| about | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | BreadcrumbList 1 |
| search (`/ko/search`) | 1 | **0** | **1** (`noindex, follow`) | 1 | 1 | 0 (의도: alternate 없음) | 1 | 1 | 1 | 1 | 1 | 0 | 0 | BreadcrumbList 1 |
| `_not-found` | 1 | 0 | 1 | canonical 없음 | — | 없음 | — | 1 | 1 | 1 | — | — | — | — |
| `_global-error` | 1 | 0 | robots 없음 | canonical 없음 | — | 없음 | — | 1 | 1 | **lang 없음** | — | — | — | — |

- `/` → `/ko` 308 redirect (locale.spec); `/` 자체는 sitemap에 없고 문서도 아니다.
- `/ko/` 슬래시 형태는 Next가 `/ko`로 308 (D-S3-04). sitemap·canonical·내부 링크 모두 슬래시 없음.
- `WebSite`에 `SearchAction` 없음(`/ko/search?q=`는 클라이언트 파싱이라 서버 엔드포인트가 아님 — 유지).
- `seoTitle ≠ H1`: blog 25/25 (스토리 6 포함) 모두 다름. learn·glossary·hands·정적 라우트는 레코드에 `seoTitle` 필드가 없어 title = H1 (106 페이지). tools 6은 `SEO.title`(검색 제목) ≠ H1(라우트 라벨).

## 3. 크롤 결과

- 링크 해석: `<a href>` 전체 3,000+ 건 중 내부 경로 → 프리렌더 문서 / `public/` / 파일 컨벤션 라우트로 전부 해석. **깨진 링크 0**.
- 허브 → 자식 커버리지: learn 15/15 · blog 25/25 · glossary 64/64 · hands 20/20 · tools 6/6 · practice 3/3.
- 브레드크럼: 홈 제외 140 문서 전부 `aria-label="현재 위치"` nav + 같은 trail의 `BreadcrumbList` (seo.spec이 항목별로 검증).
- 고아 before → after:
  - `glossary/c-bet` 1 → 2 (`learn/flop-turn-river` 본문 `<Term>` 추가)
  - `glossary/bluff` 1 → 2 (`learn/poker-actions` 본문 `<Term>` 추가)
  - `glossary/ip-oop` 1 → 2 (`learn/position` 본문 `<Term>` 추가)
  - `glossary/nuts` 2 → 2 (WP-07 i3가 `blog/playing-the-board`에 이미 `<Term>` — 추가 조치 불필요)
  - `glossary/broadway` 2 → 7, `glossary/connector` 2 → 7 (`hands/kjs·jts·qjs·t9s`, `learn/starting-hands` 본문 `<Term>`)
  - 스토리 6편: 툴 페이지 "이런 이야기도 있어요"에서 +1~2씩 (`qq-vs-72o-flop-227` 7→9, `full-house-loses` 9→10, `river-changes-everything` 6→8, `qq-three-bet-frustration` 7→8, `aa-loses` 5→6, `ak-flop-miss` 6→7)
- 패밀리별 inbound (after, distinct 소스 페이지): learn min 9 / median 14 / max 38 · blog 6/9/16 · glossary 2/6/27 · hands 5/7/21 · tools 21/41/55 · practice 4/4/6 · 허브 3~67.
- inbound = 2인 페이지 10개: 전부 글로서리(신규 6 용어 중 `gutshot`·`open-ended`·`set-vs-trips` 포함). 카테고리 허브 + 이웃 용어 상호 링크가 그 2개다. 다음 콘텐츠 라운드에서 learn 본문 `<Term>`으로 올릴 후보.

## 4. 카니발라이제이션 판정 (빌드된 title 기준)

전제: 역할 규칙(Learn = X란/…법 · Tool = 계산기/표 · Glossary = X 뜻 · Blog = 구체 질문 · Hands = 표기 하나). 빌드된 `<title>` 141개는 전부 서로 다르고, 같은 1차 의도를 두 페이지가 title로 주장하는 곳은 없다. 남은 것은 **문구가 가까운 쌍**이며, 모두 `seoTitle` 필드가 없는 종류(learn/glossary H1 = title)라 이 WP의 경계 밖(title = H1 = 콘텐츠 소유).

| 클러스터 | 소유자(빌드 title) | 판정 | 조치 |
|---|---|---|---|
| 핸드레인지 | learn `핸드레인지란?` / tool `13×13 핸드레인지 표 — …` / glossary `패의 묶음 (Range)` / blog `레인지로 보는 이유 — …` | 분리 OK | 헤더 nav 앵커 `핸드레인지`→tool은 유지(라우트 라벨, 경계 밖). 보고만 |
| 13×13 | tool / learn `13×13 표는 어떻게 읽나요?` / glossary `13×13 표 (Hand Matrix)` | 근접 쌍 1 (learn↔glossary) | 상호 링크 확인: glossary→learn `nextLessons` ✓, learn→glossary `relatedConcepts` ✓. glossary title에서 "13×13"을 괄호 뒤로 옮기는 안은 콘텐츠 owner 판단 |
| 3벳 | learn `상대의 레이즈에 다시 레이즈 (3-Bet)` / glossary `다시 거는 세 번째 레이즈 (3-Bet)` / blog `3벳(쓰리벳, 3-Bet)은 왜 3일까? …` | 근접 쌍 1 (learn↔glossary) | 상호 링크 ✓ (glossary `nextLessons: three-bet`, learn `relatedConcepts: term-three-bet`). 한글 "3벳"이 learn·glossary title에 없음 — owner 권고 |
| 팟오즈 | learn `콜할 값어치가 있을까? 팟오즈` / glossary `콜 값어치 (Pot Odds)` / tool `팟 오즈 계산기 — …` / blog `팟오즈 쉽게 계산하기 — …` | 근접 쌍 1 (learn↔glossary "콜 값어치") + 표기 불일치(`팟 오즈`는 tool 라우트 라벨) | 상호 링크 ✓. 표기 통일은 `routes.ts` 라벨(경계 밖) |
| 족보 | learn `어떤 족보가 더 강할까요?` / glossary `패의 순서, 족보 (Hand Ranking)` / tool `포커 족보 확인기 …` / quiz `족보 퀴즈` / blog 비교 5편 | 분리 OK | — |
| 시작 핸드 | learn `처음 받은 두 장, 좋은 패일까요?` · `시작 패는 어떤 순서로 강할까요?` / tool `시작 핸드 순위표 — …` / hub `홀덤 시작 핸드 목록 — …` / hands 20 (`표기` 포함) | 분리 OK | learn/starting-hands → `/hands` 링크는 `relatedHands` 4개로 충족 |
| 키커 | glossary `순위를 가르는 옆 카드 (Kicker)` / blog `키커란? 같은 원페어면 누가 이길까 — …` (병합본) | 분리 OK (blog는 "같은 원페어" 질의 소유) | — |
| 수티드 | glossary `같은 무늬 (Suited)` / blog `수티드(같은 무늬)는 얼마나 중요한가? …` / `AKs vs AKo 차이 — …` | 분리 OK | — |
| 포지션 | learn `자리(포지션)가 왜 …` / `UTG · HJ · CO · BTN · SB · BB, …` / glossary 7 (ip-oop 포함) / blog `버튼(BTN) 오픈 레인지가 넓은 이유 — …` | 분리 OK | `ip-oop` 고아 해소 |
| 블라인드·AA 확률·아웃츠·에퀴티 | 각 1 소유자 | 분리 OK | — |
| 룰/하는법 | learn `텍사스 홀덤은 어떻게 진행될까요?` | 소유자 1이나 title이 seed(`홀덤 하는법/룰/규칙`)를 주장하지 않음 (키워드 맵 §0-1 그대로) | learn title = H1, 경계 밖. Open issue로 이관 |
| 홈 vs `/learn` | `무료 홀덤 학습` / `홀덤 처음 배우기` | 분리 OK | — |

## 5. 이미지 · 접근성 메타

- `og:image` = `/og.png` (1200×630, `public/og.png` 존재, e2e가 `image/png` 200 확인), 141 페이지 전부 절대 URL + width/height + alt.
- `<img>` alt 누락 0 (콘텐츠 이미지는 `EditorialImage` fallback 경로라 `<img>` 자체가 거의 없음).
- 장식 SVG: `aria-hidden="true"`(아이콘) 또는 `role="presentation"`(EditorialImage/ContentThumbnail fallback) — 둘 다 허용. 예외 **1건**: `src/components/HomeHeroVisual.tsx:76`의 배경 SVG에 `aria-hidden`/`role` 모두 없음(홈 1회). 시각 컴포넌트라 경계 밖 → Open issue.

## 6. 브랜드 스캔

- 대소문자 구분 `FishTilt` · `FISHTILT` · `fishtilt.example` · `example.com` · `localhost`: 공개 HTML 144문서 중 **0**.
- 소문자 `fishtilt`: 문서당 3회(검색 페이지 5회) — 전부 내부 식별자: no-flash 스크립트의 `localStorage` 키 `fishtilt-theme`, 모바일 nav id `fishtilt-mobile-nav`, 검색 input id `fishtilt-search-input`. 화면 텍스트/메타/URL에 없음. D-S3-07(내부 이름 유지) 범위로 판단, 변경 없음.

## 7. Preview 환경 색인 (DEPLOY doc §2/§5 재확인)

- 코드 확인: `src/app/robots.ts`는 항상 `Allow: /`, `src/lib/seo/metadata.ts`의 `robots`는 `policy.ts`(레지스트리 플래그)만 읽음. **환경변수(`VERCEL_ENV`)를 보는 코드는 없다.** `NEXT_PUBLIC_SITE_URL`은 origin만 바꾼다(경로가 있으면 빌드 실패 — `site.ts` 테스트 확인). 문서 §5.2의 서술은 코드와 일치한다.
- 완화 요소(코드로 보장): preview에서도 canonical·og:url·sitemap·robots의 Sitemap 줄이 production origin을 가리킨다(D-S3-05). 이는 "preview host를 정본으로 삼지 말라"는 신호이지 색인 차단은 아니다.
- 판정: SEO **결함이 아니라 배포 설정 사항**. Vercel Preview는 플랫폼이 `X-Robots-Tag: noindex`를 붙인다고 문서화되어 있으나 이 저장소가 검증한 사실은 아니므로, 배포 문서 §5.2의 `curl -I … | grep -i x-robots-tag` 확인을 그대로 실행할 것.
- 코드 게이트를 원한다면(오케스트레이터 판단): `robots.ts`의 `disallow`는 부적합(fetch 차단 → noindex를 못 읽음, 파일 주석과 동일 논리). 올바른 지점은 응답 헤더 `X-Robots-Tag: noindex`를 `VERCEL_ENV === 'preview'`일 때만 붙이는 `next.config.ts#headers()` 한 줄 — policy.ts의 "deny list 없음"·D-S3-05와 충돌하지 않고, 메타 robots는 그대로 둔다. `next.config.ts`는 이 WP 경계 밖이라 구현하지 않았다.

## 8. 남은 관찰 (수정하지 않음)

- meta description 길이: 글로서리 64편 중 53편이 50자 미만(최소 21자 `river`/`turn`; 최대 83). 전부 고유하고 문장으로 완결되어 있으며 `RelatedContent` 카드에도 그대로 보이는 카피라 이 WP에서 늘리지 않았다. 30자 미만 15편(`river turn split-pot straight two-pair board draw high-card bet flop flush limp cutoff kicker pot-odds`)은 owner가 한 절 덧붙일 후보.
- `_global-error`(500 페이지): `<html>`에 `lang` 없음, 영문 제목 `500: This page couldn't load`, robots 메타 없음. `src/app/global-error.tsx`(경계 밖). 검색엔진 노출 경로는 없으나 브랜드 일관성 차원의 open issue.
- title = H1인 106페이지는 종류상 `seoTitle` 필드가 없다(learn/glossary/hands 타입). 필요하면 `types.ts`에 `seoTitle?`를 올리는 결정이 선행돼야 한다(경계 밖).
