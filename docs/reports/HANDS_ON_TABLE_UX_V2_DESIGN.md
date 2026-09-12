# HANDS-ON TABLE UX V2 — 설계 계약 (구현 에이전트용)

이 문서는 `prompt`(저장소 루트)의 WP-1..WP-11을 구현 가능한 계약으로 고정한 것이다.
구현 에이전트는 **이 문서의 결정을 재논의하지 않는다.** 이 문서가 코드와 어긋나면 코드를
우선하되 그 차이를 보고서에 기록한다.

제안 ADR: **ADR-0073 .. ADR-0077** (본문은 오케스트레이터가 `docs/DECISIONS.md`에 기록한다).

---

## 0. 불변 제약 (모든 WP 공통)

- 돈은 정수 milliBB. `Money.*`만 사용. UI/parse 경계에서만 소수 BB.
- REFERENCE(`strategy-core`) 출력은 **bit-identical**로 유지된다. ADAPTIVE만 바뀐다.
- 레이어링: `strategy-core`는 `player-core`를 import하지 않는다. `adaptive-core`는 React를
  import하지 않는다. 한국어 문장은 **오직** `apps/web/src/lib/table/copy.ts`에서 만든다.
- 사용자가 입력한 값은 파괴하지 않는다. HUD 스냅샷은 **UPDATE 금지, 항상 append**.
- 통계 빈 값은 **행 자체를 생략**한다. 0으로 저장하지 않는다.
- 가짜 구현 금지. 못 하는 것은 `docs/STATE.md` known issues로 보고한다.
- 외부 poker client 연동/OCR/화면읽기/자동화는 절대 추가하지 않는다.
- `CLAUDE.md`와 `prompt`는 수정하지 않는다. 자동 commit 금지.

---

## 1. 핵심 개념 — CORRECTION(rebase) vs QUICK NEXT HAND(skip)

이 둘은 **서로 다른 사건**이고 절대 섞이지 않는다.

|                          | CORRECTION (rebase)           | QUICK NEXT HAND (skip)      |
| ------------------------ | ----------------------------- | --------------------------- |
| 의미                     | "내가 테이블을 잘못 입력했다" | "이 핸드는 실제로 지나갔다" |
| handNumber               | **변경 없음**                 | **+1**                      |
| 버튼 로테이션            | **없음** (버튼 지정은 예외)   | **정확히 1회**              |
| `skipped_hands` 감사     | **기록 안 함**                | **기록함 (reason 포함)**    |
| completed hand 저장      | 안 함                         | 안 함                       |
| player learning          | 포함 안 함                    | 포함 안 함                  |
| strategy trace           | 없음                          | 없음                        |
| dirty seat               | **추가 없음**                 | 폴드하지 않은 딜인 좌석     |
| 기존 actions/cards/board | **전부 폐기 후 재구성**       | 폐기                        |

### 1.1 REBASE 규약 (WP-1 / WP-2 / WP-6)

트리거: 진행 중인 핸드가 있는 상태에서 **좌석 자리비움 / 플레이어 교체 / 버튼 지정**.

단일 원자적 store 액션으로 다음을 수행한다:

1. `hand === null`이면 → `table`에만 변경을 적용하고 끝. 알림 없음.
2. `hand !== null`이면:
   1. 현재 `table`(핸드 시작 전 스택을 담고 있는 between-hands 테이블)에 변경을 적용한다.
   2. 변경이 엔진에 거부되면 → `lastError`로 정직하게 보고하고 **핸드는 손대지 않는다.**
   3. `hand`/`view`를 버린다.
   4. 변경된 `table`로 **같은 handNumber, 같은 버튼**에서 다시 딜한다
      (`engineStartHand`). 버튼 지정이 트리거였다면 새 버튼으로.
   5. 재딜이 실패하면(예: 딜인 좌석 2명 미만) 변경된 `table`은 유지하고 `hand`는 `null`로
      둔 채 엔진 오류를 그대로 보여준다. **오류를 삼키지 않는다.**
      단, 버튼이 딜인되지 않은 좌석에 남는 것은 실패가 아니다 — ADR-0058(c)가 이미 소유한
      "딜 시점에 시계방향으로 전진" 규칙을 `startHand`와 **같은 헬퍼로** 적용한다. 두 번째 딜
      규칙을 만들지 않는다. ADR-0073이 말하는 거부 사례는 버튼이 아예 없는 경우
      (`NO_BUTTON_SEAT`)와 `NOT_ENOUGH_PLAYERS`다.
   6. 재구성이 실제로 일어났을 때만 알림 상태를 세운다.
