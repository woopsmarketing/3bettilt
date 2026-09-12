# 다음 단계 블로그 주제 20선

read-only 조사 산출물. `apps/fishtilt` 아래 어떤 파일도 수정하지 않았다.
근거는 (a) 레지스트리의 빈자리, (b) 기존 산문이 언급하지만 어떤 페이지도 소유하지 않는 개념,
(c) 내부 링크 그래프의 고아·약한 노드 — 이 셋뿐이다.

**검색량·순위·CPC·GTO 수치·승률은 이 문서에 하나도 없다.** 이 세션에 키워드 툴이 없기 때문이다.
각 주제가 인용해야 할 숫자는 전부 **해당 수치는 기존 `<Fact>`에서 가져온다** — `src/content/facts.ts`의
`FACT_NAMES` 20종(`facts.ts:131-152`) 안에서만 쓴다. 새 `<Fact>`가 필요한 주제는 제외했다.

---

## 근거 요약

### 현재 콘텐츠 분포 (레지스트리에서 직접 센 값)

`src/content/registry/{learn,blog,glossary,hands}/*.ts`를 파싱해 센 결과 — 총 **113개, 전부 `PUBLISHED`**.

| kind | 개수 | INTRO | BASIC | INTERMEDIATE |
|---|---|---|---|---|
| learn | 15 | 5 | 9 | 1 |
| blog | 20 | 5 | 15 | 0 |
| glossary | 58 | 40 | 18 | 0 |
| hands | 20 | 20 | 0 | 0 |
| **합계** | **113** | **70** | **42** | **1** |

**레벨 편중이 심하다.** 전체 113개 중 `INTERMEDIATE`는 `learn:three-bet` **단 하나**다
(`registry/learn/h2.ts` 계열). blog에는 `INTERMEDIATE`가 0편이다.

### blog `topic` 분포와 잡탕 묶음

| topic | 현재 편수 | 상태 |
|---|---|---|
| starting-hands | 7 | 그룹 형성 |
| hand-strength | 6 | 그룹 형성 |
| odds | 2 | 그룹 형성 |
| equity | 1 | **잡탕 묶음에 갇힘** |
| position | 1 | **잡탕 묶음에 갇힘** |
| rules | 1 | **잡탕 묶음에 갇힘** |
| betting | 1 | **잡탕 묶음에 갇힘** |
| range | 1 | **잡탕 묶음에 갇힘** |

`src/app/blog/page.tsx:114`의 `MIN_GROUP_ARTICLES = 2` 때문에, 1편짜리 5개 토픽이
`src/app/blog/page.tsx:117`의 `SINGLETON_GROUP_HEADING = '한 편씩 있는 주제'` 아래로 모두 밀려난다.
`/blog` 허브의 20편 중 5편이 주제 이름을 잃고 있다는 뜻이다.
**5개 토픽에 각각 1편 이상만 붙이면 이 묶음 자체가 사라진다** (`groupArticles()` — `page.tsx:126-163`).

아래 20개 주제는 이 5개 토픽에 각각 **최소 1편**을 배정한다. 반영 후 예상 분포:
starting-hands 10 · betting 7 · hand-strength 7 · rules 4 · odds 4 · position 3 · range 3 · equity 2
→ **모든 토픽이 2편 이상, 잡탕 묶음 소멸.**

### 커버되지 않은 개념 — 산문 grep 0건인데 이미 필요한 자리가 있는 것

`apps/fishtilt/content/**/*.mdx` 전체 grep 결과. "필요한 자리"는 그 개념을 이름만 대고 지나가는 실제 줄이다.

| 개념 | grep | 이미 이름만 대고 지나가는 자리 |
|---|---|---|
| 커넥터 / 갭 | 소유 페이지 0 | `content/learn/starting-hands.mdx:42` (커넥터 명명), `:44` (갭 하나짜리 조합), `content/learn/starting-hand-ranking.mdx:17` (수티드 커넥터) |
| 브로드웨이 | glossary 항목 **없음** | `content/hands/kjs.mdx:8`·`content/hands/jts.mdx:8`에서 **각자 따로 정의**, `content/hands/qjs.mdx:15`·`content/hands/t9s.mdx:1`에서 정의 없이 사용 |
| 오픈엔디드 / 오픈 엔디드 | **0건** | `content/learn/outs.mdx:21`은 스트레이트 드로우를 예고하고 `:39`는 거트샷(4아웃)만 다룬다. 8아웃 케이스는 사이트 어디에도 없다 |
| 세미 블러프 | **1건** (정의 아님) | `content/glossary/bluff.mdx:15` — "세미 블러프라고 따로 부르기도 합니다"로 끝 |
| 체크 레이즈 | **1건** (정의 아님) | `content/glossary/check.mdx:17` — "체크 레이즈라고 따로 부르기도 합니다"로 끝 |
| 인 포지션 / 아웃 오브 포지션 | **0건** | `content/blog/btn-why-wide.mdx:1`, `content/learn/positions-6max.mdx:22`가 "가장 마지막에 행동" 개념을 쓰지만 용어는 없다 |
| 타이트 / 루즈 | **0건** | `content/glossary/vpip.mdx:13`, `pfr` 두 항목이 "무엇을 세는 숫자"까지만 설명하고 멈춘다 |
| 47장 / 46장 | **1건** | `content/blog/outs-nine.mdx:27`에서 설명 없이 등장. `content/learn/outs.mdx:59`도 같은 규약을 전제만 한다 |
| 포스트플랍 | **1건** | `content/glossary/c-bet.mdx:17` — "포스트플랍 전략의 영역"이라고만 말하고 그 단어를 정의하지 않는다 |
| 멀티웨이 · 블로커 · 틸트 · 피시 · 뱅크롤 · 백도어 · 임플라이드 | 0건 | **필요한 자리도 없다** → 아래 "제외한 후보" 참조 |

### 본문이 직접 후속편을 요구하는 자리

- `content/blog/outs-nine.mdx:27` — "아웃이 9장이 아니라 다른 개수라면, 당연히 이 글의 숫자가 아니라 그 개수에 맞는 새 계산이 필요합니다." → **후속편 요구.** 단 4아웃(거트샷)은 `content/learn/outs.mdx:39`가 이미 소유하므로, 남은 자리는 **8아웃(오픈엔디드)** 하나뿐이다.
- `content/learn/starting-hands.mdx:44` — 갭 개념을 "다음 레슨에서 숫자로 다시 확인합니다"로 넘기는데, 다음 레슨(`starting-hand-ranking`)은 갭을 다시 다루지 않는다.
- `content/glossary/three-bet.mdx:17` — "3벳에 어떤 패로 대응하는 것이 좋은지 보여주는 표는 FishTilt가 아직 다루지 않는 부분이라, 준비 중입니다." → **레인지 표는 금지.** 다만 팟 크기 변화는 `POT_ODDS_REQUIRED_EQUITY`로 사실만 말할 수 있다.

### 고아·약한 노드 (인바운드 링크 수, 레지스트리 5개 관계 필드 기준)

**인바운드 0 — 고아 6건 (전부 glossary)**

