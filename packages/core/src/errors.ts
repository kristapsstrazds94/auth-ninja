export type AuthNinjaErrorCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "SESSION_EXPIRED"
  | "MFA_REQUIRED"
  | "MFA_INVALID"
  | "CSRF_INVALID"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR";

export class AuthNinjaError extends Error {
  readonly code: AuthNinjaErrorCode;
  readonly status: number;

  constructor(code: AuthNinjaErrorCode, message: string, status = 400) {
    super(message);
    this.name = "AuthNinjaError";
    this.code = code;
    this.status = status;
  }
}
