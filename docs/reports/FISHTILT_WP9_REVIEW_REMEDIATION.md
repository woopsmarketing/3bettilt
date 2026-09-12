# FISHTILT WP-9 — 독립 리뷰 지적사항 시정

> 이 WP는 계획에 없던 것이다. WP-8(최종 QA) 뒤에 붙인 fresh-context 독립 리뷰가
> **릴리스 블로커 2건 + 비블로커 8건**을 냈고, WP-8 보고서의 "릴리스 블로커 없음"이
> 틀렸음이 확인되어 열었다. 리뷰 원문: `docs/reports/FISHTILT_INDEPENDENT_REVIEW.md`.

## 목표

독립 리뷰가 낸 B1·B2를 실제로 없애고, N1–N8을 판정한다. 그리고 **각 지적이 다시
들어올 수 없게** 인스턴스가 아니라 결함 클래스에 테스트를 건다. 보고서가 아니라
빌드 산출물에서 확인한다.

## 범위

- `apps/fishtilt/src/app/` — `not-found.tsx`·`error.tsx`·`global-error.tsx` 신규, `layout.tsx`, `sitemap.ts`
- `apps/fishtilt/src/features/range/copy.ts` — 조사 선택
- `apps/fishtilt/src/components/EquityCalculator.tsx` — no-JS 상태
- `apps/fishtilt/src/copy-guards.test.ts` — 사이트 전역 카피 가드 2종 추가 + `proseOf` 확장
- `apps/fishtilt/content/**` 7개 MDX + `src/app/**/page.tsx` 7개 FAQ 설명문 — 카피 시정
- `apps/fishtilt/tests/e2e/` — `not-found.spec.ts` 신규, `theme-and-header.spec.ts`·`home.spec.ts`·`responsive-a11y.spec.ts` 갱신
- 범위 밖: `packages/*`, `apps/web`, MDX Prettier 드리프트(ruling 129)

## 확인한 기존 상태

리뷰 주장을 그대로 믿지 않고 전부 코드·빌드 산출물에서 재측정했다.

| 항목 | 리뷰 주장 | 내 측정 | 판정 |
| --- | --- | --- | --- |
| B1 404 | `<title>` 2개, 첫 번째가 홈페이지 것 | `['무료 홀덤 학습 · FishTilt', '404: This page could not be found.']`, `<main>` 없음 | **사실** |
| B1 500 | `lang` 없음, 영어 title | `lang=없음`, `500: This page couldn't load` | **사실** |
| B2 조사 | `copy.ts:245,247`이 `와` 하드코딩 | 사실. `RANK_READING`은 라틴/숫자라 `hasBatchim` 직접 적용 불가 | **사실** |
| N1 최상급 | 가드가 1개 파일에만 걸림 | 사실. 게다가 `proseOf`가 `<Quiz>` 전체를 삭제 중이었음 | **사실 + 더 넓음** |
| N3 관측 표현 | 4곳 | 4곳 + 가드 확장 후 **5번째** 발견 | **사실 + 1건 추가** |
| N7 무단언 테스트 | 4계열 | `graph.test.ts` 1건 실재. 나머지 대부분은 이미 선행 단언 있음 | **부분적 사실** |
| N8 미사용 플래그 | export만 되고 소비 없음 | 사실 (`site.ts` 선언 + 배럴 재export 뿐) | **사실** |

기존 상태에서 **리뷰가 틀린 것**: N7은 "4계열"이라 했지만 서브에이전트가 전수 조사한 결과
`copy-guards.test.ts`·`content.test.ts` 등의 early return은 진짜 필터였고, 실제로 단언이
없던 것은 2건이었다.

## 구현 내용

### B1 — 한국어 오류 페이지 (블로커)

