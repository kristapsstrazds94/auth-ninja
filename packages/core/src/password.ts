import { hash, verify, type Options } from "@node-rs/argon2";
import { AuthNinjaError } from "./errors.js";

/** Argon2id variant per @node-rs/argon2 (const enum — use literal with isolatedModules). */
const ARGON2ID_ALGORITHM = 2;

/** OWASP-aligned Argon2id defaults (19 MiB, t=2, p=1). */
export const PASSWORD_HASH_OPTIONS: Options = {
  algorithm: ARGON2ID_ALGORITHM,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(
  password: string,
  options: Options = PASSWORD_HASH_OPTIONS,
): Promise<string> {
  if (password.length === 0) {
    throw new AuthNinjaError(
      "VALIDATION_ERROR",
      "Password must not be empty",
      400,
    );
  }

  return hash(password, options);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (password.length === 0 || passwordHash.length === 0) {
    return false;
  }

  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Precomputed Argon2id hash used to normalize login timing when the account is unknown. */
let dummyPasswordHashPromise: Promise<string> | undefined;

async function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHashPromise) {
    dummyPasswordHashPromise = hashPassword("__auth_ninja_timing_dummy__");
  }
  return dummyPasswordHashPromise;
}

/**
 * Verify password against a stored hash, or against a dummy hash when none is provided.
 * Always runs Argon2id to reduce user-enumeration via response timing.
 */
export async function verifyPasswordWithTimingProtection(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  const hashToVerify = passwordHash ?? (await getDummyPasswordHash());
  const matches = await verifyPassword(password, hashToVerify);
  return passwordHash !== null && passwordHash !== undefined && matches;
}
