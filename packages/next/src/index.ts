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
export { registerUser, type RegisterResult } from "./auth/register.js";
export { loginUser, type LoginResult } from "./auth/login.js";
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
  rotateSession,
  type CreatedSession,
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
