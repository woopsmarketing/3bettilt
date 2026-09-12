# WP-S3-18 Reviewer C — SEO / IA / Cannibalization (independent, read-only)

- 대상: `apps/fishtilt/.next/server/app/**` 프리렌더 HTML 144문서 + `sitemap.xml.body` + `robots.txt.body` + `.next/routes-manifest.json`, 그리고 `src/lib/seo/*`, `src/lib/locale.ts`, `src/app/layout.tsx`, `src/app/[locale]/layout.tsx`, `next.config.ts`.
- 방법: 직접 작성한 추출 스크립트(scratchpad `extract.mjs`/`links.mjs`)로 144문서의 `<title>`·description·canonical·robots·hreflang·og/twitter·`<h1>`·JSON-LD(전부 `JSON.parse`)·`<a href>` 6,109건을 뽑아 sitemap 141 URL과 대조했다. WP-S3-16 감사(`WP_S3_16_SEO_AUDIT.md`)의 수치는 **전부 재계수**했고, 아래 "확인했고 문제 없음" 절에 결과를 적었다. 빌드·e2e는 실행하지 않았다.
- 질문: **이 사이트가 한국어 검색 트래픽을 얻고 유지하면서 스스로 발목을 잡지 않는가?**
- 결론 먼저: **BLOCKER 0 · MAJOR 2 · MINOR 8 · NOTE 9.** 기술 SEO(canonical/hreflang/sitemap/robots/JSON-LD/링크 그래프)는 깨끗하다. 남은 문제는 전부 "어떤 한국어 단어가 `<title>`에 있느냐"라는 편집 문제이며, 트래픽의 **상한**을 낮추지 출시를 막지는 않는다.

---

## 1. 확인했고 문제 없음 (재계수 근거)

| 항목 | 결과 |
|---|---|
| 문서 수 / indexable / sitemap | 144 / 141 / 141. sitemap의 141 `<loc>` 전부 빌드 파일로 해석, noindex 페이지 포함 0, indexable인데 누락 0 |
| `<title>` / description 고유성 | 141/141 고유, 141/141 고유 (문자열 기준) |
| canonical | 142/142(`/ko/search` 포함) 자기 자신·절대 URL·`https://3bettilt.com`·슬래시 없음. 404/500은 canonical 없음 |
| 슬래시·origin | `routes-manifest.json`: `/` → `/ko` 308, `/:path+/` → 슬래시 제거 308(내부). sitemap·canonical·내부 링크 6,109건 모두 슬래시 없음 |
| hreflang | 141 indexable 전부 `ko-KR` + `x-default` = canonical(속성명 `hrefLang`, HTML은 대소문자 무관). noindex/404에는 없음. sitemap `xhtml:link` 282 = 141×2 |
| robots.txt | `User-Agent: * / Allow: / / Sitemap: https://3bettilt.com/sitemap.xml`. Disallow 없음은 의도(`robots.ts` 주석, noindex를 읽게 하려면 fetch 허용) — 동의 |
| noindex 배치 | `/ko/search` `noindex, follow` + sitemap 제외 + canonical self; `_not-found` `noindex`. 그 외 141 전부 `index, follow` |
| OG / Twitter | 141 전부 `og:url`=canonical, `og:locale=ko_KR`, `og:site_name=3BetTilt`, 이미지 절대 URL 1200×630 + alt, `og:type` article(learn·blog)/website(그 외), `twitter:card=summary_large_image`. `public/og.png` 11,684B 존재 |
| JSON-LD | 144문서 파싱 실패 0, top-level `@context` 누락 0. FAQPage 61페이지의 Question 이름·Answer 앞 40자 전부 `<main>` 가시 텍스트에 존재(누락 0, `<h2>자주 묻는…</h2>` + `<h3>`/`<p>`로 렌더). BreadcrumbList 140 = 가시 브레드크럼 경로. CollectionPage ItemList 15/25/64/20/6/3 = 허브 자식 수. Article은 learn 15 + blog 25에만, WebApplication은 tool 6에만, DefinedTerm은 glossary 64에만 — 없는 콘텐츠에 붙은 스키마 0 |
| 내부 링크 | 깨진 링크 0/6,109. 범용 앵커("더 보기"·"자세히"·"여기") 0 — `자세히 보기 →`는 `Term.tsx:116` 팝오버 안에서 해당 용어 페이지로 가는 링크라 문맥 앵커로 본다. contextual inbound(`<main>` − 브레드크럼, distinct 소스) 분포 `0:1(홈) 2:10 3:11 4:8 5:7 6:10 7:21 8:12 9:10 10+:51` — 감사 §3과 **정확히 일치** |
| 쿼리스트링 링크 | `/ko/tools/range?hero=…&spot=RFI&stack=100` 8건, `/ko/tools/pot-odds?pot=…` 2건, `/ko/search?q=` 4건. `canonical.ts`는 라우트 path로 canonical을 만들므로 어떤 쿼리로 들어와도 bare URL이 정본. 문제 없음 |
| 브랜드 잔존 | `FishTilt`/`fishtilt.example`/`example.com`/`localhost` 포함 HTML 0/144 |
| `<html lang>` / `<h1>` | 143/144 `lang="ko"`(`_global-error`만 없음), 144/144 `<h1>` 1개 |

