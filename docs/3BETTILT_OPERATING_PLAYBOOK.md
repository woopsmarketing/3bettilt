# 3BetTilt 운영 플레이북 (OPERATING PLAYBOOK)

- 대상: 사이트 소유자와 콘텐츠 편집자. 배포 후 사이트를 **어떻게 굴리는지** — 검색 데이터를 보고, 페이지를 고치고, 새 글을 내고, 다시 관찰하는 루프(마스터 계약 §DJ).
- 작성 기준: 2026-09-12 소스 기준. 저장소 구조·테스트·규칙은 실제 파일을 열어 확인했다(부록 A `path:line`). 트래픽 수치·목표치는 **없다** — 아직 배포되지 않았고, 지어내지 않는다.
- 배포 자체는 `docs/DEPLOY_3BETTILT.md`. 콘텐츠 소유권의 원본 판정은 `docs/reports/stage3/3BETTILT_KEYWORD_MAP.md`와 `3BETTILT_CANNIBALIZATION_MAP.md`.

## 0. 운영 루프 한 장

```
Search Console(주 1회) → 질의 발견 → 이 질의를 소유한 페이지가 있나?
  ├─ YES → 갱신 / 확장 / 제목 수정 / 내부 링크 보강 (§2)
  └─ NO  → 콘텐츠 후보 → 카니발라이제이션 검사 (§3) → 발행 (§4)
                → 내부 링크 (§4.5) → 색인(sitemap 자동, Search Console 확인) → 관찰 (§5)
```

원칙 세 줄: 숫자는 전부 엔진이 계산한다(`<Fact>`). 어떤 페이지도 테이블에서 무엇을 하라고 말하지 않는다. 한 질의는 한 페이지가 소유한다.

## 1. 주간 · 월간 루틴

### 주간 (30–60분)

1. **Search Console → 검색 실적**, 최근 28일 vs 이전 28일. 필터: 페이지 = `/ko/` 접두. 보는 것: 노출 상승 질의, CTR 낮은 질의(노출 있는데 클릭 없음), 순위 8–20위 질의(한 걸음이면 1페이지).
2. 질의를 **의도별로 분류**한다: `X 뜻`(Glossary) / `X란·계산법·보는 법`(Learn) / `계산기·표`(Tools) / 구체 질문·비교·확률(Blog) / 개별 시작 핸드 표기(Hands). 규칙은 §3.1.
3. 질의마다 §2의 "기존 페이지?" 판정. 결과를 간단한 목록으로 남긴다(이슈든 메모든 — 형식은 자유, 저장소에 두지 않아도 됨).
4. **Pages(색인 생성) 보고서**: "색인 생성됨" 수가 sitemap `<loc>` 수와 같은가. 새로 생긴 "제외됨" 사유가 있으면 원인 확인(중복·canonical 불일치·noindex — `/ko/search` 하나만 정상).
5. **Core Web Vitals** 보고서: 새로 "개선 필요"가 된 URL 그룹이 있는지.

### 월간 (반나절)

1. 주간 목록 중 "NO(새 페이지)" 후보를 모아 §3 검사 → 그달 발행 목록 확정(양보다 소유권 정합이 우선; 개수 목표 없음).
2. 기존 페이지 중 노출은 있으나 CTR이 낮은 상위 5개 → 제목·description 재작성(§2.2).
3. 카니발라이제이션 재점검: 같은 질의에 두 URL이 번갈아 노출되는지(검색 실적 → 질의 클릭 → 페이지 탭). 있으면 §3.2.
4. 오류 제보·정정 처리(§7).
5. 저장소 게이트 전체 1회(§4.6의 milestone 게이트) 후 배포.

## 2. 기존 페이지가 있을 때: 갱신 · 확장 · 제목 · 링크

### 2.1 판정 기준

| 신호 | 조치 |
| --- | --- |
| 질의의 소유 페이지가 있고 순위 8–20위, 제목에 질의 머리어가 없음 | **제목 수정**(`title`/`seoTitle`/`description`) |
| 노출 많고 CTR 낮음 | 제목·description 재작성(질의 그대로의 어휘, 답을 예고) |
| 소유 페이지에 그 하위 질문의 답이 없음 | **확장**: 절 추가 또는 `## 자주 묻는 것`에 `### 질문?` 추가 |
| 소유 페이지가 있는데 다른 페이지가 노출됨 | **링크**: 노출된 페이지 → 소유 페이지 본문 링크 + 관계 필드; 노출 페이지의 해당 절은 한 문단으로 축소 |
| 인바운드 0–1인 페이지(키워드맵 §5의 고아: `c-bet`, `bluff`, `nuts` 등) | 상위 레슨/글의 관계 필드에 추가 |

