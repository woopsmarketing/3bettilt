# 3BetTilt 배포 절차 (DEPLOY_3BETTILT)

- 대상: 사이트 소유자(owner). Vercel + Cloudflare DNS로 `apps/fishtilt`(공개 이름 3BetTilt)를 `https://3bettilt.com`에 올리는 절차.
- 작성 기준: 2026-09-12, 소스·로컬 빌드 산출물을 직접 열어 확인한 값만 적었다(부록 A "근거"에 `path:line`). **이 문서는 아무것도 배포하지 않았다.** 아래는 소유자가 수행할 절차이고, 실제 DNS 레코드 값은 전부 Vercel 대시보드가 보여주는 값을 그대로 옮긴다 — 이 문서에는 IP/CNAME 값이 없고, 있어서도 안 된다.
- 마스터 계약 §DG·§DH·§DI·§DN, 결정 D-S3-01~06(`docs/3BETTILT_STAGE3_STATE.md`)을 따른다.

## 0. 한 장 요약

| 항목 | 값 | 비고 |
| --- | --- | --- |
| Production origin | `https://3bettilt.com` | 코드 기본값(부록 A-1). www 없음, `/ko` 없음, 끝 슬래시 없음 |
| 한국어 사이트 | `https://3bettilt.com` + 경로(무접두) | `/` = 한국어 홈 200. 기존 `/ko/*` 142개 → 1:1 308 (D-S3-23) |
| 환경변수 | `NEXT_PUBLIC_SITE_URL` 1개(선택) | 앱이 읽는 `process.env`는 이것, `next.config.ts`의 `VERCEL_ENV`(preview noindex 게이트, §5.2), Playwright의 `CI`(A-6) |
| 프레임워크 | Next 16 App Router, 전 페이지 정적 프리렌더, API route 0, DB 0 | `output: 'export'`가 **아니므로** Vercel의 Next.js 프리셋으로 배포(A-2) |
| Vercel Root Directory | `apps/fishtilt` | pnpm 워크스페이스 monorepo(A-5) |
| Node | `.nvmrc` = `v22.22.3`, `engines.node >= 22` | Vercel 프로젝트 Node 버전을 22.x로(A-7) |
| 패키지 매니저 | `pnpm@11.21.0`(`packageManager`), lockfile v9 | A-7 |
| sitemap / robots | `https://3bettilt.com/sitemap.xml`, `https://3bettilt.com/robots.txt` | 빌드 시 정적 생성(A-9) |
| 색인 제외 | `/search`(noindex, follow), 404 페이지(noindex) | A-10 |
| DNS | Cloudflare(Free). 값은 Vercel 도메인 화면에서 복사 | §7 |

## 1. 배포 전 반드시 확인할 것 (blocking)

1. **`apps/fishtilt`와 `packages/learn-core`가 git에 없다.** `git ls-files apps/fishtilt`와 `git ls-files packages/learn-core`가 각각 0개다(A-8). Vercel Git 연동은 저장소에 커밋된 파일만 받으므로, 이 상태로 연결하면 빌드할 앱 자체가 없다. **배포 전에 두 디렉토리(그리고 `docs/3BETTILT_*`, `docs/reports/stage3/`)를 커밋·푸시해야 한다.** `packages/shared`·`strategy-core`·`poker-core`는 이미 추적 중이다.
2. Stage 3 최종 게이트(WP-S3-20)가 끝난 소스여야 한다. 이 문서는 절차이지 릴리스 판정이 아니다.
3. 로컬에서 깨끗한 빌드가 한 번 성공해야 한다(§4.3).

## 2. Production domain과 `NEXT_PUBLIC_SITE_URL`

### 2.1 코드가 origin을 정하는 방식

- 기본 origin은 코드에 박혀 있다: `PRODUCTION_ORIGIN = 'https://3bettilt.com'`(A-1). `NEXT_PUBLIC_SITE_URL`이 **비어 있으면 이 값**을 쓴다. 즉 production 빌드에서 변수를 설정하지 않아도 canonical·og:url·sitemap·robots는 전부 `https://3bettilt.com…`으로 나온다(D-S3-05). 빌드 로그에 다음 한 줄이 찍힌다(Next가 sitemap 모듈을 두 번 평가해 2회 보일 수 있음, A-9):
  `[fishtilt] NEXT_PUBLIC_SITE_URL is not set — using production origin default https://3bettilt.com`
