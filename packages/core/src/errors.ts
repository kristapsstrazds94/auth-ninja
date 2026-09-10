/**
 * Canonical auth error codes — must match `packages/protocol/openapi.json` ErrorCode enum.
 */
export const AUTH_ERROR_CODES = [
  "INVALID_CREDENTIALS",
  "ACCOUNT_LOCKED",
  "SESSION_EXPIRED",
  "MFA_REQUIRED",
  "MFA_INVALID",
  "CSRF_INVALID",
  "RATE_LIMITED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
] as const;

export type AuthNinjaErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** Wire-format error body returned by auth adapters. */
export type AuthErrorResponse = {
  code: AuthNinjaErrorCode;
  message: string;
};

/**
 * Default generic user-facing messages.
 * Must not reveal whether an email or account exists (see docs/THREAT-MODEL.md).
 */
export const AUTH_ERROR_MESSAGES: Record<AuthNinjaErrorCode, string> = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_LOCKED: "Too many failed attempts. Try again later.",
  SESSION_EXPIRED: "Session expired.",
  MFA_REQUIRED: "Multi-factor authentication is required.",
  MFA_INVALID: "Invalid authentication code.",
  CSRF_INVALID: "Invalid CSRF token.",
  RATE_LIMITED: "Too many requests.",
  FORBIDDEN: "Forbidden.",
  VALIDATION_ERROR: "Invalid request.",
};

/** Default HTTP status when mapping a code to a response. */
export const AUTH_ERROR_DEFAULT_STATUS: Record<AuthNinjaErrorCode, number> = {
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  SESSION_EXPIRED: 401,
  MFA_REQUIRED: 403,
  MFA_INVALID: 400,
  CSRF_INVALID: 403,
  RATE_LIMITED: 429,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
};

/**
 * Flow-specific generic messages (success or neutral) that prevent user enumeration.
 * These are not error codes — use for register, password-reset, and similar flows.
 */
export const AUTH_GENERIC_MESSAGES = {
  REGISTRATION_FAILED: "Unable to complete registration.",
  PASSWORD_RESET_REQUESTED:
    "If an account exists for that email, reset instructions will be sent.",
  PASSWORD_RESET_FAILED: "Unable to reset password.",
  PASSWORD_RESET_SUCCESS: "Password has been reset.",
} as const;

export type AuthGenericMessageKey = keyof typeof AUTH_GENERIC_MESSAGES;

/** Documented error taxonomy for adapters and client authors. */
export type AuthErrorDoc = {
  code: AuthNinjaErrorCode;
  httpStatus: number;
  message: string;
  description: string;
};

export const AUTH_ERROR_CATALOG: readonly AuthErrorDoc[] = [
  {
    code: "INVALID_CREDENTIALS",
    httpStatus: 401,
    message: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
    description:
      "Login or passkey authentication failed. Same message for unknown email and wrong password.",
  },
  {
    code: "ACCOUNT_LOCKED",
    httpStatus: 423,
    message: AUTH_ERROR_MESSAGES.ACCOUNT_LOCKED,
    description:
      "Account temporarily locked after too many failed attempts. Do not reveal lockout threshold.",
  },
  {
    code: "SESSION_EXPIRED",
    httpStatus: 401,
    message: AUTH_ERROR_MESSAGES.SESSION_EXPIRED,
    description: "Session cookie missing, invalid, idle-timed out, or past absolute max age.",
  },
  {
    code: "MFA_REQUIRED",
    httpStatus: 403,
    message: AUTH_ERROR_MESSAGES.MFA_REQUIRED,
    description:
      "Protected action or route requires completed MFA. Login MFA challenges use MfaRequiredResponse instead.",
  },
  {
    code: "MFA_INVALID",
    httpStatus: 400,
    message: AUTH_ERROR_MESSAGES.MFA_INVALID,
    description: "TOTP code or backup code verification failed.",
  },
  {
    code: "CSRF_INVALID",
    httpStatus: 403,
    message: AUTH_ERROR_MESSAGES.CSRF_INVALID,
    description: "Missing or invalid CSRF header on a state-changing request.",
  },
  {
    code: "RATE_LIMITED",
    httpStatus: 429,
    message: AUTH_ERROR_MESSAGES.RATE_LIMITED,
    description: "Client exceeded rate limit for auth endpoints.",
  },
  {
    code: "FORBIDDEN",
    httpStatus: 403,
    message: AUTH_ERROR_MESSAGES.FORBIDDEN,
    description: "Authenticated user lacks permission for the requested action.",
  },
  {
    code: "VALIDATION_ERROR",
    httpStatus: 400,
    message: AUTH_ERROR_MESSAGES.VALIDATION_ERROR,
    description:
      "Request body or parameters failed validation. Use REGISTRATION_FAILED variant for duplicate email (409).",
  },
] as const;

export class AuthNinjaError extends Error {
  readonly code: AuthNinjaErrorCode;
  readonly status: number;

  constructor(code: AuthNinjaErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AuthNinjaError";
    this.code = code;
    this.status = status ?? AUTH_ERROR_DEFAULT_STATUS[code];
  }
}

export type CreateAuthErrorOptions = {
  message?: string;
  status?: number;
};

/** Create an AuthNinjaError with the default generic message and HTTP status for `code`. */
export function createAuthError(
  code: AuthNinjaErrorCode,
  options: CreateAuthErrorOptions = {},
): AuthNinjaError {
  return new AuthNinjaError(
    code,
    options.message ?? AUTH_ERROR_MESSAGES[code],
    options.status,
  );
}

export function isAuthNinjaError(value: unknown): value is AuthNinjaError {
  return value instanceof AuthNinjaError;
}

export function toAuthErrorResponse(error: AuthNinjaError): AuthErrorResponse {
  return { code: error.code, message: error.message };
}
