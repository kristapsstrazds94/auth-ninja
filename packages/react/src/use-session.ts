import { useAuthContext } from "./provider.js";
import type { AuthUser, SessionResponse } from "./auth-session.js";

export type SessionState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Re-fetch session from the server and sync local state. */
  refresh(): Promise<SessionResponse | null>;
};

/** Headless hook for read-only session state and explicit refresh. */
export function useSession(): SessionState {
  const { user, isAuthenticated, isLoading, refreshSession } = useAuthContext();

  return {
    user,
    isAuthenticated,
    isLoading,
    refresh: refreshSession,
  };
}
