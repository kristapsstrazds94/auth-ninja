import { decryptField, encryptField } from "@auth-ninja/core";

/** Encrypt a TOTP seed for database storage. */
export function encryptTotpSecret(secret: string, authSecret: string): string {
  return encryptField(secret, authSecret);
}

/** Decrypt a stored TOTP seed; legacy plaintext values pass through. */
export function decryptTotpSecret(
  stored: string | null | undefined,
  authSecret: string,
): string | null {
  if (!stored) {
    return null;
  }
  return decryptField(stored, authSecret);
}
