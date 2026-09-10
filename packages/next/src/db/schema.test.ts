import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createLoginAuditEvent } from "@auth-ninja/core";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  auditEvents,
  authNinjaSchema,
  credentials,
  sessions,
  users,
} from "./schema.js";

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

async function createMigratedDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema: authNinjaSchema });
  await migrate(db, { migrationsFolder });
  return db;
}

describe("authNinjaSchema migrations", () => {
  it("creates users, sessions, credentials, and audit_events tables", async () => {
    const db = await createMigratedDb();

    const tables = await db.execute<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );

    const names = tables.rows.map((row) => row.tablename);
    expect(names).toContain("users");
    expect(names).toContain("sessions");
    expect(names).toContain("credentials");
    expect(names).toContain("audit_events");
  });

  it("persists a user with session, passkey credential, and audit row", async () => {
    const db = await createMigratedDb();
    const userId = randomUUID();
    const sessionId = randomUUID();
    const credentialRowId = randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await db.insert(users).values({
      id: userId,
      email: "user@test.local",
      emailNormalized: "user@test.local",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
    });

    await db.insert(sessions).values({
      id: sessionId,
      tokenHash: "a".repeat(64),
      userId,
      expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    await db.insert(credentials).values({
      id: credentialRowId,
      userId,
      type: "passkey",
      credentialId: "cred-abc123",
      publicKey: "cGJr",
      counter: 0,
      nickname: "Laptop",
    });

    const audit = createLoginAuditEvent({
      outcome: "success",
      userId,
      ipAddress: "127.0.0.1",
    });

    await db.insert(auditEvents).values({
      id: audit.id,
      type: audit.type,
      occurredAt: new Date(audit.occurredAt),
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
      userId: audit.userId,
      payload: { outcome: audit.outcome },
    });

    const [storedUser] = await db.select().from(users).where(eq(users.id, userId));
    expect(storedUser?.email).toBe("user@test.local");
    expect(storedUser?.mfaEnabled).toBe(false);

    const userSessions = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(userSessions).toHaveLength(1);

    const userCredentials = await db
      .select()
      .from(credentials)
      .where(eq(credentials.userId, userId));
    expect(userCredentials[0]?.type).toBe("passkey");

    const storedAudit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.id, audit.id));
    expect(storedAudit[0]?.payload).toEqual({ outcome: "success" });
  });

  it("rejects duplicate normalized email", async () => {
    const db = await createMigratedDb();

    await db.insert(users).values({
      email: "dup@test.local",
      emailNormalized: "dup@test.local",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
    });

    await expect(
      db.insert(users).values({
        email: "DUP@test.local",
        emailNormalized: "dup@test.local",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
      }),
    ).rejects.toThrow();
  });

  it("cascades delete from users to sessions and credentials", async () => {
    const db = await createMigratedDb();
    const userId = randomUUID();

    await db.insert(users).values({
      id: userId,
      email: "delete@test.local",
      emailNormalized: "delete@test.local",
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
    });

    await db.insert(sessions).values({
      tokenHash: "b".repeat(64),
      userId,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await db.insert(credentials).values({
      userId,
      type: "totp_backup",
      codeHash: "$argon2id$v=19$m=65536,t=3,p=4$fake$fake",
    });

    await db.delete(users).where(eq(users.id, userId));

    const remainingSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId));
    const remainingCredentials = await db
      .select()
      .from(credentials)
      .where(eq(credentials.userId, userId));

    expect(remainingSessions).toHaveLength(0);
    expect(remainingCredentials).toHaveLength(0);
  });
});
