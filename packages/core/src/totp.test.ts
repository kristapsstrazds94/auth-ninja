import * as OTPAuth from "otpauth";
import { describe, expect, it } from "vitest";
import {
  buildTotpOtpAuthUrl,
  generateTotpCode,
  generateTotpSecret,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  verifyTotpCode,
} from "./totp.js";

describe("generateTotpSecret", () => {
  it("returns a base32 secret", () => {
    const { secret } = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(0);
    expect(() => OTPAuth.Secret.fromBase32(secret)).not.toThrow();
  });

  it("returns unique secrets", () => {
    const first = generateTotpSecret().secret;
    const second = generateTotpSecret().secret;
    expect(first).not.toBe(second);
  });
});

describe("buildTotpOtpAuthUrl", () => {
  it("returns an otpauth URI with issuer and account", () => {
    const { secret } = generateTotpSecret();
    const url = buildTotpOtpAuthUrl({
      secret,
      issuer: "AuthNinja",
      accountName: "user@test.local",
    });

    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("issuer=AuthNinja");
    expect(url).toContain("user%40test.local");
  });
});

describe("verifyTotpCode", () => {
  it("accepts the current code for a secret", () => {
    const { secret } = generateTotpSecret();
    const code = generateTotpCode(secret);
    expect(verifyTotpCode({ secret, code })).toBe(true);
  });

  it("rejects an incorrect code", () => {
    const { secret } = generateTotpSecret();
    expect(verifyTotpCode({ secret, code: "000000" })).toBe(false);
  });

  it("rejects malformed codes without throwing", () => {
    const { secret } = generateTotpSecret();
    expect(verifyTotpCode({ secret, code: "12345" })).toBe(false);
    expect(verifyTotpCode({ secret, code: "abcdef" })).toBe(false);
    expect(verifyTotpCode({ secret, code: "" })).toBe(false);
  });

  it("rejects codes for an empty secret", () => {
    expect(verifyTotpCode({ secret: "", code: "123456" })).toBe(false);
  });

  it("accepts codes within the configured clock skew window", () => {
    const { secret } = generateTotpSecret();
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD_SECONDS,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const previousTimestamp = Date.now() - TOTP_PERIOD_SECONDS * 1000;
    const previousCode = totp.generate({ timestamp: previousTimestamp });

    expect(verifyTotpCode({ secret, code: previousCode, window: 1 })).toBe(true);
    expect(verifyTotpCode({ secret, code: previousCode, window: 0 })).toBe(false);
  });
});
