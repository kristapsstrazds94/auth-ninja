import { registerUser } from "../auth/register.js";
import { registerRequestSchema } from "../auth/validation.js";
import type { AuthNinjaContext } from "../context.js";
import { getRequestMeta } from "../http/request-meta.js";
import {
  authJsonResponse,
  mapUnknownError,
  validationErrorResponse,
  withSessionCookie,
} from "../http/response.js";

export type RegisterRouteHandler = (request: Request) => Promise<Response>;

/** App Router handler for POST /auth/register. */
export function createRegisterHandler(ctx: AuthNinjaContext): RegisterRouteHandler {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse();
    }

    const parsed = registerRequestSchema(ctx.config.passwordMinScore).safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    const meta = getRequestMeta(request);

    try {
      const result = await registerUser(ctx, {
        ...parsed.data,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      const response = authJsonResponse(result.body, result.status);
      if (result.status === 201) {
        return withSessionCookie(ctx, response, result.session.token);
      }
      return response;
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}
