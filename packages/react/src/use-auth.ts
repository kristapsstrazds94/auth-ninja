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
  login(input: LoginInput): Promise<LoginResult>;
  logout(): Promise<void>;
  register(input: RegisterInput): Promise<SessionResponse>;
  refreshSession(): Promise<SessionResponse | null>;
};

/** Headless auth hook — session state and login/logout/register methods. */
export function useAuth(): AuthState {
  return useAuthContext();
}
