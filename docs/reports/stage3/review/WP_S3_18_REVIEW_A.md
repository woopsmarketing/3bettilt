# WP-S3-18 · REVIEWER A — POKER / MATH / CONTENT CORRECTNESS

독립 리뷰. **코드·콘텐츠를 한 줄도 수정하지 않았다.** 빌드는 기존 `apps/fishtilt/.next`를 읽었고
`pnpm build`/e2e는 돌리지 않았다. 릴리스 FAST-FINISH 지시에 따라 상위 5건만 상술한다.

**집계 — BLOCKER 4 · MAJOR 8 · MINOR 18 · NOTE 9**

## 검증 방법

산문을 믿지 않고 엔진에서 재계산했다. 스크래치패드에서 `tsx`로 실제 모듈을 임포트해 실행
(cwd = repo root): `facts.js → factValue()`, `learn-core → handStrengthOf / HAND_STRENGTH_BY_RANK /
categoryFrequencyOf / outsOdds / potOdds / exactHeadsUpEquity`,
`strategy-core/analysis/evaluate.js → evaluateHand / evaluateStrength / compareHands`,
`features/range → resolveRange`, `features/tools/equity.js → equityPercentages`.
빌드 HTML은 `.next/server/app/ko/**/*.html`을 태그 제거 후 원문으로 읽었다.

## 확인했고 정확한 것 (명시)

- **모든 `<Fact>` 값 재계산 일치, 불일치 0건.** 족보 빈도 40/624/3,744/5,108/10,200/54,912/
  123,552/1,098,240/1,302,540 → **합계 2,598,960 = C(52,5)** 정확.
- **아웃·팟 오즈 전부 정확**: 9아웃 19.15 / 34.97 / 19.57, 4아웃 8.51 / 16.47; ×4 어림이 9아웃엔
  높고 4아웃엔 낮다는 양방향 서술도 맞다. 10|5=25.00, 9|3=20.00, 30/10=20.00=4:1.
- **169 강도 데이터셋**: 1–7위 전부 포켓페어, 8위 AKs, 165위 72o, 169위 32o(32.30%),
  정확 동률 0건, 등수–승률 역전 0건.
- **13×13 표 방향**: 빌드 HTML 169칸을 `data-row`/`data-col`로 전수 추출 — (0,0)=AA, (0,1)=AKs,
  (1,0)=AKo. `hand-matrix.mdx`·`poker-range.mdx`·`/hands` 허브 캡션 전부 정확.
- **핸드 스토리 6편 전부**: 카드 중복 0, 보드 적법, 쇼다운 승자·족보를 평가기로 독립 재판정해
  6/6 일치, 스트리트별 팟 24개를 블라인드부터 독립 재합산해 전부 일치, 올인 = 잔여 스택 일치,
  **재구성 시나리오 고지가 6편 모두 상단에 가시 렌더**.
- **레인지 규율**: `GTO`/`솔버`/`Wizard`/`내시`/`최적 전략` 출현 0건. 전부 `학습용 기본 레인지`
  단일 라벨 + `6인 · 100BB · First In` 조건 가시. RFI 수치 재확인(UTG 226/17.0% … SB 622/46.9%,
  BB는 UNSUPPORTED). `/about`은 외부 차트 이름을 대지 않고 **SB만 이 사이트가 재계산했다는 사실까지
  공개**한다. 실시간 플레이·화면 읽기 표면 0. 지시형 실전 조언 사실상 없음.
- **퀴즈 정답은 하드코딩이 아니라 생성 시점에 평가기가 판정**하며, 무승부를 `MIXED`로 정직 처리.

즉 결함은 전부 **손으로 쓴 한국어 산문이 엔진 계산에서 이탈한 지점**에 있다.

---

## BLOCKER 1 · 버튼 용어 페이지가 액션 순서를 틀리게 정의한다

`content/glossary/button.mdx:3` — "버튼(BTN)은 … **프리플랍과 플랍 이후 모두에서 가장 늦게
액션합니다.**" (빌드 `ko/glossary/button.html`에 그대로 렌더)

