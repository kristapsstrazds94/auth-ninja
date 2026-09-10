import type { AuthNinjaConfig } from "@auth-ninja/core";
import type { User } from "../db/schema.js";

/** Wire-format user snapshot for SessionResponse. */
export type SessionUser = {
  id: string;
  email: string;
  mfaEnabled: boolean;
  passkeysEnabled: boolean;
};

export function toSessionUser(user: User, config: AuthNinjaConfig): SessionUser {
  return {
    id: user.id,
    email: user.email,
    mfaEnabled: user.mfaEnabled,
    passkeysEnabled: config.passkeysEnabled,
  };
}

export function toSessionResponse(user: User, config: AuthNinjaConfig) {
  return {
    authenticated: true as const,
    user: toSessionUser(user, config),
  };
}