WP-S3-16 감사의 §1~§3 수치는 전부 내 재계수와 일치한다. 감사가 틀린 곳은 찾지 못했다.

---

## 2. 발견 사항

형식: `SEVERITY | area | what is wrong | evidence | why it matters | suggested direction`

### BLOCKER — 없음

### MAJOR

**C-M1 | 글로서리 title | 64편 중 45편의 `<title>`/H1에 그 페이지가 스스로 선언한 한국어 검색 표기가 없다.**
- 근거: 각 페이지 `DefinedTerm.name`/`alternateName`(한글만)과 `<title>`을 대조 — 포함 19/64. 예: `/ko/glossary/three-bet` title `다시 거는 세 번째 레이즈 (3-Bet)` vs `DefinedTerm.name: "쓰리벳"`, `alternateName: ["3벳","쓰리 벳",…]`; `/all-in` `가진 칩 전부 (All-in)` vs `올인`; `/flush` `같은 무늬 다섯 장 (Flush)` vs `플러시`; `/pot-odds` `콜 값어치 (Pot Odds)` vs `팟오즈`; `/range` `패의 묶음 (Range)` vs `레인지·핸드레인지`; `/river` `마지막 공용 카드 (River)` vs `리버`. 45편 전체 목록은 scratchpad 계수 출력에 있고 패턴은 동일하다.
- 왜 중요한가: 글로서리의 검색 역할은 키워드 맵·카니발 맵이 명시한 대로 `<한글 표기> 뜻`이다(BK seed 12개의 소유자). `<title>`은 가장 강한 온페이지 신호인데, 검색어는 스키마(`alternateName`)와 본문 한 줄(names 줄)에만 있다. 사이트가 검색어를 **알고 있으면서** title에서 뺀 상태다. 3벳 클러스터에서는 이미 부작용이 보인다: learn(`상대의 레이즈에 다시 레이즈 (3-Bet)`)·glossary 둘 다 "3벳/쓰리벳"이 없고, 블로그 `3벳(쓰리벳, 3-Bet)은 왜 3일까?`만 한글 표기를 가져 **선언된 소유자(glossary)가 아니라 블로그가 "3벳 뜻"의 실질 소유자**가 된다.
- 판정(오픈 이슈 1, 글로서리 부분): **중요하다. 출시는 막지 않지만, 글로서리 64편이 검색에서 거의 기여하지 못하는 상한을 만든다.** WP-16이 "Search Console 이후 재검토"로 넘겼는데, 데이터가 쌓이려면 먼저 노출이 있어야 하므로 순서가 거꾸로다.
- 방향: 콘텐츠 owner 결정. 가장 작은 변경은 title 패턴을 `<한글 표기> (<원어>) — <쉬운 설명>`으로 뒤집는 것(예: `쓰리벳 (3-Bet) — 다시 거는 세 번째 레이즈`). H1은 유지해도 되며 그러려면 `types.ts`에 `seoTitle?`을 glossary로 올리는 결정이 선행된다(감사 §8 3항). 45편 일괄이므로 스크립트 작업 1건 규모.

