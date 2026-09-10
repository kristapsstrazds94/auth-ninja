import {
  AuthNinjaError,
  createAuthError,
  isAuthNinjaError,
  toAuthErrorResponse,
  type AuthNinjaErrorCode,
} from "@auth-ninja/core";
import {
  buildSessionSetCookieHeader,
  sessionCookieOptionsFromConfig,
} from "../session/cookie.js";
import type { AuthNinjaContext } from "../context.js";

function jsonResponse(body: unknown, status: number, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function authErrorResponse(error: AuthNinjaError): Response {
  return jsonResponse(toAuthErrorResponse(error), error.status);
}

export function authJsonResponse(
  body: unknown,
  status: number,
  headers?: HeadersInit,
): Response {
  return jsonResponse(body, status, headers);
}

export function withSessionCookie(
  ctx: AuthNinjaContext,
  response: Response,
  sessionToken: string,
): Response {
  const cookieOptions = sessionCookieOptionsFromConfig(ctx.config);
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", buildSessionSetCookieHeader(sessionToken, cookieOptions));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function validationErrorResponse(): Response {
  return authErrorResponse(createAuthError("VALIDATION_ERROR"));
}

export function mapUnknownError(error: unknown): Response {
  if (isAuthNinjaError(error)) {
    return authErrorResponse(error);
  }
  return authErrorResponse(createAuthError("VALIDATION_ERROR"));
}

export function genericErrorResponse(
  code: AuthNinjaErrorCode,
  status?: number,
): Response {
  return authErrorResponse(createAuthError(code, status !== undefined ? { status } : {}));
}