| id | topic / level | 어디서 열리나 |
|---|---|---|
| `term-action` | betting / INTRO | 주제 #4 |
| `term-all-in` | betting / BASIC | 주제 #3 |
| `term-ante` | rules / INTRO | 주제 #1 |
| `term-c-bet` | betting / BASIC | 주제 #5 |
| `term-bluff` | betting / BASIC | 주제 #7 |
| `term-nuts` | hand-strength / INTRO | 주제 #10 |

**인바운드 1 — 약한 노드 16건**

- 닫힌 2-사이클(서로만 참조, 외부 인바운드 0): `term-vpip` ↔ `term-pfr`, `term-one-pair` ↔ `term-two-pair`.
  전자는 **주제 #8**이 연다. 후자는 `learn/poker-hand-rankings`가 본문에서 두 족보를 다루므로 새 글 없이 레지스트리 관계 추가로 해결 가능 → 아래 "레지스트리 정리 제안" 참조.
- 나머지: `term-fold`(1) `term-limp`(1) `term-heads-up`(1) `term-hand`(1) `term-high-card`(1) `term-three-of-a-kind`(1) `term-four-of-a-kind`(1) `term-straight-flush`(1),
  blog 4편 `blog-is-ak-good` `blog-why-72o-is-weak` `blog-why-suited-matters` `blog-why-use-range`(각 1).

**구조적 공백**

- **58개 glossary 중 `relatedArticles`를 가진 것은 17개뿐**이고, `relatedHands`를 가진 것은 `term-suited`·`term-offsuit` **2개뿐**이다. 용어 → 읽을거리로 나가는 길이 거의 없다.
- **`hands` 20개 중 14개가 `relatedArticles: []`** — `hand-jj` `hand-tt` `hand-99` `hand-88` `hand-77` `hand-aqs` `hand-aqo` `hand-ajs` `hand-kqs` `hand-kjs` `hand-qjs` `hand-jts` `hand-t9s` `hand-a5s`. 개별 핸드 페이지에서 나갈 곳이 없다.
- **`/practice/*` 개별 퀴즈 3개는 113개 레코드 전체에서 인바운드 0.** 레지스트리 전체 grep 결과 `practiceRange` / `practiceHandRanking` / `practiceStartingHand` 라우트 id는 **한 번도 쓰이지 않았고**, `practice`(허브)만 3회 쓰였다 (`registry/learn/h1.ts:63`, `:111`, `registry/learn/published.ts:27`). 세 라우트는 `src/lib/routes.ts`에 `available: true`로 실재한다.
- 툴 인바운드: `range` 51 · `toolStartingHand` 35 · `toolEquity` 24 · `toolOuts` 13 · `toolHandChecker` 8 · `toolPotOdds` 6 · `practice` 3. **`toolPotOdds`와 `toolHandChecker`가 눈에 띄게 약하다.**

### 숫자 인용 제약 (주제 설계에 직접 영향)

`src/content/facts.ts:39-43`에 따르면 `CLASS_VS_CLASS_EQUITY`는 **오프라인에서 미리 계산해 얼려 둔 매치업만** 해석되고
나머지는 전부 throw한다. 사이트 전체에서 실제로 쓰인 매치업은 `QQ|AKs`, `QQ|AKo` 두 개뿐이다
(`content/blog/qq-vs-ak.mdx`). 따라서 **새 클래스 대 클래스 승률 비교 주제는 전부 제외했다.**
아래 20개 주제가 쓰는 숫자는 `HAND_EQUITY_VS_RANDOM` / `HAND_RANK` / `HAND_TOP_SHARE` / `HAND_COMBOS` /
`HAND_ONE_IN_N` / `CATEGORY_RANK` / `CATEGORY_FREQUENCY` / `OUTS_PROB` / `POT_ODDS_REQUIRED_EQUITY` /
`RFI_PERCENT` / `RFI_COMBOS` / `RFI_POSITIONS_WITH` / `COMBO_COUNT` 범위 안에 있다.
`types.ts`에 `date`/`image` 필드는 없으므로 발행일·대표 이미지는 계획에 포함하지 않는다.

---

## 주제 20개

`topic`은 `types.ts:57-66`의 `CONTENT_TOPICS` 8종, `level`은 `types.ts:44`의 `CONTENT_LEVELS` 3종 안에서만 골랐다.
"연결될 기존 레코드"의 굵은 항목은 **그 레코드의 인바운드 0 또는 1을 해소하는 것**이다.

