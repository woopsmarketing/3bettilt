# WP-10 / 작업 G — Playwright E2E 보고서

**날짜:** 2026-09-03 · **범위:** `apps/web/tests/e2e/**` 전용 (제품 코드 무수정)
**결과:** `pnpm e2e` → **31 passed / 1 failed**. 유일한 실패는 제품 레이아웃 회귀(§4-1)이며
테스트 문제가 아니다.

---

## 1. 변경/추가한 스펙

| 파일 | 한 줄 |
| --- | --- |
| `tests/e2e/helpers.ts` | `stackOf`를 `seat-N-stack` testid로 교체하고 `selectSeat` / `handNumber` / `foldOut` / `pickCards` / `recordServerActions` 추가 |
| `tests/e2e/seat-occupancy.spec.ts` | "다음 핸드부터" 계약을 ADR-0073 rebase 계약으로 전면 재작성 (즉시 반영·handNumber 불변·버튼 불변·dirty 없음·재구성 알림·서버 왕복 1회) |
| `tests/e2e/skip-hand.spec.ts` | 버튼 정정 = rebase(라이브 핸드 존재, 블라인드 재계산)로 재작성 + 빠른 다음 핸드의 "정확히 1회전 / +1" 주장 추가 |
| `tests/e2e/adaptive-strategy.spec.ts` | 모드 탭 제거 → REFERENCE/ADAPTIVE 동시 표시로 강화, 좌석 클릭 시 `data-panel=STRATEGY` + `data-drawer=PLAYER` 검증, 드로어 열린 채로 REFERENCE 불변 검증 |
| `tests/e2e/hands-on-table-v2.spec.ts` (신규) | WP-10 전체 시나리오 1개 (아래 §3) |
| `tests/e2e/seat-state-persistence.spec.ts` (신규) | ADR-0075: 스택 정정 / 자리비움 / 버튼 지정이 **새로고침 후에도** 남고, 복원된 상태로 실제 딜까지 되는지 |
| `tests/e2e/session-setup.spec.ts` | 좌석 선택을 `selectSeat` 헬퍼로 교체 (센터 클릭이 스택 버튼에 떨어지는 위험 제거) |
| `tests/e2e/action-dock.spec.ts` | 독 고정/트레이 고정 주장을 분리·주석화 (독이 먼저, 트레이가 나중) — 트레이 주장이 §4-1을 잡아낸다 |

## 2. 새 헬퍼 시그니처

```ts
export const stackOf: (page: Page, seat: number) => Locator;          // seat-N-stack
export const selectSeat: (page: Page, seat: number) => Promise<void>; // 카드 좌상단 (4,4) 클릭
export const handCounter: (page: Page) => Locator;
export function handNumber(page: Page): Promise<number>;
export function foldOut(page: Page, count: number): Promise<void>;
export function pickCards(page: Page, cards: readonly string[]): Promise<void>;
export function recordServerActions(page: Page): readonly string[];
```

- `selectSeat`가 좌표 클릭인 이유: 카드 중앙은 이제 스택 버튼(`stopPropagation`) 위다.
  내부 testid 후보였던 `seat-N-status`는 `SEAT_STATUS_LABEL.IN_HAND === ''` 때문에 **크기 0**이라
  클릭 불가 — 항상 렌더되면서 항상 비어 있지 않은 자식이 없다.
- `handNumber`는 이 스위트에서 **유일하게 카피 문자열로 찾는** 로케이터다. 헤더의 핸드 카운터에
  `data-testid`가 없다. → 제품 측 개선 제안(§4-3).

## 3. WP-10 시나리오가 고정하는 불변식

`hands-on-table-v2.spec.ts` 한 테스트가 순서대로 실행한다:

6인 세션 → 핸드 시작 → **SB 좌석 자리비움**(즉시 rebase, SB/BB 이동, handNumber·버튼 불변, dirty 없음)
→ **좌석 5 플레이어 교체**(새 닉네임 + external HUD 2개만 입력, 8개 공란, 교체 좌석만 dirty, rebase)
→ 히어로 폴드(핸드는 살아 있음) → **빠른 다음 핸드**(정확히 1회전 + handNumber +1)
→ **폴드 좌석은 dirty 아님 + 스택이 정확히 계산됨**(BTN 99.84 BB, 히어로 SB 99.34 BB)
→ 인라인 스택 정정(0 거부 → 88.5 저장 → **Enter가 다음 dirty 좌석으로 포커스 이동** → 77.25)
→ 동일 닉네임 재검색 시 **매치 1건 + disabled + 사유 표시**(중복 player 없음)
→ 버튼 정정(핸드 없음 → 알림 없음, handNumber 불변) → 다음 핸드 시작
→ 커진 카드 팔레트로 히어로 카드 → BTN 오픈 2.5 → 히어로 결정 지점
→ **REFERENCE + ADAPTIVE 동시 표시**, 좌석 클릭해도 전략 유지(`data-drawer=PLAYER`)
→ external HUD append(70% → 85%, 공란은 계속 `알 수 없음`) → **REFERENCE 완전 동일**(before/after 객체 비교)
→ ADAPTIVE는 `ADAPTED` + 상대 이름 + `adaptive-reason-FOLD_TO_3BET_HIGH` + `adaptive-source-note-EXTERNAL_HUD`
→ flop/turn/river 입력 → award → **저장된 핸드 0 → 1**, 새로고침 후에도 1.

즉 "가짜 completed hand 없음"은 rebase 2회 + 빠른스킵 1회 뒤에도 저장 카운트가 `0`이라는
직접 주장으로 고정되어 있다.

## 4. 제품 코드 문제 (수정하지 않음, 보고만)

