# GTO-SELF — project rules

Read this before touching anything. Then read `docs/STATE.md` for where the project
actually is, and `docs/DECISIONS.md` for why things are the way they are.

## What this is

A fast, independent poker training / hand-replay / strategy-review app for
CoinPoker-style 6-max NLHE cash games. The user manually enters actions into our own
training table.

**It is not connected to any poker client.** Never build, propose, or scaffold:
screen reading, OCR, screen capture, client automation, input injection, scraping a
poker client, or automated live play. This is a hard product boundary, not a
preference.

## Non-negotiable rules

1. **Money is integer milliBB.** 1 BB = 1000 milliBB. Every pot, stack, wager,
   contribution, rake and settlement value goes through `Money` from
   `@gto-self/shared`. Floating point is allowed only at the UI/parse boundary and
   for non-money ratios (e.g. bet-as-fraction-of-pot). Never `+`/`*` raw money
   numbers; use `Money.add`, `Money.mulRatio`, etc. Rounding is always explicit.
2. **Never invent GTO numbers.** Do not hard-code strategy percentages and present
   them as GTO. Do not scrape GTO Wizard or copy proprietary solution datasets. Mock
   strategy data must be typed, tagged `MOCK`, and visibly labelled in the UI.
3. **Never destroy user input.** Actual entered values are persisted alongside any
   normalized/bucketed values used for solution lookup. Both are shown.
4. **Layering is enforced.** `poker-core` and `gto-core` must not import React,
   Next.js, or `@gto-self/db`. `poker-core` additionally must not import `gto-core` or
   `player-core` — the poker engine knows nothing about CFR, GTO data, SAFE_GTO,
   ADAPTIVE, or player tendencies. `gto-core` must not import `player-core` — player
   statistics must never influence baseline solution data. ESLint enforces all of this.
   The domain engine is authoritative; the DB is persistence; React is presentation.
5. **No fake implementations.** No stubs that silently return plausible values. A
   `TODO` must be explicit, documented, and listed in `docs/STATE.md` under known
   issues.
6. **No LLM in the decision path.** Strategy lookup is a local/database lookup.
   AI may only ever be an optional post-hoc explanation tool.
7. **When unsure about a poker rule, do not invent behaviour.** Add a documented
   assumption in `docs/DECISIONS.md` and expose a manual override in the UI.
8. **No scope expansion, no drive-by refactors.** Do the phase you were given.
9. **Do not reopen accepted decisions.** `docs/DECISIONS.md` is settled unless the
   falsifying evidence an ADR names actually appears. If you disagree, report it — do
   not relitigate it in code.
10. **Rake and fees are policy, not site knowledge.** `poker-core` accepts a
    `RakeConfig`/`FeeConfig`; it never contains CoinPoker-specific assumptions. Observed
    hand-history behaviour is an observation until a fixture confirms it (ADR-0018).

## Layering (import direction)

```
shared  <-  poker-core  <-  coinpoker-parser
   ^            ^
   |            |
   +--  gto-core, player-core
   |            ^
   +--  db  ----+          (db may import domain types; domain never imports db)
                ^
             apps/web      (may import everything)
solver-lab  ->  shared only. Never imported by the app.
```

## Commands

| Command                                | What it does                         |
| -------------------------------------- | ------------------------------------ |
| `pnpm install`                         | Install workspace                    |
| `pnpm typecheck`                       | `tsc --noEmit` in every package      |
| `pnpm test`                            | Vitest across all projects           |
| `pnpm vitest run --project poker-core` | One package's tests                  |
| `pnpm build`                           | Next production build                |
| `pnpm lint`                            | ESLint (includes the layering rules) |
| `pnpm verify`                          | typecheck + test + build             |
| `pnpm dev`                             | Next dev server on :3210             |
| `pnpm e2e`                             | Playwright critical-path tests       |

## Verification cadence

