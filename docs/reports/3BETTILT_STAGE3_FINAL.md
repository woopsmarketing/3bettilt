# 3BetTilt Stage 3 — FINAL REPORT

작성: 2026-09-12 · 오케스트레이터(Opus) · 소스 동결 후 최종 게이트 통과 시점 기준.
이 문서의 모든 수치는 최종 클린 빌드와 실제 테스트 실행 결과다. 추정치·예상치는 쓰지 않았다.

---

## 1. FINAL STATUS

**Stage 3 코드 작업 완료. 배포 전 오너 조치 1건(커밋)이 남아 있다.**

| 게이트 | 명령 | 결과 |
| --- | --- | --- |
| typecheck | `pnpm typecheck` | 전 패키지 PASS |
| lint | `pnpm lint` | **0 error** (경고 2건은 gitignore된 개발 스크립트의 `console.log`) |
| unit | `pnpm test` (전 프로젝트) | **5252 passed / 3 skipped, 382 files** |
| 클린 빌드 | `rm -rf .next && pnpm build` (fishtilt) | exit 0 · **148/148 static** · 서버 함수(`ƒ`) **0** |
| E2E | `pnpm e2e` | **343 passed / 0 failed** |
| 빌드 HTML 감사 | `.data/tools/seo-audit.mjs` | 아래 §12 |

`pnpm build`·`pnpm verify`(루트)는 **apps/web** 빌드다. apps/web은 다른 세션이 수정 중이라 이번 Stage에서
건드리지 않았고, 최종 게이트에서도 실행하지 않았다(CLAUDE.md 경계). fishtilt 빌드는 위와 같이 독립 실행했다.

---

## 2. BRAND MIGRATION · DOMAIN · LOCALE

- **브랜드**: 3BetTilt / 워드마크 `3BETTILT`. 사용자에게 보이는 표면의 `FishTilt`·`FISHTILT` = **0**
  (빌드 HTML 144개 전수 grep). 내부 이름 `apps/fishtilt`, `@gto-self/fishtilt`는 결정대로 그대로 두었다.
- **도메인**: production origin `https://3bettilt.com`. `NEXT_PUBLIC_SITE_URL`은 선택값이고 기본값이
  같은 origin이다. 앱이 읽는 환경변수는 이것과 `VERCEL_ENV`(preview noindex 게이트)뿐이다.
- **로케일**: `/ko/` 단일 로케일. `/` → `/ko` 308 영구 리다이렉트 1건. `/kr/`은 어디에도 없다.
  `SUPPORTED_LOCALES=['ko']` + `localePath()` 규약이라 두 번째 로케일 추가 시 가짜 대체 URL이 생기지 않는다.
  `<html lang="ko">` 141/141, hreflang `ko-KR` + `x-default` 141/141(색인 페이지 기준).

---

## 3. ROUTE / CONTENT COUNTS

| 구분 | 수 | 비고 |
| --- | --- | --- |
| 정적 페이지(빌드) | **148** | 서버 함수 0 |
| sitemap URL | **141** | 색인 대상과 정확히 일치(indexable-not-in-sitemap 0, noindex-in-sitemap 0) |
| 색인 제외 | `/ko/search`(noindex, follow), 404, `/` 리다이렉트 | |
| Blog | **25** | 검색 가이드·개념 글 19 + 핸드 스토리 6 |
| Learn | **15** | 3단계 로드맵 · 7개 카테고리 |
| Glossary | **64** | 기존 58 + 신규 6 |
| Hands | **20** | 개별 핸드 페이지. 허브는 13×13 전체 색인 |
| Tools | **6** | 레인지 · 에퀴티 · 팟오즈 · 아웃츠 · 시작핸드 · 핸드체커 |
| Quiz | **3** + 허브 | 족보 · 시작핸드 · 레인지 |
| 기타 | 홈 · 검색 · 소개 · 404 | |

---

## 4. BLOG — 감사 결정과 처리

기존 20편 전수 감사 후: RENAME / LIGHT EXPAND / DEEP EXPAND / MOVE ROLE 적용, **MERGE 1건**
(`same-pair-who-wins` → `what-is-kicker`, 인바운드 5곳 재지정, 리다이렉트 없음 — 아직 외부 유입이 없는
사이트라 URL 정리 비용이 0인 시점에 합쳤다). 결과 19편.