**C-M2 | Learn title / 룰·하는법 intent | 초보 사이트의 머리 질의 4개를 소유 페이지 title이 주장하지 않는다.**
- 근거(빌드 title): `/ko/learn/holdem-basics` `텍사스 홀덤은 어떻게 진행될까요?` — "하는 법/룰/규칙" 없음(키워드 맵 §0-1의 seed 3개 `홀덤 하는법·홀덤 룰·텍사스 홀덤 규칙` 전부 title 미주장, 앵커 `홀덤 하는 법`은 홈에서 1회만). `/learn/poker-hand-rankings` `어떤 족보가 더 강할까요?` — "홀덤/포커 족보 순서" 없음. `/learn/starting-hands` `처음 받은 두 장, 좋은 패일까요?` — "시작 핸드/시작 패" 없음. `/learn/positions-6max` `UTG · HJ · CO · BTN · SB · BB, 여섯 자리의 이름` — "포지션" 없음.
- 왜 중요한가: 카니발 맵 §5 #1~3이 "페이지는 있으나 title 미주장"으로 분류한 그대로다. `홀덤 하는법`은 이 사이트의 존재 이유에 가장 가까운 질의이고 `/`·`/learn` 허브도 이를 주장하지 않는다(`무료 홀덤 학습`, `홀덤 처음 배우기`). 이 4편은 15편 중 inbound가 가장 많은 축(감사 §3 learn max 38)이라 링크 그래프는 준비돼 있는데 title만 빠졌다.
- 판정(오픈 이슈 1, learn 부분): **중요하다.** 글로서리 45편보다 페이지 수는 적지만 질의당 가치는 더 크다.
- 방향: 4편 title에 머리어를 앞세우기(키워드 맵 §2 제안 그대로: `텍사스 홀덤 하는 법 — 규칙과 한 판의 흐름`, `포커 족보 순서 — …`, `홀덤 시작 핸드 보는 법 — …`, `6맥스 포지션 이름 — UTG·HJ·CO·BTN·SB·BB`). learn은 `seoTitle`이 없어 H1이 같이 바뀐다 — WP-10이 H1을 지킨 이유(문장형 H1)가 있다면 `seoTitle` 필드 도입이 선행 결정.

### MINOR

**C-m1 | 글로서리 description | 53/64가 50자 미만이고, 21자 최소(`river`·`turn`). 내용이 정의가 아니라 "X를 설명합니다"라는 메타 문장이다.**
- 근거: `/ko/glossary/river` description `리버가 왜 마지막 카드인지 설명합니다.`(21자) vs 같은 페이지 `DefinedTerm.description` `마지막으로 열리는 다섯 번째 공용 카드를 말합니다.`; `/bet` `베팅이 체크·레이즈와 무엇이 다른지 설명합니다.`(26자). 30자 미만 15편(감사 §8 목록과 동일).
- 왜 중요한가: 길이 자체는 순위 요소가 아니고 Google이 절반 이상을 다시 쓴다. 문제는 **스니펫에 정의가 없다**는 점 — "X 뜻" 질의의 클릭은 스니펫에 뜻이 보일 때 나온다. 정의 한 줄은 이미 레코드에 있다(DefinedTerm.description = 페이지 첫 문장).
- 판정(오픈 이슈 2): **작다.** 한 줄 정의를 description으로 쓰거나 앞에 붙이는 필드 교체 1건. C-M1과 같이 처리하면 비용 0에 가깝다.

