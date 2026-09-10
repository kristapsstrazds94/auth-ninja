/**
 * @vitest-environment jsdom
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_CSRF_HEADER, AUTH_CSRF_PATH } from "./auth-client.js";
import { AuthProvider } from "./provider.js";
import { useAuth } from "./use-auth.js";
import { usePasskey } from "./use-passkey.js";

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

const MOCK_CREDENTIAL_RESPONSE = {
  id: "cred-id",
  rawId: "cred-id",
  type: "public-key",
  response: { attestationObject: "...", clientDataJSON: "..." },
};

describe("usePasskey", () => {
  let root: Root;
  let container: HTMLDivElement;
  let passkey!: ReturnType<typeof usePasskey>;
  let auth!: ReturnType<typeof useAuth>;

  function Probe() {
    passkey = usePasskey();
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

  it("runs register begin/finish flow with CSRF", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return Response.json({
            authenticated: true,
            user: { id: "user-1", email: "a@test.local" },
          });
        }
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return csrfResponse();
        }
        if (url.endsWith("/auth/passkeys/register/begin")) {
          expect(new Headers(init?.headers).get(AUTH_CSRF_HEADER)).toBe(CSRF_TOKEN);
          return Response.json({
            options: { challenge: "abc", rp: { id: "auth.example", name: "Auth" } },
          });
        }
        if (url.endsWith("/auth/passkeys/register/finish")) {
          return Response.json(
            {
              credentialId: "cred-123",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
            { status: 201 },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    let options: Awaited<ReturnType<typeof passkey.registerBegin>>;
    await act(async () => {
      options = await passkey.registerBegin();
    });

    expect(options!.options.challenge).toBe("abc");

    let credential: Awaited<ReturnType<typeof passkey.registerFinish>>;
    await act(async () => {
      credential = await passkey.registerFinish(MOCK_CREDENTIAL_RESPONSE);
    });

    expect(credential!.credentialId).toBe("cred-123");
  });

  it("completes passkey login and updates session state", async () => {
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
        if (url.endsWith("/auth/passkeys/login/begin")) {
          return Response.json({
            options: { challenge: "login-challenge", rpId: "auth.example" },
          });
        }
        if (url.endsWith("/auth/passkeys/login/finish")) {
          return Response.json({
            authenticated: true,
            user: { id: "user-2", email: "passkey@test.local", passkeysEnabled: true },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    await act(async () => {
      await passkey.loginBegin({ email: "passkey@test.local" });
    });

    await act(async () => {
      await passkey.loginFinish(MOCK_CREDENTIAL_RESPONSE);
    });

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.email).toBe("passkey@test.local");
  });

  it("lists and removes passkeys", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return Response.json({
            authenticated: true,
            user: { id: "user-3", email: "c@test.local", passkeysEnabled: true },
          });
        }
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return csrfResponse();
        }
        if (url.endsWith("/auth/passkeys") && init?.method === "GET") {
          return Response.json({
            passkeys: [
              { credentialId: "cred-a", createdAt: "2026-01-01T00:00:00.000Z" },
            ],
          });
        }
        if (url.endsWith("/auth/passkeys/cred-a") && init?.method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    let listResult: Awaited<ReturnType<typeof passkey.list>>;
    await act(async () => {
      listResult = await passkey.list();
    });

    expect(listResult!.passkeys).toHaveLength(1);

    await act(async () => {
      await passkey.remove("cred-a");
    });

    expect(fetchFn).toHaveBeenCalledWith(
      `${BASE_URL}/auth/passkeys/cred-a`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("propagates passkey login errors without updating session", async () => {
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
        if (url.endsWith("/auth/passkeys/login/finish")) {
          return Response.json(
            { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
            { status: 401 },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    await expect(passkey.loginFinish(MOCK_CREDENTIAL_RESPONSE)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    expect(auth.isAuthenticated).toBe(false);
  });
});
