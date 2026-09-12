# FishTilt 독립 릴리스 리뷰

리뷰어: 독립 세션 (구현자 아님) · 2026-09-09
대상: `apps/fishtilt` 만. `apps/web` · `packages/*` 는 읽지 않음.
어떤 파일도 수정하지 않았다. (빌드 산출물과 임시 Playwright 스펙만 생성했고, 임시 스펙은 삭제했다.)

---

## 판정

**릴리스 블로커 있음 — 2건.** 둘 다 데이터 정확성 문제가 아니고 둘 다 작은 수정이지만,
둘 다 "한국어 초보자용 학습 사이트"라는 이 제품의 정의 자체를 어긴다.
정직성 축(수치 · 구조화 데이터 · 근거 없는 주장)은 내가 검사한 범위에서 **매우 견고했다** —
JSON-LD 200블록 / FAQ 115쌍 / 링크 전수 대조에서 불일치 0건이었다.

---

## 확인한 방법

| 무엇 | 명령 / 방법 | 숫자 |
| --- | --- | --- |
| 빌드 | `pnpm build:fishtilt` | exit 0, 133 HTML 프리렌더 |
| 단위 테스트 | `pnpm vitest run --project fishtilt --project learn-core` | 146 files / **1805 passed, 0 skipped** |
| E2E | `pnpm e2e:fishtilt` | **260 passed, 0 failed, 0 skipped** (chromium 단독) |
| 프로덕션 서버 | `pnpm exec next start --port 3221` | 직접 브라우저 구동 |
| JSON-LD | `JSON.parse` 로 전 페이지 추출 후, `<script>`/`<style>`/`<!-- -->` **통째 제거 후** 태그 스트립한 가시 텍스트와 대조 | 200 블록 / 파싱 오류 0 |
| 링크 | 빌드된 HTML의 모든 `href="/…"` → 실제 빌드된 라우트 집합과 대조 | 139 라우트, **dangling 0** |
| 수식 | 화면에 렌더된 숫자를 손계산으로 독립 검증 | 아래 참조 |
| 잔재 | ruling 128 방식대로 `src/` 가 아니라 `.next/server/app/**` 를 grep | 아래 참조 |

부가로 read-only 서브에이전트 3개를 병렬로 돌려 (하드코딩 수치 / 근거 없는 주장 / 약화된 테스트)
후보를 모으고, **보고된 항목은 전부 내가 코드와 빌드 산출물에서 직접 재확인했다.**
재확인에서 과대평가로 판명된 것들은 아래 "관찰" 절로 내렸다.

---

## 발견 — 블로커

### B1. 404 · 500 페이지가 영어이고, 404가 홈페이지의 `<title>`/`description` 을 달고 나간다

`apps/fishtilt/src/app/` 에 **`not-found.tsx` · `error.tsx` · `global-error.tsx` 가 하나도 없다.**
그래서 Next.js 기본 영어 페이지가 그대로 배포된다.

재현:

```
$ curl -s http://127.0.0.1:3221/nope | grep -o '<title>[^<]*</title>\|lang="[a-z]*"'
lang="ko"
<title>무료 홀덤 학습 · FishTilt</title>        ← 루트 layout 의 기본 metadata
<title>404: This page could not be found.</title>  ← Next 기본 404
```

문제가 넷 겹쳐 있다:

1. **`lang="ko"` 인 문서에 영어 본문**만 있다. 사이트 전체에서 유일한 비한국어 화면이다.
2. **`<title>` 이 두 개다.** 유효하지 않은 HTML이고, 브라우저·크롤러·링크 프리뷰는 첫 번째를
   쓰므로 **에러 페이지의 탭 제목과 미리보기가 "무료 홀덤 학습 · FishTilt"** 가 된다.
   `<meta name="description">` 도 홈페이지 것이 그대로 붙는다. 즉 404가 자기를 홈페이지라고 소개한다.
3. `<main>` 랜드마크가 없다. (다른 132개 페이지는 전부 정확히 1개씩 있다.)
4. `.next/server/app/_global-error.html` 은 `<html id="__next_error__">` — **`lang` 속성 자체가 없고**
   `<title>500: This page couldn't load</title>` 다. 클라이언트 컴포넌트가 던지면 이 화면이 뜬다.

**타이핑 실수만의 문제가 아니다.** `notFound()` 가 4개 동적 라우트에서 호출된다 —
`src/app/learn/[slug]/page.tsx:79,82`, `src/app/blog/[slug]/page.tsx:84,88`,
`src/app/glossary/[slug]/page.tsx:67`, `src/app/hands/[hand]/page.tsx:125,127`.
비공개 슬러그·오래된 외부 링크·크롤러가 전부 여기로 떨어진다.

