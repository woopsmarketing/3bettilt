# FishTilt Stage-2 — 종합 보고서

작성: 오케스트레이터 (메인 에이전트) · 2026-09-09
개별 WP 보고서: `docs/reports/FISHTILT_WP*.md` · 판정 원장: `docs/FISHTILT_STATE.md` (ruling 100–135)

---

## 1. Stage-2가 무엇이었나

이미 출시된 MVP 위에 **디자인 · SEO · 블로그 · 시각 자료**를 올리는 작업이었다.
기능을 새로 만드는 단계가 아니라, 있는 것을 **읽히게 만들고 찾아지게 만드는** 단계다.

메인 에이전트는 오케스트레이터로만 움직였다. 각 WP는 파일 경계가 정해진
fresh-context 하위 에이전트에 넘겼고, **보고서를 그대로 믿지 않고 WP가 끝날 때마다
실제 변경 파일과 테스트 결과를 직접 재확인**했다. 그 재확인이 실제로 무엇을 잡았는지는
§4에 그대로 적었다 — 이 문서에서 가장 쓸모 있는 부분이다.

---

## 2. 최종 상태

| 항목 | 값 |
| --- | --- |
| 프리렌더된 HTML | **133** (사이트 131 + `_not-found` + `_global-error`) |
| 사이트맵 URL | **130** |
| MDX 콘텐츠 | **113** (learn 15 · blog 20 · glossary 58 · hands 20) |
| JSON-LD 블록 | **206** — BreadcrumbList 130 · Article 35 · FAQPage 27 · CollectionPage 6 · WebApplication 6 · WebSite 1 · Organization 1 |
| 유닛 테스트 (전체 모노레포) | **4443 통과** / 1 스킵 |
| 유닛 테스트 (fishtilt) | **1706 통과** (137 파일) |
| E2E (Playwright) | **267 통과** |
| typecheck · lint · build | 전부 통과 |

**문서 수준 불변식** (보고서가 아니라 빌드 산출물 133개를 직접 스캔한 값):

- `<title>` 정확히 1개 + `lang="ko"` + `<main>` 정확히 1개 → **133개 중 132개.**
  유일한 예외 `_global-error.html`은 Next 프레임워크 한계다(§6-1).
- 깨진 조사(`10와`·`8와`·`7와`·`6와`·`3와`) → **0건.**
- 깨진 내부 링크 → **0건** (프리렌더 HTML에서 내부 `href` **3,659개**를 전부 대조).
- 320px에서 가로 오버플로 → **0건** (독립 리뷰가 11개 주요 라우트에서 측정한 값.
  내 e2e는 360·390·430·1440px에서만 확인한다).

**릴리스 블로커: 0건.**

---

## 3. WP별 결과

| WP | 한 줄 결과 | 보고서 |
| --- | --- | --- |
| WP-1 | 라우트·콘텐츠 전수 감사 + 키워드 맵(C1–C17). 이후 모든 WP가 이 배정을 침범하지 않았는지로 검증됐다 | `FISHTILT_WP1_AUDIT_AND_KEYWORD_MAP.md` |
| WP-2 | 디자인 토큰 · 라이트/다크 팔레트 3중 선언 · 대비 감사를 **주석이 아니라 테스트로** 재계산 | `FISHTILT_WP2_DESIGN_SYSTEM.md` |
| WP-3 | 홈 재설계. `인기 무료 도구` 같은 근거 없는 표현을 이때 걷어냈다 | `FISHTILT_WP3_HOME_REDESIGN.md` |
| WP-4 | 도구 6종 UX 통일 (히어로 → 도구 → FAQ → 레슨 → 다음 도구) | `FISHTILT_WP4_TOOL_UX.md` |
| WP-5 | 블로그 허브 + 이미지 시스템. 카드 시각물은 **래스터가 아니라 렌더**(ruling 112) | `FISHTILT_WP5_BLOG_AND_IMAGE_SYSTEM.md` |
| WP-6 | 시각 자산 계획. AI 생성 이미지 금지 판정(ruling 121), OG는 `kind × topic` 32종 텍스트 없는 이미지 | `FISHTILT_WP6_VISUAL_ASSET_PLAN.md` |
| WP-7a | 메타데이터·구조화 데이터 (peer 세션이 수행, §4-2) | `FISHTILT_WP7A_SEO_AND_SCHEMA.md` |
| WP-7b | SEO 콘텐츠 보강, 내부 링크 | `FISHTILT_WP7B_SEO_CONTENT.md` |
| WP-8 | 최종 QA. **판정이 틀렸다** — 문서 상단에 정정 삽입 | `FISHTILT_WP8_FINAL_QA.md` |
| — | fresh-context 독립 리뷰: 블로커 2 + 비블로커 8 | `FISHTILT_INDEPENDENT_REVIEW.md` |
| WP-9 | 그 10건 시정 + 클래스 단위 가드 | `FISHTILT_WP9_REVIEW_REMEDIATION.md` |

