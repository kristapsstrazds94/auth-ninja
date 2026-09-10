import type { AuthNinjaContext } from "../context.js";
import { resolveSessionByToken, touchSession } from "../session/service.js";
import { toSessionResponse } from "./user-response.js";

export type GetSessionSuccess = {
  status: 200;
  body: ReturnType<typeof toSessionResponse>;
};

/** Read the current session; refresh idle timer on success. */
export async function getSessionUser(
  ctx: AuthNinjaContext,
  token: string | undefined,
  now: Date = new Date(),
): Promise<GetSessionSuccess> {
  const resolved = await resolveSessionByToken(ctx.db, ctx.config, token, now);
  await touchSession(ctx.db, resolved.session.id, now);

  return {
    status: 200,
    body: toSessionResponse(resolved.user, ctx.config),
  };
}
