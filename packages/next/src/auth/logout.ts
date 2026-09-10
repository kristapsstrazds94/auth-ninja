import { createLogoutAuditEvent } from "@auth-ninja/core";
import { persistAuditEvent } from "../audit/persist.js";
import type { AuthNinjaContext } from "../context.js";
import { invalidateSessionByToken, resolveSessionByToken } from "../session/service.js";

export type LogoutInput = {
  token: string | undefined;
  ipAddress: string;
  userAgent?: string;
};

export type LogoutSuccess = {
  status: 204;
};

/** Invalidate the current session and record a logout audit event. */
export async function logoutUser(
  ctx: AuthNinjaContext,
  input: LogoutInput,
  now: Date = new Date(),
): Promise<LogoutSuccess> {
  const resolved = await resolveSessionByToken(ctx.db, ctx.config, input.token, now);
  await invalidateSessionByToken(ctx.db, input.token);

  const audit = createLogoutAuditEvent({
    userId: resolved.user.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  await persistAuditEvent(ctx.db, audit);

  return { status: 204 };
}
