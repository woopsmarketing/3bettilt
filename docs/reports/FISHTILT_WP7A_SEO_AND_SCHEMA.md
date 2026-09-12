# FishTilt WP-7a — SEO 메커니즘 · 메타데이터 · JSON-LD

## 목표

WP-N이 세운 SEO 기반 위에, **방출 메커니즘의 빈 곳**을 메운다. 콘텐츠 집필은 하지 않는다(WP-7b).

1. 사이트 정체성(`WebSite` · `Organization`)을 홈에서 한 번 선언한다.
2. 허브 6개가 "무엇의 목록인지"를 `CollectionPage`로 말하게 한다.
3. 브레드크럼이 없던 정적 라우트에 붙인다 — 화면 트레일과 `BreadcrumbList`를 같은 배열에서.
4. TSX 페이지(홈 · 툴 6개)의 `FAQPage`를 **화면에 렌더되는 그 배열에서** 방출한다.
5. `DefinedTerm` 채택 여부를 판단하고 근거를 남긴다.
6. `<title>` ↔ H1 불일치 6곳을 페이지마다 판단해 정리한다.
7. 오래된 주석 정정, `/learn` 썸네일(ruling 116), 배포 준비 상태 검증.

관통하는 원칙 하나: **화면에 없는 것을 구조화 데이터로 만들지 않는다.** 새로 만든 방출은 전부
`Breadcrumbs`가 이미 쓰던 성질 — *렌더되는 바로 그 배열에서 JSON-LD가 나온다* — 을 그대로 갖는다.
두 벌은 만들지 않았다.

---

## 범위

**건드린 것**: `src/lib/seo/**` 전부, `src/app/layout.tsx`, `src/app/page.tsx`(JSON-LD·title),
`src/app/{about,search}/page.tsx`, 허브 6개 `page.tsx`, `src/app/tools/*/page.tsx`,
`src/app/practice/*/page.tsx`, `src/components/FaqSection.tsx`, 그리고 영향받은 단위/E2E 스펙.

**건드리지 않은 것**(경계 밖, 또는 명시 금지):

- `src/content/**` — MDX · 레지스트리 · allowList. learn FAQ 문단, 글로서리 고아 링크,
  `learn/outs`의 `nextLessons`는 전부 WP-7b 소관이다. 한 줄도 쓰지 않았다.
- `src/features/**` — WP-4의 `features/tools/faq.ts`는 **읽기만** 했다(§남은 이슈 1).
- `src/lib/routes.ts` — 라벨은 전부 여기서 읽어 쓰기만 했다. 수정 필요 없었다.
- `globals.css`, `src/components/`의 나머지, `max-w-[42rem]` 리터럴 4곳(MASTER 지시: WP-8 소관).
- `/ranges/*` 신규 랜딩(확정 거부), `SITE_ORIGIN` 플레이스홀더(ruling 110), `/search` noindex(확정).

---

## 확인한 기존 상태

측정치는 브리핑과 일치했고, 재조사 없이 그대로 전제했다.

| 항목 | 착수 시점 |
| --- | --- |
| 방출 JSON-LD | `BreadcrumbList` 113 · `Article` 35 · `FAQPage` 20(82문항) · `WebApplication` 6 |
| 없던 것 | `WebSite` · `Organization` 단독 · `CollectionPage` · `ItemList` · `DefinedTerm` |
| 브레드크럼 | 콘텐츠 4개 템플릿에만. 정적 라우트 18개에는 없음 |
| `SITE_ORIGIN` | `NEXT_PUBLIC_SITE_URL ?? 'https://fishtilt.example'` (RFC 2606) |
| title ≠ H1 | `/` · `/about` · `/practice` · `/search` · `/tools/range` · `/tools/starting-hand` |
| `layout.tsx` 주석 | "`/`는 자체 metadata가 없다" — **거짓**(`page.tsx:90`이 갖고 있다) |
| 홈 `FaqSection` | 6문항, JSON-LD 없음(WP-3이 일부러 남김) |
| 툴 FAQ | `src/features/tools/faq.ts`, 6개 배열 28문항, JSON-LD 없음(WP-4가 일부러 남김) |
| `FaqSection` 사용처 | 홈 1 + 툴 6 = **7곳뿐**(grep 전수) |
| 이미지 자산 | `public/og.png` 7,003B · `src/app/icon.svg` 606B · `src/app/apple-icon.png` 1,542B |

읽고 따른 결정(재론하지 않음): WP-N §3 색인 정책, §4 canonical 규칙, §6 sitemap 불변식,
ruling 105(날짜 없음) · 107(화면에 있는 것만) · 110(도메인 미정) · 116(`/learn` 썸네일).

---

## 구현 내용

### A. `WebSite` + `Organization` — 홈 1곳

`jsonLd.ts`의 비공개 `PUBLISHER` 상수를 **승격**했다. 두 번째 정의를 만들지 않았으므로,
레슨 페이지가 `Article.publisher`로 읽는 조직과 홈이 선언하는 조직은 *같은 객체*다
(`jsonLd.test.ts`가 두 값을 서로 비교해 고정한다).

`SearchAction`은 **넣지 않았다.** `/search`는 `searchParams`를 받지 않고 `SearchClient`가
하이드레이션 이후 브라우저에서 `?q=`를 파싱하므로, 질의 템플릿이 도달할 서버 엔드포인트가
없다. 게다가 그 페이지는 `noindex`다. 지킬 수 없는 약속이므로 방출하지 않는다.

