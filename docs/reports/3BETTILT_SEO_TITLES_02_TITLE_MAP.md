# 3BetTilt SEO Titles — 02. Route type별 title template · override · 대표 title

작성 2026-09-14. 모든 title 끝은 ` - 3BetTilt`(아래 표기에서는 생략한 곳도 있음).

## 1. Route type별 template

| 타입 | 수 | title 규칙 | description 규칙 |
| --- | --- | --- | --- |
| Home | 1 | `텍사스 홀덤 배우기 \| 홀덤 족보·핸드레인지·승률 계산기` (상수) | 상수 1~2문장 |
| Hub | 6 | 페이지별 `검색 문구 \| qualifier` (정적) | 기존 유지(tools만 개선) |
| Tool | 6 | `{도구 검색어} \| {qualifier}` (정적) | 기존 유지 |
| Practice | 3 | `홀덤 {퀴즈명} \| {연습 내용}` (정적) | 기존 유지 |
| About | 1 | `소개` (브랜드 신뢰 페이지 — 키워드 없음) | 기존 유지 |
| Learn | 15 | **record `seoTitle` 필수**(전 레슨 명시) | `description`, 짧던 3개는 `seoDescription` |
| Glossary | 64 | 기본 `{검색어} 뜻 \| 홀덤·포커 용어 설명`; 검색어 = H1 표제어(짧은 대문자 약어 유지: `빅 블라인드(BB)`) | `{검색어} 뜻: {shortDefinition} {description}` (≤160자, 초과 시 앞부분) |
| Hands | 20 | `{handKey} 승률·순위 \| 텍사스 홀덤 프리플랍 핸드 가이드` | `{key} 시작 핸드 가이드. 169가지 중 N위, 조합 M가지 …기대되는 팟 몫(비기면 절반)…` (facts 값) |
| Blog search/data/concept | 19 | record `seoTitle`(검색 의도를 앞에) | `description`, 짧던 2개는 `seoDescription` |
| Blog hand story | 6 | `{상황/감정 문장} \| {핸드 대결} 핸드 리뷰` | `description`(기존 스토리 요약) |

## 2. Explicit override가 들어간 page

| 종류 | 페이지 |
| --- | --- |
| glossary `seoTerm` (8) | `three-bet`→`3벳`, `four-bet`→`4벳`, `vpip`→`VPIP`, `pfr`→`PFR`, `c-bet`→`C벳(컨티뉴에이션 벳)`, `utg`→`UTG(언더 더 건)`, `ip-oop`→`IP·OOP(인포지션·아웃오브포지션)`, `hand-ranking`→`족보` |
| glossary `seoTitle` (1) | `set-vs-trips` → `셋과 트립스 차이 \| 홀덤·포커 용어 설명` ("셋 vs 트립스 뜻"은 부자연스러움) |
| learn `seoTitle` (15) | 전 레슨 (아래 표) |
| learn `seoDescription` (3) | `poker-hand-rankings`, `positions-6max`, `outs` (기존 44–48자) |
| blog `seoTitle` 변경 (10) | search guide 4: `aks-vs-ako`, `next-best-after-aa`, `how-often-aa`, `why-72o-is-weak` / hand story 6: 전부 |
| blog `seoDescription` (2) | `flush-vs-straight`(39자), `full-house-vs-flush`(48자) |

## 3. Learn 15 title

| slug | 새 title | H1(불변) |
| --- | --- | --- |
| holdem-basics | 텍사스 홀덤 규칙 \| 홀덤 하는 법과 한 판의 흐름 | 텍사스 홀덤 하는 법 — 규칙과 한 판의 흐름 |
| poker-hand-rankings | 포커 족보 순서 \| 홀덤 핸드 순위 한눈에 보기 | 포커 족보 순서 — 어떤 족보가 더 강할까요? |
| starting-hands | 홀덤 시작 핸드 보는 법 \| 수티드·커넥터·포켓 페어 | 홀덤 시작 핸드 보는 법 — 수티드·커넥터·포켓 페어 |
| starting-hand-ranking | 홀덤 시작 패 강한 순서 \| 169가지 핸드 순위를 매기는 기준 | 시작 패는 어떤 순서로 강할까요? |
| hand-matrix | 홀덤 핸드표 읽는 법 \| 13×13 핸드 매트릭스 169칸 | 13×13 표는 어떻게 읽나요? |
| poker-range | 포커 레인지란? \| 홀덤 핸드레인지 개념과 13×13 표 | 핸드레인지란? |
| position | 홀덤 포지션 \| 자리가 왜 그렇게 중요할까 | 자리(포지션)가 왜 그렇게 중요할까요? |
| positions-6max | 6맥스 포지션 이름 \| UTG·HJ·CO·BTN·SB·BB 자리 순서 | 6맥스 포지션 이름 — UTG·HJ·CO·BTN·SB·BB |
| poker-actions | 체크·콜·레이즈·폴드 \| 홀덤 액션 5가지와 베팅 | 체크 · 베팅 · 콜 · 레이즈 · 폴드, 다섯 가지 행동 |
| preflop | 프리플랍이란? \| 홀덤 첫 베팅 라운드 진행 | 첫 두 장을 받은 뒤, 프리플랍 |
| flop-turn-river | 플랍·턴·리버 \| 홀덤 공용 카드가 열리는 순서 | 플랍 · 턴 · 리버, 카드는 이렇게 열립니다 |
| three-bet | 3벳이란? \| 레이즈에 다시 레이즈하는 상황 이해하기 | 상대의 레이즈에 다시 레이즈 (3-Bet) |
| equity | 포커 에퀴티란? \| 승률 개념과 계산 방법 | 내 승률은 몇 퍼센트일까? (Equity) |
| pot-odds | 팟오즈 계산법 \| 콜에 필요한 최소 승률 구하기 | 콜할 값어치가 있을까? 팟오즈 |
| outs | 포커 아웃츠 세는 법 \| 드로우를 완성하는 남은 카드 | 아직 남은 좋은 카드, 아웃츠 |

