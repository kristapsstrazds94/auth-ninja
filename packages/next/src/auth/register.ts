import {
  AUTH_GENERIC_MESSAGES,
  createAuthError,
  createLoginAuditEvent,
  hashPassword,
} from "@auth-ninja/core";
import { eq } from "drizzle-orm";
import { persistAuditEvent } from "../audit/persist.js";
import type { AuthNinjaContext } from "../context.js";
import type { AuthDb } from "../db/client.js";
import { users } from "../db/schema.js";
import type { CreatedSession } from "../session/service.js";
import { createSession } from "../session/service.js";
import { normalizeEmail } from "./email.js";
import { toSessionResponse } from "./user-response.js";
import type { RegisterRequest } from "./validation.js";

export type RegisterInput = RegisterRequest & {
  ipAddress: string;
  userAgent?: string;
};

export type RegisterSuccess = {
  status: 201;
  body: ReturnType<typeof toSessionResponse>;
  session: CreatedSession;
};

export type RegisterFailure = {
  status: 400 | 409;
  body: { code: "VALIDATION_ERROR"; message: string };
};

export type RegisterResult = RegisterSuccess | RegisterFailure;

async function findUserByEmail(db: AuthDb, emailNormalized: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.emailNormalized, emailNormalized))
    .limit(1);
  return user;
}

/** Register a user and auto-login with a new session. */
export async function registerUser(
  ctx: AuthNinjaContext,
  input: RegisterInput,
  now: Date = new Date(),
): Promise<RegisterResult> {
  const emailNormalized = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  const existing = await findUserByEmail(ctx.db, emailNormalized);
  if (existing) {
    return {
      status: 409,
      body: {
        code: "VALIDATION_ERROR",
        message: AUTH_GENERIC_MESSAGES.REGISTRATION_FAILED,
      },
    };
  }

  let user;
  try {
    [user] = await ctx.db
      .insert(users)
      .values({
        email: input.email.trim(),
        emailNormalized,
        passwordHash,
      })
      .returning();
  } catch {
    return {
      status: 409,
      body: {
        code: "VALIDATION_ERROR",
        message: AUTH_GENERIC_MESSAGES.REGISTRATION_FAILED,
      },
    };
  }

  if (!user) {
    throw createAuthError("VALIDATION_ERROR");
  }

  const session = await createSession(
    ctx.db,
    ctx.config,
    user.id,
    { ipAddress: input.ipAddress, userAgent: input.userAgent },
    now,
  );

  const audit = createLoginAuditEvent({
    outcome: "success",
    userId: user.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  await persistAuditEvent(ctx.db, audit);

  return {
    status: 201,
    body: toSessionResponse(user, ctx.config),
    session,
  };
}