전편 공통: `seoTitle` ≠ H1, 첫머리 `<QuickAnswer>`, `##` 3개 이상이면 자동 TOC, FAQ는 가시 섹션이 있을 때만
`FAQPage`, `<ToolCTA>` 정확히 1개, 모든 수치는 `<Fact>`/엔진 계산.

**신규 핸드 스토리 6편**(1인칭 재구성, 상단에 "학습과 재미를 위해 재구성한 핸드 시나리오입니다." 고지 가시):
`qq-vs-72o-flop-227`, `full-house-loses`, `qq-three-bet-frustration`, `river-changes-everything`,
`aa-loses`, `ak-flop-miss`. 6편 모두 카드 중복 0, 보드 적법, 팟 재합산 일치, **쇼다운 결과를 평가기로 독립 재판정해 6/6 일치**(리뷰어 A 검증).

---

## 5. LEARN / GLOSSARY / HANDS / TOOLS / QUIZ·SEARCH

- **Learn**: 허브를 3단계 로드맵 + 7개 카테고리 브라우즈로 재구성(순서형 커리큘럼은 유지). 15편 본문 보강.
  4개 핵심 레슨 제목이 실제 검색 문구를 갖도록 교정(§8 리뷰 반영).
- **Glossary**: 58장 카드 벽 → **사전형**(검색창 · 많이 연결된 용어 · 주제별 6분류 · ㄱㄴㄷ 초성 색인 ·
  영문 별칭 노출). 상세는 표제어·영문명·별칭·한 줄 정의·미니 비주얼·관련 슬롯 템플릿. 레지스트리를
  카테고리별 9배치로 분할. 전 용어 본문을 `쉽게 설명하면 / 예로 보면` 구조로 재작성.
  **신규 6개**: 셋 vs 트립스, 인포지션/아웃오브포지션, 거트샷, 오픈엔디드, 브로드웨이, 커넥터/갭.
- **Hands**: 템플릿 보강(사실 스트립 · 비교표 · RFI 도식 · FAQ · 관련), 허브를 169칸 정적 색인으로,
  20편 본문 작성. 모든 수치는 엔진 계산이고 주요 주장은 테스트로 고정했다.
- **Tools**: 6개 전부 "도구 + 가이드" 구조(설명 · 예시 · FAQ 40개 · 관련 링크). 계산 로직은 손대지 않았다.
  레인지 도구의 "준비 중" 비활성 버튼 5개는 제거하고, 지원 범위를 문장으로 선언하는 방식으로 바꿨다(§8 B-M3).
- **Quiz**: 진행 표시 · 큰 선택지 · 정답 피드백 · 결과(점수/오답 복습/재시도/관련 링크). **정답 판정 로직과
  그 테스트는 건드리지 않았다**(표현만 변경). 정답은 하드코딩이 아니라 생성 시점에 평가기가 판정한다.
- **Search**: Learn/Blog/Glossary/Hands/Tools 그룹별 결과 + 개수, 별칭 해석(3벳·쓰리벳·3bet), 빈 상태 제안.
  정적 빌드 인덱스 기반이라 서버 라우트가 없다. `/search`는 noindex 유지.
- **Header/Footer/About**: 데스크톱 6개 주 메뉴 + 보조 메뉴(핸드 목록·소개), 모바일 메뉴 44px 타깃·포커스 트랩,
  정보구조형 푸터, About은 계산 방식·정확성 원칙·레인지 범위·재구성 스토리 정책·하지 않는 것을 명시.
  **가짜 팀·인물·회사·연락처·수상 경력은 만들지 않았다.**

---

## 6. DESIGN SYSTEM · VISUAL ASSETS

- 토큰화된 폭(`max-w-reading|breakout|grid|shell|matrix|lead|figure`), 타이포 스케일(`text-prose`·`text-h2`·
  `text-article-h1`·`text-hero-h1`), `prose-ko`, 다크/라이트 완전 대응.
- 한국어 제목 줄바꿈 규칙(`break-keep` + `wrap-anywhere`)을 `PageHero`에 site-wide 적용.
- **AI 이미지는 생성하지 않았다 / 생성할 수 없었다.** 이 세션에는 이미지 생성 능력이 없다. 대신
  (a) 결정론적 SVG/CSS 편집 아트(`ContentThumbnail`, 히어로 로열 플러시 정확 카드 구성),
  (b) 실제 카드 컴포넌트(`PokerCards`/`BoardCards`)로 정확한 카드를 그리는 방식,
  (c) 미래 AI 사진이 레이아웃 변경 없이 들어갈 슬롯(`EditorialImage`)과 자산 명세(`3BETTILT_VISUAL_ASSET_MANIFEST.md`)를 남겼다.
  스토리 6편의 썸네일 아트는 레코드 id로 결정론적으로 분기해 6편이 서로 다른 그림을 갖는다(§8 B-M1).

