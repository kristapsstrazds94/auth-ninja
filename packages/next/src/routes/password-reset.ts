import {
  confirmPasswordReset,
  requestPasswordReset,
} from "../auth/password-reset.js";
import {
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
} from "../auth/validation.js";
import type { AuthNinjaContext } from "../context.js";
import { getRequestMeta } from "../http/request-meta.js";
import {
  authJsonResponse,
  mapUnknownError,
  validationErrorResponse,
} from "../http/response.js";

export type PasswordResetRequestHandler = (request: Request) => Promise<Response>;
export type PasswordResetConfirmHandler = (request: Request) => Promise<Response>;

/** App Router handler for POST /auth/password-reset/request. */
export function createPasswordResetRequestHandler(
  ctx: AuthNinjaContext,
): PasswordResetRequestHandler {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse();
    }

    const parsed = passwordResetRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    try {
      const result = await requestPasswordReset(ctx, parsed.data);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}

/** App Router handler for POST /auth/password-reset/confirm. */
export function createPasswordResetConfirmHandler(
  ctx: AuthNinjaContext,
): PasswordResetConfirmHandler {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse();
    }

    const parsed = passwordResetConfirmRequestSchema(ctx.config.passwordMinScore).safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    try {
      const result = await confirmPasswordReset(ctx, parsed.data);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}