## 4. 대표 title before / after (빌드 HTML에서 추출)

| path | before | after | H1 |
| --- | --- | --- | --- |
| `/ko` | 무료 홀덤 학습 · 3BetTilt | 텍사스 홀덤 배우기 \| 홀덤 족보·핸드레인지·승률 계산기 - 3BetTilt | 홀덤, 외우지 말고 이해하면서 배우세요. |
| `/ko/learn` | 홀덤 처음 배우기 · 3BetTilt | 텍사스 홀덤 배우기 \| 규칙·족보·포지션·프리플랍 - 3BetTilt | 홀덤 처음 배우기 |
| `/ko/tools` | 무료 포커 도구 · 3BetTilt | 홀덤 계산기 모음 \| 승률·팟오즈·아웃츠·핸드레인지 - 3BetTilt | 무료 포커 도구 |
| `/ko/hands` | 홀덤 시작 핸드 목록 — 패별 순위·조합 수·기대 몫 · 3BetTilt | 홀덤 시작 핸드 순위 \| AA·AKs 등 프리플랍 핸드 가이드 - 3BetTilt | 홀덤 시작 핸드 목록 |
| `/ko/glossary` | 포커 용어 사전 · 3BetTilt | 홀덤 용어 사전 \| 프리플랍·3벳·포지션·팟오즈 뜻 - 3BetTilt | 포커 용어 사전 |
| `/ko/blog` | 포커 이야기와 검색 가이드 · 3BetTilt | 홀덤 핸드 분석·포커 질문 가이드 \| 텍사스 홀덤 블로그 - 3BetTilt | 포커 이야기와 검색 가이드 |
| `/ko/practice` | 홀덤 퀴즈 · 3BetTilt | 홀덤 퀴즈 \| 족보·핸드레인지·시작 핸드 연습 - 3BetTilt | 배운 내용을 직접 풀어보세요 |
| `/ko/learn/holdem-basics` | 텍사스 홀덤 하는 법 — 규칙과 한 판의 흐름 · 3BetTilt | 텍사스 홀덤 규칙 \| 홀덤 하는 법과 한 판의 흐름 - 3BetTilt | 텍사스 홀덤 하는 법 — 규칙과 한 판의 흐름 |
| `/ko/learn/pot-odds` | 콜할 값어치가 있을까? 팟오즈 · 3BetTilt | 팟오즈 계산법 \| 콜에 필요한 최소 승률 구하기 - 3BetTilt | 콜할 값어치가 있을까? 팟오즈 |
| `/ko/learn/three-bet` | 상대의 레이즈에 다시 레이즈 (3-Bet) · 3BetTilt | 3벳이란? \| 레이즈에 다시 레이즈하는 상황 이해하기 - 3BetTilt | 상대의 레이즈에 다시 레이즈 (3-Bet) |
| `/ko/tools/equity` | 포커 승률 계산기 (에퀴티) — 핸드 vs 핸드 · 3BetTilt | 홀덤 승률·에퀴티 계산기 \| 무료 포커 계산기 - 3BetTilt | 승률 계산기 |
| `/ko/tools/range` | 13×13 핸드레인지 표 — 포지션별 오픈 레인지 (6-max · 100BB) · 3BetTilt | 홀덤 핸드레인지표 \| 6-max 포지션별 오픈 레인지 도구 - 3BetTilt | 13×13 핸드레인지 표 |
| `/ko/tools/hand-checker` | 포커 족보 확인기 (핸드 체커) — 내 패 족보 판정 · 3BetTilt | 포커 핸드 판정기 \| 홀덤 족보 확인 - 3BetTilt | 핸드 체커 |
| `/ko/glossary/three-bet` | 쓰리벳 (3-Bet) — 다시 거는 세 번째 레이즈 · 3BetTilt | 3벳 뜻 \| 홀덤·포커 용어 설명 - 3BetTilt | 쓰리벳 (3-Bet) — 다시 거는 세 번째 레이즈 |
| `/ko/glossary/vpip` | 판에 자발적으로 들어간 비율 (VPIP) · 3BetTilt | VPIP 뜻 \| 홀덤·포커 용어 설명 - 3BetTilt | 판에 자발적으로 들어간 비율 (VPIP) |
| `/ko/glossary/big-blind` | 빅 블라인드 (BB) · 3BetTilt | 빅 블라인드(BB) 뜻 \| 홀덤·포커 용어 설명 - 3BetTilt | 빅 블라인드 (BB) |
| `/ko/hands/aa` | 같은 숫자 두 장 (A 페어) · AA · 3BetTilt | AA 승률·순위 \| 텍사스 홀덤 프리플랍 핸드 가이드 - 3BetTilt | 같은 숫자 두 장 (A 페어) · AA |
| `/ko/hands/aks` | 같은 무늬의 A와 K · AKs · 3BetTilt | AKs 승률·순위 \| 텍사스 홀덤 프리플랍 핸드 가이드 - 3BetTilt | 같은 무늬의 A와 K · AKs |
| `/ko/blog/aks-vs-ako` | AKs vs AKo 차이 — 수티드가 실제로 얼마나 중요한가 · 3BetTilt | AKs vs AKo 차이는? 수티드가 실제로 얼마나 중요한가 - 3BetTilt | AKs vs AKo 차이: 수티드가 실제로 얼마나 중요한가? |
| `/ko/blog/why-72o-is-weak` | 72o가 최악의 패라는 말은 맞을까? 순위표 진짜 바닥은 따로 있다 · 3BetTilt | 72o는 정말 홀덤 최약체 핸드일까? 순위표의 진짜 바닥 - 3BetTilt | 72o가 최악의 패라는 말은 맞을까? |
| `/ko/blog/aa-loses` | 홀덤 핸드 리뷰: AA vs 87s, 턴에 스트레이트가 완성된 상황 · 3BetTilt | 포켓 에이스로 스택을 다 잃은 판 \| AA vs 87s 핸드 리뷰 - 3BetTilt | 포켓 에이스를 들고 스택을 다 잃었다 |
| `/ko/practice/range-quiz` | 레인지 퀴즈 · 3BetTilt | 홀덤 핸드레인지 퀴즈 \| 프리플랍 레인지 연습 - 3BetTilt | 레인지 퀴즈 |
| `/ko/about` | 소개 · 3BetTilt | 소개 - 3BetTilt | 3BetTilt는 무엇인가요 |

