# 3BetTilt — Multilingual architecture (future `/en`)

작성 2026-09-14 · 상태: **설계 문서. `/en`은 아직 없음(의도).**
관련 결정: D-S3-02(`localePath` 단일 진실), D-S3-06(hreflang은 존재하는 언어만), D-S3-22(title 형식 · hreflang editions),
**D-S3-23(기본 로케일 무접두 — D-S3-01/03/04 대체, 2026-09-17)**.

## 1. 지금 (Korean-first, prefixless)

| 항목 | 현재 값 | 코드 |
| --- | --- | --- |
| 지원 로케일 | `['ko']` | `src/lib/locale.ts` `SUPPORTED_LOCALES` |
| URL 정책 | 기본 로케일(ko) = 접두사 없음, 비기본 로케일 = `/<code>/…` | `localePath(locale, sitePath)` |
| URL | 한국어 문서는 `/`, `/learn`, `/learn/pot-odds` … | route group `src/app/(default-locale)/…` (디렉토리 = 공개 URL) |
| root | `/` = 한국어 홈, **200** (redirect 아님) | `src/app/(default-locale)/page.tsx` |
| 기존 `/ko/*` | 142개 동결 목록 → 1:1 308, 1 hop | `src/lib/legacyLocaleRedirects.ts` + `next.config.ts` `redirects()` |
| 없는 URL | 404 (`/does-not-exist`, `/ko/does-not-exist`, `/en`, `/en/learn`) | 해당 라우트 없음, 패턴 redirect 없음 |
| canonical | 자기 자신, 무접두. root는 bare origin `https://3bettilt.com` | `lib/seo/canonical.ts` (`/ko…` 경로는 throw) |
| hreflang | `ko-KR` + `x-default`, 둘 다 자기 canonical | `lib/seo/metadata.ts` `hreflangAlternates` |
| `og:locale` | 경로의 로케일에서 파생(`ko_KR`) | `OPEN_GRAPH_LOCALE[localeOfPath(path)]` |
| `<html lang>` | `DEFAULT_LOCALE` (root layout) | `src/app/layout.tsx` |
| sitemap | 141 URL, 각 entry에 page `<head>`와 같은 hreflang | `lib/seo/sitemapEntries.ts` |

이번 작업에서 **미래를 위해 준비한 것**(출력은 변화 없음, 테스트로 고정):

- `hreflangAlternates(canonical, path, editions?)` — `editions`는 "이 문서가 실제로 존재하는 로케일 목록".
  기본값은 자기 로케일 하나. 각 edition의 URL은 `localePath(edition, sitePathOf(path))`로 계산하므로,
  모든 edition이 같은 목록으로 같은 set을 만든다 → **reciprocal by construction**.
  자기 로케일이 목록에 없으면 throw(비대칭 hreflang 방지).
- `OPEN_GRAPH_LOCALE` 맵 — `og:locale`이 더 이상 사이트 상수가 아니라 경로에서 파생.
- title의 브랜드 suffix(` - 3BetTilt`)와 qualifier(` | `)는 언어 중립 상수(`site.ts`).

## 2. `/en`을 실제로 추가할 때 (순서)

영어 콘텐츠가 **사람이 쓴 production-ready 번역**으로 존재할 때만 진행한다.
자동 기계번역 페이지, placeholder 141개, 존재하지 않는 URL의 영어 홈 redirect는 금지.
한국어를 `/ko`로 되돌리는 구조는 만들지 않는다(D-S3-23).

1. `SUPPORTED_LOCALES = ['ko', 'en']`, `HREFLANG.en = 'en'`(또는 `en-US`), `OPEN_GRAPH_LOCALE.en = 'en_US'`.
   `Record<Locale, …>` 타입이 누락을 컴파일 에러로 잡는다. `localePath('en', '/learn')`는 이미 `/en/learn`을
   만든다(`locale.test.ts`가 고정).
2. **라우트.** 한국어는 `src/app/(default-locale)/…`에 그대로 둔다. 영어는 `src/app/[locale]/…`에
   `generateStaticParams → 비기본 로케일 중 edition이 있는 것` + `dynamicParams = false`로 둔다. 각 route 파일은
   페이지 구현을 복제하지 않고 locale을 인자로 받는 공용 구현을 호출하는 얇은 파일이어야 한다(이 단계에서 페이지 본문을
   locale-aware로 리팩터링). 정적 세그먼트가 동적 세그먼트보다 우선하므로 `/learn`(한국어)과 `/[locale]`는 충돌하지 않는다.
   rewrite·middleware로 무접두를 흉내 내지 않는다(공개 URL ≠ 프리렌더 경로가 되는 구조, D-S3-23에서 기각).
3. **번역 존재 여부를 데이터로 표현.** 레코드별 `editions`(또는 locale별 registry)를 두고,
   번역이 없는 문서는 `/en/...` 경로를 `generateStaticParams`에서 **생성하지 않는다**(→ 404).
4. `pageMetadata`/`sitemapEntries`가 `hreflangAlternates(url, path, editionsOf(document))`를 넘기게 한다.
   - `/learn/pot-odds` ↔ `/en/learn/pot-odds` 각각: canonical = 자기 자신,
     hreflang = `ko-KR`, `en`, `x-default`(→ 무접두 한국어) (양쪽 동일 set).
   - 한국어만 있는 문서: 지금과 동일(`ko-KR` + `x-default`). 영어 태그를 내지 않는다.
5. `<html lang>`: root layout을 로케일별 root layout 두 개로 나눈다(`(default-locale)/layout.tsx`와
   `[locale]/layout.tsx`가 각각 `<html lang>`을 렌더 — Next의 multiple root layouts).
6. 영어 레코드는 자체 `title`/`seoTitle`/`seoDescription`을 가진다. 한국어 title에 영어 키워드를 섞지 않는다.
7. 테스트: `seoTitleCoverage.test.tsx`·`urlMigration.test.ts`를 로케일별로 확장(중복 title 검사는 로케일 안에서),
   hreflang reciprocity를 edition 쌍마다 검사.

## 3. Root 전략 (D-S3-23로 확정)

- `/` = 한국어 홈(기본 로케일), 200. `x-default` = 무접두 한국어 문서.
- 영어가 생겨도 `/`는 한국어 홈으로 유지하고 영어 홈은 `/en`.
- 언어 선택 페이지로 `/`를 바꾸는 안은 폐기(한국어 canonical URL을 다시 옮기게 되므로).

금지:

- `Accept-Language`/IP로 **서버 강제 redirect** — Googlebot(주로 en-US)이 한국어 URL을 발견하지 못한다.
- 크롤러와 사용자에게 다른 콘텐츠를 보여주는 동적 구조, request-time locale 판별(`headers()`/`cookies()`/middleware).

허용: 각 언어 페이지에서 브라우저 언어에 따른 **비강제 추천 배너**
(클라이언트 측, 닫을 수 있고, URL 발견을 막지 않음) — 별도 단계.

## 4. 하지 않은 것 (의도)

- `/en` 라우트, 언어 스위처, 영어 hreflang, 영어 sitemap entry — 없음(D-S3-06).
- 존재하지 않는 URL의 redirect — 없음. 계속 404. 기존 `/ko/*` 142개만 1:1 redirect.
