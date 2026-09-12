# 3BetTilt 카니발라이제이션 맵 (WP-S3-02 Agent A)

- 기준·표기는 `3BETTILT_KEYWORD_MAP.md` 머리말과 같다(경로는 `/ko` 제외, 공개 URL = `/ko` + path). 실측은 레지스트리 덤프(113 레코드)·MDX grep·`src/app/**/page.tsx` 리터럴.
- **역할 규칙(확정, 계약 BM + 오케스트레이터 결정)**: Learn = 개념/커리큘럼(`X란·원리·보는 법·계산법`) · Tool = interactive(`계산기·표·확인기`) · Glossary = 뜻(`X 뜻`) · Blog = 구체 질문/editorial · Hands = 시작 핸드 하나. **Stage 2와 달라진 점 하나**: Stage 2는 개념어 7개(`hand-matrix, range, preflop, hand-ranking, outs, equity, pot-odds`)와 `kicker`·`three-bet`의 `X 뜻` 질의를 learn/blog에 양보시켰다(WP1 §2-5 예외 1–3). 확정 규칙에서는 **`X 뜻`은 예외 없이 글로서리가 소유**하고, learn은 `X란/…법`을 가진다. 그래서 C1·C12·C13이 `CHANGED`다.
- 레인지는 어디서도 GTO라 부르지 않는다(grep `GTO` = 콘텐츠 0건, 주석 1건 `HomeRangePreview.tsx:39`은 금지 명시). 지원 조건은 6-max · 100BB · First In만.

## 1. 개념 클러스터별 소유권

각 표: 경쟁 페이지 → 의도별 소유자 → 비소유자가 **주장하지 말아야 할 것** → 연결 링크(라벨은 계약 BQ: 더 배우기 / 직접 확인하기 / 같이 알아둘 용어 / 이런 이야기도 있어요 / 비슷한 핸드 / 다음으로 읽기).

### 1.1 핸드레인지 (경쟁 5: `learn/poker-range`, `tools/range`, `glossary/range`, `blog/why-use-range`, `blog/btn-why-wide`)
| 의도 | 소유자 | 비소유자 금지 사항 | 연결 |
|---|---|---|---|
| 핸드레인지 · 홀덤 핸드레인지 · 포커 레인지 · 핸드레인지란 | `learn/poker-range` | tool은 개념 정의 절을 늘리지 않음(현재 FAQ 1블록만, 유지). glossary는 13×13 표 삽입 확장 금지(`glossary/range.mdx`에 `RangeMatrixMini` 1개 — 이미 개념 페이지처럼 보임, 유지하되 확장 금지) | glossary→learn "더 배우기", learn→tool "직접 확인하기" |
| 13x13 핸드레인지 · 홀덤 핸드표 · 포지션별 오픈 레인지 · 레인지 비교 | `tools/range` | learn/hand-matrix는 "표 읽는 법"만, 레인지 자체 제공 금지 | learn/hand-matrix→tool "직접 확인하기" |
| 레인지 뜻 · 핸드레인지 뜻 | `glossary/range` | — | glossary→learn/tool |
| 레인지로 보는 이유(상대 패 하나로 찍기의 오류) | `blog/why-use-range` | learn/poker-range FAQ에 같은 논지를 확장하지 않음 | blog→learn(본문 링크 ✓ 1) |
| 버튼 레인지가 넓은 이유 | `blog/btn-why-wide` | — | blog→tool(`<ToolCTA tool="range">` ✓) |

**앵커 텍스트 충돌(신규 발견)**: 헤더 primary nav의 `핸드레인지` 앵커가 `/tools/range`를 가리킨다(`routes.ts:47`, 전 페이지 130회 반복). 같은 사이트 안에서 `핸드레인지란?`(learn)이 개념 소유자인데 사이트 전체 앵커는 tool을 "핸드레인지"라 부른다. 권고: nav 라벨을 `핸드레인지 표`로(1줄), 또는 오케스트레이터가 bare `핸드레인지`를 tool 소유로 재판정. 본 문서는 규칙대로 learn 소유로 둔다.

