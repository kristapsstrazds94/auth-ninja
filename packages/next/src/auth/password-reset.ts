import {
  AUTH_GENERIC_MESSAGES,
  createAuthError,
  generatePasswordResetToken,
  hashPassword,
  hashPasswordResetToken,
  isPasswordStrongEnough,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "@auth-ninja/core";
import { eq } from "drizzle-orm";
import type { AuthNinjaContext } from "../context.js";
import { passwordResetTokens, users } from "../db/schema.js";
import { normalizeEmail } from "./email.js";
import { invalidateAllUserSessions } from "../session/service.js";
import type { PasswordResetConfirmRequest, PasswordResetRequest } from "./validation.js";

export type PasswordResetRequestSuccess = {
  status: 200;
  body: { message: string };
  /** Raw token when an account exists — deliver via email in production apps. */
  resetToken?: string;
};

export type PasswordResetConfirmSuccess = {
  status: 200;
  body: { message: string };
};

export type PasswordResetConfirmFailure = {
  status: 400;
  body: { code: "VALIDATION_ERROR"; message: string };
};

export type PasswordResetRequestResult = PasswordResetRequestSuccess;
export type PasswordResetConfirmResult =
  | PasswordResetConfirmSuccess
  | PasswordResetConfirmFailure;

/** Request a password reset — always returns the same generic message. */
export async function requestPasswordReset(
  ctx: AuthNinjaContext,
  input: PasswordResetRequest,
  now: Date = new Date(),
): Promise<PasswordResetRequestResult> {
  const emailNormalized = normalizeEmail(input.email);
  const [user] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailNormalized, emailNormalized))
    .limit(1);

  if (user) {
    await ctx.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    const resetToken = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(resetToken);
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);

    await ctx.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return {
      status: 200,
      body: { message: AUTH_GENERIC_MESSAGES.PASSWORD_RESET_REQUESTED },
      resetToken,
    };
  }

  return {
    status: 200,
    body: { message: AUTH_GENERIC_MESSAGES.PASSWORD_RESET_REQUESTED },
  };
}

/** Complete password reset with a one-time token; invalidates all sessions. */
export async function confirmPasswordReset(
  ctx: AuthNinjaContext,
  input: PasswordResetConfirmRequest,
  now: Date = new Date(),
): Promise<PasswordResetConfirmResult> {
  if (!isPasswordStrongEnough(input.password, ctx.config.passwordMinScore)) {
    return {
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        message: createAuthError("VALIDATION_ERROR").message,
      },
    };
  }

  const tokenHash = hashPasswordResetToken(input.token);
  const [row] = await ctx.db
    .select({
      tokenId: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row || now >= row.expiresAt) {
    return {
      status: 400,
      body: {
        code: "VALIDATION_ERROR",
        message: AUTH_GENERIC_MESSAGES.PASSWORD_RESET_FAILED,
      },
    };
  }

  const passwordHash = await hashPassword(input.password);

  await ctx.db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, row.userId));

  await ctx.db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, row.tokenId));
  await invalidateAllUserSessions(ctx.db, row.userId);

  return {
    status: 200,
    body: { message: AUTH_GENERIC_MESSAGES.PASSWORD_RESET_SUCCESS },
  };
}
