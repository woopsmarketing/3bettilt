# FishTilt WP-7b — SEO 콘텐츠: 링크 그래프 복구, 레슨 도해, FAQ 정합

## 목표

WP-7a가 남긴 세 종류의 콘텐츠 정합 결함을 고친다. (1) 어디에서도 링크되지 않는 용어집 항목,
(2) 요약본에는 그림이 있는데 원본 레슨에는 없는 역전, (3) 질문이 아닌 항목이 `FAQPage` 구조화
데이터로 방출되는 문제. 신규 글·신규 컴포넌트는 만들지 않고, 기존 콘텐츠의 링크·도해·FAQ만
맞춘다.

## 범위

**대상**: `apps/fishtilt` 하나. `apps/web`·`packages/*`는 읽지도 고치지도 않았다.

**소유하고 편집한 것**

- `apps/fishtilt/content/**` (MDX 산문)
- `apps/fishtilt/src/content/registry/**` (레코드의 관계 배열)
- `apps/fishtilt/src/content/content.test.ts` (F의 가드)
- `apps/fishtilt/src/features/strength/copy.ts` (E의 한 문장)

**손대지 않은 것**: `src/app/**`, `src/components/**`, `src/lib/routes.ts`, `src/lib/seo/faq.ts`
(파서 자체는 고칠 이유가 없었다 — 아래 F 참고), `globals.css`, `public/`,
`max-w-[42rem]`(WP-8 소관, ruling 120).

## 확인한 기존 상태

전부 이 WP에서 직접 세었다.

| 항목 | 수치 |
| --- | --- |
| MDX 산문 파일 | 113 (learn 15 · blog 20 · glossary 58 · hands 20) |
| 인바운드 0인 용어집 항목 | **6** — `term-action` · `term-all-in` · `term-ante` · `term-c-bet` · `term-bluff` · `term-nuts` |
| `relatedConcepts` 항목 총계 | 259 |
| └ 같은 글 본문에 `<Term>`이 실제로 있는 것 | **248** |
| └ 없는 것 | 11 (모두 그 단어가 본문에 링크 없이 등장하는 경우) |
| `relatedArticles: []`인 learn 레코드 | **1** — `poker-actions` (15개 중) |
| `relatedArticles: []`인 hands 레코드 | **14** (20개 중) |
| `<Figure>`를 쓰는 글 | 3 (전부 blog) · 레슨 15편 중 **0편** |
| `extractFaqItems`가 MDX에서 뽑는 FAQ 항목 | **82개 / 20개 문서** |
| 빌드 HTML의 `FAQPage` Question 총계 | **116개 / 27개 페이지** (MDX 82 + 홈 6 + `/tools/*` 28) |
| └ 그중 질문 형태가 아닌 것 | **1** — `learn/poker-actions`의 `다섯 가지 행동을 한눈에` |
| └ 답변에 마크다운 블록 문법이 남은 것 | **1** — 같은 항목 (`- 체크: …` 다섯 줄) |

인바운드 계산 기준: 다른 레코드의 `relatedConcepts` 또는 다른 글 본문의 `<Term id=…>`.
자기 자신 참조는 제외.

`relatedArticles`의 화면 제목은 `이 개념과 같이 보면 쉬워요`,
`relatedConcepts`의 제목은 **`이 글에 나온 말들`**이다 (`src/content/graph.ts`
`RELATION_HEADING`). 이 문구가 아래 C·D 판단의 근거다.

## 구현 내용

### A. 고아 용어 인바운드 (6 → 3)

- **`term-action`** — `content/learn/poker-actions.mdx` 첫 문장. 단어 `행동`이 실제로 처음
  등장하고 개념을 정의하는 바로 그 자리에 `<Term id="term-action">행동(Action)</Term>`.
