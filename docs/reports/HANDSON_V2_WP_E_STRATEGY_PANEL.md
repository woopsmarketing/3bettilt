# 작업 E — WP-7 (REFERENCE + ADAPTIVE 동시 표시) / WP-9 (우측 패널 우선순위) / copy.ts

담당 범위: `StrategyPanel.tsx(+test)`, `lib/table/rightPanel.ts(+test)`, `lib/table/copy.ts(+test)`.
`TableRoot.tsx` / `SeatOccupancyToggle.tsx` 는 건드리지 않았다 (작업 F 소유).

## 1. 변경한 파일

| 파일 | 내용 |
| --- | --- |
| `apps/web/src/components/table/StrategyPanel.tsx` | 모드 전환 제거, 두 섹션 동시 렌더, 델타 `%p`, 사이징 from→to |
| `apps/web/src/components/table/StrategyPanel.test.tsx` | 모드 전환 테스트 → 동시 표시 / 델타 / 사이징 / 무데이터 테스트 |
| `apps/web/src/lib/table/rightPanel.ts` | `rightPanelLayoutFor` 신설, 우선순위 역전, 헤더 주석 재작성 |
| `apps/web/src/lib/table/rightPanel.test.ts` | 새 규약으로 갱신 + 전 입력공간 property 테스트 |
| `apps/web/src/lib/table/copy.ts` | WP-7 문구, 좌석/핸드 문구, 외부 HUD 라벨, 자리비움 타이밍 제거 |
| `apps/web/src/lib/table/copy.test.ts` | 위 문자열 테스트, 자리비움 타이밍 테스트 갱신 |

## 2. 새 / 변경된 공개 API (작업 F가 그대로 쓴다)

```ts
// apps/web/src/lib/table/rightPanel.ts
export type RightPanelKind = 'STRATEGY' | 'PLAYER' | 'HISTORY';
export interface RightPanelLayout {
  readonly lead: RightPanelKind;
  readonly drawer: 'PLAYER' | null;
}
export interface RightPanelInput {
  readonly selectedPlayerSeat: SeatIndex | null;
  readonly heroIsActor: boolean;
}
export function rightPanelLayoutFor(input: RightPanelInput): RightPanelLayout;
/** 얇은 래퍼로 유지 — `rightPanelLayoutFor(input).lead` 만 반환한다. */
export function rightPanelFor(input: RightPanelInput): RightPanelKind;
```

규약:

- `heroIsActor === true` → `{ lead: 'STRATEGY', drawer: 좌석선택 ? 'PLAYER' : null }`
- `heroIsActor === false && selectedPlayerSeat !== null` → `{ lead: 'PLAYER', drawer: null }`
- 그 외 → `{ lead: 'HISTORY', drawer: null }`
- **`heroIsActor`가 true인데 `lead`가 STRATEGY가 아닌 입력은 존재하지 않는다** (테스트가 14개
  입력 전체로 고정).

`rightPanelFor`를 남긴 이유: `TableRoot.tsx`가 계속 컴파일되게 해서 작업 F가 자기 커밋에서
2-슬롯 컬럼으로 옮길 수 있게 하기 위함. 지금 상태의 `TableRoot`는 hero가 액터일 때 전략만
보이고 프로필 drawer는 안 보인다(= 뒤집힌 옛 동작은 아님).

```ts
// apps/web/src/components/table/StrategyPanel.tsx
export interface StrategyPanelProps { compute?; opponentInputs?; adaptiveVersion? } // 변경 없음
// 제거: export type StrategyMode
```

```ts
// apps/web/src/lib/table/copy.ts — 시그니처 변경
export const SEAT_OCCUPANCY_TOGGLE_STATE: Readonly<Record<SeatOccupancy, string>>; // 중첩 제거
export function seatOccupancyToggleState(occupancy: SeatOccupancy): string;        // 인자 1개
// 제거: export type SeatOccupancyToggleTiming
```

## 3. testid 변경

**제거**

- `strategy-mode-selector`
- `strategy-mode-REFERENCE`
- `strategy-mode-ADAPTIVE`
- `strategy-panel`의 `data-mode` 속성

**추가**

- `strategy-reference-section` (REFERENCE 헤딩 + 본문)
- `strategy-adaptive-section` (ADAPTIVE 블록 래퍼)
- `adaptive-delta-{ACTION_KIND}` (행별 `%p` 델타)
- `adaptive-sizing` (`data-from-bucket` / `data-to-bucket` / `data-bucket-delta`)
- `adaptive-same-as-reference` (INSUFFICIENT_DATA일 때 `→ 기본전략과 동일`)
- `adaptive-reasons-heading` (`왜 이렇게 바뀌었나요?`)

**유지**: `strategy-panel`, `strategy-engine-label`(항상 `기본전략 · REFERENCE`),
`strategy-actions`, `strategy-sizing`, `adaptive-panel`, `adaptive-heading`,
`adaptive-opponent`, `adaptive-status`, `adaptive-status-reason`, `adaptive-primary`,
`adaptive-baseline`, `adaptive-delta`, `adaptive-actions`, `adaptive-reasons`,
`adaptive-shift`, `adaptive-provenance`, `adaptive-none`, `adaptive-sizing-clamp`.

**문구 변경 (E2E 영향)**

- INSUFFICIENT_DATA: `데이터 부족 — REFERENCE 사용 중` → `상대 데이터 없음` + 별도 줄
  `→ 기본전략과 동일`