---

## 7. SEO · 키워드 · 카니발라이제이션 · 스키마 · 내부 링크

빌드 HTML 전수 감사 도구(`.data/tools/seo-audit.mjs`)로 144개 문서를 파싱한 결과:

| 항목 | 결과 |
| --- | --- |
| canonical / og / hreflang / lang / `<title>` 1개 / `<h1>` 1개 | **141/141** |
| 중복 title / 중복 description | **0 / 0** |
| JSON-LD 파싱 오류 | **0** |
| 깨진 내부 링크 | **0** |
| 고아 페이지(인바운드 2 미만) | **0** (루트 `/ko` 제외 — 홈은 인바운드 개념 밖) |
| 허브 → 하위 커버리지 | learn 15/15 · blog 25/25 · glossary 64/64 · hands 20/20 · tools 6/6 · practice 3/3 |
| `FishTilt` / `example.com` / `localhost` | **0 / 0 / 0** |

- **스키마**: WebSite·Organization(가공 회사 정보 없음)·BreadcrumbList·Article·CollectionPage·
  DefinedTermSet/DefinedTerm(64)·FAQPage(가시 FAQ가 있는 페이지에만: blog 19 · learn 15 · hands 20 · tools 6 · home 1)·
  WebApplication(도구 6). **페이지에 없는 내용으로 스키마를 만들지 않았다.**
- **키워드/카니발**: 의도별 소유 페이지를 확정하고 `3BETTILT_KEYWORD_MAP.md` / `3BETTILT_CANNIBALIZATION_MAP.md`를
  최종 상태로 갱신. 용어 제목 56건에 한국어 표제어를 넣어 "3벳 뜻" 류 의도의 소유자를 용어 사전으로 되돌렸다.
- **내부 링크**: 관계 필드 기반 자동 그룹 + 본문 문맥 링크. 라벨 7종으로 통일.

---

## 8. INDEPENDENT REVIEWS (WP-S3-18) — 결과와 처분

4인 독립 리뷰(구현자와 분리된 fresh context, 코드 수정 권한 없음).

| 리뷰어 | 범위 | BLOCKER | MAJOR | 판정 |
| --- | --- | --- | --- | --- |
| A (Opus) | 포커/수학/콘텐츠 정확성 | **4** | 8 | 전부 처리 |
| B (Opus) | 제품/UX/비주얼 | 0 | 5 | 전부 처리 |
| C (Fable) | SEO/IA/카니발 | 0 | 2 | 전부 처리 |
| D (Sonnet) | 엔지니어링/성능/테스트/배포 | 0 | 0 | 조치 불요 |

### ACCEPT — BLOCKER 4건(전부 수정 완료, 오케스트레이터 직접 수정)
1. `glossary/button.mdx` — "BTN이 프리플랍과 플랍 이후 모두 가장 늦게 행동한다"는 **거짓**. 프리플랍에는
   블라인드 두 자리가 뒤에 있다. → 플랍 이후로 한정하고 프리플랍 예외를 명시.
2. `glossary/ip-oop.mdx` — "BB가 UTG를 상대하면 인포지션"은 **거짓**(플랍 이후 BB가 가장 먼저 행동).
   "프리플랍부터 리버까지 관계가 유지된다"도 거짓(관계가 뒤집힌다). → 둘 다 교정.
3. `blog/full-house-vs-flush.mdx` — "공용 카드에 풀하우스가 깔리면 전원 스플릿"은 **거짓**.
   9♥9♦9♣2♥2♠에서 AA는 9 풀 오브 에이스로 이기고, 남은 9를 든 사람은 포카드다. → 반례를 포함해 재작성.
4. `blog/small-pocket-pairs.mdx` — 포켓페어 6조합이 수티드 4·오프수트 12보다 "훨씬 적다"는 **역전된 추론**
   (6 < 4가 아니다). `<Fact>` 값은 맞고 추론이 틀렸다. → 특정 페어가 특정 수티드보다 오히려 자주 온다는
   사실(22는 221판에 한 번, 65s는 332판에 한 번)로 재작성. 요약 박스의 같은 주장도 함께 수정.

