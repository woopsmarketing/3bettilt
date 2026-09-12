# FISHTILT WP-8 — 최종 QA (UX · SEO · 시각 · 반응형)

> **정정 (WP-9). 이 보고서의 릴리스 판정은 틀렸다.**
>
> 아래 "남은 이슈"는 **릴리스 블로커 없음**이라고 적고 있다. WP-8 뒤에 붙인 fresh-context
> 독립 리뷰가 **블로커 2건**을 찾았다:
>
> - **B1** — `src/app/`에 `not-found.tsx`·`error.tsx`·`global-error.tsx`가 하나도 없어 Next의
>   영어 기본 페이지가 배포되고, 404 문서에 `<title>`이 **두 개** 박혀(유효하지 않은 HTML)
>   첫 번째인 루트 layout의 `무료 홀덤 학습 · FishTilt`가 이겨, 모든 404가 홈페이지 행세를
>   했다. `<main>` 랜드마크도 없었다.
> - **B2** — `features/range/copy.ts`가 조사 `와`를 하드코딩해, high rank가 3·6·7·8·10일 때
>   `10와 9` 같은 비문을 프리렌더된 페이지에 박아 냈다.
>
> **왜 이 QA가 놓쳤는가**, 그대로 적어 둔다. 두 결함 모두 "테스트가 통과하는가"로는 보이지
> 않는다. 404는 e2e가 `expect(status).toBe(404)`만 확인했고 — 상태 코드는 처음부터 옳았다 —
> 문서를 읽지 않았다. 조사는 기존 유닛 테스트가 `expect(...length).toBeGreaterThan(0)`이라
> 깨진 한국어에도 참이었다. 이 QA는 **자기 검증 도구가 보는 것만** 봤고, 그 도구들이 무엇을
> 보지 않는지는 묻지 않았다.
>
> 두 건 모두 시정 완료. 시정 내역과 재측정 결과: `docs/reports/FISHTILT_WP9_REVIEW_REMEDIATION.md`.
> 리뷰 원문: `docs/reports/FISHTILT_INDEPENDENT_REVIEW.md`.
> **아래 본문은 당시 기록으로 그대로 둔다** — 판정만 무효다.

## 목표

Stage-2의 마지막 관문. WP-1~WP-7b가 남긴 확정 결함 두 건을 닫고, 사이트 전체를
회귀·반응형·구조화 데이터 정직성·내부 링크 무결성 기준으로 점검해 릴리스 가부를 판정한다.

WP-8은 오케스트레이터가 직접 수행했다. 하위 에이전트로 두 번 시도했으나 두 번 다 완료
기록 없이 정지했고(변경 0건 확인), CLAUDE.md §1이 **최종 검증·최종 판정**을 메인 에이전트의
역할로 규정하고 있어 직접 수행으로 전환했다.

## 범위

**고친 것**: `src/app/page.tsx`, `src/app/globals.css`, 롱폼 템플릿 4개, 이제 거짓이 된 주석 2개,
가드 테스트 2개.

**손대지 않은 것**: MDX 산문(Prettier 드리프트 포함, ruling 129), `PageHero`/`SectionHeading`의
설명문 폭 리터럴, 콘텐츠 레코드, `routes.ts`, `packages/*`, `apps/web`.

## 확인한 기존 상태

WP-7b 종료 시점, 오케스트레이터가 직접 재측정한 값:

| 항목 | 값 |
| --- | --- |
| unit (fishtilt + learn-core) | 1803 passed / 146 files |
| e2e | 260 passed |
| build | 133 HTML (= 사이트 131 + `_not-found` + `_global-error`), 전 라우트 정적 |
| FAQ | 27 페이지 115 질문, 질문 아닌 항목 0, 마크다운 잔존 0 |

**남아 있던 결함 2건**:

1. **홈에 죽은 도구 이름.** `src/app/page.tsx:294`·`:486`이
   `` `${routeById('range').label} 탐색기 열기` ``로 라벨을 **조립**해 `핸드레인지 탐색기 열기`를
   렌더했다. `핸드레인지 탐색기`는 WP-7a의 이름 수렴 이후 정본이 아니다(정본 `13×13 핸드레인지 표`).
   문자열이 소스에 존재하지 않아 리터럴 grep으로는 잡히지 않았고, 빌드 산출물에서만 보였다
   (ruling 128).
2. **한국어 본문 컬럼이 두 폭으로 분열.** `globals.css`는 `--container-reading: 48rem`을
   "한글 ~48자, 편안한 45–60 밴드 상단"으로 정당화하고, `mdx-components.tsx`는 같은 컬럼을
   "41rem 근처, 35–38자"로 캡하며 **라틴 밴드가 한국어에 전이되지 않는다**고 논증한다. 두 파일이
   한 컬럼에 대해 양립 불가능한 근거를 적고 있었다. WP-5가 `blog/[slug]`만 토큰으로 옮기면서
   기사 템플릿 하나가 48rem이 되고 나머지 넷은 42rem 리터럴에 남았다 — 같은 MDX, 같은 렌더러, 두 폭.

## 구현 내용

### A. 홈의 죽은 이름 제거

두 자리 모두 `/tools/range` CTA다. 라벨을 `` `${routeById('range').label} 열기` `` = **`핸드레인지 열기`**로
바꿨다. 근거는 사이트 자신의 기본 규약이다 — `ToolCTA.tsx:42`가 `action`이 없을 때 쓰는 폴백이
정확히 `` `${route.label} 열기` ``이고, MDX CTA 4건이 이미 그 형태를 쓴다. `13×13 핸드레인지 표 열기`도
후보였으나 버튼 라벨로 길고, 임의로 삽입되던 `탐색기`를 제거하는 것이 이 결함의 원인을 없앤다.

### B. 본문 컬럼 단일화 (ruling 120)

`--container-reading`을 **48rem → 42rem**으로 내리고, 리터럴 4곳을 토큰으로 교체했다.

- `src/app/learn/[slug]/page.tsx:88`, `glossary/[slug]/page.tsx:73`,
  `hands/[hand]/page.tsx:140`, `about/page.tsx:26` → `max-w-reading`

**이 방향을 고른 이유**: 4개 페이지는 픽셀 변화가 **0**이고, `blog/[slug]`는 Stage-2 이전 폭으로
돌아가며, 리터럴은 0이 된다. 반대 방향(토큰 유지 + 4곳을 48rem으로)은 네 페이지를 모두 넓히면서
`mdx-components.tsx`가 길게 논증한 한국어 measure를 정면으로 거스른다.

`globals.css`의 근거 주석도 고쳤다. 라틴 45–60 밴드 인용을 지우고 실측(42rem = 672px, 17px 전각
기준 ~39자)과 두 파일이 모순됐던 경위를 남겼다. 이제 거짓이 된 주석 2개(`learn/[slug]:100`,
`blog/[slug]:17`)도 현재 상태에 맞게 정정했다.

부수 효과로 기사가 아닌 `max-w-reading` 사용처 7곳(도구 FAQ 6 + `/learn` 허브)이 48→42rem으로
좁아진다. 반응형 실측에서 확인했고 문제 없다.

### C. 재발 방지 가드 2개

두 결함 모두 **테스트가 없어서 살아남았다.** `theme-tokens.test.ts:323`은
`--container-reading`이 *정의됐는지*만 봤고 값은 보지 않았으며, 컬럼 assertion은
`blog/[slug]` 자기 것 하나뿐이었다. 홈 CTA 라벨은 어떤 테스트도 고정하지 않았다.

`src/app/theme-tokens.test.ts`에 두 개를 추가했다.

1. **롱폼 템플릿 5개가 같은 토큰을 쓴다** — 숫자가 아니라 불변식을 고정한다.
2. **`mx-auto` + `max-w-[…]` 조합 금지** — 가운데 정렬된 컬럼은 페이지의 measure를 정하므로
   토큰이어야 한다.