| # | 제안 제목(한국어) | topic | level | 왜 이 주제인가 (코드 근거 file:line) | 연결될 기존 레코드 | 카니발라이제이션 회피 근거 |
|---|---|---|---|---|---|---|
| 1 | 딜러 버튼은 왜 매 판 자리를 옮길까? | rules | INTRO | `rules`는 blog 1편뿐이라 잡탕 묶음행(`app/blog/page.tsx:114`). `term-ante`는 인바운드 0이고 `content/glossary/blind.mdx:11-13`이 앤티를 블라인드와 구분만 해 둔 채 끝난다. 버튼이 왜 도는지는 113개 어디에도 없다 | **`term-ante`(0)** · `term-button`(8) · `term-blind`(5) · `term-small-blind`(4) · `holdem-basics` · `positions-6max` · `blog-why-blinds-exist` | C17이 "블라인드를 왜 내나"를 `blog/why-blinds-exist`에, "블라인드 뜻"을 `glossary/blind`에 이미 배정했다. 이 글의 의도는 **자리가 왜 회전하는가**로, 셋 다와 다르다. C11의 "여섯 자리 이름"은 `learn/positions-6max` 소유 |
| 2 | 쇼다운에서는 누가 먼저 카드를 열까? | rules | INTRO | `term-showdown` 인바운드 2. `content/learn/holdem-basics.mdx:31`은 "카드를 모두 펼쳐 보이고 비교합니다"까지만, `content/learn/flop-turn-river.mdx:71`은 "두 명 이상일 때"까지만 말한다. **공개 순서는 grep 0건** | `term-showdown`(2) · **`term-fold`(1)** · `term-hand-ranking`(16) · `term-split-pot`(7) · `holdem-basics` · `flop-turn-river` · `toolHandChecker`(인바운드 8, 약함) | C8은 "족보 순서"를 `learn/poker-hand-rankings`에 배정했다. 이 글은 족보를 비교하지 않고 **공개 절차**만 다룬다. `glossary/showdown`은 "쇼다운 뜻"(용어 조회) 유지 |
| 3 | 올인이 나오면 그 판은 어떻게 끝날까? | rules | INTRO | **`term-all-in` 인바운드 0.** `content/glossary/pot.mdx:17`이 사이드 팟을 한 줄로만 언급하고, `content/learn/pot-odds.mdx:60`이 "내 스택이 모자라서 베팅만큼 콜을 못 하면"을 FAQ 한 칸으로만 답한다. 정면으로 다루는 페이지가 없다 | **`term-all-in`(0)** · `term-stack`(2) · `term-pot`(4) · `term-split-pot`(7) · `poker-actions` · `pot-odds` · `toolPotOdds`(6, 약함) | `glossary/all-in`은 "올인 뜻"(상태 정의), `glossary/pot`은 "팟 뜻". 이 글의 의도는 **올인 이후 판이 어떻게 정산되는가**(절차). C5의 팟오즈 계산은 건드리지 않는다 |
| 4 | 체크와 콜은 무엇이 다를까? | betting | INTRO | **`betting`은 blog 1편뿐이다.** **`term-action` 인바운드 0.** `term-check`(2)·`term-call`(3)도 약하다. `content/learn/poker-actions.mdx`는 다섯 행동을 **나열**하지만 이 둘의 혼동을 정면으로 풀지 않는다 | **`term-action`(0)** · `term-check`(2) · `term-call`(3) · `term-bet`(9) · `poker-actions` · `toolPotOdds`(6, 약함) | `learn/poker-actions`가 "다섯 가지 행동" 상위 질의를 소유한다(order 9). 이 글은 그 다섯 중 **두 개의 짝비교**만 하고 나머지 셋은 언급만 한다. 각 용어의 "뜻" 질의는 glossary 3개 유지 |
| 5 | 프리플랍과 포스트플랍은 무엇이 다를까? | betting | INTRO | **`term-c-bet` 인바운드 0.** `content/glossary/c-bet.mdx:17`이 "포스트플랍 전략의 영역"이라고 쓰는데 **`포스트플랍`은 사이트 전체 grep 1건**(바로 그 줄)이고 정의가 없다. `term-preflop`은 있는데 짝이 없다 | **`term-c-bet`(0)** · `term-preflop`(6) · `term-flop`(4) · `term-board`(4) · `preflop` · `flop-turn-river` · `poker-range` | C12가 "프리플랍"을 `learn/preflop`에 배정했다. 이 글은 프리플랍을 재설명하지 않고 **경계선 이후에 달라지는 것**(공용 카드·정보·베팅 시작점)만 다룬다 |
| 6 | 체크 레이즈란 무엇일까? | betting | BASIC | `content/glossary/check.mdx:17`이 "체크 레이즈라고 따로 부르기도 합니다"로 이름만 대고 끝난다. **`체크레이즈` 붙여쓰기 grep 0건, 띄어쓰기 1건.** 소유 페이지가 없다 | `term-check`(2) · `term-raise`(3) · **`term-action`(0)** · `term-bet`(9) · `poker-actions` · `three-bet` | 어떤 기존 레코드도 이 용어를 제목·description에 갖고 있지 않다. `glossary/check`는 "체크 뜻", `glossary/raise`는 "레이즈 뜻"·`raise.mdx:7-9`의 최소 인상액을 소유 |
| 7 | 세미 블러프란 무엇일까? | betting | BASIC | **`term-bluff` 인바운드 0.** `content/glossary/bluff.mdx:15`가 "완전한 블러프와 구분해 세미 블러프라고 따로 부르기도 합니다"로 끝낸다. `term-draw`(2)·`term-outs`(4)와 이어 붙일 자리인데 아무도 잇지 않았다 | **`term-bluff`(0)** · `term-draw`(2) · `term-outs`(4) · `term-bet`(9) · `outs` · `blog-outs-nine` · `toolOuts` | `glossary/bluff`가 "블러프 뜻"을 소유한다. 이 글은 **세미 블러프**라는 별도 용어만 다루고 블러프 일반론은 첫 줄에서 링크로 넘긴다. C6의 아웃 세는 법은 `learn/outs` 소유 |
| 8 | 타이트하다 · 루즈하다는 무슨 뜻일까? | betting | BASIC | **`term-vpip` ↔ `term-pfr`는 서로만 참조하는 닫힌 2-사이클이다.** 외부 인바운드 0. **`타이트`·`루즈` 산문 grep 각 0건.** 두 통계를 자연스럽게 함께 부르는 유일한 진입점 | **`term-vpip`(1, 사이클)** · **`term-pfr`(1, 사이클)** · `term-range`(4) · `term-open-raise`(12) · `preflop` · `poker-range` · `blog-why-use-range`(1, 약함) | `glossary/vpip`·`glossary/pfr`가 각 약어의 "뜻" 질의를 소유한다. 이 글은 **일상어 두 개**의 뜻을 다루고 통계는 도구로만 인용한다. C4의 레인지 개념은 `learn/poker-range` 소유 |
| 9 | 3벳까지 온 판에서는 팟 오즈가 얼마나 달라져 있을까? | betting | INTERMEDIATE | **113개 중 `INTERMEDIATE`는 `learn:three-bet` 하나뿐이고 blog에는 0편이다.** `term-four-bet` 인바운드 2, `toolPotOdds` 인바운드 6(약함). `POT_ODDS_REQUIRED_EQUITY`가 `pot|bet` 두 인자를 받으므로(`facts.ts:84`) 순수 사실만으로 쓸 수 있다 | `term-three-bet`(3) · `term-four-bet`(2) · `term-pot-odds`(7) · `term-pot`(4) · `three-bet` · `pot-odds` · `blog-why-called-3bet`(약함) · `toolPotOdds`(6, 약함) | C1이 "3벳 뜻"을 `learn/three-bet`에, "왜 3벳이라 부르나"를 `blog/why-called-3bet`에 배정했다. C5는 "팟오즈"를 `learn/pot-odds`+`/tools/pot-odds`에 배정했다. 이 글은 **둘 중 어느 개념도 설명하지 않고**, 두 개념이 만나는 지점의 숫자만 보여준다 |
| 10 | 플러시끼리 붙으면 누가 이길까? | hand-strength | INTRO | **`term-nuts` 인바운드 0.** `content/glossary/nuts.mdx:13`이 "플러시를 만들었다는 이유만으로 가장 강하다고 볼 수 없는 이유가 여기 있고"라고 쓰는데, **같은 족보끼리의 비교를 다루는 글은 `blog/same-pair-who-wins`(원페어)뿐**이다. 플러시는 비어 있다 | **`term-nuts`(0)** · `term-flush`(5) · `term-kicker`(5) · `term-board`(4) · `hand-rankings` · `blog-same-pair-who-wins` · `blog-what-is-kicker` · `toolHandChecker`(8, 약함) · **`practiceHandRanking`(0)** | C2가 "플러시 vs 스트레이트"를 `blog/flush-vs-straight`에, 상위어 "족보 순서"를 `learn/poker-hand-rankings`에 배정했다. 이 글은 **다른 족보와 비교하지 않는다** — 같은 플러시끼리만. C13의 "키커"는 `blog/what-is-kicker` 소유 |
| 11 | 브로드웨이 패란 무엇일까? | starting-hands | INTRO | **`브로드웨이`에 glossary 항목이 없는데 `content/hands/kjs.mdx:8`과 `content/hands/jts.mdx:8`이 각자 따로 정의**하고, `content/hands/qjs.mdx:15`·`content/hands/t9s.mdx:1`은 정의 없이 쓴다. 정의가 네 군데로 흩어져 있다. 이 네 개 포함 **7개 hands가 `relatedArticles: []`** | **`hand-aqs` `hand-aqo` `hand-ajs` `hand-kqs` `hand-kjs` `hand-qjs` `hand-jts`(전부 relatedArticles 0)** · `term-hand`(1) · `term-suited`(19) · `term-offsuit`(11) · `starting-hands` · `toolStartingHand` · **`practiceStartingHand`(0)** | C9가 "시작 패 순위"를 `learn/starting-hand-ranking`+`/tools/starting-hand`에 배정했다. 이 글은 **순위를 매기지 않는다** — 어떤 카드가 브로드웨이인지, 왜 그렇게 묶어 부르는지만. 개별 hands 페이지는 각 표기 질의 유지 |
| 12 | 수티드 커넥터와 한 칸 갭은 무엇이 다를까? | starting-hands | BASIC | `content/learn/starting-hands.mdx:42`가 커넥터를, `:44`가 "갭 하나짜리 조합"을 이름만 대고 **"다음 레슨에서 숫자로 다시 확인합니다"로 넘기는데, 다음 레슨(`starting-hand-ranking`)은 갭을 다시 다루지 않는다.** `content/learn/starting-hand-ranking.mdx:17`은 수티드 커넥터를 전제로만 쓴다 | **`hand-jts`(0)** · **`hand-t9s`(0)** · `term-suited`(19) · `term-combo`(27) · `term-straight`(4) · `starting-hands` · `starting-hand-ranking` · `hand-matrix` · `toolStartingHand` | C10이 `starting-hands`(판단 기준)와 `starting-hand-ranking`(줄 세우기)을 이미 갈라 놓았다. 이 글은 **간격이라는 축 하나**만 다루고 무늬·페어 축은 각각 `blog/why-suited-matters`·`blog/small-pocket-pairs`에 넘긴다 |
| 13 | JJ·TT 같은 중간 포켓페어는 어디쯤에 있을까? | starting-hands | BASIC | **`hand-jj`·`hand-tt`·`hand-99`가 `relatedArticles: []`.** `blog/small-pocket-pairs`는 레지스트리상 `hand-22`만 연결하고, C16도 그 글을 "작은 포켓페어"에만 배정했다. **중간 포켓페어를 묶어 다루는 글이 없다** | **`hand-jj`(0)** · **`hand-tt`(0)** · **`hand-99`(0)** · `term-pocket-pair`(15) · `term-combo`(27) · `starting-hand-ranking` · `blog-small-pocket-pairs` · `toolStartingHand` | C16이 "작은 포켓페어"를 `blog/small-pocket-pairs`에 배정했다. 이 글은 **다른 구간**(JJ·TT·99)을 다루고, 서로 `relatedArticles`로 잇는다. C9의 전체 순위표는 `learn/starting-hand-ranking` 소유 |
| 14 | 인 포지션 · 아웃 오브 포지션은 무슨 뜻일까? | position | BASIC | **`position`은 blog 1편뿐이라 잡탕 묶음행.** **`인포지션`/`인 포지션`/`아웃오브포지션` 전부 grep 0건인데**, `content/blog/btn-why-wide.mdx:1`과 `content/learn/positions-6max.mdx:22`가 이미 "가장 마지막에 행동한다"는 개념을 쓴다. 이름만 없다 | `term-position`(6) · `term-button`(8) · `term-big-blind`(9) · `position` · `positions-6max` · `blog-btn-why-wide` · `range` | C11이 `learn/position`(왜 중요한가), `learn/positions-6max`(자리 이름), `glossary/position`(뜻), `blog/btn-why-wide`(버튼 레인지 폭)로 4분할했다. 이 글은 **네 자리 중 어디에도 없는 상대적 용어 두 개**만 다룬다 |
| 15 | 빅 블라인드는 왜 프리플랍에서만 마지막일까? | position | BASIC | `content/learn/positions-6max.mdx:22`는 "프리플랍에서 가장 마지막에 행동합니다"라고 쓰고, `content/blog/btn-why-wide.mdx:1`은 "버튼은 **프리플랍을 제외한** 모든 라운드에서 가장 마지막"이라고 쓴다. **두 문장이 가리키는 순서 역전을 설명하는 페이지가 없다** | `term-big-blind`(9) · `term-small-blind`(4) · `term-preflop`(6) · `term-flop`(4) · `positions-6max` · `preflop` · `flop-turn-river` · `blog-why-blinds-exist` | C11에서 `learn/positions-6max`가 "6맥스 자리 이름"을, `blog/btn-why-wide`가 "버튼 레인지가 넓은 이유"를 갖는다. 이 글은 자리 이름을 다시 세우지 않고 **한 자리의 순서가 라운드마다 바뀌는 규칙**만 다룬다. C17의 "블라인드를 왜 내나"는 건드리지 않는다 |
| 16 | 레인지가 "몇 %"라는 건 무슨 뜻일까? | range | BASIC | **`range`는 blog 1편뿐이라 잡탕 묶음행.** `RFI_PERCENT`·`RFI_COMBOS`·`COMBO_COUNT`가 `facts.ts:132-140`에 있고 실제로 쓰이는데, **퍼센트 표기가 무엇을 세는지 설명하는 페이지가 없다.** `term-combo`는 인바운드 27로 사이트에서 가장 많이 참조되지만 그 자체를 풀어 주는 글은 없다 | `term-range`(4) · `term-combo`(27) · `term-hand-matrix`(2) · `poker-range` · `hand-matrix` · `range` · `toolStartingHand` · **`practiceRange`(0)** | C4가 "레인지 개념"을 `learn/poker-range`에, "핸드레인지 표" 도구 질의를 `/tools/range`에 배정했다. C3은 13×13 읽는 법을 `learn/hand-matrix`에 배정했다. 이 글은 **표를 읽는 법도, 레인지가 왜 필요한지도 다루지 않고**, `%`라는 표기 하나만 분해한다 |
| 17 | 레인지 표 아래 "6인 · 100BB"는 왜 항상 붙어 있을까? | range | BASIC | `content/learn/poker-range.mdx:65`·`content/learn/preflop.mdx:31`·`content/learn/position.mdx:12`가 모두 이 조건을 **선언만** 하고, `content/learn/hand-matrix.mdx:49`는 "그 조건도 같이 확인하는 습관을 들이면 좋습니다"라고 **지시만** 한다. 조건의 각 항목이 무엇을 뜻하는지 설명하는 페이지가 없다 | `term-hand-matrix`(2) · `term-big-blind`(9) · `term-stack`(2) · `term-range`(4) · `poker-range` · `hand-matrix` · `preflop` · `range` | C4·C3 어느 쪽도 "표의 조건 표기"를 배정하지 않았다. 이 글은 표의 **칸**을 읽지 않고 표 **아래 한 줄**만 읽는다. 조건을 바꿨을 때 표가 어떻게 달라지는지는 도구로 넘긴다 |
| 18 | 확률을 셀 때 왜 52장이 아니라 47장일까? | odds | BASIC | `content/blog/outs-nine.mdx:27`이 "47장(또는 46장) 중"을 **설명 없이** 쓰고, `content/learn/outs.mdx:59`도 "내가 볼 수 없는 카드는 계산에서 똑같이 아직 나올 수 있는 카드로 다룹니다"라는 규약을 전제만 한다. **`47장` grep 1건, 그 규약을 소유한 페이지 0** | `term-outs`(4) · `term-draw`(2) · `term-combo`(27) · `term-board`(4) · `outs` · `blog-outs-nine` · `toolOuts` · `toolEquity` | C6이 "아웃 개념"을 `learn/outs`에, "아웃츠 계산기"를 `/tools/outs`에 배정했다. 이 글은 **아웃을 세지 않는다** — 분모가 왜 그 수인지만. `blog/outs-nine`은 9아웃 사례 유지 |
| 19 | 오픈엔디드 스트레이트 드로우는 아웃이 몇 장일까? | odds | BASIC | **`content/blog/outs-nine.mdx:27`이 후속편을 직접 요구한다** — "아웃이 9장이 아니라 다른 개수라면 … 그 개수에 맞는 새 계산이 필요합니다." `content/learn/outs.mdx:21`은 스트레이트 드로우를 예고하고 `:39`는 거트샷(4아웃)만 처리한다. **`오픈엔디드` grep 0건 — 8아웃 자리가 정확히 비어 있다** | `term-outs`(4) · `term-draw`(2) · `term-straight`(4) · `outs` · `blog-outs-nine` · `toolOuts` · `toolEquity` | C6에 따라 세는 방법 일반론은 `learn/outs`, 9아웃 사례는 `blog/outs-nine`. 이 글은 **8아웃 하나**만 다룬다. 4아웃(거트샷)은 `learn/outs.mdx:39`가 이미 소유하므로 재론 금지 |
| 20 | 승률과 팟 오즈는 무엇이 다를까? | equity | BASIC | **`equity`는 blog 1편(`blog-qq-vs-ak`)뿐이라 잡탕 묶음행.** `learn/equity`와 `learn/pot-odds`가 각자 개념을 소유하지만 **둘을 나란히 놓고 구분하는 페이지가 없다.** `toolPotOdds` 인바운드 6(약함) | `term-equity`(6) · `term-pot-odds`(7) · `term-outs`(4) · `equity` · `pot-odds` · `blog-pot-odds-quick` · `blog-outs-nine` · `toolEquity` · `toolPotOdds`(6, 약함) | C7이 "에퀴티"를 `learn/equity`+`/tools/equity`에, C5가 "팟오즈"를 `learn/pot-odds`+`/tools/pot-odds`에 배정했다. 이 글은 **어느 쪽도 유도하지 않고** 두 숫자가 각각 무엇을 세는지 대조만 한다. 암산법은 `blog/pot-odds-quick` 소유 |