`logo`/`sameAs`/`address`/`contactPoint`도 없다. 소셜 프로필도 주소도 지원 채널도 실재하지
않고, `og.png`는 소셜 카드지 정사각 브랜드 마크가 아니다. 단위 테스트가 이 여섯 필드의 **부재**를
직접 단언한다.

### B. 허브 6개 — `CollectionPage` (+ `ItemList` / `DefinedTermSet`)

각 허브 `page.tsx`가 툴 페이지와 같은 `SEO = { path, title, description }` 단일 상수를 갖게 하고,
그 상수를 `pageMetadata`와 `collectionPageJsonLd`가 **함께** 읽는다. `<head>`와 구조화 데이터가
페이지 이름을 다르게 말할 수 없다.

목록은 **JSX가 map 하는 바로 그 값**에서 나온다. `/learn`은 `roadmap` 배열 하나를 카드와 `ItemList`가
같이 읽고, `/blog`는 `groups`를 평탄화한 것이 곧 렌더 순서이며, `/glossary`·`/hands`는 정렬된
배열 그대로, `/tools`·`/practice`는 `ready` 그대로다. 목적지는 이미 `hrefOfContent` /
`route.available`로 해소된 뒤라, `null`(=`준비 중`)인 행은 자동으로 빠진다.

**`/tools`와 `/practice`도 성립한다고 판단했다.** schema.org의 `CollectionPage`는 항목이 콘텐츠
레코드일 것을 요구하지 않고, 그 페이지의 *주제가 그 목록일 것*만 요구한다. 두 허브의 주제는 각각
여섯 개 도구와 세 개 퀴즈이고, 행은 실제로 렌더되는 링크다. 다만 `/tools`의 세 번째 섹션(도구별
선수 레슨)은 **목록에서 제외**했다 — 그건 허브가 모으는 것이 아니라 허브에서 나가는 길이고, 넣으면
`/tools`가 레슨 목록이기도 하다고 주장하게 된다.

`itemListOrder`는 넣지 않았다. 네 콘텐츠 허브는 각각 커리큘럼 순 · 묶음 크기 순 · 한글 정렬 ·
핸드 강도 순으로 정렬되는데, 이 중 어느 것도 `Ascending`/`Descending`/`Unordered`가 아니다.
열거 자체가 이미 순서를 정확히 옮기므로, 정렬 키를 이름 붙이는 것은 사실이 아닌 추가 주장이다.

### C. 정적 18개 라우트에 `Breadcrumbs`

`breadcrumbs.ts`에 `routeBreadcrumbs(routeId)`를 추가했다. `SECTION_HUB_ROUTE_ID`는
`RouteSection` 전체에 대한 **전역 맵**이라, 섹션이 새로 생기면 여기서 컴파일 에러가 난다(조용히
두 칸짜리 트레일이 되지 않는다). 라벨은 전부 `routes.ts`에서 온다.

`홈 › 무료 도구 › 승률 계산기`처럼 실제 계층을 반영하고, 허브는 자기 자신 아래에 놓이지 않으며,
`available: false`인 허브는 크럼에서 빠진다.

**홈에는 붙이지 않았다.** 루트에서 트레일은 "지금 보고 있는 페이지"를 가리키는 크럼 하나뿐이고,
한 칸짜리 `BreadcrumbList`는 어떤 경로도 서술하지 않는다. `routeBreadcrumbs('home')`은 빈 배열을
반환하고 `Breadcrumbs`는 빈 트레일에 대해 `<nav>`도 JSON-LD도 렌더하지 않으므로, 함수는 여전히
전역(total)이고 호출부는 분기하지 않는다.

결과: 브레드크럼을 가진 페이지 **130개** = 콘텐츠 113 + 정적 17(18 − 홈).

### D. `FAQPage` — 홈 + 툴 6개

**`FaqSection` 컴포넌트 자체가 방출한다.** 호출부 7곳에서 블록을 만들면 그건 목록의 두 번째
사본이고, 두 번째 사본은 어긋난다. 컴포넌트 안에 두면 `<script>`가 `<ul>`이 렌더하는 바로 그
`items`의 직렬화가 되고, 앞으로 `FaqSection`을 쓰는 페이지는 구조화 데이터를 공짜로 얻는다.

- `link`는 답변에서 **제외**한다. 화면에서도 답변 문단 *바깥*에 렌더되므로, 넣으면 발행된 답변이
  화면의 답변보다 길어진다.
- `MIN_FAQ_ITEMS`(=2) 규칙을 MDX 파이프라인과 **공유**한다. 문항 1개짜리 블록은 렌더는 되고
  (독자가 요청한 것이므로) 발행되지 않는다. 규칙 하나, 파이프라인 둘.
- 답변은 컴포넌트 없는 순수 문자열이라(WP-3/WP-4가 그렇게 설계함) 드롭할 항목이 없었다. 기존 MDX
  추출기가 JSX 섞인 쌍을 드롭하는 것과 같은 규율이 여기서는 **타입 수준에서** 이미 강제돼 있다.

방출: 홈 6문항 + 툴 28문항 = **7페이지 34문항 신규**.

### E. `DefinedTerm` — 채택. 단, `/glossary`의 `mainEntity`로, `ItemList`를 **대체해서**

**결론: 넣었다.** 근거:

1. **이 사이트에서 가장 정확한 타입이다.** `/glossary`는 문자 그대로 용어집이고, schema.org의
   `DefinedTermSet` 설명이 "A set of defined terms, for example a glossary"다. `CollectionPage` +
   `ItemList`는 같은 것을 덜 정확하게 말한다.
