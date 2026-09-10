import type { AuthNinjaContext } from "../context.js";
import { AUTH_CSRF_HEADER } from "../middleware/constants.js";
import { createAuthApiGuard } from "../middleware/next.js";
import {
  createPasskeyDeleteHandler,
  createPasskeyListHandler,
  createPasskeyLoginBeginHandler,
  createPasskeyLoginFinishHandler,
  createPasskeyRegisterBeginHandler,
  createPasskeyRegisterFinishHandler,
} from "../routes/passkeys.js";
import { createCsrfHandler } from "../routes/csrf.js";
import { createLoginHandler } from "../routes/login.js";
import { createLogoutHandler } from "../routes/logout.js";
import { createRegisterHandler } from "../routes/register.js";
import { createSessionHandler } from "../routes/session.js";
import {
  createTwoFaBackupCodesHandler,
  createTwoFaConfirmHandler,
  createTwoFaDisableHandler,
  createTwoFaEnrollHandler,
  createTwoFaVerifyHandler,
} from "../routes/two-fa.js";
import { AUTH_SESSION_COOKIE_NAME } from "../session/constants.js";

export type AuthApiRouterOptions = {
  /** Run middleware guard (rate limit, CSRF, IP audit) before handlers. */
  guard?: boolean;
  baseUrl?: string;
};

export type AuthApiDispatchInit = Omit<RequestInit, "method"> & {
  headers?: HeadersInit;
};

/** Minimal in-process router that mirrors Next.js auth route handlers. */
export function createAuthApiRouter(
  ctx: AuthNinjaContext,
  options: AuthApiRouterOptions = {},
) {
  const baseUrl = options.baseUrl ?? "http://localhost:3000";
  const guard = options.guard ? createAuthApiGuard(ctx) : null;

  const routes: Record<string, (request: Request) => Promise<Response> | Response> = {
    "POST /auth/register": createRegisterHandler(ctx),
    "POST /auth/login": createLoginHandler(ctx),
    "POST /auth/logout": createLogoutHandler(ctx),
    "GET /auth/session": createSessionHandler(ctx),
    "GET /auth/csrf": createCsrfHandler(ctx),
    "POST /auth/2fa/enroll": createTwoFaEnrollHandler(ctx),
    "POST /auth/2fa/confirm": createTwoFaConfirmHandler(ctx),
    "POST /auth/2fa/verify": createTwoFaVerifyHandler(ctx),
    "POST /auth/2fa/backup-codes": createTwoFaBackupCodesHandler(ctx),
    "DELETE /auth/2fa": createTwoFaDisableHandler(ctx),
    "POST /auth/passkeys/register/begin": createPasskeyRegisterBeginHandler(ctx),
    "POST /auth/passkeys/register/finish": createPasskeyRegisterFinishHandler(ctx),
    "POST /auth/passkeys/login/begin": createPasskeyLoginBeginHandler(ctx),
    "POST /auth/passkeys/login/finish": createPasskeyLoginFinishHandler(ctx),
    "GET /auth/passkeys": createPasskeyListHandler(ctx),
  };

  const deletePasskey = createPasskeyDeleteHandler(ctx);

  async function dispatch(
    method: string,
    pathname: string,
    init: AuthApiDispatchInit = {},
  ): Promise<Response> {
    const url = `${baseUrl}${pathname}`;
    const request = new Request(url, { ...init, method });

    if (guard) {
      const blocked = await guard(request);
      if (blocked) {
        return blocked;
      }
    }

    const key = `${method.toUpperCase()} ${pathname}`;
    const handler = routes[key];
    if (handler) {
      return handler(request);
    }

    const passkeyDeleteMatch = pathname.match(/^\/auth\/passkeys\/([^/]+)$/);
    if (method.toUpperCase() === "DELETE" && passkeyDeleteMatch) {
      return deletePasskey(request, { params: { credentialId: passkeyDeleteMatch[1]! } });
    }

    return new Response(JSON.stringify({ code: "NOT_FOUND" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return { dispatch };
}

/** Extract session token from a Set-Cookie response header. */
export function extractSessionCookie(response: Response): string | undefined {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    return undefined;
  }

  const match = setCookie.match(new RegExp(`${AUTH_SESSION_COOKIE_NAME}=([^;]+)`));
  const value = match?.[1];
  return value && value.length > 0 ? value : undefined;
}

export function sessionCookieHeader(sessionToken: string): Record<string, string> {
  return { cookie: `${AUTH_SESSION_COOKIE_NAME}=${sessionToken}` };
}

export function csrfHeader(token: string): Record<string, string> {
  return { [AUTH_CSRF_HEADER]: token };
}

export function jsonRequestInit(
  body: unknown,
  extraHeaders: Record<string, string> = {},
): AuthApiDispatchInit {
  return {
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}
