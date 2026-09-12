# 3BetTilt 콘텐츠 인벤토리 + 역할/깊이 감사 (WP-S3-02 Agent B)

- 대상: `apps/fishtilt/content/{learn,blog,glossary,hands}/*.mdx` + `apps/fishtilt/src/content/registry/**`
- 방식: read-only. 모든 수치는 스크래치 스크립트로 측정 (`scratchpad/inventory.ts` → `inventory.json`/`summary.json`, `records.txt`, `numrisk.mjs` → `numrisk.txt`, `faq.ts` → `faq.txt`, `ranks.ts`, `compact.txt`). 저장소 파일은 이 보고서 외에 아무것도 만들거나 고치지 않았다.
- 범위: 콘텐츠의 역할·깊이·정확성·구조·시각물·링크·결정. 키워드 타깃팅/카니벌라이제이션은 Agent A(`3BETTILT_KEYWORD_MAP.md`) 소관이며, 여기서는 "중복 의도" 후보만 표시한다.
- 근거 규칙: `src/content/threshold.ts`(floor), `allowList.ts`(MDX 허용 component 10개), `facts.ts`(FACT_NAMES 20개), `src/lib/seo/faq.ts`(FAQ 추출·`MIN_FAQ_ITEMS = 2`).

---

## 1. 인벤토리 (측정값)

### 1.1 레코드 수 · 상태

| kind | FS(.mdx) | registry | PUBLISHED | indexable | level 분포 |
|---|---|---|---|---|---|
| learn | 15 | 15 | 15 | 15 | INTRO 5 · BASIC 9 · INTERMEDIATE 1 (`three-bet`) |
| blog | 20 | 20 | 20 | 20 | INTRO 5 · BASIC 15 |
| glossary | 58 | 58 | 58 | 58 | INTRO 40 · BASIC 18 |
| hands | 20 | 20 | 20 | 20 | INTRO 20 |
| 합계 | 113 | 113 | 113 | 113 | — |

topic 분포 — blog: starting-hands 7 · hand-strength 6 · odds 2 · equity 1 · position 1 · rules 1 · betting 1 · range 1 (blog 허브는 `MIN_GROUP_ARTICLES = 2`라 equity/position/rules/betting/range 5편이 "한 편씩 있는 주제"로 묶임, `src/app/blog/page.tsx`). glossary: betting 16 · rules 13 · hand-strength 13 · position 5 · starting-hands 5 · odds 3 · range 2 · equity 1.

### 1.2 본문 길이 (`measureContent().proseCharacters`, `##` 섹션 수)

| kind | prose min / median / max (mean) | raw min / median / max | 섹션 min / median / max | threshold floor (prose / 섹션) |
|---|---|---|---|---|
| learn | 1506 / 1523 / 1656 (1546) | 2290 / 2537 / 3193 | 5 / 6 / 8 | 1500 / 4 |
| blog | 908 / 977.5 / 1142 (991) | 1174 / 1460 / 1879 | 3 / 3 / 7 | 900 / 3 |
| glossary | 400 / 436.5 / 577 (442) | 434 / 522 / 843 | 2 / 3 / 5 | 400 / 2 |
| hands | 605 / 644 / 887 (670) | 987 / 1086 / 1464 | 3 / 3 / 3 | 600 / 3 |

관찰: 네 kind 모두 min이 floor +0~6자, median이 floor +2~8%. 본문이 "floor를 넘기는 최소 길이"로 작성돼 있고, 검색 의도를 끝까지 답하는 깊이(정의·이유·예·데이터·비교·시각·FAQ·도구·관련)를 갖춘 글은 없다. 최장 blog(`outs-nine`, 1142자)도 Search Guide 기준으로는 얇다.

### 1.3 Component 사용 (여는 태그 기준; 파일 수 / 사용 횟수)

| component | 전체 | learn | blog | glossary | hands |
|---|---|---|---|---|---|
| Term | 112 / 251 | 15 | 20 | 57 | 20 |
| Fact | 62 / 409 | 10 (82) | 14 (109) | 18 (34) | 20 (184) |
| PokerCards | 53 / 112 | 12 | 14 | 26 | 1 (`aa`) |
| Callout | 49 / 51 | 13 | 16 | 0 | 20 |
| ToolCTA | 35 / 35 | 15 | 20 | 0 | 0 (템플릿 제공) |
| MiniQuiz | 15 / 15 | 15 | 0 | 0 | 0 |
| RangeMatrixMini | 10 / 13 | 6 | 2 | 2 | 0 (템플릿 `HandRangeHighlight`) |
| Figure | 5 / 5 | 2 | 3 | 0 | 0 |
| PotOddsFigure | 2 / 2 | 1 | 1 | 0 | 0 |
| OutsFigure | 2 / 2 | 1 | 1 | 0 | 0 |

`<Fact>` 총 409회, 이름별: HAND_RANK 70 · HAND_EQUITY_VS_RANDOM 64 · HAND_COMBOS 42 · HAND_ONE_IN_N 24 · CATEGORY_RANK 22 · HAND_TOP_SHARE 22 · HAND_CLASS_COUNT 22 · COMBOS_OF_KIND 20 · HAND_AT_RANK 19 · OUTS_PROB 19 · RFI_POSITIONS_WITH 15 · CLASSES_OF_KIND 13 · CATEGORY_FREQUENCY 13 · POT_ODDS_REQUIRED_EQUITY 11 · COMBO_COUNT 9 · HAND_SHARE 6 · EXACT_EQUITY 6 · CLASS_VS_CLASS_EQUITY 4 · RFI_COMBOS 4 · RFI_PERCENT 4. 20개 Fact 이름 전부 최소 1회 사용됨.

### 1.4 관계 필드 비어 있음 (레코드 수)

| kind | prerequisites | relatedConcepts | relatedTools | relatedHands | nextLessons | relatedArticles |
|---|---|---|---|---|---|---|
| learn (15) | 1 (`holdem-basics`) | 0 | 0 | 11 | 1 (`outs`) | 0 |
| blog (20) | 20 | 0 | 0 | 14 | — | 17 |
| glossary (58) | 58 | 0 | 0 | 56 | 0 | 41 |
| hands (20) | 20 | 0 | 0 | — | — | 11 |

### 1.5 inbound · 고아

- inbound 0(고아): 3 — `term-c-bet`, `term-bluff`, `term-nuts`.
- glossary inbound ≤1: 18 (action, all-in, ante, fold, limp, heads-up, vpip, pfr, hand, high-card, one-pair, two-pair, three-of-a-kind, four-of-a-kind, straight-flush + 고아 3). blog inbound ≤1: 4 (`is-ak-good`, `why-72o-is-weak`, `why-suited-matters`, `why-use-range`).
- tool inbound(관계 필드 기준): range 51 · toolStartingHand 35 · toolEquity 24 · toolOuts 13 · toolHandChecker 8 · toolPotOdds 6 · practice 3. glossary 58 중 41개가 `relatedTools: ['range']` 하나뿐이며, 이 중 check/call/bet/raise/fold/showdown/stack 등은 레인지 도구와 의미상 무관하다.

### 1.6 FAQ (실제 `extractFaqItems`, `MIN_FAQ_ITEMS = 2`)

learn 15/15 (66항목, 3–7개) · blog 5/20 (`outs-nine` 2, `pot-odds-quick` 3, `why-blinds-exist` 3, `why-called-3bet` 4, `why-use-range` 3; 나머지 15편은 "자주 헷갈리는 부분" H2 아래에 `###`가 없어 0) · glossary 0/58 · hands 0/20 (`22`, `a5s`는 "자주 묻는 것 — …"을 H2로 써서 추출 안 됨). 즉 FAQPage JSON-LD가 나가는 페이지는 20/113.

### 1.7 기타 측정

- ESM/H1 위반 0. Term 251회 전부 resolve(registry 테스트 통과 전제).
- "GTO"·"솔버"·"출처"·"교차 검증"·"전문가" 본문 0회. "재구성"·"시나리오" 0회(스토리 없음).
- 브랜드명 "FishTilt" 본문 등장 12개 glossary 파일(hijack, c-bet, limp, ante, pfr, vpip, four-bet, three-bet, cutoff, heads-up, call, utg) — 리브랜딩 시 치환 대상(섹션 N 소유자 참고).
- "169" 직접 타이핑 43회/13파일, "1,326" 1회(`learn/starting-hand-ranking.mdx:101` 퀴즈 옵션) — 모두 `HAND_CLASS_COUNT`/`COMBO_COUNT` Fact가 있는데 상수로 적음.

---

## 2. Blog 감사 (20편)

제안 콘텐츠 타입 라벨(한국어): **핸드 스토리** (Hand Stories) · **검색 가이드** (Search Guides) · **초보자 실수** (Beginner Mistakes) · **데이터와 확률** (Data & Probability) · **포커 개념·문화** (Poker Concepts/Culture).

