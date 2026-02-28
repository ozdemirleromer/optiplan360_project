const DEFAULT_API_BASE_URL = "/api";
const LOCAL_API_FALLBACK_PORT = "8080";
const RETRYABLE_PROXY_STATUS = new Set([404, 502, 503, 504]);

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  _isRetry?: boolean;
};

// RESPONSE TYPE MAPPING: snake_case -> camelCase

/**
 * Backend'den snake_case gelen key'leri camelCase'e cevirir.
 * Ornek: user_id -> userId, created_at -> createdAt
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Object/Array icindeki tum key'leri snake_case -> camelCase donusturur.
 * Nested object ve array'leri de recursive olarak isler.
 */
function transformKeys(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => transformKeys(item));
  }

  if (typeof data === "object") {
    const transformed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const camelKey = toCamelCase(key);
      transformed[camelKey] = transformKeys(value);
    }
    // Guvenlik: "parts" alani OrderPartOut dizisi ise sayi'ya cevir
    if (
      Array.isArray(transformed.parts) &&
      transformed.parts.length > 0 &&
      typeof transformed.parts[0] === "object" &&
      transformed.parts[0] !== null &&
      "boyMm" in (transformed.parts[0] as Record<string, unknown>)
    ) {
      transformed.parts = transformed.parts.length;
    }
    return transformed;
  }

  return data;
}

