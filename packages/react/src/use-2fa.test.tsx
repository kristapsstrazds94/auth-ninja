/**
 * @vitest-environment jsdom
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_CSRF_HEADER, AUTH_CSRF_PATH } from "./auth-client.js";
import { AuthProvider } from "./provider.js";
import { use2FA } from "./use-2fa.js";
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

describe("use2FA", () => {
  let root: Root;
  let container: HTMLDivElement;
  let twoFa!: ReturnType<typeof use2FA>;
  let auth!: ReturnType<typeof useAuth>;

  function Probe() {
    twoFa = use2FA();
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

  it("enrolls and confirms 2FA with CSRF on state-changing requests", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/auth/session")) {
          return Response.json({
            authenticated: true,
            user: { id: "user-1", email: "a@test.local", mfaEnabled: false },
          });
        }
        if (url.endsWith(AUTH_CSRF_PATH)) {
          return csrfResponse();
        }
        if (url.endsWith("/auth/2fa/enroll")) {
          expect(new Headers(init?.headers).get(AUTH_CSRF_HEADER)).toBe(CSRF_TOKEN);
          return Response.json({
            secret: "JBSWY3DPEHPK3PXP",
            otpauthUrl: "otpauth://totp/AuthNinja:a@test.local?secret=JBSWY3DPEHPK3PXP",
          });
        }
        if (url.endsWith("/auth/2fa/confirm")) {
          return Response.json({
            mfaEnabled: true,
            backupCodes: ["backup-code-1", "backup-code-2"],
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    let enrollResult: Awaited<ReturnType<typeof twoFa.enroll>>;
    await act(async () => {
      enrollResult = await twoFa.enroll();
    });

    expect(enrollResult!.secret).toBe("JBSWY3DPEHPK3PXP");

    let confirmResult: Awaited<ReturnType<typeof twoFa.confirm>>;
    await act(async () => {
      confirmResult = await twoFa.confirm("123456");
    });

    expect(confirmResult!.backupCodes).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledWith(
      `${BASE_URL}/auth/2fa/confirm`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("completes MFA login and updates session state", async () => {
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
        if (url.endsWith("/auth/2fa/verify")) {
          return Response.json({
            authenticated: true,
            user: { id: "user-2", email: "mfa@test.local", mfaEnabled: true },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    await act(async () => {
      await twoFa.verifyLogin({ loginToken: "login-token-abc", code: "654321" });
    });

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.email).toBe("mfa@test.local");
  });

  it("propagates invalid MFA errors without updating session", async () => {
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
        if (url.endsWith("/auth/2fa/verify")) {
          return Response.json(
            { code: "MFA_INVALID", message: "Invalid verification code." },
            { status: 400 },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    await expect(
      twoFa.verifyLogin({ loginToken: "login-token-abc", code: "000000" }),
    ).rejects.toMatchObject({ code: "MFA_INVALID" });

    expect(auth.isAuthenticated).toBe(false);
  });

  it("throws when used outside AuthProvider", () => {
    expect(() => {
      act(() => {
        root.render(createElement(Probe));
      });
    }).toThrow("useAuthContext must be used within AuthProvider");
  });
});