- **`term-all-in`** — 같은 글의 `<Callout title="언제 무엇을 고를 수 있나요?">`. 원래 문장이
  이미 올인을 설명하면서 이름만 빼고 있었다(`가진 돈을 전부 걸 수도 있는데`). 그 자리에 이름을
  붙였다: `가진 돈을 전부 거는 <Term id="term-all-in">올인(All-in)</Term>도 …`.
- **`term-ante`** — `poker-actions.mdx`에는 `앤티`가 한 번도 나오지 않고 개념도 다루지 않아
  넣지 않았다. 대신 단어가 실제로 있는 곳인 `content/glossary/blind.mdx`의
  `## 앤티와 함께 쓰이기도 합니다` 절 본문에 걸고, `term-blind` 레코드의 `relatedConcepts`에
  `term-ante`를 추가했다.
- 세 항목 모두 대응하는 레코드의 `relatedConcepts`를 함께 갱신했다 —
  `content.test.ts`가 `<Term>` ⊆ `relatedConcepts`를 강제한다.

`term-c-bet` · `term-bluff` · `term-nuts`는 넣지 않았다. 근거는 `## 남은 이슈`.

### B. `learn/poker-actions`의 빈 `relatedArticles`

`['blog-why-called-3bet', 'blog-why-blinds-exist']`.

- `blog-why-called-3bet`(topic `betting`)은 이 레슨이 정의한 **레이즈를 세는 방법**을 그대로
  이어받는다.
- `blog-why-blinds-exist`는 이 레슨이 열어 놓고 넘긴 물음 — 프리플랍에서 처음 거는 돈이 왜
  베팅이 아니라 **오픈 레이즈**인가 — 의 전제(이미 팟에 걸려 있는 강제 베팅)를 설명한다.

두 개만 넣었다. 나머지 18편은 이 레슨의 주제를 잇지 않는다.

### C. WP-1 C16 미구현분 (`hand-77` · `hand-88` · `hand-99`)

세 레코드에 `relatedArticles: ['blog-small-pocket-pairs']`를 넣었다. `hand-22`에는 이미 있었다.

**넣기 전에 `content/blog/small-pocket-pairs.mdx`를 전문 읽었다.** 그 글이 `<Fact>`로 이름을
대는 패는 22 · 33 · 44 · 55뿐이고 77 · 88 · 99는 한 번도 나오지 않는다. 그런데도 넣은 이유:

1. 이 관계의 화면 제목은 `이 개념과 같이 보면 쉬워요` — **같이 읽을 글**이지 "이 패를 다룬
   글"이 아니다.
2. 그 글이 실제로 설명하는 것(모든 포켓페어의 조합 수, 포켓페어가 순위표 위쪽에 몰리는 이유)은
   숫자와 무관하게 77 · 88 · 99에도 그대로 성립하고, 세 핸드 페이지가 자기 `description`에서
   약속하는 내용(`이 정도 포켓 페어의 조합 수와 순위`)과 정확히 같다.

레코드에 그 판단 근거를 주석으로 남겼다. 나머지 11개 hands 레코드의 빈 `relatedArticles`는
손대지 않았다.

### D. 레슨 도해 (신규 코드 0줄)

블로그의 기존 사용법(`blog/pot-odds-quick.mdx`, `blog/outs-nine.mdx`)을 그대로 따랐다.

- `content/learn/pot-odds.mdx` — `## 먼저 눈으로 보기`의 팟 10BB / 벳 5BB 계산 문단 바로
  뒤에 `<Figure><PotOddsFigure pot="10" bet="5" /></Figure>`. 인자는 본문이 이미 쓴 숫자
  그대로다.
- `content/learn/outs.mdx` — 아웃 9장을 세는 문단 뒤에
  `<Figure><OutsFigure outs={9} street="FLOP" /></Figure>`.

두 절 모두 제목이 `먼저 눈으로 보기`인데 `pot-odds`에는 볼 것이 하나도 없었다. 캡션은 JSX
속성이라 `measureContent`의 본문 길이에 들어가지 않으므로 `readMinutes`는 그대로다
(`src/components/Figure.tsx` 모듈 주석, `Figure.test.tsx`가 검증). **새 숫자는 하나도 만들지
않았다** — 캡션은 본문이 이미 말한 상황을 다시 가리키기만 한다.

