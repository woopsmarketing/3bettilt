# WP-S3-07 — batch i1 (blog migration: aks-vs-ako · next-best-after-aa · how-often-aa · is-ak-good · qq-vs-ak)

## Objective

배치 i1의 기존 5편을 Stage 3 검색 가이드 형태(QuickAnswer → 자동 TOC → 데이터 표/시각 → FAQ 관례 → ToolCTA 1개 →
관계 그룹)로 재작성. 감사 §2 B01–B05의 결정(RENAME 1 · DEEP EXPAND 2 · LIGHT EXPAND 2), `seoTitle`, 관계 필드, NUMBER-RISK
#13/#23/#27 닫기. 배치 전용 추가 작업: `tests/e2e/blog.spec.ts`의 "sets the search title" 케이스를 레지스트리 기반으로 갱신.

## Facts verified before work

- `facts.ts`의 20개 Fact 이름과 arg 형식(`|` 구분), `CLASS_VS_CLASS_EQUITY`는 `QQ|AKs`·`QQ|AKo`뿐 아니라 **역방향(`AKs|QQ`,
  `AKo|QQ`)도 resolve**함(learn-core `classVsClassMatchupFor`가 양방향 조회) — 스크래치 테스트로 확인 후 삭제.
- 엔진 값(스크래치 테스트 출력, 본문은 전부 `<Fact>`): AKs 8위 67.04% 4조합, AKo 12위 65.32% 12조합, 9·10·11위 = 77·AQs·AJs,
  1~7위 전부 페어, 20위 KJs 상위 9.80%, 11~20위 중 페어는 66뿐, QQ|AKs 53.95%, QQ|AKo 56.76%, AKs|QQ 46.05%, AKo|QQ 43.24%,
  AsKs|AhKd 52.49%, HAND_ONE_IN_N AA 221 · AKs 332 · AKo 111, RFI_POSITIONS_WITH AKs = AKo = `UTG · HJ · CO · BTN · SB`,
  OUTS_PROB 6|FLOP|RIVER 24.14%.
- MDX 규약(`WP_S3_06_HANDOFF.md`): `<QuickAnswer>` 첫 요소, `##` 유일, FAQ는 `## 사람들이 자주 헷갈리는 부분` + `### 질문?`
  (`faq.ts`: 컴포넌트가 든 답은 JSON-LD에서 탈락하므로 FAQ 답은 전부 컴포넌트 없이 작성), ToolCTA 1개, `div:has(>table)` breakout.
- 가드: `copy-guards.test.ts`(테이블 액션 권고·수익성·"가장 자주" 금지), `claims.test.ts`(is-ak-good의 "N위 안" 클레임·9~11위 Fact·
  "포켓페어가 아닌 패 중에서 가장 앞에 있는 것은 AKs" 문장 고정, 에퀴티 Fact 문단에 "이길 확률/이기는 비율" 금지, 본문 링크 존재 검사).
- 도구 딥링크 params는 `range`만 지원 → StartingHand/Equity ToolCTA는 params 없음.
- `tests/e2e/*.spec.ts`는 이미 `../../src/**`를 import함(helpers/equity/hand-checker) → 레지스트리 import 가능.

## Decisions made

| slug | 결정 | 구 H1 → 신 H1 | seoTitle | contentType |
|---|---|---|---|---|
| aks-vs-ako | RENAME (+보강) | AKs와 AKo는 무슨 차이일까? → **AKs vs AKo 차이: 수티드가 실제로 얼마나 중요한가?** | AKs vs AKo 차이 — 수티드가 실제로 얼마나 중요한가 | search-guide (유지) |
| next-best-after-aa | DEEP EXPAND | AA 다음으로 좋은 패는? → **AA 다음으로 강한 시작 패는? 상위 20위 순위표와 승률** | AA 다음으로 좋은 패는? 시작 핸드 순위 2위~20위와 승률 | data-probability (유지) |
| how-often-aa | LIGHT EXPAND | AA는 얼마나 자주 받을까? → **AA를 받을 확률은? 조합 6가지로 계산하는 법** | AA 받을 확률 — 포켓 에이스는 몇 판에 한 번? | data-probability (유지) |
| is-ak-good | DEEP EXPAND (허브) | AK는 좋은 패인가? → **AK는 좋은 패인가? 순위·자리·페어 상대 승률까지 한 번에** | AK는 좋은 패인가? 빅 슬릭의 순위, 첫 레이즈 자리, QQ 상대 승률 | search-guide (유지) |
| qq-vs-ak | LIGHT EXPAND | QQ와 AK 중 뭐가 강할까? → **QQ vs AK 승률: '코인플립'이라는 말은 맞을까?** | QQ vs AK 승률 — 페어와 오버카드의 대결, 정말 코인플립일까 | data-probability (유지) |