### 2.2 어디를 고치나 (페이지 타입별 위치)

| 타입 | 레지스트리(제목·설명·관계·상태) | 본문 MDX | slug→MDX 매핑 | 배치 게이트 테스트 |
| --- | --- | --- | --- | --- |
| Learn | `apps/fishtilt/src/content/registry/learn/{h1,h2,h3,published}.ts` (`order`로 정렬) | `apps/fishtilt/content/learn/<slug>.mdx` | `src/content/learn/*.ts` | `registry/learn/h*.test.ts` |
| Blog(검색 가이드 등) | `registry/blog/{i1..i4}.ts` | `content/blog/<slug>.mdx` | `src/content/blog/i*.ts` | `registry/blog/i*.test.ts` |
| Blog(핸드 스토리) | `registry/blog/stories/{s1,s2,s3}.ts` | `content/blog/<slug>.mdx` | 위와 같은 blog 매핑 | `registry/blog/stories/stories.test.ts` |
| Glossary | `registry/glossary/{g1..g9}.ts` | `content/glossary/<slug>.mdx` | `src/content/glossary/g*.ts` | `registry/glossary/batches.test.ts` 등 |
| Hands | `registry/hands/{k1..k4}.ts` | `content/hands/<slug>.mdx` | `src/content/hands/k*.ts` | `registry/hands/k*.test.ts`(`batchGate.ts` 공용) |

- **`<title>`**: `title`이 H1이자 기본 `<title>`. 블로그만 `seoTitle`로 `<title>`을 H1과 다르게 둘 수 있다(A-2). 접미사 ` · 3BetTilt`는 자동. 페이지 부분 ≤ 49자(키워드맵 §7 기준).
- **`description`**: meta description이자 허브 카드 문장. 한 문장, 답을 예고.
- **`readMinutes`는 측정값**이다. 본문을 고치면 `content.test.ts`가 `estimateReadMinutes(측정 글자수)`와 다르다고 실패한다(A-4). 테스트 메시지가 기대값을 알려주므로 그 값으로 고친다. 추정치를 손으로 적지 않는다(400자/분, 최소 2분).
- **FAQ 규칙**: `## 자주 묻는 것`(또는 `자주 헷갈리`/`자주 하는 질문`) 제목 아래 `### 질문?` — 질문은 반드시 `?`로 끝나고, 답은 평문 문단(목록·소제목·인용 금지). 2개 이상일 때만 `FAQPage` JSON-LD가 나온다(A-5). 답 안의 숫자도 `<Fact>`.
- **숫자는 전부 `<Fact name="…" arg="…" />`**. 이름 목록은 `src/content/facts.ts`의 `FACT_NAMES`(A-6). 없는 숫자가 필요하면 facts.ts에 이름을 추가하고 learn-core/strategy-core에서 계산하게 하는 코드 작업이 필요하다 — 편집자가 숫자를 타이핑하는 일은 없다.
- **본문 링크**: `[텍스트](/learn/pot-odds)`처럼 **로케일 없는** 경로로 쓴다. `/ko`는 렌더 시 자동으로 붙는다(A-7). `claims.test.ts`가 존재하지 않는 경로를 잡는다.
- **용어**: 첫 등장에만 `<Term id="term-<slug>">표기</Term>`; 그 용어는 레코드 `relatedConcepts`에도 있어야 한다(A-4 `content.test.ts:378,392`).

## 3. 새 페이지가 필요할 때: 카니발라이제이션 검사

### 3.1 소유권 규칙 (확정, 재논의 금지)

| 의도 형태 | 소유 | 예 |
| --- | --- | --- |
| `X 뜻` (예외 없음) | **Glossary** | 3벳 뜻, 키커 뜻, 프리플랍 뜻 |
| `X란 · 원리 · 보는 법 · 계산법` | **Learn** | 팟오즈란, 13x13 표 읽는 법 |
| `계산기 · 표 · 확인기` | **Tools** | 팟오즈 계산기, 13x13 핸드레인지 표 |
| 구체 질문 · 비교 · 확률 · 오해 · 유래 · 실제 핸드 | **Blog**(5 타입: `hand-story`, `search-guide`, `beginner-mistake`, `data-probability`, `concept-culture`) | QQ vs AK 승률, 왜 3벳이라 부르나 |
| `<표기>`, `<표기> 뜻/순위/조합` | **Hands** | AKs, AKs 순위 |

