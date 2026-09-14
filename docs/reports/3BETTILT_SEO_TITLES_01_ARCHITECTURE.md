# 3BetTilt SEO Titles — 01. Metadata architecture 변경

작성 2026-09-14 · 범위: `apps/fishtilt` metadata/SEO 계층. 본문 콘텐츠(MDX)·H1·디자인·링크·라우트 변경 없음.

## 1. 흐름 (변경 후)

```
static route  : page.tsx  SEO = { path, title, description } ─┐
content page  : record ── seoTitleOf(record)       (content/graph.ts)   ─┤
                      └── seoDescriptionOf(record) (lib/seo/contentSeo.ts)┤
                                                                         ▼
                            pageMetadata()  (lib/seo/metadata.ts)
                              ├ title  = formatTitle(title)  → "{title} - 3BetTilt"
                              ├ og:title = twitter:title = title
                              ├ og:site_name = "3BetTilt", og:locale = OPEN_GRAPH_LOCALE[locale of path]
                              ├ canonical = canonicalUrl(path)                  (불변)
                              └ hreflang = hreflangAlternates(url, path[, editions]) (출력 불변)
JSON-LD name (CollectionPage / WebApplication) = titleHead(title)  → " | " 앞 검색 문구
```

## 2. 변경 목록

| 파일 | 변경 |
| --- | --- |
| `src/content/types.ts` | `seoTitle?`를 blog 전용 → **모든 ContentRecord**로 이동. `seoDescription?` 추가(모든 kind). `GlossaryRecord.seoTerm?` 추가 |
| `src/content/graph.ts` | `seoTitleOf` 확장: explicit `seoTitle` 우선 → kind별 기본(glossary 템플릿 / hands 템플릿 / learn·blog H1). `glossarySeoTerm` 신설(H1 표제어 파생 + 짧은 약어 유지 + `seoTerm` override) |
| `src/lib/seo/contentSeo.ts` (신규) | `seoDescriptionOf`: explicit `seoDescription` 우선 → glossary = `{검색어} 뜻: {shortDefinition} {description}`(160자 초과 시 앞부분만), hands = `factValue`(순위·조합 수) 기반 문장, learn·blog = `description` |
| `src/lib/seo/site.ts` | `TITLE_BRAND_SEPARATOR=' - '`, `TITLE_QUALIFIER_SEPARATOR=' \| '`, `titleHead()`, `HOME_SEO_TITLE`/`HOME_SEO_DESCRIPTION`(홈 + root layout fallback 공용), `SITE_LOCALE`을 locale 맵에서 파생 |
| `src/lib/seo/metadata.ts` | `formatTitle` → ` - 3BetTilt`. `contentMetadata`가 `seoDescriptionOf` 사용. `hreflangAlternates(canonical, path, editions?)` — editions 기반 reciprocal set, 자기 로케일 누락 시 throw. `og:locale`을 경로에서 파생 |
| `src/lib/locale.ts` | `OPEN_GRAPH_LOCALE: Record<Locale,string>` 추가 |
| `src/lib/seo/jsonLd.ts` | `CollectionPage.name`/`WebApplication.name` = `titleHead(...)`. `GLOSSARY_TERM_SET_NAME='포커 용어 사전'` 공용 상수(허브 set과 용어 페이지 `inDefinedTermSet`이 같은 이름을 쓰도록) |
| `src/lib/seo/index.ts` | 새 export(`seoDescriptionOf`, `titleHead`, 구분자, 홈 상수, set name) |
| `src/app/layout.tsx` | fallback title/description = 홈 상수 |
| `src/app/global-error.tsx` | 리터럴 title ` - 3BetTilt` |
| `src/app/[locale]/**/page.tsx` 17개 | 정적 라우트 `SEO.title`(일부 description) 교체 — 상세는 02 보고서 |
| `src/app/[locale]/glossary/[slug]/page.tsx` | 로컬 set name 상수 → 공용 `GLOSSARY_TERM_SET_NAME` |
| `.data/tools/seo-audit.mjs` | `seoTitleEqualsH1` 판정 regex를 새 suffix로 |

## 3. 설계 판단

- **추상화 최소화.** 새 필드는 3개(`seoTitle` 범위 확장, `seoDescription`, glossary `seoTerm`)뿐. `primaryKeyword` 필드는
  만들지 않았다 — 템플릿이 필요로 하는 "검색어"는 glossary에만 있고(`seoTerm`), 나머지 kind는 title 자체가 검색어를 담는다.
- **title 템플릿은 graph.ts, description은 lib/seo.** hands description이 `facts.ts`(strength dataset)를 필요로 하므로
  클라이언트 컴포넌트도 import하는 `graph.ts` 경로에서 분리했다(client bundle 비대화 방지).
- **숫자는 페이지가 이미 출력하는 값만.** hands description의 순위·조합 수는 페이지의 `<Fact>`와 같은 `factValue`에서 읽는다.
  "승률"은 title의 라벨로만 쓰고(ADR-0082 허용), description은 "기대되는 팟 몫(비기면 절반)"으로 서술. `이길 확률` 0건(테스트).
- **H1 불변.** 모든 H1은 그대로. title과 H1은 의미를 공유하고 문자열은 다르다(빌드 HTML 검사: title == H1인 페이지 0).
- **JSON-LD 재작성 없음.** name 두 곳에만 `titleHead` 적용 — ` | qualifier`가 구조화 데이터 이름에 들어가지 않게.
  Article `headline`·Breadcrumb 이름은 H1 그대로(의미 일치). FAQ 블록 불변.
- **hreflang/canonical 출력 불변.** editions 파라미터는 준비만; 141/141 기존 값과 동일(테스트 고정).
