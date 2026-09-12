# 3BetTilt 키워드 맵 (WP-S3-02 Agent A · SEO / IA / 키워드 / 카니발라이제이션)

- 작성 기준: 2026-09-09, read-only 감사. 소스 진실 = `apps/fishtilt/src/content/registry/**`(113 레코드, `tsx`로 덤프해 계수), `apps/fishtilt/content/{learn,blog,glossary,hands}/*.mdx`(본문), `src/lib/routes.ts`(정적 18 route), `src/app/**/page.tsx`의 `pageMetadata` 리터럴.
- **URL 표기**: 아래 표의 path는 전부 `/ko` 접두어를 뺀 값이다. 공개 URL은 모두 `https://3bettilt.com/ko` + path (계약 A). 감사 시점에 `src/app/[locale]/`는 아직 없음(`ls` 확인) — 동시 진행 중인 locale 이동과 무관하게 레지스트리 slug는 그대로다.
- **행 수**: 정적 route 18 − `/search`(noindex, `policy.ts:50 SECTION_INDEXABLE.search=false`) = 17, + 콘텐츠 113(전부 `PUBLISHED`+`indexable:true`, 덤프로 계수) = **130 indexable 페이지**. 오케스트레이터 지시의 "131"은 `/search`를 포함한 route 총수와 같다.
- **제목 규칙**: 현재 빌더는 `'{title} · FishTilt'`(`metadata.ts:42 formatTitle`). 제안 제목은 페이지 부분만 적었고, 실제 `<title>`은 여기에 ` | 3BetTilt`(11자)를 붙인다. 따라서 페이지 부분 ≤ 49자 = 전체 ≤ 60자. 아래 제안 제목은 스크립트로 전부 ≤ 49자 확인(§7).
- 검색량 수치는 어디에도 없다. "primary keyword hypothesis"는 BK seed와 레코드 `aliases`/본문 어휘에서 추론한 **가설**이다. 숫자 형태로 적힌 것은 전부 grep/ls/덤프로 잰 실측이다.
- 라벨: `WEAK` = 현재 title/description이 해당 질의를 title에 담지 못함(사유 ≤ 12단어). H1 열의 `Y` = SEO title과 H1이 달라도 되는 페이지(계약 BO: Search Guide/Story는 허용).

## 0. Executive summary

1. **가장 큰 intent 공백은 "룰/하는법" 군이다.** BK seed 3개(홀덤 하는법 · 홀덤 룰 · 텍사스 홀덤 규칙)의 자연 소유자는 `/learn/holdem-basics`인데, 현재 title은 `텍사스 홀덤은 어떻게 진행될까요?`이고 113 MDX 전체에서 "하는 법/하는법"은 **1파일 1회**, "규칙/룰"은 21파일 47회(대부분 문장 속 일반어). 머리 질의를 title에 가진 페이지가 0개다.
2. **글로서리 58개 중 39개(67%)는 사람들이 검색하는 한글 표기가 title에 없다.** title이 `<쉬운 설명> (<원어>)` 패턴(예: `내 차례가 오는 자리 (Position)`)이고, `포지션`·`레인지`·`플러시`·`3벳` 같은 검색 표기는 `aliases` 필드에만 있다(덤프로 계수: title에 alias 1개 이상 포함 = 19/58). "X 뜻" 질의 12개(BK)의 소유자가 글로서리인 만큼 이 패턴은 Stage 3에서 반드시 뒤집어야 한다 → §5.
3. **Data & Probability 축은 seed 4개 중 3개가 무주공산이다.** `포켓페어 확률`·`플러시 확률`·`스트레이트 확률`은 소유 페이지가 없다. 엔진 fact는 이미 있다(`facts.ts`: `CATEGORY_FREQUENCY`, `COMBOS_OF_KIND`, `HAND_ONE_IN_N`) — `blog/flush-vs-straight`가 `CATEGORY_FREQUENCY(FLUSH|STRAIGHT)`를 비교용으로만 쓴다. `체크레이즈 뜻`도 소유자 없음(`glossary/check.mdx:17`에 한 문장뿐). **페이지 자체가 없는 seed = 4/45**, 여기에 1번의 "페이지는 있으나 title이 주장하지 않는" 3개를 더하면 7/45.
4. **소유자가 둘 이상인 seed = 24/45** (§B-5 표). 대표: `핸드레인지`(learn `핸드레인지란?` vs 헤더 nav 앵커 `핸드레인지`→`/tools/range`, `routes.ts:47`), `13x13 핸드레인지`(title에 13×13이 들어간 페이지 3개: `learn/hand-matrix`, `tools/range`, `glossary/hand-matrix`), `시작 핸드 순위`(learn vs tool), `홀덤 족보`(learn·glossary·tool·quiz 4개), `키커 뜻`(glossary + blog 2편), `팟오즈`/`아웃츠`(각 4개).
5. **툴 6개 중 4개 title이 계산기 질의 형태를 놓친다.** `아웃 계산기`(seed는 `아웃츠 계산기`), `시작 핸드 탐색기`(`순위` 없음), `핸드 체커`(`족보` 없음), `승률 계산기`(`포커`/`에퀴티` 없음). `팟 오즈 계산기`는 띄어쓰기가 seed(`팟오즈`)·learn title(`팟오즈`)과 어긋난다("팟 오즈|팟오즈" 10파일 22회, 두 표기 혼재).
6. **블로그 4편은 영문 머리 제목이다**: `suited hand가 좋은 이유`, `Range를 보는 이유`, `kicker란?`, `Big Blind는 왜 돈을 먼저 내나?`. 한국어 질의와 title 매칭이 약하다.
7. **본문 contextual link는 사실상 없다.** MDX 본문 마크다운 링크(`](/…)`): learn 1개 파일, blog 6개 파일, glossary 3개 파일, hands 1개 파일. 나머지 연결은 전부 하단 `RelatedContent`(레지스트리 관계 필드)와 `<ToolCTA>`(learn 15 + blog 20 = 35편 전부 1개씩, glossary/hands 0). 계약 BP("하단 Related만 쓰지 않는다")와 가장 먼 지점이다.
8. **레지스트리 인바운드 0인 페이지 3개** = `glossary/c-bet`, `glossary/bluff`, `glossary/nuts`(허브 목록·검색 외 진입로 없음). `c-bet`은 BK seed(`cbet 뜻`)의 소유자다. 인바운드 1개뿐인 페이지 19개(§5·§3 표시).
9. **블로그 상호 링크가 약하다.** 블로그 20편의 `relatedArticles`는 3편만 채워져 있고(`same-pair-who-wins`, `what-is-kicker`, `playing-the-board`), 나머지 17편은 빈 배열. 블로그가 editorial hub가 되면 Story↔Guide 상호 링크가 필수인데 그 필드가 비어 있다.
10. **`WEAK` 총 55/130**: 정적 8 · learn 4 · blog 4 · hands 0 · glossary 39. 39개는 위 2번의 단일 패턴이므로 실질 개별 수정은 16건 + 패턴 1건이다.
11. `relatedTools` 편중: `range` 51 · `toolStartingHand` 35 · `toolEquity` 24 · `toolOuts` 13 · `toolHandChecker` 8 · `toolPotOdds` 6 · `practice` 3. 팟오즈 계산기는 seed 2개(`팟오즈`·`팟오즈 계산기`)의 툴 소유자인데 레코드 인바운드가 가장 적다.
12. 현재 title은 모두 ` | 3BetTilt` 기준 60자 이내(덤프 계수: 초과 0). 길이는 문제가 아니고 **어휘**가 문제다.

## 1. 정적 페이지 17 (홈 · 허브 6 · 툴 6 · 퀴즈 3 · about)

