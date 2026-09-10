import { loginUser } from "../auth/login.js";
import { loginRequestSchema } from "../auth/validation.js";
import type { AuthNinjaContext } from "../context.js";
import { getRequestMeta } from "../http/request-meta.js";
import {
  authJsonResponse,
  mapUnknownError,
  validationErrorResponse,
  withSessionCookie,
} from "../http/response.js";
import { parseSessionCookie } from "../session/cookie.js";

export type LoginRouteHandler = (request: Request) => Promise<Response>;

/** App Router handler for POST /auth/login. */
export function createLoginHandler(ctx: AuthNinjaContext): LoginRouteHandler {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse();
    }

    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    const meta = getRequestMeta(request);
    const existingSessionToken = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await loginUser(ctx, {
        ...parsed.data,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        existingSessionToken,
      });

      const response = authJsonResponse(result.body, result.status);

      if (result.status === 200 && "session" in result) {
        return withSessionCookie(ctx, response, result.session.token);
      }

      return response;
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}