`src/app/not-found.tsx` 신규. 라우트 레지스트리로만 목적지를 만들고(리터럴 경로 없음),
`<main>` 랜드마크 1개, 한국어 `<h1>`, 그리고 **`alternates: null` / `openGraph: null` /
`twitter: null`** — 첫 빌드에서 메타데이터가 루트 layout과 병합되어 홈페이지 canonical을
상속하는 것을 발견했기 때문이다(ruling 131).

`src/app/error.tsx`·`src/app/global-error.tsx` 신규. `global-error`는 루트 layout을 대체하므로
**`src/`에서 아무것도 import하지 않는다** — 이 경계가 처리하는 실패의 용의자가 곧 모듈
그래프와 스타일시트다. 색과 폰트 스택은 토큰 값을 문자 그대로 복사하고,
`global-error.test.tsx`가 `globals.css`를 다시 읽어 복사본이 어긋나지 않았음을 검사한다.

**500 정적 셸은 고칠 수 없다** — `_global-error.html`은 Next이 스스로 만드는 합성 라우트의
렌더이고, `route-discovery.js`가 `builtin/app-error`에 하드와이어 해 둔다. 프레임워크
한계로 기록했다(ruling 130). 실제 방문자가 닿는 런타임 경계는 우리 컴포넌트다.

### B2 — 와/과 조사 (블로커)

`RANK_FOR_JOSA`(한자어 수사 + 문자 이름) + `josaWaGwa()`. `RANK_SPOKEN`은 포커 발음 주석
(`에이트`, `쓰리`)이라 문제가 되는 랭크에서 정확히 어긋나므로 쓸 수 없었다.
기존 테스트는 `expect(...length).toBeGreaterThan(0)` — 깨진 한국어에도 참인 동어반복이었고,
169개 클래스 전수 조사 + 8개 명시 케이스로 교체했다.

### N1·N2·N3·N4 — 카피 (중)

17곳 시정. 그리고 인스턴스가 아니라 클래스를 고정했다:

- **GUARD 3** — 사람의 행동/유행도에 대한 최상급 금지. `가장 강한 패`·`가장 먼저 액션하는
  자리`는 홀덤의 규칙이라 잡지 않는다. `가장`이 *사람이 하는 일*에 붙을 때만 잡는다.
- **GUARD 4** — 레인지 표를 "실제로 여는 패"로 서술 금지. 부정문(`…라는 뜻은 아닙니다`)은
  허용해야 하므로 기존 `REFUSAL_MARKERS`를 재사용한다.
- **`proseOf` 확장** — MDX의 `<Quiz>` prop 안 한국어를 다시 산문 스트림에 넣는다.
  이것이 없으면 퀴즈 문제·보기·정답 해설 전체가 **모든 카피 가드에 보이지 않는다.**

### N5 — skip link (하)

`layout.tsx`에 문서 최초 포커스 요소로 추가. `tabIndex={-1}` 컨테이너로 실제 포커스를
옮긴다(스크롤만 하고 포커스는 남는 것이 전형적 가짜 수정).

### N6 — JS 없는 승률 계산기 (하)

`<noscript>` 안의 `<style>`로 "계산 중입니다" 카드를 숨기고, 사실을 말하는 카드로 교체.
사이트 6개 도구 중 이 하나만 해당(나머지 5개는 렌더 중 계산해 프리렌더 HTML에 실제 숫자가
들어 있음 — 25.0%, 35.0%, 19.1%로 확인).

### N7 — 무단언 테스트 (하)

서브에이전트 위임. 순수 추가만 이루어졌음을 mtime과 삭제 라인 0건으로 독립 확인.

### N8 — 플레이스홀더 도메인 (하)

`sitemap.ts`에서 소비. **경고만 하고 throw하지 않는다** — 도메인은 오너가 아직 미정으로
결정했고, 로컬 빌드와 e2e 전체가 이 변수 없이 도는 것이 정상이다.

## 변경 파일