Per article (intent · sections · numbers · FAQ · relations/in-body links):

- **aks-vs-ako** — 의도: 표기 뜻 + 차이의 크기(순위/승률/조합) + 어디까지 같은가. 섹션 7: s/o 읽는 법(PokerCards×2) · 조합 4/12 ·
  승률과 순위(ComparisonTable 6행: 순위·기대 몫·조합·비중·상위·RFI 자리) · 13×13 위치(RangeMatrixMini UTG/CO/BTN) · 첫 레이즈 자리
  동일 · A♠K♠ vs A♥K♦(StatsRow, EXACT_EQUITY 양쪽) · FAQ 4. 숫자: HAND_COMBOS/SHARE/ONE_IN_N/RANK/EQUITY_VS_RANDOM/TOP_SHARE/
  RFI_POSITIONS_WITH/HAND_AT_RANK 9·10·11/HAND_CLASS_COUNT/COMBO_COUNT/EXACT_EQUITY. 타이핑 주장(테스트 고정): "등수 네 자리",
  "2%p 미만", "조합 세 배", "세 번 중 두 번 이상은 오프수트", "수티드 쪽이 조금 앞선다(50~55%)". Term: suited·offsuit·combo·flush·
  hand-matrix. 링크: learn/starting-hands, blog/why-suited-matters, blog/is-ak-good. relatedArticles: is-ak-good, why-suited-matters.
  ToolCTA: toolEquity(밴드는 relatedTools[0]=toolStartingHand). 감사 요구 항목(PokerCards, ComparisonTable, RangeEmbed, FAQ, 두 도구,
  starting-hands·hand-matrix 레슨, suited·offsuit·combo 용어) 전부 충족.
- **next-best-after-aa** — 의도: 상위 순위표를 한 번에. 섹션 7: 순위표가 재는 것(에퀴티, 무승부 분할 설명) · 1~10위(PokerCards KK/QQ/
  JJ + DataTable) · 11~20위(DataTable) · 왜 페어가 위쪽 · 첫 비페어 AKs · 순위≠족보 · FAQ 4. DataTable 20행: rank/hand는 문자열,
  equity/combos/top은 Fact — **테스트가 각 행의 hand = HAND_AT_RANK(rank)이고 그 행의 모든 Fact arg가 같은 클래스임을 고정**.
  타이핑 주장 고정: 1~7위 전부 페어, 8위 AKs, 11~20위 페어는 66뿐, 20위 상위 8~12%, AA–KK·KK–QQ 차 <5%p, AKs<77.
  Term: equity·pocket-pair·hand-ranking. 링크: learn/equity, blog/aks-vs-ako, blog/is-ak-good, blog/small-pocket-pairs,
  blog/how-often-aa, learn/starting-hand-ranking. relatedHands +kk·qq·jj. RangeEmbed(상위 20 하이라이트)은 지원 컴포넌트가 없어
  DataTable로 대체.
- **how-often-aa** — 섹션 4: 계산(COMBO_COUNT/HAND_COMBOS/SHARE/ONE_IN_N) · 조합 6가지(PokerCards cards= ×6, 테스트가 6개 서로
  다른 A 페어임을 고정) · 다른 패와 비교(ComparisonTable AA/KK/AKs/AKo) · FAQ 5. NUMBER-RISK #23: 본문 "6가지" 타이핑을 Fact로 치환
  (제목·소제목·"여섯 가지" 한글 수사는 테스트 고정). "아무 포켓페어 78가지 · 5.88% · 약 17판 · AA의 열세 배"와 FAQ의 "약 221",
  "AK 열여섯 가지"는 Fact 산술(CLASSES_OF_KIND×COMBOS_OF_KIND 등)로 테스트 재계산 — 본문에 그 사실을 명시. Term: combo·pocket-pair.