2. **두 필드가 모두 화면에 있다.** `name`은 카드가 인쇄하는 한글 표제, `description`은 그 카드의
   본문인 `shortDefinition`이다. 레지스트리가 바뀌면 같은 빌드에서 함께 바뀐다. 화면에 없는 값을
   가져오지 않았다.
3. **중복을 만들지 않는다.** 병기가 아니라 **교체**다. `CollectionPage` 하나가 같은 58행을 두 번
   열거하면 그게 가장 값싼 스키마 스팸이다. 그래서 다섯 허브는 `ItemList`, `/glossary`만
   `DefinedTermSet`이다.
4. **`inDefinedTermSet`은 쓰지 않았다.** 각 항목이 세트의 `hasDefinedTerm` 안에 중첩돼 있으므로
   관계는 이미 표현돼 있고, `@id`를 만들어 가리킬 이유가 없다.

**왜 `/glossary/[slug]` 58개 상세 페이지가 아니라 허브인가**: 그 템플릿은 WP-7a의 파일 경계 밖이다.
"각 용어 페이지가 스스로를 `DefinedTerm`으로 선언"하는 것이 더 강한 배치라고 보며, 후속 WP가
가져갈 수 있도록 §남은 이슈에 적어 둔다. 지금 배치도 거짓은 아니다 — 세트를 그 행들이 실제로
렌더되는 페이지에서 선언했다.

### F. `<title>` ↔ H1 6곳

적용한 원칙: **`<title>`은 페이지를 *이름 짓고*, H1은 독자에게 *말을 건다*.** H1이 이미 이름이면
둘을 수렴시키고, H1이 일부러 문장·질문·지시문이면 title은 이름으로 두고 *왜 다른지* 주석을 남긴다.

| 라우트 | 처리 | 내용과 근거 |
| --- | --- | --- |
| `/` | **title 변경, 분리 유지** | H1 `홀덤, 외우지 말고 눈으로 이해하세요.`(슬로건)는 그대로. title은 `홀덤, 외우지 말고 눈으로 이해하세요` → **`무료 홀덤 학습`**. 명사가 없는 슬로건은 처음 보는 사람에게 이곳이 무엇인지 말하지 않는다. WP-1 §2의 2차 키워드(`무료 홀덤 학습 사이트`)이자 `layout.tsx`가 이미 갖고 있던 문자열이라, 폴백과 정문이 더는 다른 사이트를 말하지 않는다. 슬로건은 description 첫 절로 그대로 간다 |
| `/about` | **둘 다 유지, 주석** | `소개 · FishTilt`가 이미 WP-1의 1차 키워드 `FishTilt 소개`를 브랜드 자리에 맞게 조립한 형태다(title을 `FishTilt 소개`로 하면 `FishTilt 소개 · FishTilt`가 된다). H1 `FishTilt는 무엇인가요`는 "이 사이트를 믿어도 되나"에 답하는 페이지가 독자의 질문으로 여는 것 — `소개`라는 제목은 아무것도 답하지 않는다 |
| `/practice` | **title 변경, 분리 유지** | H1 `배운 내용을 직접 풀어보세요`(지시문) 유지. title `퀴즈` → **`홀덤 퀴즈`**. `퀴즈`는 헤더가 이미 주제를 세워 준 *사이트 안에서만* 이름 노릇을 한다. 검색 결과는 사이트 밖이라 주어를 복원해야 한다. WP-1 §2의 1차 키워드이고, 억지가 아니라 이 세 퀴즈가 실제로 다루는 것이다. nav 라벨과 크럼은 `퀴즈` 그대로 |
| `/search` | **둘 다 유지, 주석** | 유일한 `index: false` 라우트다. 이 title은 영원히 검색 결과가 되지 않고 탭·북마크 라벨이며, 탭은 명사로 붙인다. H1 `무엇을 찾고 계신가요?`는 도착한 사람에게 묻는 것. WP-1 §2가 이 라우트에 키워드를 배정하지 않은 이유와 같다 |
| `/tools/range` | **수렴** | title `핸드레인지 탐색기`, H1 `13×13 핸드레인지` — 둘 다 *이름*이었고, 한 물건을 두 이름으로 부르고 있었다. 독자가 둘을 비교하는 딱 두 자리에서 어긋난 셈. **`13×13 핸드레인지 표`로 통일.** 새 카피가 아니라 사이트가 이미 쓰던 두 이름을 합친 것이다(홈 CTA `13×13 핸드레인지 보기`, `/tools/starting-hand`의 핸드오프 `핸드레인지 표 열기`, WP-1 1차 키워드 `핸드레인지 표`). H1은 `title={SEO.title}`로 상수를 읽으므로 다시 갈라질 수 없다 |
| `/tools/starting-hand` | **둘 다 유지, 주석** | title `시작 핸드 탐색기`는 이 도구의 **이름**이다 — `routes.ts` 라벨, `/tools` 카드, 핸드오프 버튼, `WebApplication.name`이 모두 그렇게 부른다. title에서만 바꾸면 사이트가 한 번도 쓰지 않는 이름이 검색 결과에 뜬다. H1 `169개 시작 패, 강한 순서로 보기`가 문장인 이유는, 슬라이더를 만지기 전에 알아야 할 단 하나가 *169행이 무슨 기준으로 정렬됐는가*이기 때문이다. WP-1의 1차 키워드 `시작 핸드 순위표`는 description이 나른다 |