---

## 4. 재확인이 실제로 잡은 것

> 지시: "보고서만 믿지 말고, 각 WP 종료 후 실제 변경 파일과 테스트 결과를 직접 재확인하라."
> 이 절은 그 지시가 값을 한 지점의 기록이다.

1. **WP-6 보고서가 내가 읽은 뒤에 412행 → 1,007행으로 자랐고, OG 결론이 뒤집혀 있었다.**
   보고서를 읽은 시점의 판정을 그대로 원장에 적었다면 틀린 판정이 남았다. ruling 118을
   `kind × topic` 32종으로 수정했다 — 추가 로케일당 0 KB 대 텍스트가 박힌 53종의 ~740 KB.

2. **다른 세션이 같은 worktree에서 WP-7a를 쓰고 있었다.** 내 에이전트의 `Edit`이
   "String to replace not found"로 실패해서 알았다. **되돌리지 않고 물어봤다**(CLAUDE.md §6).
   오너가 "이 세션이 계속"으로 정리했고, peer의 WP-7a는 그대로 살렸다(ruling 122·123).

3. **peer가 정규식으로 JSON-LD를 검사해 "질문이 아닌 항목 4건"을 보고했다.**
   이스케이프된 따옴표가 `[^"]*`를 끊는 오탐이었다. `JSON.parse`로 다시 세니 **1건**이었다.

4. **내 FAQ 가시성 검사도 오염돼 있었다.** 태그만 벗기면 JSON-LD 자신의 텍스트가 건초더미에
   남아 모든 블록이 자기 자신과 매칭됐다. `<script>`/`<style>`을 통째로 제거한 뒤 재측정했다.

5. **런타임에 조립되는 문자열은 소스 grep에 보이지 않는다.** 죽은 이름이 정확히 두 곳에
   있다고 WP-7b에 알렸는데, 에이전트가 **세 번째**를 찾아 왔다 — `page.tsx:294,486`에서
   문자열이 실행 중에 합쳐지는 자리였다. 빌드 산출물에서 확인했다(ruling 128).

6. **WP-7b가 내 지시를 근거를 들어 거절했다.** `flop-turn-river.relatedConcepts`에
   `term-c-bet`을 넣으라고 했는데, 그 관계는 `이 글에 나온 말들`로 렌더되고 해당 MDX는
   C-Bet을 한 번도 말하지 않는다는 반증을 제시했다. **내가 틀렸다.**

7. **내 WP-8 가드 테스트가 두 컴포넌트에서 실패했고, 컴포넌트가 옳고 테스트가 틀렸다.**
   `HomeHeroVisual`·`OutsFigure`의 `w-full max-w-[Nrem]`은 그림의 고유 크기 상한이지
   본문 폭이 아니다. 허용 목록을 만드는 대신 `mx-auto` 기준으로 규칙을 다시 썼다.

8. **`find -newermt "-4 minutes"`가 BSD find에서 조용히 아무것도 반환하지 않았다.**
   "변경 없음"이라는 거짓 결론. `diff -rq`를 사라진 베이스라인과 비교하면 조용히 통과한다는
   것도 같은 날 알았다(ruling 126).

9. **WP-8 보고서에 "1805"를 측정하기 전에 썼다.** 다시 돌려 확인했다. 맞긴 했지만,
   맞았다는 것이 쓴 순간에 알 수 있었던 것은 아니다.

10. **독립 리뷰가 내 WP-8 판정을 뒤집었다.** 블로커 2건. 놓친 이유까지 WP-8 보고서에
    적어 두었다 — 404는 e2e가 상태 코드만 봤고(상태 코드는 처음부터 옳았다), 조사는 유닛
    테스트가 `length > 0`이라 깨진 한국어에도 참이었다.

11. **가드를 넓혔더니 리뷰도 놓친 5번째 인스턴스가 나왔다.** MDX의 `<Quiz>` prop 안 한국어
    전체가 모든 카피 가드에 보이지 않고 있었다(ruling 132). 리뷰가 지적한 최악의 사례가
    하필 퀴즈 **정답**이었는데, 그 클래스를 위해 쓴 가드가 그 문장을 보지 못했다.

