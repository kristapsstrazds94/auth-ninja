import {
  confirmTwoFa,
  disableTwoFa,
  enrollTwoFa,
  regenerateBackupCodes,
  verifyTwoFaLogin,
} from "../auth/two-fa.js";
import {
  disable2faRequestSchema,
  passwordConfirmRequestSchema,
  totpCodeRequestSchema,
  totpVerifyRequestSchema,
} from "../auth/validation.js";
import type { AuthNinjaContext } from "../context.js";
import { getRequestMeta } from "../http/request-meta.js";
import {
  authJsonResponse,
  emptyResponse,
  mapUnknownError,
  validationErrorResponse,
  withSessionCookie,
} from "../http/response.js";
import { parseSessionCookie } from "../session/cookie.js";

export type TwoFaEnrollHandler = (request: Request) => Promise<Response>;
export type TwoFaConfirmHandler = (request: Request) => Promise<Response>;
export type TwoFaVerifyHandler = (request: Request) => Promise<Response>;
export type TwoFaBackupCodesHandler = (request: Request) => Promise<Response>;
export type TwoFaDisableHandler = (request: Request) => Promise<Response>;

async function parseJsonBody(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** App Router handler for POST /auth/2fa/enroll. */
export function createTwoFaEnrollHandler(ctx: AuthNinjaContext): TwoFaEnrollHandler {
  return async function POST(request: Request): Promise<Response> {
    const token = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await enrollTwoFa(ctx, token);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}

/** App Router handler for POST /auth/2fa/confirm. */
export function createTwoFaConfirmHandler(ctx: AuthNinjaContext): TwoFaConfirmHandler {
  return async function POST(request: Request): Promise<Response> {
    const body = await parseJsonBody(request);
    if (body === undefined) {
      return validationErrorResponse();
    }

    const parsed = totpCodeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    const token = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await confirmTwoFa(ctx, token, parsed.data);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}

/** App Router handler for POST /auth/2fa/verify. */
export function createTwoFaVerifyHandler(ctx: AuthNinjaContext): TwoFaVerifyHandler {
  return async function POST(request: Request): Promise<Response> {
    const body = await parseJsonBody(request);
    if (body === undefined) {
      return validationErrorResponse();
    }

    const parsed = totpVerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    const meta = getRequestMeta(request);
    const existingSessionToken = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await verifyTwoFaLogin(ctx, {
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

/** App Router handler for POST /auth/2fa/backup-codes. */
export function createTwoFaBackupCodesHandler(
  ctx: AuthNinjaContext,
): TwoFaBackupCodesHandler {
  return async function POST(request: Request): Promise<Response> {
    const body = await parseJsonBody(request);
    if (body === undefined) {
      return validationErrorResponse();
    }

    const parsed = passwordConfirmRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    const token = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await regenerateBackupCodes(ctx, token, parsed.data);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}

/** App Router handler for DELETE /auth/2fa. */
export function createTwoFaDisableHandler(ctx: AuthNinjaContext): TwoFaDisableHandler {
  return async function DELETE(request: Request): Promise<Response> {
    const body = await parseJsonBody(request);
    if (body === undefined) {
      return validationErrorResponse();
    }

    const parsed = disable2faRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    const token = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await disableTwoFa(ctx, token, parsed.data);
      return emptyResponse(result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}
