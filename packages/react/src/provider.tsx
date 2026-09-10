import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createAuthClient } from "./auth-client.js";
import {
  fetchSession,
  isSessionResponse,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type AuthUser,
  type LoginInput,
  type LoginResult,
  type RegisterInput,
  type SessionResponse,
} from "./auth-session.js";
import {
  createIdleRefreshController,
  DEFAULT_SESSION_IDLE_MINUTES,
} from "./session-idle.js";
import { createSessionSync } from "./session-sync.js";
import type { AuthState } from "./use-auth.js";

export type AuthProviderProps = {
  baseUrl: string;
  children: ReactNode;
  /** Custom fetch for tests. Defaults to global `fetch`. */
  fetchFn?: typeof fetch;
  /** Idle timeout in minutes — must match server `AUTH_NINJA_SESSION_IDLE_MINUTES`. */
  sessionIdleMinutes?: number;
  /** Refresh session on user activity and before idle expiry. Default `true`. */
  sessionIdleRefresh?: boolean;
  /** Sync session state across browser tabs. Default `true`. */
  sessionSync?: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  baseUrl,
  children,
  fetchFn,
  sessionIdleMinutes = DEFAULT_SESSION_IDLE_MINUTES,
  sessionIdleRefresh = true,
  sessionSync = true,
}: AuthProviderProps) {
  const client = useMemo(
    () => createAuthClient({ baseUrl, fetchFn }),
    [baseUrl, fetchFn],
  );

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionSyncRef = useRef<ReturnType<typeof createSessionSync> | null>(null);

  const refreshSession = useCallback(async (): Promise<SessionResponse | null> => {
    const session = await fetchSession(client);
    setUser(session?.user ?? null);
    return session;
  }, [client]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await refreshSession();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!sessionSync) return;

    const sync = createSessionSync(() => {
      void refreshSession();
    });
    sessionSyncRef.current = sync;

    return () => {
      sync.close();
      sessionSyncRef.current = null;
    };
  }, [sessionSync, refreshSession]);

  const broadcastSessionChange = useCallback(() => {
    sessionSyncRef.current?.broadcast();
  }, []);

  useEffect(() => {
    if (!sessionIdleRefresh || user === null) return;

    const controller = createIdleRefreshController({
      idleMinutes: sessionIdleMinutes,
      onRefresh: () => {
        void refreshSession();
      },
    });

    controller.start();
    return () => {
      controller.stop();
    };
  }, [sessionIdleRefresh, sessionIdleMinutes, user, refreshSession]);

  const login = useCallback(
    async (input: LoginInput): Promise<LoginResult> => {
      const result = await loginRequest(client, input);
      if (isSessionResponse(result)) {
        setUser(result.user);
        broadcastSessionChange();
      }
      return result;
    },
    [client, broadcastSessionChange],
  );

  const logout = useCallback(async (): Promise<void> => {
    await logoutRequest(client);
    setUser(null);
    broadcastSessionChange();
  }, [client, broadcastSessionChange]);

  const register = useCallback(
    async (input: RegisterInput): Promise<SessionResponse> => {
      const result = await registerRequest(client, input);
      setUser(result.user);
      broadcastSessionChange();
      return result;
    },
    [client, broadcastSessionChange],
  );

  const value = useMemo<AuthState>(
    () => ({
      baseUrl,
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      register,
      refreshSession,
    }),
    [baseUrl, user, isLoading, login, logout, register, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