### E. 죽은 도구 이름

- `content/blog/btn-why-wide.mdx` — `action="핸드레인지 탐색기 열기"` **줄을 삭제**했다.
  `ToolCTA`가 `routes.ts`의 라벨로 폴백한다. 빌드 산출물에서 실제 렌더 결과를 확인했다:
  `.next/server/app/blog/btn-why-wide.html` → **`핸드레인지 열기`**. 하드코딩도 함께 사라져
  이후 라우트 이름이 바뀌면 자동으로 따라간다.
- `src/features/strength/copy.ts` — `RANGE_DISTINCTION_SENTENCE`의 첫머리를
  `핸드레인지 탐색기의` → **`13×13 핸드레인지 표의`**로 고쳤다. 이 문장은
  `/tools/starting-hand`에 실제로 노출된다. 그 페이지가 이름을 상수로 내보내지 않아 리터럴로
  두고, 다시 개명될 때 같이 옮겨야 할 유일한 곳이라는 주석을 달았다.
- 다른 MDX의 `13×13 핸드레인지 열기`(5건) · `핸드레인지 열기`(4건)는 건드리지 않았다.

### F. 질문이 아닌 FAQ 항목

**1) MDX 수정** — `content/learn/poker-actions.mdx`의 `### 다섯 가지 행동을 한눈에`(불릿 5개 +
마무리 문단)를 `## 사람들이 자주 헷갈리는 부분` 절 **밖으로** 꺼내, 그 앞에 독립된
`## 다섯 가지 행동을 한눈에` 절로 올렸다. 본문은 한 글자도 바꾸지 않았다(제목 레벨만 `###` →
`##`). 편집상으로도 이 자리가 맞다 — 요약이 FAQ 안에 있었던 것이다.

**2) 가드** — `src/content/content.test.ts`에 `describe('FAQ sections — what may be emitted as
FAQPage markup')`. 113편 전체에 대해 `extractFaqItems`를 돌려 두 가지를 검사한다.

**어디에 두었는가.** `faq.test.ts`가 아니다 — 그 파일은 자기 모듈 주석에서 "실제 글을 절대
가져오지 않고 픽스처 문자열만 쓴다"(ruling 26)고 계약을 못박고 있고, 이번 규칙은 **파서의
성질이 아니라 산문의 성질**이다. `content.test.ts`는 이미 `<Term>`·allow-list·`<h1>` 금지 같은
"MDX 작성자가 지켜야 하는 규칙"을 전부 담고 있고, 실패 메시지가 어긋난 MDX 파일 이름을 그대로
가리킨다. 그래서 여기에 넣었다.

**규칙 1 — 방출되는 질문은 `?`로 끝나야 한다.**
한국어가 물음표를 요구하지는 않는다. `이 표가 무엇을 재는지 살펴봅시다`는 물음표 없이도 질문에
가깝다. 그래서 이것은 문법 주장이 아니라 **하우스 컨벤션**이고, 그럼에도 문법적 대안보다 이쪽을
고른 이유가 있다. "한국어 의문 종결어미로 끝날 것"을 검사하려면 어미 목록(`-나요`·`-가요`·
`-까`·`-죠`·`-니` …)을 열거해야 하는데, 그 목록은 닫히지 않는 집합이고 빠진 어미 하나마다 바로
이 결함이 조용히 다시 통과한다. 반면 `?` 규칙의 유일한 오탐은 "물음표를 안 붙인 진짜 질문"이고,
그 수정(물음표 추가)은 방출되는 `Question.name`을 더 낫게 만든다. 사이트의 기존 질문 81개가
전부 이미 이 규칙을 만족한다.