### 1.2 팟오즈 (경쟁 4 + glossary `pot`·`call`)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 팟오즈 · 팟오즈란 · 팟오즈 계산법 | `learn/pot-odds` | blog/pot-odds-quick은 공식 유도 반복 금지(현재 learn 링크 1 ✓) | learn→tool "직접 확인하기" |
| 팟오즈 계산기 | `tools/pot-odds` | learn은 계산기 UI 흉내 금지 | tool→learn(페이지 내 `:86` ✓) |
| 팟오즈 뜻 | `glossary/pot-odds` | — | glossary→learn "더 배우기"(현재 본문 링크 0) |
| 팟오즈 암산(벳 크기별) | `blog/pot-odds-quick` | — | blog→tool(CTA ✓) |
표기 통일 필요: title 계층에서 `팟 오즈 계산기`(tool) vs `팟오즈`(learn·blog·seed). 소유권과 무관하게 한 표기로.

### 1.3 에퀴티 / 승률 (경쟁 3 + `blog/qq-vs-ak`, hands 20의 `HAND_EQUITY_VS_RANDOM`)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 에퀴티란 · 승률 개념 | `learn/equity` | hands 페이지는 "승률이란" 설명 절 금지(숫자만) | learn→tool |
| 포커 승률 계산기 · 홀덤 승률 계산기 · 에퀴티 계산기 | `tools/equity` | — | tool→learn(`:92` ✓) |
| 에퀴티 뜻 · 승률 뜻 | `glossary/equity` | — | glossary→learn |
| QQ vs AK 승률 | `blog/qq-vs-ak` | `hands/qq`는 QQ vs AK 비교 절 금지 | blog→tool(CTA ✓), hands/qq→blog(`relatedArticles` ✓) |

### 1.4 아웃츠 (경쟁 4 + `glossary/draw`)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 아웃츠 · 아웃츠란 · 세는 법 · ×2/×4 규칙 | `learn/outs` | blog/outs-nine은 "왜 9장"과 그 확률만(현재 learn 링크 1 ✓) | learn→tool |
| 아웃츠 계산기 · 드로우 완성 확률 | `tools/outs` | — | tool→learn(`:87` ✓) |
| 아웃츠 뜻 · 아웃 뜻 · 드로우 뜻 | `glossary/outs`, `glossary/draw` | — | glossary→learn |
| 아웃츠 9장 · 플러시 드로우 확률 | `blog/outs-nine` | — | blog→tool(CTA ✓) |

### 1.5 포지션 (경쟁 4 + glossary 6: `position, button, cutoff, hijack, utg, big-blind/small-blind`)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 홀덤 포지션 · 포커 포지션 · 포지션 중요성 | `learn/position` | positions-6max는 "왜 중요한가" 절 금지 | learn→positions-6max "다음으로 읽기" |
| 6맥스 포지션 이름 · UTG HJ CO BTN SB BB | `learn/positions-6max` | glossary 6개는 각 자리 뜻만 | glossary 6→positions-6max "더 배우기" |
| 포지션 뜻 · 버튼 뜻 · 컷오프 뜻 … | glossary 각 항목 | — | — |
| 버튼 레인지가 넓은 이유 | `blog/btn-why-wide` | — | blog→learn/position(관계 ✓) |

### 1.6 3벳 (경쟁 3 + `glossary/four-bet`, `open-raise`)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 3벳 뜻 · 3bet 뜻 · 쓰리벳 뜻 | **`glossary/three-bet`** (CHANGED, 규칙) | learn title/H1에 "뜻" 사용 금지 | glossary→learn "더 배우기"(본문 링크 ✓) |
| 3벳이란 · 3벳 상황 · 4벳 · 이후 달라지는 것 | `learn/three-bet` | — | learn→glossary "같이 알아둘 용어" |
| 왜 3벳이라 부르나(유래) | `blog/why-called-3bet` | learn FAQ "빅 블라인드를 왜 벳으로 세나"(`three-bet.mdx:55`)와 논지 중복 — blog가 유래 소유, learn FAQ는 한 문단으로 유지 | blog→learn(본문 링크 2 ✓) |