- **is-ak-good** — 의도: AK 질문의 진입점. 섹션 6: 순위 8/12위(StatsRow 4칸) · 수티드/오프수트(→aks-vs-ako) · 첫 레이즈 자리
  (RangeMatrixMini UTG/BTN) · QQ 상대(StatsRow, AKs|QQ·AKo|QQ — QQ 시점 상세는 qq-vs-ak로 위임, cannibalization 준수) · 플랍에서
  페어 못 만들면(OUTS_PROB 6|FLOP|NEXT·RIVER, 47장 관례 명시) · FAQ 5("올인해도 되나요"는 범위 밖 명시). claims.test 요구 문장·
  Fact 9·10·11 유지, "N위 안" 클레임 없음. 설명문의 "8위·12위"는 테스트 고정. Term: suited·offsuit·position·outs. relatedTools +range,
  relatedHands +qq, nextLessons position·outs, relatedArticles aks-vs-ako·qq-vs-ak·next-best-after-aa. "빅 슬릭" 별명 1회 언급(seoTitle 질의).
- **qq-vs-ak** — 섹션 6: 승률(PokerCards×3, StatsRow QQ 시점, 본문에 AK 시점) · "코인플립"은 맞을까(통념으로 명시, 양쪽 50% 아님·
  QQ가 앞선다고 Fact로 반박 → **NUMBER-RISK #27 닫음**, 테스트가 QQ 50~60% 고정) · 왜 페어가 앞서나 · 계산 방식(24/72 대결 = 조합
  곱, 테스트 고정) · 다른 페어 vs AK는 미계산 고지 · FAQ 4. Term: equity. 링크: blog/aks-vs-ako, blog/is-ak-good, 스토리
  blog/qq-three-bet-frustration(relatedArticles에도 추가). i1.test의 ruling-24 검사는 `AKs|QQ`/`AKo|QQ` 미러를 허용하도록 갱신하고,
  양 시점 합 = 100%(±0.01) 검사를 추가(약화가 아니라 강화).

## Files changed

- MDX 5: `apps/fishtilt/content/blog/{aks-vs-ako,next-best-after-aa,how-often-aa,is-ak-good,qq-vs-ak}.mdx` (전면 재작성, prettier 미적용).
- `apps/fishtilt/src/content/registry/blog/i1.ts` (title/seoTitle/description/relations/readMinutes 6·6·5·7·6 measured).
- `apps/fishtilt/src/content/registry/blog/i1.test.ts` (+2 describe: 형태 검사 5, 타이핑 주장 재계산 16; ruling-24 갱신).
- `apps/fishtilt/tests/e2e/blog.spec.ts` (배치 전용): 제목을 `BLOG_RECORDS`에서 읽음(`ARTICLE_RECORD`), "sets the search title"은
  `seoTitleOf(record)`로, 신규 케이스 "a seoTitle … is the `<title>` and never the h1"은 seoTitle이 있는 발행 글을 콘텐츠 타입당 1편
  (최대 3편) 샘플해 검사 — 다른 배치가 seoTitle을 추가해도 하드코딩 없음.
- `apps/fishtilt/src/content/blog/i1.ts` 미변경(슬러그 불변). 신규 파일 없음.

## Tests run

- `pnpm vitest run --project fishtilt src/content/registry/blog/i1.test.ts src/content/claims.test.ts src/lib/seo/faq.test.ts` → **73/73 PASS**.
- `pnpm vitest run --project fishtilt src/content src/copy-guards.test.ts src/lib/seo src/components/blog src/app/[locale]/blog` →
  868 PASS / 8 FAIL, **i1 id를 이름 짓는 실패 0**. 실패 8건은 전부 경계 밖(아래 Open issues).
- `pnpm --filter @gto-self/fishtilt typecheck` → 0 (첫 실행 때 `i3.test.ts(69) recordOf unused` 1건은 i3 소관, 이후 해소됨).
- `pnpm exec eslint` i1.ts · i1.test.ts · blog.spec.ts → 0. prettier: 위 TS 3개만.
- e2e(build-lock): `blog.spec.ts` + `client-bundle.spec.ts` → **39 passed, E2E_EXIT=0** (`aks-vs-ako` 660KB 예산 내, RangeMatrixMini 추가 후).

