/** CSRF header name — matches OpenAPI `csrfHeader` security scheme. */
export const AUTH_CSRF_HEADER = "X-CSRF-Token";

/** CSRF token lifetime (1 hour). */
export const CSRF_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Default auth API path prefix — override via middleware options. */
export const DEFAULT_AUTH_PATH_PREFIX = "/auth";