The goal is to remove *duplicate* verification, not verification. Correctness and security
gates are never lowered — only the frequency of the expensive ones changes.

**Fast gate — after every small task.** Run the smallest check that proves what you just
wrote is not obviously broken: the changed module's unit tests, the changed contract's
test, a targeted component test, `tsc` if types moved. Do not run the full E2E suite, a
full regression sweep, or tests unrelated to your change.

**Milestone gate — when a real user-facing capability is complete** (a phase, or DB + API
+ UI joined into something a person can actually use): `pnpm typecheck`, `pnpm lint`,
`pnpm build`, targeted integration and targeted E2E.

**Final gate — once implementation is complete and the source is frozen:** `pnpm verify`
plus full regression, cross-surface E2E, and fresh security and product review. Run the
full suite once, not repeatedly. If it finds a problem: fix it, run that problem's targeted
test, then the affected milestone tests, then only the final regression the change actually
invalidates.

**Verify immediately, whatever the cadence**, when a change touches: DB migrations or
schema, auth or authorization, a security boundary, money/cost/budget, PII, retention or
deletion, concurrency or races, shared runtime, a wire/protocol format, a destructive
mutation, an external side effect, a shared API contract, or production startup
configuration. Even then prefer the targeted integration test that exercises that specific
risk over a whole-product E2E run.

**Never accumulate known breakage.** If a fast gate fails: stop, fix it, get the targeted
check passing, then continue. "The final E2E will catch it" is not a plan.

**Do not re-run an expensive suite that already passed on unchanged source.** Re-run when
the code changed, a dependency changed, a reviewer finding was fixed, or the source is
frozen for final verification. Reuse a running dev server rather than restarting it.

Whatever the gate: you must have added real tests for every money/state transition you
touched, and long test logs belong in a report file, not in your handoff.

## Working agreement for phase agents

- Inspect existing code before editing. Do not guess an API contract — open the file.
- Stay inside your phase's file boundary. If you need a change outside it, say so in
  your report instead of making it.
- Prefer pure functions for poker math. Keep UI state and domain truth separate.
- Update `docs/STATE.md` is the **orchestrator's** job, not yours — report instead.

---

# 에이전트 작업 규칙

## 1. 메인 에이전트

메인 에이전트는 오케스트레이터다.

가능하면 Opus / Ultracode 등 가장 강한 모델을 사용한다.

메인 에이전트의 역할:

- 전체 작업 계획
- 작업 순서 결정
- 하위 에이전트 배정
- 중요한 기술 판단
- 아키텍처 결정
- 충돌 관리
- 결과 통합
- 최종 검증
- 최종 판정

메인 에이전트가 모든 탐색과 단순 작업을 직접 하지 않는다.

토큰과 시간을 아끼기 위해 가능한 작업은 하위 에이전트에 위임한다.

## 2. 모델은 작업 난이도에 따라 선택

항상 최고 모델을 사용하지 않는다.

### 빠르고 저렴한 모델 사용

다음 작업은 작은/빠른 모델을 우선한다.

- READ-ONLY 탐색
- 파일 찾기
- grep/search
- 코드 위치 찾기
- dependency 조사
- route 목록 조사
- 테스트 목록 조사
- 로그 정리
- 결과 요약
- 단순 문서 확인
- 단순 반복 수정

### 중간급 모델 사용

- 범위가 명확한 구현
- UI 수정
- API 구현
- 테스트 추가
- 단순 리팩터링
- 명확한 버그 수정

### 강한 모델 사용

- 아키텍처
- 복잡한 버그
- DB migration
- 보안
- 인증/권한
- 데이터 무결성
- 여러 모듈에 걸친 변경
- 애매한 요구사항 판단
- 독립 코드 리뷰
- 최종 Release 판단

READ-ONLY라도 보안/아키텍처 판단이 핵심이면 강한 모델을 사용할 수 있다.

## 3. Fresh Context 우선