**규칙 2 — 방출되는 답변에 마크다운 블록 문법이 남아 있으면 안 된다.**
`stripInlineMarkdown`은 링크·코드·볼드·이탤릭만 정규화하고 **리스트 마커와 제목 기호는 처리하지
않으며**, 마크다운 파서가 될 계획도 없다. 그래서 답변 안의 `- ` / `1. ` / `#` / `> `는
`acceptedAnswer.text`에 **글자 그대로** 실려 리치 결과에 노출된다. 이쪽은 언어와 무관하고,
실제로 이번 결함을 잡아낸 절반이다. 규칙 1만으로는 부족하다 — 요약에 물음표를 붙이면 통과하지만,
요약이 리스트이기를 그만둘 수는 없기 때문이다.

가드가 실제로 잡는지 확인했다. 옮기기 전 원문 모양을 `extractFaqItems`에 그대로 먹여 보면
`{q:"다섯 가지 행동을 한눈에", endsWithQuestionMark:false, hasBlockMarkdown:true}` — 두 규칙 모두
위반이고, 같은 절의 진짜 질문 `체크와 폴드, 뭐가 다른가요?`는 둘 다 통과한다.

`src/lib/seo/faq.ts`(파서)는 고치지 않았다. 파서는 **글이 말하는 것을 그대로 방출한다**는 것이
그 모듈의 전체 설계이고, 요약을 알아서 걸러내게 만들면 그 계약이 깨진다. 잘못 놓인 것은 글이었고,
글을 고쳤다.

### G. 앵커 텍스트

이번에 만들거나 고친 링크만 점검했다. `행동(Action)` · `올인(All-in)` · `앤티(Ante)`는 모두
목적지 용어집 항목의 이름 그대로다. `핸드레인지 열기`는 라우트 라벨에서 생성된다.
`여기` · `이 글` 같은 무의미 앵커는 새로 만들지 않았다.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `apps/fishtilt/content/learn/poker-actions.mdx` | `<Term>` 2개(A), 요약 블록을 FAQ 절 밖으로(F) |
| `apps/fishtilt/content/learn/pot-odds.mdx` | `<Figure><PotOddsFigure pot="10" bet="5" />`(D) |
| `apps/fishtilt/content/learn/outs.mdx` | `<Figure><OutsFigure outs={9} street="FLOP" />`(D) |
| `apps/fishtilt/content/glossary/blind.mdx` | `<Term id="term-ante">`(A) |
| `apps/fishtilt/content/blog/btn-why-wide.mdx` | 죽은 `action=` 라벨 줄 삭제(E) |
| `apps/fishtilt/src/content/registry/learn/h2.ts` | `poker-actions`의 `relatedConcepts` +2, `relatedArticles` 채움(A·B) |
| `apps/fishtilt/src/content/registry/glossary/j1.ts` | `term-blind`의 `relatedConcepts` +`term-ante`(A) |
| `apps/fishtilt/src/content/registry/hands/e3.ts` | `hand-77`·`hand-88`·`hand-99`의 `relatedArticles`(C) |
| `apps/fishtilt/src/content/content.test.ts` | FAQ 가드 2개 + 비어있지 않음 확인 1개(F) |
| `apps/fishtilt/src/features/strength/copy.ts` | `RANGE_DISTINCTION_SENTENCE` 도구 이름(E) |

날짜·이미지 필드는 추가하지 않았다(ruling 105 · 114). `max-w-[42rem]`은 건드리지 않았다.
`ContentRecord` 타입은 바뀌지 않았다.

## 테스트 / 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm vitest run --project fishtilt --project learn-core` | **1803 passed / 146 files**, 실패 0 (기준선 1800/146, +3 = 이번에 추가한 가드 3개) |
| `pnpm typecheck` | 전 패키지 `Done`, 오류 0 |
| `pnpm lint` | 출력 없음(clean) |
| `pnpm build:fishtilt` | `.next/server/app` **HTML 133개**, 전부 `○ Static` / `● SSG`. `ƒ`(동적) 0 |
| `pnpm e2e:fishtilt` | **260 passed** (기준선과 동일) |