**왜 아무도 못 봤는지도 확인 가능하다.** E2E는 상태 코드만 보고 화면은 보지 않는다:

- `tests/e2e/glossary.spec.ts:109-111` — `expect(response?.status()).toBe(404);`
- `tests/e2e/blog.spec.ts:283` — 같은 형태

두 테스트 모두 사용자를 이 페이지로 몰아넣고, 렌더된 내용은 한 줄도 검사하지 않는다.

---

### B2. `describeHandClassKorean` 이 169개 중 48개 핸드 클래스에서 **비문(非文) 한국어**를 만든다

`src/features/range/copy.ts:238-250`

```ts
case 'SUITED':
  return `같은 무늬의 ${high}와 ${low}`;   // ← 와/과 하드코딩
case 'OFFSUIT':
  return `다른 무늬의 ${high}와 ${low}`;
```

`와`/`과` 는 앞 음절의 받침으로 갈린다. `RANK_READING` 이 돌려주는 `high` 가
`3`(삼) · `6`(육) · `7`(칠) · `8`(팔) · `10`(십) 이면 **`과` 가 맞고 `와` 는 틀린다.**

라이브 서버에서 13×13 표의 칸을 눌러 재현 (`/tools/range`):

```
T9s -> 같은 무늬의 10와 9    ✗ (10과)
87s -> 같은 무늬의 8와 7      ✗ (8과)
76s -> 같은 무늬의 7와 6      ✗ (7과)
65s -> 같은 무늬의 6와 5      ✗ (6과)
32s -> 같은 무늬의 3와 2      ✗ (3과)
98s -> 같은 무늬의 9와 8      ✓
54s -> 같은 무늬의 5와 4      ✓
```

- **169개 중 48개** (high rank ∈ {3,6,7,8,T} 이고 페어가 아닌 모든 클래스, 약 28%) 가 틀린다.
- **프리렌더된 8개 페이지에 이미 박혀 있다:**
  `/learn/starting-hands`, `/learn/starting-hand-ranking`, `/learn/preflop`, `/learn/position`,
  `/blog/why-suited-matters`, `/blog/why-72o-is-weak`, `/glossary/bluff`, `/hands/t9s`
- **인터랙티브로는 더 넓다.** `describeHandClassKorean` 은 `PokerCards.tsx:55`,
  `SelectedHandPanel.tsx:73`, `app/hands/[hand]/page.tsx:161`,
  `features/quiz/rangeQuestions.ts:119` 에서 쓰인다 — 즉 레인지 탐색기 · 시작 핸드 탐색기 ·
  홈 미리보기의 **모든 칸 클릭**과 **레인지 퀴즈 해설**이 대상이다.

**같은 페이지에서 두 철자가 동시에 보인다:**

```
$ curl -s http://127.0.0.1:3221/hands/t9s | grep -o "같은 무늬의 10[과와] 9" | sort | uniq -c
  12 같은 무늬의 10과 9     ← 손으로 쓴 레코드 title / MDX 산문
   4 같은 무늬의 10와 9     ← describeHandClassKorean 이 만든 문자열
```

`src/content/registry/hands/e3.ts:24` 는 레코드 title 이 "`describeHandClassKorean` 패턴을 그대로
따른다"고 적어 두었는데, 실제로는 이미 갈라져 있다.

**이 파일은 이 버그 유형을 이미 한 번 겪고 고쳤다.** 같은 파일 `copy.ts:63-88` 의
`hasBatchim()` / `josaIran()` 은 주석에 이렇게 적혀 있다 —
*"`${RANGE_LABEL}이란` 이 하드코딩되어 `학습용 기본 레인지이란` 을 렌더했다 — 대표 페이지 `<h2>` 의 문법 오류"*.
`이란/란` 은 계산하도록 고쳤고, 스물몇 줄 아래의 `와/과` 는 하드코딩으로 남았다.

> 수정 시 주의: `hasBatchim('10')` 은 `10` 이 한글 음절이 아니라 **false** 를 돌려준다.
> 받침 판정은 표기(`10`)가 아니라 **읽기(`십`)** 를 기준으로 해야 한다.
> 이미 있는 `RANK_SPOKEN` 이 아니라 숫자 읽기용 매핑이 하나 더 필요하다.

---

## 발견 — 블로커는 아니지만 고칠 가치가 있는 것