- 변수를 설정하면 그 값이 origin이 된다. 단 **bare origin**만 허용한다. 다음은 빌드가 **throw로 실패**한다(A-1 `normaliseOrigin`):
  - 경로 포함: `https://3bettilt.com/ko` → `must be a bare origin with no path…` 에러
  - URL이 아님, `ftp:` 등 http(s) 외 스킴
  - 끝 슬래시 하나(`https://3bettilt.com/`)는 허용되어 슬래시가 제거된다.
- 이 값은 `metadataBase`(A-4)와 모든 절대 URL의 근원이므로 preview와 production이 다른 값을 가져도 코드는 상관하지 않는다 — 다만 §5.2의 함의를 읽을 것.

### 2.2 권장 설정

| 환경 | `NEXT_PUBLIC_SITE_URL` | 이유 |
| --- | --- | --- |
| Production | `https://3bettilt.com` (명시) | 기본값과 같지만, 대시보드에서 값이 보이는 편이 운영상 안전 |
| Preview | 설정하지 않음 → 기본값 `https://3bettilt.com` | D-S3-05: preview도 canonical은 production을 가리킨다(§5.2) |
| 로컬 | 설정하지 않음 | 로컬 빌드도 production canonical을 낸다(의도된 동작) |

## 3. URL 아키텍처 (D-S3-23 — 기본 로케일 무접두, 2026-09-17)

- 한국어(`DEFAULT_LOCALE = 'ko'`)는 접두사 없음: `/`, `/learn`, `/learn/pot-odds`. 페이지는 route group `src/app/(default-locale)/…`에 있고, 디렉토리가 곧 공개 URL이다(rewrite·middleware 없음, 전부 정적).
- `/`는 한국어 홈 HTML을 **200**으로 반환한다. `/` → `/ko` redirect는 제거됐다.
- **기존 `/ko/*` URL**: `next.config.ts` `redirects()`가 `src/lib/legacyLocaleRedirects.ts`의 동결 목록(142 = 141 indexable + `/search`)으로 1:1 `permanent: true`(308) redirect를 낸다. 패턴 rule이 없으므로 `/ko/does-not-exist`는 redirect 없이 404. `/ko/…/`(끝 슬래시)는 Next 기본 슬래시 제거 308 뒤 migration 308 → 2 hop.
- 미지원 로케일(`/en`, `/en/learn`, `/xx`)과 없는 경로는 사이트 자체 404.
- `<html lang>`은 루트 layout의 `DEFAULT_LOCALE`. hreflang은 `ko-KR` + `x-default`(둘 다 같은 무접두 URL) 두 개만 낸다(D-S3-06).
- **미래 로케일**: `docs/3BETTILT_MULTILINGUAL_ARCHITECTURE.md` §2 — 비기본 로케일만 `/<code>/…`(`src/app/[locale]/…`). 존재하지 않는 언어의 placeholder 페이지는 금지.
- 정적 프리렌더 위의 Next 런타임이므로 Vercel이 redirects를 라우팅 계층에서 처리한다. `output: 'export'`로 바꾸면 이 142개 redirect를 호스트 설정으로 옮겨야 한다.

## 4. Vercel 프로젝트 구성 (pnpm monorepo)

### 4.1 사실 관계

- 워크스페이스: `pnpm-workspace.yaml` → `apps/*`, `packages/*`, `solver-lab`(A-5).
- 앱 패키지: `@gto-self/fishtilt`, 스크립트 `build: next build`, `start: next start --port 3220`(A-5). 워크스페이스 의존: `@gto-self/learn-core`, `@gto-self/shared`, `@gto-self/strategy-core`(`workspace:*`).
- 워크스페이스 패키지는 **TypeScript 소스로 소비**된다(`main: ./src/index.ts`, A-5). 별도 빌드 단계가 없고, `next.config.ts`의 `transpilePackages`에 `shared`·`poker-core`·`strategy-core`·`learn-core` 4개가 등록되어 Next가 직접 컴파일한다(A-2). 따라서 "패키지를 먼저 빌드"할 필요가 없다 — `pnpm install` 후 `next build`면 된다.
- 루트 `build`·`verify` 스크립트는 **`apps/web`만** 빌드한다. fishtilt는 `pnpm build:fishtilt`(= `pnpm --filter @gto-self/fishtilt build`)다(A-7). Vercel에서 루트 스크립트 `build`를 쓰면 엉뚱한 앱이 빌드된다.
- 루트 `pnpm install`은 `apps/web`·`packages/db`의 `better-sqlite3`(네이티브 빌드, `allowBuilds`에 등록)까지 설치한다(A-5). fishtilt는 이를 쓰지 않는다. Vercel 빌드 시간·실패 위험을 줄이려면 아래 4.2의 Install Command 옵션 B를 검토하되, **B는 이 저장소에서 검증된 적이 없다** — Preview에서 먼저 확인할 것.
- `vercel.json`은 루트에도 앱에도 없다(A-6). 모든 설정은 대시보드에서 한다.
- `.env`·`.env.example` 파일도 없다. `.gitignore`가 `.env`, `.env.*`를 무시한다(A-8).