현황 공통: 20편 모두 `prerequisites` 비어 있음, 17편 `relatedArticles` 비어 있음, 15편 FAQ 0, MiniQuiz 0, 저자/날짜 필드 없음(`BlogRecord`). 모든 편이 "질문 제목 → 3~7 H2 → ToolCTA" 동일 골격이라 learn과 시각적으로 구분되지 않는다(`WP_S3_00_BASELINE.md` §15). 결정 분포: RENAME 5 · DEEP EXPAND 4 · LIGHT EXPAND 8 · MERGE 1 · MOVE ROLE 2 · KEEP 0.

각 항목 형식: 현재 → 결정 · 타입 · 새 H1 · 새 의도 · 개요 · 시각 · tool · learn · glossary · FAQ · schema.

### B01 `/blog/aks-vs-ako` — "AKs와 AKo는 무슨 차이일까?"
- 현재: starting-hands · INTRO · 964자 · 3섹션 · PokerCards+Fact(HAND_COMBOS/RANK/EQUITY) · FAQ 0 · inbound 7. 의도: s/o 표기 차이 설명.
- **결정: RENAME** (+ 가벼운 보강). 제목이 "차이가 있냐"에 머물러 "얼마나"를 답하지 않음; 본문 데이터는 이미 충분한 편이라 제목·구조만 넓히면 됨.
- 타입: 검색 가이드 · H1: "AKs vs AKo 차이: 수티드가 실제로 얼마나 중요한가?" · 의도: 표기 뜻 + 순위/승률/조합 차이의 크기 + 언제 신경 써야 하나.
- 개요: ① 표기 읽는 법(PokerCards 두 장 나란히) ② 순위·승률 차이(Fact) ③ 조합 4 vs 12(Fact) ④ 13×13 위치(RangeMatrixMini) ⑤ 6-max RFI 포함 자리 비교(RFI_POSITIONS_WITH) ⑥ 흔한 오해 ⑦ FAQ ⑧ 도구·관련.
- 시각: PokerCards×2, ComparisonTable(순위/승률/조합/RFI), RangeEmbed. tool: toolStartingHand, toolEquity. learn: starting-hands, hand-matrix. glossary: suited, offsuit, combo.
- FAQ Y — "AKs가 AKo보다 항상 이기나요?", "차이가 몇 %면 큰 건가요?", "오프수트라도 AK는 좋은 패인가요?". schema: Article + FAQPage.

### B02 `/blog/next-best-after-aa` — "AA 다음으로 좋은 패는?"
- 현재: 1023자 · 3섹션 · HAND_AT_RANK 2~4위 · FAQ 0 · inbound 2. 의도: 2~4위 나열.
- **결정: DEEP EXPAND.** 순위 데이터(HAND_AT_RANK/HAND_EQUITY 1~20위)가 전부 Fact로 존재하는데 4위에서 끊겨 "데이터 글"이 되지 못함.
- 타입: 데이터와 확률 · H1: "AA 다음으로 강한 시작 패는? 상위 20위 순위표와 승률" · 의도: 상위 순위표를 한 번에 보고 각 패 페이지로 이동.
- 개요: ① 순위가 재는 것(HAND_EQUITY_VS_RANDOM 의미, 무승부 분할) ② 1~10위 DataTable(Fact) ③ 11~20위 ④ 왜 페어가 위에 몰리나 ⑤ 첫 비페어 AKs(8위) ⑥ 오해: 순위≠족보 ⑦ FAQ ⑧ 도구.
- 시각: DataTable(rank/hand/equity/combos), PokerCards(1~4위), RangeEmbed(상위 20 하이라이트). tool: toolStartingHand. learn: starting-hand-ranking. glossary: pocket-pair, equity, hand-matrix. FAQ Y — "KK와 QQ 차이는 큰가요?", "AK가 페어보다 위인 경우가 있나요?". schema: Article + FAQPage.

### B03 `/blog/how-often-aa` — "AA는 얼마나 자주 받을까?"
- 현재: 940자 · 3섹션 · HAND_COMBOS/COMBO_COUNT/HAND_ONE_IN_N · "6가지" 직접 타이핑(:11-31) · FAQ 0.
- **결정: LIGHT EXPAND.** 핵심 수치는 Fact로 안전하나 "다른 페어/AK도 같은 방식으로" 확장과 FAQ가 없음.
- 타입: 데이터와 확률 · H1: "AA를 받을 확률은? 조합 6가지로 계산하는 법" (숫자는 본문 Fact로 재확인) · 의도: 확률 + 계산 원리.
- 개요: ① 답 한 줄(QuickAnswer, HAND_ONE_IN_N) ② 6조합 그림(PokerCards 6쌍) ③ 1,326 중 비율(HAND_SHARE) ④ 다른 페어·AK와 비교(ComparisonTable) ⑤ 오해: "한동안 안 나왔으니 곧 나온다" ⑥ FAQ.
- 시각: PokerCards 6쌍, StatsRow. tool: toolStartingHand. learn: hand-matrix. glossary: combo, pocket-pair. FAQ Y — "한 세션에 AA를 몇 번 받나요?", "AK가 AA보다 자주 나오나요?". schema: Article + FAQPage.

### B04 `/blog/is-ak-good` — "AK는 좋은 패인가?"
- 현재: 1043자 · 3섹션 · HAND_RANK/AT_RANK/RFI_POSITIONS_WITH · inbound 1 · FAQ 0. 의도: AK 종합 평가.
- **결정: DEEP EXPAND.** AKs/AKo 두 핸드 페이지·`aks-vs-ako`·`qq-vs-ak`가 모두 이 글의 하위 질문인데, 허브 역할을 못 하고 inbound 1로 고립됨. (SEO 관점 중복은 Agent A 판단; 콘텐츠상 이 글을 허브로 승격 제안.)
- 타입: 검색 가이드 · H1: "AK는 좋은 패인가? 순위·자리·페어 상대 승률까지 한 번에" · 의도: AK 관련 모든 질문의 진입점.
- 개요: ① 한 줄 답 ② 순위 8/12위와 의미 ③ 수티드/오프수트 차이(→B01) ④ RFI 포함 자리 ⑤ 페어 상대 승률(CLASS_VS_CLASS_EQUITY QQ 한정) ⑥ 플랍에서 페어를 못 만들 때(개념만, 수치 없음) ⑦ 오해 ⑧ FAQ.
- 시각: PokerCards, StatsRow(순위/승률/조합), RangeEmbed(RFI). tool: toolStartingHand, toolEquity. learn: starting-hand-ranking, poker-range. glossary: suited, offsuit, hand-ranking. FAQ Y — "AK로 올인해도 되나요?"(답은 범위 밖 명시), "AK와 QQ 중 뭐가 좋나요?". schema: Article + FAQPage.

### B05 `/blog/qq-vs-ak` — "QQ와 AK 중 뭐가 강할까?"
- 현재: equity · 1039자 · CLASS_VS_CLASS_EQUITY(QQ|AKs, QQ|AKo) 유일 사용처 · FAQ 0.
- **결정: LIGHT EXPAND.** 유일한 frozen 대결 데이터라 확장 여지가 제한적이고, "코인플립" 통념과의 대비·FAQ만 추가하면 완성.
- 타입: 데이터와 확률 · H1: "QQ vs AK 승률: '코인플립'이라는 말은 맞을까?" · 의도: 대결 승률 + 왜 그 숫자인가.
- 개요: ① 한 줄 답(Fact) ② AKs/AKo 각각 ③ 왜 페어가 앞서나(아웃 개념) ④ "다른 페어 vs AK"는 이 사이트가 계산하지 않음(정직 고지) ⑤ 오해 ⑥ FAQ.
- 시각: PokerCards 대결(BoardCards 없이), StatsRow. tool: toolEquity. learn: equity. glossary: equity. FAQ Y — "JJ vs AK도 같나요?"(제공 안 함 명시), "AK가 이기면 어떻게 이기나요?". schema: Article + FAQPage.

### B06 `/blog/small-pocket-pairs` — "작은 포켓페어는 좋은 패일까?"
- 현재: 963자 · 5섹션 · 22 데이터 중심 · inbound 5 · FAQ 0.
- **결정: LIGHT EXPAND.** 22~66 다섯 페어의 순위·승률·RFI 자리가 전부 Fact로 가능한데 22만 다룸.
- 타입: 검색 가이드 · H1: "작은 포켓페어(22~66)는 좋은 패일까? 순위·조합·쓰이는 자리" · 개요: ① 답 ② 22~66 DataTable(HAND_RANK/EQUITY/RFI_POSITIONS_WITH) ③ 왜 승률은 절반인데 순위는 중간인가 ④ 셋 개념(수치 없음) ⑤ 오해 ⑥ FAQ.
- 시각: DataTable, RangeEmbed. tool: toolStartingHand, range. learn: starting-hand-ranking. glossary: pocket-pair, three-of-a-kind(셋). FAQ Y — "22는 항상 폴드인가요?", "66과 77 사이에 무슨 차이가 있나요?". schema: Article + FAQPage.