**신규 (6)**
```
apps/fishtilt/src/app/not-found.tsx
apps/fishtilt/src/app/error.tsx
apps/fishtilt/src/app/global-error.tsx
apps/fishtilt/src/app/global-error.test.tsx
apps/fishtilt/src/app/sitemap.test.ts
apps/fishtilt/tests/e2e/not-found.spec.ts
```

**수정 (23)**
```
src/app/layout.tsx · src/app/sitemap.ts · src/app/page.tsx
src/app/tools/{range,equity,pot-odds,outs,hand-checker,starting-hand}/page.tsx
src/components/EquityCalculator.tsx
src/features/range/copy.ts · src/features/range/copy.test.ts
src/features/tools/faq.ts
src/copy-guards.test.ts
src/content/graph.test.ts · src/features/quiz/rangeQuestions.test.ts
src/components/HomeHeroVisual.test.tsx · src/features/search/buildIndex.test.ts
src/features/tools/requiredOuts.test.ts
src/lib/seo/breadcrumbs.test.ts · src/lib/seo/sitemapEntries.test.ts
content/learn/{outs,hand-matrix,starting-hand-ranking}.mdx
content/blog/{outs-nine,is-ak-good}.mdx · content/glossary/preflop.mdx
tests/e2e/{theme-and-header,home,responsive-a11y}.spec.ts
```

## 테스트 / 검증

| 게이트 | 결과 |
| --- | --- |
| `pnpm typecheck` | 12개 패키지 전부 통과, 에러 0 |
| `pnpm lint` | 통과 (레이어링 규칙 포함) |
| `pnpm test` (전체) | **295 파일 / 4443 테스트 통과**, 1 스킵 |
| `pnpm vitest --project fishtilt` | **137 파일 / 1706 테스트 통과** |
| `pnpm e2e` (fishtilt) | **267 테스트 통과** |
| `pnpm build` | 133 HTML 프리렌더 |
| 라이선스 위생 | 392개 파일, OK |

**빌드 산출물 직접 측정** (보고서가 아니라 HTML):

- `title` 정확히 1개 + `lang="ko"` + `<main>` 정확히 1개 → **133개 중 132개.**
  유일한 예외가 `_global-error.html`이고 그것이 ruling 130의 프레임워크 한계다.
- 잘못된 조사(`10와`·`8와`·`7와`·`6와`·`3와`) → **0건.**
  계산된 핸드 설명이 나오는 페이지 **34개** 전부 정상.
- skip link → 첫 Tab에서 포커스, Enter로 `#main-content`에 포커스 이동, 그 다음 Tab이
  본문 안으로 감(브라우저에서 실제 키를 눌러 확인).
- `NEXT_PUBLIC_SITE_URL` 미설정 시 빌드 로그에 경고, 설정 시 **경고 0건**.

**변이 테스트** — 새 가드가 헛돌지 않음을 전부 확인했다.

| 가드 | 변이 | 결과 |
| --- | --- | --- |
| GUARD 3 | `가장 널리 쓰이는` 되돌림 (content/src 각각) | 실패함 ✓ |
| GUARD 4 | 퀴즈 **정답 안의** `실제로 여는 패` 되돌림 | 실패함 ✓ |
| GUARD 3 | 최상급 아닌 `자주 쓰이는`으로 바꿈 | 통과 유지 ✓ (오탐 없음) |
| global-error 팔레트 | hex 1자 변경 / 폰트 1개 제거 / `lang` 제거 / import 추가 | 각각 실패함 ✓ |
| N8 플래그 | 소비 블록 삭제 | 2건 실패함 ✓ (주석·import만 남겨도 잡음) |
| skip link 44px | 세로 패딩 제거 | 실패함 ✓ (24px 검출) |

**내가 처음에 틀린 것 2가지, 기록해 둔다.**

1. N8 소비 가드 첫 버전은 `import` 줄만 있어도 통과했다. 두 번째 버전은 **주석**이 남아도
   통과했다 — 검사 대상 코드를 설명하는 산문이 테스트를 초록으로 만들고 있었다.
   import과 주석을 모두 제거한 뒤에야 제대로 잡는다.
