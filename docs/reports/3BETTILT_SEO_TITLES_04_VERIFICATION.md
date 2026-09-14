# 3BetTilt SEO Titles — 04. Tests · verification

작성 2026-09-14. 정책: 141페이지 browser E2E 금지 → metadata source/model 테스트로 전 route coverage, 대표 페이지만 빌드 HTML 검사.

## 1. 새 테스트

| 파일 | 내용 |
| --- | --- |
| `src/lib/seo/seoTitleCoverage.test.tsx` (신규, 20 tests) | 정적 17 route의 `metadata` export + 124 content `contentMetadata`로 **141페이지 전수**: sitemap과 집합 일치·141개 / non-empty title, ` - 3BetTilt` 1회로 끝남, 도메인·구 suffix 없음 / **중복 title 0, 중복 description 0** / canonical = 자기 경로, hreflang = `ko-KR`+`x-default`(불변), robots index / og·twitter title 일치 / 한국어 title(검색 문구에 한글), 영어 SEO 단어(poker/holdem/texas/GTO) 없음 / keyword stuffing: 본문 ≤48자, 같은 단어 3회 이상 금지, ` \| ` 최대 1개 / description 50–160자, 같은 단어 4회 이상 금지 / `이길 확률`·`이기는 비율` 없음(ADR-0082) / 대표 11페이지 exact title |
| `src/content/seoTitle.test.ts` (신규) | `glossarySeoTerm` 파생(표제어, 약어 유지, `seoTerm` override), glossary/hands 템플릿, set-vs-trips override, 모든 published learn에 `seoTitle` 존재 |
| `src/lib/seo/metadata.test.ts` (+4) | brand 마지막·도메인 없음 / hreflang editions 기본값 = 자기 로케일, 자기 누락 시 throw, locale 없는 path throw / `og:locale` 경로 파생 / 모든 kind에서 `seoTitle`·`seoDescription` override |

## 2. 기존 테스트 수정 (스펙 변경에 따른 기대값 갱신 — assertion 약화 아님)

| 파일 | 변경 |
| --- | --- |
| `metadata.test.ts` | `· 3BetTilt` → ` - 3BetTilt` |
| `hubCollectionPage.test.tsx` / `toolPageJsonLd.test.tsx` | "name == title 전체" → "name은 title의 검색 문구(`titleHead`): qualifier 미포함 + title이 name으로 시작" |
| `practice/page.test.tsx` | 새 title exact 비교(title ≠ H1 검사 유지) |
| `tools/page.test.tsx` | title `홀덤 계산기` 포함 + description `무료` 포함 |
| `tools/{equity,pot-odds,hand-checker}/page.test.tsx` | 새 검색어(`승률·에퀴티 계산기`, `팟오즈 계산기`, `핸드 판정기`+`족보`) |
| `tools/range/page.test.tsx` | "title이 H1로 시작" → "title이 `홀덤 핸드레인지표`로 시작 + H1이 같은 주제(`핸드레인지`)" + `6-max` 유지 |
| `tools/starting-hand/page.test.tsx` | route label 포함 검사 제거 → `시작 핸드 순위표` 포함(title ≠ H1 유지) |
| `tests/e2e/blog.spec.ts`, `not-found.spec.ts` | suffix 리터럴 → `TITLE_BRAND_SEPARATOR`+`SITE_NAME` (e2e는 실행 안 함 — 정책) |

## 3. 실행 결과

| 게이트 | 명령 | 결과 |
| --- | --- | --- |
| typecheck (affected) | `tsc -p apps/fishtilt/tsconfig.json --noEmit` | **PASS** (0 error) |
| targeted unit | `vitest --project fishtilt src/lib src/app src/content copy-guards components/{glossary,blog}` | **84 files / 1405 tests PASS** |
| fishtilt 전체 unit (1회) | `pnpm vitest run --project fishtilt` | **232 files / 2572 tests PASS** |
| lint | `pnpm lint` | **0 error**, 2 warnings(기존 `.data/tools/seo-audit.mjs` `no-console`) |
| production build (2회: 1차 후 learn description 3건 보강) | `pnpm build` (apps/fishtilt) | **PASS**, `ƒ` 0 (전부 static/SSG) |
| built HTML 감사 | `node .data/tools/seo-audit.mjs` | sitemap 141, dup title/desc 0, title>60 0, desc<50/>160 0, canonical/og/hreflang 141/141, broken link 0 |
| 대표 페이지 HTML 검사 | `/ko`, `/ko/learn`, `/ko/learn/pot-odds`, `/ko/tools/equity`, `/ko/glossary/three-bet`, `/ko/hands/aa`, `/ko/blog/aks-vs-ako`, `/ko/blog/qq-vs-72o-flop-227`, `/ko/practice/hand-ranking-quiz`, `/ko/about` (+`/ko/glossary`) | title/description/canonical/og:title/og:site_name/og:locale/hreflang/JSON-LD name 확인 — 03 보고서 §4 |
| `/` root | production curl | 308 → `/ko` (빌드 산출물 없음 — redirect) |

실행하지 않음(정책): full E2E, full monorepo test 반복, visual regression.

## 4. DEFERRED / 남은 위험

- **e2e `blog.spec.ts`·`not-found.spec.ts`는 실행하지 않음**(정책). `playwright test --list`로 두 spec이 새 import와 함께 로드됨(35 tests) 확인. 실제 title 값은 unit coverage 테스트 + 빌드 HTML 검사로 대신 검증.
- 배포 전까지 production은 이전 title. 배포 후 Search Console 재크롤 요청 권장.
- Google은 title을 재작성할 수 있다. title·H1·intro 의미 일치로 가능성을 낮췄을 뿐 보장은 없음.