비소유자는 그 의도를 **주장하지 않는다**: 제목에 넣지 않고, 본문에서 한 문단 이상 늘리지 않고, 소유 페이지로 링크한다. 클러스터별 세부(누가 무엇을 금지당하는지)는 `3BETTILT_CANNIBALIZATION_MAP.md` §1.1–1.14.

### 3.2 검사 절차 (새 후보 1건당)

1. 후보 질의를 위 표로 분류 → 소유 **타입** 결정.
2. `3BETTILT_KEYWORD_MAP.md`에서 같은 1차/2차 질의를 가진 행을 찾는다(전 페이지의 "카니발 경쟁 path" 열). 있으면 **새 페이지가 아니라 §2**(그 페이지 확장/제목)다.
3. `3BETTILT_CANNIBALIZATION_MAP.md` §5의 seed 45 표에서 "소유자 없음"인지 확인(2026-09-09 기준 4건: 체크레이즈 뜻, 포켓페어 확률, 플러시 확률, 스트레이트 확률). 없음이면 진짜 새 페이지.
4. 저장소 검색: `grep -rl "<후보 어휘>" apps/fishtilt/content` — 이미 여러 파일이 그 어휘를 다루면, 새 페이지를 만들 때 그 파일들의 해당 절을 한 문단으로 줄이고 새 페이지로 링크하는 작업이 **발행 범위에 포함**된다.
5. 결정 기록: 후보 → 타입 → slug → 경쟁 path → 각 경쟁 페이지에서 할 일. 이걸 만들지 못하면 발행하지 않는다.
6. 새 페이지 하나가 두 의도를 동시에 가지려 하면(예: "뜻 + 계산법") 둘로 나누거나 하나를 포기한다. 억지 장문화 금지 — 글로서리 항목 하나가 정답인 질의는 글로서리 항목 하나로 끝낸다(계약 AU).

## 4. 발행: 레지스트리 + MDX + 테스트 + 게이트

### 4.1 공통 절차

1. **레지스트리 레코드** 추가(해당 배치 파일 끝에). 필수 필드는 `src/content/types.ts` `ContentRecord`(A-2): `kind, id(전역 유일), slug(lower-kebab), title, description, level, topic, concepts, prerequisites, relatedConcepts(term-*), relatedTools(route id — 경로 아님), relatedHands(hand-*), nextLessons(learn id), relatedArticles(blog/learn id), status, indexable, readMinutes`. 타입별 추가: learn `order`(빈틈 없는 1..N), glossary `term`·`aliases`(전 글로서리 유일)·`shortDefinition`, blog `contentType`(+`seoTitle`, 스토리는 `hand`), hands `handKey`.
2. **MDX** 작성 `content/<kind>/<slug>.mdx`. 규칙: `import/export` 금지, `# H1` 금지(템플릿이 H1), 허용 컴포넌트만(A-3 `allowList.ts` 27개), 숫자는 `<Fact>`, 링크는 로케일 없이, 용어는 `<Term>` 첫 등장 1회.
3. **slug→MDX 매핑**에 import 한 줄 + 항목 한 줄 추가(`src/content/<kind>/<batch>.ts`, A-8). 빠뜨리면 페이지가 렌더되지 않는다.
4. `status: 'PUBLISHED'`, `indexable: true`로 두고 **최소 분량 기준**을 넘긴다(A-4 `threshold.ts`): learn 1500자·4절·컴포넌트 2·툴 1·다음 단계 1·용어 2 / blog 900·3·1·1·1·1 / glossary 400·2·0·1·0·1 / hands 600·3·1·1·0·1. 못 넘기면 `indexable: false` — 채우기용 문장으로 늘리지 않는다.
5. `readMinutes`: 일단 `2`로 두고 테스트를 돌려 기대값으로 고친다(§2.2).
6. 배치 게이트 테스트가 **소유 slug 목록**을 고정하는 타입(hands `batchGate`의 `ownedSlugs`, 각 `i*.test.ts`/`h*.test.ts`)은 그 목록에 slug를 추가한다. 테스트가 "registers exactly the N owned slugs"로 실패하면 여기다.
7. 새 페이지가 소유하는 의도를 **기존 페이지가 주장하지 않도록** 정리(§3.2 4번) — 같은 커밋에서.
8. §4.6 게이트 → 배포(`docs/DEPLOY_3BETTILT.md` §6) → sitemap 자동 반영(A-9) → Search Console URL 검사로 색인 요청 → §5.

