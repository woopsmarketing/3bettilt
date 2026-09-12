# FishTilt WP-1 — 현황 감사 · 정보구조 · 키워드 맵

## 목표

FishTilt Stage-2(디자인 · SEO · 블로그 · 비주얼 개선)를 시작하기 전에, 이미 배포 가능한 131개
페이지가 **무엇을 설명하는 사이트인지**를 라우트 단위로 확정한다. 구체적으로는 (1) 131개
페이지의 역할 분류, (2) 페이지별 타겟 키워드 1개 확정, (3) 같은 의도를 두 페이지가 노리는 충돌
해소, (4) 내부링크 허브 구조 목표안, (5) 근거 있는 문제 목록, (6) WP-2~WP-8 배분 우선순위,
(7) FAQ를 새로 써야 하는 페이지 확정.

이 WP의 산출물은 이 문서 하나이며, 소스 코드는 한 줄도 바뀌지 않는다.

**키워드 선정 방법론(중요).** 이 저장소에는 검색량 · 난이도 · CPC 같은 키워드 도구 데이터가
없다. 따라서 이 문서의 어떤 키워드에도 수치를 붙이지 않는다. 우선순위와 배정은 오직 두 가지
근거로만 정당화한다 — **① 그 페이지가 코드/콘텐츠상 실제로 무엇을 설명하는가(레지스트리의
`title`/`description`, MDX 본문, 페이지 H1을 직접 인용)**, **② 한국 홀덤 초보가 그것을 실제로
어떻게 부르는가(글로서리 `aliases` 필드에 이미 기록된 한국어 표기를 1차 근거로 사용)**.

**제외 규칙.** "GTO"는 UI·키워드·문서 어디에도 쓰지 않는다. 전략 조언성 키워드(`홀덤 필승법`,
`이기는 법`, `이 패로 콜해야 하나` 류), 카지노 · 베팅 · 입출금 · 보너스 · 제휴 · 프리롤 계열
키워드는 전부 대상에서 뺀다. 이 사이트는 "무엇인가"와 "어떻게 계산되는가"에만 답한다.

## 범위

- **입력**: WP-1A(라우트 · 메타데이터 · JSON-LD · 네비게이션 · 토큰 · 이미지 감사), WP-1B(콘텐츠
  스키마 · 113개 레코드 인벤토리 · 내부링크 그래프 · FAQ · 블로그 UI · 카드 중복 감사). 두 감사의
  사실은 마스터가 코드로 재검증했으므로 재감사하지 않았다.
- **보충 조사**: 키워드 근거로 원문 인용이 필요한 부분만 소스를 직접 열었다 —
  `apps/fishtilt/src/content/registry/**`(learn/blog/hands/glossary 전 레코드의 `title` ·
  `description` · `slug` · `term` · `aliases`), `apps/fishtilt/src/app/**/page.tsx`(정적 18개
  라우트의 `pageMetadata` 원문), `apps/fishtilt/src/lib/routes.ts`, 고아 용어 6건의 실제
  MDX 등장 위치.
- **범위 밖**: 코드 수정, 테스트/빌드/dev 서버 실행, 신규 라우트 설계, 콘텐츠 신규 집필.

## 확인한 기존 상태

| 항목 | 사실 | 출처 |
|---|---|---|
| 총 페이지 | 131 (정적 18 + 동적 113) | 1A §1 |
| 콘텐츠 레코드 | 113 전량 `PUBLISHED`, `PLANNED` 0건, MDX 파일도 정확히 113개 | 1B §2-1 |
| 메타데이터 | 정적 18개 전부 `pageMetadata()`, 동적 4개 템플릿 전부 `contentMetadata()` — canonical/OG/twitter 누락 0건 | 1A §2 |
| JSON-LD | `BreadcrumbList`/`Article`/`FAQPage`/`WebApplication` 4종만 존재. `WebSite`·`Organization` 단독 빌더 없음 | 1A §3 |
| 사이트 오리진 | `SITE_ORIGIN`이 플레이스홀더 `https://fishtilt.example`로 고정 (`src/lib/seo/site.ts:36,58-59`) | 1A §3 |
| 헤더 | 5개(`learn`,`range`,`tools`,`practice`,`glossary`) + 검색 아이콘. `/blog`·`/hands`·`/about`은 푸터에만 | 1A §4 |
| 테마 | 다크 전용. `@theme` 색상 토큰 15개가 전부 다크 고정, `prefers-color-scheme`/`.dark` 분기 0건 | 1A §5 |
| 이미지 | `public/`에 `og.png` 1개뿐. 파비콘 없음, `next/image`/`<img>` 사용 0건, MDX 이미지 0건 | 1A §6, 1B §5-3 |
| 고아 페이지 | 6건, 전부 glossary | 1B §3-2 |
| FAQ | MDX 본문 `##`/`###` 재파싱 방식. 실제 방출 12개(blog 9, hands 3), learn 0 / glossary 0 | 1B §4 |
| 카드 UI | `HomeLinkCard`는 홈 전용, 허브 6곳이 동일 마크업을 각각 재구현 | 1B §6 |

---

## 구현 내용

### 1. 라우트 유형 분류

| 유형 | 페이지 수 | 해당 라우트 | SEO에서 맡아야 할 역할 |
|---|---|---|---|
| 홈 | 1 | `/` | 사이트 전체의 정체성 head 키워드를 하나만 가져가고, 나머지 링크 자산을 5개 허브로 분배한다. |
| 콘텐츠 허브 | 5 | `/learn` `/blog` `/glossary` `/hands` `/tools` | 각 섹션의 카테고리 키워드를 소유하고, 하위 상세 페이지 전부에 인바운드를 공급하는 유일한 보증 경로다. |
| 콘텐츠 상세 | 113 | `/learn/*`(15) `/blog/*`(20) `/glossary/*`(58) `/hands/*`(20) | 롱테일 질의를 개별로 흡수한다. 사이트 트래픽 총량의 대부분을 책임지는 층. |
| 툴 | 6 | `/tools/{equity,pot-odds,outs,range,starting-hand,hand-checker}` | "계산기"·"표" 계열의 계산형/탐색형 질의를 흡수하고, 그 계산을 설명하는 learn 레슨으로 되돌려 보낸다. |
| 퀴즈 | 4 | `/practice` + 3개 퀴즈 | "연습 문제"·"퀴즈" 질의를 흡수한다. 자체 색인 가치는 작고, 학습 세션 체류 시간을 만드는 것이 주 역할이다. |
| 유틸 | 2 | `/about` `/search` | `/about`은 E-E-A-T 근거 페이지(숫자 출처 · 비제휴 명시)로 전 페이지에서 링크되어야 한다. `/search`는 noindex 유지(확정). |

합계 131. 유형별로 SEO 기대치가 다르므로, 아래 §6의 우선순위도 "허브·상세 > 툴 > 퀴즈 > 유틸"
순으로 가중한다.

---

### 2. 페이지별 타겟 키워드 표

#### 2-1. 정적 라우트 18개

| 라우트 | 1차 키워드 | 2차 보조 키워드 | 검색 의도 | 이 키워드를 주는 근거 | 내부링크로 받아야 할 페이지 |
|---|---|---|---|---|---|
| `/` | 홀덤 배우기 | 무료 홀덤 학습 사이트 / 텍사스 홀덤 초보 / 홀덤 공부 | 학습형 | `pageMetadata` description: "핸드 순위부터 레인지와 확률까지, 텍사스 홀덤을 쉬운 한국어로 … 무료 학습 사이트입니다."(`src/app/page.tsx:58-59`) — 사이트 전체를 한 문장으로 설명하는 유일한 페이지 | 헤더 로고(전 페이지), 브레드크럼 1단(콘텐츠 113개 전부) |
| `/learn` | 홀덤 기초 | 홀덤 입문 순서 / 홀덤 강의 무료 / 홀덤 초보 공부 | 학습형 | title '홀덤 처음 배우기', description "텍사스 홀덤을 순서대로 배우는 무료 강의"(`learn/page.tsx:22-24`). 15개 레슨을 `order` 순 커리큘럼으로 나열 | 홈 §"처음이라면 이 순서로", 헤더①, 푸터①, learn 15개 브레드크럼, 툴 6개·퀴즈 3개의 레슨 교차링크 |
| `/blog` | 포커 궁금증 | 홀덤 초보 질문 / 포커 자주 묻는 질문 / 홀덤 궁금한 점 | 탐색형 | title '포커 궁금증 모음', description "포커를 배우다 보면 생기는 구체적인 질문에 하나씩 답하는 글 모음"(`blog/page.tsx:19-21`) | **헤더(WP-2에서 추가)**, 푸터⑥, 홈 §"이런 질문에 답합니다", blog 20개 브레드크럼 |
| `/glossary` | 포커 용어 | 홀덤 용어 정리 / 포커 용어 사전 / 홀덤 용어집 | 탐색형 | title '포커 용어 사전', description "포커에서 쓰는 말을 쉬운 한국어로 먼저 설명하고, 원어 표기를 함께"(`glossary/page.tsx:25-26`). 58개 가나다순 | 헤더⑤, 푸터⑤, 홈 §"용어와 검색", glossary 58개 브레드크럼, 모든 `<Term>` 팝오버 |
| `/hands` | 홀덤 시작 핸드 목록 | 포커 핸드 종류 / 시작 패 목록 / 프리플랍 핸드 목록 | 탐색형 | title '핸드 목록', description "시작 패 하나하나를 조합 수, 13×13 표에서의 위치, 강도 순위로 살펴보는 페이지 모음"(`hands/page.tsx:18-20`). 강도 순 정렬 | 푸터⑦, hands 20개 브레드크럼, `learn/starting-hands`·`learn/starting-hand-ranking`의 `relatedHands`. **현재 헤더 링크 없음** |
| `/tools` | 포커 계산기 | 홀덤 계산기 / 무료 포커 도구 / 홀덤 도구 모음 | 탐색형 | title '무료 포커 도구', description "팟 오즈, 아웃, 핸드레인지까지 … 무료 홀덤 학습 도구 모음"(`tools/page.tsx:21-23`) | 헤더③, 푸터③, 홈 §"인기 무료 도구", 콘텐츠 113개의 `RelatedContent` 툴 블록 |
| `/practice` | 홀덤 퀴즈 | 포커 퀴즈 / 홀덤 연습 문제 / 포커 문제 풀기 | 학습형 | title '퀴즈', H1 '배운 내용을 직접 풀어보세요', description "배운 내용을 바로 확인하는 연습 문제 모음"(`practice/page.tsx:21-23`) | 헤더④, 푸터④, 홈 §"풀어보면서 확인하기" |
| `/tools/equity` | 포커 승률 계산기 | 홀덤 승률 계산 / 에퀴티 계산기 / 핸드 대결 승률 | 계산형 | description "지금 이 대결의 정확한 승률을 계산하는 무료 승률 계산기"(`tools/equity/page.tsx:32-33`) | `/tools` 허브, `learn/equity`, `glossary/equity`, hands 20개 전부(`relatedTools`에 `toolEquity` 고정) |
| `/tools/pot-odds` | 팟오즈 계산기 | 팟 오즈 계산법 / 콜 필요 승률 / 홀덤 팟오즈 | 계산형 | description "콜하려면 몇 퍼센트는 이겨야 하는지 바로 계산합니다. 계산 과정과 공식을 함께"(`tools/pot-odds/page.tsx:30-31`) | `/tools` 허브, `learn/pot-odds`, `blog/pot-odds-quick`, `glossary/pot-odds` |
| `/tools/outs` | 아웃츠 계산기 | 드로우 완성 확률 / 아웃츠 확률표 / 2배 4배 규칙 | 계산형 | description "드로우가 완성될 확률을 정확하게 계산 … ×2 / ×4 암산 규칙과 실제 확률의 차이까지"(`tools/outs/page.tsx:29-30`) | `/tools` 허브, `learn/outs`, `blog/outs-nine`, `glossary/outs`, `glossary/draw` |
| `/tools/range` | 핸드레인지 표 | 13x13 레인지 표 / 포지션별 오픈 레인지 / 레인지 비교 | 탐색형 | description "포지션별로 어떤 시작 패로 레이즈하는지 13×13 표로 직접 눌러보고, 두 위치를 비교"(`tools/range/page.tsx:32-33`) | 헤더②(사이트에서 유일하게 툴이 헤더에 직접 노출), 푸터②, 홈 CTA 2개, `learn/poker-range`, `learn/hand-matrix`, `/practice/range-quiz` |
| `/tools/starting-hand` | 시작 핸드 순위표 | 169개 시작 패 / 프리플랍 핸드 강도 / 상위 몇 퍼센트 핸드 | 탐색형 | description "169개 시작 패를 무작위 상대 기준 승률 순서로 살펴보고, 상위 몇 %까지 볼지 슬라이더로"(`tools/starting-hand/page.tsx:48-49`) | `/tools` 허브, `learn/starting-hand-ranking`, hands 20개 전부(`toolStartingHand` 고정), `/practice/starting-hand-quiz` |
| `/tools/hand-checker` | 포커 족보 확인 | 내 패 족보 계산기 / 보드 포함 족보 판정 / 족보 자동 판별 | 계산형 | description "지금 만들어진 족보가 무엇인지, 어떤 다섯 장으로 만들어졌는지 바로 보여주는 무료 핸드 체커"(`tools/hand-checker/page.tsx:37-38`) | `/tools` 허브, `learn/hand-rankings`, `glossary/hand-ranking`, 족보 계열 glossary 10개 |
| `/practice/hand-ranking-quiz` | 포커 족보 퀴즈 | 홀덤 족보 문제 / 족보 외우기 연습 / 족보 테스트 | 학습형 | description "두 핸드 중 어떤 패가 이기는지 직접 맞혀보세요 … 틀린 문제만 다시 풀 수 있습니다"(`hand-ranking-quiz/page.tsx:32-33`) | `/practice` 허브, `learn/hand-rankings`, `/tools/hand-checker` |
| `/practice/range-quiz` | 레인지 퀴즈 | 포지션별 레인지 연습 / 오픈 레인지 문제 | 학습형 | description "포지션을 고르고, 각 시작 패가 그 자리의 학습용 기본 레인지에 포함되는지 직접 맞혀보고"(`range-quiz/page.tsx:20-21`) | `/practice` 허브, `learn/poker-range`, `/tools/range` |
| `/practice/starting-hand-quiz` | 시작 핸드 퀴즈 | 시작 패 강약 비교 / 프리플랍 핸드 비교 연습 | 학습형 | description "두 시작 패 중 어느 쪽이 더 강한지 직접 비교 … 프리플랍 기본 강도 데이터로 그 자리에서 바로 채점"(`starting-hand-quiz/page.tsx:38-39`) | `/practice` 허브, `learn/starting-hand-ranking`, `/tools/starting-hand` |
| `/about` | FishTilt 소개 | 피시틸트 / FishTilt 어떤 사이트 | 탐색형(브랜드) | H1 'FishTilt는 무엇인가요', description "화면의 숫자가 어디서 나오는지, 어떤 곳과도 제휴하지 않았다는 것을 설명"(`about/page.tsx:19-20`) — 숫자 출처와 비제휴를 밝히는 유일한 페이지 | 푸터⑧. **추가로 툴 6개·퀴즈 3개에서 "이 숫자는 어디서 나왔나"의 근거 링크로 받아야 함** |
| `/search` | — (타겟 없음) | — | 탐색형(사이트 내부) | `index:false`(`search/page.tsx:24`). 색인 대상이 아니므로 키워드를 배정하지 않는다(확정) | 헤더 검색 아이콘, 홈 §"용어와 검색" |