### B07 `/blog/why-72o-is-weak` — "72o가 약한 이유"
- 현재: 930자 · 7섹션(최다) · HAND_RANK 72o/32o · inbound 1 · FAQ 0. 본문이 이미 "진짜 최악은 32o"를 다룸(데이터 확인: 72o 165위, 32o 169위).
- **결정: RENAME.** 내용은 문화적 통념 교정 글인데 제목이 통념을 그대로 반복. 
- 타입: 포커 개념·문화 · H1: "72o가 최악의 패라는 말은 맞을까? 순위표 진짜 바닥은 따로 있다" · 개요: ① 통념의 출처(문화) ② 데이터로 본 72o 위치 ③ 실제 최하위 ④ 왜 서로 다른 답이 나오나(측정 기준) ⑤ 오해 ⑥ FAQ.
- 시각: PokerCards(72o, 32o), RangeEmbed(하위 강조), StatsRow. tool: toolStartingHand. learn: starting-hand-ranking. glossary: offsuit, hand-ranking. FAQ Y — "72o로 이길 수도 있나요?", "왜 72o가 유명한가요?". schema: Article + FAQPage.

### B08 `/blog/why-suited-matters` — "suited hand가 좋은 이유"
- 현재: 934자 · 6섹션 · J9/T8 비교 Fact · inbound 1 · 영문 제목 · NUMBER-RISK 2건(:25 "두 자리 % 안쪽", "예외 없이").
- **결정: RENAME.** 제목이 영문 혼용이고 "얼마나"를 묻지 않음; 데이터 확인 결과 78개 s/o 쌍 전부 suited 순위가 높아(`ranks.ts`, 위반 0) "예외 없이"는 사실이나 테스트로 고정 필요.
- 타입: 데이터와 확률 · H1: "수티드(같은 무늬)는 얼마나 중요한가? 같은 숫자 조합 전부 비교" · 개요: ① 답 ② 세 쌍 비교 DataTable ③ 차이의 크기(승률 % 포인트) ④ 왜 차이가 나나(플러시 가능성, 수치 없음) ⑤ 조합 4 vs 12 ⑥ 오해("수티드면 콜") ⑦ FAQ.
- 시각: ComparisonTable, PokerCards. tool: toolStartingHand. learn: starting-hands. glossary: suited, offsuit. FAQ Y — "수티드 커넥터는 뭔가요?"(용어 신설 후보), "수티드면 무조건 참여해도 되나요?". schema: Article + FAQPage.

### B09 `/blog/flush-vs-straight` — "플러시와 스트레이트 중 뭐가 강할까?"
- 현재: 908자(blog 최소) · 4섹션 · CATEGORY_RANK/COMBOS_OF_KIND · FAQ 0.
- **결정: LIGHT EXPAND.** 답은 한 줄이지만 "왜"를 뒷받침할 CATEGORY_FREQUENCY/CLASSES_OF_KIND Fact를 충분히 쓰지 않음. `full-house-vs-flush`와 골격이 동일 — 중복 의도 여부는 Agent A 판단.
- 타입: 검색 가이드 · H1: "플러시 vs 스트레이트: 어느 쪽이 이기고, 왜 더 드문가" · 개요: ① 한 줄 답 ② 카드 예시 ③ 조합 수·빈도 비교(Fact) ④ 같은 족보끼리 비교법 ⑤ 스트레이트 플러시 예외 ⑥ FAQ.
- 시각: PokerCards×2, StatsRow(빈도). tool: toolHandChecker. learn: hand-rankings. glossary: flush, straight, straight-flush. FAQ Y — "플러시끼리는 누가 이기나요?", "A2345 스트레이트도 같나요?". schema: Article + FAQPage.

### B10 `/blog/full-house-vs-flush` — "풀하우스와 플러시 중 뭐가 강할까?"
- 현재: 919자 · 4섹션 · B09와 동일 골격 · FAQ 0.
- **결정: LIGHT EXPAND.** B09와 같은 이유; 풀하우스끼리 비교(트리플 부분 우선) 규칙이 얇음.
- 타입: 검색 가이드 · H1: "풀하우스 vs 플러시: 순위와 빈도, 풀하우스끼리 비교하는 법" · 개요 B09와 대칭 + 풀하우스 내부 비교. 시각: PokerCards, StatsRow. tool: toolHandChecker. learn: hand-rankings. glossary: full-house, flush. FAQ Y — "풀하우스끼리는 어떻게 비교하나요?", "보드에 풀하우스가 깔리면?". schema: Article + FAQPage.

### B11 `/blog/btn-why-wide` — "BTN에서는 왜 더 많은 패를 사용할까?"
- 현재: position 유일 · 1044자 · RangeMatrixMini+RFI_PERCENT/COMBOS · relatedConcepts 7개(최다) · inbound 6 · FAQ 0.
- **결정: LIGHT EXPAND.** 데이터·링크는 좋으나 "마지막에 행동" 이유가 시각 없이 문장으로만 있고 FAQ 없음.
- 타입: 검색 가이드 · H1: "버튼(BTN)에서 왜 더 많은 패로 참여할까? 자리별 레인지 비교" · 개요: ① 답 ② 6자리 순서 그림(PositionDiagram) ③ UTG vs BTN 레인지 %(Fact) ④ 왜 늦게 행동하면 유리한가 ⑤ 오해("BTN이면 아무 패나") ⑥ FAQ.
- 시각: PositionDiagram(신규), RangeEmbed×2, StatsRow. tool: range. learn: position, positions-6max. glossary: button, position, open-raise. FAQ Y — "SB는 왜 BTN보다 좁나요?", "BTN 레인지는 몇 %인가요?". schema: Article + FAQPage.

### B12 `/blog/same-pair-who-wins` — "같은 원페어면 누가 이길까?"
- 현재: 939자 · 3섹션 · Fact 0 · `what-is-kicker`와 상호 링크 · FAQ 0.
- **결정: MERGE → B13 `what-is-kicker`.** 두 글 모두 "키커로 승부 결정"이 유일한 논지이고 예시 카드만 다르다; 하나의 키커 가이드가 두 질문을 모두 답할 수 있다(리다이렉트/canonical 처리는 Agent A와 조율).
- 타입: (흡수) · 흡수 후 H2 "같은 원페어면 누가 이기나요?"로 유지. 시각·링크는 B13에 통합.

### B13 `/blog/what-is-kicker` — "kicker란?"
- 현재: INTRO · 947자 · 4섹션 · Fact 0 · inbound 4 · FAQ 0.
- **결정: DEEP EXPAND** (B12 흡수). 키커는 초보 질문 1순위 개념인데 본문 4섹션·수치 0·영문 제목.
- 타입: 검색 가이드 · H1: "키커(Kicker)란? 같은 원페어·투페어에서 승부를 가르는 법" · 개요: ① 정의 한 줄 ② 원페어 예(B12 흡수) ③ 투페어·트리플에서 키커 ④ 키커가 안 쓰이는 경우(보드 5장, 스트레이트/플러시) ⑤ 스플릿 ⑥ 오해 ⑦ FAQ ⑧ HandChecker CTA.
- 시각: PokerCards+BoardCards 예시 3세트, ComparisonTable. tool: toolHandChecker. learn: hand-rankings. glossary: kicker, split-pot, one-pair, two-pair. FAQ Y — "키커가 두 장 다 같으면?", "플러시에도 키커가 있나요?". schema: Article + FAQPage.

### B14 `/blog/playing-the-board` — "보드만으로 족보가 완성되면?"
- 현재: 984자 · 4섹션 · Fact 0 · FAQ 0 · inbound 4.
- **결정: LIGHT EXPAND.** 개념은 명확; 스플릿 되는/안 되는 예를 카드 그림으로 나란히 보여주고 FAQ만 붙이면 됨.
- 타입: 검색 가이드 · H1: "보드 플레이(Playing the Board): 공용 카드만으로 족보가 되면 누가 이기나" · 개요: ① 답(스플릿) ② 스플릿 예 ③ 스플릿 아닌 예(키커 개입) ④ 규칙 근거(5장 최선) ⑤ FAQ. 시각: BoardCards+PokerCards 2세트. tool: toolHandChecker. learn: flop-turn-river, hand-rankings. glossary: board, split-pot, community-cards. FAQ Y — "보드 스트레이트인데 한 명이 더 높은 카드를 들면?", "스플릿이면 돈은 어떻게 나누나요?". schema: Article + FAQPage.

### B15 `/blog/a2345-wheel` — "A2345는 스트레이트인가?"
- 현재: 1013자 · 4섹션 · Fact 0 · FAQ 0.
- **결정: LIGHT EXPAND.** 답·반례가 있으나 "휠이 얼마나 강한가"가 문장으로만 있음; KQAn2 반례·휠 플러시 추가.
- 타입: 검색 가이드 · H1: "A2345(휠)는 스트레이트인가? 에이스가 낮게 쓰이는 경우와 아닌 경우" · 개요: ① 답 ② 휠 카드 ③ QKA23 불인정 ④ 휠 vs 다른 스트레이트 ⑤ 스틸 휠(A2345 플러시) ⑥ FAQ. 시각: PokerCards×3. tool: toolHandChecker. learn: hand-rankings. glossary: straight, straight-flush. FAQ Y — "휠과 브로드웨이 중 누가 이기나요?", "A가 위아래 동시에 쓰이나요?". schema: Article + FAQPage.