---

## 5. 도메인 연결 체크리스트

> 도메인은 **오너 결정 대기**다. 지금은 `https://fishtilt.example`(RFC 2606 예약,
> 절대 resolve되지 않음)을 쓴다. 그럴듯한 도메인을 하드코딩하지 않은 이유는
> `src/lib/seo/site.ts` 헤더에 적혀 있다.

**연결 시 순서대로:**

1. **`NEXT_PUBLIC_SITE_URL`을 실제 오리진으로 설정** (트레일링 슬래시 없이,
   예: `https://fishtilt.kr`). 프로덕션 빌드 **전에** 설정해야 한다.
   - 미설정 시 빌드 로그에 경고가 나온다 — 이것이 유일한 안전장치다.
   - 설정하면 경고가 사라진다(검증 완료).
   - **테스트는 하나도 바꿀 필요가 없다.** 모든 테스트가 리터럴 호스트가 아니라
     규칙(절대 URL · 전체가 같은 오리진 · 쿼리 없음)을 검사한다.
2. **HTTPS 강제 + www 정규화 중 하나를 고르고 301로 통일.** canonical이 한 오리진만
   가리키므로, 다른 변형은 반드시 리다이렉트되어야 한다.
3. **빌드 후 재확인** (명령은 §8):
   - `sitemap.xml`의 모든 `<loc>`가 새 오리진인가
   - 임의의 페이지 3개에서 `<link rel="canonical">`·`og:url`이 새 오리진인가
   - `robots.txt`의 `Sitemap:` 줄이 새 오리진인가
   - `_not-found.html`에 canonical이 **없는지** (있으면 404가 홈 행세를 한다)
4. **OG 이미지 확인.** `og:image`는 절대 URL이어야 한다 — `metadataBase`가 새 오리진을
   받았는지 확인.
5. **`/search`가 `noindex`인지 확인** (의도된 것. `robots.txt`로 `Disallow` 하지 **않는다** —
   이유는 `src/app/robots.ts` 헤더 참조).

---

## 6. 남은 이슈 (릴리스 블로커 아님)

1. **`_global-error.html`은 영어이고 `lang`이 없다.** Next 16.3이 `/_global-error`를
   자기 합성 라우트로 만들고 `builtin/app-error`에 하드와이어 한다 —
   `next/dist/esm/build/route-discovery.js`. `app/` 아래 어떤 파일도 이 문서를 바꾸지
   못한다는 것을 코드에서 확인했다. **방문자가 실제로 닿는 런타임 경계는 한국어다**
   (모든 라우트 번들이 우리 `global-error.tsx` 청크를 싣는 것을 확인). ruling 130.
2. **`RANGE_PROVENANCE_SENTENCE`의 3중 교차검증 주장.** "다른 두 자료가 말하는 범위와도
   맞습니다"라고 쓰는데 그 두 자료의 이름이 사이트 어디에도 없어 **독자가 확인할 수 없다.**
   출처를 밝히거나 문장을 빼는 결정이 필요하다. **오너 결정 대기.**
3. **`/hands` 허브 타이틀 `핸드 목록`.** 약한 검색 타깃이지만, 고치려면 WP-1의 키워드
   배정을 다시 열어야 한다. QA에서 즉흥적으로 정할 문제가 아니다.
4. **고아 용어 3건** (`term-c-bet`·`term-bluff`·`term-nuts`) — 인바운드 0.
   §7의 주제 5·7·10이 정확히 이 셋을 겨냥한다.
5. **크로미움 단독 검증.** 실제 iOS/Android Safari, 실제 스크린리더(VoiceOver/NVDA),
   색 대비 전수 육안 감사는 하지 않았다.
6. **MDX Prettier 드리프트 31/113** — 의도된 것(ruling 129). 고치지 말 것.
7. **성능/부하 실측 없음.** equity worker 벤치마크는 기존 보고서의 주장을 그대로 두었다.

---

## 7. Search Console 체크리스트

**연결 직후:**

1. **속성 등록** — 도메인 속성(DNS TXT) 쪽을 권한다. `www`/비`www`, `http`/`https`를
   한 속성에서 함께 본다.
2. **사이트맵 제출** — `https<도메인>/sitemap.xml`. URL **130개**가 잡혀야 한다.
   130보다 적게 잡히면 `src/lib/seo/policy.ts`의 색인 정책과 대조한다
   (`/search`는 의도적으로 제외).
3. **URL 검사**로 3종류를 각각 1개씩 확인: 홈, 콘텐츠 상세 1개(`/learn/...`),
   도구 1개(`/tools/range`). "색인 생성 가능" + canonical이 자기 자신인지 확인.
