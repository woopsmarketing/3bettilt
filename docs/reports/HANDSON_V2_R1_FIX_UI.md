# Hands-on Table UX V2 — review round R1, fix pass 3 (UI)

**날짜:** 2026-09-03 · **범위:** `apps/web` 표시 계층만 (store / server / db 는 다른 소유자가 이미 완료)

---

## 1. 변경/추가한 파일

| 파일 | 내용 |
| --- | --- |
| `apps/web/src/components/table/TableRoot.tsx` | 트레이 floor 재산정, `seatStackUnverified` prop, `stackUnverified` 전송, skip 감사 실패 배너, 플레이어 교체 순서/거부 처리, `requireNew` 전달, `createdPlayer` 알림, 버튼 이동 알림, `hand-number` testid, 낡은 주석 재작성 |
| `apps/web/src/components/table/CardPalette.tsx` | 프롬프트 열을 그리드 **옆으로** 이동(높이 축소), `unpick()` 추가, 선택 카드 토글, 슬롯 칩 버튼화 |
| `apps/web/src/components/table/SeatPlayerSwapPanel.tsx` | `requireNew` 전송, `PLAYER_EXISTS` → 안내 + PICK 모드 + 검색어 프리필 |
| `apps/web/src/components/table/SeatCorrectionPanel.tsx` | 하드코딩 한국어 → `copy.ts`, 낡은 모듈 주석 수정 |
| `apps/web/src/components/table/StrategyPanel.tsx` | 하드코딩 한국어 10곳 → `copy.ts` |
| `apps/web/src/components/table/SeatCard.tsx` | `data-selected` 노출 + 키보드 활성화 한계 문서화 |
| `apps/web/src/lib/table/copy.ts` | 신규 문구 추가, 죽은 export 2개 제거 |
| `apps/web/src/lib/table/rightPanel.ts` | `rightPanelFor` 제거 |
| `apps/web/src/app/table/[sessionId]/page.tsx` | `seatStackUnverified` 전달 |
| 테스트 | `TableRoot.test.tsx`(+13), `CardPalette.test.tsx`(+5), `StrategyPanel.test.tsx`, `rightPanel.test.ts`, `copy.test.ts` |

---

## 2. 팔레트 레이아웃 (항목 1, MAJOR)

**원인 두 가지.** WP-8이 카드를 24×32 → 56×64로 키웠는데 트레이 floor 는 `9.5rem`,
cap 은 `17rem` 그대로였다. 결과: 팔레트 자연 높이 354px 이 259px 스크롤 박스에 들어가
**clubs 행이 화면 밖**, 그리고 팔레트 열림/닫힘 사이에 트레이가 **120px 점프**(ADR-0054
floor 전제 붕괴).

**수정.**

1. 팔레트의 프롬프트(제목 · 슬롯 · 남은 장수 · 키보드 소유자 · 지우기)를 그리드 **위**가
   아니라 `sm:` 이상에서 **옆**으로 옮겼다. 그리드는 13장 폭(≈776px)뿐이라 트레이에
   가로 여백이 ~580px 남아 있었다. 카드 크기는 손대지 않고 높이 ~74px 을 회수.
2. 트레이: `max-h-[17rem] min-h-[9.5rem]` → **`max-h-[26rem] min-h-[18.5rem]`**.

**최종 치수**

| 항목 | 값 |
| --- | --- |
| 카드 hit area (desktop `sm:`) | **56 × 64 px** (WP-8 요구: 최소 44×52, desktop 48~56 폭 → 충족, 낮추지 않음) |
| 카드 hit area (narrow) | 44 × 52 px (`h-13 w-11`, 변경 없음) |
| 팔레트 그리드 높이 | 278 px (4 suit 행 × 64 + gap) |
| 트레이 floor / cap | 296 px (`18.5rem`) / 416 px (`26rem`) |

**실측 (실제 Chromium, dev 서버)**

| 뷰포트 | 보이는 카드 | 잘린 카드 | 팔레트 세로 스크롤 | 문서 스크롤 | dock 하단 | 펠트 높이 | 트레이 이동(열림→닫힘) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440×800 | 52 / 52 | 없음 | 없음 | 없음 | 800 | 384 px | 0 px |
| 1280×720 | 52 / 52 | 없음 | 없음 | 없음 | 720 | 304 px | 0 px |
| 1024×640 | 52 / 52 | 없음 | 없음 | 없음 | 640 | — | 0 px |

