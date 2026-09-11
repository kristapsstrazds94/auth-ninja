/**
 * @vitest-environment jsdom
 */
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setInputValue } from "@/test/dom";
import { AUTH_CSRF_HEADER, AUTH_CSRF_PATH } from "@auth-ninja/react";
import { AuthProvider } from "@auth-ninja/react";
import { HomePage } from "@/components/home-page";
import { RegisterPage } from "@/components/register-page";

const BASE_URL = "";
const CSRF_TOKEN = "csrf-token-32-chars-minimum!!";

const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/register",
}));

function asFetchMock(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return impl as typeof fetch;
}

function csrfResponse(): Response {
  return Response.json({ token: CSRF_TOKEN });
}

function FlowApp() {
  const [path, setPath] = useState("/register");

  router.push.mockImplementation((nextPath: string) => {
    setPath(nextPath);
  });

  if (path === "/") {
    return createElement(HomePage);
  }
  return createElement(RegisterPage);
}

describe("RegisterPage", () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    router.push.mockClear();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it("registers a new account and lands on home", async () => {
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
        if (url.endsWith("/auth/register") && init?.method === "POST") {
          return Response.json({
            authenticated: true,
            user: { id: "user-new", email: "new@test.local" },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    };

    act(() => {
      root.render(
        createElement(AuthProvider, {
          baseUrl: BASE_URL,
          fetchFn,
          children: createElement(FlowApp),
        }),
      );
    });

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;

    await act(async () => {
      setInputValue(emailInput, "new@test.local");
      setInputValue(passwordInput, "secure-password-1");
    });

    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      form.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const registerCall = fetchFn.mock.calls.find(([url]) =>
      String(url).endsWith("/auth/register"),
    );
    expect(registerCall).toBeDefined();
    expect(new Headers(registerCall![1]?.headers).get(AUTH_CSRF_HEADER)).toBe(CSRF_TOKEN);

    expect(container.textContent).toContain("Signed in");
    expect(container.textContent).toContain("new@test.local");
  });
});
