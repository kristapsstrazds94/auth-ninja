import { useAuthContext } from "./provider.js";

export type AuthState = {
  baseUrl: string;
  isAuthenticated: boolean;
  isLoading: boolean;
};

/** Headless auth hook — full implementation in task 2.2 */
export function useAuth(): AuthState {
  const { baseUrl } = useAuthContext();
  return {
    baseUrl,
    isAuthenticated: false,
    isLoading: false,
  };
}
