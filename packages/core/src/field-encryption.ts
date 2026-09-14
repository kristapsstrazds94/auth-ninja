import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const FIELD_ENCRYPTION_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SCRYPT_SALT = "auth-ninja-field-encryption";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SCRYPT_SALT, KEY_LENGTH);
}

/** Encrypt a sensitive field (e.g. TOTP seed) with AES-256-GCM keyed from AUTH_NINJA_SECRET. */
export function encryptField(plaintext: string, secret: string): string {
  if (plaintext.length === 0) {
    throw new Error("Cannot encrypt empty field value");
  }

  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, encrypted, tag]);
  return `${FIELD_ENCRYPTION_VERSION}:${payload.toString("base64url")}`;
}

/**
 * Decrypt a field encrypted with {@link encryptField}.
 * Plaintext legacy values (pre-encryption) are returned unchanged for migration.
 */
export function decryptField(stored: string, secret: string): string {
  if (!stored.startsWith(`${FIELD_ENCRYPTION_VERSION}:`)) {
    return stored;
  }

  const payload = Buffer.from(stored.slice(FIELD_ENCRYPTION_VERSION.length + 1), "base64url");
  if (payload.length <= IV_LENGTH + 16) {
    throw new Error("Invalid encrypted field payload");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(IV_LENGTH, payload.length - 16);

  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