### N1. 프로젝트가 스스로 금지한 최상급이 다른 두 페이지에 살아 있다

`docs/FISHTILT_STATE.md` ruling 101 (2167행) 이 명시적으로 판정했다 —
*"`가장 널리 쓰이는 세는 방식` … 출처 없는 최상급 유행도(prevalence) 주장"*.
가드 테스트도 있다:

- `src/content/registry/blog/i4.test.ts:380` — `expect(source, 'no unsourced superlative about prevalence').not.toMatch(/가장\s*널리/u);`

그런데 그 가드는 **`why-called-3bet.mdx` 한 파일에만 걸려 있다.** 같은 문장이 살아서 배포된다:

- `content/learn/outs.mdx:64` — "이것은 이 사이트만의 방식이 아니라, 아웃을 세는 **가장 널리 쓰이는** 방법입니다."
- `content/blog/outs-nine.mdx:27` — "이것은 이 사이트만의 방식이 아니라 아웃을 세는 **가장 널리 쓰이는** 방법입니다."

빌드 산출물에서 확인: `.next/server/app/learn/outs.html`, `.next/server/app/blog/outs-nine.html`.

같은 계열 표현이 UI에도 있다 — `src/features/tools/faq.ts:151`
"이건 이 사이트의 선택이 아니라 **어디서나 쓰는 표준적인** 세는 방식입니다."

**사이트가 자기 자신과 모순된다.** `content/blog/why-called-3bet.mdx:17` 은
"다른 세는 방식이 실제로 널리 쓰인다는 근거는 이 사이트에 없고, **없는 근거를 있는 것처럼 쓰지 않습니다**"
라고 선언한다. 두 클릭 거리에서 정반대를 한다.

### N2. FAQ 섹션 7곳이 "가장 많이 받는 질문"이라고 말한다 — 받은 적이 없다

이 사이트는 계정도, 로그인도, 문의 채널도, 애널리틱스도 없다
(`src/lib/seo/jsonLd.ts:56` 이 "no postal address and contact point" 라고 적어 둠).

- `src/app/page.tsx:662` — "이 사이트에 대해 **가장 많이 받는** 질문입니다."
- `src/app/tools/equity/page.tsx:86` — "승률 계산기를 쓰다 **가장 자주 나오는** 질문입니다."
- `src/app/tools/pot-odds/page.tsx:80` — "**가장 자주 묻는** 것들입니다."
- `src/app/tools/outs/page.tsx:81` — "**가장 자주 막히는** 지점들입니다."
- `src/app/tools/hand-checker/page.tsx:86` — "**가장 자주 헷갈리는** 것들입니다."
- `src/app/tools/range/page.tsx:103` — "**가장 먼저 묻는** 것들입니다."
- `src/app/tools/starting-hand/page.tsx:104` — "**가장 자주 오해되는** 부분입니다."
- `src/features/tools/faq.ts:123` — "초보자가 **가장 많이 틀리는** 부분이라…"

이 프로젝트는 **정확히 같은 이유로** 이미 두 번 물러선 적이 있다:
`src/app/page.tsx:27,468` 이 `인기 무료 도구` 제목을 없앤 이유를,
`src/app/blog/page.tsx:21` 이 `많이 읽은 글` 정렬을 거부한 이유를 각각 기록해 두었다.
FAQ 설명문만 그 스윕에서 빠졌다.

바로 옆 홈페이지 문구가 이미 정답 형태를 보여준다 —
`"사이트에 실제로 답이 있는 질문만 모았습니다"` (검증 가능, 최상급 없음).

### N3. "실제로 여는 패" — 관측된 플레이라는 뜻의 표현이 콘텐츠 4곳에 남아 있다

`src/app/tools/starting-hand/page.tsx:126-129` 에 규칙이 주석으로 박혀 있다:

> `"실제 어떤 패를 플레이하는지"` / `"실제로 어떤 패를 여는지"` read as a description of
> what players actually do at tables — **a claim this site has no data for** — and dropped the
> `학습용 기본 레인지` label every other surface attaches to that table.

레인지 표는 교육 자료 한 곳에서 옮겨 온 것이지 실제 플레이 관측치가 아니다. 그런데:

- `content/learn/hand-matrix.mdx:93` — 퀴즈 **보기**: `'각 자리에서 실제로 쓰는 패가 달라서'`
- `content/learn/hand-matrix.mdx:96` — 퀴즈 **정답 해설**: "그 자리에서 **실제로 여는 패**가 달라서…"
- `content/learn/starting-hand-ranking.mdx:21, :97`
- `content/blog/is-ak-good.mdx:39`

