# 3BetTilt — Stage 3 state

Stage 3(리브랜드 · /ko 로케일 · 에디토리얼 리디자인 · 배포 준비)의 진행 상태. 마스터 계약은
`./prompt`, Stage 2까지의 역사는 `docs/FISHTILT_STATE.md`(HISTORICAL — Stage 3의 현재 상태로
쓰지 말 것). 이 파일의 **CURRENT STATUS 블록만** 현재를 말한다.

## CURRENT STATUS

- **post-Stage-3 (2026-09-14)**: **SEO Title & Multilingual Architecture Upgrade 완료** — 141 indexable 페이지 title/description
  재설계(` - 3BetTilt` suffix, kind별 템플릿 + record override), hreflang editions 준비(출력 불변), `/en` 미생성.
  보고서 `docs/reports/3BETTILT_SEO_TITLES_SUMMARY.md`, 설계 `docs/3BETTILT_MULTILINGUAL_ARCHITECTURE.md`. 결정 D-S3-22.
- **current WP**: **없음 — Stage 3 코드 작업 완료. 최종 게이트 통과(2026-09-12).**
  최종 보고서 `docs/reports/3BETTILT_STAGE3_FINAL.md`. 남은 것은 오너 조치 1건: `apps/fishtilt`·`packages/learn-core` 커밋 후 Vercel Preview 배포.
  게이트: typecheck 전 패키지 PASS · lint 0 error · unit **5252 passed/3 skipped** · 클린 빌드 **148/148 static, `ƒ` 0** ·
  E2E **343 passed/0 failed** · 빌드 HTML 감사(141/141 canonical·og·hreflang, 깨진 링크 0, 고아 0, FishTilt 0).