#### 2-2. Learn 15개

| 라우트 | 1차 키워드 | 2차 보조 키워드 | 검색 의도 | 이 키워드를 주는 근거 | 내부링크로 받아야 할 페이지 |
|---|---|---|---|---|---|
| `/learn/holdem-basics` | 텍사스 홀덤 룰 | 홀덤 하는 법 / 홀덤 게임 방법 / 홀덤 진행 순서 | 학습형 | description "카드를 받고, 돈을 걸고, 승자를 가리기까지. 한 판의 흐름을 처음부터 끝까지 따라갑니다." `order:1` | `/learn` 1번, 홈 "처음부터 배우기" CTA, `blog/why-blinds-exist` |
| `/learn/poker-hand-rankings` | 포커 족보 순서 | 홀덤 족보 / 포커 패 순위 / 족보 순위표 | 학습형 | description "원페어부터 스트레이트 플러시까지, 다섯 장으로 만드는 패의 순서를 그림으로 정리" (id `hand-rankings`, slug는 `poker-hand-rankings`) | `/tools/hand-checker`, `/practice/hand-ranking-quiz`, `glossary/hand-ranking`, 족보 glossary 10개, `blog/flush-vs-straight`·`full-house-vs-flush`·`same-pair-who-wins` |
| `/learn/starting-hands` | 시작 패 보는 법 | 홀덤 첫 두 장 / 수티드 커넥터 페어 / 프리플랍 판단 기준 | 학습형 | description "같은 무늬인지, 숫자가 붙어 있는지, 같은 숫자인지. 시작 패를 보는 세 가지 기준" | `/learn` 3번, `glossary/suited`·`offsuit`·`pocket-pair`, hands 20개 |
| `/learn/starting-hand-ranking` | 시작 패 순위 | 169가지 시작 패 / 프리플랍 핸드 강도 순서 / 시작 패 강한 순 | 학습형 | description "169가지 시작 패를 강한 순서로 늘어놓으면 어떤 모습인지, 그리고 그 순서가 무엇을 뜻하는지" | `/tools/starting-hand`, `/practice/starting-hand-quiz`, `/hands` 허브, `blog/next-best-after-aa` |
| `/learn/hand-matrix` | 13x13 표 보는 법 | 핸드 매트릭스 읽는 법 / 레인지 표 대각선 / 포커 정사각형 표 | 학습형 | description "포커 자료에 자주 나오는 정사각형 표. 대각선, 위쪽, 아래쪽이 각각 무엇을 뜻하는지" | `/tools/range`, `glossary/hand-matrix`(양보), `glossary/combo`, 홈 §"자리를 바꾸면 표가 달라집니다" |
| `/learn/poker-range` | 핸드레인지란 | 포커 레인지 뜻 / 레인지 개념 / 레인지가 뭔가요 | 학습형 | title '핸드레인지란?', description "13×13 표로 레인지 이해" | `/tools/range`, `/practice/range-quiz`, `glossary/range`(양보), `blog/why-use-range`, `blog/btn-why-wide` |
| `/learn/position` | 포커 포지션 | 홀덤 자리 / 포지션이 유리한 이유 / 포지션 중요성 | 학습형 | description "같은 패라도 어느 자리에 앉아 있느냐에 따라 판단이 달라집니다. 그 이유를 순서의 문제로 설명" | `glossary/position`(양보), `learn/positions-6max`, `blog/btn-why-wide` |
| `/learn/positions-6max` | 6맥스 포지션 이름 | UTG HJ CO BTN SB BB / 홀덤 자리 순서 / 6인 테이블 자리 | 학습형 | title 'UTG · HJ · CO · BTN · SB · BB, 여섯 자리의 이름', description "6인 테이블의 여섯 자리를 하나씩 짚고, 각 자리가 언제 행동하는지" | `learn/position`, `glossary/utg`·`button`·`cutoff`·`hijack`·`big-blind`·`small-blind`, `/tools/range`(포지션 선택 UI) |
| `/learn/poker-actions` | 홀덤 액션 종류 | 체크 콜 레이즈 폴드 뜻 / 포커 행동 5가지 / 홀덤 베팅 방법 | 학습형 | description "내 차례에 고를 수 있는 행동은 다섯 가지입니다. 체크, 베팅, 콜, 레이즈, 폴드가 각각 무엇을 뜻하고 언제 고를 수 있는지" | `glossary/action`(고아 해소 대상), `glossary/check`·`call`·`bet`·`raise`·`fold`·`all-in`·`bluff` |
| `/learn/preflop` | 프리플랍이란 | 프리플랍 뜻 / 첫 베팅 라운드 / 프리플랍 진행 | 학습형 | description "공용 카드가 아직 한 장도 열리지 않은 첫 번째 베팅. 이때 무엇을 보고 결정하는지" | `glossary/preflop`(양보), `learn/flop-turn-river`, `/tools/range` |
| `/learn/flop-turn-river` | 플랍 턴 리버 | 공용 카드 순서 / 홀덤 라운드 이름 / 플랍 턴 리버 뜻 | 학습형 | title '플랍 · 턴 · 리버, 카드는 이렇게 열립니다', description "공용 카드 다섯 장이 3장, 1장, 1장으로 나뉘어 열리는 순서와 각 단계의 이름" | `glossary/flop`·`turn`·`river`·`board`·`community-cards`, `glossary/c-bet`(`nextLessons` 이미 지정됨) |
| `/learn/three-bet` | 3벳이란 | 3-Bet 뜻 / 리레이즈 뜻 / 3베팅 | 학습형 | title '상대의 레이즈에 다시 레이즈 (3-Bet)', description "왜 두 번째 레이즈를 3-Bet이라고 부르는지, 그리고 그 상황에서 무엇이 달라지는지" | `blog/why-called-3bet`(양보), `glossary/three-bet`(양보), `glossary/four-bet`, `glossary/open-raise` |
| `/learn/equity` | 에퀴티란 | equity 뜻 / 포커 에퀴티 / 승률 개념 | 학습형 | title '내 승률은 몇 퍼센트일까? (Equity)', description "지금 이 패가 끝까지 갔을 때 팟에서 기대되는 몫을 뜻하는 말. 어떻게 세는지 예로 확인" | `/tools/equity`, `glossary/equity`(양보), `blog/qq-vs-ak`, `learn/pot-odds` |
| `/learn/pot-odds` | 팟오즈란 | 팟 오즈 뜻 / 콜 최소 승률 / 팟오즈 개념 | 학습형 | title '콜할 값어치가 있을까? 팟오즈', description "내야 하는 돈과 가져갈 수 있는 돈을 비교해, 콜에 필요한 최소 승률을 구하는 방법" | `/tools/pot-odds`, `glossary/pot-odds`(양보), `blog/pot-odds-quick`(양보), `learn/outs` |
| `/learn/outs` | 아웃츠란 | 아웃츠 세는 법 / 아웃 뜻 / 드로우 확률 | 학습형 | title '아직 남은 좋은 카드, 아웃츠', description "내 패를 완성시켜 주는 카드가 몇 장 남았는지 세고, 그 카드가 나올 확률을 구합니다" | `/tools/outs`, `glossary/outs`(양보), `glossary/draw`, `blog/outs-nine`(양보) |

