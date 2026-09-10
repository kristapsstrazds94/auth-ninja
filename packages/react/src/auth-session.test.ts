import { AuthNinjaError } from "@auth-ninja/core";
import { describe, expect, it, vi } from "vitest";
import { createAuthClient } from "./auth-client.js";
import { fetchSession, login, logout, register } from "./auth-session.js";

describe("auth-session", () => {
  it("fetchSession returns null on SESSION_EXPIRED", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(
        { code: "SESSION_EXPIRED", message: "Session expired." },
        { status: 401 },
      ),
    );

    const client = createAuthClient({ baseUrl: "https://auth.example", fetchFn });
    await expect(fetchSession(client)).resolves.toBeNull();
  });

  it("fetchSession rethrows non-session errors", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ code: "RATE_LIMITED", message: "Too many requests." }, { status: 429 }),
    );

    const client = createAuthClient({ baseUrl: "https://auth.example", fetchFn });
    await expect(fetchSession(client)).rejects.toBeInstanceOf(AuthNinjaError);
  });

  it("logout clears CSRF token after success", async () => {
    let csrfFetches = 0;
    const fetchFn = vi.fn(
      async (input) => {
        const url = String(input);
        if (url.endsWith("/auth/csrf")) {
          csrfFetches += 1;
          return Response.json({ token: `csrf-token-${csrfFetches}` });
        }
        if (url.endsWith("/auth/logout")) {
          return new Response(null, { status: 204 });
        }
        return new Response(null, { status: 404 });
      },
    );

    const client = createAuthClient({ baseUrl: "https://auth.example", fetchFn });
    await logout(client);

    await client.request("/auth/logout", { method: "POST" });
    expect(csrfFetches).toBe(2);
  });

  it("login and register send JSON bodies", async () => {
    const fetchFn = vi.fn(
      async (input, init) => {
        const url = String(input);
        if (url.endsWith("/auth/csrf")) {
          return Response.json({ token: "csrf-token-32-chars-minimum!!" });
        }
        if (url.endsWith("/auth/login")) {
          expect(JSON.parse(String(init?.body))).toEqual({
            email: "a@test.local",
            password: "secret",
          });
          return Response.json({
            authenticated: true,
            user: { id: "1", email: "a@test.local" },
          });
        }
        if (url.endsWith("/auth/register")) {
          return Response.json(
            {
              authenticated: true,
              user: { id: "2", email: "b@test.local" },
            },
            { status: 201 },
          );
        }
        return new Response(null, { status: 404 });
      },
    );

    const client = createAuthClient({ baseUrl: "https://auth.example", fetchFn });

    await login(client, { email: "a@test.local", password: "secret" });
    await register(client, { email: "b@test.local", password: "secret2" });

    expect(fetchFn.mock.calls.some(([url]) => String(url).endsWith("/auth/login"))).toBe(true);
    expect(fetchFn.mock.calls.some(([url]) => String(url).endsWith("/auth/register"))).toBe(true);
  });
});