3. 절대 하지 않는 것: completed hand 저장, `skipped_hands` 기록, handNumber 증가,
   일반 next-hand 버튼 로테이션, player learning 반영, dirty seat 추가.

UI 메시지(사용자 확인 불필요, dismissable):

> 좌석 변경으로 현재 핸드를 처음부터 다시 구성했습니다.

**부분 mutation 금지**: 진행 중인 핸드의 이벤트 로그를 잘라내거나 좌석만 빼는 식의 수정은
하지 않는다. 전부 버리고 다시 만든다.

### 1.2 QUICK NEXT HAND 규약 (WP-4)

기존 `skipHand()`를 확장한다. 라벨만 바뀌는 게 아니라 **정산 규칙이 추가된다.**

버튼 라벨: `빠른 다음 핸드`
설명문: `남은 액션은 기록하지 않고 다음 핸드로 이동합니다. 상대 스택은 다음 핸드 전에 확인하세요.`

기존 `data-testid`는 유지한다(E2E 회귀 최소화).

#### 1.2.1 dirty 좌석 accounting — 실제 검토 결과

현재 구현은 **어떤 스택도 건드리지 않고** 딜인 좌석 전부를 dirty로 표시한다. 즉 폴드한
좌석의 스택도 핸드 시작 전 값 그대로 남아 실제보다 크다.

정확한 사실 관계:

- **이미 FOLD한 좌석**: 이 좌석이 이 핸드에 넣은 총 기여(블라인드/안티 포함)는 되돌아오지
  않는다. uncalled-bet 반환은 마지막 공격자에게만 발생하고, 마지막 공격자는 정의상 폴드하지
  않았다. 따라서 폴드한 좌석의 종료 스택은 **정확히** `시작 스택 − 총 기여`이다.
- **폴드하지 않은 딜인 좌석**(all-in 포함): 이후 액션과 팟 분배를 모르므로 종료 스택은
  **알 수 없다.**
- **딜인되지 않은 좌석**: 변화 없음.

따라서 규칙은:

```
for each dealt-in seat:
    if seat is FOLDED at skip time:
        stack := startingStack − totalContribution     (Money.sub, 엔진 값 재사용)
        not dirty
    else:
        stack := 변경 없음
        DIRTY
```

히어로에 대한 특례는 없다. 히어로도 폴드했으면 정확히 계산되고, 안 했으면 dirty다.

**알려진 귀결(문서화 필수)**: 폴드한 좌석에서 빠진 칩은 팟으로 갔지만 그 팟은 분배되지 않고
버려진다. 즉 테이블 총 칩이 감소한다. 이는 "나머지 결과를 모른다"는 사실의 정직한 표현이며,
dirty 좌석을 사용자가 실제 관찰값으로 수정하는 것으로 해소된다. 이 핸드는 저장되지도,
학습에 쓰이지도 않으므로 어떤 영구 기록도 오염시키지 않는다.

#### 1.2.2 reason

`skipped_hands`에 `reason` 컬럼을 **additive**로 추가한다 (아래 §3.1).

허용 값: `QUICK_SKIP` | `HERO_FOLDED_UNOBSERVED`

결정 규칙(사용자가 고르지 않는다, view에서 파생):

- 히어로가 딜인되어 있고 skip 시점에 히어로 상태가 FOLDED → `HERO_FOLDED_UNOBSERVED`
- 그 외 → `QUICK_SKIP`

기존 행은 `NULL`("사유가 기록되지 않음")로 남는다. 새 기록은 항상 값을 보낸다.

---

## 2. WP별 계약

### WP-1. 즉시 자리비움

- `copy.ts`의 `SEAT_OCCUPANCY_TOGGLE_STATE` / `SeatOccupancyToggleTiming`에서 "다음 핸드부터"
  의미를 제거한다. 자리비움은 항상 즉시다.
- 진행 중 핸드가 있으면 §1.1 rebase를 탄다. 확인 대화상자 없음.
- 재계산되어야 하는 것: 라인업, position badge, 블라인드/안티, SB/BB, action order,
  Strategy. 이들은 전부 rebase 후 `engineStartHand` + 기존 파이프라인이 자동으로 처리한다 —
  **직접 다시 계산하지 않는다.**
- 좌석 점유 변경은 §4 persistence를 탄다.

