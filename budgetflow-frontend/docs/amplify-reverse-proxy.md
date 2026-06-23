# Amplify 리버스 프록시로 백엔드 연동 (Mixed Content·CORS 해결)

정적 export 프론트는 Amplify에서 **HTTPS**로 서빙되는데 백엔드는 `http://13.125.18.200:3000`(HTTP)라
브라우저가 **Mixed Content**로 차단한다. 또한 백엔드 CORS가 Amplify 도메인을 허용하지 않아
교차 출처 호출도 막힌다.

해결: 프론트가 **같은 출처(HTTPS) 상대경로 `/api/*`** 로 호출하고, Amplify가 서버 측에서
HTTP 백엔드로 프록시한다. 브라우저 입장에서 동일 출처 HTTPS이므로 Mixed Content도, CORS도 발생하지 않는다.

## 1) 프론트 코드 (반영됨)
`src/lib/api/http-client.ts` 의 게이팅을 `BASE_URL` 유무와 분리했다.
`NEXT_PUBLIC_BUDGETFLOW_API_BASE_URL` 이 비어 있으면 `fetch("/api/...")` 로 상대경로(동일 출처) 호출한다.

## 2) Amplify 환경변수 (Amplify 콘솔 → App settings → Environment variables)
```
NEXT_PUBLIC_BUDGETFLOW_API_BASE_URL=        # 비워둔다 (상대경로/프록시 사용)
NEXT_PUBLIC_BUDGETFLOW_LIVE_DATA=true
NEXT_PUBLIC_BUDGETFLOW_TAX_API_ENABLED=true
```
변경 후 재배포(빌드)해야 `NEXT_PUBLIC_*` 가 정적 번들에 반영된다.

## 3) Amplify Rewrite 규칙 (Amplify 콘솔 → Hosting → Rewrites and redirects)
| Source address | Target address | Type |
| --- | --- | --- |
| `/api/<*>` | `http://13.125.18.200:3000/api/<*>` | `200 (Rewrite)` |

- 정적 라우팅(SPA) 규칙(`/<*>` → `/index.html` 200 등)이 있다면, **`/api/<*>` 규칙을 그 위(먼저 매칭)** 에 둔다.
- 백엔드 인증 토큰 헤더(Authorization)와 POST/PATCH/DELETE 본문은 그대로 전달된다.

## 로컬 개발
로컬은 `http://localhost` (HTTP) 라 Mixed Content가 없으므로 `.env.local` 의 절대 URL
(`http://13.125.18.200:3000`)을 그대로 사용해도 된다. 게이팅이 절대 URL도 지원한다.

## 검증
1. 배포 후 브라우저 DevTools → Network 에서 API 요청이 `https://<amplify-domain>/api/...` 로 나가는지 확인.
2. Console 에 Mixed Content / CORS 오류가 없어야 한다.
3. 프로젝트/지출/세무 데이터가 실제로 로드되면 성공.