빌드 후 `.next/server/app`의 133개 HTML에서 `<script type="application/ld+json">` 블록을
**`JSON.parse`로** 파싱해 `FAQPage`를 검사했다(정규식으로 JSON을 훑지 않았다). 화면 텍스트는
`<script>`와 `<style>`을 **통째로 제거한 뒤** 태그를 벗겨 만들었다 — 그러지 않으면 JSON-LD 본문이
남아 모든 질문이 자기 자신과 매칭된다.

| 항목 | 이전 | 이후 |
| --- | --- | --- |
| `FAQPage`를 내보내는 페이지 | 27 | **27** |
| Question 총계 | 116 | **115** |
| └ MDX 글에서 온 것 | 82 (20 페이지) | **81 (20 페이지)** |
| └ 홈 | 6 | 6 |
| └ `/tools/*` (`toolPageJsonLd`, MDX와 무관) | 28 (6 페이지) | 28 (6 페이지) |
| `?`로 끝나지 않는 질문 | 1 | **0** |
| 마크다운 블록 문법이 남은 답변 | 1 | **0** |
| 화면에 실재하지 않는 질문 | 0 | **0** |
| `JSON.parse` 실패 | — | **0** |

줄어든 1개는 정확히 `learn/poker-actions`의 요약 항목이다(그 페이지 5 → 4).

렌더 결과 개별 확인: `.next/server/app/blog/btn-why-wide.html`의 CTA 버튼 라벨이
`핸드레인지 열기`로 나온다.

최종 그래프 상태(직접 재계산):

- 인바운드 0인 용어집 항목: **6 → 3** (`term-c-bet` · `term-bluff` · `term-nuts`)
- `relatedArticles: []`인 learn 레코드: **1 → 0**
- `relatedArticles: []`인 hands 레코드: **14 → 11**
- `<Figure>`를 쓰는 글: **3 → 5**, 레슨은 **0/15 → 2/15**

## SEO/UX 관점의 영향

- **구조화 데이터의 정직성.** `FAQPage`의 `Question.name`이 명사구였고 `acceptedAnswer.text`가
  `- 체크: 아무것도 걸지 않고 넘김`으로 시작했다. 리치 결과에서 그대로 노출되는 문자열이고,
  Google의 FAQ 정책상 "질문과 답" 형식이 아닌 항목은 마크업 위반 소지가 있다. 이제 115개 전부가
  질문 형태이고, 전부 화면에 실재하며, 마크다운 잔재가 없다. 가드가 있으니 회귀하지 않는다.
- **고아 페이지 감소.** 용어집 항목 3개가 사이트 어디에서도 링크되지 않는 상태였다(크롤러 입장에서
  사이트맵에만 존재하는 페이지). 셋 다 이제 본문 링크와 관계 배열 양쪽에서 도달 가능하다.
- **내부 링크 밀도.** 레슨 15편 중 유일하게 관련 글이 없던 `poker-actions`가 채워졌고, 포켓페어
  핸드 3개가 해당 블로그와 상호 연결됐다. 전부 실제 링크가 렌더되는 관계다.
- **죽은 이름 제거.** `핸드레인지 탐색기`는 WP-7a 이후 사이트 어디에도 렌더되지 않는 이름인데
  버튼 라벨과 FAQ 문장이 그 이름으로 사용자를 보내고 있었다. 클릭해서 도착한 페이지의 제목이
  다른 상황(scent 단절)이 두 곳에서 사라졌다. **단, 홈에 아직 2곳 남아 있다 — 아래 참고.**
- **레슨 이해도.** 요약본에는 그림이 있고 원본 레슨에는 없던 역전이 해소됐다. 특히
  `learn/pot-odds`는 `먼저 눈으로 보기`라는 제목의 절에 볼 것이 전혀 없었다.

## 남은 이슈

