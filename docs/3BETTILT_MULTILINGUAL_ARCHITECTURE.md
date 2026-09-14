# 3BetTilt — Multilingual architecture (future `/en`)

작성 2026-09-14 · 상태: **설계 문서. `/en`은 아직 없음(의도).**
관련 결정: D-S3-01(`[locale]` 세그먼트), D-S3-02(`localePath` 단일 진실), D-S3-03(`/` → `/ko` 1건),
D-S3-06(hreflang은 존재하는 언어만), D-S3-22(title 형식 · hreflang editions).

## 1. 지금 (Korean-first)

| 항목 | 현재 값 | 코드 |
| --- | --- | --- |
| 지원 로케일 | `['ko']` | `src/lib/locale.ts` `SUPPORTED_LOCALES` |
| URL | 모든 문서가 `/ko/...` | `[locale]` 세그먼트 + `generateStaticParams` + `dynamicParams=false` |
| root | `/` → `/ko` permanent(308) | `next.config.ts` `redirects()` |
| 없는 URL | 404 (`/learn`, `/en`, `/ko/xxx`) | `dynamicParams=false`, redirect 없음 |
| canonical | 자기 자신 | `lib/seo/canonical.ts` |
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

1. `SUPPORTED_LOCALES = ['ko', 'en']`, `HREFLANG.en = 'en'`(또는 `en-US`), `OPEN_GRAPH_LOCALE.en = 'en_US'`.
   `Record<Locale, …>` 타입이 누락을 컴파일 에러로 잡는다.
2. **번역 존재 여부를 데이터로 표현.** 레코드별 `editions`(또는 locale별 registry)를 두고,
   번역이 없는 문서는 `/en/...` 경로를 `generateStaticParams`에서 **생성하지 않는다**(→ 404).
   절반만 번역된 상태에서 영어 URL을 채우지 않는다.
3. `pageMetadata`/`sitemapEntries`가 `hreflangAlternates(url, path, editionsOf(document))`를 넘기게 한다.
   - `/ko/learn/pot-odds` ↔ `/en/learn/pot-odds` 각각: canonical = 자기 자신,
     hreflang = `ko-KR`, `en`, `x-default` (양쪽 동일 set).
   - 한국어만 있는 문서: 지금과 동일(`ko-KR` + `x-default`). 영어 태그를 내지 않는다.
4. `<html lang>`을 root layout에서 `[locale]` layout으로 이동(root layout 주석에 이미 명시).
5. 영어 레코드는 자체 `title`/`seoTitle`/`seoDescription`을 가진다. 한국어 title에 영어 키워드를 섞지 않는다.
6. 테스트: `seoTitleCoverage.test.tsx`를 로케일별로 확장(중복 title 검사는 로케일 안에서),
   hreflang reciprocity를 edition 쌍마다 검사.

## 3. Root 전략

| 단계 | `/` 동작 | `x-default` |
| --- | --- | --- |
| 지금 ~ 영어 production-ready 전 | `/` → `/ko` 308 **유지** | 각 한국어 문서 자기 자신 |
| 영어 production-ready 후 (권장) | `/` = 가벼운 **언어 선택 페이지**(정적 HTML, 두 홈으로의 일반 링크) | `/` (selector) — `hreflangAlternates`의 `x-default` 한 줄만 변경 |
| 대안 | `/` = 명시적 기본 언어 홈(프로젝트 결정 시) | 그 기본 언어 edition |

금지:

- `Accept-Language`/IP로 **서버 강제 redirect** — Googlebot(주로 en-US)이 한국어 URL을 발견하지 못한다.
- 크롤러와 사용자에게 다른 콘텐츠를 보여주는 동적 구조.

허용: 선택 페이지 또는 각 언어 페이지에서 브라우저 언어에 따른 **비강제 추천 배너**
(클라이언트 측, 닫을 수 있고, URL 발견을 막지 않음).

## 4. 하지 않은 것 (의도)

- `/en` 라우트, 언어 스위처, 영어 hreflang, 영어 sitemap entry — 없음(D-S3-06).
- root 동작 변경 — 없음.
- 존재하지 않는 URL의 redirect — 없음. 계속 404.