**C-m2 | Preview 색인 | 코드에 환경 게이트가 없고(`robots.ts` 항상 `Allow: /`, `metadata.ts`는 `policy.ts`만 읽음, `next.config.ts` `headers()` 없음, `vercel.json` 없음), preview 호스트도 `index, follow`를 보낸다.**
- 근거: `apps/fishtilt/src/app/robots.ts:29-32`, `src/lib/seo/metadata.ts:103`(`robots: { index: input.index, follow: true }`), `.next/routes-manifest.json` `headers: []`. DEPLOY §5.2가 정확히 이 상태를 서술한다.
- 왜 중요한가/왜 작은가: 완화가 셋이다 — (1) canonical·og:url·sitemap이 항상 production origin(D-S3-05, 빌드 HTML로 확인), (2) preview로 향하는 링크가 세상에 없음, (3) Vercel이 preview 응답에 `X-Robots-Tag: noindex`를 붙이는 것은 플랫폼 문서 사항(저장소가 검증하진 않음). 실제로 물리는 경우는 preview에 커스텀 도메인을 붙이거나 Vercel이 아닌 호스트로 갈 때뿐이다.
- 판정(오픈 이슈 3): **작다. 배포 설정 사항이지 SEO 결함이 아니다.** 다만 6줄이면 닫힌다: `next.config.ts#headers()`에서 `process.env.VERCEL_ENV === 'preview'`일 때만 `X-Robots-Tag: noindex` — 메타 robots·policy.ts·D-S3-05와 충돌 없음(감사 §7의 제안과 같은 결론). `robots.txt` Disallow는 여전히 오답. 최소한 DEPLOY §5.2의 `curl -I | grep -i x-robots-tag`를 첫 preview에서 실행하고 결과를 기록할 것.

**C-m3 | Hands 20편 템플릿 중복 | 페이지 간 단어 시퀀스 유사도 63~73%(`difflib`, `<main>` 텍스트): 77↔88 0.726, 88↔99 0.719, KJs↔QJs 0.690, AKs↔AQs 0.633, AA↔KK 0.632. description은 77/88/99가 숫자 한 글자만 다름(`N 두 장을 받은 경우. 이 정도 포켓 페어의 조합 수와 순위를 확인합니다.`).**
- 근거: 각 페이지가 13×13 셀 라벨 169개(`AA AKs … 32o`)와 같은 설명 문단을 반복 렌더한다(`/ko/hands/88` 텍스트 덤프). 페이지당 1,100~1,300 단어 중 고유 부분은 순위·조합·기대 몫 숫자, 이웃 패 표, 첫 레이즈 자리, FAQ 3문항.
- 왜 중요한가: 근거 데이터가 진짜이고 페이지마다 다르므로 페널티 위험은 낮다. 위험은 "무시됨" — `77 홀덤` 같은 질의는 볼륨도 작다. 사이트 전체에 해를 끼치진 않는다.
- 방향: 미니 매트릭스의 169 라벨을 텍스트가 아니라 `aria-hidden` 시각 요소로 낮추거나 하이라이트 주변만 렌더; description을 순위·조합 수로 개별화(`88 — 169개 중 7위, 조합 6가지, 무작위 상대 기대 몫 69.2%`).

**C-m4 | 날짜 신호 부재 | Article 40건 중 `datePublished`/`dateModified` 0건, 가시 날짜(`<time>`, 업데이트/작성일) 0페이지, `article:published_time` 0, sitemap `lastmod` 0.**
- 근거: `jsonLd.ts#articleJsonLd`에 날짜 필드 없음, `sitemap.ts`는 `url`+`alternates`만 emit, HTML grep 결과 0.
- 왜 중요한가: 블로그 25편·레슨 15편이 전부 "무일자"다. Article 리치 결과의 recommended 필드이고, SERP 날짜 표시·재크롤 스케줄·"최신" 필터에서 빠진다. 반대로 오래돼 보일 위험은 없다.
- 방향: 레코드에 `publishedAt`/`updatedAt` 추가 → Article·sitemap `lastmod`·`ArticleMeta` 가시 표기. 스키마와 화면이 같은 값을 쓰도록.

