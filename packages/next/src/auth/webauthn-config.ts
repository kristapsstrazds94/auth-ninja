import type { AuthNinjaConfig } from "@auth-ninja/core";

/** Expected WebAuthn origin derived from configured base URL. */
export function webAuthnOrigin(config: AuthNinjaConfig): string {
  return new URL(config.baseUrl).origin;
}

/** RP display name for WebAuthn ceremonies. */
export function webAuthnRpName(config: AuthNinjaConfig): string {
  return config.twoFaIssuer;
}

/** RP ID for WebAuthn ceremonies. */
export function webAuthnRpId(config: AuthNinjaConfig): string {
  return config.passkeyRpId;
}

/** Convert a UUID string to 16-byte user handle for WebAuthn. */
export function uuidToUserHandle(userId: string): Uint8Array {
  const hex = userId.replace(/-/g, "");
  const bytes = new Uint8Array(16);

  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}
