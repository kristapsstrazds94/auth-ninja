import type { AuthNinjaConfig } from "@auth-ninja/core";

export type AuthNinjaNextOptions = Partial<AuthNinjaConfig> & {
  secret: string;
  baseUrl: string;
};

/** Merge partial Next adapter options with required fields. */
export function createAuthNinjaConfig(options: AuthNinjaNextOptions): AuthNinjaNextOptions {
  return options;
}

export {
  closeAuthDb,
  createAuthDb,
  authMigrationsFolder,
  runAuthMigrations,
  auditEventTypeEnum,
  auditEvents,
  auditEventsRelations,
  authNinjaSchema,
  credentialTypeEnum,
  credentials,
  credentialsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  type AuditEventPayload,
  type AuditEventRow,
  type AuthDb,
  type AuthDbHandle,
  type CreateAuthDbOptions,
  type Credential,
  type NewAuditEventRow,
  type NewCredential,
  type NewSession,
  type NewUser,
  type Session,
  type User,
} from "./db/index.js";