| path | 역할 | 의도 | 1차 키워드 가설 | 2차 질의 | 사용자 질문 | 현재 title | 제안 title(+` \| 3BetTilt`) | H1≠? | 카니발 경쟁 path | 필요한 인바운드 | 주요 아웃바운드 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | 브랜드/사이트 대표 | 학습 진입 | 홀덤 배우기 | 텍사스 홀덤 초보 · 홀덤 공부 · 무료 홀덤 학습 사이트 | 홀덤을 처음부터 어디서 배우지? | 무료 홀덤 학습 (`page.tsx:104`) | 텍사스 홀덤 배우기 — 무료 강의·계산기·핸드레인지 | Y (H1은 문장 `홀덤, 외우지 말고 눈으로 이해하세요.` `page.tsx:344`) | `/learn` (C19) | 헤더 워드마크(전 페이지) | `/learn`, `/tools/range`, `/tools/equity`, `/practice`, 글로서리 6개(`HOME_GLOSSARY_PICKS` `page.tsx:140`) |
| `/learn` | 커리큘럼 허브 | 학습 | 홀덤 기초 | 홀덤 입문 순서 · 홀덤 강의 무료 · 홀덤 초보 공부 | 무엇부터 어떤 순서로 읽지? | 홀덤 처음 배우기 (`learn/page.tsx:34`) | 홀덤 처음 배우기 — 규칙부터 팟오즈까지 15강 | N | `/` (C19) | 홈 CTA, 헤더①, 콘텐츠 113 브레드크럼 | learn 15 |
| `/blog` | **editorial hub**(계약 AF) | 탐색 | 포커 이야기 / 포커 궁금증 | 홀덤 핸드 리뷰 · 포커 초보 실수 · 포커 확률 이야기 | 읽을 만한 포커 글이 있나? | 포커 궁금증 모음 (`blog/page.tsx:99`) `WEAK` 역할이 Q&A 모음에서 editorial hub로 바뀜 | 3BetTilt 블로그 — 핸드 스토리·검색 가이드·확률 | Y | — | 헤더⑤, 홈 섹션, blog 20 브레드크럼 | blog 20 (topic 그룹 `TOPIC_LABEL`, `blog/page.tsx:149`) |
| `/glossary` | 사전 허브 | 조회 | 포커 용어 | 홀덤 용어 정리 · 포커 용어 사전 · 홀덤 용어집 | 이 말이 무슨 뜻이지? (목록) | 포커 용어 사전 (`glossary/page.tsx:35`) | 포커 용어 사전 — 홀덤 용어 뜻을 쉬운 한국어로 | N | — | 헤더⑥, `<Term>` 팝오버 전부 | glossary 58 |
| `/hands` | 시작 핸드 목록 허브 | 탐색 | 홀덤 시작 핸드 목록 | 포커 핸드 종류 · 시작 패 목록 · 프리플랍 핸드 목록 | 어떤 시작 패 페이지가 있나? | 핸드 목록 (`hands/page.tsx:28`) `WEAK` "핸드 목록"은 무엇의 목록인지 없음 | 홀덤 시작 핸드 목록 — 패별 순위·조합 수·승률 | N | `/learn/starting-hand-ranking`, `/tools/starting-hand` (C9) | 푸터, `learn/starting-hands`·`starting-hand-ranking` 본문 링크(현재 0) | hands 20, `/tools/starting-hand` |
| `/tools` | 툴 허브 | 탐색 | 포커 계산기 | 홀덤 계산기 · 무료 포커 도구 · 홀덤 도구 모음 | 무슨 계산기가 있지? | 무료 포커 도구 (`tools/page.tsx:49`) | 무료 포커 계산기·홀덤 도구 모음 | N | — | 헤더③, 콘텐츠 `relatedTools` | 툴 6 |
| `/practice` | 퀴즈 허브 | 학습 | 홀덤 퀴즈 | 포커 퀴즈 · 홀덤 연습 문제 · 포커 문제 풀기 | 배운 걸 확인할 문제가 있나? | 홀덤 퀴즈 (`practice/page.tsx:42`) | 홀덤 퀴즈 — 족보·레인지·시작 핸드 연습 문제 | Y (H1 `배운 내용을 직접 풀어보세요` `:87`) | — | 헤더④, learn 하단 | 퀴즈 3 |
| `/about` | 브랜드/신뢰(E-E-A-T) | 브랜드 | 3BetTilt 소개 | 3BetTilt 어떤 사이트 · 쓰리벳틸트 | 이 숫자는 어디서 나오고 누가 만들었나? | 소개 (`about/page.tsx:28`) `WEAK` 브랜드명 없음, H1은 `FishTilt는 무엇인가요` | 3BetTilt 소개 — 숫자의 출처와 비제휴 원칙 (브랜드 suffix 중복 금지) | Y | — | 푸터 + 툴 6·퀴즈 3의 "숫자 출처" 링크 | `/tools`, `/learn` |
| `/tools/equity` | Tool | 계산 | 포커 승률 계산기 | 홀덤 승률 계산기 · 에퀴티 계산기 · 핸드 vs 핸드 승률 | 이 두 패의 승률이 얼마지? | 승률 계산기 (`tools/equity/page.tsx:42`) `WEAK` "포커/에퀴티" 없어 seed 3개 중 1개만 매칭 | 포커 승률 계산기 (에퀴티) — 핸드 vs 핸드 | N | `/learn/equity`, `/glossary/equity` (C7) | hands 20(`toolEquity` 24), `learn/equity`, `blog/qq-vs-ak` | `learn/equity`, `tools/pot-odds`(페이지 내 링크 있음 `:99`) |
| `/tools/pot-odds` | Tool | 계산 | 팟오즈 계산기 | 팟 오즈 계산법 · 콜 필요 승률 · 홀덤 팟오즈 | 이 베팅에 콜하려면 몇 % 이겨야 하나? | 팟 오즈 계산기 (`tools/pot-odds/page.tsx:39`) `WEAK` seed·learn은 `팟오즈`(붙여쓰기), 표기 불일치 | 팟오즈 계산기 — 콜에 필요한 승률 바로 계산 | N | `/learn/pot-odds`, `/glossary/pot-odds`, `/blog/pot-odds-quick` (C5) | `learn/pot-odds`, `blog/pot-odds-quick`, `glossary/pot`·`call`·`pot-odds`(현재 `toolPotOdds` 6) | `learn/pot-odds`, `tools/outs`(`:93`) |
| `/tools/outs` | Tool | 계산 | 아웃츠 계산기 | 드로우 완성 확률 · 아웃츠 확률표 · 2배 4배 규칙 | 내 드로우가 완성될 확률은? | 아웃 계산기 (`tools/outs/page.tsx:40`) `WEAK` seed는 `아웃츠`, title은 `아웃` | 아웃츠 계산기 — 드로우 완성 확률과 ×2·×4 규칙 | N | `/learn/outs`, `/glossary/outs`, `/blog/outs-nine` (C6) | `learn/outs`, `blog/outs-nine`, glossary 드로우/플러시 계열(현재 13) | `learn/outs`, `tools/pot-odds`(`:94`) |
| `/tools/range` | Tool(flagship) | 탐색 | 13x13 핸드레인지 | 홀덤 핸드표 · 포지션별 오픈 레인지 · 레인지 비교 | 자리별로 어떤 패로 레이즈하는지 표로 보고 싶다 | 13×13 핸드레인지 표 (`tools/range/page.tsx:52`) | 13x13 핸드레인지 표 — 포지션별 오픈 레인지 (6-max 100BB) | N (`title={SEO.title}` `:90`) | `/learn/poker-range`, `/learn/hand-matrix`, `/glossary/hand-matrix`, `/glossary/range` (C3·C4) | 헤더②(앵커 `핸드레인지` `routes.ts:47`), 홈 CTA, `range` 51 레코드 | `learn/poker-range`, `learn/hand-matrix`, `/practice/range-quiz` |
| `/tools/starting-hand` | Tool | 탐색 | 시작 핸드 순위표 | 169개 시작 패 · 프리플랍 핸드 강도 · 상위 몇 % 핸드 | 169개 패를 강한 순서로 보고 싶다 | 시작 핸드 탐색기 (`tools/starting-hand/page.tsx:61`) `WEAK` "순위" 없음, "탐색기"는 사이트 밖에서 안 쓰는 말 | 시작 핸드 순위표 — 169개 패를 승률순으로 | Y (H1 `169개 시작 패, 강한 순서로 보기` `:91`) | `/learn/starting-hand-ranking`, `/hands` (C9) | hands 20(`toolStartingHand` 35), `learn/starting-hand-ranking` | `learn/starting-hand-ranking`, hands 20 |
| `/tools/hand-checker` | Tool | 계산 | 포커 족보 확인 | 내 패 족보 계산기 · 족보 판정 · 홀덤 족보 확인기 | 지금 내 패가 무슨 족보지? | 핸드 체커 (`tools/hand-checker/page.tsx:45`) `WEAK` "족보" 없음, "핸드 체커"는 검색어가 아님 | 포커 족보 확인기 (핸드 체커) — 내 패 족보 판정 | N | `/learn/poker-hand-rankings`, `/glossary/hand-ranking`, `/practice/hand-ranking-quiz` (C8) | `learn/poker-hand-rankings`, 족보 glossary 10개(현재 `toolHandChecker` 8) | `learn/poker-hand-rankings`, `tools/outs`(`:99`) |
| `/practice/hand-ranking-quiz` | Quiz | 학습 | 포커 족보 퀴즈 | 홀덤 족보 문제 · 족보 외우기 · 족보 테스트 | 족보를 제대로 외웠나 확인하고 싶다 | 족보 퀴즈 (`hand-ranking-quiz/page.tsx:32`) | 포커 족보 퀴즈 — 두 패 중 이기는 쪽은? | N | `/tools/hand-checker` (C8) | `/practice`, `learn/poker-hand-rankings` | `learn/poker-hand-rankings`, `tools/hand-checker` |
| `/practice/range-quiz` | Quiz | 학습 | 레인지 퀴즈 | 포지션별 레인지 연습 · 오픈 레인지 문제 | 이 자리에서 이 패가 레인지에 드는지 맞혀보자 | 레인지 퀴즈 (`range-quiz/page.tsx:20`) | 핸드레인지 퀴즈 — 포지션별 오픈 레인지 연습 | N | `/tools/range` (C20) | `/practice`, `learn/poker-range` | `learn/poker-range`, `tools/range` |
| `/practice/starting-hand-quiz` | Quiz | 학습 | 시작 핸드 퀴즈 | 시작 패 강약 비교 · 프리플랍 핸드 비교 연습 | 두 시작 패 중 어느 쪽이 강한지 맞혀보자 | 시작 핸드 퀴즈 (`starting-hand-quiz/page.tsx:38`) | 시작 핸드 퀴즈 — 두 패 중 더 강한 쪽은? | N | `/tools/starting-hand` | `/practice`, `learn/starting-hand-ranking` | `learn/starting-hand-ranking`, `tools/starting-hand` |

