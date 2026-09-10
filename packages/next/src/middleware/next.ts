import type { AuthNinjaContext } from "../context.js";
import { guardAuthApiRequest, type AuthApiGuardOptions } from "./guard.js";
import { InMemoryRateLimiter } from "./rate-limit.js";

export type AuthMiddlewareOptions = AuthApiGuardOptions & {
  rateLimiter?: InMemoryRateLimiter;
};

export type AuthApiGuard = (request: Request) => Promise<Response | undefined>;

/**
 * Build a reusable guard with a shared in-memory rate limiter.
 * Use inside route wrappers or Next.js middleware.
 */
export function createAuthApiGuard(
  ctx: AuthNinjaContext,
  options: AuthMiddlewareOptions = {},
): AuthApiGuard {
  const rateLimiter = options.rateLimiter ?? new InMemoryRateLimiter();
  const guardCtx = { config: ctx.config, db: ctx.db, rateLimiter };

  return (request: Request) => guardAuthApiRequest(guardCtx, request, options);
}

/**
 * Next.js middleware factory for auth API routes.
 * Reject with 429/403 before route handlers when rate limit, IP policy, or CSRF checks fail.
 */
export function createAuthMiddleware(
  ctx: AuthNinjaContext,
  options: AuthMiddlewareOptions = {},
): AuthApiGuard {
  return createAuthApiGuard(ctx, options);
}