### 4.2 레시피: 검색 가이드 (blog `search-guide` / `data-probability` / `beginner-mistake` / `concept-culture`)

- 제목 = 사람이 치는 질의 그대로(한국어 머리어). `seoTitle`로 `<title>`을 질의형으로, `title`(H1)은 문장형 가능.
- 본문 순서: `<QuickAnswer>` 한 문단(답 + 핵심 숫자 `<Fact>`) → 정의/왜 → 데이터(`ComparisonTable`/`DataTable`/`StatsRow`, 값은 `<Fact>`) → `<ToolCTA tool="<route id>" title="…" action="…">` 1개(툴로 직접 확인) → `## 자주 묻는 것` `### 질문?` 2–3개 → 끝. 하단 관련 링크는 관계 필드가 자동 렌더.
- 의도가 `X 뜻`으로 기울면 글로서리로 보내고 본문은 "왜/얼마나"에 집중. 개별 시작 핸드의 순위·조합은 hands가 소유 — 비교 질문만 다룬다.
- 참고 원형: `content/blog/aks-vs-ako.mdx` + `registry/blog/i1.ts` 첫 레코드(A-8).

### 4.3 레시피: 핸드 스토리 (blog `hand-story`)

- 레코드는 `registry/blog/stories/s*.ts`, `contentType: 'hand-story'` + `hand: HandStoryHand`(stakes, gameType, tableSize, effectiveStack, heroPosition/villainPosition, heroHand, 스트리트별 actions, board, showdown, **`disclosure`**)(A-2, A-10).
- **`disclosure`는 반드시 `HAND_STORY_DISCLOSURE` 상수** = `학습과 재미를 위해 재구성한 핸드 시나리오입니다.` 템플릿이 항상 가시 렌더한다(배지 `재구성한 시나리오`). 숨기거나 문구를 바꾸지 않는다.
- **평가기 검증**: `stories/validate.ts`가 카드 중복, 보드 유효성, 그리고 `showdown.winner`가 strategy-core 평가기 결과와 같은지 검사한다(A-10). `stories.test.ts`가 모든 레코드를 돌린다 — 실제로 지는 패를 이겼다고 쓰면 테스트가 실패한다. 스토리의 "결과"는 데이터가 정하고 서사는 그 결과를 설명한다.
- 본문: 1인칭 서사, `<StreetSection street="preflop|flop|turn|river">` 단위, 숫자는 `<Fact>`(순위·승률·아웃츠 등). 실명·실제 사이트·실제 상대 묘사 금지(재구성 시나리오). "그때 이렇게 했어야 한다"는 결론은 §6의 규칙에 걸린다 — "무엇이 보였고 무엇을 몰랐나"까지.
- `seoTitle`은 `홀덤 핸드 리뷰: QQ vs 72o, …` 형식(기존 6편 참고, A-10). 원형: `content/blog/aa-loses.mdx`.

### 4.4 레시피: 글로서리 항목

- 레코드: `term`(원어, 라틴 표기 유지), `aliases`(검색 표기 — `쓰리벳`, `3벳` 등; 전 항목 유일·다른 term/slug와 충돌 금지), `title`(한글 검색 표기가 앞, 원어 괄호 — 키워드맵 §5 패턴), `shortDefinition`(팝오버 한 줄, 다른 페이지 안에서 렌더됨).
- 본문: 정의 한 문장 → `## 쉽게 설명하면` → `## 예로 보면`(`<PokerCards>`) → 어디서 등장하는지 + Learn "더 배우기" 링크. 400자면 충분하다 — 개념 설명을 늘려 Learn과 경쟁하지 않는다(카니발맵 §1.1 `glossary/range` 사례). 확률 절 금지(§1.12).
- 원형: `content/glossary/kicker.mdx`, `registry/glossary/g1.ts`.

### 4.5 레시피: 핸드 페이지 (hands)