- 이유 목록 헤딩: `이유` → `왜 이렇게 바뀌었나요?`
- 델타 단위: `+30%` → `+30%p`, 0이면 `변화 없음`

> **작업 G 대상**: `apps/web/tests/e2e/adaptive-strategy.spec.ts` 가 `strategy-mode-*` 를
> 쓰고 있으므로 반드시 수정해야 한다. `data-mode`도 없어졌다.

## 4. copy.ts에 추가한 export

WP-7:

- `ADAPTIVE_NO_CHANGE_LABEL` (`변화 없음`)
- `ADAPTIVE_REASONS_HEADING` (`왜 이렇게 바뀌었나요?`)
- `ADAPTIVE_NO_OPPONENT_DATA_LABEL` (`상대 데이터 없음`)
- `ADAPTIVE_SAME_AS_REFERENCE_LABEL` (`→ 기본전략과 동일`)
- `ADAPTIVE_UNCHANGED_LABEL` (`조정 없음`)
- `ADAPTIVE_UNCHANGED_PLAIN_REASON` (`조정 결과가 기본전략과 같음`)
- `adaptiveOpponentLabel(name)` → `상대: Shadow7`
- `signedBpsPointsLabel(bps)` → `+4%p` / `-4%p` / `변화 없음`
- `SIZING_RECOMMENDATION_LABEL` (`추천 사이즈`, REFERENCE·ADAPTIVE 공용)

좌석/핸드 (작업 F용, 미리 추가):

- `HAND_REBASED_NOTICE`
- `QUICK_NEXT_HAND_LABEL`, `QUICK_NEXT_HAND_DESCRIPTION`
- `SEAT_DIRTY_BADGE` (`확인 필요`), `SEAT_DIRTY_ACTION_LABEL` (`스택 입력`)
- `PLAYER_SWAP_LABEL`, `PLAYER_SWAP_NEW_LABEL`
- `PlayerSwapRejection` (`'ALREADY_SEATED'`), `PLAYER_SWAP_REJECTION_LABEL`
- `STACK_EDIT_LABEL`, `StackEditRejection` (`'NOT_A_NUMBER' | 'NOT_POSITIVE'`),
  `STACK_EDIT_REJECTION_LABEL`

외부 HUD:

- `EXTERNAL_HUD_STAT_LABEL: Readonly<Record<ExternalHudStatKey, string>>`
  (`VPIP`, `PFR`, `3Bet`, `Fold to 3Bet`, `CBet`, `Fold to CBet`, `Steal`, `Check/Raise`,
  `WTSD`, `WSD`) — `@gto-self/player-core`의 유니온에 대해 exhaustive
- `EXTERNAL_HUD_EMPTY_MEANS_UNKNOWN_HINT`

제거: `SeatOccupancyToggleTiming` 및 `SEAT_OCCUPANCY_TOGGLE_STATE`의 `NEXT_HAND` 값.

## 5. 실행한 테스트

```
npx vitest run --project web \
  apps/web/src/components/table/StrategyPanel.test.tsx \
  apps/web/src/lib/table/rightPanel.test.ts \
  apps/web/src/lib/table/copy.test.ts
→ 3 files, 62 tests, PASS
```

`npx eslint` (6개 소유 파일) PASS. `npx prettier --check` — 내가 추가한 코드는 clean
(copy.ts / StrategyPanel.test.tsx의 남은 warn 3건은 이번 작업 이전부터 있던 drift라 손대지
않았다).

`pnpm test` 전체 / `pnpm build` / `pnpm e2e` 는 동시 작업 중이라 실행하지 않았다.

## 6. 남은 위험 / 작업 F가 알아야 할 것

1. **`SeatOccupancyToggle.tsx(60)` typecheck 에러 (예상됨)**:
   `seatOccupancyToggleState(occupancy, pending)` → 인자 1개로 바꿔야 한다. `pending` 개념
   자체가 사라졌으므로 호출부의 pending 계산도 같이 제거하는 게 맞다.
2. **`TableRoot.tsx(281)` typecheck 에러는 내 변경과 무관**하다 (`SkipHandAuditValue.reason`
   누락 — 다른 작업의 진행 중 상태).
3. `TableRoot.tsx`는 아직 `rightPanelFor`(lead only)를 쓰고 있어 컴파일은 되지만 drawer가
   렌더되지 않는다. `rightPanelLayoutFor`로 옮기고 `layout.drawer === 'PLAYER'`일 때
   전략 아래에 `PlayerProfilePanel`을 붙여야 WP-9가 완성된다.
4. REFERENCE 계산 경로는 손대지 않았다. `useEffect` + `setTimeout(0)` 구조, ADAPTIVE는
   `useMemo` 구조 그대로이며, "HUD 저장 시 ADAPTIVE만 재계산" 테스트가 그대로 통과한다.
5. 디자인 mock은 `추천 크기`라고 썼지만 기존 REFERENCE 문구와 그 테스트가 `추천 사이즈`를
   고정하고 있어 **두 섹션 모두 `추천 사이즈`(`SIZING_RECOMMENDATION_LABEL`)로 통일**했다.
   오케스트레이터가 `추천 크기`를 원하면 상수 한 줄만 바꾸면 된다.
6. `EXTERNAL_HUD_GLOSSARY`의 `ExternalHudGlossaryKey`는 `ExternalHudStatKey`와 같은 10개
   멤버를 로컬에 다시 선언한 중복 유니온이다. 이번 범위 밖이라 두었고, 새 라벨 맵은 도메인
   유니온을 직접 참조한다.
