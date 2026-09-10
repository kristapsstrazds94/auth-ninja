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