---

## 주제별 개요와 도구 연결

### 1. 딜러 버튼은 왜 매 판 자리를 옮길까? — `rules` / `INTRO`
버튼이 한 자리에 고정되지 않고 매 판 한 칸씩 도는 규칙, 그래서 블라인드 두 자리도 함께 도는 구조,
그리고 게임에 따라 여기에 앤티가 더 붙기도 한다는 사실까지. 숫자는 쓰지 않는다.
도구: `/tools/range`(자리별로 표가 달라지는 것을 눌러 확인), `/learn/positions-6max`.
**경계:** 블라인드를 왜 내는지는 다루지 말 것(`blog/why-blinds-exist` 소유, C17).
BTN 약어 설명 금지(`glossary/button`). 여섯 자리 이름 나열 금지(C11 → `learn/positions-6max`).
자리별 유불리 주장 금지.

### 2. 쇼다운에서는 누가 먼저 카드를 열까? — `rules` / `INTRO`
마지막 베팅 라운드가 끝난 뒤 카드를 여는 순서, 아무도 베팅하지 않았을 때의 순서,
그리고 보여주지 않고 접을 수 있다는 점. 절차만 다룬다.
도구: `/tools/hand-checker`(인바운드 8로 약함 — 두 패를 넣어 승자를 확인).
**경계:** 아홉 족보의 순서를 설명하지 말 것(C8 → `learn/poker-hand-rankings`).
누가 이기는지 판정 로직 금지(`blog/same-pair-who-wins`, `blog/what-is-kicker` 소유).
사이트마다 다른 공개 규칙을 단정하지 말 것 — `glossary/ante.mdx:5`가 쓰는 "실제 테이블 안내를 확인하라" 패턴을 따른다.

