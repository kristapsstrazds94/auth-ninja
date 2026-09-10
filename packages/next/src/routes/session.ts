import { getSessionUser } from "../auth/get-session.js";
import type { AuthNinjaContext } from "../context.js";
import { authJsonResponse, mapUnknownError } from "../http/response.js";
import { parseSessionCookie } from "../session/cookie.js";

export type SessionRouteHandler = (request: Request) => Promise<Response>;

/** App Router handler for GET /auth/session. */
export function createSessionHandler(ctx: AuthNinjaContext): SessionRouteHandler {
  return async function GET(request: Request): Promise<Response> {
    const token = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await getSessionUser(ctx, token);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}