- 169개 중 본문이 있는 것만 `PUBLISHED`·`indexable`. 레코드 `handKey`(예 `'AKs'`), `relatedHands`(이웃), `relatedArticles`(비교 글). 숫자(순위·조합·승률·자리별 첫 레이즈 포함 여부)는 전부 `<Fact name="HAND_RANK|HAND_COMBOS|HAND_EQUITY_VS_RANDOM|…" arg="AKs">`.
- "승률이란"·"순위란" 설명 절 금지(learn 소유). "어느 자리에서 처음 레이즈에 쓰이나요"는 **학습용 기본 레인지(6-Max · 100BB · First In)** 조건을 문장에 명시.
- `batchGate.ts`가 배치별로 소유 slug·PUBLISHED·측정 readMinutes·"수익성/항상 해야 합니다" 문구를 검사한다(A-11). 원형: `content/hands/aks.mdx`, `registry/hands/k1.ts`.

### 4.6 내부 링크

- 관계 필드 6종 → 페이지 하단 `RelatedContent` 자동 렌더. 필드↔라벨: `prerequisites`→더 배우기 · `relatedTools`→직접 확인하기 · `relatedConcepts`→같이 알아둘 용어 · `relatedArticles`→이런 이야기도 있어요 · `relatedHands`→비슷한 핸드 · `nextLessons`→다음으로 읽기(A-12 `RELATED_LABELS`; `graph.ts`의 `RELATION_HEADING` 문장은 템플릿이 라벨로 덮어쓸 수 있는 기본 제목).
- **양방향**: 새 글이 A를 참조하면 A의 관계 필드에도 새 글을 넣는다(스토리↔가이드, 가이드↔hands). 관계는 `PUBLISHED` 대상만 허용되고, 자기 참조·중복·잘못된 kind는 `content.test.ts`가 잡는다.
- **본문 contextual link** 최소 1개(하단 Related만으로 끝내지 않는다 — 계약 BP). 앵커 텍스트는 대상 페이지의 소유 의도 어휘로.

### 4.7 게이트 (저장소 루트에서)

| 시점 | 명령 |
| --- | --- |
| 파일 저장할 때마다(fast) | `pnpm vitest run --project fishtilt src/content` (레지스트리·MDX·FAQ·readMinutes·advice 규칙 전부) |
| 글 1편 완성 | 위 + `pnpm vitest run --project fishtilt src/copy-guards.test.ts` + `pnpm --filter @gto-self/fishtilt typecheck` |
| 월간 발행 묶음 완료(milestone) | `pnpm vitest run --project fishtilt --project learn-core` · `pnpm exec eslint apps/fishtilt/src` · `cd apps/fishtilt && rm -rf .next && pnpm build` · `pnpm e2e:fishtilt`(seo·blog·글로서리 spec 포함) |

MDX에는 prettier를 돌리지 않는다(`.prettierignore` — 인라인 `<Fact/>`가 문단 분리됨). 테스트가 실패하면 assertion을 지우지 말고 글을 고친다.

## 5. 관찰: 무엇을, 어디서, 그러면 무엇을

| 지표 | 어디서 | 이상 신호 | 조치 |
| --- | --- | --- | --- |
| 색인된 페이지 수 | GSC Pages | sitemap `<loc>` 수보다 작음 / "중복, Google이 다른 canonical 선택" | 해당 URL 검사 → canonical·내부 링크 확인, 카니발 §3 |
| 질의별 노출·순위 | GSC 검색 실적(질의) | 신규 질의 출현, 8–20위 정체 | §2 제목·확장 |
| CTR | GSC 검색 실적(페이지) | 노출 상위인데 CTR이 섹션 평균보다 낮음 | 제목·description 재작성 |
| 같은 질의에 URL 2개 | GSC 질의 → 페이지 탭 | 번갈아 노출 | §3.2 소유자 확정, 비소유자 축소+링크 |
| Core Web Vitals | GSC CWV / PageSpeed Insights | LCP·CLS·INP "개선 필요" | 이미지 슬롯·폰트·클라이언트 번들 확인(개발 작업, WP-17 계열) |
| sitemap 오류 | GSC Sitemaps | "가져올 수 없음"·URL 수 불일치 | `curl https://3bettilt.com/sitemap.xml` 확인, 배포 로그의 origin 줄 확인 |
| 404 유입 | GSC Pages "찾을 수 없음(404)" | 외부 링크가 `/learn/...`(무접두)로 들어옴 | D-S3-03(리다이렉트 없음)을 유지하되, 실제 유입이 확인되면 그 근거로 결정 개정 요청 — 그 전엔 추가하지 않음 |
| 구 브랜드/외부 소스 이름 노출 | 사이트 검색·grep | `FishTilt`, 레인지 출처명 | copy-guard 테스트가 막는다; 발견 시 즉시 수정 |

숫자 목표(방문·순위·CTR %)는 두지 않는다. 비교 기준은 언제나 "지난 기간의 같은 지표"다.