#### 2-3. Blog 20개

블로그는 전부 **롱테일 질문형**을 가져간다(§3 원칙). 근거 컬럼은 레코드 `description` 원문.

| 라우트 | 1차 키워드 | 2차 보조 키워드 | 검색 의도 | 이 키워드를 주는 근거 | 내부링크로 받아야 할 페이지 |
|---|---|---|---|---|---|
| `/blog/aks-vs-ako` | AKs AKo 차이 | 수티드 오프수트 차이 / AK s o 뜻 / AK 무늬 차이 | 정보형 | "같은 A와 K인데 뒤에 붙는 s와 o가 무엇을 뜻하는지, 그리고 그 차이가 왜 생기는지" | `hands/aks`, `hands/ako`, `blog/is-ak-good`, `learn/starting-hands` |
| `/blog/next-best-after-aa` | AA 다음 좋은 패 | 프리플랍 상위 핸드 / KK QQ 순위 / AA 다음 강한 패 | 정보형 | "가장 강한 패는 AA로 정해져 있지만, 그다음은 어떤 패일까요. 순위표에서 직접 확인" | `hands/aa`·`kk`·`qq`, `learn/starting-hand-ranking`, `/tools/starting-hand` |
| `/blog/how-often-aa` | AA 받을 확률 | 포켓 에이스 확률 / AA 조합 수 / 포켓페어 확률 | 정보형 | "AA를 받을 확률이 얼마나 낮은지, 조합 수를 세어 직접 보여드립니다" | `hands/aa`, `glossary/combo`, `glossary/pocket-pair` |
| `/blog/is-ak-good` | AK 좋은 패인가 | AK 순위 / 빅 슬릭 / AK 프리플랍 | 정보형 | "AKs와 AKo가 순위표에서 어디에 있는지, 어느 자리에서 첫 레이즈로 쓰이는지" | `hands/aks`, `hands/ako`, `blog/aks-vs-ako`, `blog/qq-vs-ak` |
| `/blog/qq-vs-ak` | QQ vs AK 승률 | QQ AK 누가 유리 / 페어 대 오버카드 / QQ 승률 | 정보형 | "QQ가 AKs를 만났을 때와 AKo를 만났을 때, 승률이 어떻게 다른지 계산으로 직접 비교" | `hands/qq`, `learn/equity`, `/tools/equity` |
| `/blog/small-pocket-pairs` | 작은 포켓페어 | 22 33 강한가 / 로우 포켓페어 순위 / 작은 페어 가치 | 정보형 | "22나 33처럼 작은 포켓페어가 순위표에서 어디쯤 있는지 직접 확인" | `hands/22`·`77`·`88`, `glossary/pocket-pair`, `learn/starting-hand-ranking` |
| `/blog/why-72o-is-weak` | 72o 약한 이유 | 가장 약한 시작 패 / 72 오프수트 / 최악의 패 | 정보형 | "흔히 최악의 패로 꼽히는 72o가 실제로 순위표 어디에 있는지" | `learn/starting-hand-ranking`, `/tools/starting-hand`, `glossary/offsuit` |
| `/blog/why-suited-matters` | 수티드가 좋은 이유 | 같은 무늬 유리한 점 / 수티드 차이 / 플러시 가능성 | 정보형 | "같은 무늬 두 장이 다른 무늬일 때보다 무엇이 더 나아지는지" | `glossary/suited`(1차는 양보받음), `blog/aks-vs-ako`, `hands` 수티드 계열 |
| `/blog/flush-vs-straight` | 플러시 스트레이트 뭐가 높나 | 플러시가 더 센 이유 / 플러시 스트레이트 순위 | 정보형 | "두 족보 중 왜 플러시가 더 높은 순위인지, 나오는 빈도로 설명" | `learn/hand-rankings`, `glossary/flush`, `glossary/straight` |
| `/blog/full-house-vs-flush` | 풀하우스 플러시 뭐가 높나 | 풀하우스가 더 센 이유 / 풀하우스 순위 | 정보형 | "두 족보 중 왜 풀하우스가 더 높은 순위인지, 같은 근거로 설명" (§3 충돌 대상) | `learn/hand-rankings`, `glossary/full-house`, `blog/flush-vs-straight` |
| `/blog/btn-why-wide` | 버튼 레인지가 넓은 이유 | BTN 오픈 레인지 / 버튼 자리 유리 / 포지션과 레인지 | 정보형 | "같은 표인데 자리를 바꾸면 칠해진 칸이 늘어납니다. 그 이유를 행동 순서로 설명" | `learn/position`, `learn/positions-6max`, `/tools/range`, `glossary/button` |
| `/blog/same-pair-who-wins` | 같은 원페어 누가 이기나 | 원페어 동점 / 키커 비교 / 같은 족보 승자 | 정보형 | "둘 다 원페어를 만들었을 때 승부를 가르는 것이 무엇인지 실제 패로" | `blog/what-is-kicker`, `glossary/kicker`, `glossary/one-pair`, `/tools/hand-checker` |
| `/blog/what-is-kicker` | 키커 뜻 | kicker 포커 / 옆 카드 순위 / 키커 비교 | 정보형 | "순위를 가르는 옆 카드, 키커가 정확히 무엇을 뜻하는지" (§3 충돌 대상) | `glossary/kicker`(양보), `blog/same-pair-who-wins`, `learn/hand-rankings` |
| `/blog/playing-the-board` | 보드로 족보 완성 | 플레잉 더 보드 / 보드만으로 승부 / 팟 나눠 갖기 | 정보형 | "보드 다섯 장만으로 족보가 완성되어 팟을 나눠 갖는 경우를 실제 보드로" | `glossary/board`, `glossary/community-cards`, `glossary/split-pot`, `glossary/nuts`(고아 해소 대상) |
| `/blog/a2345-wheel` | A2345 스트레이트 | 휠 스트레이트 / A 낮은 쪽 스트레이트 / A2345 인정 | 정보형 | "A가 낮은 쪽 끝으로도 쓰이는 A2345 조합이 스트레이트로 인정되는지" | `glossary/straight`, `hands/a5s`, `learn/hand-rankings` |
| `/blog/outs-nine` | 아웃츠 9장 | 플러시 드로우 아웃 / 9 아웃 확률 / 아웃 9개 | 정보형 | "플러시를 기다릴 때 왜 하필 9장인지, 그 9를 어떻게 세는지" | `learn/outs`, `/tools/outs`, `glossary/draw`, `glossary/flush` |
| `/blog/why-blinds-exist` | 블라인드 왜 내나 | 빅 블라인드 이유 / 강제 베팅 / 블라인드 존재 이유 | 정보형 | "아무도 걸지 않으면 아무도 참여할 이유가 없다는 것을, 블라인드 규칙으로 설명" | `glossary/blind`, `glossary/big-blind`, `glossary/small-blind`, `glossary/ante`(고아 해소 대상), `learn/holdem-basics` |
| `/blog/why-called-3bet` | 왜 3벳이라 부르나 | 3-Bet 이름 유래 / 베팅 세는 법 / 3벳 어원 | 정보형 | "두 번째 레이즈를 왜 3-Bet이라 부르는지, 베팅을 세는 방식으로 설명" (§3 충돌 대상) | `learn/three-bet`(양보), `glossary/three-bet`, `glossary/four-bet` |
| `/blog/why-use-range` | 레인지로 보는 이유 | 상대 패 추측 / 레인지 사고 / 레인지 왜 쓰나 | 정보형 | "상대 패를 하나로 찍었을 때 무엇이 틀리는지, 레인지로 보면 무엇이 나아지는지" | `learn/poker-range`(양보), `/tools/range`, `glossary/range` |
| `/blog/pot-odds-quick` | 팟오즈 암산 | 팟오즈 빨리 계산 / 벳 크기별 팟오즈 / 팟오즈 3초 | 학습형 | "테이블에서 3초 안에 팟오즈를 계산하는 절차를 벳 크기별로" | `learn/pot-odds`(양보), `/tools/pot-odds`, `glossary/pot-odds` |

#### 2-4. Hands 20개

핸드 상세는 전부 같은 골격이다 — **조합 수 · 13×13 표 위치 · 강도 순위**(레코드 `description`
전수 확인). 따라서 1차 키워드는 `<핸드 표기>` 자체, 2차는 `<핸드> 조합 수` / `<핸드> 순위` /
`<핸드> 승률` 패턴을 공통으로 쓴다. 검색 의도는 20개 모두 **정보형**이다. 인바운드는 20개
모두 `/hands` 허브 + `/tools/starting-hand` + `/tools/equity`(`relatedTools` 고정 2개) +
이웃 핸드 상호참조를 기본으로 받는다.

| 라우트 | 1차 키워드 | 2차 보조 키워드 | 이 키워드를 주는 근거(레코드 description 발췌) | 추가로 받아야 할 인바운드 |
|---|---|---|---|---|
| `/hands/aks` | AKs | AKs 조합 수 / AK 수티드 / AKs 순위 | "A와 K를 같은 무늬로 받은 경우. 조합이 몇 가지인지, 표의 어디에 있는지" | `blog/aks-vs-ako`, `blog/is-ak-good` |
| `/hands/ako` | AKo | AKo 조합 수 / AK 오프수트 / AKo 순위 | "A와 K를 서로 다른 무늬로 받은 경우. 같은 무늬일 때와 무엇이 달라지는지" | `blog/aks-vs-ako`, `blog/is-ak-good` |
| `/hands/aa` | 포켓 AA | AA 조합 수 / 에이스 페어 순위 / AA 승률 | "A 두 장을 받은 경우. 169가지 시작 패 중 이 패가 어디에 자리하는지" | `blog/how-often-aa`, `blog/next-best-after-aa` |
| `/hands/kk` | 포켓 KK | KK 순위 / K 페어 조합 수 | "K 두 장을 받은 경우. 에이스 페어 다음 순위가 어디쯤인지" | `blog/next-best-after-aa` |
| `/hands/qq` | 포켓 QQ | QQ 순위 / QQ AK 비교 / Q 페어 조합 | "Q 두 장을 받은 경우. AK와 자주 비교되는 이 패가 순위표에서 어디에" | `blog/qq-vs-ak` |
| `/hands/jj` | 포켓 JJ | JJ 순위 / J 페어 조합 수 | "J 두 장을 받은 경우. 포켓 페어가 표 대각선에서 어떻게 이어지는지" | `learn/hand-matrix` |
| `/hands/tt` | 포켓 TT | TT 순위 / 10 페어 조합 수 | "10 두 장을 받은 경우. 중간 크기 포켓 페어가 표에서 어디쯤" | `glossary/pocket-pair` |
| `/hands/99` | 포켓 99 | 99 순위 / 9 페어 조합 수 | "9 두 장을 받은 경우. 이 정도 포켓 페어의 조합 수와 순위" | `blog/small-pocket-pairs` |
| `/hands/88` | 포켓 88 | 88 순위 / 8 페어 조합 수 | "8 두 장을 받은 경우. 이 정도 포켓 페어의 조합 수와 순위" | `blog/small-pocket-pairs` |
| `/hands/77` | 포켓 77 | 77 순위 / 7 페어 조합 수 | "7 두 장을 받은 경우. 이 정도 포켓 페어의 조합 수와 순위" | `blog/small-pocket-pairs` |
| `/hands/22` | 포켓 22 | 22 순위 / 가장 작은 포켓페어 | "2 두 장을 받은 경우. 가장 작은 포켓 페어가 표에서 어디에" | `blog/small-pocket-pairs` |
| `/hands/aqs` | AQs | AQs 조합 수 / AQ 수티드 순위 | "A와 Q를 같은 무늬로 받은 경우. AK와 비교해 조합과 순위가 어떻게 다른지" | `hands/aks`, `blog/aks-vs-ako` |
| `/hands/aqo` | AQo | AQo 조합 수 / AQ 오프수트 순위 | "A와 Q를 서로 다른 무늬로 받은 경우. 같은 숫자의 수티드 패와 무엇이 달라지는지" | `blog/why-suited-matters` |
| `/hands/ajs` | AJs | AJs 조합 수 / A 수티드 순위 | "A와 J를 같은 무늬로 받은 경우. 에이스가 들어간 수티드 패의 위치" | `glossary/suited` |
| `/hands/kqs` | KQs | KQs 조합 수 / 브로드웨이 수티드 | "K와 Q를 같은 무늬로 받은 경우. 두 브로드웨이 카드가 만나면 순위가" | `hands/kjs`, `hands/qjs` |
| `/hands/kjs` | KJs | KJs 조합 수 / KJ 수티드 순위 | "K와 J를 같은 무늬로 받은 경우. 이 패의 조합 수와 순위" | `hands/kqs` |
| `/hands/qjs` | QJs | QJs 조합 수 / QJ 수티드 순위 | "Q와 J를 같은 무늬로 받은 경우. 연달아 있는 두 카드가 표에서 어디에" | `hands/jts`, `glossary/suited` |
| `/hands/jts` | JTs | JTs 조합 수 / 수티드 커넥터 | "J와 10을 같은 무늬로 받은 경우. 연달아 있는 두 카드가 표에서 어디에" | `hands/t9s`, `learn/starting-hands` |
| `/hands/t9s` | T9s | T9s 조합 수 / 커넥터 뜻 / 109 수티드 | "10과 9를 같은 무늬로 받은 경우. 커넥터라 불리는 패의 순위" | `hands/jts`, `learn/starting-hands` |
| `/hands/a5s` | A5s | A5s 조합 수 / A5 수티드 / 휠 에이스 | "A와 5를 같은 무늬로 받은 경우. 숫자 차이가 큰 에이스 수티드 패의 위치" | `blog/a2345-wheel`, `glossary/straight` |