### 3. 올인이 나오면 그 판은 어떻게 끝날까? — `rules` / `INTRO`
올인한 사람이 더 낼 돈이 없어진 뒤 남은 사람들끼리 계속 베팅할 수 있다는 것, 그때 팟이
메인 팟과 사이드 팟으로 갈린다는 것, 그리고 올인한 사람은 자기가 낸 만큼까지만 가져간다는 것.
도구: `/tools/pot-odds`(인바운드 6으로 약함).
**경계:** 언제 올인해야 하는지 금지. 팟오즈 계산법 금지(C5 → `learn/pot-odds`).
`glossary/all-in`(올인 뜻)·`glossary/pot`(팟 뜻)의 정의를 다시 쓰지 말고 링크로 넘길 것.

### 4. 체크와 콜은 무엇이 다를까? — `betting` / `INTRO`
"둘 다 돈을 더 안 내는 것 아닌가"라는 초보의 혼동 하나만 푼다. 앞에 걸린 돈이 있느냐 없느냐가
갈림길이고, 체크한 뒤에도 차례가 다시 돌아올 수 있다는 것까지.
도구: `/tools/pot-odds`(콜 금액이 있을 때만 의미가 생긴다는 연결).
**경계:** 다섯 가지 행동 전체를 나열하지 말 것(`learn/poker-actions` 소유, order 9).
베팅·레이즈·폴드는 이름만 언급. 언제 체크하고 언제 콜하는지 판단 조언 금지.

### 5. 프리플랍과 포스트플랍은 무엇이 다를까? — `betting` / `INTRO`
플랍이 열리는 순간을 기준으로 이름이 갈린다는 것, 그 뒤로 정보가 생기고 베팅 시작 순서가 바뀐다는 것,
그리고 "포스트플랍"이라는 말이 플랍·턴·리버를 통째로 가리킨다는 것.
도구: `/tools/range`(레인지 표가 프리플랍 조건만 다룬다는 사실을 그 자리에서 확인).
**경계:** 프리플랍 개념 재설명 금지(C12 → `learn/preflop`). 플랍·턴·리버가 몇 장씩 열리는지 금지
(`learn/flop-turn-river` 소유). **C-Bet을 얼마나 자주 하는지 절대 금지** — `glossary/c-bet.mdx:17`이
"FishTilt는 이 데이터를 다루지 않습니다"라고 명시한다. 포스트플랍 전략 일체 금지.

### 6. 체크 레이즈란 무엇일까? — `betting` / `BASIC`
체크한 사람에게 차례가 다시 돌아오는 구조가 먼저이고, 그 자리에서 레이즈를 고르면 그것이
체크 레이즈라는 이름이 붙는다는 것. 이름의 유래와 성립 조건까지만.
도구: `/tools/range`.
**경계:** 언제·얼마나 자주 하는지 금지(`glossary/bluff.mdx:19`가 세운 사이트 규범을 따른다).
체크·레이즈 각각의 뜻 재설명 금지(`glossary/check`, `glossary/raise` 소유).
최소 인상액은 `glossary/raise.mdx:7-9`가 이미 소유하므로 다루지 말 것.

