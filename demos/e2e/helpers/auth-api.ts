import type { APIRequestContext } from "@playwright/test";
import { AUTH_SESSION_COOKIE, CSRF_HEADER, TEST_PASSWORD } from "./constants.js";

type AuthErrorBody = { code: string; message: string };

export type RegisterResult = {
  sessionToken: string;
  email: string;
};

function extractSessionCookie(setCookieHeader: string | undefined): string | undefined {
  if (!setCookieHeader) {
    return undefined;
  }
  const match = setCookieHeader.match(new RegExp(`${AUTH_SESSION_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return value && value.length > 0 ? value : undefined;
}

export async function fetchCsrfToken(request: APIRequestContext): Promise<string> {
  const response = await request.get("/auth/csrf");
  if (!response.ok()) {
    throw new Error(`CSRF fetch failed: ${response.status()}`);
  }
  const body = (await response.json()) as { token: string };
  return body.token;
}

export async function registerUser(
  request: APIRequestContext,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<RegisterResult> {
  const csrf = await fetchCsrfToken(request);
  const response = await request.post("/auth/register", {
    headers: {
      "content-type": "application/json",
      [CSRF_HEADER]: csrf,
    },
    data: { email, password },
  });

  if (!response.ok()) {
    const body = (await response.json()) as AuthErrorBody;
    throw new Error(`Register failed (${response.status()}): ${body.code} ${body.message}`);
  }

  const sessionToken = extractSessionCookie(response.headers()["set-cookie"]);
  if (!sessionToken) {
    throw new Error("Register succeeded but no session cookie was set");
  }

  return { sessionToken, email };
}

export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string,
  options: { csrf?: string } = {},
): Promise<{ response: Awaited<ReturnType<APIRequestContext["post"]>>; body: AuthErrorBody | Record<string, unknown> }> {
  const csrf = options.csrf ?? (await fetchCsrfToken(request));
  const response = await request.post("/auth/login", {
    headers: {
      "content-type": "application/json",
      [CSRF_HEADER]: csrf,
    },
    data: { email, password },
  });
  const body = (await response.json()) as AuthErrorBody | Record<string, unknown>;
  return { response, body };
}

export async function postWithoutCsrf(
  request: APIRequestContext,
  path: string,
  data: unknown,
): Promise<{ status: number; body: AuthErrorBody }> {
  const response = await request.post(path, {
    headers: { "content-type": "application/json" },
    data,
  });
  const text = await response.text();
  let body: AuthErrorBody = { code: "UNKNOWN", message: text || "Empty response" };
  if (text) {
    try {
      body = JSON.parse(text) as AuthErrorBody;
    } catch {
      body = { code: "UNKNOWN", message: text };
    }
  }

  return {
    status: response.status(),
    body,
  };
}

export async function getSession(
  request: APIRequestContext,
  sessionToken: string,
): Promise<{ status: number; body: AuthErrorBody | Record<string, unknown> }> {
  const response = await request.get("/auth/session", {
    headers: { cookie: `${AUTH_SESSION_COOKIE}=${sessionToken}` },
  });
  return {
    status: response.status(),
    body: (await response.json()) as AuthErrorBody | Record<string, unknown>,
  };
}

export function sessionCookieHeader(sessionToken: string): Record<string, string> {
  return { cookie: `${AUTH_SESSION_COOKIE}=${sessionToken}` };
}