하위 에이전트는 가능한 한 새 context로 시작한다.

전체 프로젝트 히스토리를 모두 전달하지 않는다.

필요한 것만 전달한다.

- 작업 목표
- 관련 파일
- 반드시 지킬 제약
- 완료 기준
- 필요한 테스트
- 결과 보고 형식

불필요한 로그와 과거 대화 전체를 전달하지 않는다.

## 4. 작업은 작고 명확하게 나눈다

좋은 작업:

- 로그인 흐름 read-only 조사
- 이 3개 파일에서 pagination 구현
- migration FK 검증
- landing mobile 문제 수정

나쁜 작업:

- 프로젝트 전체 개선
- 아무 문제나 찾아서 전부 수정
- 완벽해질 때까지 계속 작업

하위 에이전트는 맡은 범위가 끝나면 STOP한다.

## 5. 병렬 작업 규칙

READ-ONLY 작업은 적극적으로 병렬화한다.

서로 다른 파일을 수정하는 독립 작업도 병렬 가능하다.

하지만 다음 영역은 동시 writer를 피한다.

- migration
- schema
- shared types
- auth
- security
- prompt
- core runtime
- shared repository
- package/config
- 공용 layout
- 공용 test fixture

같은 파일이나 강하게 연결된 모듈은 한 에이전트만 수정한다.

애매하면 직렬 처리한다.

## 6. 같은 Worktree 충돌 방지

기본적으로 하나의 canonical worktree를 사용한다.

다른 세션이 같은 파일을 수정 중이면 동시에 수정하지 않는다.

내가 수정하지 않은 파일이 작업 중 갑자기 바뀌면 원인을 먼저 확인한다.

다른 작업을 자동으로:

- reset
- stash
- restore
- checkout

하지 않는다.

## 7. 먼저 읽고, 그 다음 수정

구현 전에 최소한 다음을 확인한다.

1. 현재 코드
2. 관련 테스트
3. 기존 helper/abstraction
4. 기존 데이터 흐름

이미 있는 기능을 다시 만드는 두 번째 시스템을 만들지 않는다.

문서와 코드가 다르면 현재 코드를 우선하되 차이는 기록한다.

## 8. 검증은 작업 크기에 맞춘다

작은 수정 하나마다 전체 검증을 반복하지 않는다.

예:

- 문구 수정
- 작은 CSS 수정
- 단순 rename
- 독립 helper 추가
- 작은 component 수정

이런 작업은 여러 개를 묶어서 검증한다.

### 큰 작업 단위가 끝나면 검증

예:

- 하나의 WP 완료
- API 기능 완료
- migration 완료
- auth/security 변경 완료
- 여러 파일 리팩터링 완료
- 사용자 흐름 하나 완료

그때 관련 테스트를 실행한다.

필요에 따라:

- relevant tests
- typecheck
- lint
- build
- runtime/browser test

를 수행한다.

전체 regression은 Release/큰 milestone 마지막에 한 번 수행한다.

## 9. 위험한 변경은 즉시 검증

다음은 작은 변경이라도 바로 검증한다.

- migration
- auth
- permission
- tenant isolation
- payment
- security boundary
- destructive data logic
- retention
- production startup
- cost/budget enforcement

위험도가 높은 변경은 빠른 피드백이 더 중요하다.

## 10. 하위 에이전트 결과는 짧게

하위 에이전트는 긴 설명 대신 다음만 보고한다.

- 완료한 작업
- 확인한 파일
- 변경한 파일
- 핵심 변경
- 실행한 테스트
- PASS/FAIL
- 남은 위험
- 다음 작업에 필요한 정보

긴 chain-of-thought를 출력하지 않는다.

## 11. 컨텍스트 절약

메인 context를 불필요하게 소비하지 않는다.

하위 에이전트 결과는 요약해서 전달한다.

전체 파일 대신 필요한 부분만 읽는다.

