# 3BetTilt Site-wide SEO Title & Multilingual Architecture Upgrade — 종합 보고서

작성 2026-09-14 · 계약: `./prompt` · 결정: D-S3-22 (`docs/3BETTILT_STAGE3_STATE.md`)

세부 보고서:
[01 architecture](3BETTILT_SEO_TITLES_01_ARCHITECTURE.md) ·
[02 title map](3BETTILT_SEO_TITLES_02_TITLE_MAP.md) ·
[03 redirects/indexability](3BETTILT_SEO_TITLES_03_REDIRECTS_INDEXABILITY.md) ·
[04 verification](3BETTILT_SEO_TITLES_04_VERIFICATION.md) ·
설계 [multilingual architecture](../3BETTILT_MULTILINGUAL_ARCHITECTURE.md)

## 결론

141개 한국어 indexable 페이지의 `<title>`·meta description을 검색의도 중심으로 재설계했다. H1·본문·디자인·링크·
canonical·hreflang·sitemap·redirect는 **바뀌지 않았다**. `/en`은 만들지 않았고, 영어 추가 시 필요한 hreflang
editions 구조만 출력 변화 없이 준비했다.

## 1. Metadata architecture 변경

- title 형식 `{검색 문구}[ | {qualifier}] - 3BetTilt` (이전 `{page} · 3BetTilt`). 브랜드는 항상 마지막 1회.
- content: `seoTitleOf(record)` = record `seoTitle` override → kind 템플릿(glossary/hands) → H1.
  `seoDescriptionOf(record)` = `seoDescription` override → kind 기본(glossary 정의+deck, hands facts 문장) → `description`.
- 새 필드: `seoTitle`(모든 kind로 확장), `seoDescription`, glossary `seoTerm`. 그 외 추상화 없음.
- JSON-LD name(CollectionPage/WebApplication)은 `titleHead`(qualifier 앞). glossary set 이름은 공용 상수로 허브·용어 페이지 일치.
- `hreflangAlternates(canonical, path, editions?)`, `OPEN_GRAPH_LOCALE` — 다국어 준비(현재 출력 동일).

## 2. Route type별 title template

| 타입 | 템플릿 |
| --- | --- |
| glossary (64) | `{검색어} 뜻 \| 홀덤·포커 용어 설명` — 검색어 = H1 표제어(짧은 약어 유지), `seoTerm`로 override |
| hands (20) | `{AKs} 승률·순위 \| 텍사스 홀덤 프리플랍 핸드 가이드` |
| learn (15) | 레슨별 explicit `seoTitle` |
| blog guide (19) | explicit `seoTitle`, 검색어를 앞에 |
| hand story (6) | `{상황 문장} \| {핸드 대결} 핸드 리뷰` |
| home/hub/tool/practice (17) | 페이지별 정적 `SEO.title`; about은 `소개` 유지 |

## 3. Explicit override

glossary `seoTerm` 8(3벳·4벳·VPIP·PFR·C벳·UTG·IP·OOP·족보) + `seoTitle` 1(set-vs-trips) · learn `seoTitle` 15 ·
learn `seoDescription` 3 · blog `seoTitle` 10(search guide 4 + story 6) · blog `seoDescription` 2. 목록은 02 §2.

## 4. Homepage before / after

| | before | after |
| --- | --- | --- |
| title | `무료 홀덤 학습 · 3BetTilt` | `텍사스 홀덤 배우기 \| 홀덤 족보·핸드레인지·승률 계산기 - 3BetTilt` |
| description | 핸드 순위부터 레인지와 확률까지, 텍사스 홀덤을 쉬운 한국어로. 13×13 핸드레인지 표와 승률·팟 오즈·아웃 계산기를 직접 눌러보며 배우는 무료 학습 사이트입니다. | 텍사스 홀덤을 규칙과 족보부터 핸드레인지·확률까지 쉬운 한국어로 배웁니다. 13×13 핸드레인지 표와 승률·팟오즈·아웃츠 계산기를 직접 눌러보는 무료 학습 사이트입니다. |
| H1 | 홀덤, 외우지 말고 이해하면서 배우세요. | (유지 — title 복사 안 함, 디자인 불변) |

root layout fallback도 같은 상수를 사용.

## 5. Duplicate title count

**0** (description 중복도 0) — unit coverage 테스트(141 전수) + 빌드 HTML 감사 둘 다.

## 6. Sitemap URL count

**141** (변경 전과 동일, root·www·redirect·noindex·error 페이지 미포함).

## 7. Root redirect status

production `https://3bettilt.com` → **308** `/ko` → 200. `next.config.ts` 변경 없음. `/learn`·`/ko/does-not-exist` 404 유지.

## 8. www/http redirect status

`http://3bettilt.com`, `https://3bettilt.com`, `http://www.3bettilt.com`, `https://www.3bettilt.com` 모두 **308 체인으로
`https://3bettilt.com/ko` 200 도달**(`http://www`는 3 hop). 문제 없음 → 코드/DNS/Cloudflare 변경 없음.
Namecheap parking 결과는 Google 캐시 잔존 → **Search Console 재크롤·sitemap 재제출 대상으로만 보고.**

## 9. Future multilingual recommendation