### WP-2. 플레이어 즉시 교체

- 모든 좌석에 항상 `[플레이어 변경]`을 노출한다.
- 검색 가능한 dropdown: 기존 `searchPlayersAction`(닉네임 자동완성)을 재사용한다.
- `[새 플레이어 추가]`: nickname + external HUD 10개 필드를 즉시 입력.
- **한 세션에서 같은 player를 두 좌석에 둘 수 없다.** 서버 액션이 authoritative하게 거부하고,
  dropdown도 이미 앉은 플레이어를 비활성화 + 사유를 표시한다.
- 저장 직후: player 생성/재사용 → external HUD 스냅샷 append → 좌석 연결 → Player Profile 갱신
  → **ADAPTIVE만 recompute**(`adaptiveStore.upsertInput`). REFERENCE는 손대지 않는다.
- 진행 중 핸드가 있으면 §1.1 rebase.
- 닉네임 정규화/중복 방지는 `session-service.ts`의 `resolvePlayer` 패턴을 **재사용**한다.
  두 번째 시스템을 만들지 않는다.
- **EMPTY 좌석에 새로 앉히는 것도 같은 경로로 지원한다.** 6-max 실전에서 빈 자리에 사람이
  앉는 것은 흔한 일이고, 그것까지 되어야 테이블을 화면에서 완전히 고칠 수 있다. 다만 이때는
  시작 스택이 반드시 필요하다 — 엔진이 0 이하 스택을 거부하고, 이전 사람의 스택을 물려주는 것은
  값을 지어내는 것이다. 따라서 EMPTY 좌석에 앉힐 때만 스택 입력이 필수이고, 그 값이 곧 실제
  관찰값이므로 그 좌석은 dirty가 아니다.
- **교체된 좌석은 dirty로 표시한다.** 새로 앉은 사람의 스택은 알 수 없다. 이전 플레이어의
  스택을 그대로 새 사람의 스택이라고 주장하지 않는다 — 좌석은 `확인 필요`가 되고 사용자가
  WP-5의 inline 입력으로 실제 값을 넣는다. 스택을 지어내지 않기 위한 것이며, 같은 플레이어를
  다시 고른 경우(변경 없음)에는 dirty로 만들지 않는다.

### WP-3. 빠른 external HUD 수정

- `PlayerProfilePanel`에서 10개 필드를 편집하고 저장.
- **UPDATE 금지 — 새 스냅샷 append.** `createExternalHudSnapshot`(player-core) 검증을 통과해야
  한다. `importBatchId`는 수기 입력임이 드러나는 값으로, 비어 있으면 안 된다.
- 빈 필드는 stats 배열에서 생략. 0으로 바꾸지 않는다.
- ADAPTIVE는 항상 최신 external HUD 스냅샷을 사용한다(`latestExternalHudSnapshot` 기존 로직).
- 저장 직후 현재 Hero decision이 있으면 **ADAPTIVE만** recompute. REFERENCE는 bit-identical.

### WP-4. 빠른 다음 핸드

§1.2 참조.

### WP-5. 스택 리싱크

- 각 SeatCard에서 스택 숫자를 클릭 → inline input → Enter. 별도 패널을 열 필요 없음.
- 소수 BB 입력 → milliBB 안전 변환. **0 이하 / 파싱 불가 거부** (클라이언트가 서버와 동일하게
  거부한다 — 과거 auto-top-up MAJOR의 재발 방지).
- 즉시 화면 반영 + §4 persistence로 reload 후 유지.
- **완료된 핸드(`hands` 등)의 스택은 절대 다시 쓰지 않는다.**
- dirty 좌석에는 `⚠ 확인 필요` + 눈에 띄는 입력을 노출.
- Enter 시 **다음 dirty 좌석 input으로 자동 포커스 이동**. 4~5명을 몇 초 안에 처리 가능해야 한다.

### WP-6. 버튼/포지션 리싱크

- SeatCard의 `[버튼으로 지정]` 유지·강화. 진행 중 핸드가 있으면 §1.1 rebase.
- SB/BB/position 전부 즉시 재계산(rebase가 자동 처리).
- 버튼 좌석은 §4 persistence를 탄다.

### WP-7. REFERENCE + ADAPTIVE 동시 표시