### B16 `/blog/outs-nine` — "아웃츠 9장은 무슨 뜻일까?"
- 현재: odds · 1142자(최장) · OutsFigure+OUTS_PROB(정확/SHORTCUT) · FAQ 2 · 9장/47장 직접 타이핑(:1,:27).
- **결정: RENAME.** 내용은 플러시 드로우 확률·콜 판단까지 답하는데 제목은 정의 질문에 머묾.
- 타입: 데이터와 확률 · H1: "아웃츠 9장 = 플러시 드로우: 완성 확률과 콜해도 되는지까지" · 개요: ① 답 ② 47장 그림 ③ 플랍/턴/리버 확률표(Fact) ④ ×4/×2 규칙 오차 ⑤ 팟오즈와 결합 예 ⑥ 오해 ⑦ FAQ(기존 2 + 1).
- 시각: OutsFigure, DataTable(street별). tool: toolOuts, toolPotOdds. learn: outs, pot-odds. glossary: outs, draw. FAQ Y — 기존 + "아웃 8장(양방 스트레이트)도 같은 방법인가요?". schema: Article + FAQPage(이미 충족).

### B17 `/blog/why-blinds-exist` — "Big Blind는 왜 돈을 먼저 내나?"
- 현재: rules 유일 · INTRO · 971자 · Fact 0 · FAQ 3 · inbound 5 · `relatedTools: range`(무관).
- **결정: MOVE ROLE → 포커 개념·문화.** 규칙 설명이 아니라 "왜 강제 베팅이 존재하는가"라는 문화·설계 이야기라 검색 가이드보다 개념 글이 맞음; tool 링크는 `practice` 또는 없음으로 교체.
- H1: "블라인드는 왜 있을까? 강제 베팅이 판을 움직이는 이유" · 개요: ① 답 ② SB/BB 순서 그림 ③ 없다면 어떻게 되나 ④ 앤티와 차이 ⑤ BB 자리의 특수성(옵션) ⑥ FAQ(기존 3). 시각: PositionDiagram, BettingTimeline. tool: (없음/practice). learn: holdem-basics, positions-6max. glossary: blind, big-blind, small-blind, ante. FAQ Y(기존). schema: Article + FAQPage.

### B18 `/blog/why-called-3bet` — "왜 3-Bet이라고 부를까?"
- 현재: betting 유일 · 1098자 · Term+ToolCTA만(시각 0) · FAQ 4 · `relatedTools: range`.
- **결정: MOVE ROLE → 포커 개념·문화.** 어원·세는 법 글이며 전략 글이 아님; 시각 0이라 BettingTimeline 1개 필수.
- H1: "3벳(3-Bet)은 왜 '3'일까? 벳을 세는 규칙과 4벳·5벳" · 개요: ① 답 ② 1BB→3BB→9BB 타임라인 ③ 4벳/5벳 ④ 프리플랍 외에서의 카운트 ⑤ "여기서 다루지 않는 것" 유지 ⑥ FAQ(기존 4). 시각: BettingTimeline. tool: (없음/practice). learn: three-bet, poker-actions. glossary: three-bet, four-bet, open-raise. FAQ Y. schema: Article + FAQPage.

### B19 `/blog/why-use-range` — "Range를 보는 이유"
- 현재: range 유일 · 984자 · RangeMatrixMini+Figure+RFI Fact · FAQ 3 · inbound 1.
- **결정: DEEP EXPAND.** 사이트 핵심 도구(`/tools/range`, inbound 51)의 개념 글인데 inbound 1·984자로 가장 얇은 허브. 
- 타입: 검색 가이드 · H1: "핸드 레인지란? 한 패로 찍지 않고 범위로 보는 이유와 읽는 법" · 개요: ① 정의 ② 한 패로 찍으면 틀리는 예 ③ 13×13 읽기 ④ 자리별 레인지 %(Fact) ⑤ 레인지는 "정답"이 아니라 학습용(6인·100BB·First In 한정 고지) ⑥ 오해 ⑦ FAQ ⑧ 도구.
- 시각: RangeEmbed×2, Figure. tool: range, practiceRange. learn: poker-range, hand-matrix. glossary: range, hand-matrix, open-raise. FAQ Y(기존 3 + "레인지는 누가 정하나요?"). schema: Article + FAQPage.

### B20 `/blog/pot-odds-quick` — "팟오즈 쉽게 계산하기"
- 현재: 1028자 · PotOddsFigure+POT_ODDS_REQUIRED_EQUITY(세 크기) · FAQ 3 · 벳 크기 직접 타이핑(:5,:15).
- **결정: RENAME.** 본문은 "세 벳 크기 필요 승률 표"가 핵심인데 제목이 그것을 드러내지 않음.
- 타입: 데이터와 확률 · H1: "팟오즈 계산법: 하프팟·2/3팟·풀팟에 필요한 승률 표" · 개요: ① 답(표) ② 계산 원리 그림 ③ 액수가 달라도 비율이 같으면 같은 답 ④ 아웃츠와 결합 ⑤ 애매한 크기는 도구로 ⑥ FAQ. 시각: PotOddsFigure, DataTable(3행), StatsRow. tool: toolPotOdds, toolOuts. learn: pot-odds. glossary: pot-odds, pot. FAQ Y(기존). schema: Article + FAQPage.

---

## 3. Learn 감사 (15편, 로드맵 순서)

공통: 15편 전부 FAQ(3~7) + MiniQuiz + ToolCTA + "자주 헷갈리는 부분" 보유 — 구조는 가장 일관됨. 빠진 것: 학습 목표/요약 블록 없음, 11편 `relatedHands` 비어 있음, `outs`는 `nextLessons` 없음(로드맵 종착), `positions-6max`·`three-bet`·`poker-actions`·`holdem-basics`는 결정적 다이어그램 없이 문장으로 순서·흐름을 설명. 결정 분포: DEEP EXPAND 4 · LIGHT EXPAND 11 · KEEP 0.

제안 카테고리(7): **게임 시작**(holdem-basics, poker-actions, flop-turn-river) · **카드와 족보**(hand-rankings) · **시작 패**(starting-hands, starting-hand-ranking) · **레인지**(hand-matrix, poker-range) · **포지션**(position, positions-6max) · **베팅**(preflop, three-bet) · **확률과 수학**(equity, pot-odds, outs). 인벤토리 topic과 1:1 대응 확인(rules→게임 시작, betting→베팅 등). "카드와 족보" 1편, "베팅" 2편은 소규모이므로 Stage 4 신규 레슨 후보 자리.

| # | slug | 의도 | 깊이(자/섹션/Fact) | 빠진 개념 | 필수 시각(결정적) | tool | glossary(현재/추가) | next | FAQ | 카테고리 | 결정 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | holdem-basics | 판 진행 순서 | 1608/8/0 | 딜러 버튼 이동, 스택 개념 | **HandTimeline**(프리플랍→쇼다운 6단계) | toolHandChecker | blind, big-blind, showdown, pot / +button, stack, community-cards | hand-rankings | 4 | 게임 시작 | DEEP EXPAND |
| 2 | poker-hand-rankings | 족보 순서 | 1547/6/9 | 같은 족보 내 비교 규칙(투페어·풀하우스) | 족보 10단계 PokerCards 계단(있음) + **ComparisonTable**(빈도, CATEGORY_FREQUENCY) | toolHandChecker, practice | 9개(충분) | starting-hands | 5 | 카드와 족보 | LIGHT EXPAND |
| 3 | starting-hands | 첫 두 장 읽기 | 1515/7/4 | 커넥터/갭/브로드웨이 이름 | PokerCards 3유형(있음) + **RangeEmbed** 위치 | toolStartingHand | suited, offsuit, pocket-pair / +hand, combo | starting-hand-ranking | 5 | 시작 패 | LIGHT EXPAND |
| 4 | starting-hand-ranking | 순위표 의미 | 1594/6/22 | 순위≠승률 보장 재강조 OK; "1,326" 상수(:101) | RangeEmbed(있음) + **StatsRow**(1위/8위/169위) | toolStartingHand, practice | combo, equity, hand-matrix | hand-matrix | 4 | 시작 패 | LIGHT EXPAND |
| 5 | hand-matrix | 13×13 읽기 | 1506/8/6 | **오류: `:24` KQs 무늬 조합 목록(§6)** | RangeEmbed(있음) + 조합 4/12/6 PokerCards | range, toolStartingHand | 5개(충분) | poker-range | 5 | 레인지 | LIGHT EXPAND (+오류 수정 선행) |
| 6 | poker-range | 레인지 개념 | 1573/6/5 | 레인지 = 학습용 한정(6인·100BB·First In) 고지 강화 | RangeEmbed×2(있음) | range, toolStartingHand, practice | 8개(충분) | position, three-bet | 4 | 레인지 | LIGHT EXPAND |
| 7 | position | 포지션 중요성 | 1507/6/1 | IP/OOP 용어 | **PositionDiagram**(6석 원형, 행동 순서 화살표) | range | position, button, utg / +cutoff, hijack | positions-6max | 4 | 포지션 | LIGHT EXPAND |
| 8 | positions-6max | 여섯 자리 이름 | 1513/5/0 | 자리별 RFI % 비교 수치(RFI_PERCENT 미사용) | **PositionDiagram** + RangeEmbed 6개 또는 DataTable | range | 8개(충분) | poker-actions | 4 | 포지션 | DEEP EXPAND |
| 9 | poker-actions | 다섯 행동 | 1514/6/0 | 올인, 체크-레이즈 | **BettingTimeline**(한 스트리트 액션 순서) | toolPotOdds | 8개(충분) | preflop | 4 | 게임 시작 | DEEP EXPAND |
| 10 | preflop | 프리플랍 흐름 | 1523/5/4 | 림프 vs 오픈 비교표 | BettingTimeline + RangeEmbed(있음) | range | 6개 / +vpip, pfr | flop-turn-river | 5 | 베팅 | LIGHT EXPAND |
| 11 | flop-turn-river | 카드 열리는 순서 | 1562/5/0 | 포스트플랍 용어, 47장 관례 | **BoardCards**(플랍 3/턴 1/리버 1 스트리트 묶음) | toolOuts | 6개(충분) | three-bet(순서 재검토) | 5 | 게임 시작 | LIGHT EXPAND |
| 12 | three-bet | 재레이즈 | 1539/5/0 · INTERMEDIATE | 3벳 레인지는 미지원 고지(First In만) | **BettingTimeline**(1→3→9→27BB) | range | 8개(충분) | equity | 5 | 베팅 | DEEP EXPAND |
| 13 | equity | 승률 개념 | 1519/5/3 | 무승부 분할 = "pot share" 의미 명시 | PokerCards 대결 + **StatsRow** | toolEquity | equity, split-pot, showdown | pot-odds | 4 | 확률과 수학 | LIGHT EXPAND |
| 14 | pot-odds | 콜 가치 | 1656/5/7 | 임플라이드 오즈(개념만, 수치 없음) | PotOddsFigure(있음) + DataTable | toolPotOdds | 4개(충분) | outs | 5 | 확률과 수학 | LIGHT EXPAND |
| 15 | outs | 아웃 세기 | 1516/5/13 | 더티 아웃(개념) | OutsFigure(있음) + street별 DataTable | toolOuts, toolEquity | outs, draw, pot-odds | **없음** → practice 또는 로드맵 종료 카드 | 5 | 확률과 수학 | LIGHT EXPAND |