`award-submit` 하단 639.6 < dock 상단 739.4 (1440×800).

**중간에 발견한 회귀 (기록).** 프롬프트 열을 옮기기 전에 floor 를 `23rem`(368px)으로
올리는 안을 먼저 실측했더니 1440×800 은 통과했지만 **1280×720 에서 펠트가 36px 초과**해
좌석 카드 아래 칩(`seat-N-correction-toggle`)이 트레이에 덮여 클릭 불가가 되었고 E2E 5개가
깨졌다. "팔레트가 잘리는 버그"를 "펠트가 잘리는 버그"로 바꾼 셈이라 채택하지 않았다.
프롬프트 열 이동으로 필요 높이를 296px 로 줄여 두 문제를 모두 없앴다.

---

## 3. data-testid 변경 (E2E 소유자에게)

**추가**

| testid | 위치 | 용도 |
| --- | --- | --- |
| `hand-number` | `TableRoot` 헤더 | 핸드 번호. 기존 문장(`… 앤티 끔 · 핸드 1`)은 그대로라 `helpers.ts` 의 `HAND_COUNTER` 정규식 로케이터는 계속 동작한다. 이제 testid 로 바꿀 수 있다. |
| `skip-audit-save-error` | `TableRoot` 배너 | `skipped_hands` 감사 기록 실패 |
| `player-swap-notice` / `player-swap-notice-dismiss` | `TableRoot` 배너 | 새로 만든 플레이어인지 기존 플레이어인지 |
| `seat-{n}-swap-exists` | `SeatPlayerSwapPanel` | ADR-0079 `PLAYER_EXISTS` 안내 |

**속성 추가**

- `hand-rebased-notice` 에 `data-button-moved-to`(좌석 index, 안 움직였으면 빈 문자열)
- `seat-{n}` (`SeatCard`) 에 `data-selected="true|false"`

**의미가 바뀐 것 (기존 id 유지)**

- `pick-{card}` : `<span>` → `<button>` (클릭 시 그 카드 한 장만 해제). testid·텍스트 동일.
- `palette-{card}` : 이번 선택에 이미 고른 카드는 **더 이상 `disabled` 가 아니다** (다시 누르면 해제).
  엔진이 dead 로 판정한 카드는 그대로 `disabled`.

**제거된 것:** 없음.

---

## 4. 제거한 죽은 코드

- `lib/table/rightPanel.ts` → `rightPanelFor` (비테스트 호출자 0). `TableRoot` 주석의
  "마이그레이션이 남았다"는 서술도 사실에 맞게 정리. 이 함수가 지키던 성질은
  `rightPanel.test.ts` 에 `rightPanelLayoutFor` 기준으로 다시 표현했다.
- `lib/table/copy.ts` → `signedBpsPercentLabel`, `ADAPTIVE_SOURCE_LABEL` (소비자 0).
  `copy.test.ts` 의 "%p 와 % 는 다른 단위" 성질은 살아 있는 함수(`signedBpsPointsLabel`,
  `bpsPercentLabel`) 기준으로 다시 작성했다.

---

## 5. 항목별 처리