### 4.2 대시보드 설정값

| 설정 | 값 | 비고 |
| --- | --- | --- |
| Framework Preset | Next.js | 자동 감지되어야 함 |
| Root Directory | `apps/fishtilt` | "Include source files outside of the Root Directory in the Build Step" **켜기** — 워크스페이스 패키지와 루트 lockfile이 상위에 있음 |
| Install Command | (A, 기본) 비워 두기 → Vercel이 루트 `pnpm-lock.yaml`을 보고 `pnpm install` 실행 | pnpm 버전은 루트 `package.json`의 `packageManager: pnpm@11.21.0`을 따르게 함(corepack). Vercel이 이 버전을 지원하는지 첫 빌드 로그에서 확인 |
|  | (B, 선택) `pnpm install --frozen-lockfile --filter @gto-self/fishtilt...` | fishtilt와 그 워크스페이스 의존만 설치. **미검증** — Preview에서 성공 확인 후 채택 |
| Build Command | 비워 두기(`next build`) 또는 `pnpm build` | Root Directory가 `apps/fishtilt`이므로 앱의 `build` 스크립트 = `next build` |
| Output Directory | 비워 두기(Next 기본 `.next`) | `output: 'export'` 아님 |
| Node.js Version | 22.x | `.nvmrc` `v22.22.3`, `engines >= 22`(A-7) |
| Environment Variables | `NEXT_PUBLIC_SITE_URL = https://3bettilt.com` (Production만, 또는 전 환경) | §2.2 |

### 4.3 로컬에서 같은 빌드 재현 (배포 전 필수 1회)

```
cd /Users/woops/projects/GTO-SELF
pnpm install
cd apps/fishtilt && rm -rf .next && pnpm build
```

- **clean `.next`**: `.next/`는 gitignore(A-8)되며 이전 e2e/스크린샷 빌드 산출물이 남아 있을 수 있다. 검증 빌드는 항상 `rm -rf .next`로 시작한다. Vercel은 매 빌드가 새 컨테이너라 이 문제가 없지만, Vercel의 빌드 캐시를 켠 상태에서 이상한 결과가 나오면 대시보드의 "Redeploy without cache"를 쓴다.
- 기대 결과: exit 0, 모든 라우트가 `○ Static`/`● SSG`, `ƒ`(dynamic) 0. `find .next/server/app -name '*.html' | wc -l`로 HTML 수를 기록해 둔다(콘텐츠가 늘면 수는 변한다 — 2026-09-12 로컬 빌드는 138개, sitemap `<loc>` 135개, A-9).
- 이 저장소에서 여러 에이전트가 동시에 작업 중이면 빌드는 `apps/fishtilt/.data/tools/build-lock.sh`를 통해야 한다(개발자용, 소유자 배포와 무관).

## 5. Preview 배포

### 5.1 절차

1. §1의 커밋·푸시가 끝난 뒤 Vercel에서 GitHub 저장소를 import, §4.2로 설정한다.
2. Production 브랜치(`main`)가 아닌 브랜치를 푸시하거나, 첫 import 직후 생성되는 배포를 Preview로 취급한다. 아직 **커스텀 도메인을 붙이지 않는다**.
3. Preview URL(`*.vercel.app`)에서 §9 스모크 테스트를 **전부** 수행한다(단, canonical/og:url/sitemap host는 preview host가 아니라 `https://3bettilt.com`으로 나오는 것이 정상 — 5.2).
4. 소유자 육안 검토(§DN): desktop·mobile, dark·light, 이미지(OG 카드 `/og.png`), 라우트, canonical, sitemap, robots, 404.
5. 통과하면 `main`에 merge → Production 배포(§6).

