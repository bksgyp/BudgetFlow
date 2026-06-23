// Amplify 등 일부 환경은 빈 환경변수를 허용하지 않는다.
// 그런 경우 값에 "/" 를 넣으면 동일 출처(상대경로)로 동작하도록 정규화한다.
// 절대 URL을 주면 끝 슬래시를 제거해 그 호스트로 직접 호출한다.
const RAW_BASE_URL = process.env.NEXT_PUBLIC_BUDGETFLOW_API_BASE_URL ?? "";
const BASE_URL = (() => {
  const value = RAW_BASE_URL.trim();
  if (value === "" || value === "/") return ""; // 상대경로(동일 출처) → Amplify 프록시
  return value.replace(/\/+$/, ""); // 절대 URL 끝 슬래시 제거
})();

// 실데이터 / 세무 API 활성화는 명시 플래그로 제어한다.
// BASE_URL이 비어 있으면 상대경로(/api/*)로 동일 출처 호출 → Amplify 리버스 프록시가
// HTTP 백엔드로 전달한다(Mixed Content·CORS 회피). 절대 URL을 주면 그 호스트로 직접 호출.
export const isLiveDataEnabled =
  process.env.NEXT_PUBLIC_BUDGETFLOW_LIVE_DATA === "true";

export const isTaxApiEnabled =
  process.env.NEXT_PUBLIC_BUDGETFLOW_TAX_API_ENABLED === "true";

// 백엔드 연동 여부: 라이브 플래그가 켜졌거나(동일 출처 프록시 포함) 절대 URL이 설정된 경우.
export const isApiConfigured = isLiveDataEnabled || Boolean(BASE_URL);

const TOKEN_KEY = "budgetflow.token";

// snake_case → camelCase 재귀 변환 (PostgreSQL 컬럼명 대응)
function camelize(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function camelizeKeys<T>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map(camelizeKeys) as T;
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        camelize(k),
        camelizeKeys(v),
      ]),
    ) as T;
  }
  return obj as T;
}

async function fetchToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@inha.ac.kr" }),
  });
  if (!res.ok) throw new Error("자동 로그인에 실패했습니다.");

  const data = (await res.json()) as { idToken?: string; accessToken?: string };
  const token = data.idToken ?? data.accessToken ?? "";
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

async function getToken(): Promise<string> {
  return localStorage.getItem(TOKEN_KEY) ?? fetchToken();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  // 토큰 만료 → localStorage 초기화 후 1회 재시도
  if (res.status === 401 && !isRetry) {
    localStorage.removeItem(TOKEN_KEY);
    return request<T>(method, path, body, true);
  }

  if (!res.ok) throw new Error(`API 오류 ${res.status}: ${method} ${path}`);
  return camelizeKeys<T>(await res.json());
}

// xlsx 등 파일 응답을 받아 브라우저 다운로드로 처리
export async function downloadFile(
  path: string,
  filename: string,
): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`다운로드 오류 ${res.status}: ${path}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 브라우저가 blob URL을 처리한 뒤 해제 (즉시 해제 시 다운로드 실패)
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
