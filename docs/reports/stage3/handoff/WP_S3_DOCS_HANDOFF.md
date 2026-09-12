# WP-S3-DOCS — DEPLOY + OPERATING PLAYBOOK (handoff written by the ORCHESTRATOR)

에이전트가 두 문서를 모두 쓴 뒤 handoff 작성 직전에 세션 한도(429)로 종료됨. 산출물은 온전하며, 아래는
오케스트레이터가 직접 확인한 내용이다.

## Files produced
- `docs/DEPLOY_3BETTILT.md` (28 KB, 10개 절 + 부록 A 근거): origin/`NEXT_PUBLIC_SITE_URL`, `/ko` 아키텍처,
  Vercel monorepo 구성(Root Directory `apps/fishtilt`, Node 22, pnpm 11), Preview/Production, 커스텀 도메인·www,
  Cloudflare DNS·HTTPS, sitemap/robots/Search Console, 스모크 테스트, 롤백.
- `docs/3BETTILT_OPERATING_PLAYBOOK.md` (28 KB, 8개 절 + 부록 A): 운영 루프, 주간·월간 루틴, 기존 페이지 갱신,
  카니발라이제이션 검사, 발행 절차(레지스트리+MDX+테스트+게이트), 관찰 지표, 편집 규칙, 사전 발행 체크리스트,
  오류 정정 절차.

## Master verification
- 가짜 DNS 값 없음: IP/CNAME 패턴 grep → 유일한 매치는 근거 절의 `127.0.0.1:3221`(Playwright baseURL). §7.2가
  "Vercel 화면의 값만 사용, 어떤 문서의 IP·CNAME도 복사하지 말 것"을 명시.
- 배포했다는 주장 없음. 두 문서 모두 `path:line` 근거 부록 보유.

## Open issues (owner / WP-16 / WP-20)
1. **BLOCKING for deploy**: `git ls-files apps/fishtilt`·`packages/learn-core` = 0. 커밋 전에는 Vercel Git 연동이
   빌드할 소스가 없다. 오너 조치 필요(이미 권고한 커밋 사항과 동일).
2. Preview 환경 색인 위험·환경변수 미설정 시 origin 처리 등 문서 §2·§5의 지적은 WP-16 SEO 점검에서 재확인할 것.
