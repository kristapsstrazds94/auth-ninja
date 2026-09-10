import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Matches `@auth-ninja/core` audit event families. */
export const auditEventTypeEnum = pgEnum("audit_event_type", [
  "login",
  "logout",
  "lockout",
  "ip",
]);

/** WebAuthn passkeys and hashed TOTP backup codes. Password hash lives on `users`. */
export const credentialTypeEnum = pgEnum("credential_type", ["passkey", "totp_backup"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    totpSecret: text("totp_secret"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_normalized_uidx").on(table.emailNormalized),
    index("users_email_idx").on(table.email),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SHA-256 of the HttpOnly cookie value — never store the raw token. */
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uidx").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: credentialTypeEnum("type").notNull(),
    /** WebAuthn credential ID (base64url). Null for `totp_backup`. */
    credentialId: text("credential_id"),
    /** COSE public key (base64). Null for `totp_backup`. */
    publicKey: text("public_key"),
    counter: integer("counter"),
    nickname: text("nickname"),
    /** JSON array of authenticator transports. */
    transports: text("transports"),
    /** Argon2id hash for single-use backup codes. Null for `passkey`. */
    codeHash: text("code_hash"),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("credentials_credential_id_uidx")
      .on(table.credentialId)
      .where(sql`${table.credentialId} is not null`),
    index("credentials_user_id_idx").on(table.userId),
    index("credentials_user_id_type_idx").on(table.userId, table.type),
  ],
);

/** Type-specific fields stored in `payload` (outcome, attemptCount, reason, etc.). */
export type AuditEventPayload = {
  outcome?: "success" | "failure";
  attemptCount?: number;
  unlockAt?: string;
  reason?: "suspicious_activity" | "allowlist_violation" | "geo_anomaly" | "new_ip";
  previousIpAddress?: string;
};

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    type: auditEventTypeEnum("type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text("ip_address").notNull(),
    userAgent: text("user_agent"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<AuditEventPayload>().notNull().default({}),
  },
  (table) => [
    index("audit_events_occurred_at_idx").on(table.occurredAt),
    index("audit_events_user_id_idx").on(table.userId),
    index("audit_events_type_idx").on(table.type),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  credentials: many(credentials),
  auditEvents: many(auditEvents),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  user: one(users, {
    fields: [credentials.userId],
    references: [users.id],
  }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  user: one(users, {
    fields: [auditEvents.userId],
    references: [users.id],
  }),
}));

export const authNinjaSchema = {
  users,
  sessions,
  credentials,
  auditEvents,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;