- **completed WP**:
  - WP-S3-20 FINAL GATE — 위 게이트 전부 통과. 마스터 수정 2건: `EquityGuide.tsx` 라벨을 상수 보간으로,
    `range-explorer.spec.ts`의 구 UI 어서션을 지원범위 문장 + 버튼 0개 어서션으로 교체(약화 아님).
  - WP-S3-19 REMEDIATION — 리뷰 BLOCKER 4 + MAJOR 15 전부 수정. BLOCKER 4건(포커 사실 오류: button 프리플랍 순서,
    ip-oop의 BB 인포지션 주장, 보드 풀하우스 전원 스플릿 주장, 작은 포켓페어 조합 수 역전 추론)은 오케스트레이터가 직접 수정.
    DEFER 7건은 근거와 함께 최종 보고서 §8에 기록(가짜 날짜·로고·연락처를 만들지 않는다는 원칙 포함). REJECT 0건.
  - WP-S3-18 INDEPENDENT REVIEWS — A(Opus 포커/수학) BLOCKER 4·MAJOR 8, B(Opus UX) MAJOR 5, C(Fable SEO) MAJOR 2,
    D(Sonnet 엔지니어링) 0/0. 리포트 `docs/reports/stage3/review/WP_S3_18_REVIEW_{A,B,C,D}.md`
  - WP-S3-17 PERF/A11Y/VISUAL QA — 완료(`WP_S3_17_QA_REPORT.md` + handoff). 22개 화면 1440/390(+320) × dark/light 육안 후
    8건 수정: FAQ 밴드·RelatedContent 카드 벽 → 괘선 리스트, 히어로 스페이드 2겹 SVG, `DataTable` 내부 스크롤러(`.table-scroll`),
    PageHero facts 모바일 2열, **사이트 전역 포커스 링 복구**(Tailwind v4 `outline-none`이 모든 `focus-visible:outline-*`를 삼키던 실제 a11y 버그),
    44px 터치 타깃, 퀴즈 360 오버플로. a11y 스크립트 감사(h1 1개·헤딩 순서·랜드마크·스킵링크·alt·대비 양 테마) + e2e 8건 추가.
    perf: `ƒ` 0, JS 459–651KB/route, LCP 32–56ms, CLS 0(equity만 0.059 — 도구 로직, 경계 밖).
    게이트: typecheck 0, unit 2609/2609, **full e2e 343/343 PASS**. 마스터 후속: `seo-audit.mjs` eslint 2건 수정 → `pnpm lint` 0 error
  - WP-S3-16 SEO+I18N+SCHEMA+LINKS — 완료(handoff + `WP_S3_16_SEO_AUDIT.md`). 빌드 HTML 전수 감사 도구 신설.
    결과(after): sitemap 141 = indexable 141, canonical/og/hreflang/lang/title/h1 141/141, JSON-LD 파싱 오류 0,
    broken link 0, **orphan 0**, `FishTilt|FISHTILT|example.com|localhost` 0. 고아 해소(c-bet·bluff·ip-oop `<Term>`+관계),
    브로드웨이/커넥터를 hands 4편+learn/starting-hands에서 링크(인바운드 2→7), 도구 페이지 ↔ 핸드 스토리 상호 링크(미러 테스트),
    `관련 가이드`를 `RELATED_LABELS`에 편입(7개), `definedTermJsonLd`를 `lib/seo/jsonLd.ts`로 이동(`@context` 누락 64페이지 수정),
    seo.spec +8 / locale.spec +1, 키워드·카니발 맵 최종 상태 반영.
    게이트: unit 2609/2609, typecheck 0, eslint 0, e2e 73/73(수정 후).
    **미결(오너/리뷰 판단)**: learn 4 + glossary 제목에 한국어 핵심 쿼리 없음(해당 타입은 `seoTitle` 없음),
    glossary description 53건 < 50자, preview 환경 noindex 미구현(`next.config.ts#headers()` + `VERCEL_ENV` 제안 — 배포 전 결정)
  - WP-S3-15 QUIZ/SEARCH/HEADER/FOOTER/ABOUT/404 — 완료(handoff; 429로 중단된 작업을 재개 에이전트가 이어받아 마무리).
    에이전트 게이트: **unit fishtilt+learn-core 235 files / 2606 tests PASS**, typecheck 0, eslint 0,
    build 148/148 static `ƒ` 0, e2e 본인 8 spec + client-bundle 101 PASS, 스크린샷 wp15(practice·range-quiz 문답 상태·
    search 320 포함·about·404·390 헤더 메뉴). 미결: `global-error.tsx` 미생성(별도 html/body 필요 — WP-17/19 판단)
  - WP-S3-12 GLOSSARY CONTENT g1g2·g3g4·g5g8·g6g7·g9 — **마스터 검증됨 2026-09-12** (handoff 5건). 전 용어 MDX에서
    `shortDefinition` 반복 리드 문단 제거 → `## 쉽게 설명하면`/`## 예로 보면` 구조, 족보 7편은 헤더 비주얼과 다른 카드 예시로 교체,
    WEAK 정의(action·hand) 재작성, `hand-ranking`·`hand-matrix` 예시 신설, 감사 `relatedTools` 교체 반영.
    신규 6개: set-vs-trips(three-of-a-kind에서 셋/트립스 alias 이동), ip-oop, gutshot, open-ended, broadway, connector(커넥터+갭 통합).
    **마스터 판단**: 400자 하한(`threshold.ts` 얇은 페이지 방지)은 유지 — 미달 10건은 실제 내용 추가로 해결(테스트 약화 금지).
    감사의 "relatedTools 없음"은 `minTools:1` 때문에 불가 → 무관한 도구 대신 `practice`(퀴즈)로 통일.
    마스터 수정: `categories.test.ts` AUDIT_ASSIGNMENT에 broadway·connector 추가(3개 배치가 동시 편집한 공용 픽스처).
    게이트: glossary+content+copy-guards 7 files **215/215 PASS**, build rc 0 — 신규 6페이지 HTML 생성 확인, 용어 64개, sitemap 141 URL.
  - WP-S3-11 GLOSSARY HUB+TEMPLATE+분할 — 완료(handoff; 에이전트 게이트: typecheck 0, glossary 11 files/194 tests,
    eslint 0, build `ƒ` 0, glossary e2e 14, 스크린샷 22장. 카테고리 6개, 표제어/초성 색인, 인바운드 기준 "많이 연결된 용어",
    j1/j2 → g1..g9 분할, `data-glossary-*` 속성 변경(검색 에이전트에 통지함)). 카드 벽 58장 → 사전형 색인
  - WP-S3-DOCS — `docs/DEPLOY_3BETTILT.md` + `docs/3BETTILT_OPERATING_PLAYBOOK.md` 완료(에이전트는 handoff 직전 429 종료,
    오케스트레이터가 handoff 작성·검증: 가짜 DNS 0, 배포 주장 0, 근거 부록 보유).
    **배포 blocker 발견: `apps/fishtilt`·`packages/learn-core`가 git 미추적 → 커밋 전 Vercel 배포 불가(오너 조치)**
  - WP-S3-13b HANDS CONTENT K1–K4 — **마스터 검증됨 2026-09-12** (handoff 4건; 20개 핸드 MDX에서 템플릿 중복 Fact 문단 제거,
    전 핸드 `## 자주 묻는 것` + `###` 질문 2–3개(평문 답), NUMBER-RISK #2–#6·#9 엔진 계산 테스트로 고정 또는 완화 표현, readMinutes 실측.
    마스터: `src/content`+hands+copy-guards 27 files 622/622 PASS, A5s 전 좌석 RFI·KQs>A5s 서술이 k2.test에 고정됨 확인,
    에이전트가 남긴 빈 `registry/hands/.scratch/` 삭제. 편차(보고만): 페어의 relatedTools 축소는 batchGate 요구로 미적용)
  - WP-S3-13a 후속 — `/hands` ItemList 순서 수정(`hubListedHands`), TS6133 주장은 재현 안 됨(typecheck 0)
  - WP-S3-13a HANDS TEMPLATE + HUB + 레지스트리 분할 — 완료(handoff; 에이전트: hands unit 254, e2e 24/24, 빌드 `ƒ` 0;
    `e3`→`k1..k4` + `batchGate.ts`, 169칸 정적 인덱스 허브). 마스터 확인: typecheck 0, `src/content` 684/685 — 남은 1 = `/hands` ItemList 순서(후속 요청함)
  - WP-S3-07 EXISTING BLOG MIGRATION — **마스터 검증됨 2026-09-12** (i1·i2·i3·i4 handoff; 19편 = 20 − MERGE 1:
    `same-pair-who-wins` → `what-is-kicker`, 인바운드 5곳 재지정, 리다이렉트 없음(D-S3-03). 전편 seoTitle≠H1, QuickAnswer, FAQ `###`,
    ToolCTA 1, 모든 수치 Fact/엔진 테스트 고정. 마스터: 전체 unit 2396/2400(남은 4 중 2건 마스터 수정 — blogHubModel 테스트를
    스토리 수와 무관하게 두 상태 명시 검증, TOC 테스트 mock이 실제 첫 `##` 사용; 2건은 13a·15 진행 중 파일, 통지함), typecheck 0,
    aks-vs-ako 1440 dark 전체 육안 확인. 에이전트 발견: 감사의 "SB가 BTN보다 좁다" FAQ 가설은 데이터상 거짓(SB 622 > BTN 568 조합) → 부정문으로 고정)
  - WP-S3-07 i2(Sonnet)·i4 — 완료(handoff). 마스터 후속 수정(i2): `small-pocket-pairs` 문단의 미검증 "유리합니다"(copy-guard)
    + 승률/순위 혼동 문장 재작성, readMinutes 4→3, i2 5편 FAQ `###` 10개에 `?` 누락 → 추가(FAQPage 규칙). 이후 content/i2/copy-guards 71/72
    (남은 1 = 13a 진행 중 `batchGate.ts`, 통지함)
  - WP-S3-08 S3 — 완료: 스토리 6편 전부 PUBLISHED(qq-vs-72o-flop-227, full-house-loses, qq-three-bet-frustration,
    river-changes-everything, aa-loses, ak-flop-miss), 평가기 검증, 모든 수치 `<Fact>`
  - 인프라: prettier가 `.mdx`의 인라인 `<Fact/>`/`<Term>`을 문단 분리 → `.prettierignore`에 `apps/fishtilt/content/**/*.mdx` 추가,
    전 MDX 스캔 결과 실제 손상 0(정밀 패턴 2건은 정상 목록)
  - WP-S3-05 HOMEPAGE — **마스터 검증됨 2026-09-12** (handoff; 에이전트: tsc 0, 관련 unit 49 + 338 PASS, home+client-bundle e2e 43/43,
    빌드 `ƒ` 0; 마스터 육안: 1440 dark fold·1440 light 전체 — 로열 플러시 정확 카드 히어로, 11 섹션 서로 다른 레이아웃, 스토리 데이터 구동.
    잔여: FAQ 밴드 카드형(공용 FaqSection), 히어로 스페이드 실루엣 단조 → WP-17)
  - WP-S3-10 LEARN CONTENT L1·L2·L3 — **마스터 검증됨 2026-09-12** (handoff 3건; 재확인: learn claims/registry/content/copy-guards
    9 files 188 tests PASS, `src/content` 518/518, equity 레슨 1440 light 육안 확인; 에이전트가 감사 밖 오류 2건 추가 수정 —
    starting-hands AKs/AKo 오픈 좌석 서술, outs "수학 레슨 5편"→3편. 알려진 한계: 하단 관련 그룹이 소형 카드 격자 → WP-17)
  - WP-S3-08 S1·S2 — 완료(스토리 4편 PUBLISHED, 평가기 검증; `src/content` 518/518 재확인). S3 진행 중
  - WP-S3-14 TOOLS — 완료(에이전트 검증; 마스터 전체 재검증은 트리 안정 시)
  - WP-S3-03 DESIGN SYSTEM + PRIMITIVES — **마스터 검증됨 2026-09-09** (`handoff/WP_S3_03_HANDOFF.md`;
    재확인: unit 171/1943 재실행 통과, HTML 133, 토큰 reading 46/breakout 60/grid 68/shell 78rem,
    off-token `max-w` literal 0(주석 1건 제외), 새 컴포넌트 25, 스크린샷 32장 중 learn 1440 dark
    육안 확인 — H1 44px·736px 컬럼·워드마크 정상)
  - WP-S3-04 VISUAL ASSET SYSTEM — **완료(문서만; 이미지 생성 capability 없음)** (`3BETTILT_VISUAL_STYLE_GUIDE.md` 202줄,
    `3BETTILT_VISUAL_ASSET_MANIFEST.md` 548줄, 29 entries: P0 11 · P1 13 · P2 5, 전부 NOT GENERATED except `og.png`)
  - WP-S3-01b PUBLIC BRAND RENAME — **마스터 검증됨 2026-09-09** (`handoff/WP_S3_01B_HANDOFF.md`;
    재확인: 빌드 HTML 구 브랜드 0 파일, `3BetTilt` 1,815회(1:1 치환), og:site_name/og:image:alt/
    title suffix/JSON-LD Organization·WebSite name 전부 3BetTilt, `og.png` 1200×630 11.7 KB 워드마크
    육안 확인, 소스 잔존 `FishTilt`는 가드 테스트 자신뿐, unit 149/1842 재실행 통과)
  - WP-S3-01a DOMAIN + LOCALE ARCHITECTURE — **마스터 검증됨 2026-09-09**
    (`docs/reports/stage3/handoff/WP_S3_01A_HANDOFF.md`; 마스터 재확인: HTML 133 = `ko.html` +
    `ko/**` 130 + 2, canonical 131/131 `https://3bettilt.com/ko…`, hreflang ko-KR/x-default 130/130
    파일, sitemap 130 loc 단일 host, robots Sitemap 절대 URL, `fishtilt.example` 0, `/`→`/ko`
    permanent redirect가 `next.config.ts:35` 한 건, 소스 `/ko` literal은 주석 7건뿐, 소스 `GTO`는
    부정 주석 4건뿐, provenance 문장 교체 확인, unit 149/1841 재실행 통과, 스냅샷 diff 71 modified
    + 14 only-in-new)
  - WP-S3-02 CONTENT + SEO AUDIT — **완료, 마스터 spot-check 통과** (`3BETTILT_KEYWORD_MAP.md` 196줄,
    `3BETTILT_CANNIBALIZATION_MAP.md` 227줄, `3BETTILT_CONTENT_AUDIT.md` 447줄; 재확인: in-body
    링크 learn 1/blog 6/glossary 3/hands 1, 글로서리 제목 58/58 `(원어)` 패턴, `hand-matrix.mdx:24`
    KQs 조합 서술 오류 실재 — 6개 두-무늬 조합을 나열하나 suited 조합은 4개)
  - WP-S3-00 BASELINE — **마스터 검증됨 2026-09-09**
  (`docs/reports/stage3/WP_S3_00_BASELINE.md`; 마스터가 소스/빌드에서 직접 재확인한 값:
  MDX 15/20/58/20, HTML 133, sitemap host `fishtilt.example` 130건, `/ko` 0건, 브랜드 소스
  176 파일, 빌드 HTML `FishTilt` 1,815 / `fishtilt.example` 2,474, `copy.ts:234` 금지 문구,
  스냅샷 493 파일, fishtilt/learn-core tracked 0, unit 148/1820 재실행 통과 13.9 s)