- **모드 전환 탭(`strategy-mode-*`)을 제거한다.** Hero decision에서는 두 섹션이 항상 동시에 보인다.
- 델타는 이미 도메인에 있다 — 새로 계산하지 않는다:
  - 빈도: `AdaptiveAction.deltaBps` (부호 있음) → `BET +4%p` 형태
  - 사이징: `AdaptiveSizing.fromBucketIndex/toBucketIndex/bucketDelta` +
    `fromToAmountMbb`/`toToAmountMbb` → `50% → 67% POT` 형태
- **엔진이 실제로 만든 단위만 표시한다.** 포스트플랍은 pot fraction 버킷이 존재하고, 프리플랍은
  금액(BB)이다. 없는 %를 지어내지 않는다.
- "왜 이렇게 바뀌었나요?" 섹션: `AdaptiveAdjustment.reasonKey` / `cappedBy` / 근거 수치를
  `copy.ts`의 exhaustive Record로 문장화한다. **문장은 adaptive-core가 아니라 copy.ts가 만든다.**
- 상대 데이터가 없으면(`status === 'INSUFFICIENT_DATA'`):
  > 상대 맞춤 · ADAPTIVE / 상대 데이터 없음 → 기본전략과 동일
  > 가상의 통계를 만들지 않는다.

### WP-8. 카드 피커 확대

- 현재 카드 버튼: `h-6 w-8` (24×32px). 요구: **최소 44×52px**, desktop 48~56px 지향.
- rank/suit 글자 크게, 카드 간 간격 충분히.
- 4행(suit) × 13열(rank) 기존 방향을 유지한다(`docs/UX.md`의 팔레트 규약). desktop 너비를 활용.
- 이미 선택되었거나 보드/다른 손에 존재하는 카드: `disabled` + 명확히 흐리게.
- 선택된 카드: 강한 border/highlight.
- 현재 무엇을 고르는 중인지 크게 표시("Hero 카드 선택", "Flop 카드 선택" 등) + 슬롯 표시
  (`[카드 1] [카드 2]`, `[1] [2] [3]`).
- 카드 선택 후 다음 슬롯으로 자동 진행. 잘못 고른 카드는 쉽게 해제/교체.
- **키보드 입력 경로(`resolveTypedKey` → `entry.handleKey`, rank→suit 2단계)는 깨지지 않는다.**
- `data-testid="palette-As"` 형식의 기존 testid를 유지한다.

### WP-9. 우측 패널 우선순위

- 현재 `rightPanelFor()`는 좌석 선택을 최우선으로 두어 **좌석 클릭 시 전략이 사라진다.** 이를 뒤집는다.
- 새 규약:
  - Hero가 액터면 → **전략(REFERENCE+ADAPTIVE)이 리드**. 좌석이 선택되어 있으면 Player Profile은
    전략 **아래 drawer**로 함께 보인다.
  - Hero가 액터가 아니고 좌석이 선택되어 있으면 → Player Profile이 리드.
  - 둘 다 아니면 → action history.
- `rightPanelFor`의 반환을 `{ lead, drawer }` 형태로 확장하고 기존 테스트를 새 규약으로 갱신한다.
  **전략이 좌석 선택 때문에 사라지는 경로는 존재하면 안 된다.**

---

## 3. 데이터베이스 변경

### 3.1 마이그레이션 `0009` — `skipped_hands.reason`

```sql
ALTER TABLE skipped_hands ADD COLUMN reason TEXT
  CHECK (reason IS NULL OR reason IN ('QUICK_SKIP','HERO_FOLDED_UNOBSERVED'));
```

- **Additive only.** 기존 행은 `NULL`을 유지한다(사유가 기록되지 않은 과거 행).
- `skipped_hands`는 insert-only 트리거가 이미 걸려 있다. 트리거는 그대로 두고 재생성하지 않는다.
- `schema.ts`, `rows.ts`, `repositories/skipped-hands.ts`, `skip-hand-contract.ts`,
  `skip-hand-service.ts`, `actions/skip-hand.ts`를 함께 갱신한다.
- `packages/db/tests/migrations.test.ts`와 `insert-only.test.ts`의 exhaustive 목록을 갱신한다.
- `drizzle-kit generate`가 트리거를 만들지 못하는 관행은 그대로 — 이 마이그레이션은 트리거를
  추가하지 않으므로 문제 없다.

### 3.2 세션 좌석 상태 저장

