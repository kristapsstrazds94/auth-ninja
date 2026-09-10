import type { AuthNinjaConfig } from "@auth-ninja/core";

export type AuthNinjaNextOptions = Partial<AuthNinjaConfig> & {
  secret: string;
  baseUrl: string;
};

/** Merge partial Next adapter options with required fields. */
export function createAuthNinjaConfig(options: AuthNinjaNextOptions): AuthNinjaNextOptions {
  return options;
}

export { createAuthNinjaContext, type AuthNinjaContext } from "./context.js";
export { createRegisterHandler, type RegisterRouteHandler } from "./routes/register.js";
export { createLoginHandler, type LoginRouteHandler } from "./routes/login.js";
export { createSessionHandler, type SessionRouteHandler } from "./routes/session.js";
export { createLogoutHandler, type LogoutRouteHandler } from "./routes/logout.js";
export { createCsrfHandler, type CsrfRouteHandler } from "./routes/csrf.js";
export {
  createTwoFaBackupCodesHandler,
  createTwoFaConfirmHandler,
  createTwoFaDisableHandler,
  createTwoFaEnrollHandler,
  createTwoFaVerifyHandler,
  type TwoFaBackupCodesHandler,
  type TwoFaConfirmHandler,
  type TwoFaDisableHandler,
  type TwoFaEnrollHandler,
  type TwoFaVerifyHandler,
} from "./routes/two-fa.js";
export {
  AUTH_CSRF_HEADER,
  DEFAULT_AUTH_PATH_PREFIX,
  CSRF_TOKEN_TTL_MS,
} from "./middleware/constants.js";
export { generateCsrfToken, verifyCsrfToken } from "./middleware/csrf.js";
export { InMemoryRateLimiter, type RateLimitResult } from "./middleware/rate-limit.js";
export { isAuthApiPath, requiresCsrfProtection } from "./middleware/paths.js";
export {
  guardAuthApiRequest,
  type AuthApiGuardContext,
  type AuthApiGuardOptions,
} from "./middleware/guard.js";
export {
  runIpAuditHook,
  recordSuspiciousIpAudit,
  type IpAuditHookResult,
} from "./middleware/ip-audit-hook.js";
export {
  createAuthApiGuard,
  createAuthMiddleware,
  type AuthApiGuard,
  type AuthMiddlewareOptions,
} from "./middleware/next.js";
export { registerUser, type RegisterResult } from "./auth/register.js";
export { loginUser, type LoginResult } from "./auth/login.js";
export { getSessionUser, type GetSessionSuccess } from "./auth/get-session.js";
export { logoutUser, type LogoutSuccess } from "./auth/logout.js";
export {
  confirmTwoFa,
  disableTwoFa,
  enrollTwoFa,
  regenerateBackupCodes,
  verifyTwoFaLogin,
  type ConfirmTwoFaResult,
  type DisableTwoFaResult,
  type EnrollTwoFaResult,
  type RegenerateBackupCodesResult,
  type VerifyTwoFaLoginResult,
} from "./auth/two-fa.js";
export {
  AUTH_SESSION_COOKIE_NAME,
  LOGIN_CHALLENGE_TTL_MS,
} from "./session/constants.js";
export {
  buildSessionClearCookieHeader,
  buildSessionSetCookieHeader,
  parseSessionCookie,
  sessionCookieOptionsFromConfig,
} from "./session/cookie.js";
export { generateSessionToken, hashSessionToken } from "./session/token.js";
export {
  createSession,
  invalidateSessionByToken,
  resolveSessionByToken,
  rotateSession,
  touchSession,
  type CreatedSession,
  type ResolvedSession,
} from "./session/service.js";

export {
  closeAuthDb,
  createAuthDb,
  authMigrationsFolder,
  runAuthMigrations,
  auditEventTypeEnum,
  auditEvents,
  auditEventsRelations,
  authNinjaSchema,
  credentialTypeEnum,
  credentials,
  credentialsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  type AuditEventPayload,
  type AuditEventRow,
  type AuthDb,
  type AuthDbHandle,
  type CreateAuthDbOptions,
  type Credential,
  type NewAuditEventRow,
  type NewCredential,
  type NewSession,
  type NewUser,
  type Session,
  type User,
} from "./db/index.js";