### 7. 세미 블러프란 무엇일까? — `betting` / `BASIC`
지금은 이길 수 없지만 다음 카드로 완성될 수 있는 패로 거는 베팅. 완전한 블러프와 갈리는 지점이
"드로우가 남아 있는가"라는 것을 아웃 개수와 완성 확률로 보여준다.
숫자는 `OUTS_PROB`에서 가져온다(**해당 수치는 기존 `<Fact>`에서 가져온다**).
도구: `/tools/outs`.
**경계:** 블러프 일반론 금지(`glossary/bluff` 소유). **빈도·언제 해야 하는지 절대 금지** —
`glossary/bluff.mdx:19`가 명시적으로 범위 밖으로 선언했다. 아웃 세는 법 금지(C6 → `learn/outs`).

### 8. 타이트하다 · 루즈하다는 무슨 뜻일까? — `betting` / `BASIC`
사람들이 플레이 스타일을 부를 때 쓰는 두 일상어가 실제로는 "판에 들어가는 빈도"를 가리킨다는 것,
그리고 그것을 세는 숫자가 VPIP와 PFR이라는 것. 두 용어를 처음 이어 붙이는 글.
도구: `/tools/range`(넓은 레인지와 좁은 레인지를 눈으로 비교).
**경계:** **VPIP·PFR이 얼마여야 좋은지 절대 금지** — `content/glossary/vpip.mdx:13`이
"VPIP가 얼마여야 좋은지는 이 사이트가 답하지 않습니다"라고 못 박았다.
상대 유형별 대응법 금지. 각 약어의 정의는 glossary 두 항목이 소유하므로 링크로 넘길 것.
레인지 개념 재설명 금지(C4 → `learn/poker-range`).

### 9. 3벳까지 온 판에서는 팟 오즈가 얼마나 달라져 있을까? — `betting` / `INTERMEDIATE`
오픈 레이즈만 있는 판과 3벳까지 온 판에서, 콜에 필요한 최소 승률이 어떻게 달라지는지를
`POT_ODDS_REQUIRED_EQUITY`(`pot|bet`) 로 나란히 보여준다. **숫자는 전부 기존 `<Fact>`에서 가져온다.**
blog의 첫 `INTERMEDIATE` 편이 된다.
도구: `/tools/pot-odds`(인바운드 6으로 약함).
**경계:** **3벳 대응 레인지 표 절대 금지** — `content/glossary/three-bet.mdx:17`이 "아직 다루지 않는
부분이라, 준비 중입니다"라고 선언했다. 콜해야 하는지에 대한 권고 금지. 3-Bet 개념·어원 금지
(C1 → `learn/three-bet` / `blog/why-called-3bet`). 팟오즈 계산법 유도 금지(C5 → `learn/pot-odds`).

### 10. 플러시끼리 붙으면 누가 이길까? — `hand-strength` / `INTRO`
같은 무늬 다섯 장을 둘 다 만들었을 때, 무늬의 종류가 아니라 가장 높은 카드부터 순서대로 비교한다는 것.
그리고 보드에 이미 깔린 무늬로 둘 다 같은 다섯 장을 쓰게 되면 팟을 나눈다는 것.
넛츠가 보드마다 달라진다는 사실로 마무리한다.
도구: `/tools/hand-checker`(인바운드 8로 약함), `/practice/hand-ranking-quiz`(**인바운드 0**).
**경계:** 아홉 족보의 순서 금지(C8 → `learn/poker-hand-rankings`).
플러시 대 스트레이트 비교 금지(C2 → `blog/flush-vs-straight`). 키커 개념 금지(C13 → `blog/what-is-kicker`).
"플러시를 만들면 어떻게 플레이하라" 금지.

### 11. 브로드웨이 패란 무엇일까? — `starting-hands` / `INTRO`
10·J·Q·K·A 다섯 장을 브로드웨이 카드라 부르고, 그중 두 장으로 이루어진 시작 패를 브로드웨이 패라
부른다는 것. 네 군데(`hands/kjs.mdx:8`, `jts.mdx:8`, `qjs.mdx:15`, `t9s.mdx:1`)에 흩어진 정의를
한 곳으로 모으고, 그 7개 hands 페이지가 돌아올 하나의 목적지를 만든다.
도구: `/tools/starting-hand`, `/practice/starting-hand-quiz`(**인바운드 0**).
**경계:** 순위를 매기지 말 것(C9 → `learn/starting-hand-ranking`).
어느 자리에서 쓰는지 금지(레인지 영역). 개별 핸드의 조합 수·확률은 각 hands 페이지가 소유하므로
전체 목록을 복제하지 말 것 — 대표 몇 개만 인용하고 나머지는 링크.

### 12. 수티드 커넥터와 한 칸 갭은 무엇이 다를까? — `starting-hands` / `BASIC`
`content/learn/starting-hands.mdx:44`가 다음 레슨으로 넘겼지만 실제로는 아무 데서도 이어받지 않은
"간격"이라는 축 하나를 마무리한다. 78처럼 붙은 조합과 79처럼 한 칸 빈 조합이 스트레이트를 만드는
경로에서 어떻게 갈리는지. 숫자는 `HAND_RANK`·`HAND_EQUITY_VS_RANDOM`에서 가져온다.
도구: `/tools/starting-hand`, `/tools/equity`.
**경계:** 무늬 축 금지(`blog/why-suited-matters` 소유, C14). 페어 축 금지(`blog/small-pocket-pairs`, C16).
전체 순위표 금지(C9). 어느 자리에서 쓰는지 금지.

### 13. JJ·TT 같은 중간 포켓페어는 어디쯤에 있을까? — `starting-hands` / `BASIC`
AA~QQ와 22~66 사이에 낀 구간을 묶어서 본다. `HAND_RANK`·`HAND_EQUITY_VS_RANDOM`·`HAND_TOP_SHARE`로
위치를 확인하고, `hand-jj`·`hand-tt`·`hand-99`가 처음으로 돌아올 글이 된다.
도구: `/tools/starting-hand`, `/tools/equity`.
**경계:** 작은 포켓페어 금지(C16 → `blog/small-pocket-pairs`). 세트 마이닝·오버카드 대응 등
포스트플랍 판단 전부 금지. AA 다음 순위 금지(`blog/next-best-after-aa` 소유).
"어떻게 플레이하라" 금지 — `content/hands/kk.mdx:19`가 세운 경계를 그대로 따른다.

### 14. 인 포지션 · 아웃 오브 포지션은 무슨 뜻일까? — `position` / `BASIC`
자리 이름(UTG·BTN…)이 절대 좌표라면, 인 포지션/아웃 오브 포지션은 **상대와의 관계**라는 것.
같은 BTN이라도 누가 남아 있느냐에 따라 달라진다는 점까지.
도구: `/tools/range`.
**경계:** 포지션이 왜 중요한지 재론 금지(C11 → `learn/position`).
여섯 자리 이름 나열 금지(`learn/positions-6max`). 자리별 레인지 폭 금지(`blog/btn-why-wide`).
"아웃 오브 포지션에서는 이렇게 하라" 금지.