#### 2-5. Glossary 58개 (압축 표)

기본 패턴은 **`<한국어 표기> 뜻`** 이다. 근거: 각 레코드의 `aliases` 필드가 이미 한국어 표기를
보유하고 있고(예: `c-bet`의 `aliases: ['씨벳','시벳','cbet','continuation bet','컨티뉴에이션 벳']`),
`title`이 전부 `<쉬운 한국어 설명> (<원어>)` 형태라 페이지 자체가 "이 말이 무슨 뜻인가"에만
답한다. 검색 의도는 58개 전부 **정보형**이다. 인바운드는 전부 `/glossary` 허브 + 해당 용어가
실제로 등장하는 상위 콘텐츠의 `<Term>` 팝오버/`relatedConcepts`로 받는다.

| 용어 | slug | 1차 키워드 | | 용어 | slug | 1차 키워드 |
|---|---|---|---|---|---|---|
| Position | position | 포지션 뜻 | | Range | range | 레인지 뜻 |
| Open Raise | open-raise | 오픈 레이즈 뜻 | | Suited | suited | 수티드 뜻 |
| Action | action | 액션 뜻 | | Offsuit | offsuit | 오프수트 뜻 |
| All-in | all-in | 올인 뜻 | | Pocket Pair | pocket-pair | 포켓페어 뜻 |
| Ante | ante | 앤티 뜻 | | Combo | combo | 콤보 뜻 |
| Blind | blind | 블라인드 뜻 | | Preflop | preflop | 프리플랍 용어 |
| Big Blind | big-blind | 빅 블라인드 뜻 | | Hand | hand | 핸드 뜻 |
| Small Blind | small-blind | 스몰 블라인드 뜻 | | Board | board | 보드 뜻 |
| Button | button | 버튼 BTN 뜻 | | Community Cards | community-cards | 커뮤니티 카드 뜻 |
| Cutoff | cutoff | 컷오프 CO 뜻 | | Flop | flop | 플랍 뜻 |
| Hijack | hijack | 하이잭 HJ 뜻 | | Turn | turn | 턴 뜻 |
| UTG | utg | UTG 뜻 | | River | river | 리버 뜻 |
| Stack | stack | 스택 뜻 | | Hand Ranking | hand-ranking | 족보 용어 |
| Pot | pot | 팟 뜻 | | High Card | high-card | 하이카드 뜻 |
| Check | check | 체크 뜻 | | One Pair | one-pair | 원페어 뜻 |
| Call | call | 콜 뜻 | | Two Pair | two-pair | 투페어 뜻 |
| Bet | bet | 벳 뜻 | | Three of a Kind | three-of-a-kind | 트리플 뜻 |
| Raise | raise | 레이즈 뜻 | | Straight | straight | 스트레이트 뜻 |
| Fold | fold | 폴드 뜻 | | Flush | flush | 플러시 뜻 |
| Limp | limp | 림프 뜻 | | Full House | full-house | 풀하우스 뜻 |
| 3-Bet | three-bet | 3벳 용어 | | Four of a Kind | four-of-a-kind | 포카드 뜻 |
| 4-Bet | four-bet | 4벳 뜻 | | Straight Flush | straight-flush | 스트레이트 플러시 뜻 |
| C-Bet | c-bet | 씨벳 뜻 | | Kicker | kicker | 키커 용어 |
| Bluff | bluff | 블러프 뜻 | | Split Pot | split-pot | 스플릿 팟 뜻 |
| Heads-Up | heads-up | 헤즈업 뜻 | | Hand Matrix | hand-matrix | 핸드 매트릭스 뜻 |
| Showdown | showdown | 쇼다운 뜻 | | Draw | draw | 드로우 뜻 |
| VPIP | vpip | VPIP 뜻 | | Outs | outs | 아웃 용어 |
| PFR | pfr | PFR 뜻 | | Equity | equity | 에퀴티 용어 |
| | | | | Pot Odds | pot-odds | 팟오즈 용어 |
| | | | | Nuts | nuts | 넛츠 뜻 |

**패턴에서 벗어나는 예외 9건**

1. `hand-matrix`, `range`, `preflop`, `hand-ranking`, `outs`, `equity`, `pot-odds` — 이 7개는
   `<용어> 뜻` 머리 키워드를 learn 레슨에 양보한다(§3). 글로서리 쪽은 `… 용어` 형태의 순수
   사전 조회 질의만 가져간다.
2. `kicker` — `키커 뜻`은 `blog/what-is-kicker`가 가져간다(§3). 글로서리는 `키커 용어`.
3. `three-bet` — `3벳 뜻`은 `learn/three-bet`, `왜 3벳이라 부르나`는 `blog/why-called-3bet`이
   가져간다. 글로서리는 `3벳 용어`만 남긴다.
4. `blind` / `big-blind` / `small-blind` 3형제 — 상위어 `블라인드 뜻`은 `blind`가 소유하고,
   BB/SB는 각자 약어 질의(`빅 블라인드 뜻`, `스몰 블라인드 뜻`)만 가져간다.