전체 로그 대신:

- 실패 부분
- 요약
- assertion count
- exit code

만 가져온다.

이미 확인한 내용을 반복해서 다시 조사하지 않는다.

## 12. 독립 리뷰

보안, 아키텍처, Release 작업은 구현자가 자기 코드만 보고 PASS시키지 않는다.

큰 작업이 끝난 후 fresh-context reviewer를 사용할 수 있다.

Reviewer에게 원하는 결론을 알려주지 않는다.

예:

좋음:
"보안 문제와 release blocker를 독립적으로 검토하라."

나쁨:
"PASS인지 확인하라."

## 13. 실패 처리

테스트가 실패하면 PASS가 나올 때까지 무작정 반복하지 않는다.

순서:

1. 실패 기록
2. 원인 파악
3. 수정
4. 필요한 범위만 재검증

테스트를 통과시키기 위해 정상적인 assertion을 삭제하거나 약화하지 않는다.

## 14. Git 규칙

Git은 작업을 막는 gate가 아니다.

별도 요청이 없으면:

- clean tree 요구하지 않음
- branch 필수 아님
- commit 필수 아님
- push 필수 아님

현재 local worktree를 기준으로 작업한다.

사용자의 기존 변경을 임의로 되돌리지 않는다.

## 15. 기본 작업 흐름

큰 작업은 기본적으로 다음 순서를 따른다.

READ-ONLY 정찰
→ 계획
→ 하위 작업 병렬 배정
→ 구현
→ 큰 작업 단위 완료
→ 관련 검증
→ 다음 작업
→ 전체 통합
→ 전체 regression
→ fresh review
→ 수정
→ 최종 검증
→ 보고
→ STOP

## 16. 우선순위

기본 우선순위:

1. 정확성
2. 작업 속도
3. 안전성
4. 컨텍스트 절약
5. 모델 비용 절약

최고 모델은 판단이 중요한 곳에 집중해서 사용한다.

단순 탐색과 반복 작업에 최고 모델을 낭비하지 않는다.

## Efficient Execution & Verification

- 기본은 FAST ITERATION이다.
- 변경 범위에 직접 관련된 테스트만 우선 실행한다.
- 작은 수정마다 full test / full build / full E2E / 전체 screenshot을 반복하지 않는다.
- 전체 검증은 큰 통합 지점 또는 최종 RELEASE GATE에서만 수행한다.
- 이미 통과했고 관련 코드가 바뀌지 않은 검증은 다시 실행하지 않는다.
- 여러 agent가 관련 파일을 수정 중이면 unstable tree에서 광범위한 검증을 하지 않는다.
- 실패가 나면 먼저 해당 실패만 좁게 진단한다. 바로 전체 테스트를 돌리지 않는다.
- 오래 걸리는 검증이 당장 필요 없으면 `DEFERRED VERIFICATION`으로 기록하고 구현을 계속한다.
- 대형 로그는 전체를 읽지 말고 summary / failure / relevant warning만 확인한다.
- full build와 full E2E는 가능하면 프로젝트가 안정된 마지막 단계에서 한 번 수행한다.
- sub-agent는 자신의 범위만 검증하고, orchestrator가 즉시 같은 검증을 중복 반복하지 않는다.
- 재개 시 전체 프로젝트를 다시 감사하지 말고 기존 context → checkpoint/state → git diff 순서로 최소 복구한다.
- 목표는 테스트 횟수 최대화가 아니라, 최소 비용으로 충분한 신뢰도를 확보하며 작업을 끝내는 것이다.

## 결과보고서
결과 보고서는 무조건 docs디렉토리에 .md파일로 정리하라. cli로 출력해도좋지만 .md파일로 저장해놓는게 더욱 좋다.
작업한 내용에대한 내용을 구체적으로 .md파일로 작은단위의 보고서 + 종합보고서를 만들어주면 내가 확인하기편하다.
