import { createContext, useContext, useMemo, type ReactNode } from "react";

export type AuthProviderProps = {
  baseUrl: string;
  children: ReactNode;
};

type AuthContextValue = {
  baseUrl: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ baseUrl, children }: AuthProviderProps) {
  const value = useMemo(() => ({ baseUrl }), [baseUrl]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