### 1.7 시작 핸드 / 순위 (경쟁: `learn/starting-hands`, `learn/starting-hand-ranking`, `tools/starting-hand`, `/hands` 허브, hands 20, blog 6편)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 홀덤 시작 핸드 · 홀덤 시작 패 · 시작 패 보는 법 | `learn/starting-hands` | `/hands` 허브는 판단 기준 설명 금지(목록만) | learn→`/hands` "비슷한 핸드"(현재 본문 링크 0) |
| 시작 핸드 순위 · 169가지 순서 | `learn/starting-hand-ranking` | hands 20은 "순위란 무엇인가" 설명 금지 | learn→tool "직접 확인하기" |
| 시작 핸드 순위표(보기/슬라이더) | `tools/starting-hand` | — | tool→learn(`:110` ✓) |
| 홀덤 시작 핸드 목록 | `/hands` 허브 | — | 허브→learn 2편(현재 인트로 링크 없음) |
| `<표기>` · `<표기> 뜻/순위/조합` | `hands/*` 20 | blog는 개별 핸드의 순위·조합 수를 본문 주제로 삼지 않음(비교 질문만) | hands→blog "이런 이야기도 있어요" |
| AA 다음 · AK 좋은 패 · QQ AK · 작은 포켓페어 · 72o | blog 각 1편 | hands는 해당 비교를 자기 절로 만들지 않음 | blog↔hands 상호(`relatedHands` ✓ / hands의 `relatedArticles`는 9/20만) |
`포커 핸드 순위`(BK)는 한국어에서 족보(1.8)를 뜻하는 경우가 많다 — 1.8 소유자에게 배정하고 그 페이지 상단에 "시작 핸드 순위를 찾으셨다면 →" 한 줄 분기 권고.

### 1.8 족보 / 핸드 랭킹 (경쟁: `learn/poker-hand-rankings`, `glossary/hand-ranking` + 족보 glossary 10, `tools/hand-checker`, `practice/hand-ranking-quiz`, blog 5편)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 홀덤 족보 · 포커 족보 · 포커 족보 순서 · 포커 핸드 순위 | `learn/poker-hand-rankings` | glossary/hand-ranking은 9개 순서 나열 이상 확장 금지(현재 `CATEGORY_RANK` 9개 나열 — 경계선, 유지) | glossary→learn "더 배우기" |
| 족보 뜻 · 플러시 뜻 · 풀하우스 뜻 … | glossary 11개 | — | 각→learn |
| 내 패 족보 확인 · 족보 판정 | `tools/hand-checker` | — | tool→learn(`:92` ✓) |
| 족보 퀴즈 | `practice/hand-ranking-quiz` | — | quiz→learn ✓ |
| 플러시 vs 스트레이트 · 풀하우스 vs 플러시 · 같은 원페어 · 보드 플레이 · A2345 | blog 5편 | learn FAQ는 각 비교를 한 줄 답 이상으로 늘리지 않음 | blog→learn(관계 ✓, 본문 링크 0/5) |

### 1.9 수티드 / 오프수트 (경쟁: `glossary/suited`·`offsuit`, `blog/why-suited-matters`, `blog/aks-vs-ako`, `learn/starting-hands`, 수티드 hands 11)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 수티드 뜻 · suited 뜻 · 오프수트 뜻 · offsuit 뜻 | `glossary/suited`, `glossary/offsuit` | blog는 s/o 표기법 설명 반복 금지(`aks-vs-ako.mdx:12` 이미 "레슨에서 다뤘으니" 명시 ✓) | glossary→blog "이런 이야기도 있어요" |
| 수티드가 좋은 이유 · 같은 무늬 승률 차이 | `blog/why-suited-matters` | `aks-vs-ako`는 AK에 한정 | aks-vs-ako→why-suited-matters(현재 없음) |
| AKs vs AKo 차이 | `blog/aks-vs-ako` | — | blog→hands 2 ✓ |
| AKs 뜻 · AKo 뜻 | `hands/aks`, `hands/ako` | — | hands→blog ✓ |

### 1.10 키커 (경쟁 3)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 키커 뜻 | **`glossary/kicker`** (CHANGED) | blog title에 "란?/뜻" 정의형 단독 사용 금지 | glossary→blog |
| 키커로 승부가 갈리는 경우 · 같은 원페어 누가 이기나 | `blog/what-is-kicker` + `blog/same-pair-who-wins` → **병합 후보 1편**(의도 동일: 두 글 H2가 "키커가 승부를 가르는 경우/끼어들 자리가 없는 경우" vs "실제 패로 보면/왜 이렇게 비교하나요") | — | 병합본→glossary/kicker, →tools/hand-checker |
병합 여부는 Agent B(깊이 감사)와 오케스트레이터 판단. 의도 관점에서는 두 URL이 같은 질의를 나눠 갖고 있다.