## 2. Learn 15 (역할: 개념/커리큘럼. "X란/원리/보는 법/계산법" 소유. "X 뜻"은 글로서리에 양보)

| path | 역할 | 의도 | 1차 키워드 가설 | 2차 질의 | 사용자 질문 | 현재 title (`registry/learn/*.ts`) | 제안 title | H1≠? | 카니발 경쟁 | 필요한 인바운드 | 주요 아웃바운드 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/learn/holdem-basics` | Learn 01 | 학습 | 홀덤 하는법 | 홀덤 룰 · 텍사스 홀덤 규칙 · 홀덤 진행 순서 · 홀덤 게임 방법 | 홀덤은 어떻게 하는 게임이지? | 텍사스 홀덤은 어떻게 진행될까요? `WEAK` 룰/규칙/하는법 어느 것도 title에 없음 | 텍사스 홀덤 하는 법 — 규칙과 한 판의 흐름 | Y | `learn/poker-actions`, `learn/flop-turn-river`(룰의 일부), `blog/why-blinds-exist` | 홈 "포커가 처음이에요", `/learn` 1번, glossary `blind`·`ante`·`stack`·`pot`·`showdown`(현재 8) | `learn/poker-hand-rankings`, `tools/hand-checker`, glossary 4 |
| `/learn/poker-hand-rankings` | Learn 02 | 학습 | 포커 족보 순서 | 홀덤 족보 · 포커 핸드 순위 · 족보 순위표 · 포커 패 순위 | 족보는 어떤 순서로 강하지? | 어떤 족보가 더 강할까요? `WEAK` "홀덤/포커 족보 순서" 머리어 없음 | 포커 족보 순서 — 홀덤 족보 9가지 강한 순 | Y | `glossary/hand-ranking`(alias `족보`), `tools/hand-checker`, `practice/hand-ranking-quiz`, blog 비교글 5편 (C2·C8) | 족보 glossary 10 + blog 8 (현재 23, 최다) | `tools/hand-checker`, `practice/hand-ranking-quiz`, blog 5 |
| `/learn/starting-hands` | Learn 03 | 학습 | 홀덤 시작 핸드 | 홀덤 시작 패 · 시작 패 보는 법 · 수티드 커넥터 페어 | 처음 두 장이 좋은 패인지 어떻게 보지? | 처음 받은 두 장, 좋은 패일까요? `WEAK` "시작 핸드/시작 패" 없음 | 홀덤 시작 핸드 보는 법 — 수티드·커넥터·포켓페어 | Y | `/hands`, `learn/starting-hand-ranking` (C9·C10) | hands 20 + glossary 4 + blog 5(현재 33, 최다) | `tools/starting-hand`, `glossary/suited`·`offsuit`·`pocket-pair`, `hands/aks`·`ako` |
| `/learn/starting-hand-ranking` | Learn 04 | 학습 | 시작 핸드 순위 | 169가지 시작 패 · 시작 패 강한 순 · 프리플랍 핸드 강도 | 시작 패 169개는 어떤 순서로 강하지? | 시작 패는 어떤 순서로 강할까요? | 시작 핸드 순위 — 169가지 패는 어떤 순서로 강할까 | N | `tools/starting-hand`, `/hands` (C9) | blog 5 + `learn/starting-hands`(현재 6), **hands 20의 본문 링크(현재 0)** | `tools/starting-hand`, hands 10, `blog/next-best-after-aa`·`is-ak-good`·`why-72o-is-weak` |
| `/learn/hand-matrix` | Learn 05 | 학습 | 13x13 표 읽는 법 | 핸드 매트릭스 읽는 법 · 레인지 표 대각선 · 핸드 매트릭스란 | 정사각형 표의 대각선/위/아래가 뭐지? | 13×13 표는 어떻게 읽나요? | 13x13 핸드 매트릭스 읽는 법 — 대각선·위·아래 | N | `tools/range`(title `13×13 핸드레인지 표`), `glossary/hand-matrix`(title `13×13 표`) (C3) | `glossary/hand-matrix`·`combo`, `learn/poker-range`(현재 5) | `tools/range`, `tools/starting-hand`, hands 11 |
| `/learn/poker-range` | Learn 06 | 학습 | 핸드레인지 | 홀덤 핸드레인지 · 포커 레인지 · 핸드레인지란 · 레인지 개념 | 레인지가 뭐고 왜 묶어서 보지? | 핸드레인지란? | 핸드레인지란? 홀덤 레인지를 13x13 표로 이해하기 | N | `tools/range`, `glossary/range`(alias `핸드레인지`), `blog/why-use-range` (C4) | 헤더 nav 앵커 충돌 해소 필요(§B-1), `glossary/range`, `blog/why-use-range`(현재 5) | `tools/range`, `practice/range-quiz`, `learn/position`·`three-bet` |
| `/learn/position` | Learn 07 | 학습 | 홀덤 포지션 | 포커 포지션 · 포지션 중요성 · 홀덤 자리 유리 | 자리가 왜 그렇게 중요하지? | 자리(포지션)가 왜 그렇게 중요할까요? | 홀덤 포지션 — 자리가 왜 그렇게 중요할까 | N | `learn/positions-6max`, `glossary/position`, `blog/btn-why-wide` (C11) | `glossary/position`, `blog/btn-why-wide`·`is-ak-good`(현재 5) | `learn/positions-6max`, `tools/range`, `glossary/button`·`utg` |
| `/learn/positions-6max` | Learn 08 | 학습 | 6맥스 포지션 이름 | UTG HJ CO BTN SB BB · 홀덤 자리 이름 · 6인 테이블 자리 순서 | UTG, CO, BTN이 각각 어디지? | UTG · HJ · CO · BTN · SB · BB, 여섯 자리의 이름 `WEAK` "포지션"이라는 단어 자체가 없음 | 6맥스 포지션 이름 — UTG·HJ·CO·BTN·SB·BB | N | `learn/position`, 포지션 glossary 6 (C11) | glossary 6 + `blog/why-blinds-exist`(현재 8) | `tools/range`(포지션 선택), glossary 6 |
| `/learn/poker-actions` | Learn 09 | 학습 | 홀덤 액션 종류 | 체크 콜 레이즈 폴드 뜻 · 포커 행동 5가지 · 홀덤 베팅 방법 | 내 차례에 뭘 할 수 있지? | 체크 · 베팅 · 콜 · 레이즈 · 폴드, 다섯 가지 행동 | 홀덤 액션 5가지 — 체크·베팅·콜·레이즈·폴드 | N | 액션 glossary 8 (`action`·`check`·`bet`·`call`·`raise`·`fold`·`all-in`·`bluff`) | glossary 8(현재 10) | glossary 8, `tools/pot-odds` |
| `/learn/preflop` | Learn 10 | 학습 | 프리플랍이란 | 프리플랍 진행 · 첫 베팅 라운드 · 오픈레이즈 림프 차이 | 카드 두 장 받고 나서 뭘 보고 결정하지? | 첫 두 장을 받은 뒤, 프리플랍 | 프리플랍이란? 첫 베팅 라운드에서 보는 것 | N | `glossary/preflop` (C12) | glossary `preflop`·`open-raise`·`limp`·`vpip`·`pfr`(현재 8) | `tools/range`, `learn/flop-turn-river` |
| `/learn/flop-turn-river` | Learn 11 | 학습 | 플랍 턴 리버 | 공용 카드 순서 · 홀덤 라운드 이름 · 플랍 턴 리버 뜻 | 카드가 몇 장씩 어떤 순서로 열리지? | 플랍 · 턴 · 리버, 카드는 이렇게 열립니다 | 플랍·턴·리버 — 공용 카드가 열리는 순서와 이름 | N | glossary `flop`·`turn`·`river`·`board`·`community-cards` | glossary 6 + `glossary/c-bet`(현재 9) | glossary 6, `tools/outs` |
| `/learn/three-bet` | Learn 12 | 학습 | 3벳이란 | 3벳 상황 · 리레이즈 뜻 · 4벳 · 3벳 이후 달라지는 것 | 3벳이 뭐고 그 다음엔 뭐가 달라지지? | 상대의 레이즈에 다시 레이즈 (3-Bet) | 3벳(3-Bet)이란? 리레이즈 상황에서 달라지는 것 | N | `glossary/three-bet`(`3벳 뜻` 소유), `blog/why-called-3bet`(유래) (C1 CHANGED) | `glossary/three-bet`·`four-bet`, `blog/why-called-3bet`(현재 5) | `glossary/three-bet`·`four-bet`·`open-raise`, `tools/range` |
| `/learn/equity` | Learn 13 | 학습 | 에퀴티란 | 포커 에퀴티 · 승률 개념 · 에퀴티 계산 방법 | 내 승률이 몇 %라는 게 무슨 뜻이지? | 내 승률은 몇 퍼센트일까? (Equity) | 에퀴티(Equity)란? 포커 승률 개념과 세는 법 | N | `tools/equity`, `glossary/equity` (C7) | `glossary/equity`·`heads-up`, `blog/qq-vs-ak`(현재 5) | `tools/equity`, `learn/pot-odds`, `blog/qq-vs-ak` |
| `/learn/pot-odds` | Learn 14 | 학습 | 팟오즈 | 팟오즈란 · 팟오즈 계산법 · 콜 최소 승률 | 콜할 값어치가 있는지 어떻게 계산하지? | 콜할 값어치가 있을까? 팟오즈 | 팟오즈란? 콜에 필요한 최소 승률 계산법 | N | `tools/pot-odds`, `glossary/pot-odds`, `blog/pot-odds-quick` (C5) | 현재 4(`learn/equity`·`outs`, blog, glossary) | `tools/pot-odds`, `blog/pot-odds-quick`, `learn/outs` |
| `/learn/outs` | Learn 15 | 학습 | 아웃츠 | 아웃츠란 · 아웃츠 세는 법 · 드로우 확률 · 2배 4배 규칙 | 남은 좋은 카드를 어떻게 세고 확률로 바꾸지? | 아직 남은 좋은 카드, 아웃츠 | 아웃츠란? 세는 법과 확률 (×2·×4 규칙) | N | `tools/outs`, `glossary/outs`, `blog/outs-nine` (C6) | 현재 4 | `tools/outs`, `tools/equity`, `blog/outs-nine`, `glossary/draw` |

## 3. Blog 20 (역할: 구체 질문 / editorial. 계약 AF 5개 content type으로 재배치)

역할 열의 **SG**=Search Guide 후보, **D&P**=Data & Probability, **BM**=Beginner Mistakes, **PC**=Poker Concepts/Culture. Hand Story는 현재 0편(신규 4–6편은 후속 WP). 판단 근거는 §B-5. `relatedArticles`가 비어 있는 16편은 "필요한 인바운드"에 `blog↔blog 0`으로 표시.

| path | 역할 | 의도 | 1차 키워드 가설 | 2차 질의 | 사용자 질문 | 현재 title (`registry/blog/i*.ts`) | 제안 title | H1≠? | 카니발 경쟁 | 필요한 인바운드 | 주요 아웃바운드 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/blog/aks-vs-ako` | SG | 정보 | AKs AKo 차이 | AKs 뜻 · AKo 뜻 · 수티드 오프수트 차이 · AK 무늬 차이 | s와 o가 실제로 얼마나 차이 나지? | AKs와 AKo는 무슨 차이일까? | AKs vs AKo 차이 — 수티드가 실제로 얼마나 중요한가 | Y | `hands/aks`·`ako`(`AKs 뜻` 소유), `blog/why-suited-matters`, `glossary/suited` (C14·C15) | 현재 7(최다). blog↔blog 0 → `is-ak-good`, `why-suited-matters` | `hands/aks`·`ako`, `tools/starting-hand`·`equity`, `glossary/suited`·`offsuit` |
| `/blog/next-best-after-aa` | SG | 정보 | AA 다음 좋은 패 | KK QQ 순위 · 프리플랍 상위 핸드 · AA 다음 강한 패 | AA 다음은 뭐가 좋지? | AA 다음으로 좋은 패는? | AA 다음으로 좋은 패는? 시작 핸드 2~4위 | Y | `learn/starting-hand-ranking`, `hands/kk`·`qq` | 현재 2. `hands/aa`·`qq`(현재 없음) | `hands/aa`·`kk`·`qq`, `tools/starting-hand` |
| `/blog/how-often-aa` | D&P | 정보 | AA 확률 | 포켓 에이스 확률 · AA 조합 수 · AA 몇 판에 한 번 | AA는 얼마나 자주 오지? | AA는 얼마나 자주 받을까? | AA 받을 확률 — 포켓 에이스는 몇 판에 한 번? | Y | `hands/aa`(`HAND_ONE_IN_N` 사실 노출) | 현재 2. `glossary/pocket-pair`·`combo` | `hands/aa`, `glossary/combo`, `tools/starting-hand` |
| `/blog/is-ak-good` | SG | 평가 | AK 좋은 패 | AK 순위 · 빅 슬릭 · AK 프리플랍 · AK 강한가 | AK는 얼마나 좋은 패지? | AK는 좋은 패인가? | AK는 좋은 패인가? 순위와 첫 레이즈 자리 | Y | `blog/aks-vs-ako`, `hands/aks`·`ako` (C15) | 현재 1(`learn/starting-hand-ranking`만). `hands/aks`·`ako` 미참조 | `hands/aks`·`ako`, `learn/position`, `tools/starting-hand` |
| `/blog/qq-vs-ak` | D&P / SG | 정보 | QQ AK | QQ vs AK 승률 · 페어 대 오버카드 · QQ AKs 승률 | QQ와 AK 중 누가 유리하지? | QQ와 AK 중 뭐가 강할까? | QQ vs AK 승률 — 페어와 오버카드의 대결 | Y | `hands/qq`, `learn/equity` | 현재 3 | `tools/equity`(본문 `<ToolCTA tool="toolEquity">`), `hands/qq`·`aks`·`ako` |
| `/blog/small-pocket-pairs` | SG | 평가 | 작은 포켓페어 | 22 33 좋은 패 · 로우 포켓페어 순위 · 작은 페어 가치 | 22 같은 작은 페어는 쓸만한가? | 작은 포켓페어는 좋은 패일까? | 작은 포켓페어는 좋은 패일까? 순위와 조합 수 | Y | `hands/22`·`77`·`88`·`99` (C16) | 현재 5 (hands 4 + learn) ✓ | `hands/22`, `glossary/pocket-pair`, `tools/starting-hand` |
| `/blog/why-72o-is-weak` | BM / SG | 정보 | 72o 약한 이유 | 가장 약한 시작 패 · 최악의 패 · 72 오프수트 | 72o가 진짜 최악의 패야? | 72o가 약한 이유 | 72o가 약한 이유 — 정말 최악의 패일까? | Y | `learn/starting-hand-ranking`(본문에 같은 오해 절 있음 `starting-hand-ranking.mdx:31`) | 현재 1 | `tools/starting-hand`, `learn/starting-hand-ranking`, `glossary/offsuit` |
| `/blog/why-suited-matters` | SG | 정보 | 수티드가 좋은 이유 | 같은 무늬 유리한 점 · 수티드 승률 차이 · 플러시 가능성 | 같은 무늬면 얼마나 더 좋아지지? | suited hand가 좋은 이유 `WEAK` 영문 머리어, `수티드` 없음 | 수티드가 좋은 이유 — 같은 무늬가 바꾸는 승률 | Y | `glossary/suited`(`수티드 뜻`), `blog/aks-vs-ako` (C14) | 현재 1 | `glossary/suited`, `blog/aks-vs-ako`, `tools/starting-hand`, 수티드 hands |
| `/blog/flush-vs-straight` | D&P / SG | 정보 | 플러시 스트레이트 | 플러시 스트레이트 뭐가 높나 · 플러시 확률 · 스트레이트 확률 | 둘 중 뭐가 세고 왜? | 플러시와 스트레이트 중 뭐가 강할까? | 플러시 vs 스트레이트 — 뭐가 더 강하고 왜? | Y | `learn/poker-hand-rankings`, `glossary/flush`·`straight`, `blog/full-house-vs-flush` (C2) | 현재 3 | `learn/poker-hand-rankings`, `glossary/flush`·`straight`, `tools/hand-checker` |
| `/blog/full-house-vs-flush` | D&P / SG | 정보 | 풀하우스 플러시 | 풀하우스 플러시 뭐가 높나 · 풀하우스 확률 | 풀하우스가 플러시보다 센 이유는? | 풀하우스와 플러시 중 뭐가 강할까? | 풀하우스 vs 플러시 — 뭐가 더 강하고 왜? | Y | `blog/flush-vs-straight`(구조 동일), `learn/poker-hand-rankings` (C2) | 현재 2. `flush-vs-straight`와 상호 `relatedArticles` 미구현 | `blog/flush-vs-straight`(본문 링크 1 ✓), `glossary/full-house` |
| `/blog/btn-why-wide` | SG / PC | 정보 | 버튼 레인지 넓은 이유 | BTN 오픈 레인지 · 버튼 자리 유리 · 포지션 레인지 차이 | 왜 버튼에서는 더 많은 패를 쓰지? | BTN에서는 왜 더 많은 패를 사용할까? | 버튼(BTN) 오픈 레인지가 넓은 이유 | Y | `learn/position`, `glossary/button` (C11) | 현재 6 | `tools/range`, `learn/position`·`positions-6max`, `glossary/button` |
| `/blog/same-pair-who-wins` | SG (merge 후보) | 정보 | 같은 원페어 누가 이기나 | 원페어 동점 · 키커 비교 · 같은 족보 승자 | 둘 다 원페어면 누가 이겨? | 같은 원페어면 누가 이길까? | 같은 원페어면 누가 이길까? 키커로 가리는 법 | Y | `blog/what-is-kicker`(의도 중복), `glossary/kicker` (C13 CHANGED) | 현재 3 | `glossary/kicker`·`one-pair`, `tools/hand-checker` |
| `/blog/what-is-kicker` | SG (merge 후보) | 정의 | 키커란 | 키커 뜻 · kicker 포커 · 키커 비교 | 키커가 정확히 뭐지? | kicker란? `WEAK` 영문 제목, `키커` 없음; `키커 뜻`은 글로서리 소유 | 키커란? 승부를 가르는 옆 카드, 실제 패로 보기 | Y | `glossary/kicker`(`키커 뜻` 소유), `blog/same-pair-who-wins` (C13) | 현재 4 | `glossary/kicker`, `learn/poker-hand-rankings` |
| `/blog/playing-the-board` | SG | 정보 | 보드로 족보 완성 | 플레잉 더 보드 · 보드만으로 승부 · 스플릿 팟 | 보드 5장이 그대로 족보면 누가 이겨? | 보드만으로 족보가 완성되면? | 보드만으로 족보가 완성되면? 스플릿 팟이 되는 경우 | Y | `glossary/split-pot`·`board` | 현재 4 | `glossary/board`·`split-pot`·`nuts`(고아 해소), `tools/hand-checker` |
| `/blog/a2345-wheel` | SG | 정보 | A2345 스트레이트 | 휠 스트레이트 · A 낮은 스트레이트 · A2345 인정 | A2345도 스트레이트야? | A2345는 스트레이트인가? | A2345는 스트레이트인가? 휠 스트레이트 | N | `glossary/straight` | 현재 2. `hands/a5s` 미참조 | `glossary/straight`, `hands/a5s`, `tools/hand-checker` |
| `/blog/outs-nine` | D&P / SG | 정보 | 아웃츠 9장 | 플러시 드로우 아웃 · 9 아웃 확률 · 플러시 드로우 확률 | 플러시 드로우는 왜 9장이고 확률은? | 아웃츠 9장은 무슨 뜻일까? | 아웃츠 9장 뜻 — 플러시 드로우 완성 확률 | Y | `learn/outs`, `tools/outs`, `glossary/outs` (C6) | 현재 2 | `learn/outs`(본문 링크 1 ✓), `tools/outs`, `glossary/draw`·`flush` |
| `/blog/why-blinds-exist` | PC | 정보 | 블라인드 왜 내나 | 빅 블라인드 이유 · 강제 베팅 이유 · 블라인드 존재 이유 | 왜 강제로 돈을 걸게 하지? | Big Blind는 왜 돈을 먼저 내나? `WEAK` 영문 머리어, `블라인드` 없음 | 빅 블라인드는 왜 먼저 돈을 내나? 블라인드가 있는 이유 | Y | `glossary/blind`·`big-blind` (C17) | 현재 5 | `glossary/blind`·`big-blind`·`small-blind`·`ante`, `learn/holdem-basics` |
| `/blog/why-called-3bet` | PC | 정보 | 왜 3벳이라 부르나 | 3벳 이름 유래 · 베팅 세는 법 · 3벳 어원 | 왜 두 번째 레이즈가 3벳이야? | 왜 3-Bet이라고 부를까? | 왜 3벳(3-Bet)이라고 부를까? 이름의 유래 | N | `learn/three-bet`, `glossary/three-bet` (C1) | 현재 3 | `learn/three-bet`(본문 링크 2 ✓), `glossary/three-bet`·`four-bet` |
| `/blog/why-use-range` | BM / SG | 정보 | 레인지로 보는 이유 | 상대 패 추측 · 레인지 사고 · 상대 패 하나로 찍기 | 상대 패를 하나로 찍으면 왜 틀리지? | Range를 보는 이유 `WEAK` 영문 머리어, `레인지` 없음 | 레인지로 보는 이유 — 상대 패를 하나로 찍으면 틀리는 것 | Y | `learn/poker-range`, `glossary/range` (C4) | 현재 1(`learn/preflop`만). `learn/poker-range`·`glossary/range` 미참조 | `learn/poker-range`(본문 링크 1 ✓), `tools/range` |
| `/blog/pot-odds-quick` | SG | 학습 | 팟오즈 암산 | 팟오즈 빨리 계산 · 벳 크기별 팟오즈 · 팟오즈 3초 | 테이블에서 팟오즈를 빨리 계산하는 법은? | 팟오즈 쉽게 계산하기 | 팟오즈 쉽게 계산하기 — 벳 크기별 암산 숫자 | N | `learn/pot-odds`, `tools/pot-odds` (C5) | 현재 2 | `learn/pot-odds`(본문 링크 1 ✓), `tools/pot-odds` |

