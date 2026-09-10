export const AUTH_NINJA_VERSION = "0.0.0";

export { authNinjaConfigSchema, type AuthNinjaConfig } from "./config.js";
export {
  envRecordToAuthNinjaConfig,
  isWeakSecret,
  loadAuthNinjaConfig,
  type LoadAuthNinjaConfigOptions,
} from "./env-loader.js";
export { AuthNinjaError, type AuthNinjaErrorCode } from "./errors.js";
export { timingSafeEqualUtf8 } from "./crypto/timing.js";
export {
  hashPassword,
  verifyPassword,
  PASSWORD_HASH_OPTIONS,
} from "./password.js";
