import {
  createAuthError,
  createLockoutAuditEvent,
  createLoginAuditEvent,
  verifyPasswordWithTimingProtection,
} from "@auth-ninja/core";
import { eq } from "drizzle-orm";
import { persistAuditEvent } from "../audit/persist.js";
import type { AuthNinjaContext } from "../context.js";
import { users } from "../db/schema.js";
import { createLoginChallengeToken } from "./login-token.js";
import { normalizeEmail } from "./email.js";
import { toSessionResponse } from "./user-response.js";
import type { LoginRequest } from "./validation.js";
import type { CreatedSession } from "../session/service.js";
import { rotateSession } from "../session/service.js";

export type LoginInput = LoginRequest & {
  ipAddress: string;
  userAgent?: string;
  existingSessionToken?: string;
};

export type LoginMfaRequired = {
  status: 200;
  mfaRequired: true;
  body: {
    mfaRequired: true;
    loginToken: string;
  };
};

export type LoginSuccess = {
  status: 200;
  mfaRequired: false;
  body: ReturnType<typeof toSessionResponse>;
  session: CreatedSession;
};

export type LoginFailure = {
  status: 401 | 423;
  body: { code: "INVALID_CREDENTIALS" | "ACCOUNT_LOCKED"; message: string };
};

export type LoginResult = LoginMfaRequired | LoginSuccess | LoginFailure;

function lockoutKey(emailNormalized: string): string {
  return `login:${emailNormalized}`;
}

/** Authenticate with email and password; rotate session on success. */
export async function loginUser(
  ctx: AuthNinjaContext,
  input: LoginInput,
  now: Date = new Date(),
): Promise<LoginResult> {
  const emailNormalized = normalizeEmail(input.email);
  const key = lockoutKey(emailNormalized);

  try {
    await ctx.lockout.assertNotLocked(key, now);
  } catch {
    return {
      status: 423,
      body: {
        code: "ACCOUNT_LOCKED",
        message: createAuthError("ACCOUNT_LOCKED").message,
      },
    };
  }

  const [user] = await ctx.db
    .select()
    .from(users)
    .where(eq(users.emailNormalized, emailNormalized))
    .limit(1);

  const passwordValid = await verifyPasswordWithTimingProtection(
    input.password,
    user?.passwordHash,
  );

  if (!passwordValid || user === undefined) {
    const failure = await ctx.lockout.recordFailure(key, now);

    const audit = createLoginAuditEvent({
      outcome: "failure",
      userId: user?.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    await persistAuditEvent(ctx.db, audit);

    if (failure.justLocked && user) {
      const lockoutAudit = createLockoutAuditEvent({
        userId: user.id,
        attemptCount: failure.attemptCount,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        ...(failure.unlockAt !== undefined
          ? { unlockAt: failure.unlockAt.toISOString() }
          : {}),
      });
      await persistAuditEvent(ctx.db, lockoutAudit);
    }

    if (failure.locked) {
      return {
        status: 423,
        body: {
          code: "ACCOUNT_LOCKED",
          message: createAuthError("ACCOUNT_LOCKED").message,
        },
      };
    }

    return {
      status: 401,
      body: {
        code: "INVALID_CREDENTIALS",
        message: createAuthError("INVALID_CREDENTIALS").message,
      },
    };
  }

  await ctx.lockout.recordSuccess(key);

  if (user.mfaEnabled) {
    const loginToken = createLoginChallengeToken(user.id, ctx.config.secret, now);
    return {
      status: 200,
      mfaRequired: true,
      body: {
        mfaRequired: true,
        loginToken,
      },
    };
  }

  const session = await rotateSession(
    ctx.db,
    ctx.config,
    user.id,
    input.existingSessionToken,
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
    status: 200,
    mfaRequired: false,
    body: toSessionResponse(user, ctx.config),
    session,
  };
}