## 4. Hands 20 (역할: 시작 핸드 하나. `<표기> 뜻/순위/조합/승률` 소유)

공통: 현재 title 패턴 `같은 무늬의 A와 K · AKs` / `같은 숫자 두 장 (A 페어) · AA`(`registry/hands/e3.ts`) — 표기가 title에 있어 `WEAK` 아님. 제안 패턴 `AKs (같은 무늬 A·K) — 순위·조합 수·승률` (≤ 49자). 본문은 3개 H2 + `<Fact>` 5–14개(계수), 마크다운 링크는 `a5s`→`/hands/aqo` 1건뿐. 인바운드 기본 = `/hands` 허브 + `toolStartingHand`·`toolEquity`(20개 전부) + 이웃 핸드. 1차 질의는 `<표기>` 자체와 `<표기> 뜻`(BK seed는 AKs/AKo만). 계약 AY의 "Relevant Guide / Relevant Story" 슬롯은 현재 `relatedArticles`가 채워진 9개(aks, ako, aa, kk, qq, 99, 88, 77, 22)에만 해당(11개 빈 값).

| path | 표기 | 1차 질의 | 경쟁 path | 주요 아웃바운드(추가 필요) |
|---|---|---|---|---|
| `/hands/aks` | AKs | AKs 뜻 · AKs 순위 | `blog/aks-vs-ako`, `blog/is-ak-good` | `blog/aks-vs-ako` ✓, `blog/is-ak-good`(없음) |
| `/hands/ako` | AKo | AKo 뜻 · AKo 순위 | 위와 동일 | 동일 |
| `/hands/aa` | AA | AA 순위 · AA 확률(양보→blog) | `blog/how-often-aa`, `next-best-after-aa` | `how-often-aa` ✓, `next-best-after-aa`(없음) |
| `/hands/kk` | KK | KK 순위 | `blog/next-best-after-aa` | ✓ |
| `/hands/qq` | QQ | QQ 순위 · QQ AK(양보→blog) | `blog/qq-vs-ak` | ✓ |
| `/hands/jj` | JJ | JJ 순위 | — | `relatedArticles` 빈 값 |
| `/hands/tt` | TT | TT 순위 | — | 빈 값 |
| `/hands/99` `/hands/88` `/hands/77` `/hands/22` | 99·88·77·22 | 포켓 NN 순위 | `blog/small-pocket-pairs` (C16) | ✓ 4개 모두 참조 |
| `/hands/aqs` `/hands/aqo` | AQs·AQo | AQs/AQo 순위 · 뜻 | `blog/why-suited-matters` | 빈 값 → `why-suited-matters` 추가 |
| `/hands/ajs` | AJs | AJs 순위 | — | 빈 값 |
| `/hands/kqs` `/hands/kjs` `/hands/qjs` | KQs·KJs·QJs | 브로드웨이 수티드 순위 | — | 빈 값 |
| `/hands/jts` `/hands/t9s` | JTs·T9s | 수티드 커넥터 순위 · 커넥터 뜻 | `learn/starting-hands`(커넥터 설명) | 빈 값 → `learn/starting-hands` 본문 링크 |
| `/hands/a5s` | A5s | A5s 순위 · 휠 에이스 | `blog/a2345-wheel` | 빈 값 → `a2345-wheel` 추가(반대 방향도 없음) |