세 곳의 "분리 유지"는 주석만 남기지 않고 **단위 테스트로 고정**했다: `/practice`와
`/tools/starting-hand`는 title·H1을 각각 정확 일치로 단언하고 *둘이 다르다는 사실*까지 단언한다.
나중에 한쪽으로 합치려면 누군가 의도적으로 그 단언을 지워야 한다.

### G. 오래된 주석 정정

- `src/app/layout.tsx` — "`/`는 자체 metadata export가 없다"는 WP-N 시점엔 참이었고 WP-3 이후
  거짓이다. 실제로는 **어느 라우트도** layout의 title/description을 렌더하지 않는다. 주석을
  사실대로 고치고, 남은 문자열이 왜 남아 있는지(신규 라우트의 폴백, 홈과 동일 문자열)를 적었다.
- `src/app/search/page.tsx` — "`routes.ts`가 아직 `available: false`로 두고 있다"는 스테일 노트를
  정정했다. STATE 문서가 지적한 "끝난 일을 안 끝난 것처럼 쓴 주석" 부류이고, 실제로 정찰
  에이전트를 오도한 전례가 있는 종류다.

### H. `/learn` 허브 썸네일 (ruling 116)

`ContentThumbnail`을 `/learn` 15장에 켰다. `/glossary`(58)·`/hands`(20)는 **켜지 않았다.**