6-max 프리플랍은 UTG → HJ → CO → **BTN** → SB → BB. BTN은 4번째이고 뒤에 블라인드 두 자리가 남는다.
**사이트 자신이 두 곳에서 반대로 적는다**: `learn/positions-6max.mdx:55`("SB·BB는 … 프리플랍에서는
가장 나중에 행동합니다"), `glossary/big-blind.mdx:13`(동일).
초보에게 가장 중요하다고 가르치는 포지션의 **정의 페이지**가 그 포지션에 대해 주장하는 유일한 사실이
틀렸다. → 주장을 포스트플랍으로 한정.

## BLOCKER 2 · IP/OOP 용어 페이지의 예시가 거꾸로다

`content/glossary/ip-oop.mdx:7` — "빅 블라인드 … UTG를 상대한다면 **빅 블라인드가 오히려
인포지션이 됩니다.**" 포스트플랍 순서는 SB → BB → UTG → … → BTN이므로 BB는 UTG보다 **먼저**
행동해 OOP다. 페이지가 바로 앞 문장에서 "**플랍 이후 내내**"로 포스트플랍 틀을 잡아 놓았다.
같은 파일 `:15`에 두 번째 오류 — "이 차이는 프리플랍부터 리버까지 … 그대로 유지됩니다"는
BTN vs BB에서 관계가 뒤집히므로 거짓이며, `learn/position.mdx` FAQ가 그 점을 바르게 설명한다.
레지스트리 `shortDefinition`은 정확하다 — 틀린 건 **초보가 베껴 가는 예시**뿐이라 더 나쁘다.

## BLOCKER 3 · 보드 풀하우스가 "전원 스플릿"이라고 단정한다

`content/blog/full-house-vs-flush.mdx:63` — "공용 카드 다섯 장만으로 이미 풀하우스가 완성된 경우
… **참가자 전원이 … 무승부(스플릿)가 됩니다.**"

**사이트 자신의 평가기로 반증**:
```
board 9h9d9c2h2s | As Ac FULL_HOUSE(보드보다 강함) vs Ks Kd → As Ac WINS
board 9h9d9c2h2s | 9s 4d QUADS                  vs As Ac → 9s 4d WINS
board KhKdKc7s7d | 8h 8c FULL_HOUSE(보드보다 강함) vs 3s 4d → 8h 8c WINS
```
**`content/blog/playing-the-board.mdx:63`이 이 규칙을 정확히 적고 있다** — 두 글이 정반대다.
어떤 테스트도 이 FAQ를 고정하지 않는다(`i2.test.ts:286`은 본문 보드만 검증).

## BLOCKER 4 · 포켓페어가 "조합 수가 가장 적다"고 세 곳에서 단언 — 바로 옆 숫자와 모순

`content/blog/small-pocket-pairs.mdx:79` — 빌드에서 "**6**가지뿐입니다. … 수티드 **4**가지나
오프수트 **12**가지보다 **훨씬 적습니다**"로 렌더된다. **6은 4보다 적지 않다.**
이어지는 "받는 일 자체가 다른 조합보다 드뭅니다"도 반대 — `HAND_ONE_IN_N`: 22 = **221**판,
65s = **332**판. 같은 오류가 `:3` QuickAnswer("다른 어떤 시작 패보다도 적습니다")와
`:77` 소제목("오히려 귀한 패")에도 있다. `<Fact>` 값은 맞고 **그 숫자를 둘러싼 추론이 틀렸다.**
`i2.test.ts`에 이 글의 주장을 고정한 테스트가 없다.

## MAJOR (최상위 1건) · "승률"이 사이트 안에서 서로 다른 두 수를 가리킨다

`learn/equity.mdx`는 에퀴티를 "이길 확률이 아니라 팟에서 내 몫"(승+무/2)으로 가르치는데:
1. 승률 계산기 결과 패널 왼쪽 라벨이 `내 핸드 승률`(`features/tools/equity.ts:393`)인데 그 값은
   `heroWinBps`(순수 승 확률)다. 스크린샷 `wp14/ko_tools_equity-1440x900-light-fold.png`:
   AsAh vs KsKh → **"내 핸드 승률 82.4%"**. **같은 페이지 정적 표는 같은 대결을 "승률 82.64%"**로
   적는다. AsKs vs AhKh에서는 격차가 **42.8%p**(계산기 7.2% vs 표 50.00%).
2. 같은 페이지 본문이 그 라벨을 스스로 부정한다(`EquityGuide.tsx:103`: "왼쪽과 오른쪽 숫자에는
   이미 비김의 절반씩이 들어 있지 않습니다 — 절반씩 나눠 더한 값이 '승률'입니다").
3. FAQ와 **발행되는 `FAQPage` JSON-LD**가 "승률(Equity) = 팟을 가져갈 **확률**"이라고 정의한다
   (`features/tools/faq.ts` EQUITY_FAQ 1번, 빌드 ld+json에 그대로).
4. 핸드 20편에 `승률` 57회, 허브 `<title>`도 "…조합 수·**승률**".
→ 라벨을 `내가 이김`으로, FAQ 답변을 `METHODOLOGY_SENTENCE` 계열로, 허브 타이틀은 `기대 몫`.

---

## 나머지 MAJOR (한 줄)

- `glossary/hand-ranking.mdx:3` 동족보 비교를 "키커가 가른다"고 함 — 먼저 족보 숫자로 가르고
  스트레이트·플러시·풀하우스엔 키커가 없다. `kicker.mdx:15`가 정확히 반대로 적음.
- `glossary/broadway.mdx:3` 13×13 표의 "**오른쪽 위**" — AA가 (0,0)이므로 브로드웨이는 **왼쪽 위**.
- `hands/t9s.mdx:19` "순위는 이 사이트가 다루는 패들 기준", "두 지표가 항상 같은 방향은 아니다" —
  순위는 169 전체이고 **승률 정렬 순서 그 자체**(역전 0건).
- `hands/kqs.mdx:1` "A 없는 패 중 순위표에 가장 먼저" — KK가 2위. `k4.test.ts:26`은 올바른(더 좁은)
  명제를 고정하고 있어, 고정된 것처럼 보이나 고정되지 않은 주장.
- `hands/22.mdx:19` 에퀴티를 "이긴 횟수의 비율"로, `:8` 콤보 비중을 "169가지 중"으로 설명.
- `blog/qq-three-bet-frustration.mdx:43·51·57` 9-4-2에서 4를 "바텀 페어"로 4회(미들 페어).
- `learn/poker-range.mdx` FAQ "같은 무늬 쪽이 더 여러 자리에서 쓰입니다" — 78쌍 중 **18쌍 동수**
  (AKs/AKo 등 7쌍이 5좌석 동수). `starting-hands.mdx` FAQ가 정반대를 말함.

## MINOR / NOTE (한 줄씩)

- `glossary/big-blind.mdx:1` + `g3.ts:70` "SB의 두 배"를 규칙으로 단언(`small-blind.mdx:9`는 "보통"으로 헤지).
- `glossary/showdown.mdx:19` 소제목 "패를 안 보여줄 권리는 없습니다" — 머킹은 허용(본문은 옳음).
- `glossary/fold.mdx:24` "폴드는 낼 돈이 생겼을 때만 고를 수 있는 선택" — 베팅 없어도 폴드 가능.
- `glossary/open-ended.mdx:17` 끝자락 드로우를 "거트샷"이라 부름 — `gutshot.mdx:3`의 자체 정의와 모순.
- `glossary/river.mdx:7` "확률을 따질 필요 없이" — 보드만 확정이고 상대 패는 아니다.
- `learn/poker-actions.mdx` 체크·베팅을 "이 판에서"로 게이트 — 기준은 베팅 라운드(스트리트).
- `learn/pot-odds.mdx` FAQ + `tools/faq.ts` 숏스택 콜 잔액 "상대에게 그대로 돌아갑니다" — 헤즈업 한정(6-max 사이트).
- `features/strength/copy.ts:148` "2,118,760 × 1,225 … 총 354,489,735,600" — 곱이 2,595,481,000이라 검산 불가(실제 169×2,118,760×990).
- `learn/starting-hand-ranking.mdx:118` "동률 하나도 없다" — 원자료는 참이나 2자리 표시에서 인접 5쌍이 동일 인쇄(K8o/Q8s 56.02 등).
- `blog/small-pocket-pairs.mdx:3` "중간보다 조금 위쪽" 예시가 22(87위, 중앙 85보다 아래).
- `blog/btn-why-wide.mdx:88` 레인지 포함관계 일반화 — BTN ⊄ SB(A6o·A5o·A4o).
- `blog/river-changes-everything.mdx:56` 턴 콜 판정이 직접 팟 오즈만 셈 — 뒤에 72.5BB가 남는데 임플라이드 오즈 미언급.
- `blog/full-house-loses.mdx` 산문의 `T`와 `PokerCard`의 `10`이 같은 화면에 공존, 설명 없음.
- `blog/ak-flop-miss.mdx:42` "'플랍을 놓쳤다'는 정확히 하나를 뜻한다 = 페어 실패"를 정의로 단언.
- 용어 불일치: `콜 값어치/팟오즈`(Pot Odds), `트리플/쓰리 오브 어 카인드`; `k2.ts:89` "2 페어"가 투페어로 읽힘.
- `hands/22.mdx` 22의 RFI 주장이 전적으로 SB(이 프로젝트가 파생한 유일 좌석)에 의존하나 프로버넌스 미렌더.
- `glossary/pot-odds.mdx:9` 2/3 팟 베팅을 "조금 작은"으로 서술, 3·2가 산문에 없어 28.57% 검산 불가.
- NOTE: `learn/poker-hand-rankings.mdx`가 로열 플러시를 한 번도 언급하지 않음(9카테고리 관례 자체는 정확).
- NOTE: `blog/aa-loses.mdx:42` "조금 더 많은 몫"은 +8.2%p(약 1.55배)를 과소 표현.
- NOTE: `blog/ak-flop-miss.mdx:69` 빈도 주장에 `<Fact>`도 테스트도 없음(설계상 빈도 fact 부재).
- NOTE: `blogHubModel` "카드와 팟은 전부 **기록에서** 그대로 그립니다" — `데이터에서`가 무모호.
- NOTE: `glossary/offsuit.mdx:13` "왜 콤보 수가 더 많을까요"의 답이 결론 재진술(순환).
- NOTE: `qq-vs-ak.mdx:37`가 vs-random 수치를 head-to-head 수치 옆에 둠(라벨은 되어 있음).
- NOTE: `a5s.mdx:1`은 A를 낮은 카드로 전제(설명 없음); `aqo/kqs/jj/a5s`가 A를 "그림 카드"로 셈.
- **NOTE (구조적)**: 콘텐츠 가드는 **모양은 지키지만 진위는 지키지 않는다**.
  `batches.test.ts`는 슬러그·`<Term>` 해석·400자 하한·"GTO" 부재만 본다.
  **BLOCKER 1·2·3·4와 위 MAJOR 대부분이 어떤 assertion으로도 고정되어 있지 않다.**

## 미검증 의심 (추가 조사 안 함)

- `/practice` 퀴즈 3종의 **문항 은행 전체**는 표본만 봤다. 정답은 엔진 판정이라 구조적으로 안전해
  보이나, 문항에 붙은 손글씨 `explanation`/`note` 산문은 전수 확인하지 않았다 — 위 결함이 전부
  산문에서 나온 것을 고려하면 같은 클래스의 오류가 남아 있을 수 있다.

## 종합

엔진과 데이터는 신뢰할 만하다. 문제는 전부 손으로 쓴 산문이고, BLOCKER 4건은 포커 규칙 자체를
틀리게 가르친다. **네 건 모두 이 사이트의 다른 페이지가 같은 사실을 정확히 적고 있어서**, 수정은
새 판단이 아니라 이미 있는 올바른 문장으로 맞추는 일이다. 각 수정은 **엔진 재유도형 assertion**으로
함께 고정할 것 — 현재 가드는 이 오류 클래스를 잡지 못한다.