`hand-matrix.mdx` 가 특히 나쁘다 — 이 표현이 **퀴즈의 정답**이라, 독자에게 오라벨을 가르친다.

### N4. `glossary/preflop.mdx` — 유행도 주장 + 테이블 판단 권유 + 라벨 누락

- `content/glossary/preflop.mdx:15` — "그래서 자리별로 **자주 쓰이는** 시작 패를 미리 정리해 둔
  표를 **참고하는 것이 프리플랍 판단의 출발점이 됩니다.**"
- `content/glossary/preflop.mdx:5` — "이 단계에서 **자주 참고하는 것이** 자리별로 미리 정리해 둔 레인지입니다."

세 가지가 겹친다: (a) `자주 쓰이는` = 실제 플레이 유행도 주장(근거 없음),
(b) 테이블에서의 *판단*의 출발점이라는 권유 — 다른 모든 화면은 *학습*의 출발점이라고 말한다,
(c) `학습용 기본 레인지` 라벨이 빠져 있다. 초보자가 "프리플랍"을 찾아 처음 읽는 용어 항목이다.

`src/copy-guards.test.ts` 의 GUARD 1 이 이걸 못 잡는 건 정상이다 —
그 정규식은 테이블 액션(`콜|폴드|레이즈|…`) 뒤의 권유만 본다. `참고하는 것이` 는 대상이 아니다.

### N5. skip link 이 없다 (WCAG 2.4.1)

`src/app/layout.tsx:69-79` 는 `SiteHeader` → `<div>{children}</div>` → `SiteFooter` 뿐이다.
`skip` / `본문으로` / `건너뛰기` grep 결과 0건. 라이브에서 확인한 **첫 번째 Tab 정지점은 FISHTILT 로고**다.

`<main>` 랜드마크가 전 페이지에 정확히 1개씩 있어서 스크린리더 사용자는 우회할 수 있지만
(ARIA11 은 2.4.1 의 충족 기법이다), **스크린리더 없는 키보드 전용 사용자**는 모든 페이지에서
네비 링크 6개 + 검색 + 테마 + 햄버거를 매번 지나야 한다.

### N6. `/tools/equity` 는 JS 없이 "계산 중입니다"에서 영원히 멈춘다

`.next/server/app/tools/equity.html` 의 가시 텍스트:

```
결과
계산 중입니다
잠시만 기다려주세요.
```

`/tools/pot-odds` · `/tools/hand-checker` · `/tools/outs` 는 전부 초기 결과를 SSR한다
(각각 25.0%, 투페어, 34.97% 를 확인했다). equity 만 Web Worker 경로라 SSR하지 않는다.
JS가 꺼졌거나 실패하면 "계산 중"이라고 **거짓말하는 상태**로 고정된다.
`<noscript>` 도 없다. (계산기가 JS를 요구하는 것 자체는 정당하다 — 문제는 문구다.)

### N7. 테스트가 이름이 약속한 것을 검사하지 않는 지점

전체 스위트는 매우 규율 있다 (1805 + 260 통과, skip 0, `.only` 0, 스냅샷 0, 삼킨 catch 0).
다만 다음 4개는 실제로 통과해도 아무것도 보장하지 않는다:

- `src/content/graph.test.ts:112` — `if (!route.available) return;` 뒤에 assertion이 없다.
  같은 파일 36행이 `vi.mock('../lib/routes.js')` 로 라우트 가용성을 조작하므로,
  mock 을 한 id 넓히면 이 테스트는 **조용히 0개 검사로 통과**한다.
  (다른 조기 반환들은 전부 앞에 `expect(...).toBeDefined()` 가 붙어 있다.)
- `src/features/tools/faq.test.ts:99-104` — `it('resolves every follow-on link through the registry…')`
  인데 `if (href === null) continue;` 로 **죽은 라우트 케이스를 건너뛴다.**
  `toolHref` 가 `null` 을 돌려주는 경우가 정확히 이 테스트가 잡아야 할 실패 모드다
  (`graph.test.ts:107` 이 그 계약을 고정하고 있다).
- 비어 있을 수 있는 컬렉션 위의 루프에 non-emptiness 가드가 없는 곳 ~12개:
  `src/app/page.test.tsx:266` (`querySelectorAll` 은 0개여도 조용하다),
  `tests/e2e/seo.spec.ts:503-520` (바로 다음 테스트 `:542` 는 가드를 넣었다),
  `tests/e2e/responsive-a11y.spec.ts:217,242`,
  `registry/{blog/i1..i4, glossary/j1, learn/h1..h3, hands/e3}.test.ts` 의 `matchAll` 루프.
  **이 레포는 이미 정답을 알고 있다** — `src/content/claims.test.ts:237` 이
  `expect(seen).toBeGreaterThan(0)` 을, `registry/glossary/j2.test.ts:231` 이 `not.toBeNull()` 을 쓴다.