## 6. 편집 규칙 (전 페이지 공통, 테스트가 강제하는 것 포함)

1. **포커 숫자를 손으로 쓰지 않는다.** 승률·조합 수·순위·아웃츠·팟오즈·빈도·레인지 포함 여부는 `<Fact>` 또는 엔진 테스트로 고정한다. 지원하지 않는 상황은 "지원하지 않음"이라고 쓴다.
2. **레인지는 GTO가 아니다.** 표현은 "학습용 기본 레인지", 조건은 항상 "6-Max · 100BB · First In"(`RANGE_PROVENANCE_SENTENCE`, A-13). "GTO", "솔버", 외부 레인지 소스 이름, "다른 자료와 교차 검증" 문구 금지. 레지스트리 카피의 `GTO`는 테스트가 막는다(A-4 `content.test.ts:110`).
3. **테이블에서의 행동을 지시하지 않는다.** "콜하세요/폴드해야 합니다/레이즈를 추천" 형태는 부정문("…뜻은 아닙니다")과 함께일 때만 허용(A-4 `content.test.ts:534`, `copy-guards.test.ts:113-120`). "수익성 있다/이득입니다/플러스 EV" 판정 금지(A-11 `PROFIT_VERDICT`, `PROFIT_CLAIM`). "항상/무조건/반드시 …해야 합니다" 금지.
4. **근거 없는 일반화 금지**: "가장 많이 쓰이는/가장 흔한 실수" 류(A-11 `PREVALENCE_SUPERLATIVE`), "실제로 플레이어들이 여는 패"(`OBSERVED_PLAY`). 통계가 없으면 그렇게 쓰지 않는다.
5. **제휴·입금·카지노·보너스 CTA 금지. 실시간 플레이 보조·OCR·화면 읽기·자동화 언급 금지.** 이 사이트는 학습·계산기·용어집이다.
6. **가짜 메타데이터 금지**: 저자 이름, 평점, 리뷰, 발행일·수정일을 만들어 넣지 않는다(JSON-LD도 e2e가 검사, `seo.spec.ts:604`). 검색량 수치 인용 금지.
7. **브랜드**: 공개 표면은 3BetTilt / 워드마크 3BETTILT. 내부 식별자(`fishtilt`)는 건드리지 않는다.
8. **핸드 스토리 고지** 문장 고정(§4.3). 스토리는 재구성이며 실존 인물·사이트를 특정하지 않는다.
9. **한 용어 한 표기**(`copy-guards.test.ts:297` — 검색 alias는 예외). 새 표기를 도입하려면 글로서리 `aliases`에 넣고 본문은 하나로 통일.
10. 이미지: 이 저장소는 이미지를 생성하지 않는다. 슬롯은 `EditorialImage`(CSS/SVG fallback). 래스터 placeholder 금지.

## 7. 사전 발행 체크리스트

- [ ] 질의 → 타입 → 소유권 결정이 §3.2 형식으로 기록되어 있다(경쟁 페이지 조치 포함).
- [ ] 레지스트리 레코드: id 전역 유일, slug lower-kebab, 관계 필드가 존재하는 `PUBLISHED` 대상만 가리킨다, `relatedTools`는 route id.
- [ ] `title`(≤ 49자)에 소유 질의 어휘가 있다; `description` 한 문장.
- [ ] MDX: `# H1` 없음, import/export 없음, 허용 컴포넌트만, `<Fact>` 외 숫자 없음, 링크 로케일 없음, `<Term>` 첫 등장 1회 + `relatedConcepts` 등록.
- [ ] `## 자주 묻는 것` 질문이 `?`로 끝나고 답은 평문(2개 이상).
- [ ] 레슨/블로그: `<ToolCTA>` 1개 본문 중간.
- [ ] 스토리: `disclosure` 상수, `showdown.winner` 평가기 일치(테스트 통과).
- [ ] `readMinutes` = 테스트가 말하는 측정값.
- [ ] 분량 기준 충족 또는 `indexable: false`.
- [ ] slug→MDX 매핑·배치 게이트 slug 목록 갱신.
- [ ] 역방향 관계 필드 + 본문 contextual link ≥ 1.
- [ ] §6 금지 표현 self-check(행동 지시·수익 판정·GTO·소스명·최상급·제휴).
- [ ] `pnpm vitest run --project fishtilt src/content src/copy-guards.test.ts` PASS, typecheck 0.
- [ ] 발행 후: 실 URL 200, `<title>`·canonical·JSON-LD 확인, sitemap에 포함, GSC URL 검사 요청.