### ACCEPT — MAJOR 15건(수정 완료)
- A: "승률"이 한 사이트에서 두 수를 가리키던 문제(계산기 라벨 = 순수 승 확률, 표·FAQ·JSON-LD = 팟 몫).
  라벨을 `내가 이김`/`상대가 이김`으로, FAQ 정의를 팟 몫으로, 핸드 허브 타이틀을 `기대 몫`으로 통일.
  그 외 7건(족보 비교에서 키커 역할, 브로드웨이 13×13 위치, t9s·kqs·22 서술, 미들/바텀 페어, 수티드 좌석 수 주장)
  수정 + **엔진 계산 기반 테스트 5개로 고정**.
- B: 스토리 6편 동일 썸네일 → id 기반 결정론적 분기 / 데스크톱 헤더에 핸드·소개 보조 메뉴 /
  레인지 도구의 비활성 버튼 5개 → 지원 범위 선언문 / 글 하단 관련 그룹 위계 정리(다음 읽을거리 우선) /
  320px에서 잘리던 표 캡션("6인 · 100BB · First In" 출처 문장) 노출.
- C: 용어 제목 56건에 한국어 표제어 / 초심자 핵심 의도 4개를 레슨 제목이 소유 / preview 배포 noindex 게이트.

### DEFER — 근거 있는 보류
| 항목 | 사유 |
| --- | --- |
| 용어 description 53건이 정의 대신 "X를 설명합니다" 투 | 사실 오류가 아니라 편집 품질. 운영 플레이북의 정기 개선 루프에 배치. 길이 자체는 무해. |
| 날짜(Article `datePublished` 등) 부재 | **정직한 날짜가 없다.** 콘텐츠가 여러 세션에 걸쳐 생성돼 실제 발행일이 없고, 지어내면 스키마가 거짓이 된다. 첫 배포일을 발행일로 쓰는 것은 오너 결정 사항. |
| Organization `logo`, About 연락처 | 실재하는 자산·주소가 필요하다. 만들어 넣지 않는다(오너 제공 시 추가). |
| 핸드 20편 본문의 높은 템플릿 유사도(63–73%) | 169칸 체계의 구조적 특성. 각 페이지의 수치·비교·FAQ는 서로 다르고, 색인 하한 기준은 충족한다. |
| `_global-error.html`의 영어 제목·lang 없음 | **Next 프레임워크 한계**(합성 라우트가 Next 내장 컴포넌트로 하드와이어됨). 실제 사용자가 보는 전역 에러 경계는 한국어 `global-error.tsx`로 존재하며 코드에 근거가 문서화돼 있다. |
| 라벨 표기 분화(`팟 오즈`/`팟오즈` 등) | MINOR. 플레이북의 표기 규칙 항목으로 이관. |

### REJECT — 없음
리뷰 결과 중 "귀찮다/시간 부족"으로 기각한 항목은 없다.

---

## 9. ACCESSIBILITY

- `<h1>` 1개 · 헤딩 순서 건너뜀 없음 · 랜드마크(header/nav 이름 부여/main/footer) · 스킵 링크 ·
  모든 상호작용 요소 키보드 도달 · 44px 터치 타깃 · 이미지 alt / 장식 SVG `aria-hidden` ·
  `prefers-reduced-motion` 대응 · 본문 대비 4.5:1, 큰 글자 3:1을 **다크·라이트 양쪽에서** 스크립트로 측정.
- **실제 버그 1건 발견·수정**: Tailwind v4의 `outline-none`이 모든 `focus-visible:outline-*`를 삼켜
  사이트 전역에서 포커스 링이 보이지 않았다. 키보드 사용자에게 치명적인 결함이었고, 언레이어드 CSS 규칙으로 복구했다.
- 검증은 스크립트 + Playwright 결정론적 어서션(`responsive-a11y.spec.ts`)으로 고정했다. axe는 의존성을 늘리지 않으려고 도입하지 않았다.

---

## 10. PERFORMANCE

- 전 라우트 정적 프리렌더, 서버 함수 0, DB·API 라우트 0.
- 라우트별 first-load JS 459–651 KB(설정한 예산 이내), LCP 32–56 ms, CLS 0
  (에퀴티 도구만 0.059 — 워커 결과 패널). **로컬 측정치이며 실제 사용자 환경 값이 아니다.**
- 가로 스크롤 0(1440/390/320 전수), 표는 내부 스크롤 컨테이너로 격리.

