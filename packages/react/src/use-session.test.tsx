/**
 * @vitest-environment jsdom
 */
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./provider.js";
import { SESSION_SYNC_CHANNEL } from "./session-sync.js";
import { useSession } from "./use-session.js";

const BASE_URL = "https://auth.example";

function asFetchMock(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return impl as typeof fetch;
}

describe("useSession", () => {
  let root: Root;
  let container: HTMLDivElement;
  let session!: ReturnType<typeof useSession>;

  function Probe() {
    session = useSession();
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
    vi.useRealTimers();
  });

  async function renderProvider(
    fetchFn: typeof fetch,
    props: Partial<ComponentProps<typeof AuthProvider>> = {},
  ): Promise<void> {
    await act(async () => {
      root.render(
        createElement(
          AuthProvider,
          {
            baseUrl: BASE_URL,
            fetchFn,
            sessionIdleRefresh: false,
            sessionSync: false,
            ...props,
          },
          createElement(Probe),
        ),
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("mirrors authenticated session state from AuthProvider", async () => {
    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        if (String(input).endsWith("/auth/session")) {
          return Response.json({
            authenticated: true,
            user: { id: "user-1", email: "a@test.local" },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);

    expect(session.isLoading).toBe(false);
    expect(session.isAuthenticated).toBe(true);
    expect(session.user).toEqual({ id: "user-1", email: "a@test.local" });
  });

  it("refresh updates session state when server session expires", async () => {
    let sessionCalls = 0;
    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        if (String(input).endsWith("/auth/session")) {
          sessionCalls += 1;
          if (sessionCalls === 1) {
            return Response.json({
              authenticated: true,
              user: { id: "user-1", email: "a@test.local" },
            });
          }
          return Response.json(
            { code: "SESSION_EXPIRED", message: "Session expired." },
            { status: 401 },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn);
    expect(session.isAuthenticated).toBe(true);

    await act(async () => {
      await session.refresh();
    });

    expect(session.isAuthenticated).toBe(false);
    expect(session.user).toBeNull();
  });

  it("clears session when idle refresh detects expiry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let sessionCalls = 0;
    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        if (String(input).endsWith("/auth/session")) {
          sessionCalls += 1;
          if (sessionCalls <= 1) {
            return Response.json({
              authenticated: true,
              user: { id: "user-1", email: "a@test.local" },
            });
          }
          return Response.json(
            { code: "SESSION_EXPIRED", message: "Session expired." },
            { status: 401 },
          );
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn, {
      sessionIdleRefresh: true,
      sessionIdleMinutes: 15,
    });

    expect(session.isAuthenticated).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300_000);
      await Promise.resolve();
    });

    expect(session.isAuthenticated).toBe(false);
    expect(session.user).toBeNull();
    expect(sessionCalls).toBeGreaterThan(1);
  });

  it("syncs session when another tab broadcasts a change", async () => {
    const channel = new BroadcastChannel(SESSION_SYNC_CHANNEL);
    let sessionCalls = 0;

    const fetchFn = vi.fn(
      asFetchMock(async (input) => {
        if (String(input).endsWith("/auth/session")) {
          sessionCalls += 1;
          if (sessionCalls === 1) {
            return Response.json(
              { code: "SESSION_EXPIRED", message: "Session expired." },
              { status: 401 },
            );
          }
          return Response.json({
            authenticated: true,
            user: { id: "user-2", email: "b@test.local" },
          });
        }
        return new Response(null, { status: 404 });
      }),
    );

    await renderProvider(fetchFn, { sessionSync: true });
    expect(session.isAuthenticated).toBe(false);

    await act(async () => {
      channel.postMessage({ type: "session-changed" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(session.isAuthenticated).toBe(true);
    expect(session.user?.email).toBe("b@test.local");
    expect(sessionCalls).toBe(2);

    channel.close();
  });
});