**1. `term-c-bet`을 `learn/flop-turn-river`의 `relatedConcepts`에 넣지 않았다.**
지시받은 수정이지만 하지 않기로 판단했고, 근거는 이렇다. 이 관계의 화면 제목은
**`이 글에 나온 말들`**이다(`RELATION_HEADING`). 그런데 `C-Bet` · `씨벳` · `컨티뉴에이션` 중
어느 것도 `flop-turn-river.mdx`에 나오지 않고, 그 글은 자기 범위를 명시적으로 좁혀 놓았다 —
"이 글에서는 카드가 어떤 순서로, 몇 장씩 열리는지에만 집중합니다". 사이트의 259개
`relatedConcepts` 중 248개가 같은 글에 `<Term>`을 갖고 있고, 나머지 11개도 **단어 자체는 본문에
있는** 경우다. 이 항목은 단어가 아예 없는 첫 사례가 된다. 근거 없는 관계보다 빈 상태가 낫다는
원칙에 따라 보고로 넘긴다. 정직한 대안 두 가지: (a) `flop-turn-river`의 "카드가 열릴 때마다
행동합니다" Callout에 C-Bet을 이름으로 한 번 언급하는 한 절 추가(새 산문이라 이 WP 범위 밖),
(b) `learn/three-bet` 등 베팅 명명법을 다루는 레슨에 같은 방식으로 배치. 둘 다 WP-8 또는 별도
콘텐츠 WP의 판단이 필요하다.

**2. `term-bluff` · `term-nuts`는 그대로 고아다.**
`블러프`는 자기 용어집 페이지 밖 어디에도 등장하지 않고, `넛츠`도 마찬가지다. 개념이 스치는 곳은
있으나(`blog/playing-the-board`의 "보드 다섯 장 자체가 이미 모두에게 가장 강한 다섯 장",
`glossary/showdown`의 "이길 수 없는 패") 단어가 없어 `<Term>`을 걸 자리가 없고, 관계 배열만 넣으면
1번과 같은 이유로 `이 글에 나온 말들`이 거짓이 된다. 문장을 새로 만드는 것은 "억지로 만들지 마라"
지시에 어긋난다. 덧붙여 블러프는 "언제 하는가"가 전략 영역이라 이 사이트가 다루지 않기로 한
주제이고(`glossary/bluff.mdx` 자체가 그렇게 못박고 있다), 자연스러운 언급 자리가 구조적으로 적다.

**3. 홈페이지에 죽은 이름 `핸드레인지 탐색기`가 2곳 남아 있다. — 내 파일 경계 밖이다.**
`apps/fishtilt/src/app/page.tsx:294`와 `:486`이
`` `${routeById('range').label} 탐색기 열기` ``로 라벨을 만들어 **`핸드레인지 탐색기 열기`**를
렌더한다. 빌드 산출물 확인 결과 `.next/server/app/index.html`에 두 번 나온다(사이트에서 그 이름이
남아 있는 유일한 곳). E에서 고친 MDX·copy와 정확히 같은 결함인데 `src/app/**`이라 손대지 않았다.
수정 방향은 `탐색기` 접미사를 떼어 `` `${routeById('range').label} 열기` ``로 만드는 것이고,
그러면 나머지 CTA와 동일하게 `핸드레인지 열기`가 된다.

**4. `/practice/*` 퀴즈 라우트는 여전히 113개 레코드 전체에서 인바운드 0이다.**
억지 링크를 만들지 말라는 지시에 따라 손대지 않았다. 콘텐츠 레코드에 퀴즈를 가리키는 관계
종류(`relatedTools`는 `/tools/*`만 담는 관례) 자체가 없어서, 이건 링크 편집이 아니라 관계 스키마
결정이다. WP-8 또는 별도 판단 필요.

**5. hands 레코드 11개는 `relatedArticles`가 여전히 비어 있다.**
C의 3개 외에는 손대지 않았다. 나머지는 대응할 블로그 글이 실제로 없거나(예: `hand-jj`,
`hand-ajs`), 있더라도 그 글이 그 핸드를 다룬다고 볼 근거가 없다.