---

## 11. TESTS / E2E / BUILD

- unit **5252 passed / 3 skipped**(382 파일, 전 프로젝트). fishtilt+learn-core만 따로도 그린.
- E2E **343 passed / 0 failed**(Playwright, 프로덕션 빌드 대상).
- 콘텐츠 가드가 실제로 작동한다: 측정된 `readMinutes`, 색인 하한(얇은 페이지 방지), FAQ 규약,
  관계 id 존재, 금지 표현(지시형 조언·수익성·GTO·표기 오류), 핸드 스토리 평가기 검증, 배치별 게이트.
- 이번 Stage에서 테스트를 약화시키거나 삭제해 통과시킨 사례는 없다. 마크업이 바뀌어 무효가 된 어서션은
  **같거나 더 강한 명제로 교체**했다(예: 레인지 도구의 비활성 버튼 어서션 → 지원 범위 문장 + 버튼 0개 어서션).

---

## 12. KNOWN LIMITATIONS

1. `apps/fishtilt`·`packages/learn-core`가 **git에 커밋돼 있지 않다**(오너 조치 §13).
2. 발행일 메타데이터 없음(§8 DEFER).
3. AI 편집 사진 미생성 — 결정론적 아트로 대체(§6).
4. preview noindex는 설정 평가로만 검증했고, 실제 Vercel preview 응답 헤더로는 아직 확인하지 못했다.
5. 에퀴티 도구 CLS 0.059.
6. 용어 description 편집 품질(§8 DEFER).
7. `_global-error.html`은 Next 내장 영어 셸(§8 DEFER).
8. 레인지 데이터는 **6인 · 100BB · First In 한 가지 상황**만 지원한다. 사이트 전체가 이 범위를 명시하며,
   GTO로 부르지 않고 출처 이름을 공개하지 않는다.

---

## 13. OWNER ACTIONS

### 즉시(배포 전 필수)
1. **커밋**: `apps/fishtilt`, `packages/learn-core`, `docs/3BETTILT_*`, `docs/reports/stage3/`를 커밋·푸시한다.
   Vercel Git 연동은 저장소에 있는 파일만 빌드하므로, 지금 상태로 연결하면 빌드할 소스가 없다.
   (나는 요청 없이 커밋하지 않았다.)
2. 배포 절차는 `docs/DEPLOY_3BETTILT.md`를 그대로 따른다.

### Vercel 체크리스트
- Root Directory `apps/fishtilt` · Framework Next.js · Node 22.x · pnpm(lockfile v9).
- 환경변수: `NEXT_PUBLIC_SITE_URL=https://3bettilt.com`(선택, 기본값 동일).
- **Preview 배포 먼저** 만들고 desktop/mobile/dark/light/routes/canonical/sitemap/robots/404를 눈으로 확인한다(§DN).
- Domains에 `3bettilt.com`, `www.3bettilt.com`(apex로 redirect) 추가.

### Cloudflare 체크리스트
- Vercel 도메인 화면이 **표시한 레코드 값 그대로** 입력한다. 이 문서에도, 다른 어떤 문서에도 IP·CNAME 값은 없다(있으면 가짜다).
- 처음에는 **DNS only(회색 구름)** 권장. 프록시를 켠다면 SSL/TLS는 **Full (strict)**, Rocket Loader·Auto Minify는 끈다.

### Search Console 체크리스트
- Domain property 등록 → DNS TXT 확인 → `https://3bettilt.com/sitemap.xml` 제출 →
  대표 URL(홈·레슨·용어·핸드·도구·스토리) URL 검사 → 색인 상태·CWV·쿼리/CTR 관찰.

---

## 14. 초기 콘텐츠 성장 계획 — 우선순위 20편

기존 25편과 중복되지 않고, 현재 도구·레슨·용어로 정직하게 뒷받침할 수 있는 것만 골랐다.