## 5. Glossary 58 (역할: 뜻. `<한글 표기> 뜻` 소유)

**계통 WEAK(39건)**: title에 한글 검색 표기(첫 alias)가 없음 — `aliases`에만 존재(덤프 계수 19/58만 포함). 사유는 전 행 동일하므로 표에서는 `W`로만 표시. 제안 패턴: `<한글 표기> (<원어>) 뜻 — <쉬운 한 줄>` 예: `포지션 (Position) 뜻 — 내 차례가 오는 자리`. 인바운드 열은 레지스트리 관계 인바운드 실측(0 = 고아). 본문 마크다운 링크는 `hand`(2)·`three-bet`(1)·`four-bet`(1) 3파일뿐, `<ToolCTA>` 0.

| path | 한글 표기 | 원어 | 1차 질의 | W | 인바운드 | 경쟁 path | 주요 아웃바운드(더 배우기) |
|---|---|---|---|---|---|---|---|
| `/glossary/position` | 포지션 | Position | 포지션 뜻 | –(alias `자리`만 title에 있음, `포지션` 없음) | 6 | `learn/position` | `learn/position` |
| `/glossary/open-raise` | 오픈레이즈 | Open Raise | 오픈레이즈 뜻 (BK) | W | 12 | `learn/preflop` | `learn/preflop`, `tools/range` |
| `/glossary/action` | 액션 | Action | 액션 뜻 | – | 1 | `learn/poker-actions` | `learn/poker-actions` |
| `/glossary/all-in` | 올인 | All-in | 올인 뜻 | W | 1 | — | `learn/poker-actions` |
| `/glossary/ante` | 앤티 | Ante | 앤티 뜻 | W | 1 | `glossary/blind` | `learn/holdem-basics` |
| `/glossary/blind` | 블라인드 | Blind | 블라인드 뜻 | W | 5 | `big-blind`, `small-blind`, `blog/why-blinds-exist` (C17) | `blog/why-blinds-exist` |
| `/glossary/big-blind` | 빅 블라인드 | Big Blind | 빅 블라인드 뜻 · BB 뜻 | – | 9 | `glossary/blind` | `learn/positions-6max` |
| `/glossary/small-blind` | 스몰 블라인드 | Small Blind | 스몰 블라인드 뜻 · SB 뜻 | – | 4 | `glossary/blind` | `learn/positions-6max` |
| `/glossary/button` | 버튼 | Button | 버튼 BTN 뜻 | – | 8 | `blog/btn-why-wide` | `learn/positions-6max` |
| `/glossary/cutoff` | 컷오프 | Cutoff | 컷오프 CO 뜻 | – | 3 | — | `learn/positions-6max` |
| `/glossary/hijack` | 하이잭 | Hijack | 하이잭 HJ 뜻 | – | 3 | — | `learn/positions-6max` |
| `/glossary/utg` | UTG | UTG | UTG 뜻 · 언더더건 | W | 7 | — | `learn/positions-6max` |
| `/glossary/stack` | 스택 | Stack | 스택 뜻 | – | 2 | — | `learn/holdem-basics` |
| `/glossary/pot` | 팟 | Pot | 팟 뜻 · 팟사이즈 | W | 4 | — | `tools/pot-odds` |
| `/glossary/check` | 체크 | Check | 체크 뜻 · (체크레이즈 뜻 — 소유자 없음, §B-6) | W | 2 | — | `learn/poker-actions` |
| `/glossary/call` | 콜 | Call | 콜 뜻 | W | 3 | — | `learn/poker-actions`, `tools/pot-odds` |
| `/glossary/bet` | 베팅 | Bet | 베팅 뜻 · 벳 뜻 | W | 9 | — | `learn/poker-actions` |
| `/glossary/raise` | 레이즈 | Raise | 레이즈 뜻 | W | 3 | `glossary/open-raise` | `learn/poker-actions` |
| `/glossary/fold` | 폴드 | Fold | 폴드 뜻 | W | 1 | — | `learn/poker-actions` |
| `/glossary/limp` | 림프 | Limp | 림프 뜻 | W | 1 | — | `learn/preflop` |
| `/glossary/three-bet` | 3벳 | 3-Bet | 3벳 뜻 · 3bet 뜻 · 쓰리벳 뜻 (BK) | W | 3 | `learn/three-bet`, `blog/why-called-3bet` (C1) | `learn/three-bet`(본문 링크 ✓) |
| `/glossary/four-bet` | 4벳 | 4-Bet | 4벳 뜻 | W | 2 | — | `learn/three-bet`(✓) |
| `/glossary/c-bet` | 씨벳 | C-Bet | cbet 뜻 (BK) · 씨벳 뜻 | W | **0 고아** | — | `learn/flop-turn-river` |
| `/glossary/bluff` | 블러프 | Bluff | 블러프 뜻 | W | **0 고아** | — | `learn/poker-actions` |
| `/glossary/heads-up` | 헤즈업 | Heads-Up | 헤즈업 뜻 | W | 1 | — | `learn/equity` |
| `/glossary/showdown` | 쇼다운 | Showdown | 쇼다운 뜻 | W | 2 | — | `learn/holdem-basics` |
| `/glossary/vpip` | VPIP | VPIP | VPIP 뜻 | W | 1 | — | `learn/preflop` (사이트가 계산하지 않음 명시) |
| `/glossary/pfr` | PFR | PFR | PFR 뜻 | W | 1 | — | `learn/preflop` |
| `/glossary/range` | 레인지 | Range | 레인지 뜻 · 핸드레인지 뜻 | W | 4 | `learn/poker-range`, `tools/range` (C4) | `learn/poker-range`, `tools/range` |
| `/glossary/suited` | 수티드 | Suited | 수티드 뜻 · suited 뜻 (BK) | – | 19 | `blog/why-suited-matters` (C14) | `learn/starting-hands`, `blog/why-suited-matters` |
| `/glossary/offsuit` | 오프수트 | Offsuit | 오프수트 뜻 · offsuit 뜻 (BK) | – | 11 | — | `learn/starting-hands` |
| `/glossary/pocket-pair` | 포켓페어 | Pocket Pair | 포켓페어 뜻 · (포켓페어 확률 — 소유자 없음) | – | 15 | `blog/small-pocket-pairs` | `learn/starting-hands` |
| `/glossary/combo` | 콤보 | Combo | 콤보 뜻 · 조합 수 | – | 27 | — | `learn/hand-matrix` |
| `/glossary/preflop` | 프리플랍 | Preflop | 프리플랍 뜻 | W | 6 | `learn/preflop` (C12) | `learn/preflop` |
| `/glossary/hand` | 핸드 | Hand | 핸드 뜻 | – | 1 | — | `learn/starting-hands`(본문 링크 2 ✓) |
| `/glossary/board` | 보드 | Board | 보드 뜻 | W | 4 | `glossary/community-cards` (C18) | `learn/flop-turn-river` |
| `/glossary/community-cards` | 커뮤니티 카드 | Community Cards | 커뮤니티 카드 뜻 · 공용 카드 | W | 2 | `glossary/board` (C18) | `glossary/board` |
| `/glossary/flop` | 플랍 | Flop | 플랍 뜻 | W | 4 | `learn/flop-turn-river` | `learn/flop-turn-river` |
| `/glossary/turn` | 턴 | Turn | 턴 뜻 | W | 3 | 동일 | 동일 |
| `/glossary/river` | 리버 | River | 리버 뜻 | W | 2 | 동일 | 동일 |
| `/glossary/hand-ranking` | 족보 | Hand Ranking | 족보 뜻 · 핸드 랭킹 뜻 | – | 16 | `learn/poker-hand-rankings` (C8) | `learn/poker-hand-rankings` |
| `/glossary/high-card` | 하이카드 | High Card | 하이카드 뜻 | W | 1 | — | `learn/poker-hand-rankings` |
| `/glossary/one-pair` | 원페어 | One Pair | 원페어 뜻 | – | 1 | `blog/same-pair-who-wins` | `learn/poker-hand-rankings` |
| `/glossary/two-pair` | 투페어 | Two Pair | 투페어 뜻 | W | 1 | — | 동일 |
| `/glossary/three-of-a-kind` | 트리플 | Three of a Kind | 트리플 뜻 · 셋 뜻 | W | 1 | — | 동일 |
| `/glossary/straight` | 스트레이트 | Straight | 스트레이트 뜻 · (스트레이트 확률 — 소유자 없음) | W | 4 | `blog/flush-vs-straight`, `a2345-wheel` | `learn/poker-hand-rankings`, `blog/a2345-wheel` |
| `/glossary/flush` | 플러시 | Flush | 플러시 뜻 · (플러시 확률 — 소유자 없음) | W | 5 | `blog/flush-vs-straight` | `learn/poker-hand-rankings`, `blog/outs-nine` |
| `/glossary/full-house` | 풀하우스 | Full House | 풀하우스 뜻 | W | 5 | `blog/full-house-vs-flush` | `learn/poker-hand-rankings` |
| `/glossary/four-of-a-kind` | 포카드 | Four of a Kind | 포카드 뜻 | W | 1 | — | 동일 |
| `/glossary/straight-flush` | 스트레이트 플러시 | Straight Flush | 스트레이트 플러시 뜻 · 로열 플러시 | W | 1 | — | 동일 |
| `/glossary/kicker` | 키커 | Kicker | 키커 뜻 (BK) | – | 5 | `blog/what-is-kicker`, `same-pair-who-wins` (C13 CHANGED) | `blog/what-is-kicker`(또는 병합본) |
| `/glossary/split-pot` | 스플릿 팟 | Split Pot | 스플릿 팟 뜻 · 찹 뜻 | W | 7 | `blog/playing-the-board` | `blog/playing-the-board` |
| `/glossary/hand-matrix` | 핸드 매트릭스 | Hand Matrix | 핸드 매트릭스 뜻 · 레인지 차트 뜻 | – (단, title `13×13 표`가 C3 경쟁 유발) | 2 | `learn/hand-matrix`, `tools/range` (C3) | `learn/hand-matrix`, `tools/range` |
| `/glossary/draw` | 드로우 | Draw | 드로우 뜻 | W | 2 | — | `learn/outs`, `tools/outs` |
| `/glossary/outs` | 아웃츠 | Outs | 아웃츠 뜻 · 아웃 뜻 | – | 4 | `learn/outs` (C6) | `learn/outs`, `tools/outs` |
| `/glossary/equity` | 에퀴티 | Equity | 에퀴티 뜻 · 승률 뜻 | – (title `내 승률 (Equity)`) | 6 | `learn/equity`, `tools/equity` (C7) | `learn/equity`, `tools/equity` |
| `/glossary/pot-odds` | 팟오즈 | Pot Odds | 팟오즈 뜻 | W | 7 | `learn/pot-odds`, `tools/pot-odds` (C5) | `learn/pot-odds`, `tools/pot-odds` |
| `/glossary/nuts` | 넛츠 | Nuts | 넛츠 뜻 · 넛 뜻 | W | **0 고아** | — | `learn/poker-hand-rankings`, `blog/playing-the-board` |