- `metadata.description).toBeTruthy()` 11곳 (`app/tools/*/page.test.tsx`, `app/practice/*/page.test.tsx`).
  한 글자짜리 description 도 통과한다. 같은 테스트가 바로 위에서 `title` 은 실제 문구로 검사한다.

### N8. `NEXT_PUBLIC_SITE_URL` 미설정을 경고하는 것이 아무것도 없다

`src/lib/seo/site.ts` 의 `.example` 플레이스홀더 선택 자체는 **옳다** — RFC 2606 예약 도메인이라
절대 resolve되지 않고, 문서에 배포 요구사항으로 적혀 있다. 하드코딩된 그럴듯한 도메인보다 낫다.

다만 `SITE_ORIGIN_IS_PLACEHOLDER` 는 **`src/lib/seo/index.ts:51` 에서 re-export될 뿐 아무도 읽지 않는다.**
`NEXT_PUBLIC_SITE_URL` 을 잊고 빌드하면 133개 canonical, sitemap 전체, 모든 `og:url`,
모든 JSON-LD `url`/`@id` 가 `https://fishtilt.example` 를 가리키고 **아무것도 실패하지 않는다.**
빌드 경고 한 줄이면 막힌다.

---

## 발견 — 관찰 (고칠 필요 없음, 또는 판단이 필요한 것)

- **`169` / `1,326` / `아홉 가지` 를 산문에 직접 타이핑한 곳이 MDX 14개 파일에 ~50곳 있다**
  (`learn/starting-hand-ranking.mdx` 만 12곳, `glossary/hand-matrix.mdx:15` 는 한 줄에 3곳).
  `facts.ts` 헤더가 선언한 규율("MDX never writes a number")과는 어긋난다.
  **하지만 CLAUDE.md 규칙 2 위반은 아니다** — 이건 GTO 수치가 아니라 52장 덱의 불변 상수이고,
  내가 확인한 모든 인스턴스가 **정확하다**. 값이 변할 수 없으므로 stale 위험도 0이다.
  블로커로 승격시키지 않는다. (`CATEGORY_COUNT` 팩트가 없어서 `아홉 가지` 는 현재 대안도 없다.)
- **레인지 멤버십을 손으로 쓴 문장 4곳** — `hands/22.mdx:13`, `hands/a5s.mdx:17`,
  `blog/btn-why-wide.mdx:31`, `learn/position.mdx:46`.
  라이브 표를 눌러 **전부 사실임을 확인했다** (65s = BTN·SB만, 87s = UTG만 제외,
  22 = SB만, A5s = 5자리 전부, AA~88 = 5자리 전부).
  다만 이건 `RFI_POSITIONS_WITH` 가 계산할 수 있는 값의 여집합을 손으로 쓴 것이라,
  레인지 데이터셋이 바뀌면 조용히 거짓이 된다. 지금은 문제 아님, 나중에 문제.
- `src/app/page.tsx:270` — "배우기 첫 편부터 위에서 아래로 읽는 순서가 **가장 빠릅니다**."
  비교 대상도 측정도 없는 학습 속도 최상급. 한 단어 수정.
- 320px 에서 브레드크럼 `홈` 링크의 히트 영역이 **12×44px** (`/tools/range`, `/practice/range-quiz`).
  높이는 충분하나 폭이 WCAG 2.5.8 의 24px 최소치 미만.
- `SiteHeader.tsx:171` — `aria-controls="fishtilt-mobile-nav"` 가 패널이 닫혀 있을 때
  존재하지 않는 id 를 가리킨다. 패널을 CSS로 숨기지 않고 조건부 렌더하는 선택 자체는 옳다
  (닫힌 메뉴에 탭 포커스가 들어가지 않는다). `aria-expanded` 가 있어 실사용 영향은 낮다.
- 블로그 제목 `suited hand가 좋은 이유` 만 라틴/한글 혼용이다. 나머지 19편은 전부 한국어.
- `sitemap.xml` 의 홈 `<loc>` 이 `https://fishtilt.example` (트레일링 슬래시 없음).
  canonical 과 일치하므로 모순은 없다.

---

## 확인했고 문제 없었던 것

