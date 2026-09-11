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
import { LoginPage } from "@/components/login-page";

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
  usePathname: () => "/login",
}));

function asFetchMock(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return impl as typeof fetch;
}

function csrfResponse(): Response {
  return Response.json({ token: CSRF_TOKEN });
}

function FlowApp({ fetchFn }: { fetchFn: typeof fetch }) {
  const [path, setPath] = useState("/login");

  router.push.mockImplementation((nextPath: string) => {
    setPath(nextPath);
  });

  if (path === "/") {
    return createElement(HomePage);
  }
  return createElement(LoginPage);
}

function renderApp(fetchFn: typeof fetch) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(AuthProvider, {
        baseUrl: BASE_URL,
        fetchFn,
        children: createElement(FlowApp, { fetchFn }),
      }),
    );
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("LoginPage", () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    router.push.mockClear();
    router.replace.mockClear();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
  });

  it("signs in and shows the home page", async () => {
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
        if (url.endsWith("/auth/login") && init?.method === "POST") {
          return Response.json({
            authenticated: true,
            user: { id: "user-1", email: "demo@test.local" },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const app = renderApp(fetchFn);
    cleanup = app.unmount;

    const emailInput = app.container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = app.container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;

    await act(async () => {
      setInputValue(emailInput, "demo@test.local");
      setInputValue(passwordInput, "secure-password-1");
    });

    const form = app.container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      form.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const loginCall = fetchFn.mock.calls.find(([url]) => String(url).endsWith("/auth/login"));
    expect(loginCall).toBeDefined();
    expect(new Headers(loginCall![1]?.headers).get(AUTH_CSRF_HEADER)).toBe(CSRF_TOKEN);

    expect(app.container.textContent).toContain("Signed in");
    expect(app.container.textContent).toContain("demo@test.local");
  });

  it("shows a generic error when credentials are invalid", async () => {
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
        if (url.endsWith("/auth/login") && init?.method === "POST") {
          return Response.json(
            { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
            { status: 401 },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

    const app = renderApp(fetchFn);
    cleanup = app.unmount;

    const emailInput = app.container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = app.container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;

    await act(async () => {
      setInputValue(emailInput, "unknown@test.local");
      setInputValue(passwordInput, "wrong-password");
    });

    const form = app.container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      form.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(app.container.textContent).toContain("Invalid email or password.");
    expect(app.container.textContent).not.toContain("unknown@test.local");
  });
});