**C-m5 | Organization 스키마 | `logo`·`sameAs` 없음. `Article.publisher.logo`는 Google Article 가이드의 recommended.**
- 근거: `jsonLd.ts` `PUBLISHER = { '@type':'Organization', name, url }`, 빌드 `/ko` Organization 블록 동일.
- 방향: `public/icon.svg`/`apple-icon.png`가 있으므로 `logo: ImageObject` 한 줄. `sameAs`는 실제 계정이 생길 때만.

**C-m6 | 표기 분열이 소유자 경계와 겹친다 | `팟 오즈`(tool title·라우트 라벨·푸터·홈 description·root layout fallback) vs `팟오즈`(learn·blog title·glossary alias 1순위); `시작 패`(learn 2편 title) vs `시작 핸드`(tool·hub·quiz·푸터); `아웃 계산기`(푸터/nav 라벨) vs `아웃츠 계산기`(title).**
- 근거: 빌드 title 덤프 + 푸터 앵커 목록(`/ko/tools/outs => 아웃 계산기`, `/ko/tools/pot-odds => 팟 오즈 계산기`, `/ko/tools/starting-hand => 시작 핸드 탐색기`).
- 왜 중요한가: Google은 한국어 띄어쓰기 변형을 대체로 같이 보지만, 같은 대상을 가리키는 사이트 전체 앵커가 둘로 갈리면 소유자 신호가 갈린다. 감사 §4가 이미 남긴 항목(`routes.ts` 라벨).
- 방향: `routes.ts` 라벨 3개 수정(`팟오즈 계산기`, `아웃츠 계산기`, `시작 핸드 순위표`), learn 2편은 C-M2와 함께.

**C-m7 | 사이트 전체 nav 앵커 `핸드레인지` → `/ko/tools/range` vs 선언 소유자 `/ko/learn/poker-range`.**
- 근거: 헤더·푸터 141페이지 전부 `href="/ko/tools/range"` 앵커 `핸드레인지`; 카니발 맵 §5 #12~14는 `핸드레인지`의 소유자를 learn으로 선언. tool 앵커 텍스트 집합: `핸드레인지 열기 | 핸드레인지 표 | 13×13 핸드레인지 열기 | 핸드레인지`, learn 앵커: `핸드레인지란? | 레인지 레슨`.
- 왜 중요한가/왜 작은가: 문서와 HTML이 다른 페이지를 가리키지만 HTML 신호 자체는 일관되고(tool이 압도), 툴 페이지가 `핸드레인지` 질의에 나쁜 답도 아니다(가시 텍스트 9,350자, 설명 포함). 실제 카니발이 아니라 **소유 선언의 오기**에 가깝다.
- 방향: 코드보다 문서 — 카니발 맵에서 `핸드레인지`(head term)의 소유자를 tool로, `핸드레인지란/레인지 개념`을 learn으로 재선언. 굳이 코드를 바꾸면 nav 앵커를 `핸드레인지 표`로.

**C-m8 | `/ko/about` | title `소개 · 3BetTilt`, 사람·연락 수단 0.**
- 근거: about 가시 텍스트 전문 — 계산 방식·비제휴·비수집 원칙은 잘 적혀 있으나 만든 사람/팀, 이메일, 문의 폼, 저장소 링크가 하나도 없고 외부 링크가 사이트 전체에 0건이다. "오류를 발견했을 때" 절이 있는데 알릴 방법이 없다.
- 왜 중요한가: 포커는 도박 인접 주제라 신뢰 신호를 더 본다. E-E-A-T 페이지가 title에 브랜드조차 없다(`3BetTilt 소개 — 숫자의 출처와 비제휴 원칙`, 키워드 맵 §1 제안).
- 방향: title 수정 + 연락 경로 1개(메일 주소 하나면 충분).

### NOTE

