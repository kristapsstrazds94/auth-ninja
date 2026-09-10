import type { AuthNinjaContext } from "../context.js";
import { authJsonResponse } from "../http/response.js";
import { generateCsrfToken } from "../middleware/csrf.js";

export type CsrfRouteHandler = (request: Request) => Response;

/** App Router handler for GET /auth/csrf. */
export function createCsrfHandler(ctx: AuthNinjaContext): CsrfRouteHandler {
  return function GET(_request: Request): Response {
    const token = generateCsrfToken(ctx.config.secret);
    return authJsonResponse({ token }, 200);
  };
}