## 6. `WEAK` 집계와 우선순위

| 구간 | WEAK 수 | 페이지 | 공통 사유 |
|---|---|---|---|
| 정적 | 8 | `/blog`, `/hands`, `/about`, `/tools/equity`, `/tools/pot-odds`, `/tools/outs`, `/tools/starting-hand`, `/tools/hand-checker` | 계산기 질의 형태 미포함 · 허브 역할어 부재 · 표기 불일치 |
| learn | 4 | `holdem-basics`, `poker-hand-rankings`, `starting-hands`, `positions-6max` | 머리어(하는법/족보/시작 핸드/포지션) 부재 |
| blog | 4 | `why-suited-matters`, `why-use-range`, `what-is-kicker`, `why-blinds-exist` | 영문 머리어 |
| hands | 0 | — | 표기가 title에 있음 |
| glossary | 39 | §5의 `W` 행 | 한글 검색 표기가 aliases에만 있음 |
| **합계** | **55 / 130** | | 실질 수정 단위 = 개별 16 + 글로서리 패턴 1 |

우선순위(영향 × 비용): ① 글로서리 title 패턴 전환(39페이지, 레지스트리 `title` 필드 1종) ② learn 4 + tool 4 title(8줄) ③ 블로그 영문 제목 4 ④ `/hands`·`/about`·`/blog` 허브 title ⑤ 본문 contextual link(BP) — 현재 learn 1/15, blog 6/20, glossary 3/58, hands 1/20 파일만 본문 링크 보유.