이 세션에는 Vercel 접근 권한이 없다. 위는 대시보드 기준 지시이며, CLI를 쓰려면 `npx vercel` 로그인 후 저장소 루트가 아닌 **`apps/fishtilt`에서** `vercel link` → `vercel`(preview) → `vercel --prod`(production) 순서다. CLI 경로도 이 저장소에서 검증된 적은 없다.

### 5.2 Preview는 색인되면 안 된다 — 코드가 보장하는 것과 보장하지 않는 것

- **코드가 보장하는 것(WP-S3-19)**: `apps/fishtilt/next.config.ts`의 `headers()`가 `process.env.VERCEL_ENV === 'preview'`일 때만 모든 경로(`/:path*`)에 `X-Robots-Tag: noindex` 응답 헤더를 붙인다. Vercel은 Production이 아닌 모든 배포에 `VERCEL_ENV=preview`를 빌드 시점에 넣으므로 preview 호스트의 모든 응답이 이 헤더를 갖는다. 이 헤더는 Vercel의 플랫폼 자동 noindex와 별개로 저장소가 직접 내는 것이며, preview 브랜치에 커스텀 도메인을 붙이거나 다른 호스트로 옮겨도 그대로 적용된다.
- **Production은 완전히 무관하다**: `VERCEL_ENV`가 `production`이거나(Vercel) 비어 있으면(로컬 빌드·Playwright) `headers()`는 빈 배열을 돌려주고, 빌드 산출물 `.next/routes-manifest.json`의 `headers`는 이전과 같이 `[]`이다(로컬 빌드로 확인). `robots.txt`(항상 `Allow: /`), 페이지 `<meta robots>`(레지스트리 플래그, A-10), canonical·og:url·sitemap(항상 `https://3bettilt.com…`, D-S3-05)은 환경을 보지 않으며 preview에서도 바뀌지 않는다 — 즉 preview 페이지의 `<meta robots>`는 여전히 `index, follow`이고, 색인을 막는 것은 응답 헤더 한 줄뿐이다. 이는 의도한 설계다: `robots.txt` Disallow는 noindex를 읽지 못하게 하므로 쓰지 않고(§8.1), `policy.ts`의 deny list 없음도 유지된다.
- **첫 preview에서 반드시 확인**: `curl -I https://<preview>.vercel.app/ | grep -i x-robots-tag` → `x-robots-tag: noindex`가 있어야 한다(Vercel 자체 헤더가 있으면 같은 값이 두 번 보일 수 있다 — 정상). 없으면 `VERCEL_ENV`가 빌드에 주입되지 않은 것이므로 대시보드 Environment Variables에서 Vercel 시스템 환경변수 자동 노출("Automatically expose System Environment Variables")이 켜져 있는지 확인한다. Production(`https://3bettilt.com/`)에서는 같은 명령의 결과가 **비어 있어야** 한다(§9 체크리스트).
- Preview 브랜치에 커스텀 도메인을 할당하지 않는다. 할당해도 위 헤더는 붙지만, Vercel 쪽 자동 noindex는 적용되지 않을 수 있다(Vercel 문서 사항, 미검증).

## 6. Production 배포

1. Production Branch = `main`. Environment Variables(Production)에 `NEXT_PUBLIC_SITE_URL=https://3bettilt.com`.
2. `main` 푸시 → 자동 배포. 배포 로그에서 확인: `next build` exit 0, `ƒ` 0, sitemap 로그 줄(§2.1)이 있다면 값이 `https://3bettilt.com`인지.
3. 커스텀 도메인 연결 전에는 `*.vercel.app` production URL에서 §9를 한 번 더 돈다.
4. §7로 도메인 연결 → HTTPS 발급 확인 → §9를 **실제 도메인**에서 다시 돈다(이번엔 canonical host와 실제 host가 일치해야 한다).
5. §8 Search Console.

## 7. 커스텀 도메인 · www 정책 · Cloudflare DNS · HTTPS

### 7.1 도메인 정책 (§DH)