### 1.11 블라인드 (경쟁: `glossary/blind`·`big-blind`·`small-blind`·`ante`, `blog/why-blinds-exist`, `learn/holdem-basics`)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 블라인드 뜻 · 빅 블라인드 뜻 · 스몰 블라인드 뜻 · 앤티 뜻 | glossary 4 | — | 각→blog |
| 블라인드가 있는 이유 | `blog/why-blinds-exist` | learn/holdem-basics FAQ(`holdem-basics.mdx:35`)는 한 문단 유지 | blog→learn ✓ |
| 룰 안에서의 블라인드 진행 | `learn/holdem-basics` | — | — |

### 1.12 확률 (AA / 포켓페어 / 플러시 / 스트레이트)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| AA 확률 · 포켓 에이스 확률 | `blog/how-often-aa` | `hands/aa`는 `HAND_ONE_IN_N` 한 줄만 | hands/aa→blog ✓ |
| 포켓페어 확률(아무 페어) | **소유자 없음**. 후보: `blog/how-often-aa`를 "AA·포켓페어·AK 확률" Search Guide로 확장(fact `COMBOS_OF_KIND(PAIR)`·`HAND_ONE_IN_N` 존재) 또는 신규 D&P 1편 | glossary/pocket-pair는 확률 절 추가 금지(뜻만) | — |
| 플러시 확률 · 스트레이트 확률(5장 빈도) | **소유자 없음**. `blog/flush-vs-straight`가 `CATEGORY_FREQUENCY(FLUSH|STRAIGHT)`를 비교용으로 노출 — 확장하면 소유 가능. 신규 "족보별 확률" D&P 1편이 더 정확한 소유자 | glossary/flush·straight는 확률 절 금지 | 후보→learn/poker-hand-rankings |
| 플러시 드로우 완성 확률(아웃 9) | `blog/outs-nine` | 위 "플러시 확률"과 의도가 다름 — 신규 페이지가 생기면 상호 분기 링크 필수 | — |