2번은 처음에 "`max-w-[` 전면 금지"로 썼다가 `HomeHeroVisual.tsx`와 `OutsFigure.tsx`에서 즉시
실패했고, **그 둘이 옳고 테스트가 틀렸다** — 둘 다 그림에 붙은 `w-full max-w-[Nrem]`, 즉 "부모를
채우되 고유 크기를 넘지 않는다"는 통상 관용구다. `PageHero`·`SectionHeading`도 같은 부류(설명문
줄길이 제한)다. `mx-auto`를 키로 삼으면 allow-list 없이 갈라지고, 누가 그림을 하나 더 추가해도
깨지지 않는다.

**두 가드 모두 변이 테스트로 확인했다**: `about/page.tsx`를 리터럴로 되돌리면 둘 다 실패하고,
복원하면 84개 전부 통과한다.

### `/hands` 타이틀은 바꾸지 않았다 — `## 남은 이슈` 참조

## 변경 파일

| 파일 | 성격 |
| --- | --- |
| `src/app/page.tsx` | 홈 CTA 라벨 2곳, 죽은 이름 제거 |
| `src/app/globals.css` | `--container-reading` 48rem → 42rem, 근거 주석 정정 |
| `src/app/learn/[slug]/page.tsx` | 리터럴 → `max-w-reading`, 주석 정정 |
| `src/app/glossary/[slug]/page.tsx` | 리터럴 → `max-w-reading` |
| `src/app/hands/[hand]/page.tsx` | 리터럴 → `max-w-reading` |
| `src/app/about/page.tsx` | 리터럴 → `max-w-reading` |
| `src/app/blog/[slug]/page.tsx` | 이제 거짓이 된 헤더 주석 정정 |
| `src/app/theme-tokens.test.ts` | 가드 2개 신규 + `--container-matrix` 단언 추가 |

신규 파일 0.

## 테스트 / 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm vitest run` (전 프로젝트) | **4428 passed / 3 skipped**, 293 files passed / 1 skipped |
| `pnpm vitest run --project fishtilt --project learn-core` | 1803 → **1805 passed** (가드 +2) |
| `pnpm typecheck` | 전 패키지 Done |
| `pnpm lint` | `eslint .` clean |
| `pnpm build:fishtilt` | **133 HTML**, 전 라우트 정적, 컴파일 성공 |
| `pnpm e2e:fishtilt` | **260 passed** (15.5s) |

### 산출물 기반 검증 (소스가 아니라 빌드된 HTML)

| 점검 | 결과 |
| --- | --- |
| 죽은 이름 `핸드레인지 탐색기` 잔존 페이지 | **0** (수정 전 `index.html` 1건) |
| 새 라벨 `핸드레인지 열기` 렌더 | 홈에서 2건 확인 |
| CSS 토큰 실제 값 | `--container-reading:42rem`, `.max-w-reading{max-width:var(--container-reading)}` |
| 최상위 `@type` | `BreadcrumbList` 130 · `Article` 35 · `FAQPage` 27 · `CollectionPage` 6 · `WebApplication` 6 · `WebSite` 1 · `Organization` 1 |
| FAQ (JSON.parse, `<script>`/`<style>` 제거 후 대조) | 27 페이지 **115 질문** — 질문 아닌 것 **0**, 마크다운 잔존 **0**, 화면에 없는 질문·답변 **0**, parse 실패 **0** |
| 금지 필드 | `datePublished` 0 · `dateModified` 0 · `aggregateRating` 0 · `SearchAction` 0 · `potentialAction` 0 |
| 내부 링크 무결성 | 링크 대상 133종, **깨진 링크 0종** |
| 근거 없는 인기·추천 표현 | **0 페이지** |

### 반응형 실측 (Playwright chromium, 프로덕션 서버, 10개 대표 라우트 × 3 뷰포트)

