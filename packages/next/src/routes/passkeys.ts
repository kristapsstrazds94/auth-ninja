import {
  deletePasskey,
  listPasskeys,
  passkeyLoginBegin,
  passkeyLoginFinish,
  passkeyRegisterBegin,
  passkeyRegisterFinish,
} from "../auth/passkeys.js";
import {
  passkeyLoginBeginRequestSchema,
  webAuthnFinishRequestSchema,
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

export type PasskeyRegisterBeginHandler = (request: Request) => Promise<Response>;
export type PasskeyRegisterFinishHandler = (request: Request) => Promise<Response>;
export type PasskeyLoginBeginHandler = (request: Request) => Promise<Response>;
export type PasskeyLoginFinishHandler = (request: Request) => Promise<Response>;
export type PasskeyListHandler = (request: Request) => Promise<Response>;
export type PasskeyDeleteHandler = (
  request: Request,
  context: { params: { credentialId: string } },
) => Promise<Response>;

async function parseJsonBody(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** App Router handler for POST /auth/passkeys/register/begin. */
export function createPasskeyRegisterBeginHandler(
  ctx: AuthNinjaContext,
): PasskeyRegisterBeginHandler {
  return async function POST(request: Request): Promise<Response> {
    const token = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await passkeyRegisterBegin(ctx, token);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}

/** App Router handler for POST /auth/passkeys/register/finish. */
export function createPasskeyRegisterFinishHandler(
  ctx: AuthNinjaContext,
): PasskeyRegisterFinishHandler {
  return async function POST(request: Request): Promise<Response> {
    const body = await parseJsonBody(request);
    if (body === undefined) {
      return validationErrorResponse();
    }

    const parsed = webAuthnFinishRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    const token = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await passkeyRegisterFinish(ctx, token, parsed.data);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}

/** App Router handler for POST /auth/passkeys/login/begin. */
export function createPasskeyLoginBeginHandler(
  ctx: AuthNinjaContext,
): PasskeyLoginBeginHandler {
  return async function POST(request: Request): Promise<Response> {
    const body = await parseJsonBody(request);

    const parsed = passkeyLoginBeginRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return validationErrorResponse();
    }

    try {
      const result = await passkeyLoginBegin(ctx, parsed.data);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}

/** App Router handler for POST /auth/passkeys/login/finish. */
export function createPasskeyLoginFinishHandler(
  ctx: AuthNinjaContext,
): PasskeyLoginFinishHandler {
  return async function POST(request: Request): Promise<Response> {
    const body = await parseJsonBody(request);
    if (body === undefined) {
      return validationErrorResponse();
    }

    const parsed = webAuthnFinishRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse();
    }

    const meta = getRequestMeta(request);
    const existingSessionToken = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await passkeyLoginFinish(ctx, {
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

/** App Router handler for GET /auth/passkeys. */
export function createPasskeyListHandler(ctx: AuthNinjaContext): PasskeyListHandler {
  return async function GET(request: Request): Promise<Response> {
    const token = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await listPasskeys(ctx, token);
      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}

/** App Router handler for DELETE /auth/passkeys/{credentialId}. */
export function createPasskeyDeleteHandler(ctx: AuthNinjaContext): PasskeyDeleteHandler {
  return async function DELETE(
    request: Request,
    context: { params: { credentialId: string } },
  ): Promise<Response> {
    const credentialId = context.params.credentialId?.trim();

    if (!credentialId) {
      return validationErrorResponse();
    }

    const token = parseSessionCookie(request.headers.get("cookie"));

    try {
      const result = await deletePasskey(ctx, token, credentialId);

      if (result.status === 204) {
        return emptyResponse(result.status);
      }

      return authJsonResponse(result.body, result.status);
    } catch (error) {
      return mapUnknownError(error);
    }
  };
}
