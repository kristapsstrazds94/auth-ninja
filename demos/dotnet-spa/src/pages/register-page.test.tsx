/**
 * @vitest-environment jsdom
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setInputValue } from "../test/dom";
import { AUTH_CSRF_HEADER, AUTH_CSRF_PATH } from "@auth-ninja/react";
import { AuthProvider } from "@auth-ninja/react";
import { HomePage } from "./HomePage";
import { RegisterPage } from "./RegisterPage";

const BASE_URL = "";
const CSRF_TOKEN = "csrf-token-32-chars-minimum!!";

function asFetchMock(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return impl as typeof fetch;
}

function csrfResponse(): Response {
  return Response.json({ token: CSRF_TOKEN });
}

describe("RegisterPage", () => {
  let cleanup: (() => void) | null = null;

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
          sessionCheckOnMount: false,
          children: createElement(
            MemoryRouter,
            {
              initialEntries: ["/register"],
              children: createElement(Routes, {
                children: [
                  createElement(Route, {
                    path: "/register",
                    element: createElement(RegisterPage),
                  }),
                  createElement(Route, { path: "/", element: createElement(HomePage) }),
                ],
              }),
            },
          ),
        }),
      );
    });

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInputs = container.querySelectorAll('input[type="password"]');
    const passwordInput = passwordInputs[0] as HTMLInputElement;
    const confirmPasswordInput = passwordInputs[1] as HTMLInputElement;

    await act(async () => {
      setInputValue(emailInput, "new@test.local");
      setInputValue(passwordInput, "secure-password-1");
      setInputValue(confirmPasswordInput, "secure-password-1");
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

  it("shows a validation error when passwords do not match", async () => {
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
          sessionCheckOnMount: false,
          children: createElement(
            MemoryRouter,
            {
              initialEntries: ["/register"],
              children: createElement(Routes, {
                children: createElement(Route, {
                  path: "/register",
                  element: createElement(RegisterPage),
                }),
              }),
            },
          ),
        }),
      );
    });

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInputs = container.querySelectorAll('input[type="password"]');
    const passwordInput = passwordInputs[0] as HTMLInputElement;
    const confirmPasswordInput = passwordInputs[1] as HTMLInputElement;

    await act(async () => {
      setInputValue(emailInput, "new@test.local");
      setInputValue(passwordInput, "secure-password-1");
      setInputValue(confirmPasswordInput, "different-password");
    });

    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      form.requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("Passwords do not match.");
    expect(
      fetchFn.mock.calls.some(([url]) => String(url).endsWith("/auth/register")),
    ).toBe(false);
  });
});