**가로 스크롤: 30개 조합 전부 `false`.**

`<main>` 실측 폭(px):

| 라우트 | 375 | 768 | 1440 | 토큰 |
| --- | --- | --- | --- | --- |
| `/` | 375 | 768 | 1152 | shell 72rem |
| `/learn/pot-odds` | 375 | **672** | **672** | reading 42rem |
| `/blog/outs-nine` | 375 | **672** | **672** | reading 42rem |
| `/glossary/pot-odds` | 375 | **672** | **672** | reading 42rem |
| `/hands/aa` | 375 | **672** | **672** | reading 42rem |
| `/about` | 375 | **672** | **672** | reading 42rem |
| `/blog`, `/practice` | 375 | 768 | 896 | grid 56rem |
| `/tools/outs` | 375 | 768 | 1152 | shell 72rem |
| `/tools/range` | 375 | 768 | **1360** | matrix 85rem |

**다섯 롱폼 템플릿이 전부 672px로 일치한다** — B의 목표가 산출물에서 확인된다.

**"화면 밖 요소 78개"는 결함이 아니다.** 375px의 `/`·`/tools/range`·`/hands/aa`에서 78개가 잡혔는데,
**78개 전부가 `overflow-x-auto` 조상을 가진 레인지 매트릭스 셀**이다. 넓은 콘텐츠가 자기 컨테이너
안에서 스크롤하고 페이지 자체는 가로 스크롤하지 않는 설계된 동작(build spec §47)이며, 세 페이지에서
숫자가 동일한 것이 공용 컴포넌트라는 신호였다. 검사 쪽이 거칠었다.

**작은 탭 타겟도 결함이 아니다.** `/hands/aa`의 4건을 실측했다: `홈` 브레드크럼은 폭 12px이지만
**높이 44px**(`min-h-11`)로 가로 배치에서 문제되는 축은 충족하고, 나머지 셋은 본문 안 인라인
링크(높이 18–20px)로 44px로 키우면 산문 행간이 깨진다.

### 테마

라이트/다크 모두 대표 3개 라우트에서 확인. 라이트 `bg rgb(242,244,247)` / `fg rgb(16,20,26)`,
다크 `bg rgb(9,10,13)` / `fg rgb(245,246,247)`. 토큰 재정의 방식(ruling 103)이 정상 동작한다.

## SEO/UX 관점의 영향

- **한 객체가 한 이름을 갖는다.** 홈이 `/tools/range`를 사이트 어디에도 없는 이름으로 부르던 상태가
  끝났다. 클릭 전 라벨과 도착 페이지 제목이 어긋나면 이탈 요인이고, 검색엔진에게도 같은 대상에
  대한 상충 신호다.
- **본문 measure가 근거를 되찾았다.** 다섯 롱폼 템플릿이 한 폭이고, 그 폭은 한국어 실측에서
  나온 값이다. 라틴 가이드라인을 한국어에 적용한 문서상의 모순도 제거됐다.
- **구조화 데이터는 화면에 있는 것만 말한다.** 115개 질문이 전부 렌더된 본문에 실재하고, 사이트가
  지킬 수 없는 약속(`SearchAction`)과 가진 적 없는 데이터(날짜·평점)를 주장하지 않는다.
- **깨진 내부 링크 0.** 크롤 예산을 404에 쓰지 않는다.

## 남은 이슈

~~**릴리스 블로커 없음.**~~ **← 이 판정은 틀렸다. 문서 맨 위 정정을 보라.** 독립 리뷰가
블로커 2건(B1 404·500 오류 페이지, B2 와/과 조사)을 찾았고 WP-9에서 시정했다.

아래는 그와 별개로, 전부 의도적으로 하지 않은 것이다 — 이 목록 자체는 유효하다.