## 7. 제안 title 길이 검증

이 문서의 "제안 title" 셀 전부를 스크립트로 추출해 길이(코드포인트)를 쟀다. 결과는 문서 말미 아래 "검증 로그" 한 줄로 기록한다(` | 3BetTilt` 11자 포함 60자 기준 = 페이지 부분 49자).

검증 로그: 제안 title 52개(정적 17 + learn 15 + blog 20) 코드포인트 길이 측정 — 최대 41자, 49자 초과 0개 (2026-09-09, node 스크립트).

## 8. WP-S3-16 최종 상태 (2026-09-12, 빌드된 HTML 기준)

이 절이 §0–§7의 "제안"에 대한 **최종 판정**이다. 근거는 `docs/reports/stage3/WP_S3_16_SEO_AUDIT.md`(빌드 감사)와 `.data/tools/seo-audit.mjs` 출력.

- indexable 페이지 **141** (정적 17 + learn 15 + blog 25 + glossary 64 + hands 20). `/ko/search`는 noindex·sitemap 제외. `<title>` 141개 전부 고유, 최대 58자(60자 초과 0), meta description 141개 전부 고유.
- title 접미사는 ` · 3BetTilt`(`formatTitle`), §머리말의 ` | 3BetTilt` 가정은 폐기. 길이 예산은 페이지 부분 ≤ 49자 → 실측 최대 47자.
- **정적 17**: §1 제안 title 중 툴 6·`/hands`·`/about`은 반영됨(`포커 승률 계산기 (에퀴티) — 핸드 vs 핸드`, `팟 오즈 계산기 — 콜에 필요한 승률 바로 계산`, `아웃츠 계산기 — 드로우 완성 확률과 ×2 · ×4 규칙`, `13×13 핸드레인지 표 — 포지션별 오픈 레인지 (6-max · 100BB)`, `시작 핸드 순위표 — 169개 패를 승률순으로 (시작 핸드 탐색기)`, `포커 족보 확인기 (핸드 체커) — 내 패 족보 판정`, `홀덤 시작 핸드 목록 — 패별 순위·조합 수·승률`). `/`(`무료 홀덤 학습`)·`/learn`(`홀덤 처음 배우기`)·`/blog`(`포커 이야기와 검색 가이드`)·`/glossary`(`포커 용어 사전`)·`/tools`(`무료 포커 도구`)·`/practice`(`홀덤 퀴즈`)·퀴즈 3은 짧은 형태 유지(허브 title은 페이지 컴포넌트 소유). `팟 오즈`(tool 라우트 라벨) vs `팟오즈`(learn·blog) 표기 불일치는 남음 — `routes.ts` 라벨 소관.
- **Learn 15**: title = H1(레코드에 `seoTitle` 없음). §2의 WEAK 4편(`holdem-basics`·`poker-hand-rankings`·`starting-hands`·`positions-6max`)은 WP-10이 H1을 유지해 **미반영**. 카니발라이제이션 근접 쌍은 없고(§8 카니발 맵 참조) 상호 링크로 소유를 지지한다. `flop-turn-river`·`poker-actions`·`position`·`starting-hands` 본문에 `<Term>` 4건 추가(c-bet·bluff·ip-oop·connector/broadway).
- **Blog 25** (guides 19 + stories 6): 전편 `seoTitle` 존재·H1과 다름·한글 머리어(§3의 영문 머리제목 4편 해소). `same-pair-who-wins`는 `what-is-kicker`로 병합됨(§1.10 판정 이행, D-S3-03 리다이렉트 없음).
- **Hands 20**: title 패턴 `같은 무늬의 A와 K · AKs` 유지(§4 제안 패턴 미채택, 표기가 title에 있어 WEAK 아님). `relatedArticles` 빈 값 11편은 `HandOnward`가 그래프에서 역방향(`blog.relatedHands`·스토리 홀카드)으로 도출해 화면·링크에서 해소. kjs·jts·qjs·t9s에 `term-broadway`·`term-connector` `<Term>` 추가.
- **Glossary 64** (58 + 신규 `set-vs-trips`·`ip-oop`·`gutshot`·`open-ended`·`broadway`·`connector`): title 패턴 `<쉬운 설명> (<원어>)` 유지 — §0-2/§5의 "한글 검색 표기를 title로" 전환은 WP-12 배치가 **채택하지 않음**(WEAK 39 → 신규 포함 재계수 시 동일 패턴). 한글 표기는 헤더의 names 줄(aliases)과 `DefinedTerm.alternateName`으로 노출. 재검토는 Search Console 데이터 이후 owner 결정 사항으로 이관.
- 인바운드 0 페이지(§0-8) **0**, contextual inbound < 2 페이지 **0**(홈 제외). 분포는 감사 §3.

## 9. 미이행 목록 (owner 결정 필요, WP-16 경계 밖)

1. learn 4편·glossary 39편 title 어휘(§6 우선순위 ①②) — `title` = H1 필드, 콘텐츠 owner.
2. `routes.ts` 라벨: `핸드레인지`(nav → tool) 앵커 충돌, `팟 오즈`/`팟오즈` 표기.
3. `체크레이즈 뜻`·`포켓페어 확률`·`플러시/스트레이트 확률` 소유 페이지 없음(§0-3) — 신규 콘텐츠.
