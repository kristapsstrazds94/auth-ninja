import {
  buildTotpOtpAuthUrl,
  createAuthError,
  createLoginAuditEvent,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCodes,
  verifyBackupCode,
  verifyPassword,
  verifyTotpCode,
} from "@auth-ninja/core";
import { and, eq, isNull } from "drizzle-orm";
import { persistAuditEvent } from "../audit/persist.js";
import type { AuthNinjaContext } from "../context.js";
import { credentials, users } from "../db/schema.js";
import { verifyLoginChallengeToken } from "./login-token.js";
import { toSessionResponse } from "./user-response.js";
import type {
  Disable2faRequest,
  PasswordConfirmRequest,
  TotpCodeRequest,
  TotpVerifyRequest,
} from "./validation.js";
import type { CreatedSession } from "../session/service.js";
import { resolveSessionByToken, rotateSession } from "../session/service.js";
import { decryptTotpSecret, encryptTotpSecret } from "./totp-secret.js";

export type EnrollTwoFaSuccess = {
  status: 200;
  body: { secret: string; otpauthUrl: string };
};

export type EnrollTwoFaConflict = {
  status: 409;
  body: { code: "FORBIDDEN"; message: string };
};

export type EnrollTwoFaResult = EnrollTwoFaSuccess | EnrollTwoFaConflict;

export type ConfirmTwoFaSuccess = {
  status: 200;
  body: { mfaEnabled: true; backupCodes: string[] };
};

export type ConfirmTwoFaFailure = {
  status: 400;
  body: { code: "MFA_INVALID"; message: string };
};

export type ConfirmTwoFaResult = ConfirmTwoFaSuccess | ConfirmTwoFaFailure;

export type VerifyTwoFaLoginSuccess = {
  status: 200;
  body: ReturnType<typeof toSessionResponse>;
  session: CreatedSession;
};

export type VerifyTwoFaLoginFailure = {
  status: 400 | 401 | 423;
  body: {
    code: "MFA_INVALID" | "INVALID_CREDENTIALS" | "ACCOUNT_LOCKED";
    message: string;
  };
};

export type VerifyTwoFaLoginResult = VerifyTwoFaLoginSuccess | VerifyTwoFaLoginFailure;

export type RegenerateBackupCodesSuccess = {
  status: 200;
  body: { backupCodes: string[] };
};

export type RegenerateBackupCodesFailure = {
  status: 401;
  body: { code: "INVALID_CREDENTIALS"; message: string };
};

export type RegenerateBackupCodesResult =
  | RegenerateBackupCodesSuccess
  | RegenerateBackupCodesFailure;

export type DisableTwoFaSuccess = { status: 204 };

export type DisableTwoFaFailure = {
  status: 400 | 401;
  body: {
    code: "MFA_INVALID" | "INVALID_CREDENTIALS";
    message: string;
  };
};

export type DisableTwoFaResult = DisableTwoFaSuccess | DisableTwoFaFailure;

function mfaLockoutKey(userId: string): string {
  return `mfa:${userId}`;
}

async function deleteBackupCodes(ctx: AuthNinjaContext, userId: string): Promise<void> {
  await ctx.db
    .delete(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.type, "totp_backup")));
}

async function storeBackupCodes(
  ctx: AuthNinjaContext,
  userId: string,
  codeHashes: string[],
): Promise<void> {
  if (codeHashes.length === 0) {
    return;
  }

  await ctx.db.insert(credentials).values(
    codeHashes.map((codeHash) => ({
      userId,
      type: "totp_backup" as const,
      codeHash,
    })),
  );
}

async function verifyAndConsumeBackupCode(
  ctx: AuthNinjaContext,
  userId: string,
  code: string,
  now: Date,
): Promise<boolean> {
  const rows = await ctx.db
    .select()
    .from(credentials)
    .where(
      and(
        eq(credentials.userId, userId),
        eq(credentials.type, "totp_backup"),
        isNull(credentials.consumedAt),
      ),
    );

  for (const row of rows) {
    if (!row.codeHash) {
      continue;
    }

    if (await verifyBackupCode(code, row.codeHash)) {
      await ctx.db
        .update(credentials)
        .set({ consumedAt: now, lastUsedAt: now })
        .where(eq(credentials.id, row.id));
      return true;
    }
  }

  return false;
}

/** Begin TOTP enrollment for an authenticated user. */
export async function enrollTwoFa(
  ctx: AuthNinjaContext,
  sessionToken: string | undefined,
  now: Date = new Date(),
): Promise<EnrollTwoFaResult> {
  const { user } = await resolveSessionByToken(ctx.db, ctx.config, sessionToken, now);

  if (user.mfaEnabled) {
    return {
      status: 409,
      body: {
        code: "FORBIDDEN",
        message: "Two-factor authentication is already enabled.",
      },
    };
  }

  const { secret } = generateTotpSecret();
  const otpauthUrl = buildTotpOtpAuthUrl({
    secret,
    issuer: ctx.config.twoFaIssuer,
    accountName: user.email,
  });

  await ctx.db
    .update(users)
    .set({ totpSecret: encryptTotpSecret(secret, ctx.config.secret), updatedAt: now })
    .where(eq(users.id, user.id));

  return {
    status: 200,
    body: { secret, otpauthUrl },
  };
}