비고: (a) `flop-turn-river → three-bet → equity` 순서는 "카드 열림 → 프리플랍 재레이즈 → 승률"로 주제가 튄다. 15편 순서 유지는 소유자 결정이므로 순서는 두되, 카테고리 브라우즈가 이를 보완한다. (b) `hand-rankings`가 `three-bet`보다 inbound 23으로 최다 — 카테고리 허브의 대표 레슨 후보. (c) DEEP EXPAND 4편은 모두 시각 0(Fact 0·Figure 0)인 레슨이다.

---

## 4. Glossary 감사 (58)

기준: 빠른 사전 = 한국어 이름 · 영어 alias · 동의어 · 한 줄 정의 · "쉽게 설명하면" · 예 · 관련 용어 · →Learn · →Tool · →Guide/Story. `term` 필드는 58개 전부 Latin(영어 이름 확보), `aliases`에 Latin 표기가 있는 것은 22개(36개 없음). "쉽게 설명하면"/"예로 보면" H2는 J2 배치(29개)에만 있고 J1 배치(29개: position·open-raise·action·all-in·ante·blind·big-blind·small-blind·button·cutoff·hijack·utg·stack·pot·check·call·bet·raise·fold·limp·three-bet·four-bet·c-bet·bluff·heads-up·showdown·vpip·pfr·range)에는 없다. `shortDefinition`은 58개 전부 존재하나 템플릿이 표시하지 않음(`src/app/glossary/[slug]/page.tsx`는 term+aliases만).

제안 카테고리(6): **게임 구조** · **베팅·액션** · **포지션** · **카드·족보** · **확률·수학** · **시작 핸드·레인지**.

| slug | 한국어 이름 | EN alias | 동의어≥3 | 정의 | 카테고리 | 관련용어 | inbound | lesson | tool(현재→제안) | 결정 |
|---|---|---|---|---|---|---|---|---|---|---|
| position | 포지션 | N | Y | OK | 포지션 | 1 | 6 | Y | range | LIGHT EXPAND |
| open-raise | 오픈 레이즈 | N | Y | OK | 베팅·액션 | 2 | 12 | Y | range | LIGHT EXPAND |
| action | 액션 | N | Y | WEAK(차례/행동 이중 의미) | 베팅·액션 | 3 | 1 | Y | range→practice | LIGHT EXPAND |
| all-in | 올인 | Y | Y | OK("다이렉트" alias 검토) | 베팅·액션 | 2 | 1 | Y | range→toolPotOdds | LIGHT EXPAND |
| ante | 앤티 | N | Y | OK | 게임 구조 | 1 | 1 | Y | range→없음 | LIGHT EXPAND |
| blind | 블라인드 | N | Y | OK | 게임 구조 | 3 | 5 | Y | range→없음 | LIGHT EXPAND |
| big-blind | 빅 블라인드 | Y | Y | OK | 게임 구조 | 2 | 9 | Y | range | LIGHT EXPAND |
| small-blind | 스몰 블라인드 | Y | Y | OK | 게임 구조 | 3 | 4 | Y | range | LIGHT EXPAND |
| button | 버튼 | Y | Y | OK | 포지션 | 1 | 8 | Y | range | LIGHT EXPAND |
| cutoff | 컷오프 | Y | Y | OK | 포지션 | 1 | 3 | Y | range | LIGHT EXPAND |
| hijack | 하이잭 | Y | Y | OK | 포지션 | 1 | 3 | Y | range | LIGHT EXPAND |
| utg | 언더 더 건 | Y | Y | OK | 포지션 | 1 | 7 | Y | range | LIGHT EXPAND |
| stack | 스택 | N | Y | OK | 게임 구조 | 1 | 2 | Y | range→toolPotOdds | LIGHT EXPAND |
| pot | 팟 | N | Y | OK | 게임 구조 | 2 | 4 | Y | toolPotOdds | LIGHT EXPAND |
| check | 체크 | N | N(2) | OK | 베팅·액션 | 2 | 2 | Y | range→practice | LIGHT EXPAND |
| call | 콜 | N | N(2) | OK | 베팅·액션 | 2 | 3 | Y | toolPotOdds | LIGHT EXPAND |
| bet | 베팅 | N | Y | OK | 베팅·액션 | 2 | 9 | Y | range→toolPotOdds | LIGHT EXPAND |
| raise | 레이즈 | N | Y | OK | 베팅·액션 | 2 | 3 | Y | range | LIGHT EXPAND |
| fold | 폴드 | N | Y | OK | 베팅·액션 | 1 | 1 | Y | range→practice | LIGHT EXPAND |
| limp | 림프 | N | Y | OK | 베팅·액션 | 1 | 1 | Y | range | LIGHT EXPAND |
| three-bet | 3벳 | Y | Y | OK | 베팅·액션 | 2 | 3 | Y | range | LIGHT EXPAND |
| four-bet | 4벳 | Y | Y | OK | 베팅·액션 | 1 | 2 | Y | range | LIGHT EXPAND |
| c-bet | 컨티뉴에이션 벳 | Y | Y | OK | 베팅·액션 | 2 | **0** | Y | range→없음 | LIGHT EXPAND (+inbound) |
| bluff | 블러프 | N | Y | OK | 베팅·액션 | 1 | **0** | Y | range→없음 | LIGHT EXPAND (+inbound) |
| heads-up | 헤즈업 | Y | Y | OK | 게임 구조 | 1 | 1 | Y | toolOuts→toolEquity | LIGHT EXPAND |
| showdown | 쇼다운 | N | Y | OK | 게임 구조 | 1 | 2 | Y | range→toolHandChecker | LIGHT EXPAND |
| vpip | VPIP | Y | Y | OK | 베팅·액션 | 2 | 1 | Y | range | LIGHT EXPAND |
| pfr | PFR | Y | Y | OK | 베팅·액션 | 3 | 1 | Y | range | LIGHT EXPAND |
| range | 레인지 | N | Y | OK | 시작 핸드·레인지 | 2 | 4 | Y | range | LIGHT EXPAND |
| suited | 수티드 | N | Y | OK | 시작 핸드·레인지 | 1 | 19 | Y | toolStartingHand | LIGHT EXPAND(alias) |
| offsuit | 오프수트 | N | Y | OK | 시작 핸드·레인지 | 1 | 11 | Y | toolStartingHand | LIGHT EXPAND(alias) |
| pocket-pair | 포켓 페어 | N | Y | OK | 시작 핸드·레인지 | 1 | 15 | Y | toolStartingHand | LIGHT EXPAND(alias) |
| combo | 콤보 | N | N(2) | OK | 시작 핸드·레인지 | 3 | 27 | Y | toolStartingHand | LIGHT EXPAND(alias) |
| preflop | 프리플랍 | N | Y | OK | 게임 구조 | 1 | 6 | Y | range | LIGHT EXPAND(alias) |
| hand | 핸드 | N | Y | WEAK(시작 패/족보 이중 의미) | 시작 핸드·레인지 | 1 | 1 | Y | range→toolStartingHand | LIGHT EXPAND |
| board | 보드 | N | Y | OK | 게임 구조 | 2 | 4 | Y | toolOuts | LIGHT EXPAND(alias) |
| community-cards | 커뮤니티 카드 | N | Y | OK | 게임 구조 | 1 | 2 | Y | toolOuts | LIGHT EXPAND(alias) |
| flop | 플랍 | N | Y | OK | 게임 구조 | 2 | 4 | Y | toolOuts | LIGHT EXPAND(alias) |
| turn | 턴 | N | Y | OK | 게임 구조 | 3 | 3 | Y | toolOuts | LIGHT EXPAND(alias) |
| river | 리버 | N | Y | OK | 게임 구조 | 1 | 2 | Y | toolOuts | LIGHT EXPAND(alias) |
| hand-ranking | 족보 | Y | Y | OK | 카드·족보 | 2 | 16 | Y | range→toolHandChecker | LIGHT EXPAND(예 추가) |
| high-card | 하이카드 | N | Y | OK | 카드·족보 | 2 | 1 | Y | range→toolHandChecker | LIGHT EXPAND |
| one-pair | 원페어 | Y | Y | OK | 카드·족보 | 3 | 1 | Y | range→toolHandChecker | KEEP(tool만 교체) |
| two-pair | 투페어 | N | N(2) | OK | 카드·족보 | 2 | 1 | Y | range→toolHandChecker | LIGHT EXPAND |
| three-of-a-kind | 트리플 | Y | Y | WEAK(셋/트립스 동의어 처리 — 구분 필요) | 카드·족보 | 2 | 1 | Y | range→toolHandChecker | LIGHT EXPAND |
| straight | 스트레이트 | N | Y | OK | 카드·족보 | 3 | 4 | Y | range→toolHandChecker | LIGHT EXPAND(alias) |
| flush | 플러시 | N | Y | OK | 카드·족보 | 2 | 5 | Y | toolOuts | LIGHT EXPAND(alias) |
| full-house | 풀하우스 | N | Y | OK | 카드·족보 | 3 | 5 | Y | range→toolHandChecker | LIGHT EXPAND(alias) |
| four-of-a-kind | 포카드 | Y | Y | OK | 카드·족보 | 2 | 1 | Y | range→toolHandChecker | KEEP(tool만 교체) |
| straight-flush | 스트레이트 플러시 | Y | Y | OK | 카드·족보 | 2 | 1 | Y | range→toolHandChecker | KEEP(tool만 교체) |
| kicker | 키커 | N | Y | OK | 카드·족보 | 1 | 5 | Y | range→toolHandChecker | LIGHT EXPAND(alias) |
| split-pot | 스플릿 팟 | Y | Y | OK | 카드·족보 | 1 | 7 | Y | range→toolHandChecker | KEEP |
| hand-matrix | 핸드 매트릭스 | Y | Y | OK | 시작 핸드·레인지 | 1 | 2 | Y | range | LIGHT EXPAND(예 추가) |
| draw | 드로우 | N | Y | OK | 확률·수학 | 1 | 2 | Y | toolOuts | LIGHT EXPAND(alias) |
| outs | 아웃츠 | Y | Y | OK | 확률·수학 | 2 | 4 | Y | toolOuts | KEEP |
| equity | 에퀴티 | N | Y | OK(577자, 최장) | 확률·수학 | 1 | 6 | Y | toolOuts→toolEquity | LIGHT EXPAND(alias, tool) |
| pot-odds | 팟오즈 | Y | Y | OK | 확률·수학 | 2 | 7 | Y | toolPotOdds | KEEP |
| nuts | 넛 | N | Y | OK(572자) | 카드·족보 | 1 | **0** | Y | range→toolHandChecker | LIGHT EXPAND (+inbound) |