- **C-n1 | 한국어 SERP 폭.** 감사의 "60자 이내" 규칙은 라틴 기준. 한글 1자≈영문 2자 폭이라 ~32자 안팎에서 잘린다. 32자 초과(페이지 부분) 4편: `blog/what-is-kicker`(38), `full-house-loses`(37), `river-changes-everything`(35), `btn-why-wide`(32). 핵심 구가 앞에 있어 잘려도 손해는 작다. 이후 title 작성 규칙에 "한글 30자"를 추가할 것.
- **C-n2 | FAQPage 61페이지.** 유효하고 가시적이지만 2023-08 이후 Google은 정부·의료 사이트에만 FAQ 리치 결과를 보여준다 — 이득 0, 해도 0. 10페이지(`blog/flush-vs-straight`·`full-house-vs-flush`·`small-pocket-pairs`·`why-72o-is-weak`·`why-suited-matters`, `hands/ajs·ako·aks·aqo·aqs`)의 `Answer.text`에 MDX 줄바꿈이 `\n\n`으로 남아 있다(화면은 정상). 화장품 수준.
- **C-n3 | 두 번째 로케일.** 현재 하나뿐인 로케일에 대해 hreflang·sitemap·라우트는 정직하다(존재하지 않는 언어 0). 그러나 `hreflangAlternates`(`metadata.ts:69-77`)는 "자기 로케일 + x-default=자기 URL"만 내므로 `en`을 추가하면 **모든 페이지가 자기 자신을 x-default로 주장**하고 상호 alternate가 없어 즉시 거짓이 된다. `<html lang>`(`layout.tsx`)·`SITE_LOCALE`·`inLanguage:'ko'`(jsonLd 전부)도 상수. D-S3-01의 "배열 원소 추가"는 라우팅에만 참이고 SEO 층은 재작업 대상. 지금 고칠 일은 아니고 기록용.
- **C-n4 | 블로그 RSS/Atom 없음.** `rel="alternate" type="application/rss+xml"` 0. 한국어 블로그 트래픽에서 피드 비중은 작지만 25편짜리 editorial hub에는 보통 있다.
- **C-n5 | og.png 단일 카드 141페이지 공용.** D-S3-18 결정 사항. 소셜 CTR 상한만 기록.
- **C-n6 | 글로서리 contextual inbound = 2인 10편**(`action·bluff·c-bet·gutshot·heads-up·ip-oop·limp·nuts·open-ended·set-vs-trips`): 그중 하나는 허브다. 고아는 아니지만 다음 콘텐츠 라운드의 `<Term>` 후보(감사 §3과 같은 판단).
- **C-n7 | 허브 title이 짧다**: `홀덤 퀴즈`·`무료 포커 도구`·`포커 용어 사전`·`홀덤 처음 배우기`·`포커 이야기와 검색 가이드`. 틀리진 않았고 키워드 맵 §1의 수식어 제안(`— 규칙부터 팟오즈까지 15강` 등)을 붙일 여지만 있다.
- **C-n8 | `_global-error`**: `lang` 없음, 영문. 크롤 경로 없음. 감사 §8과 동일.
- **C-n9 | 쿼리스트링 내부 링크 14건** — 위 표대로 canonical이 bare path라 문제 없음을 확인했다는 기록.

---

## 3. 카니발라이제이션 판정 (빌드 title 기준, 내 독립 판단)

