export const AUTH_NINJA_VERSION = "0.0.0";

export { authNinjaConfigSchema, type AuthNinjaConfig } from "./config.js";
export {
  envRecordToAuthNinjaConfig,
  isWeakSecret,
  loadAuthNinjaConfig,
  type LoadAuthNinjaConfigOptions,
} from "./env-loader.js";
export {
  AUTH_ERROR_CATALOG,
  AUTH_ERROR_CODES,
  AUTH_ERROR_DEFAULT_STATUS,
  AUTH_ERROR_MESSAGES,
  AUTH_GENERIC_MESSAGES,
  AuthNinjaError,
  createAuthError,
  isAuthNinjaError,
  toAuthErrorResponse,
  type AuthErrorDoc,
  type AuthErrorResponse,
  type AuthGenericMessageKey,
  type AuthNinjaErrorCode,
  type CreateAuthErrorOptions,
} from "./errors.js";
export { timingSafeEqualUtf8 } from "./crypto/timing.js";
export {
  hashPassword,
  verifyPassword,
  PASSWORD_HASH_OPTIONS,
} from "./password.js";
export {
  BACKUP_CODE_LENGTH,
  DEFAULT_BACKUP_CODE_COUNT,
  generateBackupCodes,
  hashBackupCode,
  hashBackupCodes,
  normalizeBackupCode,
  verifyBackupCode,
} from "./backup-codes.js";
export {
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  TOTP_WINDOW,
  buildTotpOtpAuthUrl,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
  type BuildTotpOtpAuthUrlOptions,
  type TotpSecret,
  type VerifyTotpCodeOptions,
} from "./totp.js";
export {
  clearLockoutRecord,
  evaluateLockout,
  InMemoryLockoutStore,
  LockoutEngine,
  lockoutConfigFromAuthConfig,
  pruneLockoutRecord,
  recordFailedAttempt,
  type LockoutConfig,
  type LockoutRecord,
  type LockoutStatus,
  type LockoutStore,
  type RecordFailureResult,
} from "./lockout.js";
export {
  AUDIT_EVENT_TYPES,
  AUDIT_FORBIDDEN_FIELD_NAMES,
  IP_AUDIT_REASONS,
  assertAuditPayloadSafe,
  auditEventSchema,
  createIpAuditEvent,
  createLockoutAuditEvent,
  createLoginAuditEvent,
  createLogoutAuditEvent,
  ipAuditEventSchema,
  lockoutAuditEventSchema,
  loginAuditEventSchema,
  logoutAuditEventSchema,
  parseAuditEvent,
  sanitizeAuditPayload,
  type AuditEvent,
  type AuditEventInput,
  type AuditEventType,
  type IpAuditEvent,
  type IpAuditReason,
  type LockoutAuditEvent,
  type LoginAuditEvent,
  type LogoutAuditEvent,
} from "./audit.js";