카테고리 집계(표 기준, 합 58): 게임 구조 14 (ante, blind, big-blind, small-blind, stack, pot, heads-up, showdown, preflop, board, community-cards, flop, turn, river) · 베팅·액션 15 (open-raise, action, all-in, check, call, bet, raise, fold, limp, three-bet, four-bet, c-bet, bluff, vpip, pfr) · 포지션 5 (position, button, cutoff, hijack, utg) · 카드·족보 13 (hand-ranking, high-card, one-pair, two-pair, three-of-a-kind, straight, flush, full-house, four-of-a-kind, straight-flush, kicker, split-pot, nuts) · 확률·수학 4 (draw, outs, equity, pot-odds) · 시작 핸드·레인지 7 (range, suited, offsuit, pocket-pair, combo, hand, hand-matrix). registry `topic`과의 차이: preflop(betting→게임 구조), nuts(hand-strength 유지), equity(equity→확률·수학)만 재배치. 결정 분포: KEEP 6 · LIGHT EXPAND 52 · 그 외 0.

English alias 누락(36): position, open-raise, action, ante, blind, stack, pot, check, call, bet, raise, fold, limp, bluff, showdown, range, suited, offsuit, pocket-pair, combo, preflop, hand, board, community-cards, flop, turn, river, high-card, two-pair, straight, flush, full-house, kicker, draw, equity, nuts. `term` 필드에 이미 영어명이 있으므로 템플릿에서 `term`을 영어 alias로 노출하는 것만으로도 절반은 해결된다(표시 문제).

inbound 0~1 (21): 고아 3(c-bet, bluff, nuts) + 18. 링크 공급원 후보: c-bet/bluff → `learn/flop-turn-river`·Stage 4 스토리; nuts → `blog/playing-the-board`, `learn/hand-rankings`; one-pair~straight-flush → `learn/hand-rankings` relatedConcepts에 이미 일부만(high-card, three-of-a-kind, straight-flush) 있음 → 나머지 5개 추가.

용어 신설 후보(본문에서 정의 없이 쓰임, `FISHTILT_BLOG_TOPIC_BACKLOG.md` 교차 확인): 브로드웨이(hands/kjs·jts에서 ad hoc 정의, qjs·t9s에서 사용), 커넥터/갭(starting-hands, kjs), 오픈엔디드/거트샷(learn/outs:44 "거트샷" 사용), 세미 블러프, 체크 레이즈, 인/아웃 오브 포지션, 타이트/루즈, 포스트플랍, 셋 vs 트립스.

---

## 5. Hands 감사 (20)

템플릿(`src/app/hands/[hand]/page.tsx`)이 이미 PokerCards(lg) · 조합/비율(HAND_COMBOS·COMBO_COUNT·HAND_SHARE) · 13×13 위치(`HandRangeHighlight`) · 순위/상위비중/승률(HAND_RANK·HAND_TOP_SHARE·HAND_EQUITY_VS_RANDOM + "이 순위가 뜻하지 않는 것" Callout) · RFI 포함 자리(RFI_POSITIONS_WITH) · `ToolCTA range` · RelatedContent를 데이터에서 렌더한다. 따라서 MDX 본문의 역할은 "비교·맥락·FAQ"뿐이며, 20편 모두 조합/순위/승률 Fact를 본문에서 다시 반복한다(Fact 184회 — 템플릿과 중복 노출). 20편 `prerequisites` 0, `relatedTools`는 전부 `toolStartingHand+toolEquity`(toolEquity는 대결 계산기라 대부분 페이지에서 근거 약함). 결정 분포: KEEP 6 · LIGHT EXPAND 14.

