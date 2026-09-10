import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time UTF-8 string comparison. Length mismatch still performs work
 * to reduce timing leaks about where strings differ.
 */
export function timingSafeEqualUtf8(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