- Canonical host: `https://3bettilt.com` (apex). 한국어 홈은 `https://3bettilt.com/` (D-S3-23; `<head>`·sitemap은 Next 렌더 방식대로 bare origin `https://3bettilt.com`으로 표기 — 같은 URL). 기존 `/ko`는 `/`로 308.
- `www.3bettilt.com` → 301 → `https://3bettilt.com`. **Vercel 도메인 설정에서** apex를 primary로, www를 "Redirect to 3bettilt.com"(308/301)으로 둔다. 코드에는 www 처리가 없고, 있어서도 안 된다(host 정책은 인프라 소관).
- `3bettilt.co.kr`: 현재 **보유하지 않음**. 확보한다면 `3bettilt.co.kr/*` → 301 → `https://3bettilt.com/*` (Vercel에 도메인 추가 후 리다이렉트로, 또는 Cloudflare Redirect Rule로). 보유 전에는 아무것도 구현하지 않는다 — 문서화만.

### 7.2 Vercel에 도메인 추가

1. Vercel Project → Settings → Domains → `3bettilt.com` 추가, 이어서 `www.3bettilt.com` 추가(www는 apex로 redirect 선택).
2. Vercel이 **각 도메인에 필요한 DNS 레코드(타입·이름·값)를 화면에 표시**한다. apex는 보통 A 레코드, www는 CNAME이지만 **정확한 값은 그 화면의 것만 사용한다.** 이 문서나 다른 어떤 문서의 IP·CNAME 값도 복사하지 않는다.

### 7.3 Cloudflare DNS

