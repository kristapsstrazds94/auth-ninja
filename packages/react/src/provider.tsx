import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import type { AuthState } from "./use-auth.js";

export type AuthProviderProps = {
  baseUrl: string;
  children: ReactNode;
  /** Custom fetch for tests. Defaults to global `fetch`. */
  fetchFn?: typeof fetch;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ baseUrl, children, fetchFn }: AuthProviderProps) {
  const client = useMemo(
    () => createAuthClient({ baseUrl, fetchFn }),
    [baseUrl, fetchFn],
  );

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const login = useCallback(
    async (input: LoginInput): Promise<LoginResult> => {
      const result = await loginRequest(client, input);
      if (isSessionResponse(result)) {
        setUser(result.user);
      }
      return result;
    },
    [client],
  );

  const logout = useCallback(async (): Promise<void> => {
    await logoutRequest(client);
    setUser(null);
  }, [client]);

  const register = useCallback(
    async (input: RegisterInput): Promise<SessionResponse> => {
      const result = await registerRequest(client, input);
      setUser(result.user);
      return result;
    },
    [client],
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