**6. Prettier를 내가 고친 MDX 3편에 돌리면서 내가 건드리지 않은 줄까지 재줄바꿈됐다.**
`content/**/*.mdx`는 원래 Prettier로 포맷된 적이 없다(현재도 31개 파일이 `--check` 실패). 나는
지시대로 **내가 수정한 파일에만** 돌렸지만, 그 파일들 안의 기존 드리프트까지 정리됐다.
`poker-actions.mdx` · `outs.mdx` · `btn-why-wide.mdx`가 그렇다. 마크다운의 문단 내 줄바꿈은
렌더 결과에 영향이 없고(테스트·빌드·E2E 모두 동일), 문자 수도 그대로라 `readMinutes`도 변하지
않는다. 다만 이 3편만 포맷 스타일이 나머지 28편과 달라졌다는 사실은 WP-8이 알아야 한다.

**7. 이번에 하지 않기로 한 그 밖의 것들.** 새 블로그 글·새 레슨 작성(범위 밖), `src/lib/seo/faq.ts`
파서 수정(F 참고 — 결함은 글에 있었다), 기존 116개 FAQ 항목 전수 문구 손질(지시 범위 밖),
`max-w-[42rem]`(ruling 120, WP-8), 기존 앵커 텍스트 전수 조사(지시대로 내가 만진 것만 점검).

## 다음 WP에 넘길 사실 요약

WP-8(최종 QA)이 바로 쓸 수 있는 사실만.

1. **기준선 갱신.** unit **1803 passed / 146 files** (WP-7a의 1800에서 +3, 전부
   `content.test.ts`의 새 FAQ 가드). build **133 HTML, 전부 정적**(변동 없음). e2e **260
   passed**(변동 없음). typecheck·lint clean.
2. **`FAQPage` Question 총계는 116 → 115.** 27개 페이지에서 나오고, 그중 MDX 글이 81(20 페이지),
   홈이 6, `/tools/*`가 28(6 페이지)이다. `/tools/*`의 28개는 MDX가 아니라 `toolPageJsonLd`에서
   나오므로 콘텐츠 편집과 무관하다.
3. **FAQ 회귀 가드가 생겼다.** `content.test.ts`의
   `describe('FAQ sections — what may be emitted as FAQPage markup')`. 규칙 두 개: 질문은 `?`로
   끝나야 하고, 답변에 `- ` / `1. ` / `#` / `> `가 남아 있으면 안 된다. 113편 전체에 대해 돈다.
4. **아직 남은 죽은 이름은 정확히 한 곳이다** — `src/app/page.tsx:294`와 `:486`의
   `핸드레인지 탐색기 열기`(홈). 다른 곳에는 없다(빌드 산출물 전수 확인). 고치면
   `.next/server/app/index.html`이 유일한 변경 지점이고, 홈 스냅샷/E2E가 그 문자열을 pin하고
   있는지 확인이 필요하다.
5. **인바운드 0인 용어집 항목은 3개 남았다** — `term-c-bet` · `term-bluff` · `term-nuts`. 셋 다
   "단어가 다른 글에 없어서 `<Term>`을 걸 자리가 없다"는 같은 이유다. 남은 이슈 1·2에 해결
   방향이 있다.
6. **`content/**/*.mdx`는 Prettier 미적용 상태다.** 31개 파일이 `--check` 실패. 이번에 3편만
   포맷됐다. 전체를 정리하려면 별도 결정이 필요하고, `pnpm format`을 레포 전체에 돌리는 것은
   CLAUDE.md와 별개로 알려진 위험(`CLAUDE.md` 자체가 망가진다)이다.
7. **레슨 15편 중 도해가 있는 것은 2편**(`pot-odds`, `outs`)이다. 나머지 13편은 여전히 0이며,
   이는 결함이 아니라 미착수 상태다 — WP-7b는 "요약본에는 있는데 원본에는 없는" 두 쌍만
   해소하도록 범위가 정해져 있었다.