function getPersistedToken(): string | null {
  try {
    const raw = localStorage.getItem("optiplan-auth-storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = parsed?.state?.token;
    return typeof token === "string" && token.trim() ? token : null;
  } catch {
    return null;
  }
}

function clearPersistedAuth(): void {
  localStorage.removeItem("optiplan-auth-storage");
  localStorage.removeItem("optiplan-auth-token");
}

export function getAuthToken(): string | null {
  return getPersistedToken();
}

function normalizeApiBaseUrl(rawBase: string): string {
  const baseUrl = rawBase.replace(/\/+$/, "");
  if (baseUrl.endsWith("/api/v1")) {
    return baseUrl;
  }
  if (baseUrl.endsWith("/api")) {
    return `${baseUrl}/v1`;
  }
  return `${baseUrl}/api/v1`;
}

export function getApiBaseUrl(): string {
  const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || DEFAULT_API_BASE_URL;
  return normalizeApiBaseUrl(rawBase);
}

function pushUniqueCandidate(candidates: string[], seen: Set<string>, candidate: string | null | undefined): void {
  const normalized = candidate?.trim();
  if (!normalized || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  candidates.push(normalized);
}

function buildApiBaseCandidates(): string[] {
  const primaryBase = getApiBaseUrl();
  const candidates: string[] = [];
  const seen = new Set<string>();

  pushUniqueCandidate(candidates, seen, primaryBase);

  if (!primaryBase.startsWith("/")) {
    return candidates;
  }

  const proxyTarget = (import.meta.env.VITE_API_PROXY_TARGET as string | undefined)?.trim();
  if (proxyTarget) {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1";
      const target = new URL(proxyTarget, origin);
      pushUniqueCandidate(candidates, seen, normalizeApiBaseUrl(`${target.protocol}//${target.host}/api`));
    } catch {
      // invalid env value, ignore
    }
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const currentHost = window.location.hostname || "127.0.0.1";
    pushUniqueCandidate(candidates, seen, `${protocol}//${currentHost}:${LOCAL_API_FALLBACK_PORT}/api/v1`);
    if (currentHost !== "127.0.0.1") {
      pushUniqueCandidate(candidates, seen, `${protocol}//127.0.0.1:${LOCAL_API_FALLBACK_PORT}/api/v1`);
    }
    if (currentHost !== "localhost") {
      pushUniqueCandidate(candidates, seen, `${protocol}//localhost:${LOCAL_API_FALLBACK_PORT}/api/v1`);
    }
  }

  return candidates;
}

async function fetchWithApiFallback(path: string, request: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseCandidates = buildApiBaseCandidates();
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let index = 0; index < baseCandidates.length; index += 1) {
    const baseUrl = baseCandidates[index];
    const url = `${baseUrl}${normalizedPath}`;
    const hasNextCandidate = index < baseCandidates.length - 1;

    try {
      const response = await fetch(url, request);
      const shouldTryNextBase =
        hasNextCandidate &&
        baseUrl.startsWith("/") &&
        RETRYABLE_PROXY_STATUS.has(response.status);

      if (shouldTryNextBase) {
        lastResponse = response;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (!hasNextCandidate) {
        throw error;
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError instanceof Error ? lastError : new Error("API request failed");
}

// PROACTIVE TOKEN REFRESH

const TOKEN_REFRESH_MARGIN_SEC = 600; // Son 10 dakikada proaktif refresh
let _refreshPromise: Promise<string | null> | null = null;

function decodeTokenExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string): boolean {
  const exp = decodeTokenExp(token);
  if (exp === null) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec < TOKEN_REFRESH_MARGIN_SEC;
}

function updatePersistedToken(newToken: string): void {
  try {
    const raw = localStorage.getItem("optiplan-auth-storage");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.state) {
      parsed.state.token = newToken;
      localStorage.setItem("optiplan-auth-storage", JSON.stringify(parsed));
    }
  } catch {
    // sessizce gec
  }
}

async function refreshAccessToken(currentToken: string): Promise<string | null> {
  try {
    const resp = await fetchWithApiFallback("/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    const newToken = body?.token as string | undefined;
    if (!newToken) return null;
    updatePersistedToken(newToken);
    return newToken;
  } catch {
    return null;
  }
}

async function ensureFreshToken(): Promise<string | null> {
  const token = getPersistedToken();
  if (!token) return null;
  if (!isTokenExpiringSoon(token)) return token;

  // Eszamanli cagrilari tek promise'de birlestir
  if (!_refreshPromise) {
    _refreshPromise = refreshAccessToken(token).finally(() => {
      _refreshPromise = null;
    });
  }
  const refreshed = await _refreshPromise;
  return refreshed ?? token;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, _isRetry = false, headers, ...rest } = options;

  // Proaktif token yenileme: sure dolmadan once sessizce yenile
  const authToken = skipAuth ? null : await ensureFreshToken();

  const body = rest.body as BodyInit | null | undefined;
  const hasContentType =
    Boolean((headers as Record<string, string> | undefined)?.["Content-Type"]) ||
    Boolean((headers as Record<string, string> | undefined)?.["content-type"]);
  const shouldSetJsonContentType = !(body instanceof FormData) && !hasContentType;

  let response: Response;
  try {
    response = await fetchWithApiFallback(path, {
      ...rest,
      headers: {
        ...(shouldSetJsonContentType ? { "Content-Type": "application/json" } : {}),
        ...(headers || {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
  } catch {
    throw new Error("Sunucuya baglanilamadi. API servisinin calistigini kontrol edin.");
  }

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    // 401 -> tek seferlik refresh dene, basariliysa orijinal istegi tekrarla
    if (response.status === 401 && !skipAuth && !_isRetry) {
      const currentToken = getPersistedToken();
      if (currentToken) {
        const refreshed = await refreshAccessToken(currentToken);
        if (refreshed) {
          return apiRequest<T>(path, { ...options, _isRetry: true });
        }
      }
      clearPersistedAuth();
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    }
    const message =
      typeof data === "object" && data !== null
        ? (data as { detail?: string; message?: string }).detail ||
          (data as { detail?: string; message?: string }).message ||
          `HTTP ${response.status}`
        : (typeof data === "string" && data.trim()) || `HTTP ${response.status}`;
    throw new Error(message);
  }

  // Backend'den gelen snake_case key'leri camelCase'e donustur
  const transformed = transformKeys(data);

  return transformed as T;
}