### 15. 빅 블라인드는 왜 프리플랍에서만 마지막일까? — `position` / `BASIC`
`content/learn/positions-6max.mdx:22`("BB는 프리플랍에서 가장 마지막")와
`content/blog/btn-why-wide.mdx:1`("버튼은 프리플랍을 제외한 모든 라운드에서 가장 마지막")이 함께
가리키는 순서 역전을, 블라인드가 이미 돈을 내 놓은 상태에서 시작한다는 규칙으로 설명한다.
도구: `/tools/range`.
**경계:** 자리 이름 소개 금지(C11). 블라인드를 왜 내는지 금지(C17 → `blog/why-blinds-exist`).
BB 디펜스·블라인드 방어 전략 일체 금지 — 그 레인지는 사이트에 없다(`content/learn/preflop.mdx:31`).

### 16. 레인지가 "몇 %"라는 건 무슨 뜻일까? — `range` / `BASIC`
`%`가 169가지 표기가 아니라 **1326가지 조합**을 기준으로 세는 값이라는 것.
그래서 AA(6조합)와 AKs(4조합)가 한 칸씩 차지해도 무게가 다르다는 것.
숫자는 `COMBO_COUNT`·`HAND_COMBOS`·`RFI_PERCENT`·`RFI_COMBOS`에서 가져온다.
도구: `/tools/range`, `/tools/starting-hand`, `/practice/range-quiz`(**인바운드 0**).
**경계:** 13×13 표 읽는 법 금지(C3 → `learn/hand-matrix`). 레인지를 왜 쓰는지 금지
(C4 → `learn/poker-range` / `blog/why-use-range`). 자리별 % 값을 나열해 표를 재현하지 말 것 —
도구가 소유한다.

### 17. 레인지 표 아래 "6인 · 100BB"는 왜 항상 붙어 있을까? — `range` / `BASIC`
`content/learn/hand-matrix.mdx:49`가 "조건도 같이 확인하는 습관"을 권하고 끝낸 지점을 이어받아,
인원 수 · 스택 깊이 · "아무도 참여하지 않았을 때"라는 세 조건이 각각 무엇을 뜻하는지 풀어 준다.
같은 패라도 조건이 다르면 다른 표라는 것 — 사이트 신뢰도에 직접 기여하는 글이다.
도구: `/tools/range`, `/learn/hand-matrix`.
**경계:** 조건을 바꿨을 때 어떤 패가 추가/제거되는지 단정하지 말 것 — 사이트는
`6인 · 100BB · 아무도 참여하지 않았을 때` 표 하나만 갖고 있다(`content/learn/poker-range.mdx:65`).
다른 조건의 표를 만들어 보이거나 추측하지 말 것. 13×13 읽는 법 금지(C3).

### 18. 확률을 셀 때 왜 52장이 아니라 47장일까? — `odds` / `BASIC`
`content/blog/outs-nine.mdx:27`이 설명 없이 쓰는 분모를 정면으로 다룬다. 내 두 장과 보드 세 장을
빼면 47장, 턴이 열리면 46장. 상대가 든 카드를 왜 빼지 않는지까지.
`content/learn/outs.mdx:59`의 규약("내가 볼 수 없는 카드는 아직 나올 수 있는 카드로 다룬다")을
소유하는 페이지가 된다.
도구: `/tools/outs`, `/tools/equity`.
**경계:** 아웃을 세는 법 금지(C6 → `learn/outs`). 9아웃 사례 금지(`blog/outs-nine`).
"아웃 × 2 / × 4" 규칙 금지 — `content/learn/outs.mdx:39-41`이 이미 오차 방향까지 소유한다.
상대 레인지를 근거로 분모를 줄이는 계산 금지(사이트 범위 밖).

### 19. 오픈엔디드 스트레이트 드로우는 아웃이 몇 장일까? — `odds` / `BASIC`
`content/blog/outs-nine.mdx:27`이 직접 요구한 후속편. 양쪽이 다 열린 스트레이트 드로우는
완성 숫자가 둘이라 아웃이 8장이라는 것, 그리고 `OUTS_PROB`가 주는 완성 확률.
**숫자는 전부 기존 `<Fact>`에서 가져온다** (`OUTS_PROB` `8|FLOP|RIVER` 형태).
도구: `/tools/outs`, `/tools/equity`.
**경계:** 거트샷(4아웃) 금지 — `content/learn/outs.mdx:39`가 소유한다.
플러시 드로우(9아웃) 금지 — `blog/outs-nine`이 소유한다. 아웃 세는 법 일반론 금지(C6).
드로우를 들고 어떻게 플레이할지 금지.

### 20. 승률과 팟 오즈는 무엇이 다를까? — `equity` / `BASIC`
하나는 "내가 이길 비율", 다른 하나는 "이 콜이 손해가 아니려면 필요한 최소 비율" — 둘 다 %로 나오지만
세는 대상이 다르다는 대조 하나만. `HAND_EQUITY_VS_RANDOM`과 `POT_ODDS_REQUIRED_EQUITY`를
나란히 놓아 보여준다.
도구: `/tools/equity`, `/tools/pot-odds`(인바운드 6으로 약함).
**경계:** 두 개념 어느 쪽도 처음부터 유도하지 말 것(C7 → `learn/equity`, C5 → `learn/pot-odds`).
암산 요령 금지(`blog/pot-odds-quick`). 아웃 확률과의 비교 금지 —
`content/blog/outs-nine.mdx`가 "팟 오즈와 아웃 확률 중 뭘 먼저 봐야 하나요" 항목을 이미 갖고 있다.
"이 콜을 해야 한다"는 결론 금지.

---

## 제외한 후보와 그 이유