| # | 항목 | 처리 |
| --- | --- | --- |
| 1 | 카드 팔레트 잘림 | 위 §2 |
| 2 | ADR-0079 `requireNew` / `PLAYER_EXISTS` / `createdPlayer` | 모드에서 `requireNew` 파생 → 전송. `PLAYER_EXISTS` 시 안내 문구 + PICK 모드 전환 + 검색어 프리필(막다른 길 제거), 서버 메시지는 verbatim 유지. 성공 시 `createdPlayer` 를 읽어 "새로 만듦 / 기존 사용" 을 배너로 알림 |
| 3 | ADR-0078(b) dirty 저장·복원 | `page.tsx` → `TableRoot` → `TableStoreInit.dirtySeats`. 모든 sync 의 모든 좌석에 `stackUnverified` = 스토어 `dirtySeats` 파생 |
| 4 | ADR-0078(c) 버튼 이동 고지 | `handRebasedNotice(buttonMovedTo)` (copy.ts). 안 움직였으면 기존 문구 그대로 |
| 5 | `discardHand()` 참조 | `skipHand()` 로 재표현. 성질("핸드 없음 → `NO_HAND`")은 유지하고 `hand === null` 도 함께 단언 |
| 6 | 카드 한 장 마우스 해제 | 팔레트 카드 재클릭 토글 + `pick-*` 칩 클릭. `Backspace`·IME(`event.code`) 경로 회귀 테스트 추가 |
| 7 | 한국어 문구 이동 | `SeatCorrectionPanel` 6개, `TableRoot` `정정`, `StrategyPanel` 10개 → `copy.ts`. 렌더 텍스트는 바이트 단위로 동일 |
| 8 | 죽은 코드 | 위 §4 |
| 9-a | skip 감사 실패 삼킴 | `.catch(() => {})` 제거, `skip-audit-save-error` 배너. 진행은 막지 않음 |
| 9-b | `seatStateSequence` 과장 주석 | "배너 억제일 뿐이며 실제 쓰기 순서는 Next 서버 액션 큐 + 동기 better-sqlite3 에서 온다" 로 수정. 동작 변경 없음 |
| 9-c | `(input.stack ?? 0)` | 서버 호출 **전에** 빈 좌석 + 스택 없음을 거부(`SEAT_STACK_REQUIRED_NOTICE`), 결과 처리에서도 재확인. 0 을 지어내지 않음 |
| 9-d | 서버 쓰기 → 스토어 거부 순서 | 스토어 전이 후 `lastError` 를 **전이 전후 비교**로 확인. 거부면 패널을 닫지 않고 `seatPlayerStoreRefusedNotice` 반환, **`persistSeatState()` 를 호출하지 않는다**(옛 라인업 덮어쓰기 방지) |
| 9-e | 핸드 번호 testid | `hand-number` |
| 9-f | `SeatCard` Enter/Space 회귀 | `data-selected` + Enter/Space/무관키/EMPTY 좌석 테스트 |

---

## 6. 검증 결과

| 게이트 | 결과 |
| --- | --- |
| `pnpm typecheck` | **PASS** (11/11 프로젝트) |
| `pnpm vitest run --project web` | **PASS** — 665 passed, 3 skipped |
| `pnpm test` (전체) | **PASS** — 2594 passed, 3 skipped, 145 files |
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** |
| `pnpm e2e` | **PASS — 32/32** |
| 브라우저 실측 1440×800 / 1280×720 / 1024×640 | **PASS** (§2 표) |

---

## 7. 남은 위험 / 하지 못한 것

1. **매우 낮은 뷰포트(≤ 620px 높이)** — 트레이 floor 296px + dock 60px + 헤더가 고정이라
   펠트가 매우 얇아진다. 1024×640 까지는 실측으로 안전하고 dock 은 항상 뷰포트 안이지만,
   그보다 낮으면 좌석 카드가 트레이에 덮일 수 있다. 이는 변경 **이전에도** 성립하던 조건이며
   (17rem 트레이에서도 640 이하는 덮였다) 이번 변경으로 나빠지지 않았다.
2. **중첩 interactive ARIA** — `SeatCard` 가 `div[role=button]` 안에 버튼/입력을 담는 구조는
   그대로다. 이번 범위 밖으로 두고 `SeatCard.tsx` 헤더에 알려진 한계로 명시했다.
3. **`PLAYER_EXISTS` 안내는 서버 메시지를 파싱하지 않는다.** 사용자가 입력한 닉네임으로
   검색을 프리필해 매치를 노출한다. 서버가 매치한 **저장된** 닉네임이 입력과 크게 다르면
   (정규화 규칙에 따라) 검색 결과에 안 뜰 수 있다. 서버 메시지에 매치 닉네임·id 가 들어 있으므로
   사용자가 읽을 수는 있다. 구조화된 필드(`matchedPlayerId`)가 결과에 추가되면 한 번 클릭으로
   좁힐 수 있으나, 그것은 계약(다른 소유) 변경이라 하지 않았다.
4. **E2E 스펙은 수정하지 않았다.** `helpers.ts` 의 `HAND_COUNTER` 정규식 로케이터는
   `hand-number` testid 로 교체할 수 있다(현재도 동작함). §3 목록을 E2E 소유자에게 넘긴다.