| # | 제안 제목 | 타입 | 의도 | 타깃 쿼리 가설 | 도구 | 레슨 | 용어 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 텍사스 홀덤 룰, 한 판이 끝나기까지 | Search Guide | 규칙 전체 흐름 확인 | 텍사스 홀덤 룰 | — | holdem-basics | 블라인드·쇼다운 |
| 2 | 포커 패 세는 법: 1326가지가 무슨 뜻인가요 | Probability/Data | 조합 수 개념 | 포커 조합 수 | 시작핸드 | hand-matrix | 콤보 |
| 3 | 프리플랍에서 몇 %의 패로 들어가야 하나요 | Search Guide | 레인지 폭 감각 | 프리플랍 레인지 % | 레인지 | poker-range | 레인지·오픈레이즈 |
| 4 | 체크와 콜은 무엇이 다른가요 | Search Guide | 기본 액션 혼동 | 포커 체크 콜 차이 | 퀴즈 | poker-actions | 체크·콜 |
| 5 | 스트레이트와 플러시, 어느 쪽이 더 자주 나오나요 | Probability/Data | 빈도 비교 | 스트레이트 플러시 확률 | 아웃츠 | poker-hand-rankings | 스트레이트·플러시 |
| 6 | 플랍에서 페어가 될 확률은 얼마인가요 | Probability/Data | 플랍 적중률 | 플랍 페어 확률 | 에퀴티 | flop-turn-river | 페어·드로우 |
| 7 | 초보가 가장 많이 잃는 자리, UTG | Beginner mistakes | 자리별 손실 | UTG 뜻 | 레인지 | positions-6max | UTG·포지션 |
| 8 | 에이스를 들면 다 들어가도 될까요 | Beginner mistakes | 에이스 과대평가 | A 하이 승률 | 시작핸드 | starting-hands | 키커 |
| 9 | 수티드 커넥터는 언제 가치가 있나요 | Poker concepts | 커넥터 이해 | 수티드 커넥터 | 시작핸드 | starting-hands | 커넥터·수티드 |
| 10 | 팟 오즈를 5초 안에 계산하는 법 | Search Guide | 즉석 계산 | 팟오즈 계산법 | 팟오즈 | pot-odds | 팟 오즈·아웃츠 |
| 11 | 아웃 개수로 승률을 어림하는 2·4 법칙 | Search Guide | 어림 계산 | 포커 2 4 법칙 | 아웃츠 | outs | 아웃츠·에퀴티 |
| 12 | 리버에서 블러프를 당했다고 느낄 때 | Hand Story | 블러프 체감 | 포커 블러프 대응 | — | three-bet | 블러프 |
| 13 | 탑페어를 들고 끝까지 갔다가 진 판 | Hand Story | 과신의 결과 | 탑페어 | 핸드체커 | flop-turn-river | 키커·탑페어 |
| 14 | 셋을 만들었는데 스트레이트에 졌습니다 | Hand Story | 강한 패의 함정 | 셋 뜻 | 핸드체커 | poker-hand-rankings | 셋 vs 트립스 |
| 15 | 블라인드에서만 계속 잃는 이유 | Beginner mistakes | 블라인드 손실 | 빅블라인드 방어 | 레인지 | position | 빅 블라인드 |
| 16 | 같은 패인데 자리에 따라 다르게 쓰는 이유 | Poker concepts | 포지션 가치 | 포커 포지션 중요성 | 레인지 | position | 인포지션 |
| 17 | 3벳을 당했을 때 무엇을 먼저 보나요 | Poker concepts | 3벳 대응 개념 | 3벳 대응 | — | three-bet | 쓰리벳·포벳 |
| 18 | 포커에서 "에퀴티"는 승률과 어떻게 다른가요 | Search Guide | 용어 혼동 해소 | 에퀴티 뜻 | 에퀴티 | equity | 에퀴티 |
| 19 | AA로 진 판이 왜 정상인가요 | Probability/Data | 분산 이해 | AA 승률 | 에퀴티 | equity | 포켓페어 |
| 20 | 13×13 표를 읽는 법 | Search Guide | 표 해석 | 핸드 레인지 표 | 레인지 | hand-matrix | 핸드 매트릭스 |

작성 절차·카니발 검사·발행 게이트는 `docs/3BETTILT_OPERATING_PLAYBOOK.md`를 따른다.

---

## 15. 산출물

- `docs/DEPLOY_3BETTILT.md` — 배포 절차(§DG/DH/DI/DN)
- `docs/3BETTILT_OPERATING_PLAYBOOK.md` — 운영 루프(§DJ)
- `docs/3BETTILT_STAGE3_STATE.md` — 결정 기록과 현재 상태
- `docs/reports/stage3/` — 감사·키워드·카니발·비주얼 명세·QA 리포트·SEO 감사·리뷰 4건·WP별 handoff 30여 건
- `artifacts/3bettilt-stage3-visual-qa/` — WP별 스크린샷 증거