| slug | rank/equity/combos/matrix/range(템플릿) | MDX 비교 | 빠진 것 | 관련 가이드/스토리 후보 | 결정 |
|---|---|---|---|---|---|
| aks | Y/Y/Y/Y/Y | AKo, 빈도 | FAQ `###` 없음 | B01, B04, 스토리 "AK로 플랍 놓쳤을 때" | KEEP |
| ako | Y/Y/Y/Y/Y | AJs/ATs 이웃, 조합 12 | 상동 | B01, B04 | KEEP |
| aa | Y/Y/Y/Y/Y | KK, 빈도 | `:121` "대부분" 비율 미출처(§6) | B03, B02, 스토리 "AA로 졌다" | KEEP(문장 1개 수정) |
| kk | Y/Y/Y/Y/Y | AA, QQ 간격 | `:295` "대부분" 미출처; "말하지 않는 것" 섹션 좋음 | B02, 스토리 "KK vs 보드 A" | LIGHT EXPAND |
| qq | Y/Y/Y/Y/Y | AK 대결(frozen) | — | B05 | KEEP |
| jj | Y/Y/Y/Y/Y | QQ/TT 이웃 | relatedArticles 0 | B02(순위표), B06 | LIGHT EXPAND |
| tt | Y/Y/Y/Y/Y | JJ/99, T 포함 패 | relatedArticles 0 | B02 | LIGHT EXPAND |
| 99 | Y/Y/Y/Y/Y | TT/88, 상위 7 페어 | — | B06 | KEEP |
| 88 | Y/Y/Y/Y/Y | 77/22 | — | B06 | KEEP |
| 77 | Y/Y/Y/Y/Y | AKs 다음, 22 | 8자리 중 유일 비페어 문장(테스트 있음) | B06, B02 | LIGHT EXPAND(FAQ 추가) |
| 22 | Y/Y/Y/Y/Y(SB만) | 절반 승률·중간 순위 | "자주 묻는 것" H2→`###` 전환 필요 | B06 | LIGHT EXPAND |
| aqs | Y/Y/Y/Y/Y | 77·AJs | relatedArticles 0 | B04, B08 | LIGHT EXPAND |
| aqo | Y/Y/Y/Y/Y | KQs·AQs | relatedArticles 0 | B01(s/o), B08 | LIGHT EXPAND |
| ajs | Y/Y/Y/Y/Y | AQs·AKo | relatedArticles 0 | B08 | LIGHT EXPAND |
| kqs | Y/Y/Y/Y/Y | KJs, 첫 비A 비페어 | relatedArticles 0 | B08, B02 | LIGHT EXPAND |
| kjs | Y/Y/Y/Y/Y | KQs·QJs, 갭 | 브로드웨이 ad hoc 정의 | B08, 용어 신설 브로드웨이/갭 | LIGHT EXPAND |
| qjs | Y/Y/Y/Y/Y | KJs·JTs, 상위 % | 브로드웨이 사용(정의 없음) | B08 | LIGHT EXPAND |
| jts | Y/Y/Y/Y/Y | KQs·QJs·T9s | 브로드웨이 ad hoc 정의; `:13` "넉넉히" | B08, 스토리 "수티드 커넥터" | LIGHT EXPAND |
| t9s | Y/Y/Y/Y/Y | JTs, 22(테스트 있음) | relatedArticles 0 | B08, B07 | LIGHT EXPAND |
| a5s | Y/Y/Y/Y/Y(전 자리) | KQs(테스트 있음) | FAQ H2→`###`; `:25` "넉넉히" | B15(휠), B08 | LIGHT EXPAND |

공통 처방: (1) 20편 FAQ를 `### 질문` 형식으로 2개 이상 추가해 FAQPage 확보; (2) 본문에서 템플릿이 이미 보여주는 Fact 반복을 줄이고 ComparisonTable(이웃 순위 3~5개, Fact 기반)로 치환; (3) `relatedTools`를 페이지별로 재선정(페어→toolStartingHand, AK/QQ→toolEquity, 수티드 커넥터→toolOuts); (4) 브로드웨이/갭/커넥터 용어 신설 후 `Term`으로 치환; (5) 11편 `relatedArticles` 채움(위 후보). 새 핸드 페이지 후보(레인지 데이터에 존재하며 링크 수요가 있는 것): 66·55·44·33(포켓페어 계열 완성), ATs, A9s, ATo, AJo(순위 13~19위 공백), KQo, 98s.

---

## 6. 횡단 이슈

### 6.1 NUMBER-RISK (파일:줄 · 숫자/주장 · 이유). 총 27건 = 오류 1 · 미고정 서술 주장 12 · 저자 입력 산술 9 · 타이핑 상수 5

| # | 위치 | 내용 | 등급/이유 |
|---|---|---|---|
| 1 | `content/learn/hand-matrix.mdx:24` | "KQs 한 칸 안에는 [HAND_COMBOS KQs]가지… 무늬 조합(♠♥, ♠♦, ♠♣, ♥♦, ♥♣, ♦♣)마다 하나씩" | **ERROR**. 나열은 서로 다른 무늬 6쌍(포켓페어 논리)이지만 수티드는 같은 무늬 4가지(♠♠ ♥♥ ♦♦ ♣♣). 엔진 `handClassByKey('KQs').comboCount === 4`. Fact는 4를 출력하고 괄호는 6개를 나열해 자기모순. |
| 2 | `content/hands/99.mdx:17`, `77.mdx:8`, `aa.mdx`(다음 페어 순위) | "맨 위 일곱 자리는 전부 포켓 페어" | 서술 주장, 데이터로 참(1~7위 AA~88) — 테스트 없음. |
| 3 | `content/hands/77.mdx:5` | "맨 위 여덟 자리 중 유일하게 포켓 페어가 아닌 패(AKs)" | 참(8위 AKs) — 테스트 없음. |
| 4 | `content/hands/ako.mdx:5` | "바로 위 AJs, 바로 아래 ATs" | 참(11/12/13위) — 테스트는 AJs>AKo만 고정. |
| 5 | `content/hands/aqo.mdx:5` 및 이웃 서술 | 13·15위가 모두 A 포함 | 참(ATs, AJo) — 테스트 없음. |
| 6 | `content/hands/aqs.mdx:1,5` | "AKs와 AQs 사이 유일한 자리는 77" | 참(8·9·10위) — 테스트 없음. |
| 7 | `content/hands/kqs.mdx:1,8` | "앞의 열다섯 자리 전부 페어이거나 A 포함" | 참 — e3.test.ts로 고정됨(리스크 낮음). |
| 8 | `content/hands/kk.mdx:11` | "AA–KK 차이보다 KK–QQ 차이가 더 작다" | 참(2.80 vs 2.47 %p) — 테스트 고정됨. |
| 9 | `content/hands/aa.mdx:121`, `kk.mdx:295`(raw 오프셋; 본문 "KK와 무엇이 갈라놓나요"/"QQ와 비교하면" 단락) | "승률 차이의 대부분은 …에서 나온다" | 비율 주장인데 어떤 Fact도 분해 값을 제공하지 않음 — 삭제 또는 "일부는"으로 완화. |
| 10 | `content/hands/22.mdx:9` | "대략 절반… 정확히 그 중간쯤" | 참(50.33%, 87/169) — "정확히"는 과장, 테스트 없음. |
| 11 | `content/hands/a5s.mdx:25`, `jts.mdx:13` | "50%는 넉넉히 넘습니다" | 참(59.9%, 57.5%) — 서술 임계값, 테스트 없음. |
| 12 | `content/hands/t9s.mdx:5` | "더 낮은 자리에 있는 패는 22 하나뿐" | 참 — 테스트 고정됨. 새 핸드 페이지 추가 시 깨짐(주의). |
| 13 | `content/blog/is-ak-good.mdx` "순위로 보면" 단락 | "9위는 포켓페어, 10·11위는 에이스 수티드" | 참 — claims.test.ts 일부 고정. |
| 14 | `content/blog/why-suited-matters.mdx:25` | "두 승률의 차이는 두 자리 % 안쪽" | 참(J9s 55.66 vs J9o 53.25) — 서술 임계값, 테스트 없음. |
| 15 | `content/blog/why-suited-matters.mdx` "다른 숫자 조합에서도" 단락 | "예외 없이" suited > offsuit | 참(78쌍 위반 0, `ranks.ts`) — 전수 주장인데 테스트 없음. 고정 권장. |
| 16 | `content/learn/outs.mdx:10,24` | "13장 중 4장을 봤으니 9장" | 저자 산술(규칙 상수 기반) — OK이나 OUTS_PROB arg 9와 정합만 확인. |
| 17 | `content/learn/outs.mdx:44` | 거트샷 "1개 숫자 × 4무늬 = 4장" | 저자 산술 — OK. |
| 18 | `content/blog/outs-nine.mdx:1,3,27` | "9장", "47장(또는 46장)" | 저자 상수 — 47장 관례를 용어/사이트 규칙으로 명시하는 문장이 있어 OK. |
| 19 | `content/learn/pot-odds.mdx:9,21,29` | 10+5+5=20BB, 9+3+3=15BB | 저자 산술; Fact arg("10|5")와 일치 확인 — OK. |
| 20 | `content/blog/pot-odds-quick.mdx:5,7,15` | 팟 6BB·하프팟 3BB, 9BB·2/3팟 6BB | 저자 산술; Fact arg와 일치 — OK. |
| 21 | `content/learn/three-bet.mdx:29-37` | 1BB→3BB→9BB→27BB | 예시 크기(전략 아님) — OK, "예시 크기" 문구 유지. |
| 22 | `content/learn/preflop.mdx:27` | 림프 = BB와 같은 금액(1BB) | 규칙 — OK. |
| 23 | `content/blog/how-often-aa.mdx:11-31` | "6가지" 반복 타이핑 | HAND_COMBOS AA Fact 존재 — 상수 치환 권장(LOW). |
| 24 | 13파일 43회 | "169가지/169개" 타이핑 | HAND_CLASS_COUNT Fact 존재 — LOW. |
| 25 | `content/learn/starting-hand-ranking.mdx:101` | 퀴즈 옵션 "1,326가지" | COMBO_COUNT Fact 존재; MiniQuiz 옵션은 문자열이라 Fact 불가 — 테스트로 고정 권장. |
| 26 | `content/blog/small-pocket-pairs.mdx`, `why-72o-is-weak.mdx` | "100BB/6인" 조건 라벨 타이핑 | 고정 라벨과 동일 — LOW. |
| 27 | `content/blog/qq-vs-ak.mdx` | "코인플립"이라는 통념 인용 없음(현재) | 새 제목(B05)에 넣을 경우 통념임을 명시하고 Fact로 반박 — 예방 항목. |