- **next WP**: 없음(오너 커밋 → Preview 배포 → 최종 육안 검토)
- **blockers**: 없음. 주의 2건 — (a) `apps/fishtilt`·`packages/learn-core`·FISHTILT 문서가
  git untracked라 `git diff` 불가, 경계 검증은 스냅샷 `diff -rq`로만 가능; (b) `apps/web`은
  다른 세션이 편집 중(터치 금지)
- **owner decisions** (재논의 금지): public brand FishTilt → **3BetTilt**, 워드마크 **3BETTILT**;
  production origin **https://3bettilt.com**; `NEXT_PUBLIC_SITE_URL=https://3bettilt.com`
  (`/ko` 미포함); primary locale **ko**, 한국어 사이트는 **/ko/** 아래(절대 `/kr/` 아님);
  배포 Vercel, DNS Cloudflare Free; DB/로그인/auth 추가 금지; `apps/fishtilt` 등 내부
  패키지·디렉토리명은 **rename하지 않음**; 존재하지 않는 언어 placeholder 페이지 금지;
  Range를 GTO라 부르지 않고 외부 source 이름·교차검증 문구를 공개 UI에서 제거
- **latest verified tests** (WP-S3-00 agent 측정 → 마스터가 unit 재실행으로 확인, 2026-09-09):
  unit `pnpm vitest run --project fishtilt --project learn-core` **171 files / 1943 passed**
  (WP-S3-03 이후, 마스터 재실행); e2e `pnpm e2e:fishtilt` **271 passed / 0 failed** (01a agent 측정);
  `pnpm --filter @gto-self/fishtilt typecheck` exit 0; `pnpm lint` exit 0
- **latest verified build** (agent 측정, 마스터가 HTML 수·sitemap host 재확인): `pnpm build` in `apps/fishtilt` exit 0, 7 s,
  **133 HTML** (`ko.html` + `ko/**` 130 + `_not-found` + `_global-error`), `ƒ` dynamic 0;
  origin 미설정 시 `console.info` 1줄(production origin 기본값 사용)
- **production domain**: https://3bettilt.com — **아직 미배포**; 빌드는 이미 production origin으로
  canonical/og:url/sitemap/robots를 생성(`NEXT_PUBLIC_SITE_URL` 미설정 시 기본값)
- **known limitations** (baseline 시점):
  - 이미지 자산 2개(`og.png` 7 KB, `apple-icon.png`)+`icon.svg`; 사진·일러스트 0; OG는 정적 1장
  - 콘텐츠 오류 1건 확정: `content/learn/hand-matrix.mdx:24` KQs suited 조합 서술(WP-S3-10에서 수정)
  - `_global-error.html`은 Next 합성 라우트(영어, `lang` 없음) — 프레임워크 한계
  - 스냅샷 사본을 gitignored `.data/stage3-baseline/`(493 파일)에 두었다 — 경계 검증은
    `diff -rq -x next-env.d.ts .data/stage3-baseline/fishtilt apps/fishtilt`
- **owner actions (권장)**: `apps/fishtilt`·`packages/learn-core`·`docs/FISHTILT_*`·
  `docs/reports/FISHTILT_*`·`docs/reports/stage3`·`docs/3BETTILT_*`를 git에 commit할 것.
  Stage 3 전체가 untracked 파일 위에서 진행되므로 commit 전에는 `git diff`로 복구할 수 없다.
  (마스터는 규칙상 commit하지 않는다.)

## WORK PACKAGE PLAN

| WP | 이름 | 상태 | 보고서 |
| --- | --- | --- | --- |
| S3-00 | BASELINE | 완료(마스터 검증됨) | `docs/reports/stage3/WP_S3_00_BASELINE.md` |
| S3-01a | DOMAIN + LOCALE | 완료(마스터 검증됨) | `docs/reports/stage3/handoff/WP_S3_01A_HANDOFF.md` |
| S3-01b | PUBLIC BRAND RENAME | 완료(마스터 검증됨) | `docs/reports/stage3/handoff/WP_S3_01B_HANDOFF.md` |
| S3-02 | CONTENT + SEO AUDIT | 완료(마스터 spot-check) | `docs/reports/stage3/3BETTILT_{CONTENT_AUDIT,KEYWORD_MAP,CANNIBALIZATION_MAP}.md` |
| S3-03 | DESIGN SYSTEM + PRIMITIVES | 완료(마스터 검증됨) | `handoff/WP_S3_03_HANDOFF.md` |
| S3-04 | VISUAL ASSET SYSTEM | 완료(문서) | `3BETTILT_VISUAL_STYLE_GUIDE.md` · `3BETTILT_VISUAL_ASSET_MANIFEST.md` |
| S3-05 | HOMEPAGE | 완료(마스터 검증됨) | `handoff/WP_S3_05_HANDOFF.md` (예정) |
| S3-06 | BLOG HUB + TEMPLATE | 완료(마스터 검증됨 2026-09-11: typecheck 0, blog/content/seo unit green, 스크린샷 확인) | `handoff/WP_S3_06_HANDOFF.md` (예정) |
| S3-07 | EXISTING BLOG MIGRATION | 완료(마스터 검증됨) · `handoff/WP_S3_07_I{1,2,3,4}_HANDOFF.md` | — |
| S3-08 | NEW HAND STORIES | 완료(6편) · `handoff/WP_S3_08_S{1,2,3}_HANDOFF.md` | — |
| S3-09 | LEARN HUB + TEMPLATE | 완료(마스터 검증 대기: 스크린샷 확인함, 전체 unit/typecheck는 06 종료 후) | `handoff/WP_S3_09_HANDOFF.md` |
| S3-10 | LEARN CONTENT | 완료(마스터 검증됨) | `handoff/WP_S3_10_L{1,2,3}_HANDOFF.md` |
| S3-11 | GLOSSARY HUB + TEMPLATE | 진행 중(`briefs/WP_S3_11_GLOSSARY_BRIEF.md`) | — |
| S3-12 | GLOSSARY CONTENT | 완료, 마스터 검증 | handoff/WP_S3_12_* |
| S3-13 | HANDS | 13a·13b(K1–K4) 완료, 마스터 검증 | handoff/WP_S3_13A·13B_K1..4 |
| S3-14 | TOOLS | 완료(마스터 검증 대기) · `handoff/WP_S3_14_HANDOFF.md` | — |
| S3-15 | QUIZ + SEARCH + HEADER + FOOTER + ABOUT | 진행 중 | — |
| S3-16 | SEO + I18N + SCHEMA + LINKS | 대기 | — |
| S3-17 | PERF + A11Y + VISUAL QA | 대기 | — |
| S3-18 | INDEPENDENT REVIEWS | 대기 | — |
| S3-19 | REMEDIATION | 대기 | — |
| S3-20 | FINAL RELEASE GATE | 대기 | — |

상태 값: 대기 · 진행 중 · 완료(마스터 검증 대기) · 완료(마스터 검증됨) · 차단.

## ORCHESTRATOR DECISIONS (Stage 3) — 재논의 금지, 근거가 틀렸을 때만 개정

| ID | 결정 | 근거 |
| --- | --- | --- |
| D-S3-01 | 한국어 라우트는 `src/app/[locale]/…` 세그먼트 + `generateStaticParams → ['ko']` + `dynamicParams=false`. `app/ko/` literal 디렉토리 금지 | 향후 `/en` 추가가 디렉토리 복제가 아니라 배열 원소 추가여야 함(계약 O). 정적 프리렌더 유지 |
| D-S3-02 | `SUPPORTED_LOCALES = ['ko']`, `DEFAULT_LOCALE = 'ko'`가 단일 진실. 모든 href는 `localePath(locale, path)` 계열 헬퍼로 생성. 소스에 `"/ko/…"` literal 금지(테스트 기대값 제외) | 계약 O |
| D-S3-03 | `/` → `/ko` redirect 1건만 둔다(`next.config` redirects, permanent). 기존 unprefixed 콘텐츠 라우트(`/learn/*` 등)는 redirect 없이 404 | 사이트가 배포된 적이 없고 sitemap host가 placeholder였으므로 보존할 index equity가 없음(계약 CD "불필요한 permanent redirect surface 금지") |
| D-S3-04 | trailingSlash는 Next 기본(false). 한국어 홈 canonical은 `https://3bettilt.com/ko`; 계약 A의 `/ko/` 표기는 `/ko`와 동치로 본다(Next가 `/ko/`→`/ko` 308) | 계약 A의 나머지 URL(`/ko/learn` 등)이 슬래시 없는 형태라 `trailingSlash:true`와 양립 불가. **owner가 `/ko/` 슬래시 형태를 고집하면 개정** |
| D-S3-05 | `NEXT_PUBLIC_SITE_URL` 미설정 시 fallback은 `https://3bettilt.com`(placeholder 삭제). `/ko`가 포함된 값은 빌드 실패. 로컬 빌드도 production canonical을 낸다 | 계약 DA `placeholder domain = 0`, 계약 A. Preview 배포도 canonical은 production origin을 가리켜야 함 |
| D-S3-06 | hreflang: `ko-KR` + `x-default`(→ `/ko` 동일 URL)만 emit. 존재하지 않는 언어는 sitemap/hreflang/nav/switcher 어디에도 없음 | 계약 O |
| D-S3-07 | 내부 이름(`@gto-self/fishtilt`, `apps/fishtilt`, `build:fishtilt`, 테스트 project명)은 유지. 공개 표면만 3BetTilt | 계약 N |
| D-S3-10 | 폭 토큰(rem): reading 46(736px) · breakout 60(960) · grid 68(1088) · shell 78(1248) · matrix 85(유지). 토큰 외 `max-w-*` literal 0 | 계약 T |
| D-S3-11 | 본문 17px/lh 1.8, article H1 clamp(1.875rem…2.75rem), hero H1 clamp(2.25rem…3.5rem), 문단 간격 1.25em, section 간격 5rem/3.5rem, 한국어 `keep-all` | 계약 U |
| D-S3-12 | 섹션 리듬 프리미티브: `Section`(width/tone/divider) · `EditorialHero` · `SplitLayout` · `StatStrip` · `Divider` · `CtaBand` · `Timeline` · `FaqAccordion`(native details, FAQ 데이터 경로 공유) | 계약 S |
| D-S3-13 | 아티클 프리미티브: `PageHero`→`ArticleHero` 변형 통합 · `ArticleMeta`(disclosure 가시) · `QuickAnswer` · `TableOfContents` · `EditorialImage`(next/image + ContentThumbnail CSS/SVG fallback, 고정 aspect) · `StatsRow/StatCard` · `ComparisonTable/DataTable` · `Quote` · `KeyPoint`=Callout 변형 · `NextRead` · MDX `FAQ` | 계약 AP |
| D-S3-14 | 스토리 프리미티브 `BoardCards`·`HandTimeline`·`StreetSection`은 데이터만 렌더; 핸드 스토리 typed schema/검증은 WP-S3-06/08 | 계약 AM/AN |
| D-S3-15 | Learn 프리미티브 `PositionDiagram`(6-max SVG) · `BettingTimeline` | 계약 AS |
| D-S3-16 | `RelatedContent` 라벨 union: 더 배우기 / 직접 확인하기 / 같이 알아둘 용어 / 이런 이야기도 있어요 / 비슷한 핸드 / 다음으로 읽기 | 계약 BQ |
| D-S3-17 | 시각 언어: charcoal/black + brand red, editorial; 카드 벽 금지; 라이트 모드 동급; 새 webfont(네트워크 fetch) 의존 추가 금지 | 계약 R/V |
| D-S3-19 | Blog 카테고리(콘텐츠 타입 5종)는 `BlogRecord.contentType`(typed union)으로 표현. 카테고리 전용 라우트는 만들지 않고 허브 내 섹션 + 앵커 내비로 처리(신규 라우트·sitemap·키워드맵 영향 없음). 필요성이 Search Console에서 증명되면 개정 | 계약 AF/AG, BM |
| D-S3-20 | 핸드 스토리는 `HandStoryRecord`(계약 AM 필드) typed data + 테스트(카드 중복 0, 보드 유효, showdown은 strategy-core evaluator로 검증). `disclosure`는 레코드 필드이며 템플릿이 항상 가시 렌더 | 계약 AL/AM |
| D-S3-22 | `<title>` = `{검색 문구}[ \| {qualifier}] - 3BetTilt`(브랜드 마지막, 도메인 표기 금지). H1은 페이지 문장으로 유지(title과 의미 공유, 문자열 동일 불필요). content title은 `seoTitleOf`(record `seoTitle` override → glossary `{seoTerm} 뜻 \| 홀덤·포커 용어 설명` / hands `{key} 승률·순위 \| 텍사스 홀덤 프리플랍 핸드 가이드` / learn·blog H1), description은 `seoDescriptionOf`. JSON-LD name은 `titleHead`(qualifier 앞). `hreflangAlternates(…, editions)` — editions 기본값 = 자기 로케일(현재 출력 불변) | 2026-09-14 오너 prompt(SEO title upgrade). 이전 ` · 3BetTilt` 형식 대체. **`3벳 뜻`은 glossary 소유 유지**(keyword map C1) — learn/three-bet은 `3벳이란?` |
| D-S3-18 | 이미지 생성 capability는 이 세션에 없음 → 자산은 manifest(`3BETTILT_VISUAL_ASSET_MANIFEST.md`)로만 정의, 모든 슬롯은 fallback으로 렌더. 홈 히어로 4:5, 스토리 16:9, 카드/허브 3:2, 카테고리 1:1, OG 1200×630 단일 카드로 런칭 | 계약 AB |
| D-S3-21 | 실행 순서: 06(블로그 아키텍처)‖09(러닝 아키텍처) → 05(홈)‖07‖08‖10 → 11‖13‖14‖15 → 12 → 16 → 17 → 18 → 19 → 20. 번호 순서를 깨는 유일한 이유는 의존성: 홈은 blog `contentType`·스토리·learn 카테고리를 집계하는 페이지다 | 계약 CB "순서 존중, 필요한 병렬만" — 홈을 먼저 만들면 06/08/09 뒤 재작업 |

## BASELINE FACTS (verified from source/build on 2026-09-09)

| 항목 | 값 | 출처 |
| --- | --- | --- |
| git | `main` @ `7c3a4e2`; tracked 변경 65, untracked 153; `apps/fishtilt`·`packages/learn-core`·FISHTILT docs 전부 untracked | `git status --porcelain`, `git ls-files` |
| 스냅샷 | `<scratchpad>/stage3-baseline/` — fishtilt 464 + learn-core 29 = 493 파일 | `rsync -a --exclude …` |
| 프레임워크 | Next 16.3.3 Turbopack, React 19.2, Tailwind 4.3, `@next/mdx`; dev 3220 / e2e 3221 | `apps/fishtilt/package.json` |
| 라우트 | `page.tsx` 22(정적 18 + 동적 템플릿 4), `sitemap.ts`, `robots.ts`, `not-found/error/global-error`; `route.ts` 0, `opengraph-image` 0 | `find src/app` |
| 콘텐츠 | MDX 113 = learn 15 · blog 20 · glossary 58 · hands 20; 제목·순서는 `src/content/registry/**` | `ls content/*/*.mdx` |
| 빌드 | 133 HTML, 전부 static/SSG, `ƒ` 0 | `pnpm build`, `find .next/server/app -name '*.html'` |
| sitemap / robots | 130 `<loc>`, host `https://fishtilt.example`, hreflang 0; `/search` noindex | `next start --port 3221` + curl |
| 로케일 | `/ko` 0건, `[locale]` 0, i18n 0; `<html lang="ko">` 하드코딩(`layout.tsx:71`); `og:locale ko_KR` | grep |
| SITE_URL | `site.ts:66` `NEXT_PUBLIC_SITE_URL ?? 'https://fishtilt.example'`; `.env` 없음; 빌드 경고 있음 | `src/lib/seo/site.ts` |
| 메타/스키마 | `SITE_NAME` `site.ts:31`; title `metadata.ts:42`; JSON-LD `jsonLd.ts`(Org 61 · WebSite 77 · Breadcrumb 94 · Article 115 · FAQ 139 · WebApp 168 · DefinedTermSet 246 · CollectionPage 293); OG `public/og.png` 정적 1장 | `src/lib/seo/` |
| 빌드 HTML 스키마 | ld+json 206; BreadcrumbList 130 · Article 35 · FAQPage 27(Q 115) · WebApplication 6 · DefinedTerm 58; `<title>` 1개 133/133; `<main>` 1개 132/133 | grep over `.next/server/app` |
| 브랜드 잔존 | 소스 176 파일 / 332 매치(FishTilt 93 · FISHTILT 170 · fishtilt 69); 빌드 HTML `FishTilt` 1,815 · `FISHTILT` 396 · `fishtilt.example` 2,474 | grep |
| 디자인 토큰 | `globals.css` 단일; 컨테이너 reading 42rem · grid 56rem · shell 72rem · matrix 85rem; 토큰 외 `max-w-*` literal 11곳; body 16px, base line-height 1.8 | `src/app/globals.css:116-247` |
| 컴포넌트 | `src/components` 56개, `src/features` 6 도메인, `"use client"` 32 파일 | `ls`, grep |
| 카드 벽 실측 | LinkCard 앵커: `/` 47 · `/glossary` 58 · `/blog` 20 · `/hands` 20 · `/learn` 15 · `/tools` 12; 허브 6개 `<main>` 클래스 동일 | grep over built HTML |
| 이미지 | 래스터 2(`og.png` 7,003 B, `apple-icon.png` 1,542 B) + `icon.svg` 606 B; `next/image` 0, 프로덕션 `<img` 0 | `find`, grep |
| 테스트 | unit 148/1820, learn-core 11/114, e2e 267/267, typecheck 0, lint 0 | §CURRENT STATUS |
| 스크립트 | `typecheck` `lint` `test` `build:fishtilt` `e2e:fishtilt` `verify` 존재; `build`·`verify`는 **apps/web** 빌드만 포함 | root `package.json` |
| 기존 보고서 | `docs/reports/FISHTILT_*.md` 26개; `docs/reports/stage3/`는 이번에 신설 | `ls docs/reports` |

## HISTORICAL SNAPSHOT — DO NOT USE AS CURRENT STATUS

Stage 2 종료 시점 값(`docs/reports/FISHTILT_STAGE2_MASTER_SUMMARY.md` §2): HTML 133,
sitemap 130, MDX 113, fishtilt unit 1706(137), e2e 267. `docs/FISHTILT_STATE.md`의
"fishtilt+learn-core 1805"는 stale(현재 1820).
