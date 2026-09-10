import { randomBytes } from "node:crypto";
import { AuthNinjaError } from "./errors.js";
import { hashPassword, verifyPassword } from "./password.js";

export const DEFAULT_BACKUP_CODE_COUNT = 10;
export const BACKUP_CODE_LENGTH = 10;

/** Alphanumeric set without ambiguous characters (0/O, 1/I/L). */
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Normalize user input: trim, uppercase, strip dashes. */
export function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replaceAll("-", "");
}

function isValidBackupCodeLength(code: string): boolean {
  return code.length >= 8 && code.length <= 32;
}

function generateOneBackupCode(): string {
  const bytes = randomBytes(BACKUP_CODE_LENGTH);
  let code = "";

  for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
    code += BACKUP_CODE_ALPHABET[bytes[i]! % BACKUP_CODE_ALPHABET.length];
  }

  return code;
}

/** Generate single-use backup codes (shown once; store hashes only). */
export function generateBackupCodes(
  count: number = DEFAULT_BACKUP_CODE_COUNT,
): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new AuthNinjaError(
      "VALIDATION_ERROR",
      "Backup code count must be a positive integer",
      400,
    );
  }

  const codes = new Set<string>();

  while (codes.size < count) {
    codes.add(generateOneBackupCode());
  }

  return [...codes];
}

/** Hash a backup code with Argon2id for storage. */
export async function hashBackupCode(code: string): Promise<string> {
  const normalized = normalizeBackupCode(code);

  if (!isValidBackupCodeLength(normalized)) {
    throw new AuthNinjaError(
      "VALIDATION_ERROR",
      "Backup code length must be between 8 and 32 characters",
      400,
    );
  }

  return hashPassword(normalized);
}

/** Constant-time verify via Argon2id (same path as password verify). */
export async function verifyBackupCode(
  code: string,
  codeHash: string,
): Promise<boolean> {
  if (code.length === 0 || codeHash.length === 0) {
    return false;
  }

  const normalized = normalizeBackupCode(code);

  if (!isValidBackupCodeLength(normalized)) {
    return false;
  }

  return verifyPassword(normalized, codeHash);
}

/** Hash a batch of plaintext backup codes for persistence. */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => hashBackupCode(code)));
}