## 5. prompt 권장안과 다르게 한 곳 (근거)

| prompt 권장 | 적용 | 근거 |
| --- | --- | --- |
| `72o가 홀덤 최약체 핸드인 이유` | `72o는 정말 홀덤 최약체 핸드일까? 순위표의 진짜 바닥` | 글의 결론이 "72o는 순위표의 실제 최하위가 아니다" — 권장 문구는 본문과 **사실상 반대**. 검색어는 앞에 유지 |
| learn `three-bet` → `3벳 뜻` | `3벳이란? \| …` | `3벳 뜻`은 glossary/three-bet 소유(keyword/cannibalization map C1). 두 페이지가 같은 쿼리를 두고 경쟁하지 않게 |
| `에쿼티` | `에퀴티` | 사이트 전역 표기(H1·glossary·본문)가 `에퀴티`. title/H1/본문 표기 일치가 Google title 재작성 방지에 우선 |
| tools `starting-hand` → `홀덤 시작 핸드 확인 \| 무료 프리플랍 도구` | `홀덤 시작 핸드 순위표 \| 169개 핸드 무료 탐색 도구` | 실제 기능은 169개 순위표 + 상위 X% 슬라이더. "확인"은 기능과 불일치 |
| tools `outs` qualifier `홀덤 드로우 계산` | `홀덤 드로우 완성 확률` | 실제 출력이 완성 확률 |
| `/ko/blog` → `홀덤 전략·핸드 분석 \| 텍사스 홀덤 검색 가이드` | `홀덤 핸드 분석·포커 질문 가이드 \| 텍사스 홀덤 블로그` | 블로그 실제 구성(핸드 스토리·질문형 가이드·확률 글)에 "전략" 글은 없음, "검색 가이드"는 내부 분류명(`search-guide`)이라 검색자에게 의미 없음 |
| hand story `seoTitle` "홀덤 핸드 리뷰: …" 접두 | `{상황 문장} \| {핸드} 핸드 리뷰` | §9-B: 스토리는 상황 중심, 핸드는 자연스럽게 |
| learn `starting-hand-ranking` / `/ko/hands` 둘 다 "홀덤 시작 핸드 순위" | hands 허브는 prompt대로, learn은 `홀덤 시작 패 강한 순서 \| 169가지 핸드 순위를 매기는 기준` | 같은 머리 문구로 카니발 방지 |
| practice `starting-hand-quiz` qualifier `프리플랍 판단 연습` | `두 패 중 강한 쪽 맞히기` | 퀴즈 실제 형식(두 시작 패 비교) |
| `/about` | `소개` 유지 | E-E-A-T 페이지, 키워드 없음. `3BetTilt 소개`는 브랜드 중복(`3BetTilt 소개 - 3BetTilt`) |