1. Cloudflare → 해당 zone → DNS → Records. Vercel 화면에 표시된 레코드를 그대로 입력한다. 기존 충돌 레코드(등록기관 파킹 A/AAAA, 다른 CNAME)는 제거한다.
2. **Proxy status**: 처음에는 **DNS only(회색 구름)**를 권장한다.
   - DNS only: Vercel이 직접 TLS를 발급·갱신(Let's Encrypt)하고 Vercel 엣지가 응답한다. 문제 생길 지점이 하나뿐이다. 이 사이트는 정적이라 Cloudflare 캐시 이득이 크지 않다.
   - Proxied(주황 구름): Cloudflare가 앞단에 선다. 이 경우 Cloudflare SSL/TLS 모드를 반드시 **Full (strict)**로 두어야 한다(Flexible이면 Vercel의 HTTPS 리다이렉트와 무한 루프, Full은 인증서 검증 없음). 또한 Vercel의 도메인 검증·인증서 발급이 프록시 뒤에서 실패할 수 있어 Vercel이 DNS only를 요구하는 경우가 있다. Cloudflare의 자동 최적화(Rocket Loader, Auto Minify, Email obfuscation)는 Next 번들을 깨뜨릴 수 있으므로 끈다. 프록시가 필요한 구체적 이유(WAF, 봇 차단)가 생기기 전에는 쓰지 않는다.
3. Cloudflare SSL/TLS → Edge Certificates → "Always Use HTTPS"는 DNS only에서는 무의미(Vercel이 처리), Proxied에서는 켠다.
4. 전파 확인: `dig +short 3bettilt.com`, `dig +short www.3bettilt.com CNAME`, 그리고 Vercel Domains 화면의 상태가 "Valid Configuration"인지.

### 7.4 HTTPS

- Vercel이 도메인 검증 후 인증서를 자동 발급한다. 확인: `curl -sI https://3bettilt.com/ | head -5`(200), `curl -sI http://3bettilt.com/`(HTTPS로 308), `curl -sI https://www.3bettilt.com/ko`(apex로 301/308).
- HSTS는 Vercel이 기본으로 붙이는 헤더를 확인만 한다(`strict-transport-security`). preload 등록은 하지 않는다(되돌리기 어려움).

## 8. sitemap · robots · Google Search Console (§DI)

### 8.1 생성 파일 내용 (로컬 빌드 산출물로 확인, A-9)

- `https://3bettilt.com/robots.txt` — 정확히 다음 형태:
  ```
  User-Agent: *
  Allow: /

  Sitemap: https://3bettilt.com/sitemap.xml
  ```
  Disallow가 없는 것이 **의도**다(`/search`는 noindex 메타로 처리; Disallow하면 오히려 noindex를 읽지 못한다 — A-10 robots.ts 주석).
- `https://3bettilt.com/sitemap.xml` — 색인 가능한 정적 route(`/search` 제외) + `PUBLISHED`·`indexable` 콘텐츠 레코드 전부, 각 `<url>`에 `xhtml:link hreflang="ko-KR"`과 `x-default`(둘 다 자기 URL). `<loc>`은 전부 `https://3bettilt.com…` 단일 host, `/ko` 없음(D-S3-23). `lastmod`·`priority`는 없다(만들어 넣지 않는다 — 가짜 날짜 금지). 목록은 `sitemapEntries()`가 레지스트리에서 계산하므로 **콘텐츠를 발행하면 자동으로 포함**된다(A-9).

### 8.2 Search Console

1. **Domain property**(`3bettilt.com`)로 등록 — apex/www/http/https를 한 번에 커버.
2. 소유 확인: Google이 주는 `google-site-verification=…` TXT 값을 Cloudflare DNS에 **TXT 레코드(이름 `@`)**로 추가. 값은 Search Console 화면의 것만. 전파 후 "확인".
3. Sitemaps → `https://3bettilt.com/sitemap.xml` 제출. 며칠 뒤 "발견된 URL 수"가 sitemap `<loc>` 수와 같은지 확인.
4. URL 검사(대표 URL, 각 섹션 1개씩): `/`, `/learn/pot-odds`, `/blog/aks-vs-ako`, `/glossary/kicker`, `/hands/aks`, `/tools/range`. 각각 "색인 생성 가능", 사용자 선언 canonical = Google 선택 canonical인지. `/search`는 "noindex 태그로 제외"가 정상. 기존 `/ko/*`는 "리디렉션이 포함된 페이지"로 분류되는 것이 정상(D-S3-23 migration, `docs/reports/3BETTILT_URL_MIGRATION_SUMMARY.md` Search Console 절).
5. 이후 정기 확인(운영 플레이북 `docs/3BETTILT_OPERATING_PLAYBOOK.md` §5): Coverage/Pages, Core Web Vitals, 검색 실적(query·CTR·순위).

## 9. Production 스모크 테스트 체크리스트

`H=https://3bettilt.com`(preview 단계면 preview host로 치환; 그때 canonical/og:url/sitemap host는 여전히 `https://3bettilt.com`이어야 함). 하나라도 어긋나면 배포를 되돌리거나 도메인 연결을 보류한다.

| # | 확인 | 명령/방법 | 기대값 |
| --- | --- | --- | --- |
| 1 | 루트 | `curl -sI $H/` | `200` (redirect 없음) |
| 2 | 기존 `/ko` redirect | `curl -sI $H/ko`, `$H/ko/learn/pot-odds` | `308`, `location: /`, `/learn/pot-odds` (1 hop) |
| 3 | 홈 | `curl -s $H/ \| grep -o '<html lang="ko"'` | 1건, HTTP 200 |
| 4 | 섹션 허브 6 + about | `/learn`, `/blog`, `/glossary`, `/hands`, `/tools`, `/practice`, `/about` | 전부 200 |
| 5 | 섹션별 리프 1개씩 | `/learn/pot-odds`, `/blog/aks-vs-ako`, `/glossary/kicker`, `/hands/aks`, `/tools/range`, `/practice/range-quiz` | 200, 각 페이지 `<title>`이 다름, ` - 3BetTilt` 접미사 |
| 6 | 검색 noindex | `curl -s $H/search \| grep -o '<meta name="robots"[^>]*>'` | `noindex, follow`; sitemap에 없음 |
| 7 | 404 | `curl -sI $H/no-such-page`, `$H/ko/no-such-page`, `$H/en`, `$H/en/learn` | 전부 HTTP 404(redirect 없음), 한국어 404 페이지(`_not-found`), canonical 없음, `noindex` |
| 7a | preview 헤더 부재 | `curl -sI $H/ \| grep -i x-robots-tag` | Production에서는 **출력 없음**(§5.2 — `X-Robots-Tag: noindex`는 `VERCEL_ENV=preview`에서만 붙는다) |
| 8 | sitemap | `curl -s $H/sitemap.xml \| grep -c '<loc>'`; `grep -c '/ko'` | 141; `/ko` 0; host 1개 = `https://3bettilt.com` |
| 9 | robots | `curl -s $H/robots.txt` | §8.1과 동일 |
| 10 | canonical / og:url 3페이지 | `/`, `/learn/pot-odds`, `/blog/aks-vs-ako`에서 `<link rel="canonical">`, `og:url` | `https://3bettilt.com`(root) / `https://3bettilt.com/<그 경로>`, 쿼리 없음, `/ko` 없음 |
| 11 | hreflang | 같은 3페이지 | `hrefLang="ko-KR"`·`x-default` 각 1, 둘 다 canonical과 동일 |
| 12 | JSON-LD 파싱 | 3페이지의 `<script type="application/ld+json">`을 전부 `JSON.parse` | 예외 0; 홈 = `Organization`·`WebSite`·`FAQPage`, 아티클 = `Article`·`BreadcrumbList`(허브 = `CollectionPage`) |
| 13 | OG 이미지 | `curl -sI $H/og.png` | 200, `content-type: image/png` |
| 14 | 아이콘 | `$H/icon.svg`, `$H/apple-icon.png` | 200 |
| 15 | 다크/라이트 | 브라우저에서 헤더 테마 토글 | 두 테마 모두 텍스트 대비 정상, 새로고침 후 유지 |
| 16 | 모바일 | 390px 폭(DevTools)에서 홈·레슨·툴(range)·스토리 | 가로 스크롤 0, 헤더 모바일 내비 동작 |
| 17 | 툴 상호작용 | `/tools/range`에서 자리 바꾸기, `/tools/equity` 계산 | 하이드레이션 후 동작(콘솔 오류 0) |
| 18 | 툴 쿼리 canonical | `curl -s "$H/tools/range?pos=BTN" \| grep canonical` | 쿼리 없는 `…/tools/range` |
| 19 | 구 브랜드 | `curl -s $H/ \| grep -ci fishtilt` | 0 |
| 20 | HTTPS/www | §7.4의 curl 3종 | http→https, www→apex |

동일 항목은 저장소 e2e(`tests/e2e/seo.spec.ts`, `locale.spec.ts`, `not-found.spec.ts`)가 로컬 빌드에 대해 자동 검증한다(A-11). 프로덕션에서는 위 표를 사람이 돈다.

## 10. 롤백

Vercel Deployments에서 직전 정상 배포를 "Promote to Production" 또는 "Instant Rollback". 정적 사이트라 데이터 마이그레이션이 없어 롤백에 부작용이 없다.

## 부록 A. 근거 (2026-09-12 기준 `path:line`; 이후 소스가 바뀌면 줄 번호는 달라질 수 있음)

- **A-1 origin**: `apps/fishtilt/src/lib/seo/site.ts:28` `PRODUCTION_ORIGIN = 'https://3bettilt.com'`; `:39-59` `normaliseOrigin` — unset/blank → `null`, URL 아님/비-http(s)/경로·쿼리·프래그먼트 포함 → `throw`; `:62-63` `SITE_ORIGIN = normaliseOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? PRODUCTION_ORIGIN`; `:66-67` `SITE_ORIGIN_IS_DEFAULT`.
- **A-2 next.config**: `apps/fishtilt/next.config.ts:14-19` `transpilePackages` 4개; `:34-36` `redirects()` 1건 `{ source: '/', destination: localePath(DEFAULT_LOCALE,'/'), permanent: true }`; 파일 전체(1-41)에 `output` 키 없음 → static export 아님; `:3` `./src/lib/locale.ts` 확장자 import(`tsconfig.json` `allowImportingTsExtensions`).
- **A-3 locale**: `apps/fishtilt/src/lib/locale.ts:23` `SUPPORTED_LOCALES = ['ko']`, `:29` `DEFAULT_LOCALE`, `:32` `HREFLANG = { ko: 'ko-KR' }`; `apps/fishtilt/src/app/[locale]/layout.tsx:22` `dynamicParams = false`, `:24-26` `generateStaticParams`, `:35` `if (!isLocale(locale)) notFound()`.
- **A-4 root layout**: `apps/fishtilt/src/app/layout.tsx:31` `metadataBase: new URL(SITE_ORIGIN)`, `:74` `<html lang={DEFAULT_LOCALE}>`.
- **A-5 workspace**: `pnpm-workspace.yaml:1-4` packages, `:8-10` `allowBuilds: better-sqlite3, esbuild`; `apps/fishtilt/package.json:6-13` scripts(`build: next build`, `start: next start --port 3220`), `:16-18` `@gto-self/{learn-core,shared,strategy-core}: workspace:*`; `packages/learn-core/package.json:8-9`, `packages/strategy-core/package.json:7-8`, `packages/shared/package.json:8-9` `main/types: ./src/index.ts`; `packages/db/package.json:25` `better-sqlite3`; `apps/fishtilt/tsconfig.json` `module/moduleResolution: nodenext` 주석(소스 소비 이유).
- **A-6 env**: `grep -rn "process.env" apps/fishtilt/{src,next.config.ts,mdx-components.tsx,playwright.config.ts}`(테스트 제외) → `src/lib/seo/site.ts:63,67` `NEXT_PUBLIC_SITE_URL`; `playwright.config.ts:21-23,35` `CI`; `next.config.ts` `headers()` `VERCEL_ENV`(WP-S3-19, §5.2 — preview에서만 `X-Robots-Tag: noindex`). 그 외 0. `vercel.json`·`.env*` 파일 없음(`ls`).
- **A-7 root package / node**: `package.json:6` `packageManager: pnpm@11.21.0`, `:7-9` `engines.node >= 22.0.0`, `:14` `build:fishtilt`, `:13` `build`(web만), `:32` `verify`(web 빌드만); `.nvmrc:1` `v22.22.3`; `pnpm-lock.yaml:1` `lockfileVersion: '9.0'`.
- **A-8 git / ignore**: `git ls-files apps/fishtilt | wc -l` → 0, `git ls-files packages/learn-core | wc -l` → 0, `packages/strategy-core` 78, `packages/shared` 10, `packages/poker-core` 67; `.gitignore:6` `.next/`, `:20-22` `.env`/`.env.*`/`!.env.example`, `:45` `.data/`.
- **A-9 sitemap/robots 산출물**: `apps/fishtilt/src/app/sitemap.ts:15` `dynamic = 'force-static'`, `:25-30` `console.info` 1줄; `src/lib/seo/sitemapEntries.ts:34,46` `ALL_CONTENT` + `:37,45` `ROUTES`에서 계산; 로컬 빌드(`.next/BUILD_ID` `858Dj-osbuYAiSYP4BtJs`, 2026-09-12 04:13): `.next/server/app/robots.txt.body` = §8.1 본문 그대로; `sitemap.xml.body` `<loc>` 135, host `https://3bettilt.com` 단일(405 매치), hreflang ko-KR/x-default; HTML 138(`find .next/server/app -name '*.html'`). 01A handoff 시점(2026-09-09)은 130/133 — 콘텐츠 증가분.
- **A-10 index policy**: `apps/fishtilt/src/lib/seo/policy.ts:53-64` `SECTION_INDEXABLE` — `search: false` 외 전부 true; `src/lib/seo/metadata.ts:103-106` `robots: { index, follow: true }`, hreflang은 `index` 페이지만; `src/app/robots.ts:25-32` `allow: '/'` + sitemap, Disallow 없음(주석 4-17이 이유); `src/app/not-found.tsx:43` `robots: { index: false, follow: true }`; 빌드 HTML `ko/search.html` `<meta name="robots" content="noindex, follow"/>`, `ko.html` `index, follow`, canonical `https://3bettilt.com/ko`, `og:url` 동일, JSON-LD `@type` Organization 2·WebSite 1·FAQPage 1(Question 6). 환경변수를 읽는 robots/metadata 코드 없음(A-6).
- **A-11 e2e** (D-S3-23 이후): `apps/fishtilt/tests/e2e/locale.spec.ts` — `/` 200, 대표 무접두 URL 14개 200 + 자기 canonical, 기존 `/ko` URL 11개 308 1 hop → 200, `/does-not-exist`·`/ko/does-not-exist`·`/en`·`/en/learn` 404. 142개 전체 redirect는 `src/lib/legacyLocaleRedirects.test.ts`. _(이 부록의 나머지 A-항목 줄번호는 migration 이전 코드 기준 기록이다.)_
- **A-12 결정 문서**: `docs/3BETTILT_STAGE3_STATE.md` ORCHESTRATOR DECISIONS D-S3-01~06; owner decisions(production origin, `/ko`, Vercel + Cloudflare Free); `docs/reports/stage3/handoff/WP_S3_01A_HANDOFF.md`(리다이렉트·hreflang·sitemap 실측), `WP_S3_01B_HANDOFF.md`(브랜드 치환·`og.png`).