이 절이 리뷰 범위를 드러낸다. 아래는 전부 **실제로 검사해서 통과한** 항목이다.

### 구조화 데이터 (JSON-LD) — 전부 깨끗

133페이지에서 **200개 블록**을 `JSON.parse` 로 읽었다 (정규식 아님 — 파싱 실패 0건).
가시 텍스트는 `<script>`/`<style>`/`<template>`/주석을 **통째로 제거한 뒤** 태그를 벗겨 만들었다
(그렇게 하지 않으면 JSON-LD 본문이 남아 모든 블록이 자기 자신과 매칭된다).

| 검사 | 결과 |
| --- | --- |
| FAQPage Q/A 115쌍 — 질문과 **답변 본문 모두** 화면에 존재하는가 | **불일치 0** |
| Article `headline` 35개 == 그 페이지의 유일한 `<h1>` | **불일치 0** |
| 모든 JSON-LD `description` == 그 페이지의 `<meta name="description">` | **드리프트 0** |
| CollectionPage 6개: `numberOfItems` == `itemListElement.length` | **불일치 0** |
| CollectionPage 모든 `ListItem.name` 이 화면에 보이는가 | **불일치 0** |
| BreadcrumbList 130개: 모든 `name` 이 화면에 보이는가 | **불일치 0** |
| 모든 JSON-LD URL(`url`/`@id`/`isPartOf`/`publisher`/`ListItem`/breadcrumb) 이 실제 라우트인가 | **dangling 0** |
| `aggregateRating` · `review` · 조작된 평점 | **없음** |

`WebApplication` 6개는 `isAccessibleForFree: true` / `price: "0"` 을 선언하는데, 실제로 무료다
(계정·로그인·결제 없음 — `/about` 과 홈 FAQ가 같은 말을 하고, 그게 사실이다).

### 링크와 라우팅

- 빌드된 HTML의 내부 `href` 전수 대조 → **dangling 0** (라우트 139개).
- 외부 `href` 는 canonical(`https://fishtilt.example/…`)뿐. 제휴/입금/아웃바운드 링크 **0개**.
- `src/lib/routes.ts` 의 18개 라우트 전부 `available: true` 이고 전부 빌드된다.
  약속만 하고 없는 기능 없음. 미출시 데이터셋(FACING_OPEN, 2/9인, 40/60/150BB)은
  링크가 아닌 비활성 `준비 중` 배지로 렌더된다.
- `/search` 는 `<meta name="robots" content="noindex, follow">` 를 보낸다.
  `robots.txt` 는 전면 허용 + sitemap 명시. 이 조합이 맞다 (Disallow 는 noindex 를 못 읽게 만든다).
- ruling 128 의 잔재 `핸드레인지 탐색기` → **빌드 산출물에서 0건.** 그 수정은 실제로 안착했다.

### 수치 — 화면 값을 손계산으로 독립 검증

| 화면 | 값 | 검산 |
| --- | --- | --- |
| `/blog/how-often-aa` | AA 6조합 / 0.45% / 약 221번에 한 번 | 6/1326 = 0.4525%, 1326/6 = 221 ✓ |
| 〃 | AKs 약 332, AKo 약 111 | 1326/4 = 331.5→332, 1326/12 = 110.5→111 ✓ ("약" 명시함) |
| `/blog/outs-nine` | 9아웃 플랍→리버 34.97% | 1 − C(38,2)/C(47,2) = 0.349676 ✓ |
| 〃 | 다음 카드 19.15% | 9/47 = 0.191489 ✓ |
| 〃 | ×4 규칙 36.00% | 9×4 ✓ ("정확한 34.97%보다 살짝 높습니다" — 방향도 맞음) |
| 〃 | 팟 9BB / 벳 3BB → 20.00% | 3/(9+3+3) ✓ |
| `/tools/pot-odds` | 팟 10 / 벳 5 → 25.0%, 3:1, 4번 중 1번 | 5/20 ✓, 15:5 ✓ |
| 〃 | 턴만: 최소 12아웃 (25.5%) | 12/47 = 25.53% ✓, 11/47 = 23.4% < 25% ✓ |
| 〃 | 리버까지: 최소 7아웃 (27.8%) | 1 − C(40,2)/C(47,2) = 27.85% ✓, 6아웃 = 24.1% < 25% ✓ |
| `/tools/equity` | AA vs KK = 82.4 / 0.5 / 17.1 | 표준값 82.36 / 0.55 / 17.09 ✓ |
| 〃 | "1,712,304가지를 모두 계산했습니다" | C(48,5) = 1,712,304 ✓ (표본추출 아님) |
| `/tools/hand-checker` | 투페어 = "9개 족보 중 7번째" | SF·쿼드·풀·플러시·스트·트립스·투페어 ✓ |