4. **`/search`가 색인되지 않는 것이 정상**임을 기억할 것. "제외됨 — noindex 태그" 로
   보이는 것이 맞다. 오류가 아니다.

**첫 4주 동안 볼 것:**

5. **페이지 > 색인 생성됨** 수가 130에 수렴하는가. 정체되면 내부 링크가 약한
   노드부터 본다(§6-4의 고아 용어).
6. **리치 결과 보고서** — `FAQPage` 27개와 `BreadcrumbList` 130개가 유효로 잡히는가.
   `Article` 35개는 **날짜가 없다**(레지스트리에 날짜 필드가 없음). 경고로 나올 수 있고,
   이는 알려진 상태다 — 없는 날짜를 만들어 넣지 않는다.
7. **실적 > 검색어**에서 WP-1 키워드 맵(C1–C17)의 배정과 실제 유입 질의를 대조한다.
   한 질의에 두 페이지가 동시에 뜨면 카니발라이제이션이고, 그때 §6-3의 `/hands` 타이틀
   문제를 다시 연다.
8. **모바일 사용 편의성 / Core Web Vitals** — 320px 오버플로 0을 로컬에서 확인했지만
   실기기 데이터는 여기서만 나온다.
9. **404 보고서** — 내부 링크는 0건이지만, 외부에서 들어오는 죽은 링크는 여기서만 보인다.
   이제 404가 실제 한국어 페이지이므로 이탈이 아니라 회수 기회다.

---

## 8. 검증 명령

```bash
pnpm typecheck && pnpm lint          # 타입 + 레이어링
pnpm test                            # 4443 유닛
pnpm build:fishtilt                  # 133 HTML
pnpm e2e:fishtilt                    # 267 E2E
pnpm verify                          # typecheck + test + build 한 번에
```

빌드 산출물 직접 검사 (도메인 연결 후 §5-3에 쓸 것):

```bash
cd apps/fishtilt
grep -o '<loc>[^<]*' .next/server/app/sitemap.xml.body | head -3
grep -o 'rel="canonical" href="[^"]*"' .next/server/app/about.html
grep -c 'rel="canonical"' .next/server/app/_not-found.html   # 0 이어야 한다
```

---

## 9. 추천 블로그 주제 20개

전체 근거(인바운드 링크 수, grep 결과, 기존 키워드 배정과 겹치지 않는 이유)는
`docs/reports/FISHTILT_BLOG_TOPIC_BACKLOG.md`에 있다. **한 건도 임의로 고르지 않았다** —
전부 레지스트리에서 센 값과 산문 grep에서 나왔다.

선정 원칙 세 가지:

- **잡탕 묶음 해소** — `/blog`가 1편짜리 `topic`을 묶음 행으로 렌더한다.
  `rules`·`betting`·`position`·`range`·`equity`가 각 1편이었다.
- **인바운드 0인 용어 살리기** — `term-ante`·`term-all-in`·`term-action`·`term-c-bet`·
  `term-bluff`·`term-nuts`가 아무 데서도 참조되지 않는다.
- **본문이 직접 요구한 후속편** — 예: `blog/outs-nine.mdx:27`이 "아웃이 9장이 아니라면
  새 계산이 필요합니다"라고 쓰고 끝난다.

