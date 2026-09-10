import {
  InMemoryLockoutStore,
  LockoutEngine,
  lockoutConfigFromAuthConfig,
  type AuthNinjaConfig,
  type LockoutStore,
} from "@auth-ninja/core";
import {
  InMemoryWebAuthnChallengeStore,
  type WebAuthnChallengeStore,
} from "./auth/webauthn-challenge-store.js";
import type { AuthDb } from "./db/client.js";

export type AuthNinjaContext = {
  config: AuthNinjaConfig;
  db: AuthDb;
  lockout: LockoutEngine;
  webAuthnChallenges: WebAuthnChallengeStore;
};

export type CreateAuthNinjaContextOptions = {
  config: AuthNinjaConfig;
  db: AuthDb;
  lockoutStore?: LockoutStore;
  webAuthnChallengeStore?: WebAuthnChallengeStore;
};

/** Wire config, database, and lockout engine for route handlers. */
export function createAuthNinjaContext(
  options: CreateAuthNinjaContextOptions,
): AuthNinjaContext {
  const lockout = new LockoutEngine(
    lockoutConfigFromAuthConfig(options.config),
    options.lockoutStore ?? new InMemoryLockoutStore(),
  );

  return {
    config: options.config,
    db: options.db,
    lockout,
    webAuthnChallenges:
      options.webAuthnChallengeStore ?? new InMemoryWebAuthnChallengeStore(),
  };
}