**RFI 레인지 5자리 전부** (라이브에서 버튼을 눌러 추출):
UTG 226콤보 17.0% · HJ 280 21.1% · CO 368 27.8% · BTN 568 42.8% · SB 622 46.9%.
단조 증가하고, 6-max 100BB 공개 차트의 통상 범위 안이다.
BB 는 에러가 아니라 설명으로 처리된다 ("빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다…").

`factValue` (`src/content/facts.ts`) 는 미지의 이름·잘못된 인자·frozen 매치업 밖의 쌍에서
**전부 throw** 한다. 폴백 없음. 즉 **빌드 성공 자체가 모든 `<Fact>` 가 실제로 계산됐다는 증거**다.

### 출처 표기 · GTO 경계

- 사이트 전체에 provenance 문장이 **하나**뿐이고 상수 하나로 관리된다
  (`src/features/range/copy.ts:192` `RANGE_PROVENANCE_SENTENCE`).
  "공개된 무료 포커 교육 자료 **한 곳**의 … 차트를 그대로 옮긴 학습용 기본 레인지" —
  단일 출처임을 인정하고, SB만 이 사이트가 재계산했음을 밝힌다.
- `/about` 은 "**솔버를 돌려 만든 값은 아닙니다**" 라고 명시한다.
- 사용자에게 보이는 문구 어디에도 **"GTO" 가 없다** (grep 확인). 표는 항상
  `학습용 기본 레인지` + `6인 · 100BB · 아무도 참여하지 않았을 때` 조건과 함께 렌더된다.
  모든 레인지 화면이 "정답이 아니라 출발점" 을 덧붙인다.
- 미지원 조합은 그럴듯한 값을 만들지 않고 "아직 준비되지 않았습니다" 를 돌려준다
  (`resolve.ts` 216개 쿼리 포인트 전부가 두 갈래 중 하나로 떨어짐).

### 테이블 액션 권유 / 수익성 주장

