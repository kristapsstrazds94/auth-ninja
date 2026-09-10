import {
  AUTH_ERROR_CODES,
  AuthNinjaError,
  createAuthError,
  type AuthErrorResponse,
  type AuthNinjaErrorCode,
} from "@auth-ninja/core";

/** CSRF header name — matches OpenAPI `csrfHeader` security scheme. */
export const AUTH_CSRF_HEADER = "X-CSRF-Token";

/** Path for obtaining a CSRF token. */
export const AUTH_CSRF_PATH = "/auth/csrf";

export type AuthClientOptions = {
  /** Origin or absolute URL prefix for the auth API (no trailing slash). */
  baseUrl: string;
  /** Custom fetch implementation (for tests). Defaults to global `fetch`. */
  fetchFn?: typeof fetch;
  /** Attach CSRF header on state-changing requests. Default `true`. */
  csrfEnabled?: boolean;
};

export type AuthRequestOptions = Omit<RequestInit, "body"> & {
  /** JSON-serializable request body; sets `Content-Type: application/json`. */
  json?: unknown;
};

export type AuthClient = {
  /** Fetch wrapper with `credentials: include`, CSRF, and typed error handling. */
  request(path: string, options?: AuthRequestOptions): Promise<Response>;
  /** Like `request` but parses JSON; throws `AuthNinjaError` on non-OK responses. */
  requestJson<T>(path: string, options?: AuthRequestOptions): Promise<T>;
  /** Clears the cached CSRF token (e.g. after logout). */
  clearCsrfToken(): void;
};

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isStateChangingMethod(method: string): boolean {
  return STATE_CHANGING_METHODS.has(method.toUpperCase());
}

function isAuthErrorCode(value: string): value is AuthNinjaErrorCode {
  return (AUTH_ERROR_CODES as readonly string[]).includes(value);
}

/** Parse an auth API error body into `AuthNinjaError`. */
export function parseAuthErrorResponse(status: number, body: unknown): AuthNinjaError {
  if (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    "message" in body &&
    typeof (body as AuthErrorResponse).code === "string" &&
    typeof (body as AuthErrorResponse).message === "string" &&
    isAuthErrorCode((body as AuthErrorResponse).code)
  ) {
    const { code, message } = body as AuthErrorResponse;
    return new AuthNinjaError(code, message, status);
  }

  if (status === 401) return createAuthError("SESSION_EXPIRED", { status });
  if (status === 423) return createAuthError("ACCOUNT_LOCKED", { status });
  if (status === 429) return createAuthError("RATE_LIMITED", { status });
  if (status === 403) return createAuthError("FORBIDDEN", { status });
  return createAuthError("VALIDATION_ERROR", { status });
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function resolvePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function createAuthClient(options: AuthClientOptions): AuthClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  const csrfEnabled = options.csrfEnabled ?? true;

  let csrfToken: string | null = null;
  let csrfFetchPromise: Promise<string> | null = null;

  async function fetchCsrfToken(): Promise<string> {
    const response = await fetchFn(`${baseUrl}${AUTH_CSRF_PATH}`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw parseAuthErrorResponse(response.status, body);
    }

    const data = (await response.json()) as { token?: unknown };
    if (typeof data.token !== "string" || data.token.length === 0) {
      throw createAuthError("VALIDATION_ERROR", {
        message: "Invalid CSRF token response.",
      });
    }

    csrfToken = data.token;
    return csrfToken;
  }

  async function ensureCsrfToken(): Promise<string> {
    if (csrfToken) return csrfToken;
    if (!csrfFetchPromise) {
      csrfFetchPromise = fetchCsrfToken().finally(() => {
        csrfFetchPromise = null;
      });
    }
    return csrfFetchPromise;
  }

  function clearCsrfToken(): void {
    csrfToken = null;
    csrfFetchPromise = null;
  }

  async function buildInit(
    options: AuthRequestOptions = {},
  ): Promise<{ init: RequestInit; method: string }> {
    const method = (options.method ?? "GET").toUpperCase();
    const headers = new Headers(options.headers);

    if (options.json !== undefined) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    }

    if (csrfEnabled && isStateChangingMethod(method)) {
      const token = await ensureCsrfToken();
      headers.set(AUTH_CSRF_HEADER, token);
    }

    const init: RequestInit = {
      ...options,
      method,
      headers,
      credentials: "include",
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    };

    return { init, method };
  }

  async function request(
    path: string,
    options: AuthRequestOptions = {},
    retryOnCsrfInvalid = true,
  ): Promise<Response> {
    const { init } = await buildInit(options);
    const response = await fetchFn(`${baseUrl}${resolvePath(path)}`, init);

    if (
      csrfEnabled &&
      retryOnCsrfInvalid &&
      response.status === 403 &&
      isStateChangingMethod(init.method ?? "GET")
    ) {
      const body = await response.clone().json().catch(() => null);
      const error = parseAuthErrorResponse(response.status, body);
      if (error.code === "CSRF_INVALID") {
        clearCsrfToken();
        return request(path, options, false);
      }
    }

    return response;
  }

  async function requestJson<T>(
    path: string,
    options: AuthRequestOptions = {},
  ): Promise<T> {
    const response = await request(path, options);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw parseAuthErrorResponse(response.status, body);
    }

    return (await response.json()) as T;
  }

  return {
    request,
    requestJson,
    clearCsrfToken,
  };
}
