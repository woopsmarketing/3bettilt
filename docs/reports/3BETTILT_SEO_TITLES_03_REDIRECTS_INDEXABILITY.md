# 3BetTilt SEO Titles — 03. Redirect · indexability · structured data 확인

작성 2026-09-14. 이 항목들은 **확인만** 했고 인프라(DNS/Cloudflare/Vercel)·`next.config.ts`는 변경하지 않았다.

## 1. Root redirect (production, curl 2026-09-14)

| 요청 | 응답 |
| --- | --- |
| `https://3bettilt.com` | **308** → `/ko` |
| `https://3bettilt.com/ko` | **200**, `<title>`(배포본은 아직 이전 title), canonical `https://3bettilt.com/ko` |
| `https://3bettilt.com/learn` | **404** (unprefixed, redirect 없음 — D-S3-03) |
| `https://3bettilt.com/ko/does-not-exist` | **404** |

코드: `next.config.ts` `redirects()` = `/` → `localePath(DEFAULT_LOCALE,'/')`, `permanent: true` — **변경 없음**.

## 2. www / http variants (production)

| 요청 | 1st hop | 최종 |
| --- | --- | --- |
| `http://3bettilt.com` | 308 → `https://3bettilt.com/` | → 308 `/ko` → 200 |
| `https://3bettilt.com` | 308 → `/ko` | 200 |
| `http://www.3bettilt.com` | 308 → `https://www.3bettilt.com/` | → 308 `https://3bettilt.com/` → 308 `/ko` → 200 (3 hops) |
| `https://www.3bettilt.com` | 308 → `https://3bettilt.com/` | → 308 `/ko` → 200 |

응답 헤더: `server: cloudflare`, `x-vercel-id` 존재(Cloudflare 앞단 + Vercel).

**판정: 문제 없음 — 네 variant 모두 permanent(308) redirect로 canonical 홈 `https://3bettilt.com/ko`에 도달.**
옛 Namecheap parking 결과("3bettilt.com is registered at Namecheap")는 현재 서버가 내보내는 것이 아니라 Google 캐시다.
코드 수정 없음. **조치: Search Console에서 `https://3bettilt.com/ko` URL 검사 → 색인 요청, `http://www.3bettilt.com` 속성(도메인 속성 권장)
확인 후 sitemap 재제출.** `http://www` 경로의 3-hop 체인은 기능상 정상이며, 줄이려면 Vercel/Cloudflare에서
`http://www` → `https://3bettilt.com/ko` 단일 hop 규칙을 둘 수 있으나 prompt 지시(불필요한 DNS/Cloudflare 변경 금지)에 따라 보고만 한다.

## 3. Indexability / sitemap (빌드 HTML 감사 `seo-audit.mjs`)

| 항목 | 결과 |
| --- | --- |
| sitemap URL | **141** (dupes 0, 파일 없음 0) |
| indexable-not-in-sitemap / noindex-in-sitemap | 0 / 0 |
| sitemap에 없는 것 | `/` root(redirect), www variant, `/ko/search`(noindex), `_not-found`/`_global-error` — 모두 제외 확인 |
| canonical / og / hreflang ok | 141 / 141 / 141 |
| duplicate titles / descriptions | **0 / 0** |
| title > 60자 | 0 (최대 55) |
| description < 50 또는 > 160 | **0** (min 50, max 140 — 변경 전 learn 3건 44–48자 해소) |
| broken internal links | 0 |
| title == H1 | 0 |
| H1 변경 | 0 (변경 전후 빌드 비교) |
| orphan(<2 contextual inbound) | 1: `/ko` — 홈은 헤더 워드마크·breadcrumb로만 링크(감사가 `<main>` 밖·breadcrumb 제외). 이번 작업은 링크를 건드리지 않음 |

sitemap 정책(`policy.ts` + `sitemapEntries.ts`)은 정확하므로 **변경 없음**.

## 4. Structured data 의미 일치

| 블록 | name 출처 | 확인 |
| --- | --- | --- |
| `Article.headline` (learn/blog) | H1 (`record.title`) | 불변. title과 의미 일치 |
| `BreadcrumbList` | H1/route label | 불변 |
| `CollectionPage.name` (허브 6) | `titleHead(SEO.title)` → 예: `텍사스 홀덤 배우기`, `홀덤 용어 사전` | qualifier 미포함 |
| `WebApplication.name` (도구 6) | `titleHead(SEO.title)` → 예: `홀덤 승률·에퀴티 계산기` | qualifier 미포함 |
| `DefinedTermSet.name` (glossary 허브) / `DefinedTerm.inDefinedTermSet.name` (64) | 공용 `GLOSSARY_TERM_SET_NAME='포커 용어 사전'` (허브 H1) | 두 곳 동일 이름 — title 변경으로 어긋날 뻔한 것을 상수 공유로 방지 |
| `WebSite`/`Organization` (홈) | `SITE_NAME='3BetTilt'` | 불변 |
| `FAQPage` | 페이지 FAQ | 불변, JSON-LD parse 오류 0 |

사전 존재(이번 변경과 무관, 보고만): `/ko/about`·practice 퀴즈 3페이지는 `BreadcrumbList`가 2개씩 emit됨(감사 ld types 표). 유효 JSON-LD이며 수정은 범위 밖.

## 5. Site name

- `og:site_name` = `3BetTilt` (전 페이지), 모든 title 끝 ` - 3BetTilt` 1회, title에 `3bettilt.com` 0건(테스트).
- 홈 `WebSite` JSON-LD `name` = `3BetTilt`. 검색결과에 도메인이 사이트명으로 나오는 문제는 이 설정 + 재크롤로 해소를 기대(Google site name은 Google 판단).