5. `board` ↔ `community-cards` — 두 페이지가 사실상 같은 대상을 가리킨다(`title`: "테이블 가운데
   깔린 카드" vs "모두가 같이 쓰는 카드"). `board`가 짧은 상위어를, `community-cards`가 원어
   표기 질의를 갖는다. §3에서 다시 다룬다.
6. `vpip` / `pfr` — 유일하게 "용어 설명"이 아니라 **통계 지표**다. 이 사이트에는 이 지표를
   계산하거나 보여주는 화면이 없으므로, 지금 상태에서 상위 노출을 기대하지 말고 사전 항목으로만
   유지한다(신규 기능 제안 아님, 기대치 조정).
7. `bluff` — 전략 조언성으로 보일 수 있으나, 레코드 `description`이 "블러프가 무엇을 뜻하는
   말인지 설명합니다. **언제 해야 하는지는 다루지 않습니다**"라고 스스로 범위를 못박고 있다.
   순수 정의 키워드만 배정한다.
8. `c-bet` — 위와 동일하게 `shortDefinition`이 "얼마나 자주 하는 것이 좋은지는 이 사이트가
   다루지 않습니다"라고 명시. 정의 키워드만.
9. `nuts` — 한국어 표기가 `넛`/`넛츠`/`너츠`/`최강패`로 갈린다(`aliases` 확인). 1차는 `넛츠 뜻`,
   본문에 나머지 표기를 자연스럽게 포함시키는 쪽이 낫다.

---

### 3. 키워드 카니발라이제이션 점검

**원칙(확정).** ① 개념의 "뜻/원리"를 설명하는 **learn 레슨**이 머리 키워드를 갖는다. ②
**툴**은 "계산기/표"처럼 도구를 찾는 질의만 갖는다. ③ **글로서리**는 한 줄 사전 조회 질의만
갖는다. ④ **블로그**는 구체적 질문형 롱테일만 갖는다. ⑤ **양보하는 쪽은 본문에서 이긴 쪽을
명시적으로 링크한다**(관계 필드만이 아니라 문장 안 링크로).

| # | 충돌 페이지 | 겹치는 의도 | 승자(머리 키워드) | 양보하는 쪽이 갖는 것 | 양보 쪽이 걸어야 할 링크 |
|---|---|---|---|---|---|
| C1 | `blog/why-called-3bet` ↔ `learn/three-bet` ↔ `glossary/three-bet` | "3벳 뜻" | **`learn/three-bet`** — 개념·상황·이후 변화를 전부 설명하는 유일한 페이지 | 블로그: `왜 3벳이라 부르나`(어원 한정). 글로서리: `3벳 용어` | 블로그 도입부와 글로서리 `nextLessons` 모두 `learn/three-bet`으로 |
| C2 | `blog/full-house-vs-flush` ↔ `blog/flush-vs-straight` | 족보 상하 비교(두 글 문단 구조가 거의 동일) | **`blog/flush-vs-straight`** — 초보가 실제로 더 많이 헷갈리는 인접 쌍이고, "빈도로 설명"이라는 근거 틀을 먼저 세운다 | `풀하우스 플러시 뭐가 높나`만. 공통 상위어 `포커 족보 순서`는 **둘 다 포기하고 `learn/poker-hand-rankings`가 가져감** | 두 글 모두 상단에서 `learn/poker-hand-rankings`로, 서로를 `relatedArticles`로 상호 링크 |
| C3 | `glossary/hand-matrix` ↔ `learn/hand-matrix` | "13×13 표" | **`learn/hand-matrix`** — 대각선/위/아래를 실제로 읽는 법을 가르침 | 글로서리: `핸드 매트릭스 뜻`(원어 표기 조회) | 글로서리 본문에서 `learn/hand-matrix`로 |
| C4 | `learn/poker-range` ↔ `glossary/range` ↔ `/tools/range` ↔ `blog/why-use-range` | "레인지" 4파전 | **`learn/poker-range`**(개념) / **`/tools/range`**(`핸드레인지 표` 도구 질의) 2분할 | 글로서리 `레인지 뜻`, 블로그 `레인지로 보는 이유` | 글로서리·블로그 모두 `learn/poker-range` + `/tools/range` 병기 |
| C5 | `learn/pot-odds` ↔ `glossary/pot-odds` ↔ `/tools/pot-odds` ↔ `blog/pot-odds-quick` | "팟오즈" 4파전 | **`learn/pot-odds`**(개념) / **`/tools/pot-odds`**(`팟오즈 계산기`) 2분할 | 글로서리 `팟오즈 용어`, 블로그 `팟오즈 암산` | 블로그는 개념 설명을 반복하지 말고 `learn/pot-odds` 링크로 대체 |
| C6 | `learn/outs` ↔ `glossary/outs` ↔ `/tools/outs` ↔ `blog/outs-nine` | "아웃츠" 4파전 | **`learn/outs`**(개념) / **`/tools/outs`**(`아웃츠 계산기`) 2분할 | 글로서리 `아웃 용어`, 블로그 `아웃츠 9장` | 블로그는 "왜 9인가"만 남기고 세는 법 일반론은 `learn/outs`로 |
| C7 | `learn/equity` ↔ `glossary/equity` ↔ `/tools/equity` | "에퀴티/승률" | **`learn/equity`**(개념) / **`/tools/equity`**(`포커 승률 계산기`) 2분할 | 글로서리 `에퀴티 용어` | 글로서리 본문에서 `learn/equity`로 |
| C8 | `learn/hand-rankings` ↔ `glossary/hand-ranking` ↔ `/tools/hand-checker` ↔ `/practice/hand-ranking-quiz` | "족보" 4파전 | **`learn/poker-hand-rankings`** — 순서 전체를 그림으로 정리하는 원본 | 툴 `포커 족보 확인`, 퀴즈 `족보 퀴즈`, 글로서리 `족보 용어` | 툴/퀴즈/글로서리 전부 레슨으로 되돌리는 링크 유지(툴·퀴즈는 이미 있음) |
| C9 | `learn/starting-hand-ranking` ↔ `/tools/starting-hand` ↔ `/hands` 허브 | "시작 패 순위" 3파전 | **`learn/starting-hand-ranking`**(`시작 패 순위`) / **`/tools/starting-hand`**(`시작 핸드 순위표` 도구) 2분할 | `/hands` 허브는 `홀덤 시작 핸드 목록`(개별 페이지 목록 탐색)만 | `/hands` 허브 인트로에 레슨·툴 링크 추가 |
| C10 | `learn/starting-hands` ↔ `learn/starting-hand-ranking` | 같은 섹션 내 인접 레슨(`order` 3↔4) | **`starting-hands`**=`시작 패 보는 법`(판단 기준) / **`starting-hand-ranking`**=`시작 패 순위`(줄 세우기) | 각자 명확히 분리 — 충돌 실질 낮음 | `nextLessons`로 이미 연결됨, 유지 |
| C11 | `learn/position` ↔ `learn/positions-6max` ↔ `glossary/position` ↔ `blog/btn-why-wide` | "포지션" 4파전 | **`learn/position`**(`포커 포지션`, 왜 중요한가) / **`learn/positions-6max`**(`6맥스 포지션 이름`, 자리 이름) 2분할 | 글로서리 `포지션 뜻`, 블로그 `버튼 레인지가 넓은 이유` | 글로서리·블로그 → `learn/position` |
| C12 | `learn/preflop` ↔ `glossary/preflop` | "프리플랍" | **`learn/preflop`** | 글로서리 `프리플랍 용어` | 글로서리 → 레슨 |
| C13 | `blog/what-is-kicker` ↔ `glossary/kicker` ↔ `blog/same-pair-who-wins` | "키커" 3파전 | **`blog/what-is-kicker`**(`키커 뜻`) — 이 개념만 다루는 유일한 페이지이며 learn에 대응 레슨이 없음 | 글로서리 `키커 용어`, `same-pair-who-wins`는 `같은 원페어 누가 이기나`(상황형) | 글로서리·`same-pair-who-wins` → `blog/what-is-kicker` |
| C14 | `blog/why-suited-matters` ↔ `glossary/suited` ↔ `blog/aks-vs-ako` | "수티드" 3파전 | **`blog/why-suited-matters`**(`수티드가 좋은 이유`) / **`glossary/suited`**(`수티드 뜻`) — 의도가 갈려서 분할 가능 | `aks-vs-ako`는 `AKs AKo 차이`(구체 핸드 한정) | `aks-vs-ako` → `why-suited-matters` |
| C15 | `blog/is-ak-good` ↔ `blog/aks-vs-ako` ↔ `hands/aks` ↔ `hands/ako` | "AK" 4파전 | **`blog/is-ak-good`**(`AK 좋은 패인가`) — 평가 질의 | `aks-vs-ako`는 `s와 o 차이`, hands 2개는 각 표기 자체 | 4개 상호 링크 유지(이미 `relatedHands`로 일부 연결) |
| C16 | `blog/small-pocket-pairs` ↔ `hands/22`·`77`·`88`·`99` | "작은 포켓페어" | **`blog/small-pocket-pairs`** — 묶어서 설명하는 유일한 페이지 | 개별 hands는 각자 `포켓 NN` 표기 질의 | 4개 hands가 `relatedArticles`로 이 글을 참조 |
| C17 | `blog/why-blinds-exist` ↔ `glossary/blind`/`big-blind`/`small-blind` | "블라인드" 4파전 | **`blog/why-blinds-exist`**(`블라인드 왜 내나`) / **`glossary/blind`**(`블라인드 뜻`) 2분할 | BB/SB는 약어 질의만 | BB/SB → `glossary/blind` → `blog/why-blinds-exist` 체인 |
| C18 | `glossary/board` ↔ `glossary/community-cards` | 같은 대상을 가리키는 사실상 중복 항목 | **`glossary/board`**(`보드 뜻`) | `community-cards`는 원어 표기 질의(`커뮤니티 카드 뜻`)만 | 두 항목이 서로를 `relatedConcepts`로 참조하고, 본문 첫 줄에서 "같은 것을 부르는 다른 이름"임을 밝힐 것 |
| C19 | `/` ↔ `/learn` | "홀덤 배우기" | **`/`**(`홀덤 배우기`) — 사이트 전체를 대표 | `/learn`은 `홀덤 기초`(커리큘럼 진입) | 홈 CTA "처음부터 배우기"가 이미 `/learn`으로 |
| C20 | `/tools/range` ↔ `/practice/range-quiz` | "레인지 + 포지션" | **`/tools/range`**(탐색) | 퀴즈는 `레인지 퀴즈`(연습) | 이미 상호 링크 존재 |

**요약**: 충돌 20건. 그중 완전 중복은 C2(블로그 두 글의 문단 구조 유사)와 C18(글로서리 두 항목이
같은 대상)뿐이고, 나머지 18건은 "learn=개념 / tool=도구 / glossary=사전 / blog=질문"의 4분할
규칙으로 전부 해소된다. **새 페이지를 만들 필요는 없고, 기존 페이지의 본문 도입부 한 문장과
관계 필드만 조정하면 된다.**

---

### 4. 내부링크 허브 구조 설계

#### 4-1. 현재 실측 (1B §3 기준)

- 고아 6건(전부 glossary), learn/blog/hands는 고아 0건.
- 허브 6곳 모두 자식 전량을 나열 — 하위 도달성 자체는 보장됨.
- 콘텐츠 → 툴: `RelatedContent`가 113개 전부에 존재. 추가로 blog 20 + learn 15 = **35개 MDX만**
  본문에 `<ToolCTA>` 인라인. **glossary 58 + hands 20 = 78개는 인라인 0건.**
- 툴 → 콘텐츠: 툴 6개와 퀴즈 3개가 각각 **레슨 1개**로만 되돌아간다(`contentById(...)` +
  `hrefOfContent` 패턴, `src/app/tools/*/page.tsx`·`src/app/practice/*/page.tsx`). `/tools` 허브
  자체는 콘텐츠 역링크 **0건**(grep 확인).
- 홈은 `glossaryPublished.slice(0, 6)`(`src/app/page.tsx:77,365`)로 **레지스트리 등록 순서**
  첫 6개를 노출.

#### 4-2. 목표 구조

```
                                   /  (홈)
                                   │
   ┌──────────┬──────────┬─────────┼─────────┬──────────┐
   │          │          │         │         │          │
/learn     /blog     /glossary   /hands    /tools    (푸터 전용) /about
   │          │          │         │         │
   │ 15       │ 20       │ 58      │ 20      │ 6 툴
   │          │          │         │         │
   └────┬─────┴────┬─────┴────┬────┴────┬────┘
        │          │          │         │
        └──────────┴──► /practice (4) ◄─┘
                    (모든 층에서 들어오고, learn·tools로만 나감)
```

**상하 관계 규칙**

1. `/learn`이 최상위 허브다. 나머지 4개 허브(`/blog` `/glossary` `/hands` `/tools`)는
   **`/learn`과 동급 형제**이지만, 그 자식들은 개념 설명이 필요할 때 반드시 `/learn/*`으로
   올라간다. 즉 링크 자산은 위로 흐르고 커리큘럼에 모인다.
2. `/practice`는 **허브가 아니라 종착점**이다. 5개 허브 어디서든 진입 가능하고, 나갈 때는
   `/learn/*`(개념 복습)과 `/tools/*`(직접 확인) 두 곳으로만 나간다. `/practice`에서 glossary나
   hands로 내려보내지 않는다 — 퀴즈를 푸는 사람은 사전을 찾는 사람이 아니다.
3. `/about`은 헤더에 넣지 않는다(헤더 5개 원칙 유지). 대신 **툴 6개와 퀴즈 3개의 "이 숫자는
   어디서 나왔나" 문구에서 `/about`으로 링크**한다 — 지금 `/about`은 푸터에서만 도달 가능한데,
   비제휴·숫자 출처를 밝히는 유일한 페이지가 그 정보를 가장 필요로 하는 계산기 화면에서
   연결되지 않는 것이 문제다.

**툴 → 콘텐츠 역링크 보강 (현재 각 툴 1개 → 3개로)**

`/tools` 허브에는 콘텐츠 역링크가 0건이고, 툴 상세는 레슨 1개씩만 갖는다. 다음을 추가한다.

| 툴 | 현재 링크 | 추가할 링크 2개 |
|---|---|---|
| `/tools/equity` | `learn/equity` | `blog/qq-vs-ak`, `glossary/equity` |
| `/tools/pot-odds` | `learn/pot-odds` | `blog/pot-odds-quick`, `glossary/pot-odds` |
| `/tools/outs` | `learn/outs` | `blog/outs-nine`, `glossary/draw` |
| `/tools/range` | `learn/poker-range` | `learn/hand-matrix`, `blog/btn-why-wide` |
| `/tools/starting-hand` | `learn/starting-hand-ranking` | `/hands` 허브, `blog/next-best-after-aa` |
| `/tools/hand-checker` | `learn/hand-rankings` | `blog/same-pair-who-wins`, `blog/playing-the-board` |
| `/tools` 허브 | **없음** | 각 툴 카드 아래 "이게 뭔지 모르겠다면" 형태로 대응 레슨 6개 링크 |

**glossary/hands 본문의 `<ToolCTA>` 0건 문제**

78개 MDX 전부에 인라인 CTA를 넣는 것은 반대한다 — glossary는 평균 2분짜리 정의 페이지이고,
정의 한 줄 뒤에 계산기 배너를 넣으면 사전으로서의 가독성이 깨진다. 대신 **툴이 실제로 그 용어를
계산해 주는 항목에만** 넣는다.

- glossary → `<ToolCTA>` 추가 대상 **9건**: `equity`, `pot-odds`, `outs`, `draw`(→ `/tools/outs`),
  `range`, `hand-matrix`(→ `/tools/range`), `hand-ranking`, `kicker`(→ `/tools/hand-checker`),
  `combo`(→ `/tools/starting-hand`). 나머지 49개는 하단 `RelatedContent`만으로 충분하다.
- hands 20개 → 본문 마지막의 "표에서의 위치" 문단 뒤에 `/tools/range` CTA 1개를 **공통 패턴으로**
  추가. 현재 `relatedTools`가 `toolStartingHand`/`toolEquity` 2개로 고정되어 있어 정작 그 핸드가
  13×13 표 어디에 있는지 눌러볼 경로가 본문 흐름에 없다.

**고아 6건의 인바운드 지정 (링크 농장 금지 — 그 단어가 실제로 등장하는 문서에서만)**

MDX 본문을 전수 grep해 각 단어가 실제로 나타나는 위치를 확인한 결과다.

| 고아 | 실제 등장 위치(grep 확인) | 인바운드를 받아야 할 페이지와 맥락 |
|---|---|---|
| `term-action` | 액션이 `content/glossary/` 22개 파일 + `content/blog/why-called-3bet.mdx` 본문에 등장 | **`learn/poker-actions`** — "내 차례에 고를 수 있는 행동은 다섯 가지"라는 첫 문단의 '행동' = 액션. 그 문장에서 `<Term id="term-action">` 처리 + `relatedConcepts`에 추가. 보조로 `glossary/check`·`glossary/fold` 본문의 "액션" 첫 등장 |
| `term-all-in` | 올인이 `glossary/stack.mdx`, `glossary/pot.mdx`, `glossary/bet.mdx`, `learn/starting-hand-ranking.mdx`, `blog/qq-vs-ak.mdx`, `blog/pot-odds-quick.mdx`, `blog/next-best-after-aa.mdx`에 등장 | **`glossary/stack`** — "내 앞의 칩" 정의에서 그 칩을 전부 거는 행위가 올인이므로 가장 자연스러운 상위→하위 연결. 보조로 `glossary/bet`, `learn/poker-actions` |
| `term-ante` | 앤티가 **`glossary/blind.mdx` 단 한 곳**에만 등장 | **`glossary/blind`** — "강제로 내는 돈" 정의에서 앤티를 같은 범주의 다른 강제 베팅으로 언급하는 그 문장. 보조로 `blog/why-blinds-exist`(강제 베팅이 왜 있는지 다루는 유일한 글)에 한 문장 추가 |
| `term-c-bet` | **자기 파일 외 등장 0건** | 링크만 억지로 만들면 링크 농장이 된다. `glossary/c-bet` 자신의 `nextLessons`가 이미 `flop-turn-river`를 가리키므로, **`learn/flop-turn-river` 본문에 "플랍에서 앞선 레이저가 이어 거는 베팅을 C-Bet이라 부른다"는 한 문장을 실제로 추가**하고 그 문장에서 링크한다(콘텐츠 작성 작업 — WP-5) |
| `term-bluff` | **자기 파일 외 등장 0건** | 동일. **`learn/poker-actions`**의 "베팅"을 설명하는 문단에 "지금 열면 이길 수 없는 패로 거는 베팅을 블러프라 부른다"는 정의 문장을 추가하고 그 자리에서 링크. (레코드 `nextLessons`가 이미 `poker-actions`를 향하고 있어 방향이 일치한다.) |
| `term-nuts` | **자기 파일 외 등장 0건** | 동일. **`blog/playing-the-board`** — 보드만으로 족보가 완성되는 상황을 다루는 글이라 "그 보드에서 나올 수 있는 가장 강한 패"라는 개념이 문맥상 정확히 필요한 유일한 문서. 여기에 한 문장 추가 후 링크 |

즉 **6건 중 3건(`action`,`all-in`,`ante`)은 관계 필드/`<Term>` 처리만으로 즉시 해소**되고,
**3건(`c-bet`,`bluff`,`nuts`)은 본문에 진짜 문장을 먼저 써야 한다**. 문장 없이 관계 필드만
채우는 것은 금지한다.

**홈 `glossaryPublished.slice(0, 6)` 문제와 대안**

- 문제: 이 6개는 편집 판단이 아니라 **`GLOSSARY_RECORDS = [...J1, ...J2]`의 배열 순서**다. 지금
  걸리는 6개는 `position`, `open-raise`, `action`, `all-in`, `ante`, `blind`인데 — `open-raise`,
  `action`, `all-in`, `ante`는 홀덤을 처음 켠 사람이 가장 먼저 찾는 말이 아니다. 반대로 `flop`,
  `pot`, `fold`처럼 첫 판에서 바로 만나는 단어는 홈에 안 나온다.
- 부작용: `action`/`all-in`/`ante` 3건이 "고아이지만 홈에서 링크받는" 우연한 상태가 되어, 그래프
  기준 고아 판정과 실제 도달성이 어긋난다. 배치 파일에 레코드를 하나 끼워 넣으면 홈 미리보기가
  조용히 바뀐다.
- 대안(확정 권고): **명시적 큐레이션 상수**로 교체한다.
  ```ts
  const HOME_GLOSSARY_PICKS = ['term-pot','term-fold','term-flop','term-blind','term-position','term-range'] as const;
  ```
  선정 기준은 "첫 한 판을 보는 데 필요한 말"이고, 레지스트리 순서와 독립적이다. 그리고 고아
  해소는 홈 slice에 기대지 말고 위 표대로 본문/관계에서 처리한다.

---

### 5. 현재 문제점

| 등급 | 문제 | 근거 |
|---|---|---|
| **blocker** | `SITE_ORIGIN`이 플레이스홀더 `https://fishtilt.example`로 고정. `NEXT_PUBLIC_SITE_URL`을 설정하는 `.env*`가 저장소에 없음. canonical · OG · twitter · sitemap URL이 전부 해석되지 않는 예약 도메인으로 생성된다 — 이 상태로 배포하면 색인 자체가 성립하지 않는다 | `src/lib/seo/site.ts:36`, `:58-59`, `:62`; 1A §3 "canonical / metadataBase / 사이트 URL" |
| major | 파비콘 부재. `public/`에 `og.png` 1개뿐이고 `src/app/`에 `icon.*`/`favicon.*` 컨벤션 파일도 없다(디렉터리 리스팅 확인). 탭·북마크·SERP에서 브랜드 식별 불가 | 1A §6; `apps/fishtilt/public/`, `apps/fishtilt/src/app/` 실제 목록 |
| major | 131개 페이지가 **전부 같은 OG 이미지**(7KB짜리 `og.png`) 하나를 공유. 페이지별 OG 없음, 사이트 전체 `next/image`/`<img>` 사용 0건, MDX 이미지 0건 | 1A §6, 1B §5-3 |
| major | `/blog`가 헤더에 없다. 블로그 20개 = 전체 페이지의 15%가 푸터 링크와 홈 1개 섹션에만 의존 | 1A §4; `src/lib/routes.ts:119` (`PRIMARY_NAV_IDS`에 `blog` 없음) |
| major | `/hands`도 헤더에 없다. 20개 핸드 페이지가 푸터 + `starting-hands` 계열 레슨의 `relatedHands`에만 의존 | 1A §4; `src/lib/routes.ts:132` (`FOOTER_NAV_IDS`) |
| major | 정적 라우트 18개(홈·허브 5·툴 6·퀴즈 4·검색·소개) 전부에 `Breadcrumbs`가 없고, 따라서 `BreadcrumbList` JSON-LD도 없다. 브레드크럼은 콘텐츠 상세 4개 템플릿에만 있음 | 1A §2, 1A "관측된 이상/공백" |
| major | `WebSite`·`Organization` JSON-LD 빌더가 코드베이스에 존재하지 않는다. 홈과 5개 허브가 방출하는 구조화 데이터가 0건 | 1A §3 "지원 JSON-LD 타입", 1A §2 |
| major | 고아 glossary 6건. 그중 `c-bet`/`bluff`/`nuts`는 `/glossary` 목록과 사이트 검색 외 진입로가 전혀 없다 | 1B §3-2, §"관측된 이상" 1 |
| major | 라이트 모드가 없다. `@theme` 색상 토큰 15개가 전부 다크 고정이고 `prefers-color-scheme`/`.dark` 분기가 0건 | 1A §5; `src/app/globals.css:81`(`@theme`), `:119`(`body`) |
| major | 카드 마크업 6배 중복. `HomeLinkCard`가 정확히 이 용도인데 홈만 쓰고, `/blog` `/learn` `/glossary` `/hands` `/tools` `/practice`가 className 문자열까지 동일한 마크업을 각각 재구현 | 1B §6; `blog/page.tsx:56-76`, `learn/page.tsx:65-84`, `glossary/page.tsx:60-79`, `hands/page.tsx:61-80`, `tools/page.tsx:27-59`, `practice/page.tsx:27-58` |
| major | learn 15개 · glossary 58개는 FAQ 후보 제목이 0건이라 `FAQPage`를 영구히 방출하지 못한다. 실제 방출은 blog 9 + hands 3 = 12개뿐 | 1B §4 |
| minor | `/tools` 허브의 콘텐츠 역링크 0건. 툴 상세 6개·퀴즈 3개도 레슨 **1개씩**만 되돌아간다 | 1B §3-4; `src/app/tools/*/page.tsx`의 `contentById(...)` 단일 호출, `src/app/tools/page.tsx` grep 결과 0건 |
| minor | glossary 58 + hands 20 = 78개 MDX에 `<ToolCTA>` 인라인 0건 (blog 20 + learn 15는 전부 사용) | 1B §3-4, §"관측된 이상" 5 |
| minor | 홈 글로서리 미리보기가 `glossaryPublished.slice(0, GLOSSARY_PREVIEW)`로 레지스트리 등록 순서 첫 6개를 노출 — 편집 판단이 아니라 배열 순서 | `src/app/page.tsx:77`, `:365` |
| minor | 헤더/푸터에 active state가 없다. `usePathname`/`aria-current`/활성 클래스 토글이 전무 | 1A §4 |
| minor | 모든 nav 링크가 `next/link`가 아닌 순수 `<a>`라 클라이언트 사이드 내비게이션이 아니라 풀 페이지 로드다(`nodenext` + ESM tsconfig에서 `next/link` 타입 해석 `TS2307` 때문) | `src/components/RouteNavItem.tsx:25-27` 주석 |
| minor | `<title>`과 렌더 H1이 다른 라우트 6개: `/`, `/about`, `/practice`, `/search`, `/tools/range`, `/tools/starting-hand` | 1A "관측된 이상/공백" |
| minor | `src/app/layout.tsx:26`의 fallback `title: '무료 홀덤 학습'`은 `src/app/page.tsx:55`가 자체 metadata를 export하므로 실제로는 렌더되지 않는다(코드상 판단). 주석과 실제가 어긋난 상태 | 1A §2 비고, `src/app/layout.tsx:23,26` |
| minor | `concepts` 태그 필드가 검색 인덱스에는 들어가지만 어떤 페이지 UI에도 렌더되지 않는다 | 1B §"관측된 이상" 6 |
| minor | `glossary/board` ↔ `glossary/community-cards`가 사실상 같은 대상을 가리키는 중복 항목 | `src/content/registry/glossary/j2.ts` 두 레코드 `title` 비교 |

---

### 6. 빠른 개선 우선순위

영향/비용 순 정렬. 비용은 "파일 수 × 판단 난이도"의 상대값이다.

| # | 항목 | 영향 | 비용 | 담당 WP |
|---|---|---|---|---|
| 1 | `NEXT_PUBLIC_SITE_URL`에 실제 도메인 주입 (canonical/OG/sitemap 전부 정상화) | 결정적 — 이게 없으면 나머지 SEO 작업 전부가 무효 | 최소(환경변수 1개) | **WP-7** |
| 2 | 헤더에 `/blog` 추가 — `PRIMARY_NAV_IDS` 한 줄(`routes.ts:119`) | 큼 — 블로그 20개(전체의 15%)의 인바운드 등급 상승 | 최소(1줄) | **WP-2** |
| 3 | 파비콘 추가 (`src/app/icon.png` + `apple-icon.png`) | 큼 — 탭/북마크/SERP 브랜드 식별 | 최소(파일 2개) | **WP-2** |
| 4 | 홈 `slice(0,6)` → `HOME_GLOSSARY_PICKS` 명시 큐레이션 | 중 — 홈 품질 + 그래프/도달성 불일치 제거 | 소 | **WP-3** |
| 5 | 홈에 `WebSite` + `Organization` JSON-LD 1회 방출 (빌더 신규) | 중 — 사이트 이름/브랜드 인식 | 소(빌더 1개 + 홈 1곳) | **WP-7** |
| 6 | 정적 18개 라우트에 `Breadcrumbs` 부착 (컴포넌트는 이미 존재) | 중 — 18개 페이지에 `BreadcrumbList` 동시 확보 | 소 | **WP-7** |
| 7 | 고아 3건(`action`,`all-in`,`ante`) 관계 필드 + `<Term>` 처리 | 중 — 고아 절반 즉시 해소 | 소 | **WP-7** |
| 8 | 툴 6개·퀴즈 3개 → 콘텐츠 역링크 1개 → 3개, `/tools` 허브에 레슨 링크 6개 | 중 — 툴 트래픽을 콘텐츠로 환류 | 소 | **WP-4** |
| 9 | 툴/퀴즈에서 `/about`으로 "숫자 출처" 링크 | 중 — E-E-A-T, `/about` 도달성 | 소 | **WP-4** |
| 10 | title↔H1 불일치 6곳 정리 (§5) | 소 — 스니펫 일관성 | 최소 | **WP-7** |
| 11 | nav active state(`aria-current` + 활성 스타일) | 소 — 접근성/현재 위치 인지 | 최소 | **WP-2** |
| 12 | 공통 `LinkCard` 추출 → 허브 6곳 교체 | 중 — 이후 모든 디자인 변경의 비용을 1/6로 | 중(6파일) | **WP-2** |
| 13 | 라이트 모드 — `@theme` 색상 토큰 15개 재정의 + 예외 3곳 처리 | 중 — 낮 시간 가독성, 스크린샷/공유 품질 | 중 | **WP-2** |
| 14 | glossary 9건 + hands 20건에 `<ToolCTA>` 인라인 | 중 — 78개 얕은 페이지의 체류/전환 | 중(29파일) | **WP-5** |
| 15 | 고아 3건(`c-bet`,`bluff`,`nuts`)을 위한 본문 문장 신규 작성 | 중 — 나머지 고아 해소 + 콘텐츠 밀도 | 중(3파일) | **WP-5** |
| 16 | learn 9곳에 진짜 FAQ 문단 신규 집필 (§7) | 중 — `FAQPage` 리치결과를 learn 섹션에 처음 도입 | 큼(집필) | **WP-7** |
| 17 | 툴 4곳 FAQ — MDX가 아닌 TSX라서 FAQ 훅 자체를 새로 만들어야 함 | 중 | 큼(메커니즘 + 집필) | **WP-7** |
| 18 | 블로그 카드 썸네일 · 대표 이미지 시스템 | 중 — `/blog` 목록이 현재 텍스트 3줄뿐 | 큼(자산 + 스키마 확장) | **WP-5** |
| 19 | 페이지별 OG 이미지 | 소~중 — 공유 시 식별 | 큼(한국어 폰트 자산 부재, `next/og`가 `nodenext`에서 `TS2307`) | **WP-6**(계획) → **WP-5**(구현) |
| 20 | 콘텐츠 다이어그램/일러스트 자산 계획 (MDX 이미지 현재 0건) | 중 — "눈으로 이해하세요"라는 홈 카피의 실현 | 큼 | **WP-6** |
| 21 | 최종 크로스 서피스 QA (131페이지 메타/링크/테마) | — | 중 | **WP-8** |

---

### 7. FAQ 전략

#### 7-1. 제약 확인 (변경 불가 전제)

FAQ는 별도 UI 컴포넌트가 아니라 **MDX 본문의 `##`/`###` 제목을 재파싱**하는 구조다
(`src/lib/seo/faq.ts`, `faqSource.ts`). 조건: `##` 제목이
`/자주\s*헷갈리|자주\s*묻는|자주\s*하는\s*질문/u`에 매칭하고, 그 아래 `###` Q&A가 **2개 이상**,
JSX가 섞인 답변은 드롭. 즉 **화면에 실제로 존재하는 문단만이 구조화 데이터가 된다.**

**따라서 "본문에 없는 Q&A를 JSON-LD로만 넣는 것"은 금지한다** — 구글 구조화 데이터 정책 위반이자
이 프로젝트의 "가짜 구현 금지" 규칙 위반이다. 질문은 **본문을 새로 쓰는 것**으로만 늘린다.

현재 방출: blog 9/20, hands 3/20, **learn 0/15, glossary 0/58**. 허브·툴·홈에는 훅 자체가 없다.

#### 7-2. 결정

| 대상 | 결정 | 이유 |
|---|---|---|
| learn 15개 중 **9개** | **진짜 FAQ 문단 신규 집필** | 레슨은 이미 2,000자급 본문을 갖고 있어 Q&A 3~4개를 덧붙여도 얇아지지 않고, 초보 질의를 가장 많이 받는 층이다 |
| 툴 **4개** (`pot-odds`,`outs`,`equity`,`range`) | 집필 + **FAQ 훅 신규 필요** | 툴은 TSX라 MDX 재파싱 경로를 못 쓴다. WP-7이 "화면에 렌더되는 Q&A 컴포넌트 → 같은 배열로 JSON-LD" 방식(현재 `Breadcrumbs`가 쓰는 것과 동일한 단일 소스 패턴)을 새로 만들어야 한다 |
| glossary 58개 | **FAQ 만들지 않음** | 2분짜리 정의 페이지에 억지 Q&A 2개를 붙이는 건 부풀리기다. 리치결과 대신 §4의 인바운드 보강과 브레드크럼으로 처리한다 |
| hands 20개 | **현행 유지(3건)** | 20개가 같은 골격이라 같은 FAQ를 20번 쓰면 중복 콘텐츠가 된다. 이미 있는 3건 외에 늘리지 않는다 |
| 허브 5개 · `/practice` · 홈 | **FAQ 만들지 않음** | 허브 본문에 진짜 Q&A 문단이 없고, 만들면 목록 페이지에 얇은 텍스트를 얹는 셈이 된다 |

#### 7-3. 새로 써야 할 실제 질문

초보가 실제로 던지고, **이 사이트가 이미 가진 근거로 답할 수 있는** 것만 골랐다. 각 질문 옆의
괄호는 그 답을 뒷받침하는 기존 페이지다.

**`/learn/holdem-basics`**
1. 텍사스 홀덤은 카드를 몇 장 받나요? (본 레슨 — 내 2장 + 공용 5장)
2. 한 판에 베팅은 몇 번 하나요? (`learn/flop-turn-river` — 프리플랍·플랍·턴·리버 4번)
3. 내 두 장을 반드시 다 써야 하나요? (`blog/playing-the-board` — 보드 5장만으로도 족보가 된다)
4. 딜러 버튼은 왜 매 판 옮겨 가나요? (`learn/positions-6max`, `glossary/button`)

**`/learn/poker-hand-rankings`**
1. 플러시와 스트레이트 중 뭐가 더 높나요? (`blog/flush-vs-straight`)
2. 풀하우스와 플러시 중에는요? (`blog/full-house-vs-flush`)
3. 같은 족보를 만들면 누가 이기나요? (`blog/what-is-kicker`, `blog/same-pair-who-wins`)
4. A2345도 스트레이트로 인정되나요? (`blog/a2345-wheel`)

**`/learn/starting-hands`**
1. 패 뒤에 붙는 s와 o는 무슨 뜻인가요? (`glossary/suited`, `glossary/offsuit`)
2. 같은 무늬면 정확히 무엇이 좋아지나요? (`blog/why-suited-matters`)
3. 포켓페어는 무조건 좋은 패인가요? (`blog/small-pocket-pairs`)
4. 가장 약한 시작 패는 무엇인가요? (`blog/why-72o-is-weak`)

**`/learn/hand-matrix`**
1. 13×13 표의 대각선은 무엇인가요? (본 레슨 — 포켓페어)
2. 대각선 위와 아래는 각각 무엇인가요? (본 레슨 — 수티드/오프수트)
3. 칸 하나는 몇 가지 조합인가요? (`glossary/combo`, hands 20개의 조합 수 서술)
4. 칠해진 칸은 무엇을 뜻하나요? (`/tools/range`)

**`/learn/poker-range`**
1. 왜 패 하나가 아니라 묶음으로 보나요? (`blog/why-use-range`)
2. 레인지가 넓다 / 좁다는 무슨 뜻인가요? (본 레슨)
3. 자리마다 레인지가 왜 다른가요? (`blog/btn-why-wide`)
4. 이 사이트에 나오는 레인지 숫자는 어디서 나온 건가요? (`/about` — 학습용 기본 레인지이고 어떤
   곳과도 제휴하지 않았다는 사실. `/practice/range-quiz` description이 이미 "학습용 기본
   레인지"라는 표현을 쓰고 있으므로 일관된다)

**`/learn/positions-6max`**
1. 6인 테이블의 여섯 자리 이름은 무엇인가요? (본 레슨)
2. UTG가 왜 가장 불리한 자리인가요? (`learn/position`)
3. 버튼이 왜 가장 좋은 자리인가요? (`blog/btn-why-wide`)
4. SB와 BB는 왜 카드를 보기 전에 돈을 내나요? (`blog/why-blinds-exist`)

**`/learn/pot-odds`**
1. 팟오즈는 무엇을 알려주는 숫자인가요? (본 레슨 — 콜에 필요한 최소 승률)
2. 팟오즈는 어떻게 계산하나요? (본 레슨 + `/tools/pot-odds`)
3. 팟에 이미 넣은 내 돈도 계산에 넣나요? (본 레슨)
4. 테이블에서 빨리 계산하는 방법이 있나요? (`blog/pot-odds-quick`)

**`/learn/outs`**
1. 아웃츠는 어떻게 세나요? (본 레슨)
2. 플러시 드로우의 아웃츠가 왜 하필 9장인가요? (`blog/outs-nine`)
3. ×2 / ×4 암산 규칙은 정확한가요? (`/tools/outs` — description이 "암산 규칙과 실제 확률의
   차이까지 함께 보여준다"고 명시)
4. 아웃츠가 두 종류로 겹치면 어떻게 세나요? (본 레슨)

**`/learn/equity`**
1. 에퀴티는 승률과 같은 말인가요? (본 레슨)
2. 두 패의 에퀴티는 어떻게 구하나요? (`/tools/equity`)
3. 보드가 열리면 에퀴티는 어떻게 바뀌나요? (`/tools/equity`)
4. QQ와 AK 중 어느 쪽 에퀴티가 높나요? (`blog/qq-vs-ak`)

**툴 4개 (WP-7이 훅을 만든 뒤)**

- `/tools/pot-odds`: ① 이 계산기는 무엇을 계산하나요 ② 결과의 %는 무슨 뜻인가요 ③ 팟에 이미 넣은
  내 돈도 포함되나요
- `/tools/outs`: ① 아웃츠를 어떻게 입력하나요 ② 턴과 리버의 확률이 왜 다른가요 ③ ×2/×4 규칙과
  실제 값은 얼마나 차이 나나요
- `/tools/equity`: ① 보드를 비워두면 무엇을 기준으로 계산하나요 ② 무승부(스플릿)는 어떻게
  반영되나요 ③ 이 숫자는 어디서 나온 건가요(`/about`)
- `/tools/range`: ① 여기 표시되는 레인지는 어디서 나온 건가요(`/about`) ② 두 포지션을 비교하면
  무엇을 볼 수 있나요 ③ 칠해진 칸의 색은 무슨 뜻인가요

---

## 변경 파일

| 파일 | 변경 |
|---|---|
| `docs/reports/FISHTILT_WP1_AUDIT_AND_KEYWORD_MAP.md` | 신규 — 이 문서 |

소스 코드 변경 0건.

## 테스트 / 검증

코드 변경 없음 — 검증은 두 감사 보고서(WP-1A, WP-1B)의 사실을 마스터가 코드로 재확인함.

보충 조사 과정에서 read-only로 확인한 항목: `src/lib/routes.ts:119`(`PRIMARY_NAV_IDS`),
`src/lib/seo/site.ts:36,58-59`(`SITE_ORIGIN` 플레이스홀더), `src/app/page.tsx:77,365`(홈 글로서리
slice), `src/components/RangeMatrix.tsx:104` 및 `RangeCompareMatrix.tsx:68,79`(`text-ground-900`),
`src/components/Term.tsx:94`(`backdrop:bg-black/60`), `apps/fishtilt/public/`(og.png 1개),
`src/app/`(icon/favicon 컨벤션 파일 없음), 툴 6개·퀴즈 3개의 `contentById(...)` 단일 레슨 링크,
`src/app/tools/page.tsx`의 콘텐츠 역링크 0건, 고아 6개 용어의 MDX 실제 등장 위치.

테스트/빌드/dev 서버는 실행하지 않았다(이 WP의 지시).

## SEO/UX 관점의 영향

- **키워드 소유권이 처음으로 1페이지 = 1키워드로 확정됐다.** 131개 중 색인 대상 130개(`/search`
  제외) 전부에 1차 키워드가 배정됐고, 20건의 충돌 각각에 승자와 양보 쪽이 명시됐다. 이후 WP는
  "이 페이지 제목/H1/도입부를 어떤 말에 맞출 것인가"를 다시 논의하지 않아도 된다.
- **신규 페이지 없이 개선한다는 것이 확인됐다.** 20건의 충돌 전부가 기존 페이지의 도입부 한
  문장과 관계 필드 조정으로 해소된다. 얇은 랜딩 페이지를 양산할 필요가 없다.
- **고아 6건의 처리 방식이 "링크 추가"가 아니라 "문장 먼저"로 정해졌다.** 3건은 즉시 관계 필드로
  해소, 3건은 본문 집필이 선행되어야 한다. 링크 농장을 만들지 않는다.
- **FAQ가 "구조화 데이터를 늘리는 일"이 아니라 "본문을 늘리는 일"로 재정의됐다.** learn 9곳 +
  툴 4곳에만 신규 집필을 배정하고 glossary 58개는 명시적으로 제외했다.
- **WP-2의 착수 비용이 정량화됐다.** 헤더 1줄, 파비콘 파일 2개, 라이트 모드는 토큰 15개
  재정의(+ 예외 3곳) — 전부 컴포넌트 대량 수정 없이 가능하다.

## 남은 이슈

1. **`NEXT_PUBLIC_SITE_URL`에 넣을 실제 도메인이 아직 결정되지 않았다.** 이 값이 정해지기 전에는
   WP-7의 SEO 검증(canonical/sitemap 실값 확인)이 성립하지 않는다. 오케스트레이터 결정 필요.
2. **본문 집필 WP의 소유자가 불명확하다.** 고아 3건 문장(`c-bet`,`bluff`,`nuts`)과 learn 9곳
   FAQ는 MDX 본문 작성 작업인데, Stage-2 WP 목록에는 콘텐츠 집필 전담 WP가 없다. 이 문서에서는
   FAQ를 WP-7, 고아 문장과 `<ToolCTA>` 인라인을 WP-5로 잠정 배정했으나 WP-5의 정의("블로그 ·
   썸네일 · 대표 이미지")와 정확히 일치하지는 않는다.
3. **툴 FAQ 훅은 신규 메커니즘이 필요하다.** 툴 페이지는 TSX라 현재의 MDX 재파싱 경로를 쓸 수
   없다. `Breadcrumbs`처럼 "같은 배열에서 화면 프로즈와 JSON-LD를 함께 파생"하는 컴포넌트를 새로
   만들어야 하며, 이는 WP-7의 범위가 커진다는 뜻이다.
4. **블로그 썸네일은 스키마 확장을 요구한다.** `ContentRecord`에 이미지 필드가 없다(1B §1-3).
   WP-5가 시작되기 전에 "썸네일을 레코드 필드로 둘 것인가, 파일명 규약으로 둘 것인가"를 먼저
   결정해야 한다. (날짜 필드는 추가하지 않는다 — 확정 결정.)
5. **`glossary/board` ↔ `community-cards` 중복은 통합이 아니라 역할 분리로 처리했다.** 병합이
   더 낫다는 판단이 나오면 별도 결정이 필요하다(이 문서는 병합을 제안하지 않는다).
6. **`vpip`/`pfr` 2개 용어는 사이트에 대응 기능이 없다.** 사전 항목으로 유지하되 상위 노출을
   기대하지 않는 것으로 처리했다. 신규 기능 제안은 하지 않는다.

## 다음 WP에 넘길 사실 요약

**WP-2가 즉시 착수 가능한 것 (전부 실측 확인됨)**

1. **헤더에 `/blog` 추가 = 한 줄 변경.** `apps/fishtilt/src/lib/routes.ts:119`의
   `export const PRIMARY_NAV_IDS = ['learn', 'range', 'tools', 'practice', 'glossary'] as const;`
   에 `'blog'`를 넣으면 된다. 라우트 레코드(`{ id: 'blog', path: '/blog', label: '블로그',
   available: true }`)는 이미 존재하고, `SiteHeader`/`RouteNavItem`은 이 배열만 읽는다.
   주의: 같은 파일의 주석이 "헤더는 의도적으로 5개"라고 명시하므로, 6개로 늘릴 거라면 그 주석도
   같이 갱신해야 한다. `/hands`도 같은 방식으로 넣을 수 있으나 이 문서는 `/blog`만 권고한다.
2. **라이트 모드는 컴포넌트 수정이 아니라 토큰 재정의로 가능하다.** `src/app/globals.css:81`의
   `@theme` 블록에 있는 **색상 토큰 15개**(`ground-900/800`, `panel-700/600`, `line-500`,
   `text-100/300/500`, `brand-500/600/950`, `suit-red-500`, `act-raise-500`, `act-call-500`,
   `act-fold-500`)를 라이트 세트로 재정의하면 된다. 마스터 확인: `.tsx` 69개 중 토큰을 벗어난
   하드코딩 색상은 `src/components/Term.tsx:94`의 `backdrop:bg-black/60` **1건뿐**이다.
3. **단, 토큰 반전 시 대비가 깨지는 3곳이 있다.** `src/components/RangeMatrix.tsx:104`
   (`IN_RANGE_CLASS = 'bg-act-raise-500 text-ground-900'`),
   `src/components/RangeCompareMatrix.tsx:68`(`SHARED_CLASS`)와 `:79`(`DIFFERS_CLASS`)의
   `text-ground-900`은 **액션 컬러로 채워진 칸 위에 얹히는 잉크**다. `--color-ground-900`을
   밝은 값으로 뒤집으면 주황/청록 채움 위에 밝은 글자가 올라가 읽히지 않는다. 이 3곳은 테마와
   무관한 고정 대비 토큰(예: `--color-on-action`)을 따로 만들어 분리해야 한다.
4. **허브 6곳의 카드 마크업이 중복이고 `HomeLinkCard`는 홈 전용이다.** `/blog`(`page.tsx:56-76`),
   `/learn`(`:65-84`), `/glossary`(`:60-79`), `/hands`(`:61-80`)는 인라인 JSX로, `/tools`
   (`:27-59` `ToolCard`)와 `/practice`(`:27-58` `PracticeQuizCard`)는 페이지 로컬 컴포넌트로
   같은 마크업을 재구현했다. className 문자열까지 동일하므로 공통 `LinkCard` 추출이 안전하다.
5. **파비콘이 없고 `public/`에는 `og.png` 1개뿐이다.** `apps/fishtilt/src/app/`에 `icon.*`/
   `favicon.*` 컨벤션 파일도 없다. 131개 페이지 전부가 같은 7KB OG 이미지를 공유하고, 사이트
   전체에 `next/image`/`<img>` 사용이 0건, MDX 이미지도 0건이다.

**WP-3 · WP-4 · WP-5 · WP-7이 이 문서에서 바로 가져갈 것**

- WP-3: 홈 `glossaryPublished.slice(0, GLOSSARY_PREVIEW)`(`src/app/page.tsx:77,365`)를
  `HOME_GLOSSARY_PICKS` 명시 상수로 교체 (§4-2 대안 참조).
- WP-4: 툴 6개·퀴즈 3개의 콘텐츠 역링크를 1개 → 3개로 (§4-2 표), 그리고 `/tools` 허브의 역링크
  0건 해소, 툴/퀴즈에서 `/about`으로 "숫자 출처" 링크.
- WP-5: 고아 3건(`c-bet`,`bluff`,`nuts`)의 본문 문장 신규 작성 (§4-2 표에 대상 문서와 문맥
  지정됨), glossary 9건 + hands 20건 `<ToolCTA>` 인라인.
- WP-7: `NEXT_PUBLIC_SITE_URL` 주입(**blocker**), `WebSite`/`Organization` 빌더 신규, 정적 18개
  라우트에 `Breadcrumbs`, 고아 3건 관계 필드, title↔H1 6곳, learn 9곳 FAQ 집필 + 툴 4곳 FAQ 훅.
</content>
</invoke>
