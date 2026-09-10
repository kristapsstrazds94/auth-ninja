import {
  InMemoryLockoutStore,
  LockoutEngine,
  lockoutConfigFromAuthConfig,
  type AuthNinjaConfig,
  type LockoutStore,
} from "@auth-ninja/core";
import type { AuthDb } from "./db/client.js";

export type AuthNinjaContext = {
  config: AuthNinjaConfig;
  db: AuthDb;
  lockout: LockoutEngine;
};

export type CreateAuthNinjaContextOptions = {
  config: AuthNinjaConfig;
  db: AuthDb;
  lockoutStore?: LockoutStore;
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
  };
}
