import { useAuthContext } from "./provider.js";
import type {
  AuthUser,
  LoginInput,
  LoginResult,
  RegisterInput,
  SessionResponse,
} from "./auth-session.js";

export type AuthState = {
  baseUrl: string;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Set when the initial session check or an explicit refresh fails (non-expired). */
  sessionError: Error | null;
  login(input: LoginInput): Promise<LoginResult>;
  logout(): Promise<void>;
  register(input: RegisterInput): Promise<SessionResponse>;
  refreshSession(): Promise<SessionResponse | null>;
};

/** Headless auth hook — session state and login/logout/register methods. */
export function useAuth(): AuthState {
  const {
    baseUrl,
    user,
    isAuthenticated,
    isLoading,
    sessionError,
    login,
    logout,
    register,
    refreshSession,
  } = useAuthContext();

  return {
    baseUrl,
    user,
    isAuthenticated,
    isLoading,
    sessionError,
    login,
    logout,
    register,
    refreshSession,
  };
}