## Build/runtime evidence

- build-lock 포그라운드: `rm -rf .next && pnpm build` → BUILD_EXIT=0 (`artifacts/3bettilt-stage3-visual-qa/wp07-i1/build.log`). 첫 시도는
  경계 밖 `i3.test.ts` tsc 오류로 실패 → 재시도 성공. 두 번째 lock 획득 시도 1회는 다른 에이전트의 lock 대기로 Bash 타임아웃(600s).
- 스크린샷 16장 + `shots.jsonl` 8행: `ko_blog_aks-vs-ako`, `ko_blog_next-best-after-aa` × 1440x900/390x844 × dark/light (+fold).
  전부 status 200, h1=1(44px@1440, 30px@390), overflowX=0. 높이 9789/12744(aks), 9294/11923(next-best).
- 눈으로 확인: QuickAnswer가 히어로 아래 "빠른 답" 박스로, TOC 7항목, ComparisonTable/DataTable이 1440에서 960 breakout·390에서
  컬럼 안에 맞음(가로 스크롤 없음), RangeMatrixMini 렌더+UTG 226가지 17.0% 요약, StatsRow 52.49/47.51, FAQ h3, ToolCTA 1개, 관계 footer
  라벨(같이 알아둘 용어/직접 확인하기/비슷한 핸드/이런 이야기도 있어요). 크롭 이미지는 스크래치패드에만.

## Known limitations

- `how-often-aa`의 78/5.88%/17/열세 배/열여섯/221, `qq-vs-ak`의 24/72, `aks-vs-ako`의 "세 배" 등 Fact 산술 결과는 본문 타이핑 +
  i1.test 재계산(규칙 3의 "a test that computes it"). 엔진이 바뀌면 테스트가 잡지만 본문은 수동 수정 필요.
- "아무 포켓페어" 확률은 다른 소유자가 없어(cannibalization §1.10) how-often-aa가 가짐; "테이블 어딘가에 AA" 확률은 미계산으로 고지.
- FAQ 답은 전부 컴포넌트 없이 써서 FAQPage에 전부 실림(aks 4 · next-best 4 · how-often 5 · is-ak 5 · qq 4).

## Open issues

- 경계 밖 실패(내 변경과 무관, 실행 시점 스냅샷): `copy-guards` — `hands/batchGate.ts` "수익성" 정규식 리터럴, `blog/small-pocket-pairs.mdx`
  "유리합니다"(i2); `content.test` FAQ `?` 누락 10건(i2: small-pocket-pairs·why-72o·why-suited-matters·flush-vs-straight·full-house-vs-flush);
  readMinutes `blog-btn-why-wide` 6≠7 + playing-the-board ruling 28(i3); `blogHubModel.test` featured id(스토리 WP-08);
  `app/[locale]/blog/[slug]/page.test.tsx` TOC 기대 '왜 하필 9장인가요?'(outs-nine, i3/템플릿 소관).
- `.mdx`는 prettier 대상에서 제외됨(오케스트레이터 공지). 이 배치는 MDX에 prettier를 돌리지 않았음.
- `blog.spec.ts`의 hub 케이스는 여전히 `aks-vs-ako`가 발행 글이고 `검색 가이드`라는 전제(ARTICLE_SLUG 상수 1곳).

## Exact facts next agent may rely on

- 5편 모두 `seoTitle` 존재·H1과 다름; e2e 신규 케이스가 이를 타입당 1편 샘플 검사.
- `CLASS_VS_CLASS_EQUITY`는 `AKs|QQ`, `AKo|QQ`도 resolve하며 QQ 시점과 합이 100.00%.
- `i1.test.ts`의 `percent()`/`count()` 헬퍼 패턴은 다른 배치의 타이핑 주장 고정에 그대로 재사용 가능.

## Facts next agent MUST re-check

- 전체 유닛 스위트의 경계 밖 8건이 해당 배치에서 해소됐는지(위 목록).
- 홈/허브에서 i1 5편의 새 제목 길이(H1 2줄@1440, 390에서 `break-keep`)가 허브 카드 레이아웃을 깨지 않는지 — 이 배치는 아티클 페이지만 촬영.