| 클러스터 | 빌드 title | 판정 |
|---|---|---|
| 핸드레인지 | learn `핸드레인지란?` / tool `13×13 핸드레인지 표 — 포지션별 오픈 레인지 (6-max · 100BB)` / glossary `패의 묶음 (Range)` / blog `레인지로 보는 이유 — …` | 역할 분리 OK. head term은 링크 그래프상 tool이 소유 — 문서만 고칠 것(C-m7) |
| 3벳 | learn `상대의 레이즈에 다시 레이즈 (3-Bet)` / glossary `다시 거는 세 번째 레이즈 (3-Bet)` / blog `3벳(쓰리벳, 3-Bet)은 왜 3일까? …` | learn↔glossary title이 사실상 같은 문구(둘 다 "다시 … 레이즈 (3-Bet)")이고 한글 표기는 블로그에만 → "3벳 뜻"의 실질 소유자가 선언과 다름(C-M1) |
| 팟오즈 | learn `콜할 값어치가 있을까? 팟오즈` / glossary `콜 값어치 (Pot Odds)` / tool `팟 오즈 계산기 — …` / blog `팟오즈 쉽게 계산하기 — …` | 분리 OK. learn↔glossary "콜 값어치" 근접 + 표기 분열(C-m6) |
| 13×13 | tool / learn `13×13 표는 어떻게 읽나요?` / glossary `13×13 표 (Hand Matrix)` | learn↔glossary 머리어 동일. glossary 본문 41자 description·~1,100자라 실제로는 learn이 이긴다. C-M1 패턴 적용 시(`핸드 매트릭스 (Hand Matrix) — 13×13 표`) 자연 해소 |
| 족보 | learn `어떤 족보가 더 강할까요?` / glossary `패의 순서, 족보 (Hand Ranking)` / tool `포커 족보 확인기 (핸드 체커) — …` / quiz `족보 퀴즈` / blog 비교 5편 | 분리 OK. 단 "포커 족보 순서" head term을 learn title이 주장하지 않음(C-M2) |
| 시작 핸드 | learn `처음 받은 두 장, 좋은 패일까요?`·`시작 패는 어떤 순서로 강할까요?` / tool `시작 핸드 순위표 — …` / hub `홀덤 시작 핸드 목록 — …` / hands 20 | 분리 OK. learn 2편이 "시작 핸드"를 title에 안 씀(C-M2·C-m6) |
| 포지션 | learn `자리(포지션)가 왜 …` · `UTG · HJ · CO …` / glossary 7 / blog `버튼(BTN) …` | 분리 OK(learn 두 편 텍스트 유사도 0.325). positions-6max에 "포지션" 없음(C-M2) |
| 키커 / 수티드 / 블라인드 / AA 확률 / 아웃츠 / 에퀴티 | 각 1 소유자 | 분리 OK — 확인함 |
| 룰·하는법 | `/learn/holdem-basics` `텍사스 홀덤은 어떻게 진행될까요?` | 소유자 1이나 title 미주장(C-M2). `체크레이즈 뜻`·`포켓페어/플러시/스트레이트 확률`은 페이지 자체가 없음(카니발 맵 §1.12·§5 그대로, 신규 콘텐츠 영역) |
| 홈 vs `/learn` | `무료 홀덤 학습` / `홀덤 처음 배우기` | 분리 OK |

같은 1차 의도를 두 title이 동시에 주장하는 쌍은 없다. 문제는 반대 방향 — **주장해야 할 title이 주장하지 않는** 쪽이다.

---

## 4. 오픈 이슈 3건에 대한 답

| # | 이슈 | 중요한가 | 얼마나 | 근거 |
|---|---|---|---|---|
| 1 | learn·glossary title에 검색 한국어 표기 없음 | **예** | **MAJOR ×2** (C-M1 글로서리 45/64, C-M2 learn 4편). 출시 차단은 아님 | 사이트가 검색어를 `alternateName`·names 줄에 넣어 두고 `<title>`에서만 뺐다. 3벳 클러스터에서 이미 블로그가 글로서리를 대신하고 있다. "Search Console 이후 재검토"는 노출이 먼저 있어야 성립 |
| 2 | 글로서리 description 53편 < 50자 | 조금 | **MINOR** (C-m1) | 길이는 무관, 내용이 정의가 아닌 것이 문제. 정의 문장은 이미 레코드에 있어 필드 교체로 끝남 |
| 3 | preview noindex 없음 | 조금 | **MINOR** (C-m2) | canonical=production + Vercel 플랫폼 noindex(미검증) + 외부 링크 0. `headers()` 6줄로 닫히고, 최소한 첫 preview에서 `curl -I` 확인을 기록 |

---

## 5. 렌더가 필요했지만 없던 것

없음. 이 리뷰의 판단은 전부 프리렌더 HTML과 소스로 가능했고 스크린샷을 근거로 쓰지 않았다.