레이아웃도 함께 옮겼다(`max-w-reading` 단일 컬럼 → `max-w-grid` 2단 그리드, `/blog`와 동일).
장식이 아니라 산술이다: 카드 프레임이 16:5이므로 48rem 단일 컬럼에서는 제목 15개마다 약 230px짜리
띠가 얹힌다. `/blog`가 측정한 폭에서는 약 120px다. ruling 116 자체의 논거("두 허브의 카드 언어가
갈라지면 안 된다")가 그림뿐 아니라 격자에도 그대로 적용된다. `<ol>`과 커리큘럼 순서는 유지되고,
읽기 순서(좌→우, 위→아래)가 인쇄된 번호 순서와 같다.

### 방출 스키마 표 (빌드 산출 HTML 실측)

`.next/server/app/**/*.html` 131개를 파싱해 센 값이다. 모든 블록이 `JSON.parse`를 통과했다.

| 타입 | 어느 페이지 | 개수 (전 → 후) | 무엇이 그것을 참으로 만드는가 |
| --- | --- | --- | --- |
| `BreadcrumbList` | 콘텐츠 113 + 정적 17 (홈 제외) | 113 → **130** | 화면 `<nav aria-label="현재 위치">`가 렌더하는 **같은 배열**의 직렬화. 라벨은 `routes.ts`/레코드 `title`에서만 온다. E2E가 색인된 모든 페이지에 대해 크럼 이름 = 화면 텍스트, 마지막 크럼 = 그 페이지 canonical, 마지막을 제외한 모든 크럼이 `<main>` 안에 실제 링크로 존재함을 단언한다 |
| `Article` | learn 15 + blog 20 | 35 → **35** | 변경 없음. WP-N 그대로 |
| `FAQPage` | MDX 20 + 홈 1 + 툴 6 | 20 / 82문항 → **27 / 116문항** | MDX 20개는 기존 추출기(본문 `##`/`###` 재파싱). 신규 7개는 `FaqSection`이 렌더하는 그 `items`에서 나온다 — `question`은 화면의 `<h3>`, `answer`는 그 아래 `<p>`와 글자 단위로 동일(둘 다 보간 없는 평문). 문항 2개 미만이면 발행하지 않는다 |
| `WebApplication` | 툴 6 | 6 → **6** | 변경 없음. `/tools/range`의 `name`만 H1과 함께 `13×13 핸드레인지 표`로 이동 |
| `WebSite` | `/` | 0 → **1** | 사이트 이름·주소를 사이트당 한 번. `SITE_NAME`/`SITE_ORIGIN` — 모든 canonical이 쓰는 그 두 상수. `SearchAction` 없음 |
| `Organization` | `/` (최상위) | 0 → **1** | `Article`/`WebApplication`이 임베드하는 **바로 그 객체** + `@context`. 두 번째 정의 없음(테스트가 두 값을 비교해 고정) |
| `CollectionPage` | 허브 6 | 0 → **6** | 그 페이지의 주제가 그 목록이다. `name`/`description`은 `<title>`을 만드는 것과 **같은 상수**. `url`은 자기 canonical |
| `ItemList` *(중첩)* | `/learn` 15 · `/blog` 20 · `/hands` 20 · `/tools` 6 · `/practice` 3 | 0 → **5개 / 64행** | JSX가 map 하는 값에서 나오고 목적지는 이미 해소된 상태다. `준비 중`(=`null`) 행은 URL이 없으므로 빠진다. E2E가 "선언된 행 = `<main>`이 렌더한 링크, 그 순서 그대로"를 단언 |
| `DefinedTermSet` / `DefinedTerm` *(중첩)* | `/glossary` | 0 → **1세트 / 58항목** | `name`은 카드 표제, `description`은 그 카드가 인쇄하는 `shortDefinition`. 둘 다 화면에 있고 단위 테스트가 `getAllByText`로 화면 대조한다 |

**중첩 타입 총계(참고)**: `ListItem` 446(브레드크럼 382 + 목록 64) · `Question`/`Answer` 각 116 ·
`Organization` 77(Article 35×2 + WebApplication 6 + WebSite 1) · `DefinedTerm` 58 ·
`WebPage` 41 · `WebSite` 6(`isPartOf`) · `Offer` 6 · `ItemList` 5 · `DefinedTermSet` 1.
JSON-LD 블록 총계 **206개**.

**금지 필드 전수 검사(131페이지 × 206블록)**: `datePublished` · `dateModified` ·
`aggregateRating` · `"review"` · `potentialAction` · `SearchAction` — **0건.**
`schema.org` 외 절대 URL의 오리진 — **1종뿐**(`https://fishtilt.example`).

### I. 배포 준비 상태

- **에셋이 sitemap에 들어가지 않는다.** `src/app/icon.svg`와 `src/app/apple-icon.png`는 `public/`에
  없어도 Next 파일 규약상 **실재하는 라우트**다. 그래서 파일 위치로 추론하지 않고 **빌드 산출
  `sitemap.xml.body`를 직접 검사**했다: `/icon.svg` · `/apple-icon.png` · `/og.png` ·
  `/sitemap.xml` · `/robots.txt` 모두 0건. E2E에도 규칙으로 고정했고(확장자 패턴 + 5개 경로 명시),
  같은 테스트가 그 5개가 **실제로 200을 준다**는 것도 확인한다 — 아니면 제외가 아무것도 증명하지
  못한다.
- **하드코딩 목록 없음.** `sitemapPaths()`는 여전히 `indexableRoutes(ROUTES) ++
  indexableContent(ALL_CONTENT)`다. 130 URL = 라우트 17(`/search` 제외) + 콘텐츠 113.
- **환경변수 하나로 전부 따라 움직인다** — §테스트/검증에 실측.

---

## 변경 파일

### 신규 (3)

| 파일 | 무엇 |
| --- | --- |
| `apps/fishtilt/src/lib/seo/hubCollectionPage.test.tsx` | 허브 6개의 `CollectionPage`를 렌더된 DOM과 대조. `PLANNED` 레슨 픽스처를 자체 소유해 "준비 중 행은 목록에서 빠진다" 분기를 증명 (38 tests) |
| `apps/fishtilt/src/lib/seo/homeSiteIdentity.test.tsx` | `WebSite`/`Organization`이 홈에만·한 번씩, `SearchAction` 없음, 루트에 브레드크럼 없음, 홈 `FAQPage` = 화면 (8 tests) |
| `apps/fishtilt/src/lib/seo/toolPageJsonLd.test.tsx` | 툴 6개의 `WebApplication`·`BreadcrumbList`·`FAQPage`를 화면과 대조 (24 tests) |

### 수정 (38)

| 파일 | 변경 |
| --- | --- |
| `src/lib/seo/jsonLd.ts` | `organizationJsonLd` · `webSiteJsonLd` · `itemListJsonLd` · `definedTermSetJsonLd` · `collectionPageJsonLd` 추가. `PUBLISHER` 승격 |
| `src/lib/seo/breadcrumbs.ts` | `routeBreadcrumbs` + `SECTION_HUB_ROUTE_ID`(전역 맵) |
| `src/lib/seo/index.ts` | 배럴에 신규 빌더·타입 노출 |
| `src/lib/seo/{jsonLd,breadcrumbs,faqSource}.test.ts` | 신규 빌더 26 tests, `routeBreadcrumbs` 8 tests, 라이브 MDX 불변식 4 tests |
| `src/components/FaqSection.tsx` (+`.test.tsx`) | `FAQPage`를 자기 `items`에서 방출. 구조화 데이터 7 tests |
| `src/app/layout.tsx` | 거짓 주석 정정 |
| `src/app/page.tsx` (+`.test.tsx`) | `WebSite`+`Organization` 블록, title `무료 홀덤 학습`, H1 단언 정확 일치화 |
| `src/app/{about,search}/page.tsx` | 브레드크럼, title↔H1 주석, 스테일 노트 정정 |
| `src/app/about/page.test.tsx` | "링크 0개" → "모든 링크가 사이트 내부"(제휴/입금 링크는 정의상 외부) |
| `src/app/{learn,blog,glossary,hands,tools,practice}/page.tsx` | `SEO` 상수, 브레드크럼, `CollectionPage`. `/learn`은 썸네일 + 2단 그리드, `/practice`는 title `홀덤 퀴즈` |
| `src/app/{learn,blog,glossary,tools,practice}/page.test.tsx` | 목록 단언을 해당 region으로 스코프(브레드크럼 `<li>`가 끼어들지 않게). `/practice`는 title↔H1 분리를 고정 |
| `src/app/tools/{equity,pot-odds,outs,hand-checker,range,starting-hand}/page.tsx` | 브레드크럼. `range`는 title/H1 수렴 + `title={SEO.title}` |
| `src/app/tools/{range,starting-hand}/page.test.tsx` | `toHaveTextContent`(부분 일치) → 정확 일치. title↔H1 관계를 고정 |
| `src/app/practice/{range,hand-ranking,starting-hand}-quiz/page.tsx` | 브레드크럼 |
| `tests/e2e/seo.spec.ts` | `ALLOWED_TYPES` 확장(닫힌 채로) + 중첩 타입 허용목록. 브레드크럼 테스트를 전 페이지로 확대. 신규 6 tests |
| `tests/e2e/range-explorer.spec.ts` | H1 카피 변경 반영 (`toHaveText` 정확 일치 유지) |

---

## 테스트 / 검증

| 게이트 | 명령 | 기준 | 결과 |
| --- | --- | --- | --- |
| 단위 | `pnpm vitest run --project fishtilt --project learn-core` | ≥ 1697 | **1800 passed / 146 files, 0 failed** |
| 타입 | `pnpm typecheck` | clean | **13/13 프로젝트 통과** |
| 린트 | `pnpm lint` | clean | **통과(경고 0)** |
| 빌드 | `pnpm build:fishtilt` | 131페이지 전부 정적 | **131 (○ 18 + ● 113), 동적 0** |
| E2E | `pnpm e2e:fishtilt` | ≥ 253 | **260 passed, 0 failed (18.3s)** — 포트 3221 단독 점유, 종료 후 해제 확인 |

단위 1697 → **1800 (+103)**, E2E 253 → **260 (+7)**.

### 방출 JSON-LD 실검증 (빌드 산출 HTML)

빌드된 131개 HTML에서 `<script type="application/ld+json">`를 전부 뽑아 `JSON.parse` 하고 세었다.
결과 표는 §구현 내용의 "방출 스키마 표"와 그 아래 중첩 집계다. 요약:

- **파싱 실패 0건**, 최상위 블록 **206개**, `@context`가 `https://schema.org`가 아닌 블록 0건.
- 금지 필드(`datePublished`/`dateModified`/`aggregateRating`/`"review"`/`SearchAction`/
  `potentialAction`) **0건**.
- JSON-LD 안의 비-schema.org 절대 URL 오리진 **1종**.
- `CollectionPage` 행 수: `/blog` 20 · `/glossary` 58 · `/hands` 20 · `/learn` 15 · `/practice` 3 ·
  `/tools` 6.

### 환경변수 빌드 검증

```
NEXT_PUBLIC_SITE_URL=https://example.test pnpm build:fishtilt
```

131페이지 재빌드 후 산출물 전수 스캔:

| 표면 | 발견 URL 수 | 오리진 |
| --- | --- | --- |
| `<link rel=canonical>` + `og:url` + `og:image` | 393 | `https://example.test` (100%) |
| JSON-LD 내부 절대 URL(schema.org 제외) | 713 | `https://example.test` (100%) |
| `sitemap.xml` `<loc>` | 130 | `https://example.test` (100%) |
| `robots.txt` `Sitemap:` 줄 | 1 | `https://example.test` |

`fishtilt.example` **0건**. 이후 기본 환경으로 재빌드해 원상복구했고(E2E의 `webServer`가 자체
`pnpm build`를 수행), 최종 산출물은 다시 플레이스홀더 오리진 130 URL / 131페이지다.
**도메인이 정해지면 환경변수 하나만 바꾸면 되는 상태**다. 소스에도 테스트에도 리터럴 호스트는 없다.

### WP-7b가 콘텐츠를 추가해도 깨지지 않게 쓴 방법

리터럴 개수·슬러그·제목을 단언하는 테스트를 한 줄도 쓰지 않았다. 대신:

1. **MDX FAQ 파이프라인은 "파일의 함수"임을 단언한다** (`faqSource.test.ts` 신규 4건).
   `ALL_CONTENT`의 모든 PUBLISHED 레코드에 대해: 추출 결과는 0개이거나 `MIN_FAQ_ITEMS` 이상이고,
   질문/답변에 JSX 잔재가 없으며, 두 페이지가 같은 Q&A를 발행하지 않는다. **learn FAQ가 0개인
   지금 통과하고, 9개가 된 뒤에도 수정 없이 통과한다.**
2. **역방향은 `FaqSection`에만 요구한다.** "화면에 FAQ가 있으면 `FAQPage`가 있다"를 MDX에까지
   요구하면, 답변마다 `<Fact>`를 쓴 정상적인 레슨에서 실패한다 — 추출기가 그 쌍을 드롭하는 것이
   **올바른** 동작이기 때문이다. 그래서 이 단언은 `aria-label="자주 묻는 질문"` 영역을 가진
   페이지(평문만 렌더)에 한정했고, E2E 주석에 이유를 적었다.
3. **허브 목록은 "선언 = 렌더된 링크, 같은 순서"라는 성질**로 검증한다. 항목이 15개든 24개든
   무관하다. 역방향도 파생으로 검증한다 — 사이트맵의 모든 `/learn/*`는 `/learn`의 목록에 있어야
   한다(허브가 레코드를 조용히 빠뜨리는 것을 잡는다).
4. **브레드크럼은 `ROUTES` 전체에 대해 정량화**한다. 라우트를 추가·개명해도 이 파일은 안 바뀐다.
5. **라이브 데이터가 증명할 수 없는 분기는 테스트가 픽스처를 소유한다.** 113/113이 PUBLISHED라
   "준비 중 행은 목록에서 빠진다"를 라이브로 증명할 수 없으므로, `hubCollectionPage.test.tsx`가
   `PLANNED` 레슨을 직접 만들어 붙인다(ruling 26).
6. **E2E는 사이트맵에서 오리진과 경로를 읽는다.** 호스트 문자열은 어디에도 없다.

### 약화하지 않고 스코프를 좁힌 단언 (7건)

브레드크럼이 `<li>`와 링크를 새로 만들면서 문서 전역 질의가 오탐이 났다. 전부 **의미하던 영역으로
좁혔고**, 기대값은 그대로다.

| 파일 | 전 | 후 |
| --- | --- | --- |
| `learn/page.test.tsx` | `screen.getAllByRole('listitem')` | `within('학습 순서' region)` |
| `blog/page.test.tsx` | `container.querySelectorAll('li')` | `'전체 글' region` 안 |
| `glossary/page.test.tsx` | `container.querySelectorAll('ol > li')` | `'전체 용어' region` 안 |
| `tools/page.test.tsx` | `getAllByText('무료 도구')).toHaveLength(1)` | 도구 카드 region 안 0건 (원래 의미: 허브가 자기 목록에 자기를 넣지 않는다) |
| `about/page.test.tsx` | 링크 0개 | 모든 링크가 루트 상대 경로 (제휴·입금 링크는 정의상 외부 — **더 강한** 단언) |
| `about.spec.ts` (E2E) | — | 이미 `http(s)://` 금지로 적혀 있어 변경 불필요 |
| `seo.spec.ts` | 문서 전역 `<a href>` | 페이지 자신의 `<main>` (헤더·푸터가 모든 허브를 링크하므로) |

**강화한 단언 (4건)**: `tools/range`·`tools/starting-hand`·`page.test.tsx`의 H1을
`toHaveTextContent`(부분 일치) → 정확 일치로 올렸고, `/practice`·`/tools/starting-hand`의
title↔H1 **분리 자체**를 단언으로 고정했다. `tools/range`는 title이 H1의
`formatTitle`과 같음을 단언한다. 기존 E2E의 브레드크럼 테스트는 "콘텐츠 페이지"에서
"홈을 제외한 모든 색인 페이지"로 **확대**했다.

---

## SEO/UX 관점의 영향

**색인·이해 측면**

- 구조화 데이터를 가진 페이지가 **113 → 131(전부)** 이 됐다. 정적 라우트 18개는 지금까지 JSON-LD가
  0건이었다.
- 사이트 이름과 발행자가 한 번, 크롤러가 찾는 자리(`/`)에서 선언된다. 지금까지 사이트 이름은
  `<title>` 접미사로만 존재했다.
- 여섯 허브가 "무엇의 목록인지"와 그 목록을 명시적으로 말한다. 113개 콘텐츠 페이지로 가는 경로가
  마크업 수준에서 열거된다.
- `FAQPage` 커버리지 20 → 27페이지, 82 → 116문항. 지금까지 툴 페이지와 홈은 리치 결과 후보가
  전혀 아니었다.
- `/glossary` 58개 정의가 정확한 타입으로 실린다.

**클릭·스니펫 측면**

- `/`와 `/practice`의 검색 결과 제목이 이제 페이지를 *이름 짓는다*. 이전에는 슬로건 하나와
  한 단어였다.
- `/tools/range`는 한 물건을 두 이름으로 부르는 문제가 사라졌다 — SERP 제목과 도착 후 H1이 같다.

**독자 UX 측면**

- 17개 정적 라우트에 "지금 어디에 있는가"가 생겼다. 특히 `/tools/*`와 `/practice/*`는 지금까지
  헤더 외에 상위로 올라가는 링크가 없었다.
- `/learn` 15개 카드가 `/blog`와 같은 카드 언어를 갖는다(ruling 116). 두 "읽을 것" 허브 중 하나만
  그림이 있던 상태가 해소됐다. 이미지 파일은 0개 추가 — 썸네일은 레코드의 `kind`/`topic`에서
  그려지는 DOM/SVG다.
- 성능 비용: `/learn` `<main>` 24.3KB, 썸네일 15장 = `<svg>` 15개. 클라이언트 JS 증가 0.

**정직성 측면 — 이번에 *하지 않은* 것이 결과의 절반이다**

- `SearchAction` 없음(서버 질의 엔드포인트가 없다).
- 날짜·평점·리뷰 없음(ruling 105 / WP-N §5).
- `logo`/`sameAs`/`address` 없음(실재하지 않는다).
- `itemListOrder` 없음(정렬 키가 schema.org의 세 값 중 어느 것도 아니다).
- `준비 중` 행은 어떤 목록에도 URL로 등재되지 않는다.
- 리터럴 호스트 0개 — 소스에도, 테스트에도.

---

## 남은 이슈

1. **`src/features/strength/copy.ts:68` — 사라진 이름이 남아 있다.** *(경계 밖. 보고만 함.)*
   ```
   export const RANGE_DISTINCTION_SENTENCE = `핸드레인지 탐색기의 ${RANGE_LABEL}와는 다른 기준입니다. …`
   ```
   `핸드레인지 탐색기`는 `/tools/range`의 title과 H1을 `13×13 핸드레인지 표`로 수렴시키면서 이제
   사이트 어디에도 렌더되지 않는 이름이 됐다. 이 문장은 `/tools/starting-hand`의 FAQ
   (`핸드레인지 표와는 뭐가 다른가요?`)에 실제로 렌더되므로, 독자는 존재하지 않는 이름으로 다른
   페이지를 안내받는다. WP-7a가 없앤 "한 객체를 두 이름으로 부르기"가 정확히 한 군데 남은 것이다.
   `src/features/**`는 경계 밖이라 손대지 않았다. 후속 WP가 가져가야 한다.

2. **`/tools/range`의 수렴은 분리 유지로 볼 여지도 있었다.** *(최종 QA 재검토용 기록.)*
   `핸드레인지 탐색기`(검색 이름) / `13×13 핸드레인지`(화면 문맥)로 갈라 두는 해석도 가능했다.
   나는 **수렴을 택했다** — 두 문자열이 "검색명 대 화면 문맥"의 역할 분리가 아니라 같은 물건의 두
   *이름*이었고, 다른 다섯 개 툴은 전부 title = 도구 이름 = `WebApplication.name`으로 일관돼
   있었기 때문이다. 이 판단은 되돌릴 수 있게 한 상수(`SEO.title`)에 모아 두었다.

3. **`DefinedTerm`을 `/glossary/[slug]` 58개 상세 페이지에 두는 것이 더 강한 배치다.**
   그 템플릿은 WP-7a 경계 밖이라 세트를 허브에 선언했다. 상세 페이지가 각자
   `DefinedTerm`(+`inDefinedTermSet`으로 허브의 세트를 참조)을 선언하면, "이 페이지가 곧 그 용어"
   라는 사실이 URL 단위로 표현된다. 지금 배치도 거짓은 아니지만 차선이다.

4. **`NEXT_PUBLIC_SITE_URL`은 여전히 미설정이다** (ruling 110, 소유자 확인 대기). 첫 프로덕션
   빌드 전에 설정해야 한다. 검증했듯 그것 하나면 canonical · OG · JSON-LD · sitemap · robots가
   전부 따라간다. 테스트는 하나도 바뀌지 않는다.

5. **WP-7b에게 넘어간 것 중 이 WP가 손대지 않은 것**: learn 15개의 FAQ 문단(추출기는 이미 준비돼
   있고, 문단이 들어오면 자동으로 잡힌다), 글로서리 고아 항목의 본문 인바운드 링크,
   `learn/outs`의 빈 `nextLessons`.

6. **`/learn` 2단 그리드는 시각 QA를 한 번 받아야 한다.** 산출 HTML로는 검증했지만
   (`max-w-grid`, `grid gap-4 sm:grid-cols-2`, 썸네일 15장, `<svg>` 15개, 가로 오버플로 E2E 통과)
   360~1440px 실제 렌더 인상은 WP-8이 판단하는 편이 낫다.

7. **`max-w-[42rem]` 리터럴 4곳**(`learn/[slug]`, `glossary/[slug]`, `hands/[hand]`, `about`)은
   MASTER 지시대로 건드리지 않았다. WP-8 소관.

---

## 다음 WP에 넘길 사실 요약

- **`FaqSection`이 `FAQPage`를 스스로 방출한다.** 이 컴포넌트를 쓰는 페이지는 구조화 데이터를
  공짜로 얻는다. `items`의 `question`/`answer`는 평문이어야 하고(그게 발행되는 문자열이다),
  링크는 `link`에 두어야 한다. 문항 2개 미만이면 렌더는 되고 발행되지 않는다.
- **허브에 `CollectionPage`를 추가하려면**: 페이지에 `SEO = { path, title, description }` 상수를
  두고 `pageMetadata({...SEO, index})`와 `collectionPageJsonLd({...SEO, mainEntity})`가 같이
  읽게 한다. `mainEntity`는 `itemListJsonLd(rows)`(또는 글로서리처럼 `definedTermSetJsonLd`)이며,
  `rows`는 **JSX가 map 하는 그 배열**에서, 목적지가 이미 해소된 상태로 만들어야 한다.
- **정적 라우트에 브레드크럼을 붙이려면**: `<Breadcrumbs trail={routeBreadcrumbs('<routeId>')} />`
  한 줄이면 된다. 라벨은 `routes.ts`에서 나온다. 새 섹션을 만들면
  `src/lib/seo/breadcrumbs.ts`의 `SECTION_HUB_ROUTE_ID`에서 컴파일 에러가 난다 — 채워야 한다.
- **홈에는 브레드크럼이 없다**(의도). `routeBreadcrumbs('home')`은 빈 배열이고 `Breadcrumbs`는
  빈 트레일에 아무것도 렌더하지 않는다.
- **`WebSite`/`Organization`은 홈에만 있다.** E2E가 다른 페이지에 나타나면 실패시킨다. 다른
  페이지에 복제하지 마라.
- **`ALLOWED_TYPES`는 닫힌 목록이다**(`tests/e2e/seo.spec.ts`). 새 타입을 방출하려면 최상위는
  `ALLOWED_TYPES`, 중첩은 `ALLOWED_NESTED_TYPES`에 추가해야 하고, 그 추가가 곧 리뷰 지점이다.
- **`<main>` 밖으로 링크 단언을 넓히지 마라.** 헤더와 푸터가 모든 허브를 링크하므로 문서 전역
  `<a href>` 스캔은 허브 카드와 크롬의 사본을 같은 목록으로 읽는다. 새 스펙도 `<main>`으로 스코프.
- **이미지 자산은 3개다** — `public/og.png`(7,003B), `src/app/icon.svg`(606B),
  `src/app/apple-icon.png`(1,542B). 그 외 모든 도해·썸네일·히어로는 도메인 데이터에서 그려진
  DOM/SVG다. "이미지 0개"는 사실이 아니다.
- **현재 실측 기준선**: 단위 **1800** (`--project fishtilt --project learn-core`, 146 files),
  E2E **260**, 빌드 **131페이지 전부 정적**, sitemap **130 URL**, JSON-LD 블록 **206개**.
- **`/tools/range`의 H1은 `13×13 핸드레인지 표`다.** `page.tsx`의 `SEO.title` 한 곳에서 나온다.
  이 이름을 참조하는 카피가 다른 파일에 있으면(§남은 이슈 1) 함께 옮겨야 한다.
