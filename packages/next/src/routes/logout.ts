import { logoutUser } from "../auth/logout.js";
import type { AuthNinjaContext } from "../context.js";
import { getRequestMeta } from "../http/request-meta.js";
import { emptyResponse, mapUnknownError, withClearSessionCookie } from "../http/response.js";
import { parseSessionCookie } from "../session/cookie.js";

export type LogoutRouteHandler = (request: Request) => Promise<Response>;

/** App Router handler for POST /auth/logout. */
export function createLogoutHandler(ctx: AuthNinjaContext): LogoutRouteHandler {
  return async function POST(request: Request): Promise<Response> {
    const token = parseSessionCookie(request.headers.get("cookie"));
    const meta = getRequestMeta(request);

    try {
      const result = await logoutUser(ctx, {
        token,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      const response = emptyResponse(result.status);
      return withClearSessionCookie(ctx, response);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}