### 1.13 홀덤 룰 / 하는법 (경쟁: `learn/holdem-basics`, `learn/poker-actions`, `learn/flop-turn-river`, `/learn` 허브, `/`)
| 의도 | 소유자 | 비소유자 금지 | 연결 |
|---|---|---|---|
| 홀덤 하는법 · 홀덤 룰 · 텍사스 홀덤 규칙 | `learn/holdem-basics` | poker-actions·flop-turn-river는 "한 판의 전체 흐름" 요약 절 금지 | holdem-basics→두 레슨 "다음으로 읽기" |
| 홀덤 배우기(사이트) · 홀덤 기초(커리큘럼) | `/`, `/learn` (C19) | — | — |
현재 세 seed 모두 title에 없다(§A-0 #1). 이 클러스터는 소유자는 명확하나 **title이 소유를 주장하지 않는** 유일한 머리 클러스터다.

### 1.14 기타 소규모
- **보드 ↔ 커뮤니티 카드** (C18): `glossary/board` 소유, `community-cards`는 원어 질의만. 상호 `relatedConcepts` ✓(실측).
- **프리플랍** (C12): `learn/preflop` = 프리플랍이란/진행, `glossary/preflop` = 프리플랍 뜻(CHANGED: 뜻은 글로서리).
- **13x13 표** (C3): `tools/range` = 13x13 핸드레인지/핸드표, `learn/hand-matrix` = 읽는 법, `glossary/hand-matrix` = 핸드 매트릭스 뜻. 현재 세 title 모두에 "13×13"이 있음 → 글로서리 title에서 13×13을 괄호 뒤로.
- **cbet 뜻**: `glossary/c-bet` 단독 소유이나 레지스트리 인바운드 0. `learn/flop-turn-river`의 `relatedConcepts`에 추가(그 레슨 `nextLessons`는 이미 c-bet 쪽에서 지정).
- **체크레이즈 뜻**: 소유자 없음. `glossary/check.mdx:17` 한 문장뿐. 신규 글로서리 항목 1개가 정답(억지 장문화 금지, 계약 AU).

## 2. Stage 2 판정(C1–C20) 재검증

WP1 §3은 C1–C20까지 있다(지시문의 "C1–C17"보다 3건 많음). 20건 전부 재확인.

| # | Stage 2 판정 | 현재 상태 | 판정 | 사유 |
|---|---|---|---|---|
| C1 | 3벳 뜻 → `learn/three-bet` | glossary·blog 모두 learn으로 본문 링크 ✓ | **CHANGED** | 확정 규칙: `뜻` = 글로서리. learn은 `3벳이란` |
| C2 | flush-vs-straight 승자, 둘 다 learn으로 + 상호 relatedArticles | full-house→flush 본문 링크 1 ✓; **상호 `relatedArticles` 미구현**(둘 다 `arts=` 빈 값) | STILL VALID | 판정 유효, 링크 지시 미이행 |
| C3 | learn/hand-matrix 승자 | `tools/range` title `13×13 핸드레인지 표` 추가 경쟁 | **CHANGED** | 경쟁자 3개로 확장, 글로서리 title 수정 필요 |
| C4 | learn(개념)/tool(표) 2분할 | 유지 + nav 앵커 `핸드레인지`→tool 충돌 발견 | STILL VALID | 앵커 라벨 조정 권고(§1.1) |
| C5 | pot-odds 2분할 | 유지; `뜻`은 글로서리(규칙) | STILL VALID | 표기 통일 별도 |
| C6 | outs 2분할 | 유지; tool title `아웃`→`아웃츠` 필요 | STILL VALID | — |
| C7 | equity 2분할 | 유지 | STILL VALID | — |
| C8 | learn/poker-hand-rankings 승자 | 유지; tool title에 `족보` 없음 | STILL VALID | — |
| C9 | learn(순위)/tool(순위표) 2분할, `/hands` 허브 인트로 링크 추가 | 허브 인트로 링크 없음(`hands/page.tsx` grep) | STILL VALID | 지시 미이행 |
| C10 | starting-hands / starting-hand-ranking 분리 | `nextLessons` ✓ | STILL VALID | — |
| C11 | position / positions-6max 2분할 | 유지; positions-6max title에 `포지션` 없음 | STILL VALID | — |
| C12 | learn/preflop 승자, 글로서리 `프리플랍 용어` | 규칙상 `프리플랍 뜻`은 글로서리 | **CHANGED** | 소유 질의 재배분 |
| C13 | `키커 뜻` → `blog/what-is-kicker` | 규칙상 글로서리; blog 2편 의도 중복 | **CHANGED** | 병합 후보(§1.10) |
| C14 | suited: blog(이유)/glossary(뜻) | 유지; blog title 영문 | STILL VALID | — |
| C15 | AK 4파전 → is-ak-good 평가 소유 | 유지 + `AKs 뜻/AKo 뜻` seed는 hands 소유 | STILL VALID | hands 2개가 `is-ak-good` 미참조 |
| C16 | small-pocket-pairs 승자, hands 4개 참조 | hands 99·88·77·22 `relatedArticles` ✓ | STILL VALID | 이행 확인 |
| C17 | blinds: blog(이유)/glossary/blind(뜻) | 체인 관계 ✓ | STILL VALID | — |
| C18 | board 승자, community-cards 원어만 | 상호 `relatedConcepts` ✓ | STILL VALID | — |
| C19 | `/` vs `/learn` | 유지 | STILL VALID | — |
| C20 | tools/range vs range-quiz | 유지 | STILL VALID | — |

집계: STILL VALID 16 · CHANGED 4 (C1, C3, C12, C13) · SUPERSEDED 0. C1–C17 범위만 보면 13 유지 / 4 변경.

## 3. Search Guide 후보 (의도·역할 관점만. 깊이 판정은 Agent B)

측정: 20편 본문 1,557–2,396자(`wc -m`), 전편 `<ToolCTA>` 1개, FAQ 절에 `###` 질문이 있어 `FAQPage`가 나오는 글 5편(`outs-nine, pot-odds-quick, why-blinds-exist, why-called-3bet, why-use-range`), 나머지 15편은 FAQ 제목 아래 산문만.

| 분류 | 글 | 근거(의도) |
|---|---|---|
| **Search Guide 구조에 맞음**(질의 하나를 정의→이유→데이터→도구로 닫음) | `aks-vs-ako`(계약 AI 예시 그 자체), `how-often-aa`, `qq-vs-ak`, `why-suited-matters`, `next-best-after-aa`, `is-ak-good`, `small-pocket-pairs`, `flush-vs-straight`, `full-house-vs-flush`, `outs-nine`, `pot-odds-quick`, `a2345-wheel`, `playing-the-board`, `btn-why-wide` | 제목이 곧 검색 질의이고 `<Fact>` 데이터가 본문에 있음(`Fact` 4–14개) |
| **Data & Probability**로 재라벨 가능 | `how-often-aa`, `flush-vs-straight`, `full-house-vs-flush`, `outs-nine`, `qq-vs-ak` | 확률/빈도 fact 중심 |
| **Beginner Mistakes**로 재라벨 가능 | `why-72o-is-weak`, `why-use-range` | "흔한 오해"가 글의 축 |
| **Poker Concepts / Culture**(editorial) | `why-called-3bet`, `why-blinds-exist` | 유래·이유 설명, 데이터 없음(`Fact` 0) |
| **의도 중복 → 병합 후보** | `what-is-kicker` + `same-pair-who-wins` | 같은 질의(키커로 갈리는 승부), 둘 다 `Fact` 0 |
| **Hand Story** | 0편 | 신규 4–6편은 후속 WP. 현 20편 중 1인칭 서사는 없음 |

## 4. 내부 링크 구조에서 의도 소유를 지지하지 않는 지점(실측)

1. 본문 contextual link 보유 파일: learn 1/15(`flop-turn-river`), blog 6/20, glossary 3/58, hands 1/20. 나머지는 `RelatedContent` 블록 의존 → 계약 BP 위반 상태.
2. `relatedArticles` 빈 값: blog 17/20, hands 11/20, glossary 41/58(덤프 계수). Story↔Guide, Guide↔Hands 상호 링크 기반이 없다.
3. 레지스트리 인바운드 0: `glossary/c-bet`·`bluff`·`nuts`; 인바운드 1: 19페이지(`3BETTILT_KEYWORD_MAP.md` §5).
4. `RELATION_HEADING`(`graph.ts:201`)은 6종 모두 "관련 콘텐츠"가 아닌 문장형이라 BQ 취지에 이미 부합하나, 라벨 문구가 BQ의 6개(더 배우기 / 직접 확인하기 / 같이 알아둘 용어 / 이런 이야기도 있어요 / 비슷한 핸드 / 다음으로 읽기)와 다르다 — 매핑: prerequisites→더 배우기, relatedTools→직접 확인하기, relatedConcepts→같이 알아둘 용어, relatedArticles→이런 이야기도 있어요, relatedHands→비슷한 핸드, nextLessons→다음으로 읽기.

## 5. BK seed → 소유 페이지 (45개 전수)

`소유자 수`: 현재 title/역할 기준으로 그 질의를 실질적으로 주장하는 페이지 수(1 = 정상, 0 = 공백, ≥2 = 정리 필요).

| # | seed | 소유자(확정 규칙) | 현재 소유자 수 | 비고 |
|---|---|---|---|---|
| 1 | 홀덤 하는법 | `learn/holdem-basics` | 0(title 미주장) | §1.13 |
| 2 | 홀덤 룰 | `learn/holdem-basics` | 0 | 〃 |
| 3 | 텍사스 홀덤 규칙 | `learn/holdem-basics` | 0 | 〃 |
| 4 | 홀덤 족보 | `learn/poker-hand-rankings` | 4 (learn·glossary/hand-ranking·hand-checker·quiz) | §1.8 |
| 5 | 포커 족보 | `learn/poker-hand-rankings` | 4 | 〃 |
| 6 | 홀덤 시작 핸드 | `learn/starting-hands` | 3 (learn·`/hands`·tool) | §1.7 |
| 7 | 홀덤 시작 패 | `learn/starting-hands` | 3 | 〃 |
| 8 | 시작 핸드 순위 | `learn/starting-hand-ranking`(개념) / `tools/starting-hand`(표) | 2 | tool title에 `순위` 추가 후 분할 완성 |
| 9 | 포커 핸드 순위 | `learn/poker-hand-rankings` | 2 (족보 vs 시작 핸드 순위 모호) | 상단 분기 한 줄 |
| 10 | 홀덤 포지션 | `learn/position` | 2 (position·positions-6max) | §1.5 |
| 11 | 포커 포지션 | `learn/position` | 2 | 〃 |
| 12 | 핸드레인지 | `learn/poker-range` | 3 (learn·tool nav 앵커·glossary alias) | §1.1 앵커 충돌 |
| 13 | 홀덤 핸드레인지 | `learn/poker-range` | 2 | 〃 |
| 14 | 포커 레인지 | `learn/poker-range` | 2 | 〃 |
| 15 | 13x13 핸드레인지 | `tools/range` | 3 (title에 13×13: tool·learn/hand-matrix·glossary/hand-matrix) | §1.14 |
| 16 | 홀덤 핸드표 | `tools/range` | 1 | "핸드표"가 족보표로 읽힐 수 있음 — 상단 분기 권고 |
| 17 | 포커 승률 계산기 | `tools/equity` | 1 | title에 `포커` 추가 |
| 18 | 홀덤 승률 계산기 | `tools/equity` | 1 | 〃 |
| 19 | 에퀴티 계산기 | `tools/equity` | 1 | title에 `에퀴티` 추가 |
| 20 | 팟오즈 | `learn/pot-odds` | 4 | §1.2 |
| 21 | 팟오즈 계산기 | `tools/pot-odds` | 1 | 표기 `팟 오즈`→`팟오즈` |
| 22 | 아웃츠 | `learn/outs` | 4 | §1.4 |
| 23 | 아웃츠 계산기 | `tools/outs` | 1 | title `아웃`→`아웃츠` |
| 24 | 3벳 뜻 | `glossary/three-bet` | 3 | C1 CHANGED |
| 25 | 3bet 뜻 | `glossary/three-bet` | 3 | 〃 |
| 26 | 쓰리벳 뜻 | `glossary/three-bet` | 3 | 〃 |
| 27 | 오픈레이즈 뜻 | `glossary/open-raise` | 1 | title에 `오픈레이즈` 없음(W) |
| 28 | cbet 뜻 | `glossary/c-bet` | 1 | 인바운드 0 |
| 29 | 체크레이즈 뜻 | **없음** | 0 | 신규 글로서리 항목 |
| 30 | 수티드 뜻 | `glossary/suited` | 2 (glossary·blog/why-suited-matters) | §1.9 |
| 31 | suited 뜻 | `glossary/suited` | 2 | 〃 |
| 32 | 오프수트 뜻 | `glossary/offsuit` | 1 | — |
| 33 | offsuit 뜻 | `glossary/offsuit` | 1 | — |
| 34 | AKs 뜻 | `hands/aks` | 2 (hands·blog/aks-vs-ako) | 역할 분리로 해소 |
| 35 | AKo 뜻 | `hands/ako` | 2 | 〃 |
| 36 | AA 다음 좋은 패 | `blog/next-best-after-aa` | 1 | — |
| 37 | AK 좋은 패 | `blog/is-ak-good` | 1 | — |
| 38 | QQ AK | `blog/qq-vs-ak` | 1 | — |
| 39 | 플러시 스트레이트 | `blog/flush-vs-straight` | 2 (blog·learn FAQ) | learn FAQ 한 줄 유지 |
| 40 | 풀하우스 플러시 | `blog/full-house-vs-flush` | 1 | — |
| 41 | 키커 뜻 | `glossary/kicker` | 3 | C13 CHANGED, 병합 후보 |
| 42 | AA 확률 | `blog/how-often-aa` | 2 (blog·hands/aa) | hands는 한 줄만 |
| 43 | 포켓페어 확률 | **없음** | 0 | §1.12 |
| 44 | 플러시 확률 | **없음**(근접: `blog/flush-vs-straight`) | 0 | §1.12 |
| 45 | 스트레이트 확률 | **없음**(근접: 동일) | 0 | §1.12 |

집계: 소유자 0 = **7**(그중 title 미주장 3: #1–3, 페이지 자체 부재 4: #29, #43–45) · 소유자 1 = **14** · 소유자 ≥2 = **24**. 지시문 요약 형식(no owner / multiple owners)으로는 **페이지 없음 4 / 다중 24**이며, #1–3은 "페이지는 있으나 title이 주장하지 않음"으로 별도 분류했다.

## 6. WP-S3-16 최종 판정 (2026-09-12, 빌드된 HTML 기준)

`docs/reports/stage3/WP_S3_16_SEO_AUDIT.md` §4가 근거. 규칙(§머리말)은 그대로다.

| 클러스터 | 최종 소유(빌드 title) | 상태 | 남은 것 |
|---|---|---|---|
| 1.1 핸드레인지 | learn `핸드레인지란?` · tool `13×13 핸드레인지 표 — …` · glossary `패의 묶음 (Range)` · blog `레인지로 보는 이유 — …` | 분리 완료 | nav 앵커 `핸드레인지`→tool (라우트 라벨, owner) |
| 1.2 팟오즈 | learn `콜할 값어치가 있을까? 팟오즈` · tool `팟 오즈 계산기 — …` · glossary `콜 값어치 (Pot Odds)` · blog `팟오즈 쉽게 계산하기 — …` | 분리 완료, 상호 링크 ✓ | learn↔glossary 문구 근접("콜 값어치") · `팟 오즈` 표기 |
| 1.3 에퀴티 | learn · tool `포커 승률 계산기 (에퀴티) — 핸드 vs 핸드` · glossary · blog `QQ vs AK 승률 — …` | 분리 완료 | — |
| 1.4 아웃츠 | learn · tool `아웃츠 계산기 — …` · glossary · blog `아웃츠 9장 뜻 — …` | 분리 완료 | — |
| 1.5 포지션 | learn 2 · glossary 7(+`ip-oop`) · blog `버튼(BTN) 오픈 레인지가 넓은 이유 — …` | 분리 완료 | — |
| 1.6 3벳 | glossary `다시 거는 세 번째 레이즈 (3-Bet)` · learn `상대의 레이즈에 다시 레이즈 (3-Bet)` · blog `3벳(쓰리벳, 3-Bet)은 왜 3일까? …` | 상호 링크 ✓ | learn↔glossary 문구 근접, 둘 다 한글 "3벳" 미포함 (owner) |
| 1.7 시작 핸드 | learn 2 · tool `시작 핸드 순위표 — …` · hub `홀덤 시작 핸드 목록 — …` · hands 20 · blog 6 | 분리 완료 | — |
| 1.8 족보 | learn · glossary · tool `포커 족보 확인기 (핸드 체커) — …` · quiz · blog 5 | 분리 완료 | — |
| 1.9 수티드 | glossary 2 · blog `수티드(같은 무늬)는 얼마나 중요한가? …` · `AKs vs AKo 차이 — …` | 분리 완료 | — |
| 1.10 키커 | glossary `순위를 가르는 옆 카드 (Kicker)` · blog `키커란? 같은 원페어면 누가 이길까 — …`(병합본, `same-pair-who-wins` 삭제) | 병합 이행 | — |
| 1.11 블라인드 | glossary 4 · blog `빅 블라인드는 왜 먼저 돈을 내나? …` · learn | 분리 완료 | — |
| 1.12 확률 | `blog/how-often-aa` (AA) · 포켓페어/플러시/스트레이트 확률 소유자 없음 | 미해소 | 신규 D&P 콘텐츠 |
| 1.13 룰/하는법 | learn `텍사스 홀덤은 어떻게 진행될까요?` | title 미주장 그대로 | learn title (owner) |
| 1.14 13×13 | tool · learn `13×13 표는 어떻게 읽나요?` · glossary `13×13 표 (Hand Matrix)` | 상호 링크 ✓ | glossary title의 "13×13" 위치 (owner) |
| 1.14 cbet 뜻 | `glossary/c-bet` | 인바운드 0 → 2 (`learn/flop-turn-river` 본문 `<Term>` + `relatedConcepts`) | — |
| 1.14 체크레이즈 뜻 | 없음 | 미해소 | 신규 글로서리 |

§4의 실측 4건 갱신: (1) 본문 contextual link(`<Term>` 또는 마크다운 링크 보유 파일, grep 실측) — learn 15/15, blog 25/25, glossary 63/64(`range.mdx`만 없음 — `RangeMatrixMini`가 툴로 이어짐), hands 17/20(나머지 3편은 `HandOnward`·`RelatedContent` 링크만); (2) `relatedArticles` 빈 값 — 화면상은 `HandOnward`·`BlogArticleFooter`가 역방향 관계로 채움; (3) 레지스트리 인바운드 0 = **0**, contextual inbound 1 = **0**; (4) `RELATED_LABELS`는 D-S3-16 6종 + `관련 가이드`(WP-16, `HandOnward` 라벨 편입) = 7종, `ToolGuideLinks`·`HandOnward`·`RelatedContent` 전부 이 union만 사용.