/** Confirm TOTP enrollment and issue backup codes. */
export async function confirmTwoFa(
  ctx: AuthNinjaContext,
  sessionToken: string | undefined,
  input: TotpCodeRequest,
  now: Date = new Date(),
): Promise<ConfirmTwoFaResult> {
  const { user } = await resolveSessionByToken(ctx.db, ctx.config, sessionToken, now);

  const totpSecret = decryptTotpSecret(user.totpSecret, ctx.config.secret);

  if (user.mfaEnabled || !totpSecret) {
    return {
      status: 400,
      body: {
        code: "MFA_INVALID",
        message: createAuthError("MFA_INVALID").message,
      },
    };
  }

  if (!verifyTotpCode({ secret: totpSecret, code: input.code })) {
    return {
      status: 400,
      body: {
        code: "MFA_INVALID",
        message: createAuthError("MFA_INVALID").message,
      },
    };
  }

  const backupCodes = generateBackupCodes();
  const codeHashes = await hashBackupCodes(backupCodes);

  await deleteBackupCodes(ctx, user.id);
  await storeBackupCodes(ctx, user.id, codeHashes);

  await ctx.db
    .update(users)
    .set({ mfaEnabled: true, updatedAt: now })
    .where(eq(users.id, user.id));

  return {
    status: 200,
    body: { mfaEnabled: true, backupCodes },
  };
}

export type VerifyTwoFaLoginInput = TotpVerifyRequest & {
  ipAddress: string;
  userAgent?: string;
  existingSessionToken?: string;
};

/** Complete login after password step when MFA is required. */
export async function verifyTwoFaLogin(
  ctx: AuthNinjaContext,
  input: VerifyTwoFaLoginInput,
  now: Date = new Date(),
): Promise<VerifyTwoFaLoginResult> {
  const userId = verifyLoginChallengeToken(input.loginToken, ctx.config.secret, now);

  if (!userId) {
    return {
      status: 401,
      body: {
        code: "INVALID_CREDENTIALS",
        message: "Unable to verify two-factor authentication.",
      },
    };
  }

  const [user] = await ctx.db.select().from(users).where(eq(users.id, userId)).limit(1);

  const totpSecret = decryptTotpSecret(user?.totpSecret, ctx.config.secret);

  if (!user?.mfaEnabled || !totpSecret) {
    return {
      status: 401,
      body: {
        code: "INVALID_CREDENTIALS",
        message: "Unable to verify two-factor authentication.",
      },
    };
  }

  const key = mfaLockoutKey(userId);

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

  const codeValid = verifyTotpCode({ secret: totpSecret, code: input.code });

  if (!codeValid) {
    const failure = await ctx.lockout.recordFailure(key, now);

    const audit = createLoginAuditEvent({
      outcome: "failure",
      userId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    await persistAuditEvent(ctx.db, audit);

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
      status: 400,
      body: {
        code: "MFA_INVALID",
        message: createAuthError("MFA_INVALID").message,
      },
    };
  }

  await ctx.lockout.recordSuccess(key);

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
    body: toSessionResponse(user, ctx.config),
    session,
  };
}

/** Regenerate backup codes after password re-verification. */
export async function regenerateBackupCodes(
  ctx: AuthNinjaContext,
  sessionToken: string | undefined,
  input: PasswordConfirmRequest,
  now: Date = new Date(),
): Promise<RegenerateBackupCodesResult> {
  const { user } = await resolveSessionByToken(ctx.db, ctx.config, sessionToken, now);

  if (!user.mfaEnabled) {
    throw createAuthError("FORBIDDEN");
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);

  if (!passwordValid) {
    return {
      status: 401,
      body: {
        code: "INVALID_CREDENTIALS",
        message: createAuthError("INVALID_CREDENTIALS").message,
      },
    };
  }

  const backupCodes = generateBackupCodes();
  const codeHashes = await hashBackupCodes(backupCodes);

  await deleteBackupCodes(ctx, user.id);
  await storeBackupCodes(ctx, user.id, codeHashes);

  await ctx.db.update(users).set({ updatedAt: now }).where(eq(users.id, user.id));

  return {
    status: 200,
    body: { backupCodes },
  };
}

/** Disable TOTP after password and TOTP or backup code verification. */
export async function disableTwoFa(
  ctx: AuthNinjaContext,
  sessionToken: string | undefined,
  input: Disable2faRequest,
  now: Date = new Date(),
): Promise<DisableTwoFaResult> {
  const { user } = await resolveSessionByToken(ctx.db, ctx.config, sessionToken, now);

  if (!user.mfaEnabled) {
    throw createAuthError("FORBIDDEN");
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);

  if (!passwordValid) {
    return {
      status: 401,
      body: {
        code: "INVALID_CREDENTIALS",
        message: createAuthError("INVALID_CREDENTIALS").message,
      },
    };
  }

  let secondFactorValid = false;

  const totpSecret = decryptTotpSecret(user.totpSecret, ctx.config.secret);

  if (input.code && totpSecret) {
    secondFactorValid = verifyTotpCode({ secret: totpSecret, code: input.code });
  } else if (input.backupCode) {
    secondFactorValid = await verifyAndConsumeBackupCode(ctx, user.id, input.backupCode, now);
  }

  if (!secondFactorValid) {
    return {
      status: 400,
      body: {
        code: "MFA_INVALID",
        message: createAuthError("MFA_INVALID").message,
      },
    };
  }

  await deleteBackupCodes(ctx, user.id);

  await ctx.db
    .update(users)
    .set({ mfaEnabled: false, totpSecret: null, updatedAt: now })
    .where(eq(users.id, user.id));

  return { status: 204 };
}
