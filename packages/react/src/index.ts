export {
  AUTH_CSRF_HEADER,
  AUTH_CSRF_PATH,
  createAuthClient,
  isStateChangingMethod,
  parseAuthErrorResponse,
  type AuthClient,
  type AuthClientOptions,
  type AuthRequestOptions,
} from "./auth-client.js";
export {
  confirm2fa,
  disable2fa,
  enroll2fa,
  regenerateBackupCodes,
  verify2faLogin,
  type BackupCodesResponse,
  type Disable2faInput,
  type TotpConfirmResponse,
  type TotpEnrollResponse,
  type TotpVerifyInput,
} from "./auth-2fa.js";
export {
  deletePasskey,
  listPasskeys,
  passkeyLoginBegin,
  passkeyLoginFinish,
  passkeyRegisterBegin,
  passkeyRegisterFinish,
  type PasskeyCredential,
  type PasskeyListResponse,
  type PasskeyLoginBeginInput,
  type WebAuthnCredentialResponseJson,
  type WebAuthnOptionsJson,
  type WebAuthnOptionsResponse,
} from "./auth-passkeys.js";
export {
  fetchSession,
  isMfaRequiredResponse,
  isSessionResponse,
  login,
  logout,
  register,
  type AuthUser,
  type LoginInput,
  type LoginResult,
  type MfaRequiredResponse,
  type RegisterInput,
  type SessionResponse,
} from "./auth-session.js";
export {
  activityThrottleMs,
  createIdleRefreshController,
  DEFAULT_SESSION_IDLE_MINUTES,
  idleRefreshIntervalMs,
  IDLE_ACTIVITY_EVENTS,
  type IdleRefreshController,
  type IdleRefreshOptions,
} from "./session-idle.js";
export {
  createSessionSync,
  SESSION_SYNC_CHANNEL,
  type SessionSync,
  type SessionSyncMessage,
} from "./session-sync.js";
export { AuthProvider, type AuthProviderProps } from "./provider.js";
export { useAuth, type AuthState } from "./use-auth.js";
export { use2FA, type TwoFaState } from "./use-2fa.js";
export { usePasskey, type PasskeyState } from "./use-passkey.js";
export { useSession, type SessionState } from "./use-session.js";
export { RequireAuth, type RequireAuthProps } from "./require-auth.js";
export {
  readViteAuthClientConfig,
  type ViteAuthClientConfig,
} from "./vite-auth-env.js";