2. skip link 첫 버전에 `bg-brand-600`을 기본 상태로 넣어, 기존 CTA 대비 테스트의
   `a.bg-brand-600` 선택자를 가로챘다. 테스트를 특수 처리하는 대신 **모든 도색 유틸리티를
   `focus:` 뒤로** 옮겼다 — 클립된 요소의 색은 관측 불가능하므로 기본 상태의 fill은 아무
   가치가 없었다.

## SEO/UX 관점의 영향

- **404가 더 이상 홈페이지 행세를 하지 않는다.** 이전에는 `<title>`·`meta description`·
  `og:*`·`canonical`이 전부 홈페이지 것이었다. 링크 프리뷰와 크롤러가 읽는 값이 바뀐다.
  robots는 `noindex` 2개(Next이 404 상태 때문에 넣는 것 + 우리가 넣는 것)이고, 둘 다 필요하다 —
  정적 호스트가 같은 문서를 200으로 서빙하면 앞의 하나가 사라진다.
- **키보드 전용 사용자**의 본문 도달 비용이 페이지마다 9~10 탭에서 1탭으로 줄었다.
- **JS 없는 방문자**가 승률 계산기에서 영원히 "계산 중입니다"를 보지 않는다.
  검색 엔진 렌더러 관점에서도 이 페이지의 대기 텍스트가 본문으로 색인되지 않는다.
- **유행도 주장 제거**는 E-E-A-T 관점에서 손실이 아니라 이득이다. 사이트가
  `why-called-3bet.mdx`에서 "없는 근거를 있는 것처럼 쓰지 않습니다"라고 선언해 놓고
  두 클릭 거리에서 정반대를 하던 모순이 사라졌다.
- 키워드 밀도·제목·구조화 데이터는 **건드리지 않았다.** 이 WP는 정직성과 접근성 시정이다.

## 남은 이슈

1. **`_global-error.html`은 여전히 영어·`lang` 없음.** Next 16.3 프레임워크 한계(ruling 130).
   Next이 이 합성 라우트를 오버라이드 가능하게 만들면 그때 처리한다. 방문자가 닿는 런타임
   경계는 이미 한국어다.
2. **`RANGE_PROVENANCE_SENTENCE`의 3중 교차검증 주장** — 리뷰가 `packages/*`를 읽지 않아
   검증하지 못했다고 명시했다. "다른 두 자료"의 이름이 사이트 어디에도 없어 독자도 확인할 수
   없다. 출처를 밝히거나 문장을 빼는 결정이 필요하다. **오너 결정 대기.**
3. **크로미움 단독 검증.** 실제 iOS/Android Safari, 실제 스크린리더(VoiceOver/NVDA)는
   확인하지 않았다.
4. **MDX Prettier 드리프트 31/113** — 의도된 것(ruling 129).
5. `흔히 쓰는 ×2/×4 규칙` 계열 표현은 남겨 두었다. 최상급이 아니고 ruling 101이 허용하는
   `일반적으로 쓰이는`과 같은 레지스터다.

## 다음 WP에 넘길 사실 요약

- **릴리스 블로커 0건.** B1·B2 모두 빌드 산출물에서 확인 완료.
- 카피 가드는 이제 `src/**` + `content/**` 양쪽 + **MDX 컴포넌트 prop 내부**까지 본다.
  새 퀴즈·Callout을 쓰면 그 안의 한국어도 GUARD 1–4의 대상이다.
- `not-found.tsx`의 목적지 6개는 라우트 레지스트리에서 온다. 라우트를 `available: false`로
  바꾸면 404 페이지의 카드가 자동으로 "준비 중"이 된다.
- `NEXT_PUBLIC_SITE_URL`을 설정하면 빌드 경고가 사라진다. 이것이 도메인 연결 체크리스트의
  1번 항목이다.
- 최종 카운트: 유닛 4443 / e2e 267 / HTML 133.