### 4-1. (MAJOR, 유일한 E2E 실패) 커진 카드 팔레트가 entry tray의 floor를 넘어 레이아웃이 120px 점프한다

- **파일:** `apps/web/src/components/table/TableRoot.tsx:1324` 부근
  (`entry-tray`: `max-h-[17rem] min-h-[9.5rem]`) + `CardPalette.tsx`(WP-8 확대)
- **재현:** 1440×800, 5인 세션 → `핸드 시작` → 팔레트가 열림 → 히어로 카드 2장 선택 → 팔레트 닫힘.
- **측정값(실측):**
  - 카드 버튼 실제 크기 `56 × 64px` (WP-8 요구 충족).
  - 팔레트 자연 높이 **354px**, 팔레트를 담은 스크롤 컨테이너 높이 **259px**
    → **95px가 잘려 스크롤**된다. 마지막 suit 행이 화면 밖.
  - 트레이 높이: 팔레트 열림 **272px**(= `max-h` 17rem 한계), 팔레트 닫힘 **152px**(= `min-h` floor).
  - 결과: felt/tray 경계가 팔레트를 열고 닫을 때마다 **정확히 120px 위아래로 점프**한다.
- **왜 버그인가:** `TableRoot.tsx` 상단 레이아웃 주석이 아직도 *"The card palette and the keyboard
  legend both fit inside that floor, so the two states the user moves between constantly —
  palette open, palette gone — change nothing below them"* 라고 주장한다. WP-8 확대로 이 전제가
  깨졌고, floor가 존재하는 이유였던 "Alpha의 하단 점프"가 되돌아왔다.
- **액션 독 자체는 안전:** `h-screen` 컬럼의 마지막 `shrink-0` 자식이라 뷰포트 하단에 계속 고정된다
  (해당 assertion은 통과). 움직이는 것은 트레이/펠트 경계뿐이다.
- **테스트 상태:** `action-dock.spec.ts:110`의 `expect(trayAfter.y).toBe(trayBefore)` 를
  **약화하지 않고 그대로 두었다**(CLAUDE.md rule 13). 이 1건이 유일한 red다.
- **수정 방향(제안, 미적용):** 트레이 floor를 팔레트 실제 높이로 올리거나, 팔레트를 4행 고정
  대신 desktop 폭을 더 쓰게 하거나, 팔레트가 열려도 트레이 높이가 변하지 않도록 floor = max로 고정.

### 4-2. (MINOR) `hand-rebased-notice`가 핸드를 넘겨도 사라지지 않는다

- **파일:** `apps/web/src/lib/table/tableStore.ts` — `rebaseNotice`는 `dismissRebaseNotice()`
  에서만 `null`이 되고, `skipHand()`(≈655-745행)와 `startHand()` 어디에서도 초기화되지 않는다.
- **재현:** 핸드 중 자리비움 → 알림 표시 → 닫지 않고 `빠른 다음 핸드` → 다음 핸드 시작.
  "좌석 변경으로 **현재 핸드**를 처음부터 다시 구성했습니다"가 이미 존재하지 않는 핸드에 대해
  계속 떠 있다.
- 위험도 낮음(정보성·dismissable)이지만 문구가 "현재 핸드"를 주장하므로 오해 소지가 있다.
- 시나리오 스펙은 사용자가 알림을 닫는 현실적 동작을 넣어 우회했고, 우회 사실을 주석에 남겼다.

### 4-3. (NIT) 헤더의 핸드 번호에 `data-testid`가 없다

- **파일:** `apps/web/src/components/table/TableRoot.tsx:951` 부근 (`… · 핸드 {table.handNumber}`)
- V2 계약에서 가장 중요한 값(correction ≠ skip)인데 testid가 없어 E2E가 카피 정규식으로 읽는다.
  `data-testid="hand-number"` 또는 `data-hand-number` 하나면 이 스위트의 마지막 카피 결합이 사라진다.

## 5. 남은 위험 / 커버하지 못한 것

- **정확 스택 주장(99.84 / 99.34 BB)은 앤티 정책에 결합**되어 있다. 세션 기본 앤티(BB의 16%)가
  바뀌면 이 두 줄이 깨진다 — 의도된 회귀 신호지만, 값이 아니라 정책이 바뀐 것임을 알고 봐야 한다.
- **ADAPTIVE는 `data-changed`를 주장하지 않는다.** `ADAPTED` + 상대 이름 + `FOLD_TO_3BET_HIGH`
  사유 + `EXTERNAL_HUD` 출처까지만 고정했다. 믹스가 실제로 움직이는지는 정책 상수(gain/cap/anchor)에
  달려 있고, 그 산술은 `adaptive-core` 자체 스위트가 소유한다. 여기서 `changed=true`를 못 박으면
  E2E가 정책 튜닝마다 깨진다.
- **EMPTY 좌석에 새 플레이어 앉히기**(WP-2의 `seatedEmpty` 경로, 스택 필수 + dirty 아님)는
  E2E로 덮지 않았다. 시나리오가 6좌석을 모두 채워 시작하기 때문. 컴포넌트/스토어 테스트에는 있다.
- **`seat-state-save-error` / `external-hud-error` 배너의 실패 경로**는 검증하지 않았다
  (성공 경로에서 배너가 없다는 것만 확인). 서버 실패 주입 수단이 E2E에 없다.
- **reload 후 handNumber**는 의도적으로 주장하지 않았다 — ADR-0075가 빠른스킵 핸드 번호는
  저장되지 않는다고 명시한다.
- `selectSeat`의 좌표 클릭은 카드 패딩(px-2 py-1)에 의존한다. 패딩이 0이 되면 깨진다.
