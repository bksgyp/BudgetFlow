const BASE_URL = process.env.NEXT_PUBLIC_BUDGETFLOW_API_BASE_URL ?? "";
export const isApiConfigured = Boolean(BASE_URL);

// 세무(TaxOps) 엔드포인트는 아직 백엔드에 구현되지 않았다.
// 백엔드가 /tax/* API를 제공하기 전까지는 항상 프론트 mock 세무 데이터를 사용한다.
// 백엔드 준비 후 NEXT_PUBLIC_BUDGETFLOW_TAX_API_ENABLED=true 로 전환한다.
export const isTaxApiEnabled =
  isApiConfigured &&
  process.env.NEXT_PUBLIC_BUDGETFLOW_TAX_API_ENABLED === "true";

// 데이터 소스 스위치. 백엔드가 미완인 현재는 기본 false → 항상 mock 데이터를 사용한다.
// 백엔드가 준비되면 NEXT_PUBLIC_BUDGETFLOW_LIVE_DATA=true 로 실제 데이터로 전환한다.
export const isLiveDataEnabled =
  isApiConfigured &&
  process.env.NEXT_PUBLIC_BUDGETFLOW_LIVE_DATA === "true";

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
};