| # | 제목 | topic | level | 왜 지금 이 글인가 |
| --- | --- | --- | --- | --- |
| 1 | 딜러 버튼은 왜 매 판 자리를 옮길까? | rules | INTRO | `term-ante` 인바운드 0. 버튼이 왜 도는지가 113편 어디에도 없다 |
| 2 | 쇼다운에서는 누가 먼저 카드를 열까? | rules | INTRO | 공개 **순서**는 사이트 전체 grep 0건 |
| 3 | 올인이 나오면 그 판은 어떻게 끝날까? | rules | INTRO | `term-all-in` 인바운드 0. 사이드 팟을 정면으로 다루는 페이지 없음 |
| 4 | 체크와 콜은 무엇이 다를까? | betting | INTRO | `term-action` 인바운드 0. `poker-actions`는 나열만 하고 혼동을 풀지 않는다 |
| 5 | 프리플랍과 포스트플랍은 무엇이 다를까? | betting | INTRO | `포스트플랍` grep 1건인데 정의가 없다. `term-c-bet` 인바운드 0 |
| 6 | 체크 레이즈란 무엇일까? | betting | BASIC | `glossary/check.mdx:17`이 이름만 대고 끝낸다. 소유 페이지 없음 |
| 7 | 세미 블러프란 무엇일까? | betting | BASIC | `term-bluff` 인바운드 0. `glossary/bluff.mdx:15`가 이름만 남기고 끝난다 |
| 8 | 타이트하다 · 루즈하다는 무슨 뜻일까? | betting | BASIC | `term-vpip` ↔ `term-pfr`가 서로만 참조하는 닫힌 2-사이클 |
| 9 | 3벳까지 온 판에서는 팟 오즈가 얼마나 달라져 있을까? | betting | INTERMEDIATE | blog에 `INTERMEDIATE`가 0편. 순수 사실만으로 쓸 수 있다 |
| 10 | 플러시끼리 붙으면 누가 이길까? | hand-strength | INTRO | `term-nuts` 인바운드 0. 같은 족보끼리 비교는 원페어 편 하나뿐 |
| 11 | 브로드웨이 패란 무엇일까? | starting-hands | INTRO | 정의가 hands 4개 파일에 흩어져 있고 glossary 항목이 없다 |
| 12 | 수티드 커넥터와 한 칸 갭은 무엇이 다를까? | starting-hands | BASIC | `starting-hands.mdx:44`가 "다음 레슨에서"로 넘기는데 그 레슨이 안 다룬다 |
| 13 | JJ·TT 같은 중간 포켓페어는 어디쯤에 있을까? | starting-hands | BASIC | `hand-jj`·`hand-tt`·`hand-99`가 `relatedArticles: []` |
| 14 | 인 포지션 · 아웃 오브 포지션은 무슨 뜻일까? | position | BASIC | 개념은 두 페이지가 이미 쓰는데 **이름이 없다**(grep 0건) |
| 15 | 빅 블라인드는 왜 프리플랍에서만 마지막일까? | position | BASIC | 두 페이지가 서로 반대로 읽히는 순서를 각각 쓰고, 설명이 없다 |
| 16 | 레인지가 "몇 %"라는 건 무슨 뜻일까? | range | BASIC | `term-combo`가 인바운드 27로 최다인데 그 자체를 푸는 글이 없다 |
| 17 | 레인지 표 아래 "6인 · 100BB"는 왜 항상 붙어 있을까? | range | BASIC | 네 페이지가 이 조건을 선언·지시만 하고 설명하지 않는다 |
| 18 | 확률을 셀 때 왜 52장이 아니라 47장일까? | odds | BASIC | `47장` grep 1건, 그 규약을 소유한 페이지 0 |
| 19 | 오픈엔디드 스트레이트 드로우는 아웃이 몇 장일까? | odds | BASIC | `blog/outs-nine.mdx:27`이 직접 후속편을 요구한다. 8아웃 자리가 비어 있다 |
| 20 | 승률과 팟 오즈는 무엇이 다를까? | equity | BASIC | 두 개념을 나란히 놓고 구분하는 페이지가 없다 |

**쓸 때 지켜야 할 제약** (Stage-2에서 굳어진 것):

- 숫자는 `<Fact>`로만 인용한다. 산문에 직접 쓰지 않는다.
- 유행도·최상급 금지 — `가장 널리 쓰이는` 계열은 `src/copy-guards.test.ts` GUARD 3이 막는다.
- 레인지 표를 "실제로 여는 패"로 부르지 않는다 — GUARD 4가 막는다.
- 테이블에서의 행동을 권하지 않는다 — GUARD 1이 막는다.
- **퀴즈 prop 안의 한국어도 전부 가드 대상이다**(ruling 132).

---

## 10. 이 보고서의 한계

정직하게 적어 둔다.

- **§3의 "독립 리뷰"는 별도 세션이 아니라, 내가 브리핑한 fresh-context 하위 에이전트다.**
  구현자와 리뷰어를 분리했고 원하는 결론을 알려주지 않았지만(CLAUDE.md §12), 완전히
  독립적인 제3자는 아니다. 리뷰어에게 `packages/*`와 `apps/web`을 읽지 말라고 지시한 것도
  나다 — 그래서 §6-2가 미검증으로 남았다.
- **§2의 수치는 전부 재측정한 값**이지만, 측정 스크립트를 쓴 것도 나다. §4-3·§4-4가
  보여주듯 측정 방법 자체가 틀릴 수 있다.
- **113편의 MDX 산문을 포커 내용 정확성 기준으로 통독하지는 않았다.** 계산된 수치, 링크,
  표현 패턴, 그리고 가드에 걸린 것만 확인했다.
- **실기기·실스크린리더 검증은 없다.**
