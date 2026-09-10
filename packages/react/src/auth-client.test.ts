import { AuthNinjaError } from "@auth-ninja/core";
import { describe, expect, it, vi } from "vitest";
import {
  AUTH_CSRF_HEADER,
  AUTH_CSRF_PATH,
  createAuthClient,
  isStateChangingMethod,
  parseAuthErrorResponse,
} from "./auth-client.js";

describe("isStateChangingMethod", () => {
  it("treats POST, PUT, PATCH, DELETE as state-changing", () => {
    expect(isStateChangingMethod("POST")).toBe(true);
    expect(isStateChangingMethod("DELETE")).toBe(true);
    expect(isStateChangingMethod("GET")).toBe(false);
    expect(isStateChangingMethod("HEAD")).toBe(false);
  });
});

describe("parseAuthErrorResponse", () => {
  it("parses a valid auth error body", () => {
    const error = parseAuthErrorResponse(401, {
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password.",
    });

    expect(error).toBeInstanceOf(AuthNinjaError);
    expect(error.code).toBe("INVALID_CREDENTIALS");
    expect(error.status).toBe(401);
  });

  it("falls back to status-based code for malformed bodies", () => {
    const error = parseAuthErrorResponse(429, { error: "nope" });
    expect(error.code).toBe("RATE_LIMITED");
  });
});

function asFetchMock(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return impl as typeof fetch;
}

function getFetchCall(
  fetchFn: ReturnType<typeof vi.fn>,
  index: number,
): [string, RequestInit | undefined] {
  const call = fetchFn.mock.calls[index];
  expect(call).toBeDefined();
  return [String(call![0]), call![1] as RequestInit | undefined];
}

describe("createAuthClient", () => {
  it("sends credentials include on GET without CSRF header", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ authenticated: false }),
    );

    const client = createAuthClient({ baseUrl: "https://auth.example", fetchFn });
    await client.requestJson("/auth/session");

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = getFetchCall(fetchFn, 0);
    expect(init?.credentials).toBe("include");
    expect(new Headers(init?.headers).has(AUTH_CSRF_HEADER)).toBe(false);
  });

  it("fetches CSRF token and attaches header on POST", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input, init) => {
        const url = String(input);
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return Response.json({ token: "csrf-token-32-chars-minimum!!" });
        }
        if (url.endsWith("/auth/login")) {
          expect(new Headers(init?.headers).get(AUTH_CSRF_HEADER)).toBe(
            "csrf-token-32-chars-minimum!!",
          );
          expect(init?.credentials).toBe("include");
          return Response.json({ ok: true });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const client = createAuthClient({ baseUrl: "https://auth.example", fetchFn });
    await client.requestJson("/auth/login", {
      method: "POST",
      json: { email: "a@test.local", password: "secret" },
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`https://auth.example${AUTH_CSRF_PATH}`);
    expect(fetchFn.mock.calls[1]?.[0]).toBe("https://auth.example/auth/login");
  });

  it("throws AuthNinjaError for error responses", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(
        { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
        { status: 401 },
      ),
    );

    const client = createAuthClient({ baseUrl: "https://auth.example", fetchFn });

    await expect(
      client.requestJson("/auth/session"),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      status: 401,
    });
  });

  it("retries once after CSRF_INVALID with a fresh token", async () => {
    let loginAttempts = 0;

    const fetchFn = vi.fn(
      asFetchMock(async (input, init) => {
        const url = String(input);
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return Response.json({ token: `csrf-token-${loginAttempts}` });
        }
        if (url.endsWith("/auth/logout")) {
          loginAttempts += 1;
          const token = new Headers(init?.headers).get(AUTH_CSRF_HEADER);
          if (loginAttempts === 1) {
            expect(token).toBe("csrf-token-0");
            return Response.json(
              { code: "CSRF_INVALID", message: "Invalid CSRF token." },
              { status: 403 },
            );
          }
          expect(token).toBe("csrf-token-1");
          return Response.json({ ok: true });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const client = createAuthClient({ baseUrl: "https://auth.example", fetchFn });
    await client.requestJson("/auth/logout", { method: "POST" });

    expect(loginAttempts).toBe(2);
    expect(
      fetchFn.mock.calls.filter(([url]) => String(url).endsWith(AUTH_CSRF_PATH)),
    ).toHaveLength(2);
  });

  it("skips CSRF when csrfEnabled is false", async () => {
    const fetchFn = vi.fn(async () => Response.json({ ok: true }));

    const client = createAuthClient({
      baseUrl: "https://auth.example",
      fetchFn,
      csrfEnabled: false,
    });

    await client.requestJson("/auth/logout", { method: "POST" });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = getFetchCall(fetchFn, 0);
    expect(new Headers(init?.headers).has(AUTH_CSRF_HEADER)).toBe(false);
  });
});