| 후보 | 제외 이유 |
|---|---|
| "아웃 × 2 / × 4 규칙" 단독 글 | `content/learn/outs.mdx:39-41`이 규칙과 **오차 방향까지** 이미 소유하고, `content/blog/outs-nine.mdx:20`도 같은 규칙을 쓴다. C6 배정 위반 |
| "턴에서의 아웃 확률" | `content/blog/outs-nine.mdx`가 "그 계산까지는 아웃츠 레슨에서 다룹니다"라고 명시적으로 `learn/outs`에 넘겼다 |
| "스택은 왜 BB 단위로 말할까" | `content/glossary/stack.mdx:7-9`가 `## BB 단위로 이야기합니다` 소제목으로 이미 소유한다 |
| "레이즈는 최소 얼마부터 올릴 수 있나" | `content/glossary/raise.mdx:7-9`가 `## 얼마나 올릴 수 있나요`로 이미 소유한다 |
| "넛츠란 무엇인가" | `glossary/nuts`와 검색 의도가 완전히 동일(용어 조회). 대신 상황형 질의인 #10으로 우회해 `term-nuts`의 인바운드를 열었다 |
| "포커에서 액션이란" | `glossary/action`(용어 조회)과 `learn/poker-actions`(다섯 행동) 사이에 남는 의도가 없다. 대신 #4·#6이 `term-action`을 연다 |
| "AA 대 KK", "포켓페어 대 오버카드" 등 클래스 승률 비교 | `src/content/facts.ts:39-43` — `CLASS_VS_CLASS_EQUITY`는 **얼려 둔 매치업만** 해석되고 나머지는 throw한다. 사이트에서 실제로 쓰인 매치업은 `QQ|AKs`·`QQ|AKo` 둘뿐이며(`blog/qq-vs-ak`), 새 매치업은 데이터셋 생성이 선행되어야 한다. 콘텐츠 주제로 낼 수 없다 |
| "멀티웨이 팟", "블로커", "임플라이드 오즈", "리버스 임플라이드", "폴드 에퀴티", "레인지 어드밴티지", "MDF" | 산문 grep 0건이면서 **이미 필요한 자리도 없다.** 전부 포스트플랍/고급 이론이고, 뒷받침할 `<Fact>`가 없으며, `content/glossary/c-bet.mdx:17`·`bluff.mdx:19`·`four-bet.mdx:17`이 세워 둔 "포스트플랍 전략은 다루지 않는다"는 사이트 경계를 넘는다 |
| "틸트", "피시", "뱅크롤 관리" | 산문 grep 0건이고 필요한 자리도 없다. 심리·자금 관리는 현재 8개 `topic` 어디에도 들어맞지 않는다(`types.ts:57-66`) |
| "핸드 히스토리 리뷰하는 법", "내 플레이 자동 분석" | **금지 영역.** 이 프로젝트는 포커 클라이언트에 연결되지 않는다. 화면 인식·자동 수집을 전제한 주제는 제안 자체가 실격이다 |
| "3벳에 어떤 패로 대응하나" | `content/glossary/three-bet.mdx:17`이 "아직 다루지 않는 부분이라, 준비 중"이라고 선언했다. 데이터가 없다 |
| "A5s는 왜 순위표 중간에 있나" | `hand-a5s`의 `relatedArticles: []`를 메우고 싶었으나, C9가 순위 질의를 `learn/starting-hand-ranking`에 배정했고 남는 의도가 얇다. **새 글 대신 레지스트리 정리로 해결** — 아래 참조 |
| "온라인 카드가 조작인가" | `content/blog/how-often-aa.mdx:19`가 이미 정면으로 답한다 |
| "왜 여섯 명인가 / 9맥스와의 차이" | 사이트에 6인 표 하나뿐이라(`content/learn/poker-range.mdx:65`) 비교 대상이 없다. 추측 없이는 쓸 수 없다 |

### 새 글 없이 레지스트리 정리로 해결되는 것 (오케스트레이터 판단 사항, 본 조사 범위 밖)

읽기 전용 조사에서 확인된, **글이 아니라 관계 필드만 고치면 되는 것들**이다. 제안만 남긴다.

1. `hand-77` · `hand-88` · `hand-99`의 `relatedArticles`에 `blog-small-pocket-pairs` 추가 — **C16이 이미 그렇게 배정했는데 레지스트리에 반영되지 않았다** (현재 `hand-22`만 연결).
2. `blog-a2345-wheel`의 `relatedHands`에 `hand-a5s` 추가 — A5s는 휠을 만드는 대표 시작 패인데 두 레코드가 서로를 모른다.
3. `term-one-pair` ↔ `term-two-pair`의 닫힌 2-사이클 — `learn/hand-rankings`나 `blog/same-pair-who-wins`의 `relatedConcepts`에 추가하면 새 글 없이 열린다.
4. 58개 glossary 중 41개가 `relatedArticles`를 갖지 않는다. 위 20개 글이 배포되면 그중 상당수가 자연스러운 목적지를 얻는다.

---

## 우선순위 상위 5개와 그 이유

| 순위 | 주제 | 이유 |
|---|---|---|
| **1** | **#19 오픈엔디드 스트레이트 드로우는 아웃이 몇 장일까?** | **기존 본문이 직접 요구한 유일한 후속편이다.** `content/blog/outs-nine.mdx:27`이 "그 개수에 맞는 새 계산이 필요합니다"라고 명시했고, 4아웃은 `learn/outs.mdx:39`가 이미 채웠으므로 남은 빈칸이 정확히 하나(8아웃)로 특정된다. `OUTS_PROB` 하나로 전부 인용 가능해 새 데이터가 필요 없다. `odds` 토픽도 2→3으로 보강된다 |
| **2** | **#11 브로드웨이 패란 무엇일까?** | **같은 개념이 네 파일에 서로 다르게 정의되어 있는 유일한 사례**다(`hands/kjs.mdx:8`, `jts.mdx:8`, `qjs.mdx:15`, `t9s.mdx:1`). 정의가 흩어진 것은 콘텐츠 일관성 결함이고, 하나로 모으면 **`relatedArticles: []`인 7개 hands 페이지**가 동시에 목적지를 얻는다 — 14개 고아 hands의 절반이다. 인바운드 0인 `/practice/starting-hand-quiz`도 함께 연결된다 |
| **3** | **#16 레인지가 "몇 %"라는 건 무슨 뜻일까?** | `range`를 잡탕 묶음에서 꺼내면서(1→2, #17과 함께 3), **인바운드 0인 `/practice/range-quiz`를 여는 가장 자연스러운 글**이다. `term-combo`는 인바운드 27로 사이트에서 가장 많이 참조되는 용어인데 그 자체를 풀어 주는 글이 없다는 비대칭도 해소한다. 인용 숫자가 전부 `COMBO_COUNT`/`RFI_*`로 이미 존재한다 |
| **4** | **#8 타이트하다 · 루즈하다는 무슨 뜻일까?** | **`term-vpip` ↔ `term-pfr` 닫힌 2-사이클을 여는 유일한 방법이다** — 두 레코드가 서로만 참조해 그래프에서 완전히 고립돼 있고, 오케스트레이터가 확인했듯 새 글 없이는 열리지 않는다. `타이트`·`루즈`는 산문 grep 0건인데 초보자가 가장 먼저 듣는 말이라, 어휘 공백으로서도 실질적이다. 다만 `glossary/vpip.mdx:13`의 "얼마여야 좋은지는 답하지 않는다"는 경계를 반드시 지켜야 하므로 **집필 난도가 이 목록에서 가장 높다** |
| **5** | **#5 프리플랍과 포스트플랍은 무엇이 다를까?** | `betting`을 잡탕 묶음에서 꺼내고(1→2), **인바운드 0인 `term-c-bet`을 여는 가장 자연스러운 진입점**이다. `포스트플랍`은 사이트 전체에서 단 한 번, 그것도 "여기서는 다루지 않는다"는 문장 안에서만 등장한다(`glossary/c-bet.mdx:17`) — 독자가 그 단어를 처음 만나는 자리가 하필 거절 문장이라는 것은 UX 결함이다. `INTRO` 레벨이라 blog의 INTRO 5편 편중도 함께 완화한다 |

**상위 5개 반영 후 blog `topic` 분포**: starting-hands 8 · hand-strength 6 · odds 3 · betting 3 · range 2 · equity 1 · position 1 · rules 1
→ 잡탕 묶음은 여전히 남는다(equity·position·rules 각 1편). **잡탕 묶음을 완전히 없애려면 #1(또는 #2·#3),
#14(또는 #15), #20까지 8편이 필요하다.** `/blog` 허브의 정보 구조를 우선한다면 이 셋을 상위 5개 다음
순번(6·7·8)에 붙이는 것을 권한다.
