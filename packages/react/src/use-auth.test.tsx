/**
 * @vitest-environment jsdom
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_CSRF_HEADER, AUTH_CSRF_PATH } from "./auth-client.js";
import { AuthProvider } from "./provider.js";
import { isMfaRequiredResponse, isSessionResponse } from "./auth-session.js";
import { useAuth } from "./use-auth.js";

const BASE_URL = "https://auth.example";
const CSRF_TOKEN = "csrf-token-32-chars-minimum!!";

function asFetchMock(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return impl as typeof fetch;
}

function csrfResponse(): Response {
  return Response.json({ token: CSRF_TOKEN });
}

describe("useAuth", () => {
  let root: Root;
  let container: HTMLDivElement;
  let auth!: ReturnType<typeof useAuth>;

  function Probe() {
    auth = useAuth();
    return null;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function renderProvider(fetchFn: typeof fetch): Promise<void> {
    await act(async () => {
      root.render(
        createElement(
          AuthProvider,
          { baseUrl: BASE_URL, fetchFn },
          createElement(Probe),
        ),
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("loads session on mount when authenticated", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return Response.json({
            authenticated: true,
            user: { id: "user-1", email: "a@test.local" },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    expect(auth.isLoading).toBe(false);
    expect(auth.isApiLoading).toBe(false);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user).toEqual({ id: "user-1", email: "a@test.local" });
    expect(fetchFn).toHaveBeenCalledWith(
      `${BASE_URL}/auth/session`,
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
  });

  it("treats expired session as unauthenticated", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(
        { code: "SESSION_EXPIRED", message: "Session expired." },
        { status: 401 },
      ),
    );

    await renderProvider(fetchFn);

    expect(auth.isLoading).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.sessionError).toBeNull();
  });

  it("skips session fetch on mount when sessionCheckOnMount is false", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(
        { code: "SESSION_EXPIRED", message: "Session expired." },
        { status: 401 },
      ),
    );

    await act(async () => {
      root.render(
        createElement(
          AuthProvider,
          { baseUrl: BASE_URL, fetchFn, sessionCheckOnMount: false },
          createElement(Probe),
        ),
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(auth.isLoading).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("records sessionError when the session check fails", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ code: "RATE_LIMITED", message: "Too many requests." }, { status: 429 }),
    );

    await renderProvider(fetchFn);

    expect(auth.isLoading).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.sessionError).toBeInstanceOf(Error);
    expect(auth.sessionError?.message).toBe("Too many requests.");
  });

  it("throttles idle session refresh on repeated clicks", async () => {
    vi.useFakeTimers();

    try {
      let sessionCalls = 0;
      const fetchFn = vi.fn(
        asFetchMock(async (input) => {
          const url = String(input);
          if (url.endsWith("/auth/session")) {
            sessionCalls += 1;
            return Response.json({
              authenticated: true,
              user: { id: "user-1", email: `a@test.local?v=${sessionCalls}` },
            });
          }
          return new Response(null, { status: 404 });
        }),
      );

      await act(async () => {
        root.render(
          createElement(
            AuthProvider,
            {
              baseUrl: BASE_URL,
              fetchFn,
              sessionIdleRefresh: true,
              sessionIdleMinutes: 15,
            },
            createElement(Probe),
          ),
        );
      });

      await act(async () => {
        await Promise.resolve();
      });

      const callsAfterMount = sessionCalls;
      expect(callsAfterMount).toBe(1);

      await act(async () => {
        window.dispatchEvent(new MouseEvent("mousedown"));
        await Promise.resolve();
      });
      expect(sessionCalls).toBe(callsAfterMount + 1);

      await act(async () => {
        window.dispatchEvent(new MouseEvent("mousedown"));
        await Promise.resolve();
      });
      expect(sessionCalls).toBe(callsAfterMount + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not set isApiLoading for idle session refresh", async () => {
    let resolveSession: ((value: Response) => void) | undefined;
    const sessionPromise = new Promise<Response>((resolve) => {
      resolveSession = resolve;
    });

    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return sessionPromise;
        }
        return new Response(null, { status: 404 });
      }),
    );

    await act(async () => {
      root.render(
        createElement(
          AuthProvider,
          {
            baseUrl: BASE_URL,
            fetchFn,
            sessionIdleRefresh: true,
            sessionIdleMinutes: 15,
          },
          createElement(Probe),
        ),
      );
    });

    await act(async () => {
      resolveSession!(
        Response.json({
          authenticated: true,
          user: { id: "user-1", email: "a@test.local" },
        }),
      );
      await Promise.resolve();
    });

    expect(auth.isLoading).toBe(false);
    expect(auth.isApiLoading).toBe(false);

    const idleSessionPromise = new Promise<Response>((resolve) => {
      resolveSession = resolve;
    });
    fetchFn.mockImplementationOnce(
      asFetchMock(async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return idleSessionPromise;
        }
        return new Response(null, { status: 404 });
      }),
    );

    await act(async () => {
      window.dispatchEvent(new MouseEvent("mousedown"));
      await Promise.resolve();
    });

    expect(auth.isApiLoading).toBe(false);

    await act(async () => {
      resolveSession!(
        Response.json({
          authenticated: true,
          user: { id: "user-1", email: "a@test.local" },
        }),
      );
      await Promise.resolve();
    });

    expect(auth.isApiLoading).toBe(false);
  });

  it("logs in and updates session state", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return Response.json(
            { code: "SESSION_EXPIRED", message: "Session expired." },
            { status: 401 },
          );
        }
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return csrfResponse();
        }
        if (url.endsWith("/auth/login")) {
          expect(new Headers(init?.headers).get(AUTH_CSRF_HEADER)).toBe(CSRF_TOKEN);
          return Response.json({
            authenticated: true,
            user: { id: "user-2", email: "b@test.local" },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    let loginResult: Awaited<ReturnType<typeof auth.login>>;
    await act(async () => {
      loginResult = await auth.login({
        email: "b@test.local",
        password: "secret-password",
      });
    });

    expect(isSessionResponse(loginResult!)).toBe(true);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.email).toBe("b@test.local");
  });

  it("returns MFA challenge without setting authenticated user", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return Response.json(
            { code: "SESSION_EXPIRED", message: "Session expired." },
            { status: 401 },
          );
        }
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return csrfResponse();
        }
        if (url.endsWith("/auth/login")) {
          return Response.json({
            mfaRequired: true,
            loginToken: "login-token-abc",
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    let loginResult: Awaited<ReturnType<typeof auth.login>>;
    await act(async () => {
      loginResult = await auth.login({
        email: "mfa@test.local",
        password: "secret-password",
      });
    });

    expect(isMfaRequiredResponse(loginResult!)).toBe(true);
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
  });

  it("registers and updates session state", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return Response.json(
            { code: "SESSION_EXPIRED", message: "Session expired." },
            { status: 401 },
          );
        }
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return csrfResponse();
        }
        if (url.endsWith("/auth/register")) {
          return Response.json(
            {
              authenticated: true,
              user: { id: "user-3", email: "new@test.local" },
            },
            { status: 201 },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    await act(async () => {
      await auth.register({
        email: "new@test.local",
        password: "new-password",
      });
    });

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.email).toBe("new@test.local");
  });

  it("logs out and clears session state", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return Response.json({
            authenticated: true,
            user: { id: "user-4", email: "c@test.local" },
          });
        }
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return csrfResponse();
        }
        if (url.endsWith("/auth/logout")) {
          return new Response(null, { status: 204 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);
    expect(auth.isAuthenticated).toBe(true);

    await act(async () => {
      await auth.logout();
    });

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
  });

  it("propagates login errors without updating user", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return Response.json(
            { code: "SESSION_EXPIRED", message: "Session expired." },
            { status: 401 },
          );
        }
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return csrfResponse();
        }
        if (url.endsWith("/auth/login")) {
          return Response.json(
            { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
            { status: 401 },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    await expect(
      auth.login({ email: "bad@test.local", password: "wrong" }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
  });

  it("throws when used outside AuthProvider", () => {
    expect(() => {
      act(() => {
        root.render(createElement(Probe));
      });
    }).toThrow("useAuthContext must be used within AuthProvider");
  });
});

describe("auth-session helpers", () => {
  it("classifies login responses", () => {
    expect(
      isSessionResponse({
        authenticated: true,
        user: { id: "1", email: "a@test.local" },
      }),
    ).toBe(true);
    expect(
      isMfaRequiredResponse({ mfaRequired: true, loginToken: "token" }),
    ).toBe(true);
  });
});