`packages/db/src/repositories/sessions.ts`에 이미 `updateSessionTable`이 있으나 `apps/web`
어디에서도 호출되지 않는다(`docs/STATE.md` known issue). 전체 `TableState`를 wire로 보내는 대신
**좁은 좌석 단위 갱신**을 추가한다 — 기존 `updateSessionSeatAutoTopUp` /
`updateSessionSeatOccupancy` 컨벤션과 같은 모양이다.

추가할 것:

- `updateSessionSeats(db, sessionId, seats)` — 좌석별 `occupancy`/`playerId`/`stack`만 일괄 갱신.
  `sessions.config`/`hero`는 건드리지 않는다.
- `updateSessionButtonSeat(db, sessionId, buttonSeat)` — 버튼 좌석만.

`handNumber`는 여기서 쓰지 않는다. `insertCompletedHand`가 이미 자기 트랜잭션에서 단조 증가시키고
`loadSessionView`가 저장된 최대 hand_number로 보정하는 기존 규약을 그대로 둔다.

**위험 등급: DB 쓰기 경로 — 즉시 검증 대상.** 실제 인메모리 SQLite에 대한 통합 테스트 필수.

---

## 4. Persistence 경계 (WP-5 + WP-1/2/6)

세션의 좌석 상태는 다음 **핸드 사이 경계**에서 서버에 기록된다:

1. 스택 수동 정정 (WP-5)
2. 좌석 자리비움/복귀 (WP-1) — 기존 `updateSeatOccupancyAction` 재사용
3. 좌석 플레이어 교체 (WP-2)
4. 버튼 좌석 지정 (WP-6)
5. 핸드 정산 직후(다음 핸드 시작 시 스택이 확정된 시점) 및 빠른 다음 핸드 직후

기존 posture를 따른다: **unawaited fire-and-forget + 실패 시 정직한 배너**, 되돌리지 않는다.
저장 실패가 진행을 막지 않되 "저장되지 않았다"는 사실은 숨기지 않는다.

`hands` / `hand_events` / 분석 스냅샷은 **절대** 다시 쓰지 않는다.

---

## 5. 작업 분할과 파일 소유권 (동시 writer 금지)

| WP-그룹                          | 소유 파일                                                                                                                                                | 비고                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **A. DB + skip reason**          | `packages/db/**`, `apps/web/src/lib/table/skip-hand-contract.ts`, `apps/web/src/server/skip-hand-service.ts`, `apps/web/src/server/actions/skip-hand.ts` | §3.1 + §3.2                  |
| **B. 서버 액션**                 | `apps/web/src/server/**`(skip-hand 제외), `apps/web/src/lib/table/contract.ts`                                                                           | WP-2/3/5 서버측              |
| **C. 카드 피커**                 | `apps/web/src/components/table/CardPalette.tsx`(+test), `apps/web/src/lib/table/cardEntry.ts`                                                            | WP-8                         |
| **D. 스토어**                    | `apps/web/src/lib/table/tableStore.ts`(+test)                                                                                                            | WP-1/2/4/5/6 도메인 전이     |
| **E. 전략 패널 + 패널 우선순위** | `StrategyPanel.tsx`(+test), `lib/table/rightPanel.ts`(+test), `lib/table/copy.ts`                                                                        | WP-7/9. **copy.ts는 E 전용** |
| **F. 테이블 통합 UI**            | `TableRoot.tsx`, `SeatCard.tsx`, `SeatCorrectionPanel.tsx`, 신규 좌석 플레이어 패널, `PlayerProfilePanel.tsx`, `app/table/[sessionId]/page.tsx`          | WP-1/2/3/5/6/9 UI            |
| **G. E2E**                       | `apps/web/tests/e2e/**`                                                                                                                                  | WP-10                        |
| **H. 문서**                      | `docs/DECISIONS.md`, `docs/STATE.md`, `docs/reports/**`                                                                                                  | 오케스트레이터               |

같은 파일에 두 에이전트가 동시에 쓰지 않는다. A→D, B→F, E→F 순으로 의존한다.

---

## 6. 완료 기준

- `pnpm typecheck` / `pnpm lint` / `pnpm build` green
- `pnpm test` 전체 green — **기존 assertion 삭제·약화 금지**
- `pnpm e2e` green, WP-10의 긴 시나리오 포함
- 검증 항목: correction ≠ skip / quick skip은 정확히 1회 로테이션 / correction은 handNumber 불변 /
  가짜 completed hand 없음 / 가짜 player observation 없음 / 중복 player 없음 /
  최신 external HUD 적용 / **REFERENCE 불변**