## 8. 오류 정정 절차

1. **접수·기록**: 무엇이(URL, 문장), 왜 틀렸는지(근거 — 엔진 값, 규칙 원문). 제보 출처는 기록하되 공개 페이지에 이름을 싣지 않는다.
2. **분류**: (a) 숫자 오류 → 거의 항상 `<Fact>` 미사용이거나 facts.ts 계산 오류. 후자면 코드 이슈로 개발자에게(learn-core/strategy-core 테스트 추가 필요). (b) 규칙·개념 서술 오류 → 본문 수정 + 같은 오류가 재발하지 않게 `claims.test.ts` 류에 엔진으로 계산한 assertion 추가를 개발자에게 요청(기존 예: `claims.test.ts:56-73` AKs/AKo 순위, `:164-169` 스트레이트 라벨). (c) 소유권 위반(다른 페이지가 의도를 주장) → §3.2. (d) 금지 표현 → 문장 재작성, 가드 정규식이 놓쳤다면 가드 확장 요청.
3. **수정**: 해당 MDX/레코드만. 정정으로 본문 길이가 바뀌면 `readMinutes` 재측정. 페이지에 "정정 공지"나 수정일을 **지어 넣지 않는다**(날짜 메타데이터 없음 원칙). 사실을 바로잡는 것으로 끝.
4. **검증**: §4.7 fast 게이트 → 관련 e2e spec 1개 → 배포 → 실 URL 확인 → GSC URL 검사(재크롤 요청).
5. **회귀 방지**: 같은 유형의 오류를 전 콘텐츠에서 grep(예: 같은 잘못된 표현·같은 Fact 이름 누락). 발견분은 같은 사이클에 처리.
6. 오류가 결정(D-S3-xx)이나 계약 자체의 문제라면 코드로 우회하지 않고 오케스트레이터/소유자에게 개정 요청.

## 부록 A. 근거 (2026-09-12 `path:line`)