1. **`/hands` 타이틀 `핸드 목록`을 바꾸지 않았다.** 약한 검색 타깃인 것은 맞다(홀덤·포커 어느
   쪽도 없다). 그러나 WP-1의 키워드 맵은 20개 hands 상세 페이지에 개별 표기(`AA`, `KQs` …)를
   배정했고 허브에는 배정이 없다. 여기에 `홀덤 시작 패` 계열을 넣으면
   `learn/starting-hand-ranking`(C13)과 `/tools/starting-hand`가 이미 나눠 가진 의도를 침범한다.
   **QA에서 즉흥적으로 정할 문제가 아니라 키워드 배정을 다시 여는 문제**라 손대지 않고 남긴다.
2. **MDX Prettier 드리프트(113편 중 31편 미적용)를 고치지 않았다** — ruling 129대로. 렌더·문자수·
   테스트에 영향이 없고, 최종 QA 시점에 31개 산문 파일을 재포맷하는 것은 이득 0에 리뷰 위험만 크다.
3. **고아 용어 3건이 남아 있다** (`term-c-bet`, `term-bluff`, `term-nuts`). WP-7b가 근거 있게
   거절했다 — 세 단어 모두 자기 페이지 밖 산문에 등장하지 않아 `<Term>`을 걸 자리가 없고, 링크를
   걸려고 문장을 신설하는 것은 콘텐츠 작성이지 QA가 아니다. `term-c-bet`은 특히,
   사이트의 259개 `relatedConcepts` 중 248개가 같은 글에 `<Term>`을 갖고 나머지 11개도 단어는
   본문에 있어, 단어가 아예 없는 첫 사례가 됐을 것이다. **새 글로 해결할 문제**이며 블로그 백로그
   (`FISHTILT_BLOG_TOPIC_BACKLOG.md`)의 주제들이 이를 겨냥한다.
4. **`/practice/*` 퀴즈 3개는 113개 레코드 전체에서 인바운드 0**, `hands` 20개 중 11개가
   `relatedArticles: []`. 근거 없는 관계를 만드느니 빈 배열이 낫다는 원칙에 따라 남긴다.
5. **`--container-reading` 축소로 도구 FAQ 6개와 `/learn` 허브가 48→42rem으로 좁아졌다.**
   같은 언어에 같은 논거를 적용한 의도된 결과이고 반응형 실측에서 이상 없음을 확인했지만,
   기사가 아닌 블록에도 기사 measure를 쓰는 것이 맞는지는 취향의 여지가 있다. 되돌리려면 새
   토큰과 측정이 필요하다(ruling 113).
6. **환경변수 실증은 WP-7a가 수행한 것을 재실행하지 않았다.** `NEXT_PUBLIC_SITE_URL`을 바꾼
   빌드에서 `fishtilt.example` 0건 / 새 오리진 2,613건 / sitemap 130/130이 확인됐고, WP-8은 그
   경로의 코드를 건드리지 않았다. 도메인 확정 시점에 다시 한 번 돌리는 것이 맞다.

## 다음 WP에 넘길 사실 요약

- **소스 동결.** 최종 상태: unit 전체 **4428 passed / 3 skipped**, fishtilt+learn-core **1805**,
  e2e **260**, build **133 HTML 전부 정적**, typecheck·lint clean.
- **컨테이너 토큰은 넷이고 값은 `reading 42rem / grid 56rem / shell 72rem / matrix 85rem`.**
  롱폼 5개 템플릿은 전부 `max-w-reading`. `mx-auto max-w-[…]` 리터럴은 0이며 테스트가 막는다.
- **구조화 데이터**: 최상위 7종, FAQ 115질문 전부 화면 실재, 금지 필드 0, 깨진 내부 링크 0.
- **도메인 미정 상태 유지.** `NEXT_PUBLIC_SITE_URL` 하나만 바꾸면 되는 상태다(ruling 110).
- **독립 리뷰가 남았다** (ruling 125). WP-8을 수행한 것이 오케스트레이터이므로 오케스트레이터가
  PASS를 선언하면 CLAUDE.md §12가 막으려는 구조가 된다. 동결을 알리고 외부 리뷰를 받는다.
