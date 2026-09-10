import type { AuthNinjaConfig } from "@auth-ninja/core";
import type { AuthDb } from "../db/client.js";
import { getRequestMeta } from "../http/request-meta.js";
import { genericErrorResponse } from "../http/response.js";
import { AUTH_CSRF_HEADER, DEFAULT_AUTH_PATH_PREFIX } from "./constants.js";
import { verifyCsrfToken } from "./csrf.js";
import { recordSuspiciousIpAudit, runIpAuditHook } from "./ip-audit-hook.js";
import { isAuthApiPath, requiresCsrfProtection } from "./paths.js";
import { InMemoryRateLimiter } from "./rate-limit.js";

export type AuthApiGuardContext = {
  config: AuthNinjaConfig;
  db: AuthDb;
  rateLimiter?: InMemoryRateLimiter;
};

export type AuthApiGuardOptions = {
  /** Auth route prefix (default `/auth`, use `/api/auth` when mounted under `/api`). */
  pathPrefix?: string;
  nowMs?: number;
};

/**
 * Guard auth API requests: rate limit, IP audit hook, and CSRF validation.
 * Returns a blocking `Response` when the request must be rejected, otherwise `undefined`.
 */
export async function guardAuthApiRequest(
  ctx: AuthApiGuardContext,
  request: Request,
  options: AuthApiGuardOptions = {},
): Promise<Response | undefined> {
  const pathPrefix = options.pathPrefix ?? DEFAULT_AUTH_PATH_PREFIX;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!isAuthApiPath(pathname, pathPrefix)) {
    return undefined;
  }

  const meta = getRequestMeta(request);
  const nowMs = options.nowMs ?? Date.now();
  const rateLimiter = ctx.rateLimiter ?? new InMemoryRateLimiter();

  const rateLimit = rateLimiter.check(
    meta.ipAddress,
    ctx.config.apiRateLimitPerMinute,
    60_000,
    nowMs,
  );

  if (!rateLimit.allowed) {
    await recordSuspiciousIpAudit(ctx.config, ctx.db, meta);
    const response = genericErrorResponse("RATE_LIMITED");
    if (rateLimit.retryAfterSeconds !== undefined) {
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    }
    return response;
  }

  const ipAudit = await runIpAuditHook(ctx.config, ctx.db, meta);
  if (ipAudit.blocked) {
    return genericErrorResponse("FORBIDDEN");
  }

  if (
    ctx.config.csrfEnabled &&
    requiresCsrfProtection(request.method, pathname, pathPrefix)
  ) {
    const csrfHeader = request.headers.get(AUTH_CSRF_HEADER);
    if (!verifyCsrfToken(ctx.config.secret, csrfHeader, nowMs)) {
      return genericErrorResponse("CSRF_INVALID");
    }
  }

  return undefined;
}