- 영어는 사람이 쓴 production-ready 번역이 있는 문서만 `/en/...`로 생성, 나머지는 404(placeholder·기계번역·홈 redirect 금지).
- 대응 페이지마다 canonical = 자기 자신, hreflang = `ko-KR` + `en` + `x-default` reciprocal — `hreflangAlternates`에 editions만 넘기면 됨.
- root: 영어 준비 전까지 `/` → `/ko` 유지. 이후 권장 `/` = 가벼운 정적 언어 선택 페이지 + `x-default` → `/`.
  Accept-Language 강제 redirect 금지(비강제 추천 배너만 허용).
- `<html lang>`은 그때 `[locale]` layout으로 이동. 절차 전체: `docs/3BETTILT_MULTILINGUAL_ARCHITECTURE.md`.

## 10. Tests

| 게이트 | 결과 |
| --- | --- |
| typecheck (fishtilt) | PASS |
| 신규 `seoTitleCoverage.test.tsx` (141 전수 + 대표 11) · `seoTitle.test.ts` · metadata +4 | PASS |
| targeted unit (seo/app/content/copy-guards/glossary·blog components) | 84 files / 1405 PASS |
| fishtilt 전체 unit 1회 | 232 files / 2572 PASS |
| `pnpm lint` | 0 error (기존 warning 2) |
| production build | PASS, `ƒ` 0 |
| built HTML 감사 + 대표 페이지 검사 | dup 0, title>60 0, desc 50–160 위반 0, canonical/og/hreflang 141/141, broken link 0, H1 변경 0 |
| full E2E / visual regression | 실행 안 함(정책). 수정한 2개 spec은 `playwright --list` 로드 확인 |

## 대표 title (발췌 — 전체 23행은 02 §4)

| path | after |
| --- | --- |
| `/ko` | 텍사스 홀덤 배우기 \| 홀덤 족보·핸드레인지·승률 계산기 - 3BetTilt |
| `/ko/learn` | 텍사스 홀덤 배우기 \| 규칙·족보·포지션·프리플랍 - 3BetTilt |
| `/ko/tools` | 홀덤 계산기 모음 \| 승률·팟오즈·아웃츠·핸드레인지 - 3BetTilt |
| `/ko/hands` | 홀덤 시작 핸드 순위 \| AA·AKs 등 프리플랍 핸드 가이드 - 3BetTilt |
| `/ko/glossary` | 홀덤 용어 사전 \| 프리플랍·3벳·포지션·팟오즈 뜻 - 3BetTilt |
| `/ko/blog` | 홀덤 핸드 분석·포커 질문 가이드 \| 텍사스 홀덤 블로그 - 3BetTilt |
| `/ko/practice` | 홀덤 퀴즈 \| 족보·핸드레인지·시작 핸드 연습 - 3BetTilt |
| `/ko/learn/holdem-basics` | 텍사스 홀덤 규칙 \| 홀덤 하는 법과 한 판의 흐름 - 3BetTilt |
| `/ko/learn/pot-odds` | 팟오즈 계산법 \| 콜에 필요한 최소 승률 구하기 - 3BetTilt |
| `/ko/learn/three-bet` | 3벳이란? \| 레이즈에 다시 레이즈하는 상황 이해하기 - 3BetTilt |
| `/ko/tools/equity` | 홀덤 승률·에퀴티 계산기 \| 무료 포커 계산기 - 3BetTilt |
| `/ko/tools/range` | 홀덤 핸드레인지표 \| 6-max 포지션별 오픈 레인지 도구 - 3BetTilt |
| `/ko/tools/hand-checker` | 포커 핸드 판정기 \| 홀덤 족보 확인 - 3BetTilt |
| `/ko/glossary/three-bet` | 3벳 뜻 \| 홀덤·포커 용어 설명 - 3BetTilt |
| `/ko/glossary/vpip` | VPIP 뜻 \| 홀덤·포커 용어 설명 - 3BetTilt |
| `/ko/hands/aa` | AA 승률·순위 \| 텍사스 홀덤 프리플랍 핸드 가이드 - 3BetTilt |
| `/ko/blog/aks-vs-ako` | AKs vs AKo 차이는? 수티드가 실제로 얼마나 중요한가 - 3BetTilt |
| `/ko/blog/why-72o-is-weak` | 72o는 정말 홀덤 최약체 핸드일까? 순위표의 진짜 바닥 - 3BetTilt |
| `/ko/blog/aa-loses` | 포켓 에이스로 스택을 다 잃은 판 \| AA vs 87s 핸드 리뷰 - 3BetTilt |
| `/ko/practice/hand-ranking-quiz` | 홀덤 족보 퀴즈 \| 포커 핸드 순위 연습 - 3BetTilt |

## prompt와 다르게 한 판단 (요약, 근거는 02 §5)

- `72o가 홀덤 최약체 핸드인 이유` → 글 결론과 반대라서 질문형으로.
- learn/three-bet은 `3벳 뜻` 대신 `3벳이란?` — glossary와 쿼리 경쟁 방지.
- `에쿼티` → 사이트 표기 `에퀴티`.
- 도구·퀴즈 qualifier를 실제 기능에 맞춤(starting-hand, outs, starting-hand-quiz), blog 허브 "전략/검색 가이드" 표현 제외.

## 오너 조치

1. 커밋·배포(이번 변경은 미커밋 상태).
2. 배포 후 Search Console: `/ko` URL 검사 → 색인 요청, sitemap 재제출(옛 Namecheap 결과 갱신 목적).