### 6.2 GTO 표현 · 외부 권위 · 공시

- "GTO"/"솔버" 본문 0회(테스트로 금지됨). 레인지 라벨은 전 페이지 "학습용 기본 레인지 (6인 · 100BB · 아무도 참여하지 않았을 때)"로 통일. 위험 지점: `learn/three-bet`·`blog/why-called-3bet`은 3벳을 다루지만 지원 레인지는 First In뿐 — "3벳 레인지는 이 사이트가 제공하지 않는다"는 문장이 `why-called-3bet` "여기서 다루지 않는 것"에만 있고 `learn/three-bet`에는 없음.
- 외부 권위 주장("전문가", "프로", "출처", "연구") 0회. 다만 `blog/why-72o-is-weak`의 "72o가 최악이라는 통념"과 `outs-nine`의 "아웃×4 규칙"은 출처 없는 관습 인용 — "흔히 쓰는"으로 표현돼 있어 허용 범위.
- 공시: 핸드 스토리는 아직 0편. 신설 시 `"학습과 재미를 위해 재구성한 핸드 시나리오입니다."`를 본문 상단 컴포넌트(ArticleMeta 또는 Callout variant)로 강제하고 registry에 `disclosure: 'RECONSTRUCTED'` 같은 필드로 테스트 가능하게 할 것을 권장. 현재 `BlogRecord`에 저자/날짜/스토리 필드가 없어(`src/content/types.ts`) 스토리 타입을 구분할 수단이 없다.
- 브랜드: "FishTilt" 12개 glossary 본문 — 리브랜딩 배치에서 일괄 치환 대상.

### 6.3 Component 매핑 (계약 목록 23 vs 현재 `src/components/`)

| 계약 | 상태 | 현재 대응 / 비고 |
|---|---|---|
| ArticleHero | PARTIAL | `PageHero`(eyebrow/title/description). 타입 라벨·저자·날짜·리드 없음 |
| ArticleDeck | PARTIAL | `splitAfterLead` CSS 리드; 필드 없음 |
| ArticleMeta | PARTIAL | `contentMeta()` level+readMinutes; author/date/disclosure 없음 |
| QuickAnswer | MISSING | `ToolAnswer`는 tool 전용 |
| TableOfContents | MISSING | H2 데이터는 `measureContent`로 얻을 수 있음 |
| EditorialImage | MISSING | 사진/일러스트 0 (BASELINE §15) |
| Figure | EXISTS | `Figure`(caption) — MDX 허용 |
| PokerCards | EXISTS | `PokerCards` — MDX 허용 |
| BoardCards | PARTIAL | `PokerCards`로 5장 표시 가능하나 스트리트 구분 없음 |
| HandTimeline | MISSING | — |
| StreetSection | MISSING | — |
| StatsRow | MISSING | — |
| StatCard | MISSING | — |
| ComparisonTable | MISSING | `RangeCompareMatrix`는 tool 전용 |
| DataTable | MISSING | MDX 마크다운 표는 가능하나 Fact 셀 스타일 없음 |
| KeyPoint | PARTIAL | `Callout` |
| Callout | EXISTS | `Callout` — MDX 허용 |
| Quote | MISSING | — |
| RangeEmbed | EXISTS | `RangeMatrixMini`(MDX) + `HandRangeHighlight`(템플릿) |
| ToolCTA | EXISTS | `ToolCTA` — MDX 허용 |
| FAQ | PARTIAL | `FaqSection` 존재하나 MDX allow-list 밖; 본문 FAQ는 `###`→JSON-LD만 |
| RelatedCluster | EXISTS | `RelatedContent` |
| NextRead | PARTIAL | `nextLessons` 관계만; 이전/다음 내비 없음 |

집계: EXISTS 6 · PARTIAL 7 · MISSING 10. Learn 시각 레슨용 추가 요구(계약 목록 밖): PositionDiagram MISSING(`PositionLegend`는 범례), BettingTimeline MISSING, MiniQuiz EXISTS, OutsFigure/PotOddsFigure EXISTS. 새 component는 MDX `allowList.ts`와 registry 테스트(허용 component 검사)를 함께 갱신해야 하며, 이는 Stage 3 코드 소유자 작업이다.

---

## 7. 배치 계획 (영향 순)

각 배치는 한 에이전트, 파일 경계 겹침 없음. 선행 조건 P0은 코드 소유자 작업(component/필드 추가)이며 콘텐츠 배치는 P0 없이도 "본문·관계·FAQ"까지는 진행 가능.

| 순서 | 배치 | 범위 | 핵심 산출 |
|---|---|---|---|
| P0 | 코드 선행 | `allowList.ts`, `BlogRecord`(contentType/author/date/disclosure), FaqSection·StatsRow·ComparisonTable·DataTable·QuickAnswer·PositionDiagram·BettingTimeline·HandTimeline, 글로서리 템플릿 `shortDefinition`/`term` 노출, blog 허브 타입별 그룹 | 콘텐츠 배치가 쓸 수 있는 부품 |
| C1 | 오류·리스크 수정 | `learn/hand-matrix.mdx:24`, `hands/aa.mdx`·`kk.mdx` "대부분", `hands/22`·`a5s` FAQ H2→`###`, NUMBER-RISK #2~#6·#10·#11·#14·#15 테스트 추가(`claims.test.ts`/`e3.test.ts`), "FishTilt" 12건 | 정확성 확보 |
| L1 | Learn 1 (DEEP) | holdem-basics, poker-actions, positions-6max, three-bet | HandTimeline/BettingTimeline/PositionDiagram 첫 적용 + 목표/요약 블록 |
| L2 | Learn 2 | hand-rankings, starting-hands, starting-hand-ranking, hand-matrix, poker-range | 카테고리 필드 + RangeEmbed/StatsRow |
| L3 | Learn 3 | position, preflop, flop-turn-river, equity, pot-odds, outs(+nextLessons) | 카테고리 완성, outs 종착 처리 |
| B1 | Blog 1 (허브 승격) | is-ak-good(DEEP), why-use-range(DEEP), next-best-after-aa(DEEP), what-is-kicker(DEEP, same-pair-who-wins 흡수) | 4 허브 + MERGE 1 |
| B2 | Blog 2 (RENAME) | aks-vs-ako, why-72o-is-weak, why-suited-matters, outs-nine, pot-odds-quick | 제목·FAQ·schema |
| B3 | Blog 3 | how-often-aa, qq-vs-ak, small-pocket-pairs, btn-why-wide, a2345-wheel | LIGHT EXPAND + FAQ |
| B4 | Blog 4 | flush-vs-straight, full-house-vs-flush, playing-the-board, why-blinds-exist(MOVE), why-called-3bet(MOVE) | 타입 라벨 적용 |
| G1 | Glossary 1 | 베팅·액션 16 (open-raise … pfr, c-bet, bluff) | 쉽게/예 섹션, alias, tool 재배정, 고아 2 해소 |
| G2 | Glossary 2 | 게임 구조 14 (ante … river) | 상동 |
| G3 | Glossary 3 | 카드·족보 14 (hand-ranking … nuts) + 포지션 5 | 예 추가, toolHandChecker 재배정, nuts 고아 해소, 셋/트립스 정리 |
| G4 | Glossary 4 | 확률·수학 4 + 시작 핸드·레인지 7 + 신설 용어(브로드웨이, 커넥터/갭, 거트샷/오픈엔디드, 셋/트립스, IP/OOP) | alias 보강 + 신규 6~8 |
| H1 | Hands 1 | aa, kk, qq, jj, tt | FAQ `###`, ComparisonTable, relatedArticles |
| H2 | Hands 2 | 99, 88, 77, 22, a5s | 상동 + FAQ 형식 수정 |
| H3 | Hands 3 | aks, ako, aqs, aqo, ajs | 상동 |
| H4 | Hands 4 | kqs, kjs, qjs, jts, t9s | 브로드웨이/갭 Term 치환 |
| S1 | Hand Stories (Stage 4) | 신규 4~6편 (AK 플랍 미스, AA 패배, KK vs A 보드, 수티드 커넥터, 22 셋, 보드 플레이 스플릿) | 공시 문구 강제, 수치는 Fact/EXACT_EQUITY만 |

병렬 가능: L1~L3 · B1~B4 · G1~G4 · H1~H4는 서로 파일이 겹치지 않으므로 P0/C1 이후 동시 실행 가능. `blog-same-pair-who-wins` 삭제/리다이렉트는 B1과 Agent A 키워드 맵 확정 후에만 실행.

---

부록 — 스크래치 파일: `/private/tmp/claude-501/-Users-woops-projects-GTO-SELF/c9838946-1594-4e38-b9ef-d025effa10fa/scratchpad/{inventory.ts,inventory.json,summary.json,records.txt,compact.txt,numrisk.mjs,numrisk.txt,faq.ts,faq.txt,ranks.ts}`.