`src/copy-guards.test.ts` 의 정규식과 refusal marker 를 직접 읽고 교정 논리를 확인한 뒤
(`않기 때문` 은 refusal 이 아니라는 판단, `아니려면` 은 허용이라는 판단 — 둘 다 옳다),
산출물에서 재확인했다. **콜/폴드/레이즈를 하라고 말하는 곳이 없다.**
`이득/손해` 용법은 전부 팟오즈 손익분기점이고 항상 거부 문장과 짝지어 있다
(예: `/blog/outs-nine` — "이 비교는 손익분기점을 확인하는 것이지, **콜하라는 뜻이 아닙니다** …
실제로 콜할지는 이 사이트가 대신 정해주지 않습니다").

### 제품 경계

화면 인식 · OCR · 화면 캡처 · 클라이언트 자동화 · 입력 주입 · 스크래핑 · 자동 플레이 —
**하나도 없다** (grep: `screen capture|screenshot|ocr|automation|scrape|inject|puppeteer` → 코드 히트 0).
`/about` 과 홈 FAQ가 제휴 없음·실제 머니 게임과 무관함을 명시하고, 실제로 그렇다.
`glossary/vpip.mdx:9` 는 "FishTilt는 상대의 플레이 기록을 수집하거나 추적하는 기능이 없으므로,
VPIP를 계산하거나 보여주지 않습니다" 라고 스스로 선을 긋는다.

### 접근성 · 반응형 (B1/N5/관찰 항목 제외)

- 132개 페이지 전부: `<main>` 정확히 1개, `lang="ko"`, 모든 `<img>` 에 `alt`, `<title>` 정확히 1개.
- **320px 에서 가로 오버플로 0** — 11개 주요 라우트에서 `scrollWidth` vs `clientWidth` 직접 측정
  (`/`, `/tools/range`, `/tools/equity`, `/tools/starting-hand`, `/tools/hand-checker`,
  `/practice/range-quiz`, `/learn/poker-range`, `/blog/qq-vs-ak`, `/glossary`, `/hands/aks`, `/search`).
- 모바일 네비는 CSS로 숨기지 않고 조건부 렌더된다 — 닫힌 메뉴에 키보드 포커스가 들어가지 않는다.
- 13×13 매트릭스 셀에 의미 있는 접근 가능한 이름이 붙는다
  (`"AKs 에이스 킹 수티드, 레인지 포함"` — 키 + 읽기 + 멤버십).
- 포지션 버튼도 마찬가지 (`"언더더건(UTG) 자리"` — `UTG` 를 "유 티 지" 로 읽지 않게).
- 콘솔 에러 · 페이지 에러: 내가 방문한 모든 라우트에서 **0건**.

### 기능 동작 (직접 구동)

- 검색: `팟오즈` → 4개 결과 (용어·읽을거리·도구·강의 교차). 빈 결과는 정직하게
  "결과를 찾지 못했습니다" + 둘러보기 링크. 그럴듯한 대체 결과를 만들지 않는다.
- 테마 토글: `data-theme` 전환 + `localStorage['fishtilt-theme']` 저장 + no-flash 인라인 스크립트 존재.
- 족보 퀴즈 / 레인지 퀴즈: 정상 진행. 레인지 퀴즈는 미지원 조건을 비활성 `준비 중` 으로 정직하게 표시.
- 404 는 HTTP **404** 를 실제로 반환한다 (소프트 404 아님) — 문제는 상태 코드가 아니라 내용이다(B1).

---

## 리뷰의 한계

- **`packages/*` 와 `apps/web` 을 읽지 않았다** (지시). 따라서 검증하지 못한 것:
  (a) `RANGE_PROVENANCE_SENTENCE` 마지막 절이 주장하는 "다른 두 자료가 말하는 범위와도 맞습니다"
  라는 3중 교차검증 — 그 두 자료는 사이트 어디에도 이름이 없어 **독자도 확인할 수 없다.**
  누가 소유할지 결정이 필요하다(출처를 밝히거나 문장을 빼거나).
  (b) `learn-core`/`strategy-core` 의 strength·equity·categoryFrequency 데이터셋 자체.
  나는 **출력값만** 손계산으로 검증했다(위 표). 데이터셋 생성 로직은 보지 않았다.
- **chromium 단독.** 실제 iOS/Android Safari, 실제 스크린리더(VoiceOver/NVDA),
  색 대비 전수 감사는 하지 않았다. 오버플로/탭 순서/접근 가능한 이름만 프로그램적으로 확인했다.
- **성능/부하 측정 없음.** equity worker 의 throttled 벤치마크는 기존 보고서의 주장을 그대로 두었다.
- **113개 MDX 산문을 포커 내용 정확성 기준으로 통독하지는 않았다.** 계산된 수치, 링크,
  최상급/권유/유행도 표현 패턴, 그리고 서브에이전트가 올린 후보만 확인했다.
- 지시대로 `docs/reports/FISHTILT_WP*.md` 는 **판단을 끝낸 뒤에** 열지 않았다 — 전혀 읽지 않았다.
  `docs/FISHTILT_STATE.md` 는 ruling 101 과 128 두 건만, 내가 코드에서 먼저 찾은 것을
  대조하기 위해 읽었다.

---

## 요약 표

| # | 심각도 | 내용 | 위치 |
| --- | --- | --- | --- |
| B1 | 블로커 | 404·500 이 영어 + 404가 홈페이지 title/description + `<title>` 중복 + `<main>` 없음 | `src/app/` (not-found/error 파일 부재) |
| B2 | 블로커 | 와/과 하드코딩 → 169개 중 48개에서 비문 한국어, 8페이지 + 전 매트릭스 클릭 | `src/features/range/copy.ts:245,247` |
| N1 | 중 | ruling 101이 금지한 `가장 널리 쓰이는` 이 2개 published 페이지에 잔존 | `content/learn/outs.mdx:64`, `content/blog/outs-nine.mdx:27` |
| N2 | 중 | "가장 많이 받는 질문" 7곳 — 받은 적 없음 | `src/app/page.tsx:662` 외 6 + `features/tools/faq.ts:123` |
| N3 | 중 | "실제로 여는 패" 4곳 (1곳은 퀴즈 정답) | `content/learn/hand-matrix.mdx:93,96` 외 3 |
| N4 | 중 | 유행도 주장 + 테이블 판단 권유 + 라벨 누락 | `content/glossary/preflop.mdx:5,15` |
| N5 | 하 | skip link 없음 | `src/app/layout.tsx:73-77` |
| N6 | 하 | JS 없으면 "계산 중입니다" 영구 고정 | `/tools/equity` |
| N7 | 하 | 이름이 약속한 걸 검사 안 하는 테스트 4계열 | `graph.test.ts:112`, `faq.test.ts:104` 외 |
| N8 | 하 | 플레이스홀더 도메인 경고 없음 | `src/lib/seo/site.ts` (플래그가 소비되지 않음) |
