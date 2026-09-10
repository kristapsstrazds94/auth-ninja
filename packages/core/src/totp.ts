import * as OTPAuth from "otpauth";

/** Six-digit codes per OpenAPI `TotpCodeRequest`. */
export const TOTP_DIGITS = 6;

/** Standard 30-second TOTP step (RFC 6238). */
export const TOTP_PERIOD_SECONDS = 30;

/** Allowed clock skew in 30s steps (±1 per docs/THREAT-MODEL.md). */
export const TOTP_WINDOW = 1;

const TOTP_CODE_PATTERN = /^[0-9]{6}$/;

export type TotpSecret = {
  /** Base32-encoded TOTP secret — show once only; never log. */
  secret: string;
};

export type BuildTotpOtpAuthUrlOptions = {
  secret: string;
  issuer: string;
  accountName: string;
};

export type VerifyTotpCodeOptions = {
  secret: string;
  code: string;
  window?: number;
};

function createTotp(secret: string, label?: { issuer: string; accountName: string }): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    ...(label ? { issuer: label.issuer, label: label.accountName } : {}),
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/** Generate a cryptographically random TOTP secret (160 bits). */
export function generateTotpSecret(): TotpSecret {
  const secret = new OTPAuth.Secret({ size: 20 });
  return { secret: secret.base32 };
}

/** Build an `otpauth://` URI for authenticator apps. */
export function buildTotpOtpAuthUrl(options: BuildTotpOtpAuthUrlOptions): string {
  const totp = createTotp(options.secret, {
    issuer: options.issuer,
    accountName: options.accountName,
  });
  return totp.toString();
}

/**
 * Verify a six-digit TOTP code against a base32 secret.
 * Returns false for malformed input or invalid secrets without throwing.
 */
export function verifyTotpCode(options: VerifyTotpCodeOptions): boolean {
  const { secret, code, window = TOTP_WINDOW } = options;

  if (!TOTP_CODE_PATTERN.test(code) || secret.length === 0) {
    return false;
  }

  try {
    const totp = createTotp(secret);
    return totp.validate({ token: code, window }) !== null;
  } catch {
    return false;
  }
}

/** Generate the current TOTP code for a secret (testing and adapter use). */
export function generateTotpCode(secret: string): string {
  return createTotp(secret).generate();
}