- **A-1 운영 루프·문서 요구**: 마스터 `prompt` §DJ(3441-3470), §DI(3414-3438).
- **A-2 레코드 타입**: `apps/fishtilt/src/content/types.ts:79-120` `ContentRecord`(관계 필드 6종 `:97-107`, `status` `:109`, `indexable` `:111`, `readMinutes` `:112-119` "NOT a free-hand guess"), `:123-128` `LearnRecord.order`, `:131-152` `GlossaryRecord.term/aliases/shortDefinition`, `:161-169` `BLOG_CONTENT_TYPES` 5종, `:172-189` `BlogRecord.contentType/seoTitle/hand`, `:196-199` `HandStoryRecord`.
- **A-3 MDX 허용 컴포넌트**: `apps/fishtilt/src/content/allowList.ts` `MDX_COMPONENT_ALLOW_LIST` 27개(BettingTimeline … ToolCTA).
- **A-4 콘텐츠 테스트**: `apps/fishtilt/src/content/content.test.ts` — `:110` GTO 금지, `:119-187` 관계 해석·kind 검사·사이클, `:207-215` PUBLISHED만 링크·MDX 존재, `:325` 분량 기준, `:335` PLANNED는 indexable 불가, `:341-346` `readMinutes === estimateReadMinutes(proseCharacters)`, `:357` import/export 금지, `:362` allow-list, `:373` H1 금지, `:378` Term 1회, `:392` Term↔relatedConcepts, `:407` 레슨 ToolCTA, `:464-483` FAQ 질문 `?`·답 평문, `:487` 관계 제목, `:534` 행동 지시 금지(`RECOMMENDATION` `:513-516`, `REFUSAL_MARKERS` `:521-531`). `threshold.ts:150-190` `MINIMUM_CONTENT`(learn/blog/glossary/hands), `:244` 400자/분, `:247-249` `estimateReadMinutes` 최소 2.
- **A-5 FAQ 추출**: `apps/fishtilt/src/lib/seo/faq.ts:42` `MIN_FAQ_ITEMS = 2`, `:44` `FAQ_HEADING = /자주\s*헷갈리|자주\s*묻는|자주\s*하는\s*질문/`, `:81` `extractFaqItems`(`###` 질문만). MDX 실측: `## 자주 묻는 것` 22파일(`grep -rh "^## 자주" apps/fishtilt/content`).
- **A-6 Fact**: `apps/fishtilt/src/components/Fact.tsx`(`<Fact name arg>` → `factValue`), `src/content/facts.ts:131` `FACT_NAMES`, `:300` `factValue(name, arg)`; `Term.tsx:56` `<Term id>`.
- **A-7 링크 로케일**: `apps/fishtilt/mdx-components.tsx:154-157` `a` → `localiseHref(href)`; `src/lib/locale.ts` `localiseHref`. `claims.test.ts:214-222` 본문 링크 존재 검사.
- **A-8 레지스트리/매핑 구조**: `src/content/registry/index.ts` `ALL_CONTENT = learn+blog+glossary+hands`; `registry/learn/index.ts`(`toSorted(order)`), `registry/blog/index.ts`(i1..i4 + `stories/index.ts`), `registry/glossary/index.ts` `GLOSSARY_BATCHES g1..g9`, `registry/hands/index.ts` `HAND_REGISTRY_ORDER`; slug→MDX: `src/content/blog/i1.ts`(`BLOG_I1_MDX`), `src/content/hands/k1.ts`(`HAND_K1_MDX`), `src/content/glossary/g1.ts`, `src/content/learn/*.ts`; 예시 레코드 `registry/blog/i1.ts:3-33`(`readMinutes: 6` 주석 "never a guess"), `registry/hands/k1.ts:3-23`, `registry/glossary/g1.ts:3-27`, `registry/learn/h1.ts:3-30`.
- **A-9 sitemap 자동**: `src/lib/seo/sitemapEntries.ts:34,46` `ALL_CONTENT`; `src/app/[locale]/blog/[slug]/page.tsx:38-39` `generateStaticParams = publishedOfKind('blog')`; `src/content/graph.ts:90` `publishedOfKind`.
- **A-10 스토리**: `src/content/stories/types.ts:35` `HAND_STORY_DISCLOSURE = '학습과 재미를 위해 재구성한 핸드 시나리오입니다.'`, `:38` 배지, `:88-116` `HandStoryHand`(`disclosure` `:116` "Must equal"); `stories/validate.ts:49` `validateHand`, `:93` showdown winner vs 평가기; `registry/blog/stories/stories.test.ts:28,33,52,68`; 레코드 `registry/blog/stories/s1.ts:32-35,96`(`seoTitle: '홀덤 핸드 리뷰: QQ vs 72o, …'`, `disclosure: HAND_STORY_DISCLOSURE`).
- **A-11 카피 가드**: `src/copy-guards.test.ts:113-120` `TABLE_ACTION`/`RECOMMENDATION`/`PROFIT_CLAIM`, `:205` `PREVALENCE_SUPERLATIVE`, `:244` `OBSERVED_PLAY`, `:279-281` `OLD_BRAND`, `:297` 표기 통일; `src/content/registry/hands/batchGate.ts` `PROFIT_VERDICT`, `ALWAYS_MUST`, "registers exactly the N owned slugs", "PUBLISHED, indexable, positive readMinutes".
- **A-12 관계 라벨**: `src/components/RelatedContent.tsx:29-36` `RELATED_LABELS`(더 배우기 / 직접 확인하기 / 같이 알아둘 용어 / 이런 이야기도 있어요 / 비슷한 핸드 / 다음으로 읽기, D-S3-16); `src/content/graph.ts:292-299` `RELATION_HEADING` 기본 문장; 매핑은 `3BETTILT_CANNIBALIZATION_MAP.md` §4-4.
- **A-13 레인지 문구**: `src/features/range/copy.ts:238` `RANGE_PROVENANCE_SENTENCE`("… 학습용 기본 레인지입니다. 모든 상황의 정답을 뜻하지 않으며 …"); 카니발맵 머리말 "레인지는 어디서도 GTO라 부르지 않는다".
- **A-14 소유권 규칙·seed**: `docs/reports/stage3/3BETTILT_CANNIBALIZATION_MAP.md:4`(역할 규칙 확정), `§1.1-1.14`, `§5`(seed 45: 소유자 없음 7 = title 미주장 3 + 페이지 부재 4); `3BETTILT_KEYWORD_MAP.md:6`(title ≤ 49자), `§5` 글로서리 title 패턴, `§6` WEAK 집계.
- **A-15 게이트 명령**: `docs/reports/stage3/AGENT_COMMON_RULES.md:60-66`; 루트 `package.json:24` `e2e:fishtilt`; `.prettierignore`에 `apps/fishtilt/content/**/*.mdx`(STATE.md 인프라 항목).
